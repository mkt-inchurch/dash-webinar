import { useState, useMemo, useEffect } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KPICard } from './KPICard';
import { DateFilter } from './DateFilter';
import { TrendCharts } from './TrendCharts';
import { FunilCharts } from './FunilCharts';
import { CampanhaBars } from './CampanhaBars';
import { CampanhasTable } from './CampanhasTable';
import { EditionsComparison } from './EditionsComparison';
import { MetricChart } from './MetricChart';
import { UtmTable } from './UtmTable';
import { LiveMetricsTable } from './LiveMetricsTable';
import { AuditoriaPanel, haQuantoTempo } from './AuditoriaPanel';
import { getLiveMetrics } from '../lib/liveMetrics';
import { fullRange, janelaAtividade, applyDateFilter, isFullRange, rangeTemDados, DateRange } from '../lib/dateFilter';
import { formatCurrency, formatNumber, formatPercent, formatCompact, cn } from '../lib/utils';
import { GOALS } from '../lib/goals';
import { META_INSCRITOS } from '../lib/constants';
import { benchmark, BenchMetric } from '../lib/benchmarks';
import { auditarEdicao, piorNivel, Checagem } from '../lib/auditoria';
import { EDITIONS, DEFAULT_EDITION, editionLabel, editionTemPesquisas } from '../lib/editions';
import {
  DollarSign, Users, Eye, Repeat, FileText, Target, TrendingDown,
  Percent, BarChart3, MousePointerClick, Link2, UserPlus, UserMinus, Search,
  Stethoscope, Megaphone, AlertCircle, RefreshCw, ChevronDown, Layers, LayoutGrid, GitCompare,
  ShieldCheck, ShieldAlert,
} from 'lucide-react';

// Título de seção no padrão "eyebrow" da marca (uppercase, letter-spacing 2.2px,
// verde-texto) — a classe .eyebrow vem do design system em src/index.css.
const sectionTitle = 'eyebrow mb-4';

// Edições do webinar "Trilha da Integração" (tag própria no header).
const TRILHA_EDITIONS = new Set(['webinar-20-07', 'webinar-03-08', 'webinar-17-08', 'webinar-31-08']);

// Cor do selo do botão "Verificar" depois de uma conferência, por nível da auditoria.
const CORES_SELO = {
  ok: 'border-in-green/40 bg-in-green/10 text-in-green-text',
  aviso: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  erro: 'border-red-500/40 bg-red-500/10 text-red-600',
} as const;

// Rótulos amigáveis das fontes de dados (para o aviso de indisponibilidade).
const SOURCE_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
  'meta-sem-campanhas': 'Meta Ads — nenhuma campanha casou com o filtro desta edição (revise `metaMatch` em api/_editions.js)',
  sendflow: 'Entradas no Grupo (Sendflow)',
  inscritos: 'Inscritos (planilha)',
  pesquisas: 'Pesquisas (planilha)',
  icps: 'ICPs (planilha)',
  diagnosticos: 'Diagnósticos (planilha)',
};

