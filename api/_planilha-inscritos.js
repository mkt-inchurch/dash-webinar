// Leitura compartilhada da planilha de INSCRITOS de uma edição.
//
// Até aqui só o card "Total de Inscritos" lia essa planilha, e as demais métricas
// vinham de planilhas próprias (a "Pesquisa Geral" para pesquisas/ICPs/UTMs e a de
// diagnósticos). Existem edições que NÃO têm essas planilhas: a Calculadora de
// Líderes traz a qualificação do lead e a resposta do diagnóstico em colunas da
// própria planilha de inscritos. Para essas, a edição declara `icpFonte`/`diagFonte`
// /`utmFonte` = 'inscritos' e /icps, /diagnosticos e /utms leem daqui.
//
// Como em todo o resto do painel, o processamento é no servidor: só contagens saem
// para o navegador, nunca nome/e-mail/telefone.

import { brToTs, toBoundTs } from './_editions.js';

// Planilha padrão (webinar de IA). Edições com planilha própria definem
// `inscritosSheet` na config.
export const DEFAULT_SHEET_ID = '1QkFMFOCMMAzj3BgEoiCtTD_YHSu48p51xmu9Y3TaulM';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Parser CSV mínimo (trata aspas e vírgulas dentro de campos).
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Compara cabeçalhos ignorando acento, caixa e espaços nas pontas — as planilhas
// variam entre "Qualificação"/"QUALIFICACAO" conforme quem criou o formulário.
const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Índice da coluna pelo nome. -1 quando não existe.
export function colIndex(header, nome) {
  const alvo = norm(nome);
  return header.findIndex((h) => norm(h) === alvo);
}

// Endpoint /export (não gviz): o gviz RESPEITA filtros aplicados na planilha e
// devolve só as linhas visíveis — foi o que fez o card do 20/07 mostrar 365/2 em
// vez de 1023/668. O /export devolve a aba inteira, imune a filtros. A aba vem do
// `inscritosGid` (o /export não aceita nome de aba); sem gid, usa a primeira.
export function inscritosCsvUrl(ed) {
  const sheetId = ed.inscritosSheet || DEFAULT_SHEET_ID;
  return (
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv` +
    (ed.inscritosGid != null ? `&gid=${ed.inscritosGid}` : '')
  );
}

// Baixa a planilha de inscritos da edição. Lança erro com `status` HTTP quando a
// planilha responde mal (para o handler devolver 502 com a mensagem certa).
export async function lerInscritos(ed) {
  const r = await fetch(inscritosCsvUrl(ed), { headers: { 'User-Agent': BROWSER_UA } });
  if (!r.ok) {
    const err = new Error(
      `Planilha de inscritos respondeu ${r.status}. Verifique se está compartilhada como "Qualquer pessoa com o link · Leitor".`
    );
    err.status = r.status;
    throw err;
  }
  const rows = parseCSV(await r.text());
  if (rows.length < 2) {
    const err = new Error('Planilha de inscritos vazia');
    err.status = 502;
    throw err;
  }
  return { header: rows[0], linhas: rows.slice(1) };
}

// Dedup por e-mail dentro da janela da edição (`inscritosDesde`/`inscritosAte`),
// mantendo a PRIMEIRA inscrição de cada pessoa. `extras` mapeia uma chave para o
// nome da coluna que deve vir junto no registro (ex.: { ads: 'UTM Source' }).
// Retorna Map<email, { iso, ...extras }>.
export function dedupInscritos(ed, header, linhas, extras = {}) {
  const iEmail = colIndex(header, 'Email');
  const iData = colIndex(header, 'Data');
  if (iEmail === -1) {
    throw new Error(`Coluna Email não encontrada. Cabeçalhos: ${header.join(' | ')}`);
  }
  const DESDE = toBoundTs(ed.inscritosDesde, false);
  const ATE = toBoundTs(ed.inscritosAte, true);
  const idxExtras = Object.entries(extras).map(([chave, nome]) => [chave, colIndex(header, nome)]);

  const primeiroPorEmail = new Map();
  for (const row of linhas) {
    const email = String(row[iEmail] || '').trim().toLowerCase();
    if (!email) continue;
    const ts = iData === -1 ? null : brToTs(row[iData]);
    if (!ts) continue; // sem data
    if (DESDE && ts < DESDE) continue; // antes do início da edição
    if (ATE && ts > ATE) continue; // depois do fim da edição
    const iso = ts.slice(0, 10); // dia (para o "novos por dia")
    const atual = primeiroPorEmail.get(email);
    if (atual !== undefined && atual.iso <= iso) continue;
    const reg = { iso };
    for (const [chave, i] of idxExtras) reg[chave] = i === -1 ? '' : String(row[i] || '').trim();
    primeiroPorEmail.set(email, reg);
  }
  return primeiroPorEmail;
}

// Coluna da planilha de inscritos que classifica o lead (P1–P4/Cliente/
// Desqualificado) — o equivalente ao "Filtro de Leads" da planilha de pesquisa.
export const icpCol = (ed) => ed.icpCol || 'Qualificação';

// Contagem "novos por dia" no formato que o filtro de período do painel consome.
export function porDiaDeContagem(byDay) {
  return Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([data, novos]) => ({ data, novos }));
}
