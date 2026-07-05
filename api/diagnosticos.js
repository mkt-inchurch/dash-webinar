// Vercel Serverless Function — conta os "Diagnósticos" a partir da planilha de
// diagnósticos, deduplicando por e-mail (uma pessoa = 1). Processa no servidor
// para NÃO expor dados pessoais ao navegador — só contagens saem daqui.
//
// A janela (início/fim) vem da edição selecionada (?ed=...).
// Retorna também `porDia` para o filtro de período da tela somar dentro da janela.

import { getEdition } from './_editions.js';

const SHEET_ID = '1TCf4XiDVw-Rq0608W7712I5q-ZotwKzgZ7m56kmdpj0';
// Aba: por padrão a primeira (sem parâmetro sheet). Se os dados estiverem em
// outra aba, defina o nome aqui.
const SHEET_TAB = '';
const CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv` +
  (SHEET_TAB ? `&sheet=${encodeURIComponent(SHEET_TAB)}` : '');

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

// Normaliza cabeçalho para casar por nome (sem acento/caixa/espaços).
const norm = (s) =>
  String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Acha a 1ª coluna cujo cabeçalho casa com algum dos padrões.
function findCol(header, patterns) {
  for (let i = 0; i < header.length; i++) {
    const h = norm(header[i]);
    if (h && patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

// Data em vários formatos -> ISO "AAAA-MM-DD". Aceita "DD/MM/AAAA" (com hora
// opcional, ex.: carimbo do Google Forms) e "AAAA-MM-DD...". Retorna null se não casar.
function toISO(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

export default async function handler(req, res) {
  const ed = getEdition(req);
  const EDITION_START = ed.diagDesde;
  const EDITION_END = ed.diagAte; // null = aberto
  try {
    const r = await fetch(CSV_URL, { headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok) {
      return res.status(502).json({ error: `Planilha respondeu ${r.status}. Verifique se está compartilhada como "Qualquer pessoa com o link · Leitor".` });
    }
    const rows = parseCSV(await r.text());
    if (rows.length < 2) return res.status(502).json({ error: 'Planilha vazia' });

    const header = rows[0];
    const iEmail = findCol(header, [/e-?mail/]);
    const iData = findCol(header, [/^data/, /date/, /submit/, /enviad/, /carimbo/, /timestamp/, /hora/, /\bdia\b/]);
    if (iEmail === -1) {
      return res.status(500).json({ error: `Coluna de e-mail não encontrada. Cabeçalhos: ${header.join(' | ')}` });
    }

    // Dedup por e-mail dentro da janela da edição, guardando a data da PRIMEIRA
    // ocorrência de cada pessoa (para o "novos por dia").
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const email = String(rows[i][iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const iso = iData === -1 ? null : toISO(rows[i][iData]);
      // Sem coluna de data: conta na data de início da edição.
      const day = iso || EDITION_START;
      if (day < EDITION_START || (EDITION_END && day > EDITION_END)) continue; // fora da edição
      const cur = firstByEmail.get(email);
      if (cur === undefined || day < cur) firstByEmail.set(email, day);
    }

    const total = firstByEmail.size;

    const byDay = {};
    for (const day of firstByEmail.values()) byDay[day] = (byDay[day] || 0) + 1;
    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, novos]) => ({ data, novos }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      diagnosticos: total,
      inicio: EDITION_START,
      fim: EDITION_END,
      porDia,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
