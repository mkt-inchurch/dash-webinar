// Configuração das edições do Webinar IA. Cada edição aponta para suas próprias
// fontes (aba de inscritos, campanha do Sendflow, janelas de data do Meta/pesquisa
// /diagnósticos). As serverless functions leem `?ed=<id>` e usam esta config.
// Datas ISO "AAAA-MM-DD"; `ate: null` = aberto (até hoje).

export const EDITIONS = {
  // 1ª edição — captação 29/05→18/06, webinar 15/06. Tudo até 18/06 23h
  // (o split com a 2ª edição é 19/06). Sendflow: grupos #1 e #2 (o #3 só encheu
  // a partir de 19/06, então o corte em 18/06 já exclui o #3).
  'webinar-15-06': {
    id: 'webinar-15-06',
    label: 'Webinar IA 15/06',
    inscritosGid: 0, // aba Inscritos_15_06
    inscritosDesde: null,
    inscritosAte: '2026-06-18',
    pesquisaDesde: null,
    pesquisaAte: '2026-06-18 23:00',
    metaDesde: '2026-05-01', // captação começou 29/05; buffer p/ pegar todo o gasto
    metaAte: '2026-06-18',
    metaMatch: 'WEBINAR_IA',
    sendflowRelease: 'hZh6HtKTvj9jUu8ZYbml',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    sendflowAte: '2026-06-18',
    diagDesde: null,
    diagAte: '2026-06-18 23:00',
  },

  // 2ª edição — captação 19/06→03/07, webinar 04/07, diagnósticos 04–12/07.
  'webinar-04-07': {
    id: 'webinar-04-07',
    label: 'Webinar IA 04/07',
    inscritosGid: 51943459, // aba Inscritos_29_06
    inscritosDesde: '2026-06-19',
    inscritosAte: null,
    pesquisaDesde: '2026-06-19', // usado por /pesquisas e /icps (mesma planilha)
    pesquisaAte: '2026-07-03',
    metaDesde: '2026-06-19',
    metaAte: '2026-07-03', // fecha antes da nova captação p/ não sobrepor
    metaMatch: 'WEBINAR_IA',
    sendflowRelease: 'hZh6HtKTvj9jUu8ZYbml',
    sendflowGroup: 'ZUOxWMArOvbfjakb8r0L',
    sendflowMode: 'group', // entradas brutas + saídas estimadas pelo grupo #3
    sendflowDesde: '2026-06-19',
    diagDesde: '2026-07-04',
    diagAte: '2026-07-12',
  },

  // 4ª edição — OUTRO webinar: "Trilha da Integração" (Pedro Franco), 20/07.
  // Fontes próprias: planilha de inscritos dedicada (LP webinar-integracao),
  // campanhas Meta "WEBINAR_TRILHA", release do Sendflow próprio e a MESMA
  // planilha de pesquisa, mas separada pela utm_campaign (não por data).
  'webinar-20-07': {
    id: 'webinar-20-07',
    label: 'Webinar Trilha 20/07',
    // Planilha de inscritos própria (diferente da do webinar IA).
    inscritosSheet: '1q42q1ZlHGmNG0w6Fkm1lM-PazsrI8fzf78EQoPmznR0',
    // Aba dedicada Inscritos_20_07 (gid 0). ANTES lia "a 1ª aba" (sem gid), mas ao
    // criarem a aba Inscritos_03_08 (nova edição) o /export sem gid passou a
    // devolvê-la (virou a 1ª aba) → o card mostrava ~3 em vez de 1433/890.
    inscritosGid: 0,
    inscritosDesde: null,
    inscritosAte: null,
    // "Inscritos ADS" = tráfego pago do Meta, identificado pela UTM Source conter o
    // nome da campanha (WEBINAR_TRILHA) — igual às edições de IA. O UTM Medium é
    // inconsistente entre campanhas (paid / "00 - advtg" / macros quebradas), então
    // filtrar por medium=paid subcontava (pegava só ~289 de ~664 pagos).
    inscritosAdsField: 'source',
    inscritosAdsMatch: 'WEBINAR_TRILHA',
    // Pesquisa: mesma planilha do IA, separada pela utm_campaign (não por data).
    pesquisaDesde: null,
    // Fecha em 20/07 (dia do webinar): respostas WEBINAR_TRILHA a partir de 21/07
    // são captação da edição seguinte (03/08) — sem o corte, contariam nas duas.
    pesquisaAte: '2026-07-20',
    pesquisaUtmMatch: 'WEBINAR_TRILHA',
    metaDesde: '2026-07-01',
    // Fecha em 20/07 (dia do webinar): o gasto WEBINAR_TRILHA a partir de 21/07 é
    // captação do 03/08 (mesmas campanhas/UTM) — o corte evita contagem dupla.
    metaAte: '2026-07-20',
    metaMatch: 'WEBINAR_TRILHA',
    sendflowRelease: 'sLZ459MRRT9Z2MBe1KV4',
    sendflowGroup: null,
    sendflowMode: 'campaign', // entradas = adds, saídas = removes por dia
    sendflowDesde: '2026-07-10',
    // Diagnósticos do 20/07: da data do webinar até a véspera do próximo (03/08).
    diagDesde: '2026-07-20',
    diagAte: '2026-08-02',
  },

  // 6ª edição — Trilha da Integração (03/08): mesma trilha do 20/07 (Pedro Franco),
  // turma seguinte. Fontes próprias: aba Inscritos_03_08 na planilha dedicada da
  // Trilha e release do Sendflow "Webinar: Trilha de Integração (03/08)". Meta e
  // pesquisa reusam as campanhas WEBINAR_TRILHA, separadas do 20/07 por DATA
  // (captação a partir de 21/07, após o webinar 20/07).
  'webinar-03-08': {
    id: 'webinar-03-08',
    label: 'Webinar Trilha 03/08',
    inscritosSheet: '1q42q1ZlHGmNG0w6Fkm1lM-PazsrI8fzf78EQoPmznR0',
    inscritosGid: 1613671491, // aba Inscritos_03_08
    // Aba dedicada a esta edição → toda inscrição nela é do 03/08 (sem corte de data).
    inscritosDesde: null,
    inscritosAte: null,
    // "Inscritos ADS" pela UTM Source conter WEBINAR_TRILHA (igual ao 20/07).
    inscritosAdsField: 'source',
    inscritosAdsMatch: 'WEBINAR_TRILHA',
    // Pesquisa: mesma planilha do IA, mesma utm WEBINAR_TRILHA do 20/07, separada
    // por data — respostas a partir de 21/07 (após o webinar 20/07) até 03/08 (dia
    // do webinar). Além do corte de data, EXCLUI a utm própria da edição 17/08
    // (WEBINAR_TRILHA_INTEGRACAO_17_AGO): a captação do 17/08 começou em 31/07,
    // ainda dentro da janela do 03/08 — sem o exclude, as duas contariam as mesmas
    // respostas.
    pesquisaDesde: '2026-07-21',
    pesquisaAte: '2026-08-03',
    pesquisaUtmMatch: 'WEBINAR_TRILHA',
    pesquisaUtmExclude: '_17_AGO',
    // Meta: mesmas campanhas WEBINAR_TRILHA, gasto a partir de 21/07 (nova captação).
    // Fecha em 03/08 (dia do webinar): o gasto WEBINAR_TRILHA de 04/08 em diante é
    // captação da edição seguinte (17/08), que reusa as MESMAS campanhas.
    metaDesde: '2026-07-21',
    metaAte: '2026-08-03',
    metaMatch: 'WEBINAR_TRILHA',
    // Release dedicada "Webinar: Trilha de Integração (03/08)". Modo campaign:
    // entradas = adds, saídas = removes por dia. Sem corte (a release é só do 03/08).
    sendflowRelease: 'oJMcyfw9uFd5zYJYZx5l',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 03/08: da data do webinar até a véspera do próximo webinar IA (10/08).
    // Antes era aberto (null), o que faria o 03/08 absorver os diagnósticos do 10/08.
    diagDesde: '2026-08-03',
    diagAte: '2026-08-09',
  },

  // 3ª edição — captação a partir de 04/07 (00h), webinar 13/07.
  'webinar-13-07': {
    id: 'webinar-13-07',
    label: 'Webinar IA 13/07',
    inscritosGid: 1271973666, // aba Inscritos_13_07
    inscritosDesde: '2026-07-04',
    inscritosAte: null,
    pesquisaDesde: '2026-07-04',
    pesquisaAte: null,
    // A aba "Pesquisa Geral" mistura webinars; o 13/07 é separado pela sua própria
    // utm_campaign (respostas vindas da campanha do webinar 13/07).
    pesquisaUtmMatch: 'WEBINAR_IA_13_JUL',
    metaDesde: '2026-07-04',
    // Fecha em 13/07 (dia do webinar): o gasto WEBINAR_IA a partir de 14/07 é
    // captação da edição seguinte (27/07) — sem esse corte, o 13/07 (janela
    // aberta) contaria o gasto do 27/07 em dobro.
    metaAte: '2026-07-13',
    metaMatch: 'WEBINAR_IA',
    sendflowRelease: '41iAdAhbPmpPp0onWRPG',
    sendflowGroup: null,
    sendflowMode: 'campaign', // campanha inteira (entradas e saídas por dia)
    sendflowDesde: '2026-07-04',
    diagDesde: '2026-07-13',
    diagAte: null,
  },

  // 5ª edição — webinar IA de 27/07. Mesmas fontes das edições de IA, com aba de
  // inscritos própria (Inscritos_27_07), release do Sendflow dedicada e pesquisa
  // separada pela utm_campaign da campanha do 27/07.
  'webinar-27-07': {
    id: 'webinar-27-07',
    label: 'Webinar IA 27/07',
    inscritosGid: 68019645, // aba Inscritos_27_07 (planilha padrão do webinar IA)
    // Aba dedicada a esta edição → toda inscrição nela é do 27/07 (sem corte).
    inscritosDesde: null,
    inscritosAte: null,
    // Pesquisa: mesma planilha "Pesquisa Geral" (mistura webinars), separada pela
    // utm_campaign da campanha do 27/07. O padrão de nomeação é WEBINAR_IA_<DD>_<MÊS>
    // (ex.: WEBINAR_IA_13_JUL), então "WEBINAR_IA_27" cobre WEBINAR_IA_27_JUL /
    // WEBINAR_IA_27_JULHO_26 / WEBINAR_IA_27_07 e exige ser WEBINAR IA (não Trilha).
    pesquisaDesde: null,
    pesquisaAte: null,
    pesquisaUtmMatch: 'WEBINAR_IA_27',
    // Campanhas "WEBINAR_IA_04" (ids 120248071509010003 etc.). ATENÇÃO: em 28/07 o
    // time RENOMEOU essas MESMAS campanhas de "| 27.07" para "| 10-08" e passou a
    // usá-las na captação do 10/08 — 27/07 e 10/08 COMPARTILHAM as campanhas. Por
    // isso o 27/07 fecha em 27/07 (metaAte): o gasto de 28/07 em diante é do 10/08.
    metaDesde: '2026-07-14',
    metaAte: '2026-07-27',
    metaMatch: 'WEBINAR_IA_04',
    // Release dedicada (campanha "Webinar: IA na Igreja (27/07)"). Modo campaign:
    // entradas = adds, saídas = removes por dia.
    sendflowRelease: 'JWAVGWZfRnfIXT4eyyo4',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 27/07: da data do webinar até a véspera do próximo webinar IA (10/08).
    // Antes era aberto (null) — o que fazia o 27/07 ABSORVER os diagnósticos do 10/08
    // (e do 03/08), a mesma dupla contagem já observada no 13/07 (que segue aberto).
    diagDesde: '2026-07-27',
    diagAte: '2026-08-09',
  },

  // 7ª edição — Webinar IA 10/08. As 4 fontes ligadas aos dados reais (28/07).
  'webinar-10-08': {
    id: 'webinar-10-08',
    label: 'Webinar IA 10/08',
    // Aba dedicada Inscritos_10_08 (gid 550694705) na planilha padrão do IA → toda
    // inscrição nela é do 10/08 (sem corte de data). ADS = default (UTM Source
    // contém WEBINAR_IA).
    inscritosGid: 550694705,
    inscritosDesde: null,
    inscritosAte: null,
    // Pesquisa: mesma planilha "Pesquisa Geral", separada pela utm_campaign.
    pesquisaDesde: null,
    pesquisaAte: null,
    // Pesquisa do 10/08: utm_campaign contém "WEBINAR_IA_10_AGO" (cobre também
    // DISPARAI_META_WEBINAR_IA_10_AGO, do disparo). Não colide com outras edições.
    pesquisaUtmMatch: 'WEBINAR_IA_10_AGO',
    // Meta: o 10/08 REUSA as MESMAS campanhas do 27/07 — o time renomeou
    // "WEBINAR_IA_04 | 27.07" para "WEBINAR_IA_04 | 10-08" (mesmos ids). Como o nome
    // ainda contém WEBINAR_IA_04, a separação 27/07 × 10/08 é só por DATA: o 27/07
    // fecha em 27/07 (metaAte) e o 10/08 conta de 28/07 (metaDesde) em diante.
    metaDesde: '2026-07-28',
    metaAte: null,
    metaMatch: 'WEBINAR_IA_04',
    // Release dedicada "Webinar: IA na Igreja (10/08)" (live 10/08 19h). Modo
    // campaign: entradas = adds, saídas = removes por dia. Sem corte (release só do 10/08).
    sendflowRelease: 'ZcU7ANHYxOiMroIb3biG',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 10/08: da data do webinar até a véspera do próximo (Trilha 17/08).
    diagDesde: '2026-08-10',
    diagAte: '2026-08-16',
  },

  // 8ª edição — Webinar Igreja Digital 24/08 (Levak × inChurch). Webinar DIFERENTE
  // dos de IA/Trilha. Inscritos e Sendflow ligados às fontes reais (28/07). FALTAM
  // (campos "TODO", pendentes das campanhas do Meta que ainda não foram vinculadas):
  // metaMatch, inscritosAdsMatch e pesquisaUtmMatch — enquanto placeholder, o card
  // Meta fica "indisponível" e Inscritos ADS / Pesquisas / ICPs ficam 0.
  'webinar-24-08': {
    id: 'webinar-24-08',
    label: 'Webinar Igreja Digital 24/08',
    // Planilha de inscritos própria (dedicada ao Igreja Digital), aba
    // Inscritos_24_08 (gid 0). Mesmas colunas da planilha do IA (Data/Email/UTM*).
    inscritosSheet: '1bU9BH1bx23bwqKNVT0welq9EyvyfeFbODZjNYZzQ1NU',
    inscritosGid: 0,
    inscritosDesde: null,
    inscritosAte: null,
    // TODO(ADS): "Inscritos ADS" = tráfego pago, identificado pela UTM Source conter
    // o nome da campanha. Depende das campanhas do Meta (ainda não vinculadas). O
    // placeholder NÃO casa nada de propósito → ADS fica 0 e não conta por engano
    // linhas de outras campanhas (ex.: a única inscrição atual veio de WEBINAR_IA).
    // Ao vincular, trocar para o termo real (o MESMO usado em metaMatch).
    inscritosAdsField: 'source',
    inscritosAdsMatch: 'IGREJA_DIGITAL__TODO',
    // Pesquisa: mesma planilha "Pesquisa Geral", separada pela utm_campaign.
    pesquisaDesde: null,
    pesquisaAte: null,
    // TODO(pesquisa): pôr a utm_campaign real do Igreja Digital quando começarem as
    // respostas (ainda não há token na planilha). Placeholder não casa nada → 0.
    pesquisaUtmMatch: 'IGREJA_DIGITAL__TODO',
    // TODO(meta): pôr o termo único do nome da campanha do Igreja Digital (ainda não
    // vinculada). Placeholder não casa campanha → card Meta "indisponível"/0.
    metaDesde: '2026-07-28',
    metaAte: null,
    metaMatch: 'IGREJA_DIGITAL__TODO',
    // Release dedicada "Webinar: Igreja Digital" (grupo Igreja Digital). Modo
    // campaign: entradas = adds, saídas = removes por dia. Sem corte (release só desta edição).
    sendflowRelease: 'GOyYgAfg2V3AvG25qZ49',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 24/08 (futuro): diagnósticos (planilha compartilhada) só a partir daí.
    diagDesde: '2026-08-24',
    diagAte: null,
  },

  // 9ª edição — Trilha da Integração (17/08): mesma trilha do 20/07 e do 03/08
  // (Pedro Franco), turma seguinte. Aba de inscritos e release do Sendflow
  // próprias; Meta reusa as MESMAS campanhas WEBINAR_TRILHA (separação por DATA,
  // a partir de 04/08) e a pesquisa é separada pela utm_campaign própria.
  'webinar-17-08': {
    id: 'webinar-17-08',
    label: 'Webinar Trilha 17/08',
    inscritosSheet: '1q42q1ZlHGmNG0w6Fkm1lM-PazsrI8fzf78EQoPmznR0',
    inscritosGid: 1358620876, // aba Inscritos_17_08
    // Aba dedicada a esta edição → toda inscrição nela é do 17/08 (sem corte de data).
    inscritosDesde: null,
    inscritosAte: null,
    // "Inscritos ADS": aqui NÃO dá para identificar o pago por um termo na UTM
    // Source — o tráfego pago chega com a macro quebrada `{{TRILHA_17.08}}`, com o
    // nome da campanha ("...| WEBINAR_TRILHA | 02") ou com `{{campaign.name}}`.
    // O que é constante é o ORGÂNICO: source CONTEUDO (LP /webinar-integracao/organico/,
    // medium GRUPOS / GRUPOS_WHATSAPP). Então invertemos o critério: é ADS tudo que
    // tem UTM Source preenchida e NÃO está na lista de origens não-pagas.
    inscritosAdsField: 'source',
    inscritosAdsExclude: ['CONTEUDO', 'EMAIL', 'ORGANIC'],
    // Pesquisa: mesma planilha "Pesquisa Geral", separada pela utm_campaign própria
    // desta turma (WEBINAR_TRILHA_INTEGRACAO_17_AGO). Sem corte de data: a captação
    // do 17/08 começou em 31/07, sobreposta à do 03/08 — quem separa é a utm.
    pesquisaDesde: null,
    pesquisaAte: null,
    pesquisaUtmMatch: 'WEBINAR_TRILHA_INTEGRACAO_17_AGO',
    // Meta: as MESMAS campanhas WEBINAR_TRILHA do 20/07 e do 03/08 (a "LP01" segue
    // ativa e as novas 02–07 nasceram em 31/07, todas com WEBINAR_TRILHA no nome) —
    // a separação é só por DATA: o 03/08 fecha em 03/08 e o 17/08 conta de 04/08.
    metaDesde: '2026-08-04',
    metaAte: null,
    metaMatch: 'WEBINAR_TRILHA',
    // Release dedicada "Webinar: Trilha de Integração (17/08)". Modo campaign:
    // entradas = adds, saídas = removes por dia. Sem corte (release só desta edição).
    sendflowRelease: 'DFCx0CudRVYGjU0UJHpN',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 17/08 (futuro): da data do webinar até a véspera do próximo (24/08).
    diagDesde: '2026-08-17',
    diagAte: '2026-08-23',
  },
};

