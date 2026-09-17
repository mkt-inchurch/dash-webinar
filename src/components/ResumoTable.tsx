import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { DashboardData } from '../types';
import { formatCurrency, formatNumber, formatPercent, cn } from '../lib/utils';

// Tabela-resumo da edição: as métricas de mídia e de funil numa lista só, na ordem
// em que o time lê o resultado de um webinar (o que foi gasto → o que isso comprou
// de atenção → o que virou gente no funil).
//
// POR QUE EXISTE, se os mesmos números já estão nos cards: o relatório da edição é
// escrito fora do painel. Com os cards espalhados em duas seções, copiar 14 números
// significa 14 idas e vindas — e é aí que os valores chegam errados no documento. O
// botão "Copiar" entrega a tabela inteira em TSV, pronta para colar no Sheets.
//
// Só DUAS métricas aqui não saem prontas de nenhuma API: CPL real (investimento ÷
// inscritos ADS, calculado em dateFilter.ts) e C-MQL (investimento ÷ MQL), abaixo.
// Todo o resto é o mesmo objeto `data` já filtrado que alimenta os cards — se um
// número divergir do card, o bug é do filtro, não desta tela.

interface ResumoTableProps {
  data: DashboardData;
  /** "Webinar IA 14/09" — vai no cabeçalho e no texto copiado. */
  edicaoLabel: string;
  /** "período completo" ou "01/09 a 14/09". */
  periodoLabel: string;
  /** Edições que qualificam no próprio formulário não têm etapa de pesquisa. */
  temPesquisas?: boolean;
}

interface Linha {
  label: string;
  valor: string;
  /** Contexto curto à direita: a conta, a base do percentual ou a quebra. */
  leitura?: string;
  /** Explicação longa (title), para quem passa o mouse. */
  ajuda?: string;
  /** Marca o número que NÃO acompanha o filtro de data. */
  foraDoRecorte?: boolean;
  /** Linhas de destaque (o que o time cobra): fundo e peso maiores. */
  destaque?: boolean;
}

const th = 'px-3 py-2 text-left font-medium text-fg-subtle whitespace-nowrap';
const td = 'px-3 py-2.5 text-fg whitespace-nowrap';

