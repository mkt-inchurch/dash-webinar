import { useState, useEffect, useCallback } from 'react';
import { DashboardData, DashboardSeries } from '../types';
import { EDITIONS } from '../lib/editions';
import { fullRange, applyDateFilter } from '../lib/dateFilter';
import { Cobertura } from '../lib/auditoria';

const EMPTY_SERIES: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], saidasGrupo: [], diagnosticos: [], icps: [], meta: [] };

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

// Motivo da indisponibilidade por fonte, para a tela dizer O QUE fazer em vez de
// só "Fonte de dados indisponível".
export type MotivosFonte = Record<string, string>;

// GET com retry. Uma falha momentânea de rede zerava o card na hora e acendia o
// aviso; com 6 fontes por edição (e 11 edições na tela Comparar) isso acontecia
// com frequência mesmo estando tudo bem do outro lado.
//
// `permanente: true` na resposta (token do Meta vencido, planilha sem permissão)
// significa que repetir não adianta — desiste na primeira.
async function getJson(url: string, fresh = false, tentativas = 3): Promise<any> {
  let motivo = 'Não foi possível ler esta fonte.';
  // `fresh` = alguém CLICOU em "Verificar e atualizar". Aí o cache é justamente o
  // que atrapalha: o painel repetia os mesmos números e o clique não provava nada.
  // O `_v` muda a URL, então a borda da Vercel trata como outra entrada e a função
  // vai até a fonte de verdade.
  const alvo = fresh ? `${url}${url.includes('?') ? '&' : '?'}_v=${Date.now()}` : url;
  for (let i = 0; i < tentativas; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400 * Math.pow(3, i - 1))); // 400ms, 1,2s
    try {
      // No carregamento AUTOMÁTICO, sem `cache: 'no-store'`: ele anulava o cache de
      // borda que as próprias funções configuram (s-maxage=300), fazendo TODA visita
      // ir até o Google Sheets — 44 downloads de planilha por abertura da tela
      // Comparar, que é o caminho mais curto para tomar 429 e ver a tela "quebrar".
      // O poll de 2 min continua barato por causa disso; só o clique manual paga.
      const res = await fetch(alvo, fresh ? { cache: 'no-store' } : undefined);
      const j = await res.json().catch(() => null);
      if (res.ok && j && !j.error) return j;
      if (j?.error) motivo = String(j.error);
      else motivo = `A fonte respondeu ${res.status}.`;
      if (j?.permanente) break; // não passa sozinho: não insiste
    } catch {
      motivo = 'Falha de rede ao ler esta fonte.';
    }
  }
  const err: any = new Error(motivo);
  err.motivo = motivo;
  throw err;
}

async function applyMetaMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[], motivos: MotivosFonte, fresh: boolean): Promise<DashboardData> {
  const fail = (motivo?: string) => {
    unavailable.push('meta');
    if (motivo) motivos.meta = motivo;
    return { ...base, ...ZERO_META };
  };
  try {
    const meta = await getJson(`/api/meta?ed=${ed}`, fresh);
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
  } catch (e: any) {
    return fail(e?.motivo);
  }
}

// "Entradas no Grupo" vem do Sendflow via /api/sendflow, que NÃO consulta a SendAPI
// ao vivo: serve o snapshot publicado de hora em hora pelo workflow "Sendflow
// snapshot" (a SendAPI bloqueia a conta por 24h quando recebe requisições demais).
// Se a função não estiver disponível (ex.: `vite dev`, sem serverless) ou a edição
// ainda não estiver no snapshot, o card zera e entra no aviso de fonte indisponível.
async function applySendflowMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[], motivos: MotivosFonte, meta: { sendflowGeradoEm?: string }, fresh: boolean): Promise<DashboardData> {
  try {
    const sf = await getJson(`/api/sendflow?ed=${ed}`, fresh);
    if (sf && typeof sf.entradasGrupo === 'number') {
      if (Array.isArray(sf.porDia)) series.grupo = sf.porDia;
      // Saídas por dia: só existem no modo 'campaign' e só a partir do snapshot
      // publicado depois de 26/08/2026. Enquanto não vierem, a tela esconde as
      // saídas em qualquer recorte que não seja o período inteiro.
      if (Array.isArray(sf.saidasPorDia)) series.saidasGrupo = sf.saidasPorDia;
      // Quando o snapshot do Sendflow foi coletado. A auditoria usa isso para
      // avisar que o card congelou quando o job de hora em hora para de rodar.
      if (typeof sf.geradoEm === 'string') meta.sendflowGeradoEm = sf.geradoEm;
      return {
        ...base,
        entradasGrupo: sf.entradasGrupo,
        ...(typeof sf.saidas === 'number' ? { saidasGrupo: sf.saidas } : {}),
      };
    }
  } catch (e: any) {
    if (e?.motivo) motivos.sendflow = e.motivo;
  }
  unavailable.push('sendflow');
  return { ...base, ...ZERO_SENDFLOW };
}