export const DEFAULT_EDITION = 'webinar-13-07';

// "DD/MM/AAAA[ HH:MM:SS]" -> "AAAA-MM-DDTHH:MM:SS" (ordenável). null se inválido.
// Sem hora vira 00:00:00. Serve tanto p/ "Submitted At" quanto p/ "Data" (só dia).
export function brToTs(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v || '').trim());
  if (!m) return null;
  const [, d, mo, y, hh = '00', mi = '00', ss = '00'] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${hh.padStart(2, '0')}:${mi.padStart(2, '0')}:${ss.padStart(2, '0')}`;
}

// Converte um limite da config em timestamp ordenável. Aceita "AAAA-MM-DD" (dia
// inteiro: início 00:00:00, fim 23:59:59) ou "AAAA-MM-DD HH:MM[:SS]". null = sem limite.
export function toBoundTs(s, isEnd) {
  if (!s) return null;
  if (s.length <= 10) return isEnd ? `${s}T23:59:59` : `${s}T00:00:00`;
  const norm = s.replace(' ', 'T');
  return norm.length === 16 ? `${norm}:00` : norm;
}

export function getEdition(idOrReq) {
  let id = idOrReq;
  if (idOrReq && typeof idOrReq === 'object') {
    // Aceita o objeto `req` diretamente.
    id = (idOrReq.query && idOrReq.query.ed) || null;
    if (!id && idOrReq.url) {
      try { id = new URL(idOrReq.url, 'http://x').searchParams.get('ed'); } catch { /* ignore */ }
    }
  }
  return EDITIONS[id] || EDITIONS[DEFAULT_EDITION];
}
