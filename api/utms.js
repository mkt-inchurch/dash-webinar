// Vercel Serverless Function — tabela "UTM × Prioridade" a partir da planilha de
// pesquisa. Agrupa os leads (dedup por e-mail, dentro da janela da edição) por uma
// dimensão UTM (?dim=utm_source|utm_medium|utm_campaign) e conta por prioridade
// (P1–P4 = MQL) e Desqualificado (DESQ). "Cliente" fica fora do total.
// Processa no servidor: só contagens saem daqui, nada de PII.

import { getEdition, brToTs, toBoundTs } from './_editions.js';

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
const SHEET_TAB = 'Pesquisa - Webinar IA na Igreja';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
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

export default async function handler(req, res) {
  const ed = getEdition(req);
  const DESDE = toBoundTs(ed.pesquisaDesde, false);
  const ATE = toBoundTs(ed.pesquisaAte, true);
  const dimRaw = req.query && req.query.dim;
  const dim = DIMS.includes(dimRaw) ? dimRaw : 'utm_campaign';

  try {
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

    // Dedup por e-mail (primeiro registro na janela), guardando UTM + classificação.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const email = String(rows[i][iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const ts = iDate === -1 ? null : brToTs(rows[i][iDate]);
      if (!ts) continue;
      if (DESDE && ts < DESDE) continue;
      if (ATE && ts > ATE) continue;
      if (firstByEmail.has(email)) continue;
      firstByEmail.set(email, {
        dimVal: String(rows[i][iDim] || '').trim() || '(sem utm)',
        filtro: String(rows[i][iFiltro] || '').trim().toUpperCase(),
      });
    }

    // Agrupa por dimensão.
    const g = new Map();
    for (const { dimVal, filtro } of firstByEmail.values()) {
      if (!g.has(dimVal)) g.set(dimVal, { nome: dimVal, p1: 0, p2: 0, p3: 0, p4: 0, desq: 0 });
      const b = g.get(dimVal);
      if (filtro === 'P1') b.p1++;
      else if (filtro === 'P2') b.p2++;
      else if (filtro === 'P3') b.p3++;
      else if (filtro === 'P4') b.p4++;
      else if (filtro.includes('DESQ')) b.desq++;
      // "Cliente" e vazios ficam de fora do total.
    }

    let list = [...g.values()].map((b) => {
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
    const rowsOut = list.slice(0, TOP_N);

    // Melhor/pior qualidade entre os de volume relevante (>= MIN_VOL).
    let elegiveis = list.filter((b) => b.total >= MIN_VOL);
    if (elegiveis.length < 2) elegiveis = rowsOut; // fallback: usa o top
    let melhor = null, pior = null;
    for (const b of elegiveis) {
      if (!melhor || b.pMQL > melhor.pMQL) melhor = b;
      if (!pior || b.pMQL < pior.pMQL) pior = b;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      dim,
      rows: rowsOut,
      melhor: melhor && { nome: melhor.nome, pMQL: melhor.pMQL, total: melhor.total },
      pior: pior && { nome: pior.nome, pMQL: pior.pMQL, total: pior.total },
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
