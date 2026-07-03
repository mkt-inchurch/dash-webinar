import { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { Campanha } from '../types';
import { formatCurrency, formatNumber } from '../lib/utils';

const GREEN = '#00E330';
const GRID = '#1F2225';

// Nome curto: último trecho após "|" (ex.: "29_06 [2]"); trunca.
function shortName(name: string): string {
  const parts = name.split('|');
  let s = (parts.length > 1 ? parts[parts.length - 1] : name).trim();
  s = s.replace(/^29_06\s*/, '').trim() || '29_06';
  return s.length > 16 ? s.slice(0, 15) + '…' : s;
}

const tip = {
  contentStyle: { backgroundColor: '#0F1012', borderColor: '#1F2225', borderRadius: '8px', color: '#fff', fontSize: 12 },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
};

interface BarsProps {
  title: string;
  campanhas: Campanha[];
  pick: (c: Campanha) => number;
  format: (v: number) => string;
  ascending?: boolean; // CPL: menor = melhor
}

const HBars: FC<BarsProps> = ({ title, campanhas, pick, format, ascending }) => {
  const data = campanhas
    .map((c) => ({ name: shortName(c.name), value: pick(c) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))
    .slice(0, 8);

  return (
    <div className="border border-bg-card-border bg-bg-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="w-full" style={{ height: Math.max(140, data.length * 34) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10 }} tickFormatter={format} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#aaa', fontSize: 11 }} width={92} />
            <Tooltip {...tip} formatter={(v: number) => [format(v), title]} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={22}>
              {data.map((_, i) => (
                <Cell key={i} fill={GREEN} fillOpacity={ascending ? 0.55 + (i === 0 ? 0.45 : 0) : 1 - i * 0.08} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const CampanhaBars: FC<{ campanhas: Campanha[] }> = ({ campanhas }) => {
  if (!campanhas.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
    >
      <HBars title="Gasto por Campanha" campanhas={campanhas} pick={(c) => c.spend} format={formatCurrency} />
      <HBars title="Conversões por Campanha" campanhas={campanhas} pick={(c) => c.conversoes} format={formatNumber} />
      <HBars title="CPL por Campanha (menor = melhor)" campanhas={campanhas} pick={(c) => c.cpl} format={formatCurrency} ascending />
    </motion.div>
  );
};
