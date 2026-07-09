import { FC, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, ArrowUpDown, CircleDot } from 'lucide-react';
import { cn } from '../lib/utils';

interface UtmRow {
  nome: string;
  total: number;
  p1: number; p2: number; p3: number; p4: number;
  desq: number; mql: number; pMQL: number; pDESQ: number;
}
interface UtmResp {
  dim: string;
  rows: UtmRow[];
  melhor?: { nome: string; pMQL: number; total: number } | null;
  pior?: { nome: string; pMQL: number; total: number } | null;
}

const DIMS = [
  { id: 'utm_source', label: 'utm_source' },
  { id: 'utm_medium', label: 'utm_medium' },
  { id: 'utm_campaign', label: 'utm_campaign' },
];

type SortKey = 'nome' | 'total' | 'p1' | 'p2' | 'p3' | 'p4' | 'desq' | 'pMQL' | 'pDESQ';
const COLS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'total', label: 'TOTAL', align: 'right' },
  { key: 'p1', label: 'P1', align: 'right' },
  { key: 'p2', label: 'P2', align: 'right' },
  { key: 'p3', label: 'P3', align: 'right' },
  { key: 'p4', label: 'P4', align: 'right' },
  { key: 'desq', label: 'DESQ', align: 'right' },
  { key: 'pMQL', label: '% MQL', align: 'right' },
  { key: 'pDESQ', label: '% DESQ', align: 'right' },
];

export const UtmTable: FC<{ edition: string }> = ({ edition }) => {
  const [dim, setDim] = useState('utm_campaign');
  const [resp, setResp] = useState<UtmResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/utms?ed=${edition}&dim=${dim}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: UtmResp) => { if (alive) { setResp(j); } })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [edition, dim]);

  const sorted = useMemo(() => {
    const rows = resp?.rows ?? [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === 'nome') return a.nome.localeCompare(b.nome) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [resp, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'nome' ? 'asc' : 'desc'); }
  };

  const arrow = (k: SortKey) => (k === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-bg-card-border bg-bg-card rounded-2xl p-5"
    >
      {/* Cabeçalho + seletor de dimensão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg uppercase tracking-wide">
          <Link2 className="w-4 h-4 text-in-green" /> UTM × Prioridade
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-fg-subtle hidden sm:inline">Dimensão:</span>
            <div className="inline-flex items-center rounded-lg border border-bg-card-border bg-bg-base p-0.5">
              {DIMS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDim(d.id)}
                  className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    dim === d.id ? 'bg-in-green text-black' : 'text-fg-muted hover:text-fg')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-fg-subtle hidden lg:inline">Top 20 por volume · clique no header pra ordenar</span>
        </div>
      </div>

      {loading && !resp ? (
        <div className="py-10 text-center text-fg-subtle text-sm">Carregando…</div>
      ) : error && !resp ? (
        <div className="py-10 text-center text-fg-subtle text-sm">Sem dados de UTM disponíveis no momento.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-bg-card-border">
                  <th
                    onClick={() => onSort('nome')}
                    className="px-3 py-2.5 text-left font-medium text-fg-subtle whitespace-nowrap cursor-pointer select-none hover:text-fg uppercase"
                  >
                    {dim} <span className="text-in-green">{arrow('nome')}</span>
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => onSort(c.key)}
                      className="px-3 py-2.5 text-right font-medium text-fg-subtle whitespace-nowrap cursor-pointer select-none hover:text-fg"
                    >
                      {c.label} <span className="text-in-green">{arrow(c.key)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.nome} className="border-b border-bg-card-border/50 hover:bg-bg-card-hover">
                    <td className="px-3 py-2.5 text-left text-in-green font-medium max-w-[280px] truncate" title={r.nome}>{r.nome}</td>
                    <td className="px-3 py-2.5 text-right text-fg font-semibold tabular-nums">{r.total}</td>
                    <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">{r.p1}</td>
                    <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">{r.p2}</td>
                    <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">{r.p3}</td>
                    <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">{r.p4}</td>
                    <td className="px-3 py-2.5 text-right text-fg-muted tabular-nums">{r.desq}</td>
                    <td className="px-3 py-2.5 text-right text-in-green font-semibold tabular-nums">{r.pMQL}%</td>
                    <td className="px-3 py-2.5 text-right text-red-500 tabular-nums">{r.pDESQ}%</td>
                  </tr>
                ))}
                {!sorted.length && (
                  <tr><td colSpan={COLS.length + 1} className="px-3 py-8 text-center text-fg-subtle">Sem registros no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {(resp?.melhor || resp?.pior) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 mt-4 pt-3 border-t border-bg-card-border text-xs">
              {resp?.melhor && (
                <span className="flex items-center gap-1.5 text-fg-muted">
                  <CircleDot className="w-3.5 h-3.5 text-in-green" /> Melhor qualidade:
                  <span className="text-fg font-medium">{resp.melhor.nome}</span>
                  <span className="text-fg-subtle">({resp.melhor.pMQL}% MQL, {resp.melhor.total} leads)</span>
                </span>
              )}
              {resp?.pior && (
                <span className="flex items-center gap-1.5 text-fg-muted">
                  <CircleDot className="w-3.5 h-3.5 text-red-500" /> Pior:
                  <span className="text-fg font-medium">{resp.pior.nome}</span>
                  <span className="text-fg-subtle">({resp.pior.pMQL}% MQL, {resp.pior.total} leads)</span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
