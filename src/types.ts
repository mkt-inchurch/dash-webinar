export interface DashboardData {
  inscritos: number;
  entradasGrupo: number;
  pesquisas: number;
  icps: number;
  diagnosticos: number;

  taxaInscritosGrupo: number;
  taxaGrupoPesquisa: number;
  taxaPesquisaIcp: number;

  investimentoTrafego: number;
  leadsMeta: number;
  cplMeta: number;
  cplReal: number;

  // Inscritos vindos de tráfego pago (UTM Source contém WEBINAR_IA), via /api/inscritos.
  inscritosAds?: number;

  // Métricas de anúncio (derivadas da série do Meta, respeitam o filtro de datas).
  cpm?: number;          // custo por mil impressões (R$)
  ctrLink?: number;      // cliques no link ÷ impressões (fração 0-1)
  connectRate?: number;  // page views ÷ cliques no link (fração 0-1)
  convPagina?: number;   // leads ÷ page views (fração 0-1)

  // Detalhamento dos ICPs (P1–P4), preenchido por /api/icps.
  icp?: { p1: number; p2: number; p3: number; p4: number };

  // Estimativa de saídas do grupo #3 (entradas − membros atuais), via /api/sendflow.
  saidasGrupo?: number;
}

// Séries diárias (para o filtro temporal). Cada item é o que ENTROU naquele dia
// (novos únicos por dia / gasto e leads do dia).
export interface DiaContagem { data: string; novos: number }
export interface DiaIcp { data: string; p1: number; p2: number; p3: number; p4: number }
export interface DiaMeta {
  data: string;
  spend: number;
  leads: number;
  impressions: number;
  linkClicks: number;
  lpViews: number;
}

export interface DashboardSeries {
  inscritos: DiaContagem[];
  inscritosAds: DiaContagem[]; // inscritos de tráfego pago por dia
  pesquisas: DiaContagem[];
  grupo: DiaContagem[]; // entradas líquidas por dia (Sendflow, nível campanha)
  icps: DiaIcp[];
  meta: DiaMeta[];
}
