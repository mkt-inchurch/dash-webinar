import { DashboardData, DashboardSeries } from '../types';

export interface DateRange {
  start: string; // ISO YYYY-MM-DD
  end: string;   // ISO YYYY-MM-DD
}

// Intervalo total disponível a partir das séries (menor..maior data).
export function fullRange(series: DashboardSeries): DateRange {
  const dates: string[] = [];
  for (const s of [series.inscritos, series.pesquisas, series.grupo, series.diagnosticos, series.icps, series.meta]) {
    for (const d of s) dates.push(d.data);
  }
  if (!dates.length) return { start: '2026-06-19', end: '2026-06-19' };
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

export function isFullRange(r: DateRange, full: DateRange): boolean {
  return r.start === full.start && r.end === full.end;
}

const inRange = (d: string, r: DateRange) => d >= r.start && d <= r.end;

// Recalcula os cards que têm série diária para o intervalo escolhido.
// Entradas no Grupo (Sendflow) e CPL Real não têm histórico por dia — permanecem
// como estão. Sem série (ex.: API indisponível) mantém o total.
export function applyDateFilter(base: DashboardData, series: DashboardSeries, r: DateRange): DashboardData {
  const sum = (arr: { data: string }[], pick: (x: any) => number) =>
    arr.filter((d) => inRange(d.data, r)).reduce((a, d) => a + pick(d), 0);

  const out: DashboardData = { ...base };

  if (series.inscritos.length) out.inscritos = sum(series.inscritos, (d) => d.novos);
  if (series.inscritosAds.length) out.inscritosAds = sum(series.inscritosAds, (d) => d.novos);
  if (series.pesquisas.length) out.pesquisas = sum(series.pesquisas, (d) => d.novos);
  if (series.grupo.length) out.entradasGrupo = sum(series.grupo, (d) => d.novos);
  if (series.diagnosticos.length) out.diagnosticos = sum(series.diagnosticos, (d) => d.novos);

  if (series.icps.length) {
    const p1 = sum(series.icps, (d) => d.p1);
    const p2 = sum(series.icps, (d) => d.p2);
    const p3 = sum(series.icps, (d) => d.p3);
    const p4 = sum(series.icps, (d) => d.p4);
    out.icps = p1 + p2 + p3 + p4;
    out.icp = { p1, p2, p3, p4 };
  }

  if (series.meta.length) {
    const spend = sum(series.meta, (d) => d.spend);
    const leads = sum(series.meta, (d) => d.leads);
    const impressions = sum(series.meta, (d) => d.impressions);
    const linkClicks = sum(series.meta, (d) => d.linkClicks);
    const lpViews = sum(series.meta, (d) => d.lpViews);
    out.investimentoTrafego = spend;
    out.leadsMeta = leads;
    out.cplMeta = leads > 0 ? spend / leads : 0;
    out.impressoes = impressions;
    // Alcance e Frequência ficam como estão (período total, vindos de base) —
    // reach não é somável por dia.
    out.lpv = lpViews;
    out.cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    out.cpc = linkClicks > 0 ? spend / linkClicks : 0;
    out.ctrLink = impressions > 0 ? linkClicks / impressions : 0;
    out.connectRate = linkClicks > 0 ? lpViews / linkClicks : 0;
    out.convPagina = lpViews > 0 ? leads / lpViews : 0;
  }

  // CPL Real = Investimento ÷ Inscritos ADS (custo por inscrito vindo de anúncio).
  if (out.inscritosAds != null && out.inscritosAds > 0) {
    out.cplReal = out.investimentoTrafego / out.inscritosAds;
  }

  return out;
}
