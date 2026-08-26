import { FC } from 'react';
import { Calendar } from 'lucide-react';
import { DateRange, isFullRange, hojeISO } from '../lib/dateFilter';

interface DateFilterProps {
  range: DateRange;
  full: DateRange;
  /**
   * Janela em que a edição teve inscrição ou mídia. É ela que decide se um preset
   * faz sentido — `full` inclui a cauda de saídas do grupo e de respostas tardias
   * de pesquisa, que em algumas edições encerradas chega até HOJE e fazia "Hoje"
   * parecer clicável numa turma que fechou semanas atrás.
   */
  atividade?: DateRange | null;
  onChange: (r: DateRange) => void;
}

// Soma dias a uma data ISO (YYYY-MM-DD), sem fuso.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const inputCls =
  'bg-bg-base border border-bg-card-border rounded-lg px-3 py-1.5 text-sm text-fg ' +
  'focus:outline-none focus:border-in-green';

export const DateFilter: FC<DateFilterProps> = ({ range, full, atividade, onChange }) => {
  // Presets ancorados em HOJE DE VERDADE.
  //
  // Antes eles eram calculados a partir de `full.end`, o fim da série da edição.
  // Numa edição encerrada isso é uma data qualquer no passado: "Hoje" na edição de
  // 13/07 selecionava 13/08 (o dia de uma única entrada solta no grupo) e o painel
  // inteiro zerava, sem aviso nenhum, como se os dados tivessem sumido. O mesmo
  // valia para 15/06 ("Hoje" = 23/06) e 20/07 ("Hoje" = 03/08).
  //
  // Agora "Hoje" é hoje. Quando o intervalo do preset não alcança o período da
  // edição, o botão fica DESABILITADO com a explicação no title — em vez de
  // selecionar um recorte vazio e deixar o leitor concluir que o número é zero.
  const hoje = hojeISO();
  const janela = (dias: number): DateRange => ({ start: addDays(hoje, -(dias - 1)), end: hoje });
  const ontem = addDays(hoje, -1);
  const brDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  const presets: { label: string; range: DateRange; sempre?: boolean }[] = [
    { label: 'Hoje', range: { start: hoje, end: hoje } },
    { label: 'Ontem', range: { start: ontem, end: ontem } },
    { label: '7 dias', range: janela(7) },
    { label: '14 dias', range: janela(14) },
    { label: 'Todo período', range: full, sempre: true },
  ];

  // O preset alcança dias em que a edição teve inscrição ou investimento? (senão,
  // selecioná-lo zera a tela toda). Calculado ANTES do corte abaixo — depois de
  // cortado todo intervalo cabe dentro da edição e "Hoje" voltaria a parecer válido
  // numa edição encerrada.
  //
  // O teste é contra `atividade`, não contra `full`: na Trilha 17/08 o `full` ia até
  // hoje só porque a planilha de pesquisa ainda recebe resposta com o token genérico
  // da Trilha, e isso deixava "Hoje"/"Ontem" habilitados numa turma encerrada em
  // 17/08 — clicar zerava todos os cards de captação sem explicar por quê.
  const vivo = atividade ?? full;
  const alcanca = (r: DateRange) => r.end >= vivo.start && r.start <= vivo.end;

  // Corta o preset no período da edição, para os campos de data não exibirem um
  // limite que não existe ("14 dias" numa edição encerrada em 13/08 mostrava
  // 08/08 a 21/08, uma semana além do fim da captação).
  const cortar = (r: DateRange): DateRange => ({
    start: r.start < full.start ? full.start : r.start,
    end: r.end > full.end ? full.end : r.end,
  });

  const eq = (a: DateRange, b: DateRange) => a.start === b.start && a.end === b.end;
  const aplicado = (p: { range: DateRange; sempre?: boolean }) => (p.sempre ? p.range : cortar(p.range));
  const custom = !presets.some((p) => eq(aplicado(p), range));
  // Numa edição em andamento, "14 dias" cortado pode dar exatamente o período todo —
  // e os dois botões acendiam juntos, como se houvesse dois filtros ativos. Quando o
  // recorte é o período inteiro, quem representa isso é "Todo período".
  const noTotal = isFullRange(range, full);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const active = p.sempre ? noTotal : !noTotal && eq(aplicado(p), range);
          const off = !p.sempre && !alcanca(p.range);
          return (
            <button
              key={p.label}
              onClick={() => !off && onChange(aplicado(p))}
              disabled={off}
              title={
                off
                  ? `A captação desta edição vai de ${brDate(vivo.start)} a ${brDate(vivo.end)} — não houve inscrição nem investimento em "${p.label.toLowerCase()}".`
                  : undefined
              }
              className={
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
                (off
                  ? 'bg-bg-card border border-bg-card-border text-fg-faint cursor-not-allowed opacity-50'
                  : active
                    ? 'bg-in-green text-[#1A1A1A]'
                    : 'bg-bg-card border border-bg-card-border text-fg-muted hover:bg-bg-card-hover')
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-fg-muted">
          <Calendar className={'w-4 h-4 ' + (custom ? 'text-in-green-text' : 'text-fg-subtle')} />
          <span className="text-sm font-medium hidden sm:inline">Personalizado</span>
        </div>
        <input
          type="date"
          value={range.start}
          min={full.start}
          max={range.end < full.end ? range.end : full.end}
          onChange={(e) => onChange({ ...range, start: e.target.value })}
          className={inputCls}
        />
        <span className="text-fg-subtle text-sm">até</span>
        <input
          type="date"
          value={range.end}
          min={range.start}
          max={full.end}
          onChange={(e) => onChange({ ...range, end: e.target.value })}
          className={inputCls}
        />
      </div>
    </div>
  );
};
