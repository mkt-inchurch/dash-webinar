// AUDITORIA AUTOMÁTICA DOS DADOS.
//
// POR QUE EXISTE: até aqui, saber se os números da tela estavam certos exigia uma
// conferência manual — baixar as fontes, somar na mão, comparar edição a edição.
// Isso não escala: a config de cada edição (janelas de data, `metaMatch`, utms)
// envelhece toda vez que o time cria uma campanha, renomeia outra ou abre uma turma
// nova, e o painel continua mostrando números internamente coerentes enquanto o
// dinheiro escorre para fora da conta.
//
// Estas funções rodam as MESMAS checagens da auditoria manual, no navegador, sobre
// os dados que o painel já carregou — custo zero de requisição. O resultado vira o
// selo "dados conferidos" no topo. Se um número quebrar, a tela diz qual e por quê,
// em vez de esperar alguém desconfiar.
//
// Regra de ouro daqui: uma checagem só vira ERRO quando o número na tela está
// comprovadamente errado. Diferenças esperadas (alcance não somável por dia,
// edição futura sem dado) são AVISO ou nem aparecem.

import { DashboardData, DashboardSeries } from '../types';
import { Edition, EDITIONS } from './editions';

export type Nivel = 'ok' | 'aviso' | 'erro';

export interface Checagem {
  id: string;
  titulo: string;
  nivel: Nivel;
  detalhe: string;
}

export interface Cobertura {
  total: number;
  campanhas: { id: string; nome: string; spend: number }[];
  edicoesDaConta: string[];
  desde: string;
  ate: string;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const int = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v));
const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

const soma = <T,>(arr: T[], pick: (x: T) => number) => arr.reduce((a, x) => a + pick(x), 0);

// Rótulos amigáveis das fontes (mesma tabela usada no aviso de indisponibilidade).
const FONTES: Record<string, string> = {
  meta: 'Meta Ads',
  sendflow: 'Entradas no Grupo (Sendflow)',
  inscritos: 'Inscritos (planilha)',
  pesquisas: 'Pesquisas (planilha)',
  icps: 'ICPs (planilha)',
  diagnosticos: 'Diagnósticos (planilha)',
};

/**
 * Checagens de UMA edição. Recebe os TOTAIS do período completo (`data` sem filtro
 * de data) e as séries diárias — comparar um total filtrado com a série inteira
 * acusaria erro em toda seleção de período, que é justamente o uso normal da tela.
 */
