import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Campanha } from '../types';
import { formatCurrency, formatNumber, formatCompact, formatPercent } from '../lib/utils';

interface CampanhasTableProps {
  campanhas: Campanha[];
}

const th = 'px-3 py-2 text-right font-medium text-gray-500 whitespace-nowrap';
const td = 'px-3 py-3 text-right text-gray-200 whitespace-nowrap';

export const CampanhasTable: FC<CampanhasTableProps> = ({ campanhas }) => {
  const [q, setQ] = useState('');
  if (!campanhas.length) return null;

  const rows = campanhas.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-bg-card-border bg-bg-card rounded-2xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-white">Campanhas</h3>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar campanha..."
            className="bg-bg-base border border-bg-card-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-in-green w-full sm:w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-bg-card-border">
              <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Campanha</th>
              <th className={th}>Gasto</th>
              <th className={th}>Alcance</th>
              <th className={th}>Impressões</th>
              <th className={th}>Freq.</th>
              <th className={th}>Cliques Link</th>
              <th className={th}>LPV</th>
              <th className={th}>CTR Link</th>
              <th className={th}>CPM</th>
              <th className={th}>CPC</th>
              <th className={th}>Conversões</th>
              <th className={th}>CPL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-bg-card-border/50 hover:bg-bg-card-hover">
                <td className="px-3 py-3 text-left text-white max-w-[260px] truncate" title={c.name}>{c.name}</td>
                <td className={td}>{formatCurrency(c.spend)}</td>
                <td className={td}>{formatCompact(c.alcance)}</td>
                <td className={td}>{formatCompact(c.impressoes)}</td>
                <td className={td}>{c.frequencia.toFixed(2)}</td>
                <td className={td}>{formatNumber(c.linkClicks)}</td>
                <td className={td}>{formatNumber(c.lpViews)}</td>
                <td className={td + ' text-in-green'}>{formatPercent(c.ctrLink)}</td>
                <td className={td}>{formatCurrency(c.cpm)}</td>
                <td className={td}>{formatCurrency(c.cpc)}</td>
                <td className={td + ' text-in-green'}>{formatNumber(c.conversoes)}</td>
                <td className={td}>{formatCurrency(c.cpl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