export function Dashboard() {
  const [edition, setEdition] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dw-edition');
      if (saved && EDITIONS.some((e) => e.id === saved)) return saved;
    } catch { /* ignore */ }
    return DEFAULT_EDITION;
  });
  const {
    data: rawData, series, loading, hasLoaded, error, unavailable, motivos,
    sendflowGeradoEm, atualizadoEm, verificando, verificadoEm, refetch,
  } = useDashboardData(edition);
  // Muda a cada verificação manual. As tabelas que buscam a própria fonte (UTMs) e a
  // tela de Comparar escutam esta chave para reler junto — antes o botão atualizava
  // só os cards e deixava o resto da tela com o retrato anterior.
  const [refreshKey, setRefreshKey] = useState(0);
  // Estado da tela Comparar, que tem o próprio ciclo de leitura. O botão do header é
  // um só e precisa falar do que está na frente de quem clicou.
  const [estadoCompare, setEstadoCompare] = useState<{
    verificando: boolean; verificadoEm: number | null; checagens: Checagem[];
  }>({ verificando: false, verificadoEm: null, checagens: [] });
  const [range, setRange] = useState<DateRange | null>(null);
  const [view, setView] = useState<'single' | 'compare'>('single');
  const verificar = () => {
    setRefreshKey((n) => n + 1);
    // Na tela Comparar quem relê é a própria tela (via refreshKey); disparar também
    // o hook da edição aberta gastaria 6 leituras sem cache que ninguém vai ver.
    if (view === 'single') refetch?.();
  };
  const [openChart, setOpenChart] = useState<string | null>(null); // card clicado → gráfico
  // Edições que qualificam o lead no próprio formulário (ex.: Calculadora de
  // Líderes) não têm etapa de pesquisa — o card sai da tela em vez de exibir zero.
  const temPesquisas = editionTemPesquisas(edition);

  // Header ganha fundo translúcido + blur ao rolar (mesmo comportamento da LP).
  const [rolado, setRolado] = useState(false);
  useEffect(() => {
    const onScroll = () => setRolado(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Relógio do chip "atualizado há X": sem ele o texto congela em "agora" e passa
  // exatamente a impressão errada — a de que o dado está fresco quando não está.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // O resultado do clique fica visível por 20 s. Depois disso o botão volta ao
  // normal: "conferido" é um carimbo do instante da conferência, não um estado
  // permanente da tela — mantê-lo aceso enquanto os polls seguem rodando seria
  // outra vez prometer frescor que ninguém verificou.
  const emCompare = view === 'compare';
  const vVerificando = emCompare ? estadoCompare.verificando : verificando;
  const vVerificadoEm = emCompare ? estadoCompare.verificadoEm : verificadoEm;

  const [conferidoAgora, setConferidoAgora] = useState(false);
  useEffect(() => {
    if (!vVerificadoEm) { setConferidoAgora(false); return; }
    setConferidoAgora(true);
    const id = setTimeout(() => setConferidoAgora(false), 20_000);
    return () => clearTimeout(id);
  }, [vVerificadoEm]);

  // Ao trocar de edição: persiste e reseta o filtro para o período total da nova edição.
  useEffect(() => {
    try { localStorage.setItem('dw-edition', edition); } catch { /* ignore */ }
    setRange(null);
  }, [edition]);

  const full = useMemo(() => fullRange(series), [series]);
  // Janela real de captação (dias com inscrição ou mídia). O filtro usa isso para
  // decidir quais presets fazem sentido — ver janelaAtividade() em lib/dateFilter.
  const atividade = useMemo(() => janelaAtividade(series), [series]);
  useEffect(() => {
    const has = series.inscritos.length || series.pesquisas.length || series.icps.length || series.meta.length || series.grupo.length;
    if (has) setRange((prev) => prev ?? full);
  }, [full, series]);

  const activeRange = range ?? full;
  const data = useMemo(() => applyDateFilter(rawData, series, activeRange), [rawData, series, activeRange]);

  // Auditoria da edição aberta. Roda sobre os TOTAIS do período completo (`rawData`
  // + séries inteiras), nunca sobre o recorte de data: comparar um card filtrado
  // com a série toda acusaria erro em toda seleção de período.
  const checagens = useMemo(
    () => (hasLoaded
      ? auditarEdicao(EDITIONS.find((e) => e.id === edition), rawData, series, unavailable, motivos, sendflowGeradoEm)
      : []),
    [hasLoaded, edition, rawData, series, unavailable, motivos, sendflowGeradoEm]
  );

  // Texto do botão logo depois da verificação: o que a auditoria encontrou nos dados
  // que ACABARAM de chegar. Sem isso, "atualizado" só diria que uma requisição saiu.
  const checagensAtivas = emCompare ? estadoCompare.checagens : checagens;
  const nivelChecagens = piorNivel(checagensAtivas);
  const selo =
    checagensAtivas.length === 0
      ? 'Atualizado'
      : nivelChecagens === 'ok'
        ? 'Conferido'
        : nivelChecagens === 'aviso'
          ? `${checagensAtivas.filter((c) => c.nivel === 'aviso').length} atenção`
          : `${checagensAtivas.filter((c) => c.nivel === 'erro').length} problema(s)`;

  // Intervalo escolhido sem nenhum ponto de nenhuma série: todos os cards vão a
  // zero e NENHUMA fonte falhou, então o aviso amarelo de indisponibilidade não
  // aparece. Sem a faixa abaixo, a tela zerada passa por resultado real.
  const semDadosNoPeriodo = useMemo(
    () => hasLoaded && !loading && series.inscritos.length > 0 && !rangeTemDados(series, activeRange),
    [hasLoaded, loading, series, activeRange]
  );
  const metaSerie = useMemo(
    () => series.meta.filter((d) => d.data >= activeRange.start && d.data <= activeRange.end),
    [series.meta, activeRange]
  );
  const inscritosSerie = useMemo(
    () => series.inscritos.filter((d) => d.data >= activeRange.start && d.data <= activeRange.end),
    [series.inscritos, activeRange]
  );

  // Rodapé "% da meta de referência".
  //
  // ATENÇÃO: as metas de src/lib/goals.ts são valores PROVISÓRIOS de mercado, não
  // metas acordadas com o time. Antes este rodapé pintava de verde ou vermelho
  // conforme "bateu" ou não — e um alcance abaixo de uma meta inventada aparecia em
  // vermelho, com cara de resultado ruim de verdade. Agora a proporção é exibida em
  // cinza, sem juízo de valor, e o rótulo diz explicitamente que a meta é de
  // referência. Quando as metas reais forem definidas em goals.ts, vale voltar a
  // colorir.
  const goalFooter = (key: string, value: number) => {
    const g = GOALS[key];
    if (!g || !g.goal) return undefined;
    return (
      <span
        className="flex items-center gap-1 text-sm font-medium text-fg-subtle"
        title={`Meta de REFERÊNCIA (valor provisório de mercado, definido em src/lib/goals.ts): ${g.goal}. Não é meta acordada.`}
      >
        <Percent className="w-3.5 h-3.5" />
        {formatPercent(value / g.goal)} <span className="font-normal">da meta ref.</span>
      </span>
    );
  };

  // Semáforo de benchmark de mercado (🔴🟡🟢) para as métricas de anúncio do doc
  // de referência. Cor + rótulo curto; oculta quando não há dado (valor 0).
  const benchFooter = (metric: BenchMetric, v?: number) => {
    if (!v) return undefined;
    const b = benchmark(metric, v);
    const color = b.status === 'green' ? 'text-in-green-text' : b.status === 'yellow' ? 'text-amber-600' : 'text-red-600';
    const dot = b.status === 'green' ? 'bg-in-green' : b.status === 'yellow' ? 'bg-amber-500' : 'bg-red-600';
    return (
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', color)} title="Benchmark de mercado (doc de referência)">
        <span className={cn('w-2 h-2 rounded-full', dot)} />
        {b.label}
      </span>
    );
  };

  // Rodapé dos cards de funil. ATENÇÃO: são duas bases diferentes — Inscritos é
  // % da META de referência; os demais são % SOBRE OS INSCRITOS.
  const pctMeta = data.inscritos / META_INSCRITOS;
  const pctAds = data.inscritos && data.inscritosAds != null ? data.inscritosAds / data.inscritos : 0;
  const pctGrupo = data.inscritos ? data.entradasGrupo / data.inscritos : 0;
  const pctPesquisas = data.inscritos ? data.pesquisas / data.inscritos : 0;
  const pctIcps = data.inscritos ? data.icps / data.inscritos : 0;
  const pctFooter = (v: number, base: string, title?: string) => (
    <span className="flex items-center gap-1 text-sm font-semibold text-in-green-text" title={title}>
      <Percent className="w-3.5 h-3.5" />
      {formatPercent(v)} <span className="font-normal text-fg-subtle">{base}</span>
    </span>
  );

  // Selo dos dois cards que NÃO acompanham o filtro de data. O reach da Meta é
  // deduplicado por pessoa: somar o de cada dia contaria de novo quem voltou, então
  // não existe alcance de um recorte de vários dias. Num recorte de UM dia existe, e
  // aí `applyDateFilter` usa o valor daquele dia e este selo some.
  const foraDoRecorte =
    data.alcanceNoPeriodo === false ? (
      <span
        className="text-[11px] font-medium text-amber-600 whitespace-nowrap"
        title="O alcance da Meta é deduplicado por pessoa e não pode ser somado dia a dia. Este número é o do período total da edição, não o do recorte selecionado."
      >
        período total
      </span>
    ) : undefined;

  // Props para tornar um card clicável (abre o gráfico de evolução por dia).
  const clickProps = (key: string) => ({
    onClick: () => setOpenChart((k) => (k === key ? null : key)),
    active: openChart === key,
  });

  // Dados do gráfico de evolução para o card selecionado (respeita o filtro de data).
  const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
  const inR = (d: { data: string }) => d.data >= activeRange.start && d.data <= activeRange.end;
  const chartFor = (key: string | null): { title: string; fmt: (v: number) => string; rows: { label: string; value: number }[] } | null => {
    if (!key) return null;
    const fromMeta = (pick: (d: typeof metaSerie[number]) => number) => metaSerie.map((d) => ({ label: ddmm(d.data), value: pick(d) }));
    switch (key) {
      case 'inscritosAds': return { title: 'Inscritos ADS', fmt: formatNumber, rows: series.inscritosAds.filter(inR).map((d) => ({ label: ddmm(d.data), value: d.novos })) };
      case 'entradasGrupo': return { title: 'Entradas no Grupo', fmt: formatNumber, rows: series.grupo.filter(inR).map((d) => ({ label: ddmm(d.data), value: d.novos })) };
      case 'pesquisas': return { title: 'Total de Pesquisas', fmt: formatNumber, rows: series.pesquisas.filter(inR).map((d) => ({ label: ddmm(d.data), value: d.novos })) };
      case 'icps': return { title: 'Total de ICPs', fmt: formatNumber, rows: series.icps.filter(inR).map((d) => ({ label: ddmm(d.data), value: d.p1 + d.p2 + d.p3 + d.p4 })) };
      case 'diagnosticos': return { title: 'Diagnósticos', fmt: formatNumber, rows: series.diagnosticos.filter(inR).map((d) => ({ label: ddmm(d.data), value: d.novos })) };
      case 'impressoes': return { title: 'Impressões', fmt: formatCompact, rows: fromMeta((d) => d.impressions) };
      case 'lpv': return { title: 'LPV', fmt: formatCompact, rows: fromMeta((d) => d.lpViews) };
      case 'cpc': return { title: 'CPC', fmt: formatCurrency, rows: fromMeta((d) => (d.linkClicks > 0 ? d.spend / d.linkClicks : 0)) };
      case 'cpm': return { title: 'CPM', fmt: formatCurrency, rows: fromMeta((d) => (d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0)) };
      case 'convPagina': return { title: 'Conv. Captura (pixel)', fmt: formatPercent, rows: fromMeta((d) => (d.lpViews > 0 ? d.leads / d.lpViews : 0)) };
      case 'connectRate': return { title: 'Connect Rate', fmt: formatPercent, rows: fromMeta((d) => (d.linkClicks > 0 ? d.lpViews / d.linkClicks : 0)) };
      default: return null;
    }
  };
  const openedChart = chartFor(openChart);

  if (!hasLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-bg-card-border border-t-in-green" />
          <p className="text-fg-muted text-sm animate-pulse">Sincronizando dados…</p>
        </div>
      </div>
    );
  }

  const tagEdicao = view === 'compare' ? 'Todas as edições' : editionLabel(edition);

  return (
    <div className="min-h-screen bg-bg-base w-full pb-16">
      {/* ---------------- HEADER ---------------- */}
      <header className={cn('sticky top-0 z-30 header-app', rolado && 'header-app--rolado')}>
        <div className="container-app h-[72px] flex items-center justify-between gap-4">
          {/* Esquerda: logo + tag + navegação */}
          <div className="flex items-center gap-3 min-w-0">
            <img src="/inchurch-logo.svg" alt="inChurch" width={120} height={29} className="h-[26px] w-auto shrink-0 select-none" draggable={false} />
            <span className="h-6 w-px bg-bg-card-border hidden sm:block" />
            <span
              className={cn(
                'hidden md:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap border',
                view !== 'compare' && TRILHA_EDITIONS.has(edition)
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                  : 'bg-in-green/15 border-in-green/30 text-in-green-text'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              {tagEdicao}
            </span>

            {/* Navegação: Painel × Comparar */}
            <div className="inline-flex items-center rounded-lg border border-bg-card-border bg-bg-base p-0.5 ml-1">
              <button
                onClick={() => setView('single')}
                title="Painel"
                className={cn('inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === 'single' ? 'bg-in-green text-[#1A1A1A]' : 'text-fg-muted hover:text-fg')}
              >
                <LayoutGrid className="w-4 h-4" /> <span className="hidden sm:inline">Painel</span>
              </button>
              <button
                onClick={() => setView('compare')}
                title="Comparar edições"
                className={cn('inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === 'compare' ? 'bg-in-green text-[#1A1A1A]' : 'text-fg-muted hover:text-fg')}
              >
                <GitCompare className="w-4 h-4" /> <span className="hidden sm:inline">Comparar</span>
              </button>
            </div>
          </div>

          {/* Direita: frescor · edição · sync */}
          <div className="flex items-center gap-2 sm:gap-3">
            {error && (
              <span className="hidden md:inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-500/25">
                <AlertCircle className="w-3.5 h-3.5" />
                Falha ao carregar
              </span>
            )}

            {/* Quando os números da tela foram lidos das fontes. O painel se
                atualiza sozinho (a cada 2 min e sempre que a aba volta ao foco);
                este chip é o que torna isso verificável em vez de suposição. */}
            {view === 'single' && atualizadoEm && (
              <span className="hidden lg:inline text-xs text-fg-subtle whitespace-nowrap" title="O painel relê as fontes a cada 2 minutos e sempre que esta aba volta ao primeiro plano.">
                {haQuantoTempo(atualizadoEm)}
              </span>
            )}

            {/* Seletor de edição do webinar (só no Painel) */}
            {view === 'single' && (
              <div className="relative">
                <Layers className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-4 h-4 text-fg-subtle absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  aria-label="Edição"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  className="appearance-none bg-bg-card border border-bg-card-border rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-fg hover:bg-bg-card-hover focus:outline-none focus:border-in-green cursor-pointer"
                >
                  {EDITIONS.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* VERIFICAR E ATUALIZAR.
                O painel já se atualiza sozinho (2 min no Painel, 10 min no Comparar,
                e sempre que a aba volta ao foco) — mas esses ciclos vivem do cache de
                borda de 5 min, de propósito, para não derrubar as planilhas. Este
                botão é o caminho oposto: força a leitura na fonte (`fresh`), refaz a
                auditoria sobre o que voltou e diz o que encontrou. Antes ele só
                repetia o pedido cacheado: o número não mudava e não havia como saber
                se era porque o dado é esse ou porque nada foi lido de novo. */}
            <button
              onClick={verificar}
              disabled={vVerificando}
              title="Ler as fontes de novo, ignorando o cache, e conferir os números"
              aria-label="Verificar e atualizar"
              className={cn(
                'h-9 inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors',
                vVerificando
                  ? 'border-in-green/40 bg-in-green/10 text-in-green-text cursor-wait'
                  : conferidoAgora
                    // A cor do resultado segue a auditoria, não o sucesso da
                    // requisição: verde só quando as checagens passaram. Um selo
                    // verde ao lado de "2 atenção" ensinaria a ignorar o aviso.
                    ? CORES_SELO[nivelChecagens]
                    : 'border-bg-card-border bg-bg-card text-fg-muted hover:bg-bg-card-hover hover:text-fg'
              )}
            >
              {conferidoAgora && !vVerificando ? (
                nivelChecagens === 'ok' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />
              ) : (
                <RefreshCw className={cn('w-4 h-4', vVerificando && 'animate-spin')} />
              )}
              <span className="hidden xl:inline whitespace-nowrap">
                {vVerificando ? 'Verificando…' : conferidoAgora ? selo : 'Verificar'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {view === 'compare' ? (
        <main className="container-app py-8">
          <EditionsComparison edicaoAtual={edition} refreshKey={refreshKey} onEstado={setEstadoCompare} />
        </main>
      ) : (
        <>
          {/* ---------------- BARRA DE CONTROLE ---------------- */}
          <div className="container-app pt-6 space-y-4">
            {/* Integridade dos dados — roda a cada carregamento, sem requisição extra */}
            <AuditoriaPanel checagens={checagens} atualizadoEm={atualizadoEm} />

            {/* Filtro temporal */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border border-bg-card-border bg-bg-card rounded-2xl px-4 py-4">
              <DateFilter range={activeRange} full={full} atividade={atividade} onChange={setRange} />
              <span className="text-xs text-fg-subtle lg:text-right lg:max-w-[260px]">
                {isFullRange(activeRange, full)
                  ? `Todo o período desta edição (${ddmm(full.start)} a ${ddmm(full.end)})`
                  : data.alcanceNoPeriodo === false
                    ? 'Período selecionado · Alcance e Frequência seguem do período total (o reach do Meta é deduplicado, não some por dia). Os demais cards acompanham o recorte.'
                    : 'Período selecionado · todos os cards abaixo acompanham o recorte.'}
              </span>
            </div>

            {/* Aviso: o recorte de data escolhido não contém dado nenhum. */}
            {semDadosNoPeriodo && (
              <div className="flex items-start gap-2 border border-amber-500/35 bg-amber-500/10 text-amber-800 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Nenhuma inscrição nem investimento neste período. </span>
                  Os cards abaixo estão zerados por causa do recorte de data, não porque a edição foi mal — a captação
                  dela vai de <span className="font-semibold">{ddmm(full.start)}</span> a{' '}
                  <span className="font-semibold">{ddmm(full.end)}</span>.
                  <button onClick={() => setRange(full)} className="ml-2 underline underline-offset-2 hover:no-underline">
                    Ver todo o período
                  </button>
                </div>
              </div>
            )}

            {/* Aviso: fonte(s) de dados indisponível(is) para esta edição. */}
            {unavailable.length > 0 && (
              <div className="flex items-start gap-2 border border-amber-500/35 bg-amber-500/10 text-amber-800 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">
                    Fonte de dados indisponível: {unavailable.map((u) => SOURCE_LABELS[u] ?? u).join(', ')}.
                  </span>
                  {unavailable.some((u) => motivos[u]) && (
                    <ul className="mt-1.5 space-y-1 text-xs opacity-90 list-disc list-inside">
                      {unavailable.filter((u) => motivos[u]).map((u) => (
                        <li key={u}>{motivos[u]}</li>
                      ))}
                    </ul>
                  )}
                  <span className="block text-xs opacity-80 mt-1.5">
                    Os cards dessas fontes ficam zerados até a leitura voltar — nunca exibem dados de outra edição.
                    <button onClick={verificar} className="ml-1.5 underline underline-offset-2 hover:no-underline">
                      Tentar de novo
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ---------------- BLOCO DE RESULTADOS (seção escura) ----------------
              O funil é o que o painel existe para mostrar. Fundo preto com o grão e
              o brilho verde da marca para separá-lo do resto da leitura. */}
          <section className="secao-escura mt-6">
            <div className="container-app py-10 md:py-12">
              <p className="eyebrow">Funil do webinar</p>
              <h2 className="mt-1 mb-6 text-[clamp(1.25rem,5.2vw,2rem)]">
                <strong>{formatNumber(data.inscritos)}</strong> inscritos ·{' '}
                <strong>{formatNumber(data.diagnosticos)}</strong> diagnósticos
                <span className="block text-sm font-normal tracking-normal text-fg-muted mt-1.5">
                  {tagEdicao} · {isFullRange(activeRange, full) ? 'período completo' : `${ddmm(activeRange.start)} a ${ddmm(activeRange.end)}`}
                </span>
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                  title="Total de Inscritos"
                  value={formatNumber(data.inscritos)}
                  icon={<Users className="w-5 h-5" />}
                  footer={pctFooter(pctMeta, 'da meta ref.', `Meta de referência: ${formatNumber(META_INSCRITOS)} inscritos (provisória, src/lib/constants.ts)`)}
                  delay={0.05}
                />
                <KPICard
                  title="Inscritos ADS"
                  value={formatNumber(data.inscritosAds ?? 0)}
                  icon={<Megaphone className="w-5 h-5" />}
                  footer={data.inscritosAds != null ? pctFooter(pctAds, 'dos inscritos') : undefined}
                  {...clickProps('inscritosAds')}
                  delay={0.08}
                />
                <KPICard
                  title="Entradas no Grupo"
                  value={formatNumber(data.entradasGrupo)}
                  // As saídas só aparecem quando saem do MESMO recorte das entradas.
                  // Quando a fonte não tem série por dia (Sendflow no modo 'group', ou
                  // snapshot antigo), `applyDateFilter` as remove no período filtrado:
                  // 8 entradas de hoje ao lado de 11 saídas do mês inteiro liam-se como
                  // um grupo que encolheu — foi o que apareceu na Trilha 31/08.
                  valueSuffix={
                    data.saidasGrupo != null ? (
                      <span className="flex items-center gap-0.5 text-sm font-semibold text-red-400" title={`Saídas do grupo no período selecionado${isFullRange(activeRange, full) ? '' : ` (${ddmm(activeRange.start)} a ${ddmm(activeRange.end)})`}.`}>
                        <UserMinus className="w-3.5 h-3.5" />
                        {formatNumber(data.saidasGrupo)}
                      </span>
                    ) : data.saidasNoPeriodo === false ? (
                      <span className="text-xs text-fg-subtle" title="A fonte não data as saídas do grupo, então não há como recortá-las por período. Escolha 'Todo período' para ver o total de saídas da edição.">
                        saídas: só no período todo
                      </span>
                    ) : undefined
                  }
                  icon={<UserPlus className="w-5 h-5" />}
                  footer={pctFooter(pctGrupo, 'dos inscritos')}
                  {...clickProps('entradasGrupo')}
                  delay={0.11}
                />
                {temPesquisas && (
                  <KPICard title="Total de Pesquisas" value={formatNumber(data.pesquisas)} icon={<Search className="w-5 h-5" />} footer={pctFooter(pctPesquisas, 'dos inscritos')} {...clickProps('pesquisas')} delay={0.14} />
                )}
                <KPICard title="Total de ICPs" value={formatNumber(data.icps)} icon={<Target className="w-5 h-5" />} footer={pctFooter(pctIcps, 'dos inscritos')} {...clickProps('icps')} delay={0.17} />
                <KPICard title="Diagnósticos" value={formatNumber(data.diagnosticos)} icon={<Stethoscope className="w-5 h-5" />} highlight {...clickProps('diagnosticos')} delay={0.2} />
                <KPICard
                  title="CPA real"
                  value={formatCurrency(data.cplReal)}
                  icon={<TrendingDown className="w-5 h-5" />}
                  // Só destaca como "bom" quando existe CPA E existe CPL do Meta para
                  // comparar: com os dois zerados (edição sem mídia) o card ficava verde.
                  highlight={data.cplReal > 0 && data.cplMeta > 0 && data.cplReal <= data.cplMeta}
                  subtitle="investimento / inscritos ADS"
                  delay={0.23}
                />
              </div>
            </div>
          </section>

          {/* ---------------- RESTO DO PAINEL ---------------- */}
          <main className="container-app py-8 space-y-8">
            {/* KPIs — Meta Ads */}
            <div>
              <h2 className={sectionTitle}>Meta Ads</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Gasto Total" value={formatCurrency(data.investimentoTrafego)} icon={<DollarSign className="w-5 h-5" />} delay={0.05} />
                <KPICard
                  title="Alcance"
                  value={formatCompact(data.alcance ?? 0)}
                  icon={<Users className="w-5 h-5" />}
                  // Quando a consulta deduplicada da Meta falha, o valor é a SOMA do
                  // reach por campanha — que conta 2x quem viu mais de uma campanha.
                  subtitle={data.alcanceDedup === false ? 'soma por campanha (aprox.)' : 'contas únicas (Meta)'}
                  valueSuffix={foraDoRecorte}
                  footer={goalFooter('alcance', data.alcance ?? 0)}
                  delay={0.08}
                />
                <KPICard title="Impressões" value={formatCompact(data.impressoes ?? 0)} icon={<Eye className="w-5 h-5" />} footer={goalFooter('impressoes', data.impressoes ?? 0)} {...clickProps('impressoes')} delay={0.11} />
                <KPICard title="Frequência" value={(data.frequencia ?? 0).toFixed(2)} icon={<Repeat className="w-5 h-5" />} subtitle="média" valueSuffix={foraDoRecorte} footer={benchFooter('frequencia', data.frequencia)} delay={0.14} />
                <KPICard title="LPV" value={formatCompact(data.lpv ?? 0)} icon={<FileText className="w-5 h-5" />} subtitle="landing page views" footer={goalFooter('lpv', data.lpv ?? 0)} {...clickProps('lpv')} delay={0.17} />

                {/* Conv. Captura REAL (inscritos ADS ÷ LPV) — é a que decide.
                    O número do pixel vai ao lado, menor, porque na conta da inChurch
                    o pixel é global e conta formulários de outros funis: ele reporta
                    de 1,1× a 3,8× os inscritos que de fato entraram na planilha. O
                    semáforo de benchmark segue o valor REAL. */}
                <KPICard
                  title="Conv. Captura"
                  value={formatPercent(data.convPaginaReal ?? 0)}
                  valueSuffix={
                    (data.convPagina ?? 0) > 0 ? (
                      <span className="text-xs text-fg-subtle" title="Mesma conta feita com os leads do pixel do Meta, que na conta da inChurch conta conversões de outros formulários do site.">
                        pixel: {formatPercent(data.convPagina ?? 0)}
                      </span>
                    ) : undefined
                  }
                  icon={<Percent className="w-5 h-5" />}
                  subtitle="inscritos ADS / LPV"
                  footer={benchFooter('convPagina', data.convPaginaReal)}
                  {...clickProps('convPagina')}
                  delay={0.2}
                />

                <KPICard title="CTR Link" value={formatPercent(data.ctrLink ?? 0)} icon={<BarChart3 className="w-5 h-5" />} footer={benchFooter('ctrLink', data.ctrLink)} delay={0.23} />
                <KPICard title="CPC" value={formatCurrency(data.cpc ?? 0)} icon={<MousePointerClick className="w-5 h-5" />} subtitle="por clique no link" footer={benchFooter('cpc', data.cpc)} {...clickProps('cpc')} delay={0.26} />
                <KPICard title="CPM" value={formatCurrency(data.cpm ?? 0)} icon={<Eye className="w-5 h-5" />} footer={benchFooter('cpm', data.cpm)} {...clickProps('cpm')} delay={0.29} />
                <KPICard title="Connect Rate" value={formatPercent(data.connectRate ?? 0)} icon={<Link2 className="w-5 h-5" />} subtitle="LPV / cliques no link" footer={benchFooter('connectRate', data.connectRate)} {...clickProps('connectRate')} delay={0.32} />
              </div>
            </div>

            {/* Gráfico do card clicado (evolução por dia) */}
            {openedChart && (
              <div>
                <h2 className={sectionTitle}>Gráfico do card</h2>
                <MetricChart title={openedChart.title} data={openedChart.rows} fmt={openedChart.fmt} onClose={() => setOpenChart(null)} />
              </div>
            )}

            {/* Tendência */}
            <div>
              <h2 className={sectionTitle}>Tendência — por dia</h2>
              <TrendCharts serie={metaSerie} />
            </div>

            {/* Funil (gráficos) */}
            <div>
              <h2 className={sectionTitle}>Funil &amp; ICPs</h2>
              <FunilCharts data={data} inscritosSerie={inscritosSerie} />
            </div>

            {/* Métricas da Live (YouTube) — só nas edições que têm dados extraídos. */}
            {getLiveMetrics(edition) && (
              <div>
                <h2 className={sectionTitle}>Métricas da Live (YouTube)</h2>
                <LiveMetricsTable edition={edition} />
              </div>
            )}

            {/* Por Campanha. ATENÇÃO: a Graph API devolve o recorte por campanha só do
                PERÍODO TOTAL da edição (não há série por dia por campanha), então estes
                dois blocos NÃO acompanham o filtro de data. */}
            {data.campanhas && data.campanhas.length > 0 && (
              <div>
                <h2 className={sectionTitle}>
                  Por Campanha — Top 8
                  {!isFullRange(activeRange, full) && (
                    <span className="ml-2 normal-case tracking-normal text-amber-600">· período total da edição, não acompanha o filtro</span>
                  )}
                </h2>
                <CampanhaBars campanhas={data.campanhas} />
              </div>
            )}

            {/* Tabela */}
            {data.campanhas && data.campanhas.length > 0 && (
              <CampanhasTable
                campanhas={data.campanhas}
                inscritosAds={rawData.inscritosAds}
                leadsMeta={rawData.leadsMeta}
                periodoFiltrado={!isFullRange(activeRange, full)}
              />
            )}

            {/* UTM × Prioridade */}
            <div>
              <h2 className={sectionTitle}>
                UTMs
                {!isFullRange(activeRange, full) && (
                  <span className="ml-2 normal-case tracking-normal text-amber-600">· período total da edição, não acompanha o filtro</span>
                )}
              </h2>
              <UtmTable edition={edition} totalPesquisas={rawData.pesquisas} refreshKey={refreshKey} />
            </div>
          </main>
        </>
      )}

      <p className="text-center text-xs text-fg-faint pt-2">
        Dados de webinar · Meta Marketing API · Google Sheets · Sendflow
      </p>
    </div>
  );
}
