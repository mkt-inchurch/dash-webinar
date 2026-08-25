// Definição ÚNICA das métricas comparáveis entre edições.
//
// Fica separada porque duas telas leem a mesma lista: o comparativo geral (todas
// as edições, em tabela) e o duelo (duas edições lado a lado). Enquanto cada uma
// tinha a sua cópia, bastava alguém corrigir a fórmula de um lado para as duas
// telas passarem a mostrar números diferentes para a mesma métrica.
//
// `better` diz o que é bom: 'higher' destaca o maior, 'lower' o menor (custos) e
// 'none' não destaca ninguém — investimento e frequência não têm lado bom.

import { DashboardData } from '../types';
import { formatCurrency, formatNumber, formatCompact, formatPercent } from './utils';

export type Better = 'higher' | 'lower' | 'none';

export interface Metric {
  key: string;
  label: string;
  get: (d: DashboardData) => number;
  fmt: (v: number) => string;
  better: Better;
  /** Explicação do que a métrica é, exibida no duelo (title do rótulo). */
  ajuda?: string;
}

const pct = (v: number) => formatPercent(v ?? 0);
const freq = (v: number) => (v ?? 0).toFixed(2);

export const SECTIONS: { title: string; metrics: Metric[] }[] = [
  {
    title: 'Funil do Webinar',
    metrics: [
      { key: 'inscritos', label: 'Total de Inscritos', get: (d) => d.inscritos ?? 0, fmt: formatNumber, better: 'higher', ajuda: 'Pessoas únicas (por e-mail) na planilha de inscritos da edição.' },
      { key: 'inscritosAds', label: 'Inscritos ADS', get: (d) => d.inscritosAds ?? 0, fmt: formatNumber, better: 'higher', ajuda: 'Inscritos cuja UTM Source indica tráfego pago (critério inverso: tudo que não é origem orgânica conhecida).' },
      { key: 'entradasGrupo', label: 'Entradas no Grupo', get: (d) => d.entradasGrupo ?? 0, fmt: formatNumber, better: 'higher', ajuda: 'Entradas no grupo de WhatsApp, do snapshot horário do Sendflow.' },
      { key: 'pesquisas', label: 'Total de Pesquisas', get: (d) => d.pesquisas ?? 0, fmt: formatNumber, better: 'higher', ajuda: 'Respostas únicas da pesquisa de qualificação atribuídas a esta edição.' },
      { key: 'icps', label: 'Total de ICPs', get: (d) => d.icps ?? 0, fmt: formatNumber, better: 'higher', ajuda: 'Respondentes classificados como P1–P4 (perfil de cliente ideal).' },
      { key: 'diagnosticos', label: 'Diagnósticos', get: (d) => d.diagnosticos ?? 0, fmt: formatNumber, better: 'higher', ajuda: 'Pedidos de diagnóstico na janela pós-webinar desta edição.' },
      { key: 'cplReal', label: 'CPA real (por inscrito ADS)', get: (d) => d.cplReal ?? 0, fmt: formatCurrency, better: 'lower', ajuda: 'Investimento ÷ inscritos de anúncio. Sai da planilha, não do pixel — é o custo real de trazer um inscrito.' },
    ],
  },
  {
    title: 'Meta Ads',
    metrics: [
      { key: 'spend', label: 'Gasto Total', get: (d) => d.investimentoTrafego ?? 0, fmt: formatCurrency, better: 'none', ajuda: 'Soma da série diária das campanhas que casam com o filtro da edição.' },
      { key: 'convPaginaReal', label: 'Conv. Captura (real)', get: (d) => d.convPaginaReal ?? 0, fmt: pct, better: 'higher', ajuda: 'Inscritos ADS ÷ visualizações da página. É a conversão real da LP — não usa o pixel.' },
      { key: 'convPagina', label: 'Conv. Captura (pixel)', get: (d) => d.convPagina ?? 0, fmt: pct, better: 'higher', ajuda: 'Leads do pixel ÷ visualizações da página. O pixel da inChurch é global e conta formulários de outros funis, então este número vem inflado.' },
      { key: 'convReal', label: 'Inscritos ADS ÷ leads do pixel', get: (d) => { const m = d.leadsMeta ?? 0; return m > 0 ? (d.inscritosAds ?? 0) / m : 0; }, fmt: pct, better: 'higher', ajuda: 'Quanto dos "leads" que o Meta reporta virou inscrito de verdade. Quanto menor, mais o pixel está inflando.' },
      { key: 'alcance', label: 'Alcance', get: (d) => d.alcance ?? 0, fmt: formatCompact, better: 'higher', ajuda: 'Contas únicas impactadas (deduplicado pela Meta no nível da conta).' },
      { key: 'impressoes', label: 'Impressões', get: (d) => d.impressoes ?? 0, fmt: formatCompact, better: 'higher' },
      { key: 'frequencia', label: 'Frequência', get: (d) => d.frequencia ?? 0, fmt: freq, better: 'none', ajuda: 'Impressões ÷ alcance. Acima de 4 o público satura.' },
      { key: 'lpv', label: 'LPV', get: (d) => d.lpv ?? 0, fmt: formatCompact, better: 'higher', ajuda: 'Landing page views: quem de fato carregou a página.' },
      { key: 'ctrLink', label: 'CTR Link', get: (d) => d.ctrLink ?? 0, fmt: pct, better: 'higher' },
      { key: 'cpc', label: 'CPC', get: (d) => d.cpc ?? 0, fmt: formatCurrency, better: 'lower' },
      { key: 'cpm', label: 'CPM', get: (d) => d.cpm ?? 0, fmt: formatCurrency, better: 'lower' },
      { key: 'connectRate', label: 'Connect Rate', get: (d) => d.connectRate ?? 0, fmt: pct, better: 'higher', ajuda: 'LPV ÷ cliques no link. Abaixo de 80% costuma ser problema técnico (página lenta).' },
    ],
  },
];

