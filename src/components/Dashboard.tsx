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
import {
  DollarSign, Users, Eye, Repeat, FileText, Target, TrendingDown, TrendingUp,
  Percent, BarChart3, MousePointerClick, Link2, UserPlus, UserMinus, Search,
  Stethoscope, Megaphone, AlertCircle,
} from 'lucide-react';

const sectionTitle = 'text-sm font-mono text-gray-500 mb-4 px-2 uppercase tracking-widest';

export function Dashboard() {
  const { data: rawData, series, loading, hasLoaded, error } = useDashboardData();
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
          <p className="text-gray-400 font-mono text-sm animate-pulse">Sincronizando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base w-full pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-bg-card-border bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-in-green flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-black" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">Dados Webinar IA</h1>
              <p className="text-xs text-in-green font-mono">MÉTRICAS · META ADS</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            {error && (
              <div className="flex items-center space-x-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-sm font-medium border border-yellow-500/20">
                <AlertCircle className="w-4 h-4" />
                <span className="hidden xl:inline">{error}</span>
                <span className="xl:hidden">Modo Demo</span>
              </div>
            )}
            {!error && !loading && (
              <div className="flex items-center space-x-2 bg-in-green/10 text-in-green px-4 py-2 rounded-full text-sm font-medium border border-in-green/20">
                <div className="w-2 h-2 rounded-full bg-in-green animate-pulse"></div>
                <span>Sincronizado</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Filtro temporal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border border-bg-card-border bg-bg-card rounded-xl px-4 py-4">
          <DateFilter range={activeRange} full={full} onChange={setRange} />
          <span className="text-xs text-gray-500 lg:text-right lg:max-w-[240px]">
            {isFullRange(activeRange, full)
              ? 'Todo o período do webinar (desde 19/06)'
              : 'Período selecionado · Alcance, Frequência, Diagnósticos e CPL Real não filtram por data'}
          </span>
        </div>

        {/* KPIs — Meta Ads */}
        <div>
          <h2 className={sectionTitle}>Meta Ads</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

        {/* KPIs — Funil do Webinar */}
        <div>
          <h2 className={sectionTitle}>Funil do Webinar</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

        {/* Tendência */}
        <div>
          <h2 className={sectionTitle}>Tendência — por dia</h2>
          <TrendCharts serie={metaSerie} />
        </div>

        {/* Funil (gráficos) */}
        <div>
          <h2 className={sectionTitle}>Funil & ICPs</h2>
          <FunilCharts data={data} />
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

        <p className="text-center text-xs text-gray-600 pt-4">
          Dados do Webinar IA · Meta Marketing API · Google Sheets · Sendflow
        </p>
      </main>
    </div>
  );
}
