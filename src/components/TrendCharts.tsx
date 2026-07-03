import { FC, ReactNode } from 'react';
import {
  AreaChart, Area, ComposedChart, Bar, Line, LineChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { DiaMeta } from '../types';
import { useTheme, chartPalette } from '../lib/theme';

const ddmm = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border border-bg-card-border bg-bg-card rounded-2xl p-5">
    <h3 className="text-sm font-semibold text-fg mb-4">{title}</h3>
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
    </div>
  </div>
);

interface TrendChartsProps {
  serie: DiaMeta[];
}

export const TrendCharts: FC<TrendChartsProps> = ({ serie }) => {
  const { theme } = useTheme();
  const p = chartPalette(theme);
  const AXIS = { fill: p.axis, fontSize: 11 };
  const tooltipStyle = {
    contentStyle: { backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, borderRadius: '8px', color: p.tooltipText, fontSize: 12 },
    cursor: { fill: p.cursor, stroke: p.grid },
  };

  const rows = serie.map((d) => ({
    label: ddmm(d.data),
    spend: d.spend,
    leads: d.leads,
    cpl: d.leads > 0 ? d.spend / d.leads : 0,
    ctr: d.impressions > 0 ? (d.linkClicks / d.impressions) * 100 : 0,
    reach: d.reach,
    freq: d.reach > 0 ? d.impressions / d.reach : 0,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      {/* Gasto (R$) */}
      <Card title="Gasto (R$)">
        <AreaChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gGasto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={p.green} stopOpacity={0.35} />
              <stop offset="95%" stopColor={p.green} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS} width={48} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Gasto']} />
          <Area type="monotone" dataKey="spend" stroke={p.green} strokeWidth={2} fill="url(#gGasto)" />
        </AreaChart>
      </Card>

      {/* Conversões × CPL */}
      <Card title="Conversões × CPL">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} width={32} />
          <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={AXIS} width={44} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="leads" name="Conversões" fill={p.green} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Line yAxisId="r" type="monotone" dataKey="cpl" name="CPL (R$)" stroke={p.orange} strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </Card>

      {/* CTR Link (%) */}
      <Card title="CTR Link (%)">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS} width={40} tickFormatter={(v) => `${v}%`} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'CTR Link']} />
          <Line type="monotone" dataKey="ctr" stroke={p.green} strokeWidth={2.5} dot={false} />
        </LineChart>
      </Card>

      {/* Alcance × Frequência */}
      <Card title="Alcance × Frequência">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} width={40} />
          <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={AXIS} width={30} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="reach" name="Alcance" fill={p.reach} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Line yAxisId="r" type="monotone" dataKey="freq" name="Frequência" stroke={p.orange} strokeWidth={2} dot={false} />
        </ComposedChart>
      </Card>
    </motion.div>
  );
};
