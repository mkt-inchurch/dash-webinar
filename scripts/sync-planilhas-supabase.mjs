// Sincroniza as planilhas que ainda são preenchidas fora do n8n com o Supabase.
//
// POR QUE ISSO EXISTE: a migração de 27/08/2026 tirou o painel das planilhas, mas
// duas delas continuam sendo alimentadas por fora — a "Pesquisa Geral" (respostas do
// formulário) e a de diagnósticos —, e a coluna "Filtro de Leads" é digitada à mão
// pelo time. Nenhum workflow do n8n escreve nelas. Sem esta sincronização, o painel
// congela: resposta nova não aparece e reclassificação feita na planilha não chega.
//
// Também sincroniza as planilhas de inscritos, o que cobre o intervalo entre uma
// edição nova começar a captar e o nó do Supabase entrar no workflow dela.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-planilhas-supabase.mjs
//
// É idempotente: roda quantas vezes quiser. O upsert atualiza o que mudou (incluindo
// a classificação do lead) e insere o que é novo. Nada é apagado.

import { EDITIONS, brToTs, toBoundTs, criaFiltroPesquisa } from '../api/_editions.js';

const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !CHAVE) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const SHEET_INSCRITOS_PADRAO = '1QkFMFOCMMAzj3BgEoiCtTD_YHSu48p51xmu9Y3TaulM';
const SHEET_PESQUISA = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
const SHEET_DIAGNOSTICOS = '1TCf4XiDVw-Rq0608W7712I5q-ZotwKzgZ7m56kmdpj0';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36';
const LOTE = 500;

// ---------------------------------------------------------------- utilidades
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const col = (h, nome) => h.findIndex((x) => norm(x) === norm(nome));
const val = (r, i) => (i === -1 ? null : (String(r[i] ?? '').trim() || null));

async function baixaCSV(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv` + (gid != null ? `&gid=${gid}` : '');
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  const texto = await r.text();
  // Sem compartilhamento, o Google responde 200 com uma página de login em HTML.
  // Engolir isso seria pior que falhar: entraria lixo no banco.
  if (/^\s*<(!doctype html|html)/i.test(texto.slice(0, 200))) {
    throw new Error(`A planilha ${sheetId} devolveu uma página de login. Compartilhe como "Qualquer pessoa com o link · Leitor" ou troque este script por acesso autenticado.`);
  }
  return parseCSV(texto);
}

async function upsert(tabela, linhas, chave) {
  let enviadas = 0;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const parte = linhas.slice(i, i + LOTE);
    const r = await fetch(`${URL_BASE}/rest/v1/${tabela}?on_conflict=${chave}`, {
      method: 'POST',
      headers: {
        apikey: CHAVE, Authorization: `Bearer ${CHAVE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(parte),
    });
    if (!r.ok) throw new Error(`${tabela}: lote ${i} falhou (HTTP ${r.status}) ${(await r.text()).slice(0, 300)}`);
    enviadas += parte.length;
  }
  return enviadas;
}

// ---------------------------------------------------------------- inscritos
async function sincronizaInscritos() {
  const linhas = [];
  for (const ed of Object.values(EDITIONS)) {
    const rows = await baixaCSV(ed.inscritosSheet || SHEET_INSCRITOS_PADRAO, ed.inscritosGid);
    const h = rows[0];
    const idx = {
      data: col(h, 'Data'), nome: col(h, 'Nome'), email: col(h, 'Email'), telefone: col(h, 'Telefone'),
      membresia: col(h, 'Membresia'), cargo: col(h, 'Cargo'), utm_source: col(h, 'UTM Source'),
      utm_medium: col(h, 'UTM Medium'), utm_campaign: col(h, 'UTM Campaign'), utm_content: col(h, 'UTM Content'),
      utm_term: col(h, 'UTM Term'), url: col(h, 'URL'), qualificacao: col(h, ed.icpCol || 'Qualificação'),
      diag: col(h, ed.diagCol || 'Diagnóstico'),
    };
    const DESDE = toBoundTs(ed.inscritosDesde, false), ATE = toBoundTs(ed.inscritosAte, true);
    const melhor = new Map();
    for (const row of rows.slice(1)) {
      if (row.every((c) => !String(c || '').trim())) continue;
      const email = (val(row, idx.email) || '').toLowerCase();
      if (!email) continue;
      const ts = idx.data === -1 ? null : brToTs(row[idx.data]);
      const naJanela = !!ts && !(DESDE && ts < DESDE) && !(ATE && ts > ATE);
      const reg = {
        edicao_id: ed.id, email, nome: val(row, idx.nome), telefone: val(row, idx.telefone),
        membresia: val(row, idx.membresia), cargo: val(row, idx.cargo),
        utm_source: val(row, idx.utm_source), utm_medium: val(row, idx.utm_medium),
        utm_campaign: val(row, idx.utm_campaign), utm_content: val(row, idx.utm_content),
        utm_term: val(row, idx.utm_term), url: val(row, idx.url),
        qualificacao: val(row, idx.qualificacao), inscrito_em: ts, na_janela: naJanela, origem: 'planilha',
        _diag: val(row, idx.diag),
      };
      const atual = melhor.get(email);
      const melhorQue = !atual || (reg.na_janela && !atual.na_janela) ||
        (reg.na_janela === atual.na_janela && reg.inscrito_em && (!atual.inscrito_em || reg.inscrito_em < atual.inscrito_em));
      if (melhorQue) melhor.set(email, reg);
    }
    linhas.push(...melhor.values());
  }
  const diags = linhas.filter((r) => r._diag);
  const limpas = linhas.map((r) => { const c = { ...r }; delete c._diag; return c; });
  return { linhas: limpas, diags };
}

