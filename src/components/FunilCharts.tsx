import { FC, ReactNode } from 'react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { DashboardData, DiaContagem } from '../types';
import { formatNumber } from '../lib/utils';

const GREEN = '#00E330';
const DIM = '#2A2F35';
const GRID = '#1F2225';
const AXIS = { fill: '#888', fontSize: 11 };
const tip = {
  contentStyle: { backgroundColor: '#0F1012', borderColor: '#1F2225', borderRadius: '8px', color: '#fff', fontSize: 12 },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
};

const ddmm = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border border-bg-card-border bg-bg-card rounded-2xl p-5">
    <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
    <div className="w-full h-[240px]">
      <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
    </div>
  </div>
);

export const FunilCharts: FC<{ data: DashboardData; inscritosSerie: DiaContagem[] }> = ({ data, inscritosSerie }) => {
  const inscritosRows = inscritosSerie.map((d) => ({ label: ddmm(d.data), novos: d.novos }));
  const icp = data.icp
    ? [
        { name: 'P1', value: data.icp.p1 },
        { name: 'P2', value: data.icp.p2 },
        { name: 'P3', value: data.icp.p3 },
        { name: 'P4', value: data.icp.p4 },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      <Card title="Inscritos por dia">
        <AreaChart data={inscritosRows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gInscritos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={GREEN} stopOpacity={0.35} />
              <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis axisLine={false} tickLine={false} tick={AXIS} width={44} />
          <Tooltip {...tip} formatter={(v: number) => [formatNumber(v), 'Inscritos']} />
          <Area type="monotone" dataKey="novos" stroke={GREEN} strokeWidth={2} fill="url(#gInscritos)" />
        </AreaChart>
      </Card>

      {icp.length > 0 && (
        <Card title="Perfis de ICP (P1–P4)">
          <BarChart data={icp} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS} />
            <YAxis axisLine={false} tickLine={false} tick={AXIS} width={30} />
            <Tooltip {...tip} formatter={(v: number) => [formatNumber(v), 'Leads']} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={60}>
              {icp.map((_, i) => (
                <Cell key={i} fill={i === 0 || i === 1 ? GREEN : DIM} />
              ))}
            </Bar>
          </BarChart>
        </Card>
      )}
    </motion.div>
  );
};
