import { useState, useEffect, useCallback } from 'react';
import { DashboardData, DashboardSeries } from '../types';
import { EDITIONS } from '../lib/editions';
import { fullRange, applyDateFilter } from '../lib/dateFilter';
import Papa from 'papaparse';

const EMPTY_SERIES: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], diagnosticos: [], icps: [], meta: [] };

// Realistic mock data
const MOCK_DATA: DashboardData = {
  inscritos: 1250,
  entradasGrupo: 850,
  pesquisas: 425,
  icps: 180,
  diagnosticos: 45,

  taxaInscritosGrupo: 0.68, // 68%
  taxaGrupoPesquisa: 0.50, // 50%
  taxaPesquisaIcp: 0.42, // 42%

  investimentoTrafego: 15400,
  leadsMeta: 2000,
  cplMeta: 8.50,
  cplReal: 12.32,
};

const normalize = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return NaN;
  let str = String(val).replace(/R\$/gi, '').replace(/%/g, '').trim();
  const normalizedMatch = str.match(/-?[\d.,]+/);
  if (!normalizedMatch) return NaN;
  
  let numStr = normalizedMatch[0];
  if (numStr.includes(',') && numStr.includes('.')) {
      if (numStr.lastIndexOf(',') < numStr.lastIndexOf('.')) {
          numStr = numStr.replace(/,/g, '');
      } else {
          numStr = numStr.replace(/\./g, '').replace(',', '.');
      }
  } else if (numStr.includes(',')) {
      numStr = numStr.replace(',', '.');
  }
  return parseFloat(numStr);
}

function extractValue(grid: any[][], searchTerms: string[], isPercentage = false, exactMatch = false): number | null {
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < grid[r].length; c++) {
      const cell = String(grid[r][c] || "");
      const normalizedCell = normalize(cell);
      
      const isMatch = searchTerms.some(term => {
        const normTerm = normalize(term);
        return normalizedCell === normTerm || (!exactMatch && normalizedCell.includes(normTerm) && normalizedCell.length <= normTerm.length + 20);
      });

      if (isMatch) {
         if (c + 1 < grid[r].length && grid[r][c+1]) {
            const val = parseNumber(grid[r][c+1]);
            if (!isNaN(val)) return isPercentage && String(grid[r][c+1]).includes('%') ? val / 100 : val;
         }
         if (r + 1 < grid.length && grid[r+1] && grid[r+1][c]) {
            const val = parseNumber(grid[r+1][c]);
            if (!isNaN(val)) return isPercentage && String(grid[r+1][c]).includes('%') ? val / 100 : val;
         }
      }
    }
  }
  return null;
}

function extractDashboardValues(grid: any[][]): DashboardData {
  const inscritos = extractValue(grid, ['inscritos (planilha)', 'total de inscritos', 'inscritos']) ?? MOCK_DATA.inscritos;
  const entradasGrupo = extractValue(grid, ['entrada (grupo)', 'total de entradas no grupo', 'entradas no grupo', 'entrada no grupo', 'grupo']) ?? MOCK_DATA.entradasGrupo;
  const pesquisas = extractValue(grid, ['pesquisa (planilha)', 'total de pesquisas', 'pesquisas', 'pesquisa']) ?? MOCK_DATA.pesquisas;
  const icps = extractValue(grid, ['icps', 'total de icps']) ?? MOCK_DATA.icps;
  const diagnosticos = extractValue(grid, ['diagnostico (planilha)', 'total de diagnosticos', 'diagnosticos', 'diagnostico']) ?? MOCK_DATA.diagnosticos;

  const taxaInscritosGrupo = extractValue(grid, ['inscrito % grupo', 'inscritos % grupo', 'conversao grupo'], true) ?? (entradasGrupo / (inscritos || 1));
  const taxaGrupoPesquisa = extractValue(grid, ['grupo % pesquisa', 'inscrito % pesquisa', 'conversao pesquisa'], true) ?? (pesquisas / (entradasGrupo || 1));
  const taxaPesquisaIcp = extractValue(grid, ['pesquisa % icps', 'conversao icp'], true) ?? (icps / (pesquisas || 1));

  const investimentoTrafego = extractValue(grid, ['valor de instimento', 'valor de investimento', 'investimento total em trafego', 'investimento', 'trafego']) ?? MOCK_DATA.investimentoTrafego;
  const leadsMeta = extractValue(grid, ['leads (meta)', 'total de leads (meta)', 'leads meta']) ?? MOCK_DATA.leadsMeta;
  const cplMeta = extractValue(grid, ['cpl (meta)', 'custo por lead (meta)', 'cpl meta']) ?? MOCK_DATA.cplMeta;
  const cplReal = extractValue(grid, ['cpl', 'custo por lead'], false, true) ?? MOCK_DATA.cplReal;

  return {
    inscritos, entradasGrupo, pesquisas, icps, diagnosticos,
    taxaInscritosGrupo, taxaGrupoPesquisa, taxaPesquisaIcp,
    investimentoTrafego, leadsMeta, cplMeta, cplReal
  };
}

