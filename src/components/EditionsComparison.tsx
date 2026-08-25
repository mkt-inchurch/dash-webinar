import { FC, Fragment, ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEditionsComparison } from '../hooks/useDashboardData';
import { CHART } from '../lib/theme';
import { formatCompact, cn } from '../lib/utils';
import { SECTIONS, CHARTS, shortLabel, bestIndex } from '../lib/metricas';
import { auditarComparacao } from '../lib/auditoria';
import { AuditoriaPanel } from './AuditoriaPanel';
import { EditionDuel } from './EditionDuel';

// A coluna de métricas fica fixa e só as edições rolam na horizontal — com 11
// edições, o nome da métrica saía da tela e não dava para saber que linha era qual.
// Cada célula dessa coluna precisa de fundo OPACO (senão os números passam por
// baixo) e o divisor vai como box-shadow: com `border-collapse`, a borda lateral de
// uma célula sticky não acompanha a rolagem.
const STICKY_COL = 'sticky left-0 z-10 shadow-[1px_0_0_0_var(--color-bg-card-border)]';

const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border border-bg-card-border bg-bg-card rounded-2xl p-5">
    <h3 className="text-sm font-semibold text-fg mb-4">{title}</h3>
    <div className="w-full h-[210px]">
      <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
    </div>
  </div>
);

export const EditionsComparison: FC<{ edicaoAtual?: string }> = ({ edicaoAtual }) => {
  const { rows, cobertura, loading, error, atualizadoEm } = useEditionsComparison();
  const p = CHART;

  // Ordem cronológica (mais antiga → mais recente) para ler da esquerda p/ direita.
  const eds = useMemo(() => [...rows].reverse(), [rows]);

  // Auditoria cruzada: as duas falhas que só aparecem olhando TODAS as edições de
  // uma vez — o mesmo dia de mídia contado em duas, e mídia de webinar que não caiu
  // em edição nenhuma.
  const checagens = useMemo(
    () => (rows.length ? auditarComparacao(rows, cobertura) : []),
    [rows, cobertura]
  );

  if (loading && !eds.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-bg-card-border border-t-in-green" />
          <p className="text-fg-muted text-sm animate-pulse">Carregando edições…</p>
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
      {/* Integridade dos dados de TODAS as edições */}
      {checagens.length > 0 && <AuditoriaPanel checagens={checagens} atualizadoEm={atualizadoEm} />}

      {/* Duelo: escolha duas edições e compare */}
      <EditionDuel rows={rows} edicaoAtual={edicaoAtual} />

      {/* Gráficos de destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CHARTS.map((c) => {
          const data = eds.map((e) => ({ name: shortLabel(e.label), value: c.get(e.data) }));
          return (
            <Card key={c.key} title={c.label}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.grid} vertical={false} />
                {/* interval={0} força TODAS as edições no eixo: no padrão o recharts
                    descartava 7 dos 9 rótulos e não dava para saber qual barra era qual. */}
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ ...AXIS, fontSize: 9 }}
                  interval={0}
                  angle={-40}
                  textAnchor="end"
                  height={44}
                />
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
        <h3 className="text-sm font-semibold text-fg mb-4">Comparativo por métrica — todas as edições</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-bg-card-border">
                <th className={cn(STICKY_COL, 'bg-bg-card px-3 py-2.5 text-left font-medium text-fg-subtle whitespace-nowrap')}>
                  Métrica
                </th>
                {eds.map((e) => (
                  <th key={e.id} className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="inline-flex items-center rounded-lg bg-in-green/15 border border-in-green/30 text-in-green-text px-2.5 py-1 text-xs font-semibold">
                      {e.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => (
                <Fragment key={section.title}>
                  {/* Fundo opaco (era `/40`) para a célula fixa do título casar com
                      o resto da linha em vez de virar um retângulo mais claro. */}
                  <tr className="bg-bg-card-hover">
                    <td className={cn(STICKY_COL, 'bg-bg-card-hover px-3 py-2 text-[11px] uppercase tracking-[2.2px] text-fg-subtle whitespace-nowrap')}>
                      {section.title}
                    </td>
                    <td colSpan={eds.length} />
                  </tr>
                  {section.metrics.map((m) => {
                    const values = eds.map((e) => m.get(e.data));
                    const best = bestIndex(values, m.better);
                    return (
                      <tr key={m.key} className="group border-b border-bg-card-border/60 hover:bg-bg-card-hover">
                        {/* `group-hover` porque o fundo opaco da coluna fixa cobre o
                            hover da linha — sem isso só o resto da linha acendia. */}
                        <td
                          title={m.ajuda}
                          className={cn(STICKY_COL, 'bg-bg-card group-hover:bg-bg-card-hover px-3 py-2.5 text-left text-fg-muted whitespace-nowrap')}
                        >
                          {m.label}
                        </td>
                        {values.map((v, i) => (
                          <td
                            key={i}
                            className={cn(
                              'px-3 py-2.5 text-right tabular whitespace-nowrap',
                              i === best ? 'text-in-green-text font-semibold' : 'text-fg'
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