// "Total de Inscritos" vem da planilha Inscritos_29_06, deduplicado por e-mail
// no servidor (/api/inscritos, que não expõe dados pessoais). Fallback: mantém o
// valor que veio da planilha de métricas.
async function applyInscritosMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[], motivos: MotivosFonte, fresh: boolean): Promise<DashboardData> {
  const fail = (motivo?: string) => {
    unavailable.push('inscritos');
    if (motivo) motivos.inscritos = motivo;
    return { ...base, ...ZERO_INSCRITOS };
  };
  try {
    const info = await getJson(`/api/inscritos?ed=${ed}`, fresh);
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
  } catch (e: any) {
    return fail(e?.motivo);
  }
}

// "Total de Pesquisas" vem da planilha de pesquisa (aba "Pesquisa - Webinar IA na
// Igreja"), deduplicado por e-mail e só a partir de 19/06/2026 — processado no
// servidor (/api/pesquisas). Fallback: valor da planilha de métricas.
async function applyPesquisasMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[], motivos: MotivosFonte, fresh: boolean): Promise<DashboardData> {
  const fail = (motivo?: string) => {
    unavailable.push('pesquisas');
    if (motivo) motivos.pesquisas = motivo;
    return { ...base, ...ZERO_PESQUISAS };
  };
  try {
    const info = await getJson(`/api/pesquisas?ed=${ed}`, fresh);
    if (info && typeof info.pesquisas === 'number') {
      if (Array.isArray(info.porDia)) series.pesquisas = info.porDia;
      return { ...base, pesquisas: info.pesquisas };
    }
    return fail();
  } catch (e: any) {
    return fail(e?.motivo);
  }
}

// "Diagnósticos" vem da planilha de diagnósticos, deduplicado por e-mail no
// servidor (/api/diagnosticos), dentro da janela da edição (04–12/07). Guarda a
// série por dia para o filtro de período. Fallback: valor da planilha de métricas.
async function applyDiagnosticosMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[], motivos: MotivosFonte, fresh: boolean): Promise<DashboardData> {
  const fail = (motivo?: string) => {
    unavailable.push('diagnosticos');
    if (motivo) motivos.diagnosticos = motivo;
    return { ...base, ...ZERO_DIAG };
  };
  try {
    const info = await getJson(`/api/diagnosticos?ed=${ed}`, fresh);
    if (info && typeof info.diagnosticos === 'number') {
      if (Array.isArray(info.porDia)) series.diagnosticos = info.porDia;
      return { ...base, diagnosticos: info.diagnosticos };
    }
    return fail();
  } catch (e: any) {
    return fail(e?.motivo);
  }
}

// "Total de ICPs" (P1–P4) vem da planilha de pesquisa, classificado e deduplicado
// por e-mail no servidor (/api/icps). Sobrescreve o total e guarda o detalhamento
// P1–P4 para o gráfico do card. Fallback: valor da planilha de métricas.
async function applyIcpsMetrics(base: DashboardData, series: DashboardSeries, ed: string, unavailable: string[], motivos: MotivosFonte, fresh: boolean): Promise<DashboardData> {
  const fail = (motivo?: string) => {
    unavailable.push('icps');
    if (motivo) motivos.icps = motivo;
    return { ...base, ...ZERO_ICPS };
  };
  try {
    const info = await getJson(`/api/icps?ed=${ed}`, fresh);
    if (info && typeof info.icps === 'number') {
      if (Array.isArray(info.porDia)) series.icps = info.porDia;
      return {
        ...base,
        icps: info.icps,
        icp: { p1: info.p1, p2: info.p2, p3: info.p3, p4: info.p4 },
      };
    }
    return fail();
  } catch (e: any) {
    return fail(e?.motivo);
  }
}

// Busca a planilha-base e roda o pipeline de UMA edição. Retorna os TOTAIS do
// período (sem filtro de data) + a série diária. Reutilizado pelo dashboard e pela
// tela de comparação.
export interface EdicaoCarregada {
  data: DashboardData;
  series: DashboardSeries;
  unavailable: string[];
  motivos: MotivosFonte;
  sendflowGeradoEm?: string;
}