const PUBLIC_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ79hHc73Ww0MB6Nb7-OAxCfuqH4I_KS3oAtHsNR-bhDhNRLGAcI5wyYalG7m_1TWeW44hMb6hTUC1o/pub?gid=1000295038&single=true&output=csv";

// Métricas de captação vêm direto do Meta Ads (via /api/meta). Se a função não
// estiver disponível (ex.: `vite dev` sem serverless) ou faltar token, mantém os
// valores da planilha como fallback.
// Métricas "possuídas" por cada fonte. Se a API da edição falhar, esses campos são
// ZERADOS (não herdam o valor da planilha-base compartilhada, que é de OUTRO
// webinar) e a fonte é registrada em `unavailable` para o aviso na tela.
const ZERO_META: Partial<DashboardData> = {
  investimentoTrafego: 0, leadsMeta: 0, cplMeta: 0, cplReal: 0, alcance: 0,
  frequencia: 0, impressoes: 0, lpv: 0, cpm: 0, cpc: 0, ctrLink: 0,
  connectRate: 0, convPagina: 0, campanhas: [],
};
const ZERO_SENDFLOW: Partial<DashboardData> = { entradasGrupo: 0, saidasGrupo: 0 };
const ZERO_INSCRITOS: Partial<DashboardData> = { inscritos: 0, inscritosAds: 0, cplReal: 0 };
const ZERO_PESQUISAS: Partial<DashboardData> = { pesquisas: 0 };
const ZERO_DIAG: Partial<DashboardData> = { diagnosticos: 0 };
const ZERO_ICPS: Partial<DashboardData> = { icps: 0, icp: { p1: 0, p2: 0, p3: 0, p4: 0 } };

async function applyMetaMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  const fail = () => { unavailable.push('meta'); return { ...base, ...ZERO_META }; };
  try {
    const res = await fetch(`/api/meta?ed=${ed}`);
    if (!res.ok) return fail();
    const meta = await res.json();
    if (meta && typeof meta.investimentoTrafego === 'number' && typeof meta.leadsMeta === 'number') {
      if (Array.isArray(meta.porDia)) series.meta = meta.porDia;
      return {
        ...base,
        investimentoTrafego: meta.investimentoTrafego,
        leadsMeta: meta.leadsMeta,
        cplMeta: meta.cplMeta,
        ...(typeof meta.alcance === 'number' ? { alcance: meta.alcance } : {}),
        ...(typeof meta.frequencia === 'number' ? { frequencia: meta.frequencia } : {}),
        ...(Array.isArray(meta.campanhas) ? { campanhas: meta.campanhas } : {}),
      };
    }
    return fail();
  } catch {
    return fail();
  }
}

