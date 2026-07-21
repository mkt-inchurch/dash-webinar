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
    // por data — respostas a partir de 21/07 (após o webinar 20/07).
    pesquisaDesde: '2026-07-21',
    pesquisaAte: null,
    pesquisaUtmMatch: 'WEBINAR_TRILHA',
    // Meta: mesmas campanhas WEBINAR_TRILHA, gasto a partir de 21/07 (nova captação).
    metaDesde: '2026-07-21',
    metaAte: null,
    metaMatch: 'WEBINAR_TRILHA',
    // Release dedicada "Webinar: Trilha de Integração (03/08)". Modo campaign:
    // entradas = adds, saídas = removes por dia. Sem corte (a release é só do 03/08).
    sendflowRelease: 'oJMcyfw9uFd5zYJYZx5l',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 03/08 (futuro): diagnósticos só a partir daí.
    diagDesde: '2026-08-03',
    diagAte: null,
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
    // Campanha própria do 27/07: "…| WEBINAR_IA_04 | 27.07" (id 120248071509010003).
    // O termo WEBINAR_IA_04 é único desta edição (as antigas são WEBINAR_IA_02),
    // então isola o gasto sem depender de data. Mantém metaDesde 14/07 como piso
    // (a campanha foi criada agora e não teve gasto antes disso).
    metaDesde: '2026-07-14',
    metaAte: null,
    metaMatch: 'WEBINAR_IA_04',
    // Release dedicada (campanha "Webinar: IA na Igreja (27/07)"). Modo campaign:
    // entradas = adds, saídas = removes por dia.
    sendflowRelease: 'JWAVGWZfRnfIXT4eyyo4',
    sendflowGroup: null,
    sendflowMode: 'campaign',
    sendflowDesde: null,
    // Webinar 27/07 (futuro): diagnósticos só a partir daí.
    diagDesde: '2026-07-27',
    diagAte: null,
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
