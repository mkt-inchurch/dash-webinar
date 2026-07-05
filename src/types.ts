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
  impressoes?: number;   // total de impressões no período
  alcance?: number;      // reach (soma diária — aproximado)
  frequencia?: number;   // impressões ÷ alcance
  lpv?: number;          // landing page views (total)
  cpm?: number;          // custo por mil impressões (R$)
  cpc?: number;          // custo por clique no link (R$)
  ctrLink?: number;      // cliques no link ÷ impressões (fração 0-1)
  connectRate?: number;  // page views ÷ cliques no link (fração 0-1)
  convPagina?: number;   // leads ÷ page views (fração 0-1)

  // Detalhamento dos ICPs (P1–P4), preenchido por /api/icps.
  icp?: { p1: number; p2: number; p3: number; p4: number };

  // Estimativa de saídas do grupo #3 (entradas − membros atuais), via /api/sendflow.
  saidasGrupo?: number;

  // Dados por campanha (período total), via /api/meta — para "Por Campanha" e tabela.
  campanhas?: Campanha[];
}

export interface Campanha {
  id: string;
  name: string;
  spend: number;
  impressoes: number;
  alcance: number;
  frequencia: number;
  linkClicks: number;
  lpViews: number;
  ctrLink: number;
  cpm: number;
  cpc: number;
  conversoes: number;
  cpl: number;
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
  reach: number;
  linkClicks: number;
  lpViews: number;
}

export interface DashboardSeries {
  inscritos: DiaContagem[];
  inscritosAds: DiaContagem[]; // inscritos de tráfego pago por dia
  pesquisas: DiaContagem[];
  grupo: DiaContagem[]; // entradas líquidas por dia (Sendflow, nível campanha)
  diagnosticos: DiaContagem[]; // diagnósticos únicos (por e-mail) por dia
  icps: DiaIcp[];
  meta: DiaMeta[];
}
