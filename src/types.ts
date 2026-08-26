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
  alcance?: number;      // reach do período (deduplicado quando alcanceDedup=true)
  alcanceDedup?: boolean; // true = reach deduplicado pela Meta; false = soma por campanha
  semCampanhas?: boolean; // nenhuma campanha casou com o metaMatch da edição
  frequencia?: number;   // impressões ÷ alcance
  lpv?: number;          // landing page views (total)
  cpm?: number;          // custo por mil impressões (R$)
  cpc?: number;          // custo por clique no link (R$)
  ctrLink?: number;      // cliques no link ÷ impressões (fração 0-1)
  connectRate?: number;  // page views ÷ cliques no link (fração 0-1)
  convPagina?: number;   // leads DO PIXEL ÷ page views (fração 0-1)
  // Conversão da página medida pela PLANILHA de inscritos, não pelo pixel:
  // inscritos ADS ÷ page views. O pixel da inChurch é global e dispara `lead` em
  // outros formulários do site, então `convPagina` sai inflado (1,1× a 3,8× o
  // número real, conforme a edição). Este é o que vale para decisão.
  convPaginaReal?: number;

  // Detalhamento dos ICPs (P1–P4), preenchido por /api/icps.
  icp?: { p1: number; p2: number; p3: number; p4: number };

  // Saídas do grupo no período, via /api/sendflow. No modo 'campaign' são as
  // remoções reais (com série por dia, então acompanham o filtro); no modo 'group'
  // são uma estimativa do período inteiro (entradas − membros atuais).
  saidasGrupo?: number;
  // false = o número de saídas acima é do PERÍODO TOTAL da edição, não do recorte
  // de data escolhido (a fonte não tem série por dia). A tela esconde o número em
  // vez de exibi-lo ao lado de entradas já filtradas.
  saidasNoPeriodo?: boolean;
  // false = Alcance e Frequência são do PERÍODO TOTAL da edição. O reach do Meta é
  // deduplicado e não pode ser somado por dia; só num recorte de UM dia dá para
  // usar o valor exato daquele dia.
  alcanceNoPeriodo?: boolean;

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
  // Saídas do grupo por dia (Sendflow, só no modo 'campaign'). Vazia quando a fonte
  // não datou as remoções — aí as saídas não acompanham o filtro de período.
  saidasGrupo: DiaContagem[];
  diagnosticos: DiaContagem[]; // diagnósticos únicos (por e-mail) por dia
  icps: DiaIcp[];
  meta: DiaMeta[];
}