export function auditarEdicao(
  ed: Edition | undefined,
  data: DashboardData,
  series: DashboardSeries,
  unavailable: string[],
  motivos: Record<string, string>,
  sendflowGeradoEm?: string
): Checagem[] {
  const cs: Checagem[] = [];
  const add = (id: string, titulo: string, nivel: Nivel, detalhe: string) =>
    cs.push({ id, titulo, nivel, detalhe });

  // ---- 1. As seis fontes responderam? ----------------------------------
  const fontesQuebradas = unavailable.filter((u) => FONTES[u]);
  if (fontesQuebradas.length) {
    add(
      'fontes',
      'Fontes de dados',
      'erro',
      `${fontesQuebradas.map((u) => FONTES[u]).join(', ')} não respondeu. ` +
        (fontesQuebradas.map((u) => motivos[u]).filter(Boolean).join(' ') ||
          'Os cards dessas fontes estão zerados.')
    );
  } else {
    add('fontes', 'Fontes de dados', 'ok', 'As seis fontes da edição responderam.');
  }

  // ---- 2. Config do Meta ainda casa com alguma campanha? ---------------
  if (data.semCampanhas) {
    add(
      'meta-match',
      'Filtro de campanha do Meta',
      'erro',
      'Nenhuma campanha do período casou com o filtro desta edição. Provavelmente a campanha foi renomeada ' +
        'ou a edição nasceu com o termo errado — revise `metaMatch` em api/_editions.js. Os cards de mídia ' +
        'estão em R$ 0,00 por configuração, não porque não houve investimento.'
    );
  }

  // ---- 3. A série diária fecha com o total? -----------------------------
  // Se não fechar, o filtro de período mostra um número diferente do "todo o
  // período" para o MESMO recorte — o modo mais silencioso de o painel mentir.
  // O resultado vai num item ÚNICO: uma lista com sete linhas verdes "confere"
  // empurra os problemas para o fim do painel e ninguém lê até o fim.
  const divergentes: string[] = [];
  let conferidas = 0;
  const confereSerie = (
    rotulo: string,
    total: number | undefined,
    somaSerie: number,
    temSerie: boolean
  ) => {
    if (total == null || !temSerie) return;
    conferidas++;
    if (Math.abs(somaSerie - total) > 0.5) {
      divergentes.push(`${rotulo} (card ${int(total)} × série ${int(somaSerie)})`);
    }
  };
  confereSerie('Inscritos', data.inscritos, soma(series.inscritos, (d) => d.novos), series.inscritos.length > 0);
  confereSerie('Inscritos ADS', data.inscritosAds, soma(series.inscritosAds, (d) => d.novos), series.inscritosAds.length > 0);
  confereSerie('Pesquisas', data.pesquisas, soma(series.pesquisas, (d) => d.novos), series.pesquisas.length > 0);
  confereSerie('Entradas no Grupo', data.entradasGrupo, soma(series.grupo, (d) => d.novos), series.grupo.length > 0);
  confereSerie('Diagnósticos', data.diagnosticos, soma(series.diagnosticos, (d) => d.novos), series.diagnosticos.length > 0);
  confereSerie('ICPs', data.icps, soma(series.icps, (d) => d.p1 + d.p2 + d.p3 + d.p4), series.icps.length > 0);
  confereSerie('Investimento', data.investimentoTrafego, soma(series.meta, (d) => d.spend), series.meta.length > 0);
  if (divergentes.length) {
    add('series', 'Cards × série diária', 'erro',
      `Não fecham: ${divergentes.join('; ')}. O card e o filtro de período estão lendo números diferentes.`);
  } else if (conferidas) {
    add('series', 'Cards × série diária', 'ok',
      `${conferidas} de ${conferidas} cards fecham com a soma da sua série por dia — o filtro de período mostra os mesmos números do total.`);
  }

  // ---- 4. Relações que não podem se inverter ----------------------------
  const antesDasRelacoes = cs.length;
  if (data.inscritosAds != null && data.inscritosAds > data.inscritos && data.inscritos > 0) {
    add('ads-maior', 'Inscritos ADS × total', 'erro',
      `Inscritos ADS (${int(data.inscritosAds)}) maior que o total de inscritos (${int(data.inscritos)}). ` +
      'A lista de origens não pagas (ORIGENS_NAO_PAGAS) provavelmente está incompleta.');
  }
  const temEtapaPesquisa = !ed?.semPesquisas;
  if (temEtapaPesquisa && data.pesquisas > 0 && data.icps > data.pesquisas) {
    add('icp-maior', 'ICPs × pesquisas', 'erro',
      `ICPs (${int(data.icps)}) maior que o total de respostas (${int(data.pesquisas)}).`);
  }
  if ((data.connectRate ?? 0) > 1.02) {
    add('connect', 'Connect Rate', 'erro',
      `${pc(data.connectRate!)} — houve mais visualizações de página do que cliques no link.`);
  }
  if ((data.alcance ?? 0) > (data.impressoes ?? 0) && (data.impressoes ?? 0) > 0) {
    add('alcance', 'Alcance × impressões', 'erro',
      `Alcance (${int(data.alcance!)}) maior que impressões (${int(data.impressoes!)}).`);
  }
  if ((data.frequencia ?? 0) > 0 && data.frequencia! < 1) {
    add('freq', 'Frequência', 'erro', `${data.frequencia!.toFixed(2)} — não existe frequência abaixo de 1.`);
  }

  if (cs.length === antesDasRelacoes) {
    add('relacoes', 'Relações entre métricas', 'ok',
      'Inscritos ADS ≤ total, ICPs ≤ respostas, alcance ≤ impressões, frequência ≥ 1 e Connect Rate ≤ 100%.');
  }

  // ---- 5. Alcance somado em vez de deduplicado --------------------------
  if (data.alcanceDedup === false && (data.alcance ?? 0) > 0) {
    add('dedup', 'Alcance', 'aviso',
      'A consulta deduplicada do Meta não passou na conferência: o card está com a SOMA do alcance por ' +
      'campanha, que conta duas vezes quem viu mais de uma campanha. Alcance inflado e frequência deflacionada.');
  }

  // ---- 6. Leads do pixel × inscritos reais ------------------------------
  // O pixel da inChurch é global e dispara `lead` em outros formulários do site,
  // então `leadsMeta` costuma vir acima dos inscritos que realmente entraram na
  // planilha. Não é erro do painel — é o motivo de "Conv. Captura (real)" e
  // "CPA real" existirem ao lado dos números do pixel.
  const lm = data.leadsMeta ?? 0;
  const ads = data.inscritosAds ?? 0;
  if (lm > 0 && ads > 0) {
    const razao = lm / ads;
    if (razao >= 1.3) {
      add('pixel', 'Leads do pixel do Meta', 'aviso',
        `O Meta reporta ${int(lm)} leads para ${int(ads)} inscritos de anúncio (${razao.toFixed(2)}× mais). ` +
        'O pixel global da inChurch conta conversões de outros formulários do site. Use "Conv. Captura (real)" ' +
        'e "CPA real", que saem da planilha de inscritos.');
    } else {
      add('pixel', 'Leads do pixel do Meta', 'ok',
        `${int(lm)} leads no Meta para ${int(ads)} inscritos de anúncio (${razao.toFixed(2)}×) — dentro do esperado.`);
    }
  }

  // ---- 6b. As saídas do grupo acompanham o filtro de período? -----------
  // As entradas SEMPRE têm série por dia; as saídas só no modo 'campaign' do
  // Sendflow (e só nos snapshots publicados a partir de 26/08/2026). Sem a série,
  // o painel exibia as saídas do período INTEIRO ao lado de entradas já recortadas
  // — na Trilha 31/08, o preset "Hoje" mostrava "8 entradas ↓ 11 saídas". Hoje a
  // tela esconde o número no recorte; este aviso diz por que ele sumiu.
  if ((data.saidasGrupo ?? 0) > 0 && series.grupo.length > 0 && series.saidasGrupo.length === 0) {
    add('saidas-serie', 'Saídas do grupo por dia', 'aviso',
      `As ${int(data.saidasGrupo!)} saídas do grupo não vêm datadas nesta edição, então elas não acompanham o ` +
      'filtro de período: aparecem só em "Todo período". As entradas acompanham normalmente.');
  }

  // ---- 7. Frescor do snapshot do Sendflow -------------------------------
  // /api/sendflow não fala com a SendAPI: serve o snapshot que o GitHub Actions
  // publica de hora em hora. Se o job parar, o card congela sem avisar.
  if (sendflowGeradoEm) {
    const idadeH = (Date.now() - new Date(sendflowGeradoEm).getTime()) / 3_600_000;
    if (idadeH > 3) {
      add('sendflow-idade', 'Snapshot do Sendflow', 'aviso',
        `A última coleta foi há ${idadeH.toFixed(0)}h. O card "Entradas no Grupo" está congelado nesse retrato — ` +
        'rode o workflow "Sendflow snapshot" no GitHub Actions.');
    } else {
      add('sendflow-idade', 'Snapshot do Sendflow', 'ok',
        `Coletado há ${idadeH < 1 ? 'menos de 1h' : `${idadeH.toFixed(0)}h`}.`);
    }
  }

  return cs;
}

