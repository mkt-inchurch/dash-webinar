// Vercel Serverless Function — tabela "UTM × Prioridade" a partir da planilha de
// pesquisa. Agrupa os leads (dedup por e-mail, dentro da janela da edição) por uma
// dimensão UTM (?dim=utm_source|utm_medium|utm_campaign) e conta por prioridade
// (P1–P4 = MQL) e Desqualificado (DESQ). "Cliente" fica fora do total.
// Processa no servidor: só contagens saem daqui, nada de PII.

import { getEdition, brToTs, criaFiltroPesquisa } from './_editions.js';
import { lerInscritos, dedupInscritos, icpCol } from './_planilha-inscritos.js';

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
// Aba única "Pesquisa Geral" via /export (imune a filtros; o gviz respeita filtros
// e devolvia só as linhas visíveis). Separação por edição = data + utm_campaign.
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const COL_EMAIL = 'Qual é seu e-mail?';
const COL_DATE = 'Submitted At';
const COL_FILTRO = 'Filtro de Leads';
const DIMS = ['utm_source', 'utm_medium', 'utm_campaign'];
const TOP_N = 20;
const MIN_VOL = 20; // volume mínimo p/ eleger melhor/pior qualidade
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Agrupa os leads (já deduplicados) por valor da dimensão UTM e conta por
// prioridade. "Cliente" e leads sem classificação ficam fora das linhas e são
// devolvidos à parte — sem isso, a soma da tabela fica menor que o total do card e
// não há como saber o porquê.
function agrupaPorUtm(dim, leads) {
  const g = new Map();
  let clientes = 0, semFiltro = 0;
  for (const { dimVal, filtro } of leads) {
    if (!g.has(dimVal)) g.set(dimVal, { nome: dimVal, p1: 0, p2: 0, p3: 0, p4: 0, desq: 0 });
    const b = g.get(dimVal);
    if (filtro === 'P1') b.p1++;
    else if (filtro === 'P2') b.p2++;
    else if (filtro === 'P3') b.p3++;
    else if (filtro === 'P4') b.p4++;
    else if (filtro.includes('DESQ')) b.desq++;
    else if (filtro.includes('CLIENTE')) clientes++;
    else semFiltro++;
  }

  const list = [...g.values()].map((b) => {
    const mql = b.p1 + b.p2 + b.p3 + b.p4;
    const total = mql + b.desq;
    return {
      ...b,
      mql,
      total,
      pMQL: total ? Math.round((mql / total) * 100) : 0,
      pDESQ: total ? Math.round((b.desq / total) * 100) : 0,
    };
  }).filter((b) => b.total > 0);

  list.sort((a, b) => b.total - a.total);

  // Melhor/pior qualidade entre os de volume relevante (>= MIN_VOL). Com menos de
  // duas linhas elegíveis não existe comparação: antes o fallback caía no top e a
  // MESMA campanha aparecia como "melhor qualidade" e "pior" ao mesmo tempo (era o
  // caso de 5 das 9 edições, que só têm uma utm_campaign).
  const elegiveis = list.filter((b) => b.total >= MIN_VOL);
  let melhor = null, pior = null;
  if (elegiveis.length >= 2) {
    for (const b of elegiveis) {
      if (!melhor || b.pMQL > melhor.pMQL) melhor = b;
      if (!pior || b.pMQL < pior.pMQL) pior = b;
    }
    // Empate no % de MQL: não existe "melhor" nem "pior" (era assim que a mesma
    // utm aparecia nos dois rótulos mesmo havendo 2+ linhas elegíveis).
    if (melhor === pior || melhor.pMQL === pior.pMQL) { melhor = null; pior = null; }
  }

  return {
    dim,
    rows: list.slice(0, TOP_N),
    // Leads da janela que não entram na tabela: sem classificação preenchida
    // (backlog) e os marcados como "Cliente".
    naoClassificados: semFiltro,
    clientes,
    melhor: melhor && { nome: melhor.nome, pMQL: melhor.pMQL, total: melhor.total },
    pior: pior && { nome: pior.nome, pMQL: pior.pMQL, total: pior.total },
  };
}

// Edições sem planilha de pesquisa (ex.: Calculadora de Líderes): as UTMs e a
// classificação do lead vivem na própria planilha de inscritos ("UTM Source" /
// "UTM Medium" / "UTM Campaign" + a coluna de qualificação).
const COL_UTM_INSCRITOS = {
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
};

async function utmsDaPlanilhaDeInscritos(ed, dim, res) {
  const { header, linhas } = await lerInscritos(ed);
  const registros = dedupInscritos(ed, header, linhas, {
    dimVal: COL_UTM_INSCRITOS[dim],
    filtro: icpCol(ed),
  });
  const leads = [...registros.values()].map((r) => ({
    dimVal: r.dimVal || '(sem utm)',
    filtro: String(r.filtro || '').toUpperCase(),
  }));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(agrupaPorUtm(dim, leads));
}

export default async function handler(req, res) {
  const ed = getEdition(req);
  const aceita = criaFiltroPesquisa(ed); // mesmo filtro de /pesquisas e /icps
  const dimRaw = req.query && req.query.dim;
  const dim = DIMS.includes(dimRaw) ? dimRaw : 'utm_campaign';

  try {
    if (ed.utmFonte === 'inscritos') return await utmsDaPlanilhaDeInscritos(ed, dim, res);

    const r = await fetch(CSV_URL, { headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok) return res.status(502).json({ error: `Planilha respondeu ${r.status}` });
    const rows = parseCSV(await r.text());
    if (!rows.length) return res.status(502).json({ error: 'Planilha vazia' });

    const header = rows[0];
    const iEmail = header.indexOf(COL_EMAIL);
    const iDate = header.indexOf(COL_DATE);
    const iFiltro = header.indexOf(COL_FILTRO);
    const iDim = header.indexOf(dim);
    if (iEmail === -1 || iFiltro === -1 || iDim === -1) {
      return res.status(500).json({ error: 'Colunas e-mail/Filtro de Leads/UTM não encontradas' });
    }
    const iUtm = header.indexOf('utm_campaign');

    // Dedup por e-mail guardando UTM + classificação. Mantem o registro MAIS ANTIGO
    // da janela (antes era a 1a linha na ordem da planilha): /icps ja fazia assim, e
    // com criterios diferentes a tabela podia mostrar uma classificacao e o card de
    // ICPs outra para a mesma pessoa.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const email = String(rows[i][iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const ts = iDate === -1 ? null : brToTs(rows[i][iDate]);
      if (!ts) continue;
      if (!aceita(iUtm === -1 ? '' : rows[i][iUtm], ts)) continue;
      const iso = ts.slice(0, 10);
      const cur = firstByEmail.get(email);
      if (cur && cur.iso <= iso) continue;
      firstByEmail.set(email, {
        iso,
        dimVal: String(rows[i][iDim] || '').trim() || '(sem utm)',
        filtro: String(rows[i][iFiltro] || '').trim().toUpperCase(),
      });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(agrupaPorUtm(dim, [...firstByEmail.values()]));
  } catch (err) {
    return res.status(err.status ? 502 : 500).json({ error: String(err.message || err) });
  }
}
