// Configuração das edições do Webinar IA. Cada edição aponta para suas próprias
// fontes (aba de inscritos, campanha do Sendflow, janelas de data do Meta/pesquisa
// /diagnósticos). As serverless functions leem `?ed=<id>` e usam esta config.
// Datas ISO "AAAA-MM-DD"; `ate: null` = aberto (até hoje).

export const EDITIONS = {
  // 2ª edição — captação 19/06→03/07, webinar 04/07, diagnósticos 04–12/07.
  'webinar-04-07': {
    id: 'webinar-04-07',
    label: 'Webinar 04/07',
    inscritosTab: 'Inscritos_29_06',
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

  // 3ª edição — captação a partir de 04/07 (00h), webinar 13/07.
  'webinar-13-07': {
    id: 'webinar-13-07',
    label: 'Webinar 13/07',
    inscritosTab: 'Inscritos_13_07',
    inscritosDesde: '2026-07-04',
    inscritosAte: null,
    pesquisaDesde: '2026-07-04',
    pesquisaAte: null,
    metaDesde: '2026-07-04',
    metaAte: null,
    metaMatch: 'WEBINAR_IA',
    sendflowRelease: '41iAdAhbPmpPp0onWRPG',
    sendflowGroup: null,
    sendflowMode: 'campaign', // campanha inteira (entradas e saídas por dia)
    sendflowDesde: '2026-07-04',
    diagDesde: '2026-07-13',
    diagAte: null,
  },
};

export const DEFAULT_EDITION = 'webinar-13-07';

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
