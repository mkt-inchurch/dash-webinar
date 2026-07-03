import { useState, useMemo, useEffect } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KPICard } from './KPICard';
import { DateFilter } from './DateFilter';
import { TrendCharts } from './TrendCharts';
import { FunilCharts } from './FunilCharts';
import { CampanhaBars } from './CampanhaBars';
import { CampanhasTable } from './CampanhasTable';
import { fullRange, applyDateFilter, isFullRange, DateRange } from '../lib/dateFilter';
import { formatCurrency, formatNumber, formatPercent, formatCompact } from '../lib/utils';
import { META_INSCRITOS } from '../lib/constants';
import { useTheme } from '../lib/theme';
import {
  DollarSign, Users, Eye, Repeat, FileText, Target, TrendingDown, TrendingUp,
  Percent, BarChart3, MousePointerClick, Link2, UserPlus, UserMinus, Search,
  Stethoscope, Megaphone, AlertCircle, RefreshCw, Sun, Moon, ChevronDown, Layers,
} from 'lucide-react';

const sectionTitle = 'text-sm font-mono text-fg-subtle mb-4 px-2 uppercase tracking-widest';

export function Dashboard() {
  const { data: rawData, series, loading, hasLoaded, error, refetch } = useDashboardData();
  const { theme, toggle } = useTheme();
  const logoSrc = theme === 'light' ? '/logo-light.webp' : '/logo-dark.webp';
  const [range, setRange] = useState<DateRange | null>(null);

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

  // Percentuais dos rodapés do funil (verde).
  const pctMeta = data.inscritos / META_INSCRITOS;
  const pctGrupo = data.inscritos ? data.entradasGrupo / data.inscritos : 0;
  const pctPesquisas = data.inscritos ? data.pesquisas / data.inscritos : 0;
  const pctIcps = data.inscritos ? data.icps / data.inscritos : 0;
  const pctAds = data.inscritos && data.inscritosAds != null ? data.inscritosAds / data.inscritos : 0;
  const pctFooter = (v: number) => (
    <span className="flex items-center gap-1 text-sm font-semibold text-in-green">
      <TrendingUp className="w-4 h-4" />
      {formatPercent(v)}
    </span>
  );

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
          {/* Esquerda: logo + tag da edição */}
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoSrc} alt="inchurch" className="h-6 w-auto shrink-0 select-none" draggable={false} />
            <span className="h-6 w-px bg-bg-card-border hidden sm:block" />
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-in-green/10 border border-in-green/25 text-in-green px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap">
              <BarChart3 className="w-4 h-4" />
              Webinar 04/07
            </span>
          </div>

          {/* Direita: edições · sync · tema · avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {error && (
              <span className="hidden md:inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-lg text-xs font-medium border border-yellow-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Modo Demo
              </span>
            )}

            {/* Filtro de Edições (placeholder — em breve múltiplas edições do webinar) */}
            <div className="relative">
              <Layers className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-4 h-4 text-fg-subtle absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                aria-label="Edições"
                defaultValue="all"
                className="appearance-none bg-bg-card border border-bg-card-border rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-fg hover:bg-bg-card-hover focus:outline-none focus:border-in-green cursor-pointer"
              >
                <option value="all">Edições</option>
              </select>
            </div>

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
        {/* Filtro temporal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border border-bg-card-border bg-bg-card rounded-xl px-4 py-4">
          <DateFilter range={activeRange} full={full} onChange={setRange} />
          <span className="text-xs text-fg-subtle lg:text-right lg:max-w-[240px]">
            {isFullRange(activeRange, full)
              ? 'Todo o período do webinar (desde 19/06)'
              : 'Período selecionado · Alcance, Frequência, Diagnósticos e CPL Real não filtram por data'}
          </span>
        </div>

        {/* KPIs — Funil do Webinar */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Total de Inscritos" value={formatNumber(data.inscritos)} icon={<Users className="w-5 h-5" />} footer={pctFooter(pctMeta)} delay={0.05} />
            <KPICard
              title="Inscritos ADS"
              value={formatNumber(data.inscritosAds ?? 0)}
              icon={<Megaphone className="w-5 h-5" />}
              footer={data.inscritosAds != null ? pctFooter(pctAds) : undefined}
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
              delay={0.11}
            />
            <KPICard title="Total de Pesquisas" value={formatNumber(data.pesquisas)} icon={<Search className="w-5 h-5" />} footer={pctFooter(pctPesquisas)} delay={0.14} />
            <KPICard title="Total de ICPs" value={formatNumber(data.icps)} icon={<Target className="w-5 h-5" />} footer={pctFooter(pctIcps)} delay={0.17} />
            <KPICard title="Diagnósticos" value={formatNumber(data.diagnosticos)} icon={<Stethoscope className="w-5 h-5" />} highlight delay={0.2} />
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
            <KPICard title="Alcance" value={formatCompact(data.alcance ?? 0)} icon={<Users className="w-5 h-5" />} subtitle="Meta Accounts" delay={0.08} />
            <KPICard title="Impressões" value={formatCompact(data.impressoes ?? 0)} icon={<Eye className="w-5 h-5" />} delay={0.11} />
            <KPICard title="Frequência" value={(data.frequencia ?? 0).toFixed(2)} icon={<Repeat className="w-5 h-5" />} subtitle="média" delay={0.14} />
            <KPICard title="LPV" value={formatCompact(data.lpv ?? 0)} icon={<FileText className="w-5 h-5" />} subtitle="landing page views" delay={0.17} />
            <KPICard title="Conversões" value={formatNumber(data.leadsMeta)} icon={<Target className="w-5 h-5" />} subtitle="leads (Meta)" delay={0.2} />
            <KPICard title="CPL" value={formatCurrency(data.cplMeta)} icon={<TrendingDown className="w-5 h-5" />} subtitle="custo por resultado" delay={0.23} />
            <KPICard title="Conv. Captura" value={formatPercent(data.convPagina ?? 0)} icon={<Percent className="w-5 h-5" />} subtitle="leads / LPV" delay={0.26} />
            <KPICard title="CTR Link" value={formatPercent(data.ctrLink ?? 0)} icon={<BarChart3 className="w-5 h-5" />} delay={0.29} />
            <KPICard title="CPC" value={formatCurrency(data.cpc ?? 0)} icon={<MousePointerClick className="w-5 h-5" />} subtitle="por clique no link" delay={0.32} />
            <KPICard title="CPM" value={formatCurrency(data.cpm ?? 0)} icon={<Eye className="w-5 h-5" />} delay={0.35} />
            <KPICard title="Connect Rate" value={formatPercent(data.connectRate ?? 0)} icon={<Link2 className="w-5 h-5" />} subtitle="conv / cliques link" delay={0.38} />
          </div>
        </div>

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

        <p className="text-center text-xs text-fg-faint pt-4">
          Dados do Webinar IA · Meta Marketing API · Google Sheets · Sendflow
        </p>
      </main>
    </div>
  );
}