/**
 * Checagens que só existem olhando TODAS as edições de uma vez: dinheiro contado
 * duas vezes e dinheiro não contado em lugar nenhum. São as duas falhas que a
 * conferência de uma edição isolada nunca pega, porque dentro dela tudo fecha.
 */
export function auditarComparacao(
  rows: { id: string; label: string; data: DashboardData; series: DashboardSeries }[],
  cobertura?: Cobertura | null
): Checagem[] {
  const cs: Checagem[] = [];
  const add = (id: string, titulo: string, nivel: Nivel, detalhe: string) =>
    cs.push({ id, titulo, nivel, detalhe });

  // ---- 1. O mesmo dia de gasto contado em duas edições ------------------
  // Várias edições compartilham as MESMAS campanhas (a Trilha reusa a "LP01" desde
  // julho; o 27/07 e o 10/08 são a mesma campanha renomeada). O que as separa é a
  // janela de data. Se duas janelas se sobrepuserem, o mesmo real entra no painel
  // duas vezes e o investimento total do trimestre fica inflado.
  const diasPorEdicao = new Map<string, Set<string>>();
  const campanhasPorEdicao = new Map<string, Set<string>>();
  for (const r of rows) {
    diasPorEdicao.set(r.id, new Set(r.series.meta.filter((d) => d.spend > 0).map((d) => d.data)));
    campanhasPorEdicao.set(r.id, new Set((r.data.campanhas ?? []).map((c) => c.id)));
  }
  const duplicados: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      const campA = campanhasPorEdicao.get(a.id)!;
      const campB = campanhasPorEdicao.get(b.id)!;
      const compartilha = [...campA].some((c) => campB.has(c));
      if (!compartilha) continue; // campanhas diferentes: não há como contar 2×
      const diasA = diasPorEdicao.get(a.id)!;
      const diasB = diasPorEdicao.get(b.id)!;
      const colisao = [...diasA].filter((d) => diasB.has(d)).sort();
      if (colisao.length) {
        duplicados.push(
          `${a.label} × ${b.label}: ${colisao.length} dia(s) em comum (${colisao[0]}…${colisao[colisao.length - 1]})`
        );
      }
    }
  }
  if (duplicados.length) {
    add('dupla-contagem', 'Investimento contado duas vezes', 'erro',
      'Duas edições que dividem as mesmas campanhas têm dias de gasto sobrepostos: ' + duplicados.join(' · ') +
      '. Ajuste `metaAte`/`metaDesde` dessas edições em api/_editions.js.');
  } else {
    add('dupla-contagem', 'Investimento contado duas vezes', 'ok',
      'Nenhum dia de mídia aparece em duas edições que compartilham campanha.');
  }

  // ---- 2. Diagnóstico contado em duas edições ---------------------------
  // A planilha de diagnósticos é ÚNICA e a utm não separa edição — só a data
  // separa. Janelas sobrepostas fazem o MESMO diagnóstico contar em 2, 3 ou 4
  // edições (já aconteceu: 715 exibidos onde existiam 416).
  const diagDias = new Map<string, string[]>();
  for (const r of rows) {
    // Só entram as edições que leem a planilha COMPARTILHADA. As que têm coluna
    // própria (Calculadora de Líderes) não podem colidir com ninguém — comparar
    // as datas delas com as das outras acusava 27 dias de "sobreposição" que não
    // existiam, e um falso alarme desses ensina a ignorar o painel.
    if (EDITIONS.find((e) => e.id === r.id)?.diagPropria) continue;
    for (const d of r.series.diagnosticos) {
      if (d.novos <= 0) continue;
      const lista = diagDias.get(d.data) ?? [];
      lista.push(r.label);
      diagDias.set(d.data, lista);
    }
  }
  const diagColisao = [...diagDias.entries()].filter(([, eds]) => eds.length > 1);
  if (diagColisao.length) {
    add('diag-sobreposto', 'Diagnósticos sobrepostos', 'erro',
      `${diagColisao.length} dia(s) de diagnóstico caem em mais de uma edição ` +
      `(ex.: ${diagColisao[0][0]} em ${diagColisao[0][1].join(' e ')}). ` +
      'Feche a janela `diagAte` da edição anterior em api/_editions.js.');
  } else {
    add('diag-sobreposto', 'Diagnósticos sobrepostos', 'ok',
      'Na planilha compartilhada, cada dia de diagnóstico pertence a uma edição só.');
  }

  // ---- 3. Mídia de webinar fora de todas as edições ---------------------
  // A checagem que teria pegado o Igreja Digital 24/08 no primeiro dia: pergunta à
  // conta o gasto TOTAL das campanhas de webinar e compara com a soma das edições.
  if (cobertura) {
    const daConta = new Set(cobertura.edicoesDaConta);
    const linhas = rows.filter((r) => daConta.has(r.id));
    const atribuido = soma(linhas, (r) => r.data.investimentoTrafego ?? 0);
    const fora = cobertura.total - atribuido;
    const idsNoPainel = new Set<string>();
    for (const r of linhas) for (const c of r.data.campanhas ?? []) idsNoPainel.add(c.id);
    const orfas = cobertura.campanhas.filter((c) => !idsNoPainel.has(c.id));
    // 1% (ou R$50) de tolerância: a Graph API arredonda o gasto por recorte, e o
    // total da conta e a soma por janela não fecham na casa dos centavos.
    const limite = Math.max(50, cobertura.total * 0.01);
    if (fora > limite) {
      add('cobertura', 'Mídia fora do painel', 'erro',
        `A conta gastou ${brl(cobertura.total)} em campanhas de webinar desde ${cobertura.desde}, mas as edições ` +
        `somam ${brl(atribuido)}. Faltam ${brl(fora)}` +
        (orfas.length
          ? `, em campanhas que nenhuma edição captura: ${orfas.slice(0, 3).map((c) => `“${c.nome}” (${brl(c.spend)})`).join(', ')}` +
            (orfas.length > 3 ? ` e mais ${orfas.length - 3}` : '')
          : ' — o gasto é de campanhas conhecidas, mas caiu fora das janelas de data') +
        '. Revise `metaMatch`/`metaDesde`/`metaAte` em api/_editions.js.');
    } else if (fora < -limite) {
      add('cobertura', 'Mídia contada a mais', 'erro',
        `As edições somam ${brl(atribuido)}, acima dos ${brl(cobertura.total)} que a conta gastou em campanhas de ` +
        'webinar. Há janela de data sobreposta entre edições.');
    } else {
      add('cobertura', 'Mídia fora do painel', 'ok',
        `${brl(atribuido)} atribuídos de ${brl(cobertura.total)} gastos na conta — toda a mídia de webinar está em alguma edição.`);
    }
  }

  return cs;
}

// Pior nível de uma lista (para o selo do topo).
export function piorNivel(cs: Checagem[]): Nivel {
  if (cs.some((c) => c.nivel === 'erro')) return 'erro';
  if (cs.some((c) => c.nivel === 'aviso')) return 'aviso';
  return 'ok';
}
