// Vercel Serverless Function — conta "Total de Pesquisas" a partir da planilha
// (aba "Pesquisa - Webinar IA na Igreja"), deduplicando por e-mail e considerando
// apenas registros a partir de 19/06/2026 (há dados anteriores que devem ser
// ignorados). Processa no servidor: só contagens saem daqui, nada de PII.

import { getEdition, brToTs, toBoundTs } from './_editions.js';

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
// Aba única "Pesquisa Geral" (mistura TODOS os webinars). Usamos o endpoint
// /export em vez do gviz: o gviz RESPEITA filtros aplicados na planilha e devolve
// só as linhas visíveis — foi isso que zerou 15/06 e 04/07 (havia um filtro ativo
// mostrando só a Trilha). O /export devolve a aba inteira, imune a filtros.
// A separação por edição é feita por janela de data + utm_campaign (match/exclude).
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const EMAIL_COL = 'Qual é seu e-mail?';
const DATE_COL = 'Submitted At';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function parseCSV(text) {
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

export default async function handler(req, res) {
  const ed = getEdition(req);
  const DESDE = toBoundTs(ed.pesquisaDesde, false);
  const ATE = toBoundTs(ed.pesquisaAte, true);
  try {
    const r = await fetch(CSV_URL, { headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok) return res.status(502).json({ error: `Planilha respondeu ${r.status}` });
    const rows = parseCSV(await r.text());
    if (!rows.length) return res.status(502).json({ error: 'Planilha vazia' });

    const header = rows[0];
    const iEmail = header.indexOf(EMAIL_COL);
    const iDate = header.indexOf(DATE_COL);
    if (iEmail === -1 || iDate === -1) {
      return res.status(500).json({ error: 'Colunas de e-mail/data não encontradas' });
    }
    // A planilha mistura webinars; a edição separa pela utm_campaign: inclui só as
    // que contêm `pesquisaUtmMatch` e/ou exclui as que contêm `pesquisaUtmExclude`.
    const utmMatch = (ed.pesquisaUtmMatch || '').toUpperCase();
    const utmExclude = (ed.pesquisaUtmExclude || '').toUpperCase();
    const iUtm = (utmMatch || utmExclude) ? header.indexOf('utm_campaign') : -1;

    // Dedup por e-mail, considerando só registros a partir do CUTOFF, guardando a
    // data da primeira pesquisa (>= CUTOFF) de cada pessoa.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const utmVal = iUtm === -1 ? '' : String(row[iUtm] || '').toUpperCase();
      if (utmMatch && !utmVal.includes(utmMatch)) continue;
      if (utmExclude && utmVal.includes(utmExclude)) continue;
      const ts = brToTs(row[iDate]);
      if (!ts) continue;
      if (DESDE && ts < DESDE) continue; // antes do início da edição
      if (ATE && ts > ATE) continue; // depois do fim da edição
      const iso = ts.slice(0, 10);
      const cur = firstByEmail.get(email);
      if (cur === undefined || iso < cur) firstByEmail.set(email, iso);
    }

    const total = firstByEmail.size;

    const byDay = {};
    for (const iso of firstByEmail.values()) byDay[iso] = (byDay[iso] || 0) + 1;
    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, novos]) => ({ data, novos }));
    let acc = 0;
    for (const d of porDia) { acc += d.novos; d.acumulado = acc; }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ pesquisas: total, desde: ed.pesquisaDesde, porDia });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
