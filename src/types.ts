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

  // Detalhamento dos ICPs (P1–P4), preenchido por /api/icps.
  icp?: { p1: number; p2: number; p3: number; p4: number };

  // Estimativa de saídas do grupo #3 (entradas − membros atuais), via /api/sendflow.
  saidasGrupo?: number;
}

// Séries diárias (para o filtro temporal). Cada item é o que ENTROU naquele dia
// (novos únicos por dia / gasto e leads do dia).
export interface DiaContagem { data: string; novos: number }
export interface DiaIcp { data: string; p1: number; p2: number; p3: number; p4: number }
export interface DiaMeta { data: string; spend: number; leads: number }

export interface DashboardSeries {
  inscritos: DiaContagem[];
  pesquisas: DiaContagem[];
  grupo: DiaContagem[]; // entradas líquidas por dia (Sendflow, nível campanha)
  icps: DiaIcp[];
  meta: DiaMeta[];
}
