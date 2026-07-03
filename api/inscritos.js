// Vercel Serverless Function — conta o "Total de Inscritos" a partir da planilha
// (aba Inscritos_29_06), deduplicando por e-mail. Processa no servidor para NÃO
// expor dados pessoais (nome/telefone/e-mail) ao navegador — só contagens saem daqui.

const SHEET_ID = '1QkFMFOCMMAzj3BgEoiCtTD_YHSu48p51xmu9Y3TaulM';
const SHEET_TAB = 'Inscritos_29_06';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
const CUTOFF = '2026-06-19'; // considera apenas inscritos de 19/06 em diante
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Parser CSV mínimo (trata aspas e vírgulas dentro de campos).
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

// "DD/MM/AAAA" -> "AAAA-MM-DD" (ISO, ordenável). Retorna null se não casar.
function toISO(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export default async function handler(_req, res) {
  try {
    const r = await fetch(CSV_URL, { headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok) {
      return res.status(502).json({ error: `Planilha respondeu ${r.status}` });
    }
    const rows = parseCSV(await r.text());
    if (!rows.length) return res.status(502).json({ error: 'Planilha vazia' });

    const header = rows[0];
    const iEmail = header.indexOf('Email');
    const iData = header.indexOf('Data');
    const iSrc = header.indexOf('UTM Source');
    if (iEmail === -1) return res.status(500).json({ error: 'Coluna Email não encontrada' });

    // Dedup por e-mail (só inscritos a partir do CUTOFF), guardando a data de
    // PRIMEIRA inscrição (>= CUTOFF) de cada pessoa e a UTM Source dela.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const iso = iData === -1 ? null : toISO(row[iData]);
      if (!iso || iso < CUTOFF) continue; // fora da janela (antes de 19/06 ou sem data)
      const cur = firstByEmail.get(email);
      if (cur === undefined || iso < cur.iso) {
        firstByEmail.set(email, { iso, source: iSrc === -1 ? '' : String(row[iSrc] || '') });
      }
    }

    const total = firstByEmail.size;

    // Inscritos ADS = UTM Source contém "WEBINAR_IA" (veio de campanha do Meta).
    // Exclui CONTEUDO, EMAIL, em branco e outros automaticamente.
    const isAds = (src) => src.toUpperCase().includes('WEBINAR_IA');

    // Novos únicos por dia (soma = total) + acumulado, para o filtro de tempo.
    const byDay = {};
    const byDayAds = {};
    let totalAds = 0;
    for (const { iso, source } of firstByEmail.values()) {
      byDay[iso] = (byDay[iso] || 0) + 1;
      if (isAds(source)) {
        byDayAds[iso] = (byDayAds[iso] || 0) + 1;
        totalAds++;
      }
    }
    const toPorDia = (m) =>
      Object.entries(m)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([data, novos]) => ({ data, novos }));
    const porDia = toPorDia(byDay);
    let acc = 0;
    for (const d of porDia) { acc += d.novos; d.acumulado = acc; }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      inscritos: total,
      inscritosAds: totalAds,
      desde: CUTOFF,
      porDia,
      porDiaAds: toPorDia(byDayAds),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
