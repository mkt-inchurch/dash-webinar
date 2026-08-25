import { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowDown, ArrowUp, Minus, Repeat2, Trophy } from 'lucide-react';
import { LinhaComparacao } from '../hooks/useDashboardData';
import { SECTIONS, variacao, shortLabel } from '../lib/metricas';
import { cn } from '../lib/utils';

/**
 * DUELO — escolha duas edições e compare.
 *
 * A tabela geral (todas as edições em colunas) responde "como estamos ao longo do
 * tempo"; ela é ruim para a pergunta que mais se faz na prática, que é "a turma
 * desta semana foi melhor que a da semana passada, e em quê?". Com 11 colunas, ler
 * duas delas exige rolagem horizontal e comparação de cabeça.
 *
 * Aqui as duas edições escolhidas ficam lado a lado, com a variação de B em relação
 * a A já calculada e colorida pelo que é BOM em cada métrica (mais inscritos é bom,
 * mais CPA não é). O placar do topo conta quantas métricas cada lado venceu.
 */

// Métricas que entram no placar. Ficam de fora as sem lado bom (`better: 'none'`,
// como investimento e frequência) — vencer em "gastou mais" não quer dizer nada.
const METRICAS = SECTIONS.flatMap((s) => s.metrics.map((m) => ({ ...m, secao: s.title })));

interface Props {
  rows: LinhaComparacao[];
  /** Edição aberta no Painel — vira o lado B por padrão. */
  edicaoAtual?: string;
}

