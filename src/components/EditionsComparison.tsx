import { FC, Fragment, ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DashboardData } from '../types';
import { useEditionsComparison } from '../hooks/useDashboardData';
import { useTheme, chartPalette } from '../lib/theme';
import { formatCurrency, formatNumber, formatCompact, formatPercent, cn } from '../lib/utils';

type Better = 'higher' | 'lower' | 'none';
interface Metric {
  key: string;
  label: string;
  get: (d: DashboardData) => number;
  fmt: (v: number) => string;
  better: Better;
}

const pct = (v: number) => formatPercent(v ?? 0);
const freq = (v: number) => (v ?? 0).toFixed(2);

// Métrica → como ler/formatar/comparar. `better` define qual valor é destacado.
const SECTIONS: { title: string; metrics: Metric[] }[] = [
  {
    title: 'Funil do Webinar',
    metrics: [
      { key: 'inscritos', label: 'Total de Inscritos', get: (d) => d.inscritos ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'inscritosAds', label: 'Inscritos ADS', get: (d) => d.inscritosAds ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'entradasGrupo', label: 'Entradas no Grupo', get: (d) => d.entradasGrupo ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'pesquisas', label: 'Total de Pesquisas', get: (d) => d.pesquisas ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'icps', label: 'Total de ICPs', get: (d) => d.icps ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'diagnosticos', label: 'Diagnósticos', get: (d) => d.diagnosticos ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'cplReal', label: 'CPA / CPL (Real)', get: (d) => d.cplReal ?? 0, fmt: formatCurrency, better: 'lower' },
    ],
  },
  {
    title: 'Meta Ads',
    metrics: [
      { key: 'spend', label: 'Gasto Total', get: (d) => d.investimentoTrafego ?? 0, fmt: formatCurrency, better: 'none' },
      { key: 'leads', label: 'Conversões (Meta)', get: (d) => d.leadsMeta ?? 0, fmt: formatNumber, better: 'higher' },
      { key: 'convReal', label: 'Conversão real (ADS ÷ Meta)', get: (d) => { const m = d.leadsMeta ?? 0; return m > 0 ? (d.inscritosAds ?? 0) / m : 0; }, fmt: pct, better: 'higher' },
      { key: 'cplMeta', label: 'CPL (Meta)', get: (d) => d.cplMeta ?? 0, fmt: formatCurrency, better: 'lower' },
      { key: 'alcance', label: 'Alcance', get: (d) => d.alcance ?? 0, fmt: formatCompact, better: 'higher' },
      { key: 'impressoes', label: 'Impressões', get: (d) => d.impressoes ?? 0, fmt: formatCompact, better: 'higher' },
      { key: 'frequencia', label: 'Frequência', get: (d) => d.frequencia ?? 0, fmt: freq, better: 'none' },
      { key: 'lpv', label: 'LPV', get: (d) => d.lpv ?? 0, fmt: formatCompact, better: 'higher' },
      { key: 'ctrLink', label: 'CTR Link', get: (d) => d.ctrLink ?? 0, fmt: pct, better: 'higher' },
      { key: 'cpc', label: 'CPC', get: (d) => d.cpc ?? 0, fmt: formatCurrency, better: 'lower' },
      { key: 'cpm', label: 'CPM', get: (d) => d.cpm ?? 0, fmt: formatCurrency, better: 'lower' },
      { key: 'convPagina', label: 'Conv. Captura', get: (d) => d.convPagina ?? 0, fmt: pct, better: 'higher' },
      { key: 'connectRate', label: 'Connect Rate', get: (d) => d.connectRate ?? 0, fmt: pct, better: 'higher' },
    ],
  },
];

// Métricas em destaque como gráfico de barras no topo.
const CHARTS: { key: string; label: string; get: (d: DashboardData) => number; fmt: (v: number) => string }[] = [
  { key: 'inscritos', label: 'Inscritos', get: (d) => d.inscritos ?? 0, fmt: formatNumber },
  { key: 'spend', label: 'Investimento', get: (d) => d.investimentoTrafego ?? 0, fmt: formatCurrency },
  { key: 'cplReal', label: 'CPA / CPL Real', get: (d) => d.cplReal ?? 0, fmt: formatCurrency },
  { key: 'diagnosticos', label: 'Diagnósticos', get: (d) => d.diagnosticos ?? 0, fmt: formatNumber },
];

