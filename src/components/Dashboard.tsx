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
import { fullRange, applyDateFilter, isFullRange, DateRange } from '../lib/dateFilter';
import { formatCurrency, formatNumber, formatPercent, formatCompact, cn } from '../lib/utils';
import { useTheme } from '../lib/theme';
import { GOALS } from '../lib/goals';
import { META_INSCRITOS } from '../lib/constants';
import { benchmark, BenchMetric } from '../lib/benchmarks';
import { EDITIONS, DEFAULT_EDITION, editionLabel } from '../lib/editions';
import {
  DollarSign, Users, Eye, Repeat, FileText, Target, TrendingDown, TrendingUp,
  Percent, BarChart3, MousePointerClick, Link2, UserPlus, UserMinus, Search,
  Stethoscope, Megaphone, AlertCircle, RefreshCw, Sun, Moon, ChevronDown, Layers, LayoutGrid, GitCompare,
} from 'lucide-react';

const sectionTitle = 'text-sm font-mono text-fg-subtle mb-4 px-2 uppercase tracking-widest';

// Rótulos amigáveis das fontes de dados (para o aviso de indisponibilidade).
const SOURCE_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
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
  const { data: rawData, series, loading, hasLoaded, error, unavailable, refetch } = useDashboardData(edition);
  const { theme, toggle } = useTheme();
  const logoSrc = theme === 'light' ? '/logo-light.webp' : '/logo-dark.webp';
  const [range, setRange] = useState<DateRange | null>(null);
  const [view, setView] = useState<'single' | 'compare'>('single');
  const [openChart, setOpenChart] = useState<string | null>(null); // card clicado → gráfico

  // Ao trocar de edição: persiste e reseta o filtro para o período total da nova edição.
  useEffect(() => {
    try { localStorage.setItem('dw-edition', edition); } catch { /* ignore */ }
    setRange(null);
  }, [edition]);

  const full = useMemo(() => fullRange(series), [series]);
  useEffect(() => {
    const has = series.inscritos.length || series.pesquisas.length || series.icps.length || series.meta.length || series.grupo.length;
    if (has) setRange((prev) => prev ?? full);
  }, [full, series]);

  const activeRange = range ?? full;
  const data = useMemo(() => applyDateFilter(rawData, series, activeRange), [rawData, series, activeRange]);
  const metaSerie = useMemo(
    () => series.meta.filter((d) => d.data >= activeRange.start && d.data <= activeRange.end),
    [series.meta, activeRange]
  );
  const inscritosSerie = useMemo(
    () => series.inscritos.filter((d) => d.data >= activeRange.start && d.data <= activeRange.end),
    [series.inscritos, activeRange]
  );

  // Rodapé "% da meta" (metas de exemplo em lib/goals.ts). Verde se bateu a meta,
  // vermelho se não. Cost metrics (higherBetter=false): melhor quando <= meta.
  const goalFooter = (key: string, value: number) => {
    const g = GOALS[key];
    if (!g || !g.goal) return undefined;
    const pctv = value / g.goal;
    const ok = g.higherBetter ? value >= g.goal : value <= g.goal;
    const Icon = ok ? TrendingUp : TrendingDown;
    return (
      <span className={cn('flex items-center gap-1 text-sm font-semibold', ok ? 'text-in-green' : 'text-red-500')} title="Meta de referência (exemplo)">
        <Icon className="w-4 h-4" />
        {formatPercent(pctv)} <span className="font-normal text-fg-subtle">da meta</span>
      </span>
    );
  };

  // Semáforo de benchmark de mercado (🔴🟡🟢) para as métricas de anúncio do doc
  // de referência. Cor + rótulo curto; oculta quando não há dado (valor 0).
  const benchFooter = (metric: BenchMetric, v?: number) => {
    if (!v) return undefined;
    const b = benchmark(metric, v);
    const color = b.status === 'green' ? 'text-in-green' : b.status === 'yellow' ? 'text-yellow-500' : 'text-red-500';
    const dot = b.status === 'green' ? 'bg-in-green' : b.status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', color)} title="Benchmark de mercado (doc de referência)">
        <span className={cn('w-2 h-2 rounded-full', dot)} />
        {b.label}
      </span>
    );
  };

  // Rodapé "% anterior" dos cards de funil: Inscritos = % da meta (2.000);
  // ADS/Grupo/Pesquisas/ICPs = % sobre o total de inscritos. Ícone verde + só a %.
  const pctMeta = data.inscritos / META_INSCRITOS;
  const pctAds = data.inscritos && data.inscritosAds != null ? data.inscritosAds / data.inscritos : 0;
  const pctGrupo = data.inscritos ? data.entradasGrupo / data.inscritos : 0;
  const pctPesquisas = data.inscritos ? data.pesquisas / data.inscritos : 0;
  const pctIcps = data.inscritos ? data.icps / data.inscritos : 0;
  const pctFooter = (v: number) => (
    <span className="flex items-center gap-1 text-sm font-semibold text-in-green">
      <TrendingUp className="w-4 h-4" />
      {formatPercent(v)}
    </span>
  );

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
      case 'convPagina': return { title: 'Conv. Captura', fmt: formatPercent, rows: fromMeta((d) => (d.lpViews > 0 ? d.leads / d.lpViews : 0)) };
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
          <p className="text-fg-muted font-mono text-sm animate-pulse">Sincronizando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base w-full pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-bg-card-border bg-bg-base/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Esquerda: logo + tag + navegação */}
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoSrc} alt="inchurch" className="h-6 w-auto shrink-0 select-none" draggable={false} />
            <span className="h-6 w-px bg-bg-card-border hidden sm:block" />
            {/* Exceção: as edições da Trilha (20/07 e 03/08 — outro webinar) usam tag amarela. */}
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap',
              view !== 'compare' && (edition === 'webinar-20-07' || edition === 'webinar-03-08')
                ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500'
                : 'bg-in-green/10 border border-in-green/25 text-in-green')}>
              <BarChart3 className="w-4 h-4" />
              {view === 'compare' ? 'Todas as edições' : editionLabel(edition)}
            </span>

            {/* Navegação: Painel × Comparar */}
            <div className="inline-flex items-center rounded-lg border border-bg-card-border bg-bg-card p-0.5 ml-1">
              <button
                onClick={() => setView('single')}
                title="Painel"
                className={cn('inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === 'single' ? 'bg-in-green text-black' : 'text-fg-muted hover:text-fg')}
              >
                <LayoutGrid className="w-4 h-4" /> <span className="hidden sm:inline">Painel</span>
              </button>
              <button
                onClick={() => setView('compare')}
                title="Comparar edições"
                className={cn('inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === 'compare' ? 'bg-in-green text-black' : 'text-fg-muted hover:text-fg')}
              >
                <GitCompare className="w-4 h-4" /> <span className="hidden sm:inline">Comparar</span>
              </button>
            </div>
          </div>

          {/* Direita: edições · sync · tema · avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {error && (
              <span className="hidden md:inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-lg text-xs font-medium border border-yellow-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Modo Demo
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

            <button
              onClick={() => refetch?.()}
              title="Atualizar dados"
              aria-label="Atualizar dados"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-bg-card-border bg-bg-card text-fg-muted hover:bg-bg-card-hover hover:text-fg transition-colors"
            >
              <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
            </button>

            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              aria-label="Alternar tema"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-bg-card-border bg-bg-card text-fg-muted hover:bg-bg-card-hover hover:text-fg transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="w-9 h-9 rounded-full bg-in-green flex items-center justify-center text-black text-xs font-bold select-none">
              IN
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {view === 'compare' ? (
          <EditionsComparison />
        ) : (
        <>
        {/* Filtro temporal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border border-bg-card-border bg-bg-card rounded-xl px-4 py-4">
          <DateFilter range={activeRange} full={full} onChange={setRange} />
          <span className="text-xs text-fg-subtle lg:text-right lg:max-w-[240px]">
            {isFullRange(activeRange, full)
              ? 'Todo o período do webinar (desde 19/06)'
              : 'Período selecionado · Alcance, Frequência e CPL Real não filtram por data'}
          </span>
        </div>

        {/* Aviso: fonte(s) de dados indisponível(is) para esta edição. Os cards
            afetados ficam zerados (NÃO herdam número de outro webinar). */}
        {unavailable.length > 0 && (
          <div className="flex items-start gap-2 border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Fonte de dados indisponível: </span>
              {unavailable.map((u) => SOURCE_LABELS[u] ?? u).join(', ')}.
              <span className="block text-xs opacity-80 mt-0.5">
                Os cards dessas fontes estão zerados até a conexão voltar (não exibem dados de outra edição). Verifique se a planilha/API está acessível.
              </span>
            </div>
          </div>
        )}

        {/* KPIs — Funil do Webinar */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Total de Inscritos" value={formatNumber(data.inscritos)} icon={<Users className="w-5 h-5" />} footer={pctFooter(pctMeta)} delay={0.05} />
            <KPICard
              title="Inscritos ADS"
              value={formatNumber(data.inscritosAds ?? 0)}
              icon={<Megaphone className="w-5 h-5" />}
              footer={data.inscritosAds != null ? pctFooter(pctAds) : undefined}
              {...clickProps('inscritosAds')}
              delay={0.08}
            />
            <KPICard
              title="Entradas no Grupo"
              value={formatNumber(data.entradasGrupo)}
              valueSuffix={
                data.saidasGrupo != null ? (
                  <span className="flex items-center gap-0.5 text-sm font-semibold text-red-500" title="Saídas do grupo #3 (estimativa)">
                    <UserMinus className="w-3.5 h-3.5" />
                    {formatNumber(data.saidasGrupo)}
                  </span>
                ) : undefined
              }
              icon={<UserPlus className="w-5 h-5" />}
              footer={pctFooter(pctGrupo)}
              {...clickProps('entradasGrupo')}
              delay={0.11}
            />
            <KPICard title="Total de Pesquisas" value={formatNumber(data.pesquisas)} icon={<Search className="w-5 h-5" />} footer={pctFooter(pctPesquisas)} {...clickProps('pesquisas')} delay={0.14} />
            <KPICard title="Total de ICPs" value={formatNumber(data.icps)} icon={<Target className="w-5 h-5" />} footer={pctFooter(pctIcps)} {...clickProps('icps')} delay={0.17} />
            <KPICard title="Diagnósticos" value={formatNumber(data.diagnosticos)} icon={<Stethoscope className="w-5 h-5" />} highlight {...clickProps('diagnosticos')} delay={0.2} />
            <KPICard
              title="CPA / CPL (Real)"
              value={formatCurrency(data.cplReal)}
              icon={<TrendingDown className="w-5 h-5" />}
              highlight={data.cplReal <= data.cplMeta}
              subtitle="investimento / inscritos ADS"
              delay={0.23}
            />
          </div>
        </div>

        {/* KPIs — Meta Ads */}
        <div>
          <h2 className={sectionTitle}>Meta Ads</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Gasto Total" value={formatCurrency(data.investimentoTrafego)} icon={<DollarSign className="w-5 h-5" />} delay={0.05} />
            <KPICard title="Alcance" value={formatCompact(data.alcance ?? 0)} icon={<Users className="w-5 h-5" />} subtitle="Meta Accounts" footer={goalFooter('alcance', data.alcance ?? 0)} delay={0.08} />
            <KPICard title="Impressões" value={formatCompact(data.impressoes ?? 0)} icon={<Eye className="w-5 h-5" />} footer={goalFooter('impressoes', data.impressoes ?? 0)} {...clickProps('impressoes')} delay={0.11} />
            <KPICard title="Frequência" value={(data.frequencia ?? 0).toFixed(2)} icon={<Repeat className="w-5 h-5" />} subtitle="média" footer={benchFooter('frequencia', data.frequencia)} delay={0.14} />
            <KPICard title="LPV" value={formatCompact(data.lpv ?? 0)} icon={<FileText className="w-5 h-5" />} subtitle="landing page views" footer={goalFooter('lpv', data.lpv ?? 0)} {...clickProps('lpv')} delay={0.17} />
            <KPICard title="Conv. Captura" value={formatPercent(data.convPagina ?? 0)} icon={<Percent className="w-5 h-5" />} subtitle="leads / LPV" footer={benchFooter('convPagina', data.convPagina)} {...clickProps('convPagina')} delay={0.26} />
            <KPICard title="CTR Link" value={formatPercent(data.ctrLink ?? 0)} icon={<BarChart3 className="w-5 h-5" />} footer={benchFooter('ctrLink', data.ctrLink)} delay={0.29} />
            <KPICard title="CPC" value={formatCurrency(data.cpc ?? 0)} icon={<MousePointerClick className="w-5 h-5" />} subtitle="por clique no link" footer={benchFooter('cpc', data.cpc)} {...clickProps('cpc')} delay={0.32} />
            <KPICard title="CPM" value={formatCurrency(data.cpm ?? 0)} icon={<Eye className="w-5 h-5" />} footer={benchFooter('cpm', data.cpm)} {...clickProps('cpm')} delay={0.35} />
            <KPICard title="Connect Rate" value={formatPercent(data.connectRate ?? 0)} icon={<Link2 className="w-5 h-5" />} subtitle="conv / cliques link" footer={benchFooter('connectRate', data.connectRate)} {...clickProps('connectRate')} delay={0.38} />
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
          <h2 className={sectionTitle}>Funil & ICPs</h2>
          <FunilCharts data={data} inscritosSerie={inscritosSerie} />
        </div>

        {/* Por Campanha */}
        {data.campanhas && data.campanhas.length > 0 && (
          <div>
            <h2 className={sectionTitle}>Por Campanha — Top 8</h2>
            <CampanhaBars campanhas={data.campanhas} />
          </div>
        )}

        {/* Tabela */}
        {data.campanhas && data.campanhas.length > 0 && <CampanhasTable campanhas={data.campanhas} />}

        {/* UTM × Prioridade */}
        <div>
          <h2 className={sectionTitle}>UTMs</h2>
          <UtmTable edition={edition} />
        </div>
        </>
        )}

        <p className="text-center text-xs text-fg-faint pt-4">
          Dados do Webinar IA · Meta Marketing API · Google Sheets · Sendflow
        </p>
      </main>
    </div>
  );
}
