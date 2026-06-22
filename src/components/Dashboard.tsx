import { useDashboardData } from '../hooks/useDashboardData';
import { KPICard } from './KPICard';
import { FunnelChart } from './FunnelChart';
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils';
import { 
  Users, 
  UserPlus, 
  Search, 
  Target, 
  Stethoscope, 
  ArrowRight,
  TrendingDown,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export function Dashboard() {
  const { data, loading, error } = useDashboardData();

  if (loading && !data.inscritos) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-bg-card-border border-t-in-green" />
          <p className="text-gray-400 font-mono text-sm animate-pulse">Sincronizando com Google Sheets...</p>
        </div>
      </div>
    );
  }

  const funnelData = [
    { name: 'Inscritos', value: data.inscritos },
    { name: 'Grupo', value: data.entradasGrupo },
    { name: 'Pesquisas', value: data.pesquisas },
    { name: 'ICPs', value: data.icps },
    { name: 'Diagnósticos', value: data.diagnosticos },
  ];

  return (
    <div className="min-h-screen bg-bg-base w-full pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-bg-card-border bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-in-green flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-black" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">inChurch Dashboard</h1>
              <p className="text-xs text-in-green font-mono">LIVE / METRICS</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {error && (
              <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-sm font-medium border border-yellow-500/20">
                <AlertCircle className="w-4 h-4" />
                <span className="hidden xl:inline">{error}</span>
                <span className="xl:hidden">Modo Demo</span>
              </div>
            )}
            {!error && !loading && (
               <div className="flex items-center gap-2 bg-in-green/10 text-in-green px-4 py-2 rounded-full text-sm font-medium border border-in-green/20">
                  <div className="w-2 h-2 rounded-full bg-in-green animate-pulse"></div>
                  <span>Sincronizado</span>
               </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">

        
        {/* Core Metrics Grid */}
        <div>
          <h2 className="text-sm font-mono text-gray-500 mb-4 px-2 uppercase tracking-widest">Aquisição</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard 
              title="Total de Inscritos" 
              value={formatNumber(data.inscritos)} 
              icon={<Users className="w-5 h-5" />}
              delay={0.1}
            />
            <KPICard 
              title="Entradas no Grupo" 
              value={formatNumber(data.entradasGrupo)} 
              icon={<UserPlus className="w-5 h-5" />}
              delay={0.15}
            />
            <KPICard 
              title="Total de Pesquisas" 
              value={formatNumber(data.pesquisas)} 
              icon={<Search className="w-5 h-5" />}
              delay={0.2}
            />
            <KPICard 
              title="Total de ICPs" 
              value={formatNumber(data.icps)} 
              icon={<Target className="w-5 h-5" />}
              delay={0.25}
            />
            <KPICard 
              title="Diagnósticos" 
              value={formatNumber(data.diagnosticos)} 
              icon={<Stethoscope className="w-5 h-5" />}
              delay={0.3}
              highlight
            />
          </div>
        </div>

        {/* Funnel & Growth Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2">
             <FunnelChart data={funnelData} />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-mono text-gray-500 mb-1 px-2 uppercase tracking-widest">Taxas de Conversão</h2>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-bg-card border border-bg-card-border rounded-xl p-5 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">Inscritos → Grupo</span>
                <span className="text-2xl font-bold text-white">{formatPercent(data.taxaInscritosGrupo)}</span>
              </div>
              <ArrowRight className="text-in-green w-5 h-5 opacity-50" />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-bg-card border border-bg-card-border rounded-xl p-5 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">Grupo → Pesquisa</span>
                <span className="text-2xl font-bold text-white">{formatPercent(data.taxaGrupoPesquisa)}</span>
              </div>
              <ArrowRight className="text-in-green w-5 h-5 opacity-50" />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-bg-card border border-bg-card-border rounded-xl p-5 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">Pesquisa → ICPs</span>
                <span className="text-2xl font-bold text-in-green">{formatPercent(data.taxaPesquisaIcp)}</span>
              </div>
              <Target className="text-in-green w-5 h-5 opacity-50" />
            </motion.div>
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
            />
            <KPICard 
              title="Meta de Leads" 
              value={formatNumber(data.leadsMeta)} 
              icon={<Target className="w-5 h-5" />}
              delay={0.5}
            />
            <KPICard 
              title="CPA / CPL (Meta)" 
              value={formatCurrency(data.cplMeta)} 
              delay={0.6}
            />
            <KPICard 
              title="CPA / CPL (Real)" 
              value={formatCurrency(data.cplReal)} 
              icon={<TrendingDown className="w-5 h-5" />}
              delay={0.7}
              highlight={data.cplReal <= data.cplMeta}
            />
          </div>
        </div>

      </main>
    </div>
  );
}
