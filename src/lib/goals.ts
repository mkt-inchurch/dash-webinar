// Metas mensais por métrica (para o indicador "% da meta" nos cards).
// ⚠️ VALORES DE EXEMPLO — referências de mercado, provisórios. Ajuste conforme
// as metas reais forem definidas. `higherBetter`: true = quanto maior melhor;
// false = custo/limite (quanto menor melhor, ex.: CPL/CPC/CPM).

export interface Goal {
  goal: number;
  higherBetter: boolean;
}

export const GOALS: Record<string, Goal> = {
  // Funil
  inscritos: { goal: 2000, higherBetter: true },
  inscritosAds: { goal: 800, higherBetter: true },
  entradasGrupo: { goal: 1200, higherBetter: true },
  pesquisas: { goal: 600, higherBetter: true },
  icps: { goal: 200, higherBetter: true },
  diagnosticos: { goal: 120, higherBetter: true },
  cplReal: { goal: 3, higherBetter: false }, // CPA alvo R$3

  // Meta Ads
  leadsMeta: { goal: 1000, higherBetter: true },
  cplMeta: { goal: 8, higherBetter: false }, // CPL alvo R$8
  alcance: { goal: 150000, higherBetter: true },
  impressoes: { goal: 400000, higherBetter: true },
  lpv: { goal: 2000, higherBetter: true },
  ctrLink: { goal: 0.01, higherBetter: true }, // 1% ref. de mercado
  cpc: { goal: 2, higherBetter: false }, // R$2
  cpm: { goal: 30, higherBetter: false }, // R$30
  convPagina: { goal: 0.15, higherBetter: true }, // 15%
  connectRate: { goal: 0.8, higherBetter: true }, // 80%
};