// "Entradas no Grupo" vem do Sendflow (grupo Webinar: IA na Igreja #3), ao vivo
// via /api/sendflow. Se a função não estiver disponível (ex.: `vite dev` sem
// serverless, ou falta de token), cai no snapshot estático public/sendflow.json,
// e por fim mantém o valor da planilha.
async function applySendflowMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  // Só a API por edição é confiável por edição; o /sendflow.json é um snapshot
  // estático (de uma edição só), então NÃO serve de fallback entre edições.
  try {
    const res = await fetch(`/api/sendflow?ed=${ed}`, { cache: 'no-store' });
    if (res.ok) {
      const sf = await res.json();
      if (sf && typeof sf.entradasGrupo === 'number') {
        if (Array.isArray(sf.porDia)) series.grupo = sf.porDia;
        return {
          ...base,
          entradasGrupo: sf.entradasGrupo,
          ...(typeof sf.saidas === 'number' ? { saidasGrupo: sf.saidas } : {}),
        };
      }
    }
  } catch {
    // cai no tratamento de indisponível abaixo
  }
  unavailable.push('sendflow');
  return { ...base, ...ZERO_SENDFLOW };
}

// "Total de Inscritos" vem da planilha Inscritos_29_06, deduplicado por e-mail
// no servidor (/api/inscritos, que não expõe dados pessoais). Fallback: mantém o
// valor que veio da planilha de métricas.
async function applyInscritosMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  const fail = () => { unavailable.push('inscritos'); return { ...base, ...ZERO_INSCRITOS }; };
  try {
    const res = await fetch(`/api/inscritos?ed=${ed}`, { cache: 'no-store' });
    if (!res.ok) return fail();
    const info = await res.json();
    if (info && typeof info.inscritos === 'number') {
      if (Array.isArray(info.porDia)) series.inscritos = info.porDia;
      if (Array.isArray(info.porDiaAds)) series.inscritosAds = info.porDiaAds;
      return {
        ...base,
        inscritos: info.inscritos,
        ...(typeof info.inscritosAds === 'number' ? { inscritosAds: info.inscritosAds } : {}),
      };
    }
    return fail();
  } catch {
    return fail();
  }
}

// "Total de Pesquisas" vem da planilha de pesquisa (aba "Pesquisa - Webinar IA na
// Igreja"), deduplicado por e-mail e só a partir de 19/06/2026 — processado no
// servidor (/api/pesquisas). Fallback: valor da planilha de métricas.
async function applyPesquisasMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  const fail = () => { unavailable.push('pesquisas'); return { ...base, ...ZERO_PESQUISAS }; };
  try {
    const res = await fetch(`/api/pesquisas?ed=${ed}`, { cache: 'no-store' });
    if (!res.ok) return fail();
    const info = await res.json();
    if (info && typeof info.pesquisas === 'number') {
      if (Array.isArray(info.porDia)) series.pesquisas = info.porDia;
      return { ...base, pesquisas: info.pesquisas };
    }
    return fail();
  } catch {
    return fail();
  }
}

// "Diagnósticos" vem da planilha de diagnósticos, deduplicado por e-mail no
// servidor (/api/diagnosticos), dentro da janela da edição (04–12/07). Guarda a
// série por dia para o filtro de período. Fallback: valor da planilha de métricas.
async function applyDiagnosticosMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  const fail = () => { unavailable.push('diagnosticos'); return { ...base, ...ZERO_DIAG }; };
  try {
    const res = await fetch(`/api/diagnosticos?ed=${ed}`, { cache: 'no-store' });
    if (!res.ok) return fail();
    const info = await res.json();
    if (info && typeof info.diagnosticos === 'number') {
      if (Array.isArray(info.porDia)) series.diagnosticos = info.porDia;
      return { ...base, diagnosticos: info.diagnosticos };
    }
    return fail();
  } catch {
    return fail();
  }
}

