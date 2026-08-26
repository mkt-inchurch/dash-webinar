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

// Data de HOJE em ISO, no fuso local de quem abre o painel.
// `toISOString()` converteria para UTC e, à noite no Brasil, devolveria o dia
// seguinte — o preset "Hoje" cairia num dia sem dado nenhum.
export function hojeISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// O intervalo tem atividade de verdade — alguém se inscreveu ou houve gasto?
//
// POR QUE IMPORTA: quando não tem, TODOS os cards mostram 0 e NENHUM aviso
// aparece, porque nenhuma fonte falhou. Era o jeito mais comum de o painel
// "carregar informação errada": numa edição encerrada o preset "Hoje" caía no
// último dia da série (13/08 na edição de 13/07, 23/06 na de 15/06) e a tela
// inteira zerava como se o webinar não tivesse existido.
//
// O teste é sobre INSCRIÇÕES e INVESTIMENTO de propósito, não sobre "qualquer
// série": as edições encerradas têm um rabo de entradas e saídas de grupo semanas
// depois da live, e uma única saída solta bastava para o intervalo passar por
// "tem dado" enquanto todo o resto da tela mostrava zero. Esses dois são o que
// sustenta o painel — sem eles, não há o que ler no período.
export function rangeTemDados(series: DashboardSeries, r: DateRange): boolean {
  const dentro = (d: string) => d >= r.start && d <= r.end;
  for (const d of series.inscritos) if (dentro(d.data) && d.novos > 0) return true;
  for (const d of series.meta) if (dentro(d.data) && (d.spend > 0 || d.impressions > 0)) return true;
  return false;
}

// Janela em que a edição de fato ACONTECEU: primeiro e último dia com inscrição ou
// com investimento. É diferente do `fullRange`, que é a união de TODAS as séries.
//
// POR QUE AS DUAS EXISTEM: as séries têm cauda. Gente sai do grupo semanas depois da
// live, e a planilha de pesquisa continua recebendo resposta com o token genérico da
// Trilha até a véspera da turma seguinte. Isso empurra `fullRange` para frente — na
// edição 17/08 ele ia até HOJE (26/08), nove dias depois do fim da captação. Como o
// filtro habilitava os presets comparando com `fullRange`, "Hoje" e "Ontem"
// apareciam clicáveis numa edição encerrada e zeravam a tela inteira.
//
// "Todo período" continua usando `fullRange` — a cauda é dado real da edição e tem
// de entrar nos totais. Quem usa esta janela é só a habilitação dos presets.
export function janelaAtividade(series: DashboardSeries): DateRange | null {
  const dias: string[] = [];
  for (const d of series.inscritos) if (d.novos > 0) dias.push(d.data);
  for (const d of series.meta) if (d.spend > 0 || d.impressions > 0) dias.push(d.data);
  if (!dias.length) return null;
  dias.sort();
  return { start: dias[0], end: dias[dias.length - 1] };
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

  // Este recorte é o período inteiro da edição? Métricas que não têm série por dia
  // (saídas do grupo no modo 'group', alcance do Meta) só podem ser exibidas assim.
  const completo = isFullRange(r, fullRange(series));

  // SAÍDAS DO GRUPO. Com série por dia (modo 'campaign' do Sendflow), somam dentro do
  // recorte como qualquer outro card. Sem série, o número é do período TOTAL: exibi-lo
  // ao lado de entradas já filtradas é o erro que a edição 31/08 mostrava no preset
  // "Hoje" — "8 entradas ↓ 11 saídas", 8 de hoje contra 11 do mês. Aqui ele some, e
  // `saidasNoPeriodo: false` faz a tela dizer por quê.
  if (series.saidasGrupo.length) {
    out.saidasGrupo = sum(series.saidasGrupo, (d) => d.novos);
    out.saidasNoPeriodo = true;
  } else if (!completo && out.saidasGrupo != null) {
    out.saidasGrupo = undefined;
    out.saidasNoPeriodo = false;
  } else {
    out.saidasNoPeriodo = true;
  }
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

    // ALCANCE E FREQUÊNCIA. O reach da Meta é deduplicado por pessoa: somar o de cada
    // dia conta várias vezes quem voltou, então não existe "alcance do recorte" para
    // uma janela de vários dias — o card fica com o do período total e se declara
    // assim (`alcanceNoPeriodo: false`), para não ser lido como número do recorte.
    //
    // A exceção é o recorte de UM dia: aí o reach daquele dia, que a Graph API já
    // devolve deduplicado em `porDia`, É o número do período. É o caso do preset
    // "Hoje", justamente o mais usado.
    const diasComEntrega = series.meta.filter((d) => inRange(d.data, r) && d.impressions > 0);
    if (completo) {
      out.alcanceNoPeriodo = true;
    } else if (diasComEntrega.length === 0) {
      // Nenhum dia de entrega no recorte: o alcance do período é zero, e não o do
      // período inteiro. Mantê-lo aqui exibiria 27 mil pessoas alcançadas ao lado de
      // zero impressão.
      out.alcance = 0;
      out.frequencia = 0;
      out.alcanceNoPeriodo = true;
    } else if (diasComEntrega.length === 1 && diasComEntrega[0].reach > 0) {
      out.alcance = diasComEntrega[0].reach;
      out.frequencia = diasComEntrega[0].impressions / diasComEntrega[0].reach;
      out.alcanceNoPeriodo = true;
    } else {
      out.alcanceNoPeriodo = false;
    }

    out.lpv = lpViews;
    out.cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    out.cpc = linkClicks > 0 ? spend / linkClicks : 0;
    out.ctrLink = impressions > 0 ? linkClicks / impressions : 0;
    out.connectRate = linkClicks > 0 ? lpViews / linkClicks : 0;
    out.convPagina = lpViews > 0 ? leads / lpViews : 0;
  }

  // CPL Real = Investimento ÷ Inscritos ADS (custo por inscrito vindo de anúncio).
  // Sem inscritos ADS não existe CPA: zera em vez de deixar o valor que veio da
  // planilha-base compartilhada. Era assim que a edição 24/08 (ADS = 0) exibia
  // "R$ 0,28" — número de OUTRO webinar — e ainda ganhava o destaque de melhor CPA
  // na tela de comparação.
  out.cplReal = out.inscritosAds && out.inscritosAds > 0
    ? out.investimentoTrafego / out.inscritosAds
    : 0;

  // Conv. Captura REAL = Inscritos ADS ÷ LPV. A `convPagina` acima usa os leads do
  // PIXEL, que na conta da inChurch é global e conta conversões de outros
  // formulários do site — ela sai entre 25% e 62%, enquanto a conversão real da
  // página fica entre 18% e 35%. As duas ficam na tela: a real decide, a do pixel
  // serve para medir o quanto o pixel está inflando.
  out.convPaginaReal = out.lpv && out.lpv > 0 && out.inscritosAds != null
    ? out.inscritosAds / out.lpv
    : 0;

  return out;
}