export async function loadEditionData(edition: string, fresh = false): Promise<EdicaoCarregada> {
  const values = { ...BASE_ZERO };
  const s: DashboardSeries = { inscritos: [], inscritosAds: [], pesquisas: [], grupo: [], saidasGrupo: [], diagnosticos: [], icps: [], meta: [] };
  // Fontes cuja API por edição falhou — ficam ZERADAS (sem herdar a planilha-base
  // de outro webinar) e viram aviso na tela.
  const unavailable: string[] = [];
  const motivos: MotivosFonte = {};
  const extra: { sendflowGeradoEm?: string } = {};
  // Em paralelo: são 6 fontes independentes, e em série a tela Comparar somava as
  // seis latências vezes onze edições.
  const partes = await Promise.all([
    applyMetaMetrics(values, s, edition, unavailable, motivos, fresh),
    applySendflowMetrics(values, s, edition, unavailable, motivos, extra, fresh),
    applyInscritosMetrics(values, s, edition, unavailable, motivos, fresh),
    applyPesquisasMetrics(values, s, edition, unavailable, motivos, fresh),
    applyDiagnosticosMetrics(values, s, edition, unavailable, motivos, fresh),
    applyIcpsMetrics(values, s, edition, unavailable, motivos, fresh),
  ]);
  // Cada apply* devolve a base INTEIRA com os seus campos por cima, então não dá
  // para espalhar um sobre o outro: o último sobrescreveria os campos do Meta com
  // os zeros da base. Junta-se só o que cada um de fato mudou.
  let d: DashboardData = { ...values };
  for (const parte of partes) {
    for (const [k, v] of Object.entries(parte)) {
      if (v !== (values as any)[k]) (d as any)[k] = v;
    }
  }
  // Deriva os totais do PERÍODO COMPLETO (impressões, LPV, CTR, CPC, CPM, Conv.
  // Captura, Connect Rate, CPL Real) com a MESMA função do painel, para que a tela
  // de Comparar mostre esses campos (que não vêm prontos da API do Meta) e fique
  // consistente com o painel single. Com o range completo, os totais de série
  // (inscritos, pesquisas etc.) são idênticos aos já calculados.
  const data = s.meta.length || s.inscritos.length ? applyDateFilter(d, s, fullRange(s)) : d;
  return { data, series: s, unavailable, motivos, ...extra };
}

// Cadência da atualização automática.
//
// ATÉ AQUI: o painel buscava tudo de novo a cada 30 min e não dizia quando tinha
// buscado. Na prática, quem deixava a aba aberta lia números de meia hora atrás
// achando que eram de agora, e a única forma de saber se estavam certos era
// conferir na mão — que é o que este arquivo (junto com src/lib/auditoria.ts)
// existe para acabar.
//
// AGORA: 2 min na edição aberta e 10 min na tela de Comparar, mais um refetch
// imediato toda vez que a aba volta para o primeiro plano. Isso NÃO multiplica a
// carga nas fontes: as funções /api/* respondem com `s-maxage=300`, então o cache
// de borda da Vercel absorve os polls e a planilha/Graph API continua sendo lida
// no máximo uma vez a cada 5 min por região — o mesmo volume de antes. O Sendflow
// nem isso: /api/sendflow serve o snapshot horário do GitHub Actions.
const INTERVALO_PAINEL = 2 * 60 * 1000;
const INTERVALO_COMPARAR = 10 * 60 * 1000;

