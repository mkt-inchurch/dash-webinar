import { useState, useEffect, useCallback } from 'react';
import { DashboardData, DashboardSeries } from '../types';
import Papa from 'papaparse';

const EMPTY_SERIES: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], icps: [], meta: [] };

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
async function applyMetaMetrics(base: DashboardData, series: DashboardSeries): Promise<DashboardData> {
  try {
    const res = await fetch('/api/meta');
    if (!res.ok) return base;
    const meta = await res.json();
    if (meta && typeof meta.investimentoTrafego === 'number' && typeof meta.leadsMeta === 'number') {
      if (Array.isArray(meta.porDia)) series.meta = meta.porDia;
      return {
        ...base,
        investimentoTrafego: meta.investimentoTrafego,
        leadsMeta: meta.leadsMeta,
        cplMeta: meta.cplMeta,
      };
    }
    return base;
  } catch {
    return base;
  }
}

// "Entradas no Grupo" vem do Sendflow (grupo Webinar: IA na Igreja #3), ao vivo
// via /api/sendflow. Se a função não estiver disponível (ex.: `vite dev` sem
// serverless, ou falta de token), cai no snapshot estático public/sendflow.json,
// e por fim mantém o valor da planilha.
async function applySendflowMetrics(base: DashboardData, series: DashboardSeries): Promise<DashboardData> {
  for (const url of ['/api/sendflow', '/sendflow.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const sf = await res.json();
      if (sf && typeof sf.entradasGrupo === 'number') {
        if (Array.isArray(sf.porDia)) series.grupo = sf.porDia;
        return {
          ...base,
          entradasGrupo: sf.entradasGrupo,
          ...(typeof sf.saidas === 'number' ? { saidasGrupo: sf.saidas } : {}),
        };
      }
    } catch {
      // tenta o próximo fallback
    }
  }
  return base;
}

// "Total de Inscritos" vem da planilha Inscritos_29_06, deduplicado por e-mail
// no servidor (/api/inscritos, que não expõe dados pessoais). Fallback: mantém o
// valor que veio da planilha de métricas.
async function applyInscritosMetrics(base: DashboardData, series: DashboardSeries): Promise<DashboardData> {
  try {
    const res = await fetch('/api/inscritos', { cache: 'no-store' });
    if (!res.ok) return base;
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
    return base;
  } catch {
    return base;
  }
}

// "Total de Pesquisas" vem da planilha de pesquisa (aba "Pesquisa - Webinar IA na
// Igreja"), deduplicado por e-mail e só a partir de 19/06/2026 — processado no
// servidor (/api/pesquisas). Fallback: valor da planilha de métricas.
async function applyPesquisasMetrics(base: DashboardData, series: DashboardSeries): Promise<DashboardData> {
  try {
    const res = await fetch('/api/pesquisas', { cache: 'no-store' });
    if (!res.ok) return base;
    const info = await res.json();
    if (info && typeof info.pesquisas === 'number') {
      if (Array.isArray(info.porDia)) series.pesquisas = info.porDia;
      return { ...base, pesquisas: info.pesquisas };
    }
    return base;
  } catch {
    return base;
  }
}

// "Total de ICPs" (P1–P4) vem da planilha de pesquisa, classificado e deduplicado
// por e-mail no servidor (/api/icps). Sobrescreve o total e guarda o detalhamento
// P1–P4 para o gráfico do card. Fallback: valor da planilha de métricas.
async function applyIcpsMetrics(base: DashboardData, series: DashboardSeries): Promise<DashboardData> {
  try {
    const res = await fetch('/api/icps', { cache: 'no-store' });
    if (!res.ok) return base;
    const info = await res.json();
    if (info && typeof info.icps === 'number') {
      if (Array.isArray(info.porDia)) series.icps = info.porDia;
      return {
        ...base,
        icps: info.icps,
        icp: { p1: info.p1, p2: info.p2, p3: info.p3, p4: info.p4 },
      };
    }
    return base;
  } catch {
    return base;
  }
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(MOCK_DATA);
  const [series, setSeries] = useState<DashboardSeries>(EMPTY_SERIES);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const res = await fetch(PUBLIC_CSV_URL);
      if (!res.ok) {
        throw new Error("Erro ao buscar a planilha pública.");
      }

      const csvText = await res.text();
      
      Papa.parse(csvText, {
        complete: async (results) => {
          if (results.data && Array.isArray(results.data)) {
             const values = extractDashboardValues(results.data as any[][]);
             const s: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], icps: [], meta: [] };
             const withMeta = await applyMetaMetrics(values, s);
             const withSendflow = await applySendflowMetrics(withMeta, s);
             const withInscritos = await applyInscritosMetrics(withSendflow, s);
             const withPesquisas = await applyPesquisasMetrics(withInscritos, s);
             const withIcps = await applyIcpsMetrics(withPesquisas, s);
             setData(withIcps);
             setSeries(s);
             setError(null);
             setHasLoaded(true);
          }
        },
        error: (error: any) => {
           console.error("CSV Parse error:", error);
           setError("Erro ao interpretar os dados da planilha");
        }
      });

    } catch (err: any) {
      console.error("Failed to fetch sheet data", err);
      setError("Erro ao processar dados da planilha. Exibindo dados simulados.");
      setData(MOCK_DATA);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, series, loading, hasLoaded, error, needsAuth: false, handleLogin: () => {}, handleLogout: () => {}, user: null };
}