// ---------------------------------------------------- pesquisas e diagnósticos
async function sincronizaPesquisas() {
  const rows = await baixaCSV(SHEET_PESQUISA);
  const h = rows[0];
  const i = {
    email: h.indexOf('Qual é seu e-mail?'), nome: h.indexOf('Qual é o seu nome?'),
    telefone: h.indexOf('Qual é seu telefone?'), data: h.indexOf('Submitted At'),
    filtro: h.indexOf('Filtro de Leads'), token: h.indexOf('Token'),
    utm_source: h.indexOf('utm_source'), utm_medium: h.indexOf('utm_medium'),
    utm_campaign: h.indexOf('utm_campaign'), utm_content: h.indexOf('utm_content'), utm_term: h.indexOf('utm_term'),
  };
  const mapeadas = new Set(Object.values(i));
  const filtros = Object.values(EDITIONS).filter((e) => e.pesquisaFonte !== 'nenhuma').map((e) => [e.id, criaFiltroPesquisa(e)]);
  const vistos = new Set(); const out = [];
  for (const row of rows.slice(1)) {
    const email = (val(row, i.email) || '').toLowerCase();
    const ts = i.data === -1 ? null : brToTs(row[i.data]);
    if (!email || !ts) continue;
    const chave = `${email}|${ts}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const utm = i.utm_campaign === -1 ? '' : row[i.utm_campaign];
    const casa = filtros.filter(([, f]) => f(utm, ts)).map(([id]) => id);
    const respostas = {};
    h.forEach((nome, k) => { if (!mapeadas.has(k) && String(nome || '').trim()) { const v = val(row, k); if (v) respostas[nome.trim()] = v; } });
    out.push({
      edicao_id: casa[0] ?? null, email, nome: val(row, i.nome), telefone: val(row, i.telefone),
      utm_source: val(row, i.utm_source), utm_medium: val(row, i.utm_medium), utm_campaign: val(row, i.utm_campaign),
      utm_content: val(row, i.utm_content), utm_term: val(row, i.utm_term),
      filtro_leads: val(row, i.filtro), respondido_em: ts, token: val(row, i.token),
      respostas: Object.keys(respostas).length ? respostas : null,
    });
  }
  return out;
}

async function sincronizaDiagnosticos(diagsDeInscritos) {
  const rows = await baixaCSV(SHEET_DIAGNOSTICOS);
  const h = rows[0];
  const i = {
    email: h.indexOf('Qual é seu e-mail?'), nome: h.indexOf('Qual é o seu nome?'),
    telefone: h.indexOf('Qual é seu telefone?'), data: h.indexOf('Submitted At'), token: h.indexOf('Token'),
    utm_source: h.indexOf('utm_source'), utm_medium: h.indexOf('utm_medium'),
    utm_campaign: h.indexOf('utm_campaign'), utm_content: h.indexOf('utm_content'), utm_term: h.indexOf('utm_term'),
  };
  const mapeadas = new Set(Object.values(i));
  const janelas = Object.values(EDITIONS).filter((e) => e.diagFonte !== 'inscritos')
    .map((e) => [e.id, toBoundTs(e.diagDesde, false), toBoundTs(e.diagAte, true)]);
  const vistos = new Set(); const out = [];
  for (const row of rows.slice(1)) {
    const email = (val(row, i.email) || '').toLowerCase();
    const ts = i.data === -1 ? null : brToTs(row[i.data]);
    if (!email || !ts) continue;
    const chave = `${email}|${ts}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const casa = janelas.filter(([, de, ate]) => !(de && ts < de) && !(ate && ts > ate)).map(([id]) => id);
    const respostas = {};
    h.forEach((nome, k) => { if (!mapeadas.has(k) && String(nome || '').trim()) { const v = val(row, k); if (v) respostas[nome.trim()] = v; } });
    out.push({
      edicao_id: casa[0] ?? null, email, nome: val(row, i.nome), telefone: val(row, i.telefone),
      utm_source: val(row, i.utm_source), utm_medium: val(row, i.utm_medium), utm_campaign: val(row, i.utm_campaign),
      utm_content: val(row, i.utm_content), utm_term: val(row, i.utm_term),
      pedido_em: ts, token: val(row, i.token), respostas: Object.keys(respostas).length ? respostas : null,
    });
  }
  // Edições que marcam o diagnóstico numa coluna da própria planilha de inscritos.
  for (const ed of Object.values(EDITIONS)) {
    if (ed.diagFonte !== 'inscritos') continue;
    const alvo = String(ed.diagValor || 'Sim').trim().toLowerCase();
    for (const r of diagsDeInscritos) {
      if (r.edicao_id !== ed.id || !r.na_janela) continue;
      if (String(r._diag || '').trim().toLowerCase() !== alvo) continue;
      const chave = `${r.email}|${r.inscrito_em}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({
        edicao_id: ed.id, email: r.email, nome: r.nome, telefone: r.telefone,
        utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign,
        utm_content: r.utm_content, utm_term: r.utm_term,
        pedido_em: r.inscrito_em, token: null, respostas: { origem: 'planilha de inscritos da edição' },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------- main
const t0 = Date.now();
const { linhas: inscritos, diags } = await sincronizaInscritos();
const pesquisas = await sincronizaPesquisas();
const diagnosticos = await sincronizaDiagnosticos(diags);

console.log(`inscritos:    ${await upsert('inscritos', inscritos, 'edicao_id,email')}`);
console.log(`pesquisas:    ${await upsert('pesquisas', pesquisas, 'email,respondido_em')}`);
console.log(`diagnósticos: ${await upsert('diagnosticos', diagnosticos, 'email,pedido_em')}`);
console.log(`\nsem edição: ${pesquisas.filter((p) => !p.edicao_id).length} pesquisas · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
