import { useState, useEffect, useCallback } from 'react';
import { DashboardData, DashboardSeries } from '../types';
import { EDITIONS } from '../lib/editions';
import { fullRange, applyDateFilter } from '../lib/dateFilter';

const EMPTY_SERIES: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], diagnosticos: [], icps: [], meta: [] };

// Base zerada do painel. TODOS os cards sao preenchidos pelas funcoes /api/* por
// edicao; nada aqui vira numero na tela.
//
// ATE 21/08/2026 esta base vinha de uma planilha publica legada (um resumo manual da
// edicao de 29/06) que era baixada a CADA carregamento do painel -- e 11 vezes na tela
// de Comparar. Nenhum valor dela era exibido (todos eram sobrescritos pelas APIs), ela
// estava com #REF! em ICPs, "Pesquisa (Planilha) 0" e "CPL R$0,28", e um erro ao
// busca-la derrubava o painel inteiro para MOCK_DATA ("Modo Demo") -- numeros
// inventados, com cara de dado real. Foi removida.
const BASE_ZERO: DashboardData = {
  inscritos: 0,
  entradasGrupo: 0,
  pesquisas: 0,
  icps: 0,
  diagnosticos: 0,
  taxaInscritosGrupo: 0,
  taxaGrupoPesquisa: 0,
  taxaPesquisaIcp: 0,
  investimentoTrafego: 0,
  leadsMeta: 0,
  cplMeta: 0,
  cplReal: 0,
};


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
      // A API respondeu, mas nenhuma campanha casou com o filtro da edição: os cards
      // do Meta ficam zerados por CONFIG, não por indisponibilidade. Sem este aviso o
      // painel mostrava "R$ 0,00" como se fosse o resultado real (era o caso do 24/08,
      // que estava com R$ 6.570 de mídia rodando fora do filtro).
      if (meta.semCampanhas) unavailable.push('meta-sem-campanhas');
      return {
        ...base,
        investimentoTrafego: meta.investimentoTrafego,
        leadsMeta: meta.leadsMeta,
        cplMeta: meta.cplMeta,
        ...(typeof meta.alcance === 'number' ? { alcance: meta.alcance } : {}),
        ...(typeof meta.frequencia === 'number' ? { frequencia: meta.frequencia } : {}),
        ...(Array.isArray(meta.campanhas) ? { campanhas: meta.campanhas } : {}),
        alcanceDedup: !!meta.alcanceDedup,
        semCampanhas: !!meta.semCampanhas,
      };
    }
    return fail();
  } catch {
    return fail();
  }
}

// "Entradas no Grupo" vem do Sendflow via /api/sendflow, que NÃO consulta a SendAPI
// ao vivo: serve o snapshot publicado de hora em hora pelo workflow "Sendflow
// snapshot" (a SendAPI bloqueia a conta por 24h quando recebe requisições demais).
// Se a função não estiver disponível (ex.: `vite dev`, sem serverless) ou a edição
// ainda não estiver no snapshot, o card zera e entra no aviso de fonte indisponível.
async function applySendflowMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[]): Promise<DashboardData> {
  try {
    // Sem `no-store`: deixa o cache de borda/navegador servir.
    const res = await fetch(`/api/sendflow?ed=${ed}`);
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
  const values = { ...BASE_ZERO };
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
  const [data, setData] = useState<DashboardData>(BASE_ZERO);
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
      console.error('Falha ao carregar a edição', err);
      // Sem fallback para dados simulados: e melhor a tela zerada + aviso do que
      // numeros plausiveis que nao existem.
      setError('Não foi possível carregar os dados desta edição.');
      setData(BASE_ZERO);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [edition]);

  useEffect(() => {
    fetchData();
    // Auto-refresh a cada 30 min (era 5 min). Os dados mudam devagar e o polling
    // curto socava a API da Sendflow, que bloqueia a chave por 24h. Só refaz quando
    // a aba está visível — abas de fundo abertas o dia todo não geram requisição.
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) fetchData();
    }, 30 * 60 * 1000);
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

