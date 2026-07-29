// Métricas das transmissões ao vivo (YouTube Studio) por edição do webinar.
//
// FONTE: extração MANUAL do YouTube Studio, consolidada na planilha
// https://docs.google.com/spreadsheets/d/1ZAm95U-oeHspF8zUupiZj4JE7E4qL6wi4M4pii0KzfM
// (não há API conectada — o YouTube Analytics exigiria OAuth). Para atualizar,
// basta reextrair do Studio e editar os valores abaixo (e a data de extração).
//
// Os valores são strings exatamente como aparecem no relatório: alguns são exatos
// (ex.: "3.129") e outros vêm arredondados pelo próprio Studio (ex.: "5,5 mil").
// Só as edições listadas têm dados de live; as demais não exibem a seção.

export const LIVE_EXTRACTION_DATE = '28/07/2026';

export interface LiveMetrics {
  titulo: string;
  dataHora: string;
  duracao: string;
  visualizacoes: string;
  alcance: string;
  impressoes: string;
  chat: string;
  duracaoMedia: string;
  picoSimultaneos: string;
  mediaSimultaneos: string;
  // true quando a extração foi feita logo após a live e os números ainda estão
  // sendo processados pelo YouTube (não comparáveis com edições consolidadas).
  processando?: boolean;
}

// Chaveado pelo id da edição (igual aos de editions.ts / api/_editions.js).
export const LIVE_METRICS: Record<string, LiveMetrics> = {
  'webinar-15-06': {
    titulo: 'Aula IA nas Igrejas',
    dataHora: '15/06/2026, 20h',
    duracao: '02:28:25',
    visualizacoes: '3.129',
    alcance: '1,7 mil',
    impressoes: '5,5 mil',
    chat: '1.745',
    duracaoMedia: '20:51',
    picoSimultaneos: '407',
    mediaSimultaneos: '281',
  },
  'webinar-20-07': {
    titulo: 'Trilha da Integração',
    dataHora: '20/07/2026, 19h',
    duracao: '02:01:42',
    visualizacoes: '2.675',
    alcance: '1,5 mil',
    impressoes: '5,8 mil',
    chat: '1.298',
    duracaoMedia: '19:14',
    picoSimultaneos: '381',
    mediaSimultaneos: '297',
  },
  'webinar-27-07': {
    titulo: 'Aula IA nas Igrejas',
    dataHora: '27/07/2026, 19h',
    duracao: '02:07:31',
    visualizacoes: '580',
    alcance: 'n/d (processando)',
    impressoes: '309',
    chat: '91',
    duracaoMedia: '16:38',
    picoSimultaneos: '103',
    mediaSimultaneos: '65',
    processando: true,
  },
};

export const getLiveMetrics = (editionId: string): LiveMetrics | undefined =>
  LIVE_METRICS[editionId];
