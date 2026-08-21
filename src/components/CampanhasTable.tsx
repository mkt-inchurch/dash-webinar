import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Campanha } from '../types';
import { formatCurrency, formatNumber, formatCompact, formatPercent } from '../lib/utils';

interface CampanhasTableProps {
  campanhas: Campanha[];
  // Para a nota de rodapé: quanto o lead do pixel diverge da inscrição real.
  // Devem ser os totais do PERÍODO COMPLETO, como as linhas da tabela — com os
  // valores filtrados, a nota comparava 7 dias de inscritos com o total da campanha.
  inscritosAds?: number;
  leadsMeta?: number;
  // O filtro de data está ativo? A tabela continua sendo do período completo (a Graph
  // API não devolve série por dia por campanha), então isso vira um aviso no topo.
  periodoFiltrado?: boolean;
}

const th = 'px-3 py-2 text-right font-medium text-fg-subtle whitespace-nowrap';
const td = 'px-3 py-3 text-right text-fg whitespace-nowrap';

export const CampanhasTable: FC<CampanhasTableProps> = ({ campanhas, inscritosAds, leadsMeta, periodoFiltrado }) => {
  const [q, setQ] = useState('');
  if (!campanhas.length) return null;

  const rows = campanhas.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  // "Leads (Meta)" é o evento do pixel, não a inscrição da planilha — nas edições
  // auditadas ele fica de 7% a 114% acima. Como o CPL desta tabela usa esse número,
  // ele é sempre OTIMISTA frente ao CPA real do card do topo. A nota mostra o fator.
  const temComparacao = !!(leadsMeta && leadsMeta > 0 && inscritosAds && inscritosAds > 0);
  const fator = temComparacao ? (leadsMeta as number) / (inscritosAds as number) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-bg-card-border bg-bg-card rounded-2xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-fg">
          Campanhas
          {periodoFiltrado && (
            <span className="ml-2 font-normal text-yellow-500">· período total da edição, não acompanha o filtro de data</span>
          )}
        </h3>
        <div className="relative">
          <Search className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar campanha..."
            className="bg-bg-base border border-bg-card-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-fg focus:outline-none focus:border-in-green w-full sm:w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-bg-card-border">
              <th className="px-3 py-2 text-left font-medium text-fg-subtle whitespace-nowrap">Campanha</th>
              <th className={th}>Gasto</th>
              <th className={th}>Alcance</th>
              <th className={th}>Impressões</th>
              <th className={th}>Freq.</th>
              <th className={th}>Cliques Link</th>
              <th className={th}>LPV</th>
              <th className={th}>CTR Link</th>
              <th className={th}>CPM</th>
              <th className={th}>CPC</th>
              <th className={th} title="Evento 'lead' do pixel do Meta — não é a inscrição da planilha">Leads (Meta)</th>
              <th className={th} title="Gasto ÷ leads do pixel. O CPA real (por inscrito) está no card do topo">CPL (Meta)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-bg-card-border/50 hover:bg-bg-card-hover">
                <td className="px-3 py-3 text-left text-fg max-w-[260px] truncate" title={c.name}>{c.name}</td>
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

      {temComparacao && (
        <p className="text-xs text-fg-subtle mt-4 pt-3 border-t border-bg-card-border">
          <span className="text-yellow-500 font-medium">Leia com atenção:</span>{' '}
          “Leads (Meta)” é o evento do pixel — nesta edição são{' '}
          <span className="text-fg font-medium">{formatNumber(leadsMeta as number)}</span> leads para{' '}
          <span className="text-fg font-medium">{formatNumber(inscritosAds as number)}</span> inscritos de anúncio na planilha
          {fator > 1.05 && <> ({fator.toFixed(2)}× mais)</>}. Logo, o CPL desta tabela é otimista frente ao
          CPA real do card “CPA / CPL (Real)”, que usa a inscrição efetiva.
        </p>
      )}
    </motion.div>
  );
};
