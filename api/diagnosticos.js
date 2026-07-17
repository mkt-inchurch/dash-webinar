// Vercel Serverless Function — conta os "Diagnósticos" a partir da planilha de
// diagnósticos, deduplicando por e-mail (uma pessoa = 1). Processa no servidor
// para NÃO expor dados pessoais ao navegador — só contagens saem daqui.
//
// A janela (início/fim) vem da edição selecionada (?ed=...).
// Retorna também `porDia` para o filtro de período da tela somar dentro da janela.

import { getEdition, brToTs, toBoundTs } from './_editions.js';

const SHEET_ID = '1TCf4XiDVw-Rq0608W7712I5q-ZotwKzgZ7m56kmdpj0';
// 1ª aba via /export (não gviz): o gviz respeita filtros aplicados na planilha e
// pode devolver só as linhas visíveis (foi o que quebrou a pesquisa). O /export
// devolve a aba inteira, imune a filtros. Separação por edição = janela de data.
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

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

export default async function handler(req, res) {
  const ed = getEdition(req);
  const DESDE = toBoundTs(ed.diagDesde, false);
  const ATE = toBoundTs(ed.diagAte, true); // null = aberto
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
      const ts = iData === -1 ? null : brToTs(rows[i][iData]);
      if (!ts) continue; // planilha de diagnósticos sempre tem "Submitted At"
      if (DESDE && ts < DESDE) continue;
      if (ATE && ts > ATE) continue; // fora da janela da edição
      const day = ts.slice(0, 10);
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
      inicio: ed.diagDesde,
      fim: ed.diagAte,
      porDia,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