// "Total de ICPs" (P1–P4) vem da planilha de pesquisa, classificado e deduplicado
// por e-mail no servidor (/api/icps). Sobrescreve o total e guarda o detalhamento
// P1–P4 para o gráfico do card. Fallback: valor da planilha de métricas.
async function applyIcpsMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  const fail = () => { unavailable.push('icps'); return { ...base, ...ZERO_ICPS }; };
  try {
    const res = await fetch(`/api/icps?ed=${ed}`, { cache: 'no-store' });
    if (!res.ok) return fail();
    const info = await res.json();
    if (info && typeof info.icps === 'number') {
      if (Array.isArray(info.porDia)) series.icps = info.porDia;
      return {
        ...base,
        icps: info.icps,
        icp: { p1: info.p1, p2: info.p2, p3: info.p3, p4: info.p4 },
      };
    }
    return fail();
  } catch {
    return fail();
  }
}

// Busca a planilha-base e roda o pipeline de UMA edição. Retorna os TOTAIS do
// período (sem filtro de data) + a série diária. Reutilizado pelo dashboard e pela
// tela de comparação.
export async function loadEditionData(edition: string): Promise<{ data: DashboardData; series: DashboardSeries; unavailable: string[] }> {
  const res = await fetch(PUBLIC_CSV_URL);
  if (!res.ok) throw new Error('Erro ao buscar a planilha pública.');
  const csvText = await res.text();
  const parsed = Papa.parse(csvText);
  const values = extractDashboardValues((parsed.data as any[][]) || []);
  const s: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], diagnosticos: [], icps: [], meta: [] };
  // Fontes cuja API por edição falhou — ficam ZERADAS (sem herdar a planilha-base
  // de outro webinar) e viram aviso na tela.
  const unavailable: string[] = [];
  let d = await applyMetaMetrics(values, s, edition, unavailable);
  d = await applySendflowMetrics(d, s, edition, unavailable);
  d = await applyInscritosMetrics(d, s, edition, unavailable);
  d = await applyPesquisasMetrics(d, s, edition, unavailable);
  d = await applyDiagnosticosMetrics(d, s, edition, unavailable);
  d = await applyIcpsMetrics(d, s, edition, unavailable);
  // Deriva os totais do PERÍODO COMPLETO (impressões, LPV, CTR, CPC, CPM, Conv.
  // Captura, Connect Rate, CPL Real) com a MESMA função do painel, para que a tela
  // de Comparar mostre esses campos (que não vêm prontos da API do Meta) e fique
  // consistente com o painel single. Com o range completo, os totais de série
  // (inscritos, pesquisas etc.) são idênticos aos já calculados.
  const data = s.meta.length || s.inscritos.length ? applyDateFilter(d, s, fullRange(s)) : d;
  return { data, series: s, unavailable };
}

export function useDashboardData(edition: string) {
  const [data, setData] = useState<DashboardData>(MOCK_DATA);
  const [series, setSeries] = useState<DashboardSeries>(EMPTY_SERIES);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, series, unavailable } = await loadEditionData(edition);
      setData(data);
      setSeries(series);
      setUnavailable(unavailable);
      setError(null);
      setHasLoaded(true);
    } catch (err: any) {
      console.error("Failed to fetch sheet data", err);
      setError("Erro ao processar dados da planilha. Exibindo dados simulados.");
      setData(MOCK_DATA);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [edition]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, series, loading, hasLoaded, error, unavailable, refetch: fetchData, needsAuth: false, handleLogin: () => {}, handleLogout: () => {}, user: null };
}

// Carrega os totais de TODAS as edições em paralelo (para a tela de comparação).
export function useEditionsComparison() {
  const [rows, setRows] = useState<{ id: string; label: string; data: DashboardData }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Promise.all(
        EDITIONS.map(async (e) => ({ id: e.id, label: e.label, data: (await loadEditionData(e.id)).data }))
      );
      setRows(res);
      setError(null);
    } catch (err: any) {
      console.error('Falha ao comparar edições', err);
      setError('Erro ao carregar as edições.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, refetch: load };
}

