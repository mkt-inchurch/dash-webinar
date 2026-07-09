import { FC } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme, chartPalette } from '../lib/theme';

interface MetricChartProps {
  title: string;
  data: { label: string; value: number }[];
  fmt: (v: number) => string;
  onClose: () => void;
}

// Gráfico de evolução por dia (mesma linguagem visual do "Gasto R$"), aberto ao
// clicar num card. Um único gráfico, em seção própria acima da "Tendência".
export const MetricChart: FC<MetricChartProps> = ({ title, data, fmt, onClose }) => {
  const { theme } = useTheme();
  const p = chartPalette(theme);
  const AXIS = { fill: p.axis, fontSize: 11 };
  const gid = 'gMetric';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="border border-in-green/40 bg-bg-card rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-fg">
          {title} <span className="text-fg-subtle font-normal">· evolução por dia</span>
        </h3>
        <button
          onClick={onClose}
          aria-label="Fechar gráfico"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-muted hover:bg-bg-card-hover hover:text-fg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="w-full h-[240px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={p.green} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={p.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} />
              <YAxis axisLine={false} tickLine={false} tick={AXIS} width={48} />
              <Tooltip
                contentStyle={{ backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, borderRadius: '8px', color: p.tooltipText, fontSize: 12 }}
                cursor={{ fill: p.cursor, stroke: p.grid }}
                formatter={(v: number) => [fmt(v), title]}
              />
              <Area type="monotone" dataKey="value" stroke={p.green} strokeWidth={2} fill={`url(#${gid})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-fg-subtle text-sm">
            Sem série diária para o período selecionado.
          </div>
        )}
      </div>
    </motion.div>
  );
};
