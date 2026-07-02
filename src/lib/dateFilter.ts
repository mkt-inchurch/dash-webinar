import { DashboardData, DashboardSeries } from '../types';

export interface DateRange {
  start: string; // ISO YYYY-MM-DD
  end: string;   // ISO YYYY-MM-DD
}

// Intervalo total disponível a partir das séries (menor..maior data).
export function fullRange(series: DashboardSeries): DateRange {
  const dates: string[] = [];
  for (const s of [series.inscritos, series.pesquisas, series.icps, series.meta]) {
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
// Entradas no Grupo (Sendflow), Diagnósticos e CPL Real não têm histórico por
// dia — permanecem como estão. Sem série (ex.: API indisponível) mantém o total.
export function applyDateFilter(base: DashboardData, series: DashboardSeries, r: DateRange): DashboardData {
  const sum = (arr: { data: string }[], pick: (x: any) => number) =>
    arr.filter((d) => inRange(d.data, r)).reduce((a, d) => a + pick(d), 0);

  const out: DashboardData = { ...base };

  if (series.inscritos.length) out.inscritos = sum(series.inscritos, (d) => d.novos);
  if (series.pesquisas.length) out.pesquisas = sum(series.pesquisas, (d) => d.novos);

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
    out.investimentoTrafego = spend;
    out.leadsMeta = leads;
    out.cplMeta = leads > 0 ? spend / leads : 0;
  }

  return out;
}
