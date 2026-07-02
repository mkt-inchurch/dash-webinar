// Vercel Serverless Function — conta os ICPs (P1–P4) a partir da planilha de
// pesquisa, deduplicando por e-mail e só a partir de 19/06/2026. Processa no
// servidor: só contagens saem daqui, nada de dados pessoais.
//
// ICP = lead P1, P2, P3 ou P4. Todos exigem NÃO ser cliente inChurch.
//   P1 = Pastor (Principal/Auxiliar)          + 251 membros ou mais
//   P2 = Pastor (Principal/Auxiliar)          + entre 51 e 250 membros
//   P3 = Funcionário / Líder de ministério    + 251 membros ou mais
//   P4 = Funcionário / Líder de ministério    + entre 51 e 250 membros

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
const SHEET_TAB = 'Pesquisa - Webinar IA na Igreja';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
const COL_EMAIL = 'Qual é seu e-mail?';
const COL_DATE = 'Submitted At';
const COL_CLIENTE = 'Sua igreja é cliente inChurch?';
const COL_CARGO = 'Qual cargo você ocupa na igreja?';
const COL_MEMBROS = 'Quantas pessoas sendo cuidadas?';
const CUTOFF = '2026-06-19';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Faixas de membros -> "251 ou mais" (BIG) e "51 a 250" (MID). "1-50" fica fora.
const MEMB_BIG = new Set(['250-500', '501-1000', '1001-2500', '2501-5000', '+5000']);
const MEMB_MID = new Set(['51-100', '101-250']);

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

function toISO(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Sem acento, minúsculo — robusto a variações de acentuação da planilha.
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function classify(cliente, cargo, membros) {
  if (norm(cliente) !== 'nao') return null; // precisa NÃO ser cliente
  const cn = norm(cargo);
  const isPastor = cn === 'pastor principal' || cn === 'pastor auxiliar';
  const isStaff = cn === 'funcionario' || cn.startsWith('lider'); // Funcionário + qualquer "Líder ..."
  if (!isPastor && !isStaff) return null; // Membro e afins ficam de fora

  const m = String(membros || '').trim();
  const big = MEMB_BIG.has(m);
  const mid = MEMB_MID.has(m);
  if (!big && !mid) return null; // "1-50" ou vazio: fora

  if (isPastor) return big ? 'p1' : 'p2';
  return big ? 'p3' : 'p4';
}

export default async function handler(_req, res) {
  try {
    const r = await fetch(CSV_URL, { headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok) return res.status(502).json({ error: `Planilha respondeu ${r.status}` });
    const rows = parseCSV(await r.text());
    if (!rows.length) return res.status(502).json({ error: 'Planilha vazia' });

    const header = rows[0];
    const idx = {
      email: header.indexOf(COL_EMAIL), date: header.indexOf(COL_DATE),
      cli: header.indexOf(COL_CLIENTE), cargo: header.indexOf(COL_CARGO), memb: header.indexOf(COL_MEMBROS),
    };
    if (Object.values(idx).some((i) => i === -1)) {
      return res.status(500).json({ error: 'Colunas esperadas não encontradas' });
    }

    // Dedup por e-mail: mantém o PRIMEIRO registro (>= CUTOFF) de cada pessoa.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[idx.email] || '').trim().toLowerCase();
      if (!email) continue;
      const iso = toISO(row[idx.date]);
      if (!iso || iso < CUTOFF) continue;
      const cur = firstByEmail.get(email);
      if (!cur || iso < cur.iso) firstByEmail.set(email, { iso, row });
    }

    const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
    for (const { row } of firstByEmail.values()) {
      const p = classify(row[idx.cli], row[idx.cargo], row[idx.memb]);
      if (p) counts[p]++;
    }
    const icps = counts.p1 + counts.p2 + counts.p3 + counts.p4;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ icps, ...counts, desde: CUTOFF });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