export const ResumoTable: FC<ResumoTableProps> = ({ data, edicaoLabel, periodoLabel, temPesquisas = true }) => {
  const [estado, setEstado] = useState<'parado' | 'copiado' | 'erro'>('parado');

  const investimento = data.investimentoTrafego ?? 0;
  const inscritos = data.inscritos ?? 0;
  const inscritosAds = data.inscritosAds ?? 0;
  const mql = data.icps ?? 0;
  const icp = data.icp;

  // C-MQL: custo por MQL. É a única métrica desta tela que não existe em nenhuma
  // API — investimento ÷ MQL. Zero quando não há MQL: dividir por zero mostraria
  // "R$ ∞" numa edição que ainda não teve pesquisa respondida.
  const cMql = mql > 0 ? investimento / mql : 0;

  // Percentual sobre os inscritos, a mesma base dos rodapés dos cards do funil.
  const sobreInscritos = (v: number) => (inscritos > 0 ? `${formatPercent(v / inscritos)} dos inscritos` : undefined);

  const quebraIcp = icp
    ? `P1 ${formatNumber(icp.p1)} · P2 ${formatNumber(icp.p2)} · P3 ${formatNumber(icp.p3)} · P4 ${formatNumber(icp.p4)}`
    : undefined;

  const linhas: Linha[] = [
    {
      label: 'Investimento',
      valor: formatCurrency(investimento),
      leitura: 'Meta Ads, no período',
      ajuda: 'Soma da série diária das campanhas que casam com o filtro desta edição.',
    },
    {
      label: 'Alcance',
      valor: formatNumber(data.alcance ?? 0),
      leitura: data.alcanceDedup === false ? 'soma por campanha (aprox.)' : 'contas únicas (Meta)',
      ajuda: 'Contas únicas impactadas. A Meta deduplica no nível da conta; quando essa consulta falha, o valor vira a soma do alcance de cada campanha e conta duas vezes quem viu mais de uma.',
      foraDoRecorte: data.alcanceNoPeriodo === false,
    },
    {
      label: 'Impressões',
      valor: formatNumber(data.impressoes ?? 0),
      leitura: 'exibições dos anúncios',
    },
    {
      label: 'Frequência',
      valor: (data.frequencia ?? 0).toFixed(2),
      leitura: 'impressões ÷ alcance',
      ajuda: 'Quantas vezes, em média, cada pessoa viu o anúncio. Acima de 4 o público satura.',
      foraDoRecorte: data.alcanceNoPeriodo === false,
    },
    {
      label: 'CPM',
      valor: formatCurrency(data.cpm ?? 0),
      leitura: 'por mil impressões',
    },
    {
      label: 'CTR (link)',
      valor: formatPercent(data.ctrLink ?? 0),
      leitura: 'cliques no link ÷ impressões',
      ajuda: 'Só o clique que leva à página — não conta curtida, comentário nem expansão do anúncio.',
    },
    {
      label: 'CPC (link)',
      valor: formatCurrency(data.cpc ?? 0),
      leitura: 'por clique no link',
    },
    {
      label: 'Leads captados',
      valor: formatNumber(inscritos),
      leitura: inscritos > 0 ? `${formatNumber(inscritosAds)} de anúncio (${formatPercent(inscritosAds / inscritos)})` : undefined,
      ajuda: 'Inscritos únicos por e-mail na planilha da edição, orgânico + pago. O recorte de anúncio ao lado é o que entra na conta do CPL real.',
      destaque: true,
    },
    {
      label: 'CPL real',
      valor: formatCurrency(data.cplReal ?? 0),
      leitura: 'investimento ÷ inscritos ADS',
      ajuda: 'Custo do inscrito que realmente entrou na planilha. Não usa o evento do pixel, que na conta da inChurch é global e infla o número de leads.',
      destaque: true,
    },
    {
      label: 'MQL (P1–P4)',
      valor: formatNumber(mql),
      leitura: quebraIcp ?? sobreInscritos(mql),
      ajuda: 'Respondentes da pesquisa classificados nas prioridades P1 a P4 (perfil de cliente ideal). A classificação é manual, na coluna "Filtro de Leads" da planilha.',
      destaque: true,
    },
    {
      label: 'C-MQL',
      valor: formatCurrency(cMql),
      leitura: 'investimento ÷ MQL',
      ajuda: 'Custo por MQL. Considera o investimento inteiro da edição, inclusive o que trouxe inscritos que não responderam a pesquisa.',
      destaque: true,
    },
    {
      label: 'Entradas nos grupos',
      valor: formatNumber(data.entradasGrupo ?? 0),
      leitura: sobreInscritos(data.entradasGrupo ?? 0),
      ajuda: 'Entradas no(s) grupo(s) de WhatsApp da edição, do snapshot horário do Sendflow.',
    },
    ...(temPesquisas
      ? [{
          label: 'Pesquisa',
          valor: formatNumber(data.pesquisas ?? 0),
          leitura: sobreInscritos(data.pesquisas ?? 0),
          ajuda: 'Respostas únicas da pesquisa de qualificação atribuídas a esta edição.',
        } as Linha]
      : []),
    {
      label: 'Levantadas de mão',
      valor: formatNumber(data.diagnosticos ?? 0),
      leitura: sobreInscritos(data.diagnosticos ?? 0),
      ajuda: 'Formulário pós-webinar em que a pessoa diz como pretende prosseguir para a contratação — é o que o painel chama de "Diagnósticos" nos cards e nos gráficos.',
      destaque: true,
    },
  ];

  const copiar = async () => {
    // TSV: colado no Sheets cai uma métrica por linha, valor na coluna B. Os números
    // vão formatados em pt-BR de propósito — o destino é relatório, não recálculo.
    const texto = [
      `Resumo — ${edicaoLabel} (${periodoLabel})`,
      ...linhas.map((l) => `${l.label}\t${l.valor}${l.foraDoRecorte ? '\t(período total da edição)' : ''}`),
    ].join('\n');

    // Dois caminhos porque o primeiro nem sempre existe: a Clipboard API depende de
    // permissão do navegador e é negada em webviews e em página servida por http.
    // O execCommand está obsoleto, mas é o que ainda funciona nesses casos — e um
    // botão de copiar que não copia é pior do que não ter botão.
    let ok = false;
    try {
      await navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* sem clipboard nenhum: o botão avisa em vez de fingir que copiou */ }
    }

    setEstado(ok ? 'copiado' : 'erro');
    setTimeout(() => setEstado('parado'), ok ? 2500 : 5000);
  };

  const temForaDoRecorte = linhas.some((l) => l.foraDoRecorte);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border border-bg-card-border bg-bg-card rounded-2xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-fg">
          {edicaoLabel}
          <span className="ml-2 font-normal text-fg-subtle">· {periodoLabel}</span>
        </h3>
        <button
          onClick={copiar}
          className={cn(
            'self-start sm:self-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            estado === 'erro'
              ? 'border-amber-500/40 text-amber-600'
              : 'border-bg-card-border text-fg-subtle hover:text-fg hover:border-in-green/50'
          )}
          title={
            estado === 'erro'
              ? 'O navegador bloqueou o acesso à área de transferência nesta página. Selecione a tabela e copie com Cmd+C.'
              : 'Copia a tabela inteira em TSV, pronta para colar no Sheets ou no relatório'
          }
        >
          {estado === 'copiado' ? <Check className="w-3.5 h-3.5 text-in-green-text" /> : <Copy className="w-3.5 h-3.5" />}
          {estado === 'copiado' ? 'Copiado' : estado === 'erro' ? 'Copie com Cmd+C' : 'Copiar tabela'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-bg-card-border">
              <th className={th}>Métrica</th>
              <th className={th + ' text-right'}>Valor</th>
              <th className={cn(th, 'text-right hidden sm:table-cell')}>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.label}
                className={cn(
                  'border-b border-bg-card-border/50',
                  l.destaque && 'bg-bg-card-hover/40'
                )}
              >
                <td className={cn(td, 'text-left', l.destaque && 'font-semibold')} title={l.ajuda}>
                  {l.label}
                </td>
                <td className={cn(td, 'text-right tabular-nums', l.destaque ? 'font-semibold text-in-green-text' : 'font-medium')}>
                  {l.valor}
                  {l.foraDoRecorte && (
                    <span
                      className="ml-1 text-amber-600"
                      title="Número do período total da edição: o alcance da Meta é deduplicado por pessoa e não pode ser somado dia a dia."
                    >
                      *
                    </span>
                  )}
                </td>
                <td className={cn(td, 'text-right text-xs text-fg-subtle hidden sm:table-cell')}>
                  {l.leitura ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {temForaDoRecorte && (
        <p className="text-xs text-fg-subtle mt-4 pt-3 border-t border-bg-card-border">
          <span className="text-amber-600 font-medium">*</span> Alcance e frequência são do período total
          desta edição, não do recorte de data selecionado — o alcance da Meta é deduplicado por pessoa e
          somá-lo dia a dia contaria de novo quem voltou.
        </p>
      )}
    </motion.div>
  );
};