// Dispara `fn` no intervalo pedido, só com a aba visível, e também no instante em
// que ela volta a ficar visível (é quando alguém realmente vai olhar o número).
function useAutoRefresh(fn: () => void, intervalo: number) {
  useEffect(() => {
    const visivel = () => typeof document === 'undefined' || !document.hidden;
    const id = setInterval(() => { if (visivel()) fn(); }, intervalo);
    const aoVoltar = () => { if (visivel()) fn(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [fn, intervalo]);
}

export function useDashboardData(edition: string) {
  const [data, setData] = useState<DashboardData>(BASE_ZERO);
  const [series, setSeries] = useState<DashboardSeries>(EMPTY_SERIES);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<MotivosFonte>({});
  const [sendflowGeradoEm, setSendflowGeradoEm] = useState<string | undefined>();
  // Quando esta tela terminou de ler as fontes com sucesso. Vai para o chip
  // "atualizado há X" no topo — sem ele não dá para distinguir um painel fresco
  // de um que parou de atualizar há horas.
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null);
  // Uma verificação manual está em curso? É diferente de `loading`: o poll de 2 min
  // também acende `loading`, e o botão precisa reagir só ao clique de quem pediu.
  const [verificando, setVerificando] = useState(false);
  // Quando a última LEITURA FORÇADA (clique no botão) terminou. É o que autoriza a
  // tela a dizer "conferido agora" — dizer isso depois de um poll que veio do cache
  // seria a mesma promessa vazia que o botão dava antes.
  const [verificadoEm, setVerificadoEm] = useState<number | null>(null);

  const fetchData = useCallback(async (fresh = false) => {
    try {
      setLoading(true);
      if (fresh) setVerificando(true);
      const r = await loadEditionData(edition, fresh);
      setData(r.data);
      setSeries(r.series);
      setUnavailable(r.unavailable);
      setMotivos(r.motivos);
      setSendflowGeradoEm(r.sendflowGeradoEm);
      setError(null);
      setHasLoaded(true);
      setAtualizadoEm(Date.now());
      if (fresh) setVerificadoEm(Date.now());
    } catch (err: any) {
      console.error('Falha ao carregar a edição', err);
      // Sem fallback para dados simulados: e melhor a tela zerada + aviso do que
      // numeros plausiveis que nao existem.
      setError('Não foi possível carregar os dados desta edição.');
      setData(BASE_ZERO);
      setHasLoaded(true);
    } finally {
      setLoading(false);
      setVerificando(false);
    }
  }, [edition]);

  // O poll automático NUNCA pede `fresh` — ele vive do cache de borda de 5 min, que
  // é o que mantém o painel barato. Furar o cache é decisão de quem clica.
  const auto = useCallback(() => { fetchData(false); }, [fetchData]);
  const verificar = useCallback(() => fetchData(true), [fetchData]);

  useEffect(() => { fetchData(false); }, [fetchData]);
  useAutoRefresh(auto, INTERVALO_PAINEL);

  // Troca de edição zera o carimbo de "conferido": ele vale para a edição que estava
  // aberta quando o botão foi clicado, não para a próxima.
  useEffect(() => { setVerificadoEm(null); }, [edition]);

  return {
    data, series, loading, hasLoaded, error, unavailable, motivos, sendflowGeradoEm,
    atualizadoEm, verificando, verificadoEm, refetch: verificar,
  };
}

// Carrega os totais de TODAS as edições em paralelo (para a tela de comparação).
// Guarda também as SÉRIES diárias: a auditoria cruzada precisa delas para detectar
// dia de mídia contado em duas edições e diagnóstico caindo em duas janelas — que
// é o tipo de erro que a conferência de uma edição isolada nunca pega.
export interface LinhaComparacao {
  id: string;
  label: string;
  data: DashboardData;
  series: DashboardSeries;
  unavailable: string[];
}

export function useEditionsComparison() {
  const [rows, setRows] = useState<LinhaComparacao[]>([]);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [verificadoEm, setVerificadoEm] = useState<number | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    if (fresh) setVerificando(true);
    try {
      const [res, cob] = await Promise.all([
        Promise.all(
          EDITIONS.map(async (e) => {
            const r = await loadEditionData(e.id, fresh);
            return { id: e.id, label: e.label, data: r.data, series: r.series, unavailable: r.unavailable };
          })
        ),
        // Cobertura de mídia: gasto TOTAL da conta em campanhas de webinar, sem
        // recorte de edição. Se falhar, a comparação continua — só a checagem de
        // "mídia fora do painel" fica de fora.
        getJson('/api/cobertura', fresh).catch(() => null),
      ]);
      setRows(res);
      setCobertura(cob && typeof cob.total === 'number' ? cob : null);
      setError(null);
      setAtualizadoEm(Date.now());
      if (fresh) setVerificadoEm(Date.now());
    } catch (err: any) {
      console.error('Falha ao comparar edições', err);
      setError('Erro ao carregar as edições.');
    } finally {
      setLoading(false);
      setVerificando(false);
    }
  }, []);

  const auto = useCallback(() => { load(false); }, [load]);
  const verificar = useCallback(() => load(true), [load]);

  useEffect(() => { load(false); }, [load]);
  useAutoRefresh(auto, INTERVALO_COMPARAR);

  return { rows, cobertura, loading, error, atualizadoEm, verificando, verificadoEm, refetch: verificar };
}
