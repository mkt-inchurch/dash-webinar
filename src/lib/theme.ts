// Paleta dos gráficos. O Recharts recebe cor por prop em JS, não por classe do
// Tailwind, então os tokens da marca precisam existir também aqui.
//
// O painel é de TEMA CLARO FIXO (é o padrão do site da inChurch) — o alternador
// claro/escuro saiu junto com o design antigo. Onde o layout precisa de peso
// visual, o bloco inteiro vira `.secao-escura` (fundo preto, grão e brilho verde),
// e os gráficos que ficam lá dentro usam `CHART_ESCURO`.

export interface ChartPalette {
  green: string;
  greenSoft: string;
  orange: string;
  grid: string;
  axis: string;
  axisAlt: string;
  dim: string;
  reach: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  cursor: string;
}

// Fundo claro (--branco / --off-white).
export const CHART: ChartPalette = {
  green: '#90BE42',      // --verde
  greenSoft: '#C5DE96',  // --verde a 45% sobre branco (série secundária)
  orange: '#D98814',
  grid: '#E6E6E6',       // --borda
  axis: '#616161',       // --cinza-forte
  axisAlt: '#808080',    // --cinza-texto
  dim: '#E6E6E6',
  reach: '#5E7D28',      // --verde-texto
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E6E6E6',
  tooltipText: '#1A1A1A',
  cursor: 'rgba(144,190,66,.10)',
};

// Dentro de `.secao-escura` (fundo --preto).
export const CHART_ESCURO: ChartPalette = {
  green: '#96E035',      // --verde-vivo
  greenSoft: '#5E7D28',
  orange: '#F5A623',
  grid: '#2E2E2E',       // --card-escuro2
  axis: '#A1A1A1',       // --cinza-2
  axisAlt: '#8D8D99',    // --cinza-3
  dim: '#3A3A3A',
  reach: '#5E7D28',
  tooltipBg: '#141414',  // --preto-3
  tooltipBorder: '#3A3A3A',
  tooltipText: '#FFFFFF',
  cursor: 'rgba(150,224,53,.10)',
};

// Compatibilidade com os componentes de gráfico: `chartPalette()` sem argumento
// devolve a paleta clara; `chartPalette('escura')` a do bloco preto.
export function chartPalette(variante?: 'clara' | 'escura'): ChartPalette {
  return variante === 'escura' ? CHART_ESCURO : CHART;
}
