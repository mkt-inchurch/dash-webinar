// Benchmarks de mercado (faixas 🔴🟡🟢) para as métricas de anúncio, conforme o
// documento de referência. Cada função devolve o status e um rótulo curto.
// Percentuais (ctrLink, connectRate, convPagina) chegam como fração (0–1).

export type BenchStatus = 'red' | 'yellow' | 'green';
export interface Bench {
  status: BenchStatus;
  label: string;
}

// Maior é melhor: >= g verde, >= y amarelo, senão vermelho.
function higher(v: number, y: number, g: number, labels: [string, string, string]): Bench {
  if (v >= g) return { status: 'green', label: labels[2] };
  if (v >= y) return { status: 'yellow', label: labels[1] };
  return { status: 'red', label: labels[0] };
}

// Menor é melhor: <= ref verde, <= ref*mult amarelo, senão vermelho.
function lower(v: number, ref: number, mult: number, labels: [string, string, string]): Bench {
  if (v <= ref) return { status: 'green', label: labels[2] };
  if (v <= ref * mult) return { status: 'yellow', label: labels[1] };
  return { status: 'red', label: labels[0] };
}

// Referências de custo em R$ (doc: CPM BR ~R$30; CPC US$0,70; CPL US$27,66; câmbio ~5,4).
const CPC_REF = 3.8; // ~US$0,70
const CPL_REF = 149; // ~US$27,66

export type BenchMetric =
  | 'ctrLink' | 'connectRate' | 'convPagina' | 'frequencia' | 'cpm' | 'cpc' | 'cpl';

export function benchmark(metric: BenchMetric, v: number): Bench {
  switch (metric) {
    // 🔴 <1% troca · 🟡 1–1,5% mantém · 🟢 1,5%+ escala
    case 'ctrLink':
      return higher(v, 0.01, 0.015, ['troca', 'mantém', 'escala']);
    // 🔴 <80% técnico · 🟡 80% · 🟢 90–95%
    case 'connectRate':
      return higher(v, 0.80, 0.90, ['técnico', 'ok', 'ótimo']);
    // Webinar/evento: 🔴 <20% · 🟡 20–40% · 🟢 40%+
    case 'convPagina':
      return higher(v, 0.20, 0.40, ['baixo', 'ok', 'ótimo']);
    // 🟢 ideal 1–2 · 🟡 2–4 · 🔴 >4 satura
    case 'frequencia':
      if (v > 4) return { status: 'red', label: 'satura' };
      if (v > 2) return { status: 'yellow', label: 'atenção' };
      return { status: 'green', label: 'ideal' };
    // CPM saudável ~R$30 · muito baixo = sinal ruim
    case 'cpm':
      if (v < 8) return { status: 'yellow', label: 'muito baixo' };
      return lower(v, 45, 1.8, ['acima', 'na média', 'saudável']);
    case 'cpc':
      return lower(v, CPC_REF, 1.8, ['acima', 'na média', 'abaixo do mercado']);
    case 'cpl':
      return lower(v, CPL_REF, 1.5, ['acima', 'na média', 'abaixo do mercado']);
  }
}
