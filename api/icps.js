// Vercel Serverless Function — conta os ICPs (P1–P4) a partir da planilha de
// pesquisa, usando a classificação da própria equipe (coluna "Filtro de Leads"),
// deduplicando por e-mail e só a partir de 19/06/2026. Só contagens saem daqui.
//
// A coluna "Filtro de Leads" contém P1/P2/P3/P4/Cliente/Desqualificado.
// ICP = P1 + P2 + P3 + P4 (leads qualificados). Dedup: mantém o PRIMEIRO registro
// (>= 19/06) de cada e-mail.

import { getEdition, brToTs, toBoundTs } from './_editions.js';

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
const SHEET_TAB = 'Pesquisa - Webinar IA na Igreja';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
const COL_EMAIL = 'Qual é seu e-mail?';
const COL_DATE = 'Submitted At';
const COL_FILTRO = 'Filtro de Leads';
const PERFIS = ['P1', 'P2', 'P3', 'P4'];
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
    const iEmail = header.indexOf(COL_EMAIL);
    const iDate = header.indexOf(COL_DATE);
    const iFiltro = header.indexOf(COL_FILTRO);
    if (iEmail === -1 || iDate === -1 || iFiltro === -1) {
      return res.status(500).json({ error: 'Colunas e-mail/data/Filtro de Leads não encontradas' });
    }

    // Dedup por e-mail: mantém o PRIMEIRO registro (>= CUTOFF) de cada pessoa e usa
    // a classificação "Filtro de Leads" dele.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const ts = brToTs(row[iDate]);
      if (!ts) continue;
      if (DESDE && ts < DESDE) continue;
      if (ATE && ts > ATE) continue;
      const iso = ts.slice(0, 10);
      const cur = firstByEmail.get(email);
      if (!cur || iso < cur.iso) firstByEmail.set(email, { iso, filtro: String(row[iFiltro] || '').trim() });
    }

    const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
    const byDay = {};
    for (const { iso, filtro } of firstByEmail.values()) {
      const perfil = filtro.toUpperCase();
      if (!PERFIS.includes(perfil)) continue;
      const k = perfil.toLowerCase();
      counts[k]++;
      if (!byDay[iso]) byDay[iso] = { p1: 0, p2: 0, p3: 0, p4: 0 };
      byDay[iso][k]++;
    }
    const icps = counts.p1 + counts.p2 + counts.p3 + counts.p4;
    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, v]) => ({ data, ...v }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ icps, ...counts, desde: ed.pesquisaDesde, porDia });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
