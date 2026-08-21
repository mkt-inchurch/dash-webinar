// Vercel Serverless Function — conta os ICPs (P1–P4) a partir da planilha de
// pesquisa, usando a classificação da própria equipe (coluna "Filtro de Leads"),
// deduplicando por e-mail e só a partir de 19/06/2026. Só contagens saem daqui.
//
// A coluna "Filtro de Leads" contém P1/P2/P3/P4/Cliente/Desqualificado.
// ICP = P1 + P2 + P3 + P4 (leads qualificados). Dedup: mantém o PRIMEIRO registro
// (>= 19/06) de cada e-mail.

import { getEdition, brToTs, criaFiltroPesquisa } from './_editions.js';
import { lerInscritos, dedupInscritos, icpCol } from './_planilha-inscritos.js';
import { lerCSV } from './_http.js';

const SHEET_ID = '188IL034a2dzqLF9KgGvyufjmD6MH4dc463tYi9NWS_Q';
// Aba única "Pesquisa Geral" via /export (imune a filtros; o gviz respeita filtros
// e devolvia só as linhas visíveis). Separação por edição = data + utm_campaign.
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const COL_EMAIL = 'Qual é seu e-mail?';
const COL_DATE = 'Submitted At';
const COL_FILTRO = 'Filtro de Leads';
const PERFIS = ['P1', 'P2', 'P3', 'P4'];

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

// Edições sem planilha de pesquisa (ex.: Calculadora de Líderes) já trazem a
// classificação do lead na própria planilha de inscritos, numa coluna equivalente
// ao "Filtro de Leads" (`icpCol`). Mesma saída da versão por pesquisa: total, P1–P4
// e a série por dia para o filtro de período.
async function icpsDaPlanilhaDeInscritos(ed, res) {
  const { header, linhas } = await lerInscritos(ed);
  const registros = dedupInscritos(ed, header, linhas, { filtro: icpCol(ed) });

  const counts = { p1: 0, p2: 0, p3: 0, p4: 0 };
  const byDay = {};
  for (const { iso, filtro } of registros.values()) {
    const perfil = String(filtro || '').trim().toUpperCase();
    if (!PERFIS.includes(perfil)) continue; // Cliente/Desqualificado/em branco
    const k = perfil.toLowerCase();
    counts[k]++;
    if (!byDay[iso]) byDay[iso] = { p1: 0, p2: 0, p3: 0, p4: 0 };
    byDay[iso][k]++;
  }
  const porDia = Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([data, v]) => ({ data, ...v }));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    icps: counts.p1 + counts.p2 + counts.p3 + counts.p4,
    ...counts,
    desde: ed.inscritosDesde,
    porDia,
  });
}

export default async function handler(req, res) {
  const ed = getEdition(req);
  const aceita = criaFiltroPesquisa(ed); // mesmo filtro de /pesquisas e /utms
  try {
    if (ed.icpFonte === 'inscritos') return await icpsDaPlanilhaDeInscritos(ed, res);

    const rows = parseCSV(await lerCSV(CSV_URL, 'pesquisa'));
    if (!rows.length) return res.status(502).json({ error: 'Planilha vazia' });

    const header = rows[0];
    const iEmail = header.indexOf(COL_EMAIL);
    const iDate = header.indexOf(COL_DATE);
    const iFiltro = header.indexOf(COL_FILTRO);
    if (iEmail === -1 || iDate === -1 || iFiltro === -1) {
      return res.status(500).json({ error: 'Colunas e-mail/data/Filtro de Leads não encontradas' });
    }
    const iUtm = header.indexOf('utm_campaign');

    // Dedup por e-mail: mantém o PRIMEIRO registro (>= CUTOFF) de cada pessoa e usa
    // a classificação "Filtro de Leads" dele.
    const firstByEmail = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[iEmail] || '').trim().toLowerCase();
      if (!email) continue;
      const ts = brToTs(row[iDate]);
      if (!ts) continue;
      if (!aceita(iUtm === -1 ? '' : row[iUtm], ts)) continue;
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
    return res.status(err.status ? 502 : 500).json({ error: String(err.message || err) });
  }
}
