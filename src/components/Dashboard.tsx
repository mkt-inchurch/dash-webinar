import { useState, useMemo, useEffect } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KPICard } from './KPICard';
import { ChartPanel } from './ChartPanel';
import { DateFilter } from './DateFilter';
import { fullRange, applyDateFilter, isFullRange, DateRange } from '../lib/dateFilter';
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { META_INSCRITOS } from '../lib/constants';
import {
  Users,
  UserPlus,
  Search,
  Target,
  Stethoscope,
  TrendingDown,
  DollarSign,
  AlertCircle
} from 'lucide-react';

export function Dashboard() {
  const { data: rawData, series, loading, hasLoaded, error } = useDashboardData();
  const [selected, setSelected] = useState('inscritos');
  const [range, setRange] = useState<DateRange | null>(null);

  const full = useMemo(() => fullRange(series), [series]);

  // Quando as séries chegam, inicializa o intervalo com o período completo.
  useEffect(() => {
    const hasSeries =
      series.inscritos.length || series.pesquisas.length || series.icps.length || series.meta.length;
    if (hasSeries) setRange((prev) => prev ?? full);
  }, [full, series]);

  const activeRange = range ?? full;
  const filtered = !!range && !isFullRange(activeRange, full);
  const data = useMemo(
    () => applyDateFilter(rawData, series, activeRange),
    [rawData, series, activeRange]
  );

  // Taxas de conversão recomputadas dos valores exibidos (consistentes com o filtro).
  const taxaPesqIcp = data.pesquisas ? data.icps / data.pesquisas : 0;
  const taxaInscGrupo = data.inscritos ? data.entradasGrupo / data.inscritos : 0;
  const taxaGrupoPesq = data.entradasGrupo ? data.pesquisas / data.entradasGrupo : 0;

  const grayFooter = (text: string) => (
    <span className="text-xs font-mono text-gray-500">{text}</span>
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
              <p className="text-xs text-in-green font-mono">MÉTRICAS</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-bg-card-border bg-bg-card rounded-xl px-4 py-3">
          <DateFilter range={activeRange} full={full} onChange={setRange} />
          <span className="text-xs text-gray-500">
            {filtered
              ? 'Período selecionado · Entradas no Grupo não filtra por data'
              : 'Todo o período do webinar'}
          </span>
        </div>

        {/* Core Metrics Grid */}
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest">Aquisição</h2>
            <span className="text-xs text-gray-600 hidden sm:inline">Clique em um card para ver o gráfico</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Total de Inscritos"
              value={formatNumber(data.inscritos)}
              icon={<Users className="w-5 h-5" />}
              delay={0.1}
              active={selected === 'inscritos'}
              onClick={() => setSelected('inscritos')}
              footer={
                filtered
                  ? grayFooter('no período selecionado')
                  : (
                    <span className="text-xs font-semibold text-in-green">
                      {formatPercent(data.inscritos / META_INSCRITOS)} da meta ({formatNumber(META_INSCRITOS)})
                    </span>
                  )
              }
            />
            <KPICard
              title="Entradas no Grupo"
              value={formatNumber(data.entradasGrupo)}
              icon={<UserPlus className="w-5 h-5" />}
              delay={0.15}
              active={selected === 'entradasGrupo'}
              onClick={() => setSelected('entradasGrupo')}
              footer={
                filtered
                  ? grayFooter('total ao vivo · sem filtro')
                  : (
                    <span className="text-xs font-semibold text-in-green">
                      {formatPercent(taxaInscGrupo)} · Inscritos → Grupo
                    </span>
                  )
              }
            />
            <KPICard
              title="Total de Pesquisas"
              value={formatNumber(data.pesquisas)}
              icon={<Search className="w-5 h-5" />}
              delay={0.2}
              active={selected === 'pesquisas'}
              onClick={() => setSelected('pesquisas')}
              footer={
                filtered
                  ? undefined
                  : (
                    <span className="text-xs font-semibold text-in-green">
                      {formatPercent(taxaGrupoPesq)} · Grupo → Pesquisa
                    </span>
                  )
              }
            />
            <KPICard
              title="Total de ICPs"
              value={formatNumber(data.icps)}
              icon={<Target className="w-5 h-5" />}
              delay={0.25}
              active={selected === 'icps'}
              onClick={() => setSelected('icps')}
              footer={
                <span className="text-xs font-semibold text-in-green">
                  {formatPercent(taxaPesqIcp)} · Pesquisa → ICPs
                </span>
              }
            />
            <KPICard
              title="Diagnósticos"
              value={formatNumber(data.diagnosticos)}
              icon={<Stethoscope className="w-5 h-5" />}
              delay={0.3}
              highlight
              active={selected === 'diagnosticos'}
              onClick={() => setSelected('diagnosticos')}
            />
          </div>
        </div>

        {/* Financial / Tráfego */}
        <div>
          <h2 className="text-sm font-mono text-gray-500 mb-4 px-2 uppercase tracking-widest">Financeiro & Tráfego</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Investimento Total"
              value={formatCurrency(data.investimentoTrafego)}
              icon={<DollarSign className="w-5 h-5" />}
              delay={0.4}
              active={selected === 'investimentoTrafego'}
              onClick={() => setSelected('investimentoTrafego')}
            />
            <KPICard
              title="Leads (Meta)"
              value={formatNumber(data.leadsMeta)}
              icon={<Target className="w-5 h-5" />}
              delay={0.5}
              active={selected === 'leadsMeta'}
              onClick={() => setSelected('leadsMeta')}
            />
            <KPICard
              title="CPA / CPL (Meta)"
              value={formatCurrency(data.cplMeta)}
              delay={0.6}
              active={selected === 'cplMeta'}
              onClick={() => setSelected('cplMeta')}
            />
            <KPICard
              title="CPA / CPL (Real)"
              value={formatCurrency(data.cplReal)}
              icon={<TrendingDown className="w-5 h-5" />}
              delay={0.7}
              highlight={data.cplReal <= data.cplMeta}
              active={selected === 'cplReal'}
              onClick={() => setSelected('cplReal')}
            />
          </div>
        </div>

        {/* Dynamic Chart */}
        <ChartPanel selected={selected} data={data} />

      </main>
    </div>
  );
}