// "Webinar 15/06" → "15/06"
const shortLabel = (label: string) => label.replace(/^Webinar\s+/i, '');

// Índice do melhor valor da linha (ou -1). Ignora zeros.
function bestIndex(values: number[], better: Better): number {
  if (better === 'none') return -1;
  let idx = -1;
  let best = better === 'lower' ? Infinity : -Infinity;
  values.forEach((v, i) => {
    if (!(v > 0)) return; // ignora ausência de dado
    if (better === 'lower' ? v < best : v > best) { best = v; idx = i; }
  });
  return idx;
}

const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border border-bg-card-border bg-bg-card rounded-2xl p-5">
    <h3 className="text-sm font-semibold text-fg mb-4">{title}</h3>
    <div className="w-full h-[180px]">
      <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
    </div>
  </div>
);

export const EditionsComparison: FC = () => {
  const { rows, loading, error } = useEditionsComparison();
  const { theme } = useTheme();
  const p = chartPalette(theme);

  // Ordem cronológica (mais antiga → mais recente) para ler da esquerda p/ direita.
  const eds = useMemo(() => [...rows].reverse(), [rows]);

  if (loading && !eds.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-bg-card-border border-t-in-green" />
          <p className="text-fg-muted font-mono text-sm animate-pulse">Carregando edições…</p>
        </div>
      </div>
    );
  }

  if (error && !eds.length) {
    return <p className="text-center text-fg-muted py-24">{error}</p>;
  }

  const AXIS = { fill: p.axis, fontSize: 11 };
  const tip = {
    contentStyle: { backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, borderRadius: '8px', color: p.tooltipText, fontSize: 12 },
    cursor: { fill: p.cursor },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Gráficos de destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CHARTS.map((c) => {
          const data = eds.map((e) => ({ name: shortLabel(e.label), value: c.get(e.data) }));
          return (
            <Card key={c.key} title={c.label}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS} width={52} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip {...tip} formatter={(v: number) => [c.fmt(v), c.label]} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={p.green} fillOpacity={0.55 + (0.45 * (i + 1)) / data.length} />
                  ))}
                </Bar>
              </BarChart>
            </Card>
          );
        })}
      </div>

      {/* Tabela comparativa */}
      <div className="border border-bg-card-border bg-bg-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-fg mb-4">Comparativo por métrica</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-bg-card-border">
                <th className="px-3 py-2.5 text-left font-medium text-fg-subtle whitespace-nowrap">Métrica</th>
                {eds.map((e) => (
                  <th key={e.id} className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center rounded-lg bg-in-green/10 border border-in-green/25 text-in-green px-2.5 py-1 text-xs font-semibold">
                      {e.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => (
                <Fragment key={section.title}>
                  <tr className="bg-bg-card-hover/40">
                    <td colSpan={eds.length + 1} className="px-3 py-2 text-xs font-mono uppercase tracking-widest text-fg-subtle">
                      {section.title}
                    </td>
                  </tr>
                  {section.metrics.map((m) => {
                    const values = eds.map((e) => m.get(e.data));
                    const best = bestIndex(values, m.better);
                    return (
                      <tr key={m.key} className="border-b border-bg-card-border/50 hover:bg-bg-card-hover">
                        <td className="px-3 py-2.5 text-left text-fg-muted whitespace-nowrap">{m.label}</td>
                        {values.map((v, i) => (
                          <td
                            key={i}
                            className={cn(
                              'px-3 py-2.5 text-right tabular-nums whitespace-nowrap',
                              i === best ? 'text-in-green font-semibold' : 'text-fg'
                            )}
                          >
                            {m.fmt(v)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-fg-subtle mt-4">
          Valores do período completo de cada edição. Em verde, o melhor resultado por métrica (maior alcance/conversões, menor custo).
        </p>
      </div>
    </motion.div>
  );
};
