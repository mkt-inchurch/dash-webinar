import { FC, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ShieldCheck, XCircle } from 'lucide-react';
import { Checagem, piorNivel } from '../lib/auditoria';
import { cn } from '../lib/utils';

/**
 * Selo de integridade dos dados.
 *
 * Fechado, é uma linha só: "dados conferidos" em verde, ou o número de problemas.
 * Aberto, lista cada checagem com o que foi verificado e o que fazer quando falha.
 *
 * A ideia é que ninguém mais precise pedir uma auditoria manual para confiar na
 * tela: as mesmas contas que a conferência fazia (série × total, relações que não
 * podem se inverter, dinheiro contado duas vezes, dinheiro fora do painel) rodam a
 * cada carregamento, sobre os dados que já estão em memória.
 */

const ICONE = {
  ok: CheckCircle2,
  aviso: AlertTriangle,
  erro: XCircle,
} as const;

const COR = {
  ok: 'text-in-green-text',
  aviso: 'text-amber-600',
  erro: 'text-red-600',
} as const;

interface Props {
  checagens: Checagem[];
  /** Momento (epoch ms) da última leitura bem-sucedida das fontes. */
  atualizadoEm?: number | null;
  className?: string;
}

export const AuditoriaPanel: FC<Props> = ({ checagens, atualizadoEm, className }) => {
  const nivel = piorNivel(checagens);
  const [aberto, setAberto] = useState(nivel === 'erro'); // problema já abre aberto

  const erros = checagens.filter((c) => c.nivel === 'erro');
  const avisos = checagens.filter((c) => c.nivel === 'aviso');
  const Icon = ICONE[nivel];

  const resumo =
    nivel === 'ok'
      ? `Dados conferidos · ${checagens.length} checagens`
      : nivel === 'aviso'
        ? `${avisos.length} ponto(s) de atenção`
        : `${erros.length} problema(s) nos dados`;

  const borda =
    nivel === 'ok' ? 'border-in-green/35 bg-in-green/[0.07]'
      : nivel === 'aviso' ? 'border-amber-500/40 bg-amber-500/[0.08]'
        : 'border-red-500/40 bg-red-500/[0.07]';

  return (
    <div className={cn('rounded-xl border', borda, className)}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
      >
        <ShieldCheck className={cn('w-4 h-4 shrink-0', COR[nivel])} />
        <span className={cn('text-sm font-semibold', COR[nivel])}>{resumo}</span>
        {atualizadoEm && (
          <span className="text-xs text-fg-subtle hidden sm:inline">· {haQuantoTempo(atualizadoEm)}</span>
        )}
        <ChevronDown className={cn('w-4 h-4 ml-auto shrink-0 text-fg-subtle transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <ul className="px-4 pb-4 space-y-2.5 border-t border-black/[0.06] pt-3">
          {[...erros, ...avisos, ...checagens.filter((c) => c.nivel === 'ok')].map((c) => {
            const I = ICONE[c.nivel];
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                <I className={cn('w-4 h-4 shrink-0 mt-0.5', COR[c.nivel])} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{c.titulo}</p>
                  <p className="text-xs text-fg-muted leading-relaxed">{c.detalhe}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/** "há 2 min" / "há 1 h". Sem biblioteca de data — é uma frase só. */
export function haQuantoTempo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'atualizado agora';
  const min = Math.round(s / 60);
  if (min < 60) return `atualizado há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `atualizado há ${h} h`;
  return `atualizado há ${Math.round(h / 24)} d`;
}
