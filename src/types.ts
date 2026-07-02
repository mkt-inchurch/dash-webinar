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
}