export const EditionDuel: FC<Props> = ({ rows, edicaoAtual }) => {
  const [idA, setIdA] = useState<string>('');
  const [idB, setIdB] = useState<string>('');

  // Padrão: a edição que a pessoa estava vendo no Painel (lado B) contra a
  // anterior a ela na lista (lado A). É a comparação que se faz na prática — "a
  // turma desta semana rendeu mais que a passada?". Pegar simplesmente as duas
  // primeiras linhas não serve: a lista começa pela Calculadora de Líderes, que
  // não é webinar, e o duelo abria comparando coisas de naturezas diferentes.
  useEffect(() => {
    if (!rows.length) return;
    const existe = (v: string) => rows.some((r) => r.id === v);
    const alvo = edicaoAtual && existe(edicaoAtual) ? edicaoAtual : rows[0].id;
    const i = rows.findIndex((r) => r.id === alvo);
    const anterior = rows[i + 1] ?? rows[i - 1] ?? rows[i];
    setIdB((v) => (v && existe(v) ? v : alvo));
    setIdA((v) => (v && existe(v) ? v : anterior.id));
  }, [rows, edicaoAtual]);

  const A = rows.find((r) => r.id === idA);
  const B = rows.find((r) => r.id === idB);

  const placar = useMemo(() => {
    if (!A || !B) return { a: 0, b: 0, empate: 0 };
    let a = 0, b = 0, empate = 0;
    for (const m of METRICAS) {
      if (m.better === 'none') continue;
      const va = m.get(A.data), vb = m.get(B.data);
      if (!(va > 0) || !(vb > 0)) continue; // sem dado dos dois lados não há duelo
      if (va === vb) { empate++; continue; }
      const bVence = m.better === 'higher' ? vb > va : vb < va;
      if (bVence) b++; else a++;
    }
    return { a, b, empate };
  }, [A, B]);

  if (!A || !B) return null;

  const mesma = idA === idB;
  const trocar = () => { setIdA(idB); setIdB(idA); };

  const Seletor: FC<{ value: string; onChange: (v: string) => void; label: string }> = ({ value, onChange, label }) => (
    <label className="flex-1 min-w-0">
      <span className="block text-[11px] uppercase tracking-[2.2px] text-fg-subtle mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-bg-base border border-bg-card-border rounded-lg px-3 py-2.5 text-sm font-medium text-fg
                   hover:bg-bg-card-hover focus:outline-none focus:border-in-green cursor-pointer"
      >
        {rows.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="border border-bg-card-border bg-bg-card rounded-2xl overflow-hidden"
      aria-label="Duelo entre duas edições"
    >
      {/* Cabeçalho: seleção + placar */}
      <div className="p-5 border-b border-bg-card-border">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-base text-fg"><strong>Comparar duas edições</strong></h3>
          <span className="text-xs text-fg-subtle">Período completo de cada uma</span>
        </div>

        <div className="flex items-end gap-3">
          <Seletor value={idA} onChange={setIdA} label="Edição A" />
          <button
            type="button"
            onClick={trocar}
            title="Inverter A e B"
            aria-label="Inverter as duas edições"
            className="shrink-0 w-10 h-10 mb-0.5 flex items-center justify-center rounded-lg border border-bg-card-border
                       bg-bg-base text-fg-muted hover:bg-bg-card-hover hover:text-fg transition-colors"
          >
            <Repeat2 className="w-4 h-4" />
          </button>
          <Seletor value={idB} onChange={setIdB} label="Edição B" />
        </div>

        {mesma ? (
          <p className="mt-4 text-sm text-fg-muted">Escolha duas edições diferentes para ver a comparação.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Placar nome={shortLabel(A.label)} pontos={placar.a} vencedor={placar.a > placar.b} />
            <span className="text-fg-faint">×</span>
            <Placar nome={shortLabel(B.label)} pontos={placar.b} vencedor={placar.b > placar.a} />
            <span className="text-xs text-fg-subtle ml-1">
              métricas vencidas{placar.empate ? ` · ${placar.empate} empate(s)` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Fontes indisponíveis em um dos lados: sem este aviso, a coluna zerada
          passa por "essa edição foi mal" em vez de "esse dado não carregou". */}
      {!mesma && [A, B].some((e) => e.unavailable.length > 0) && (
        <p className="px-5 py-2.5 text-xs text-fg-muted bg-bg-card-hover border-b border-bg-card-border">
          Atenção: {[A, B].filter((e) => e.unavailable.length).map((e) => `${shortLabel(e.label)} está sem ${e.unavailable.join(', ')}`).join(' e ')}.
          As linhas dessas fontes aparecem zeradas.
        </p>
      )}

      {!mesma && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-card-border">
                <th className="px-5 py-3 text-left font-medium text-fg-subtle whitespace-nowrap">Métrica</th>
                <th className="px-3 py-3 text-right font-semibold text-fg whitespace-nowrap">{shortLabel(A.label)}</th>
                <th className="px-3 py-3 text-center font-medium text-fg-subtle whitespace-nowrap w-px">
                  <ArrowRight className="w-3.5 h-3.5 inline" aria-label="varia para" />
                </th>
                <th className="px-5 py-3 text-right font-semibold text-fg whitespace-nowrap">{shortLabel(B.label)}</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((secao) => (
                <Fragment key={secao.title}>
                  <tr className="bg-bg-card-hover">
                    <td colSpan={4} className="px-5 py-2 text-[11px] uppercase tracking-[2.2px] text-fg-subtle">
                      {secao.title}
                    </td>
                  </tr>
                  {secao.metrics.map((m) => {
                    const va = m.get(A.data);
                    const vb = m.get(B.data);
                    const v = variacao(va, vb, m.better);
                    const venceA = m.better !== 'none' && va > 0 && vb > 0 && va !== vb && (m.better === 'higher' ? va > vb : va < vb);
                    const venceB = m.better !== 'none' && va > 0 && vb > 0 && va !== vb && !venceA;
                    return (
                      <tr key={m.key} className="border-b border-bg-card-border/60 hover:bg-bg-card-hover">
                        <td className="px-5 py-2.5 text-left text-fg-muted whitespace-nowrap" title={m.ajuda}>
                          {m.label}
                        </td>
                        <td className={cn('px-3 py-2.5 text-right tabular whitespace-nowrap', venceA ? 'text-in-green-text font-semibold' : 'text-fg')}>
                          {venceA && <Trophy className="w-3 h-3 inline mr-1 -mt-0.5" aria-label="melhor" />}
                          {m.fmt(va)}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap"><Delta v={v} /></td>
                        <td className={cn('px-5 py-2.5 text-right tabular whitespace-nowrap', venceB ? 'text-in-green-text font-semibold' : 'text-fg')}>
                          {venceB && <Trophy className="w-3 h-3 inline mr-1 -mt-0.5" aria-label="melhor" />}
                          {m.fmt(vb)}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-5 py-3.5 text-xs text-fg-subtle">
        A seta mostra a variação de <strong className="font-semibold">{shortLabel(B.label)}</strong> em relação a{' '}
        <strong className="font-semibold">{shortLabel(A.label)}</strong>, colorida pelo que é bom em cada métrica
        (mais inscritos é bom; mais CPA, não). Linhas sem dado nos dois lados não entram no placar.
      </p>
    </motion.section>
  );
};

const Placar: FC<{ nome: string; pontos: number; vencedor: boolean }> = ({ nome, pontos, vencedor }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border',
      vencedor ? 'bg-in-green/15 border-in-green/40 text-in-green-text' : 'bg-bg-base border-bg-card-border text-fg-muted'
    )}
  >
    {vencedor && <Trophy className="w-3.5 h-3.5" />}
    {nome}
    <span className="tabular text-sm">{pontos}</span>
  </span>
);

const Delta: FC<{ v: { pct: number; bom: boolean | null } | null }> = ({ v }) => {
  if (!v) return <span className="text-fg-faint text-xs">—</span>;
  if (v.bom === null && Math.abs(v.pct) < 0.005) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-fg-subtle tabular">
        <Minus className="w-3 h-3" /> 0%
      </span>
    );
  }
  const sobe = v.pct > 0;
  const Icon = sobe ? ArrowUp : ArrowDown;
  const cor = v.bom === null ? 'text-fg-muted' : v.bom ? 'text-in-green-text' : 'text-red-600';
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold tabular', cor)}>
      <Icon className="w-3 h-3" />
      {`${sobe ? '+' : ''}${(v.pct * 100).toFixed(0)}%`}
    </span>
  );
};
