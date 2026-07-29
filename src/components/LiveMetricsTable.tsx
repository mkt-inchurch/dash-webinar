import { FC, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Youtube, Calendar, Clock, AlertCircle, Eye, Users, BarChart3, MessageSquare, Timer, Activity } from 'lucide-react';
import { getLiveMetrics, LIVE_EXTRACTION_DATE } from '../lib/liveMetrics';

interface LiveMetricsTableProps {
  edition: string;
}

export const LiveMetricsTable: FC<LiveMetricsTableProps> = ({ edition }) => {
  const m = getLiveMetrics(edition);
  if (!m) return null; // edição sem dados de live → não renderiza a seção

  const rows: { label: string; icon: ReactNode; value: string }[] = [
    { label: 'Visualizações', icon: <Eye className="w-4 h-4" />, value: m.visualizacoes },
    { label: 'Alcance (espectadores únicos)', icon: <Users className="w-4 h-4" />, value: m.alcance },
    { label: 'Impressões', icon: <BarChart3 className="w-4 h-4" />, value: m.impressoes },
    { label: 'Mensagens no chat', icon: <MessageSquare className="w-4 h-4" />, value: m.chat },
    { label: 'Duração média da visualização', icon: <Timer className="w-4 h-4" />, value: m.duracaoMedia },
    { label: 'Espectadores simultâneos — pico', icon: <Activity className="w-4 h-4" />, value: m.picoSimultaneos },
    { label: 'Espectadores simultâneos — média', icon: <Activity className="w-4 h-4" />, value: m.mediaSimultaneos },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-bg-card-border bg-bg-card rounded-2xl p-5"
    >
      {/* Cabeçalho: título da live + data/hora + duração */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Youtube className="w-5 h-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg truncate">{m.titulo}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-subtle mt-0.5">
              <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{m.dataHora}</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{m.duracao}</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-fg-faint whitespace-nowrap">Extraído em {LIVE_EXTRACTION_DATE}</span>
      </div>

      {/* Aviso de dados em processamento (extração logo após a live). */}
      {m.processando && (
        <div className="flex items-start gap-2 border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-xl px-3 py-2 text-xs mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Dados ainda em processamento pelo YouTube (extração logo após a live) — tendem a subir nos próximos dias e ainda não são comparáveis com as demais edições.</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-bg-card-border/50 last:border-0 hover:bg-bg-card-hover">
                <td className="px-3 py-3 text-left text-fg-muted whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 text-fg-subtle">{r.icon}<span className="text-fg-muted">{r.label}</span></span>
                </td>
                <td className="px-3 py-3 text-right font-semibold text-fg whitespace-nowrap tabular-nums">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