// Métricas em destaque como gráfico de barras no topo do comparativo.
export const CHARTS: { key: string; label: string; get: (d: DashboardData) => number; fmt: (v: number) => string }[] = [
  { key: 'inscritos', label: 'Inscritos', get: (d) => d.inscritos ?? 0, fmt: formatNumber },
  { key: 'spend', label: 'Investimento', get: (d) => d.investimentoTrafego ?? 0, fmt: formatCurrency },
  { key: 'cplReal', label: 'CPA real', get: (d) => d.cplReal ?? 0, fmt: formatCurrency },
  { key: 'diagnosticos', label: 'Diagnósticos', get: (d) => d.diagnosticos ?? 0, fmt: formatNumber },
];

// "Webinar IA 15/06" → "IA 15/06"
export const shortLabel = (label: string) => label.replace(/^Webinar\s+/i, '');

// Índice do melhor valor da linha (ou -1). Ignora zeros — ausência de dado não é
// "o menor custo".
export function bestIndex(values: number[], better: Better): number {
  if (better === 'none') return -1;
  let idx = -1;
  let best = better === 'lower' ? Infinity : -Infinity;
  values.forEach((v, i) => {
    if (!(v > 0)) return;
    if (better === 'lower' ? v < best : v > best) { best = v; idx = i; }
  });
  return idx;
}

/**
 * Variação de B em relação a A e se ela é boa. `null` quando A é zero — não
 * existe "x% a mais" a partir do nada, e exibir ∞ ou 100% seria inventar leitura.
 */
export function variacao(a: number, b: number, better: Better): { pct: number; bom: boolean | null } | null {
  if (!(a > 0) || !(b > 0)) return null;
  const p = (b - a) / a;
  if (Math.abs(p) < 0.005) return { pct: p, bom: null }; // empate técnico (<0,5%)
  const bom = better === 'none' ? null : better === 'higher' ? p > 0 : p < 0;
  return { pct: p, bom };
}
