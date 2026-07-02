// Vercel Serverless Function — conta "Total de Pesquisas" a partir da planilha
// (aba "Pesquisa - Webinar IA na Igreja"), deduplicando por e-mail e considerando
// apenas registros a partir de 19/06/2026 (há dados anteriores que devem ser
// ignorados). Processa no servidor: só contagens saem daqui, nada de PII.

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
const SHEET_TAB = 'Pesquisa - Webinar IA na Igreja';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
const EMAIL_COL = 'Qual é seu e-mail?';
const DATE_COL = 'Submitted At';
const CUTOFF = '2026-06-19'; // inclusive
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

// "DD/MM/AAAA HH:MM:SS" ou "DD/MM/AAAA" -> "AAAA-MM-DD". null se não casar.
function toISO(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export default async function handler(_req, res) {
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

    // Dedup por e-mail, considerando só registros a partir do CUTOFF, guardando a
    // data da primeira pesquisa (>= CUTOFF) de cada pessoa.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const iso = toISO(row[iDate]);
      if (!iso || iso < CUTOFF) continue; // fora da janela
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
    return res.status(200).json({ pesquisas: total, desde: CUTOFF, porDia });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
