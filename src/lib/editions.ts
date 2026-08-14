// Edições do painel (lado cliente). O detalhamento das fontes por edição fica
// no servidor (api/_editions.js); aqui só o necessário para o seletor e o rótulo.
// Mantenha os `id` iguais aos de api/_editions.js.

export interface Edition {
  id: string;
  label: string;
  // Edições sem etapa de pesquisa (a qualificação já vem no próprio formulário de
  // captação). O card "Total de Pesquisas" some da tela — exibi-lo zerado dava a
  // entender que ninguém respondeu, quando na verdade a etapa não existe.
  // Espelha `pesquisaFonte: 'nenhuma'` em api/_editions.js.
  semPesquisas?: boolean;
}

// Mais recente primeiro (a primeira também é o rótulo padrão do seletor).
export const EDITIONS: Edition[] = [
  { id: 'calculadora-lideres', label: 'Calculadora de Líderes', semPesquisas: true },
  { id: 'webinar-24-08', label: 'Webinar Igreja Digital 24/08' },
  { id: 'webinar-17-08', label: 'Webinar Trilha 17/08' },
  { id: 'webinar-10-08', label: 'Webinar IA 10/08' },
  { id: 'webinar-03-08', label: 'Webinar Trilha 03/08' },
  { id: 'webinar-27-07', label: 'Webinar IA 27/07' },
  { id: 'webinar-20-07', label: 'Webinar Trilha 20/07' },
  { id: 'webinar-13-07', label: 'Webinar IA 13/07' },
  { id: 'webinar-04-07', label: 'Webinar IA 04/07' },
  { id: 'webinar-15-06', label: 'Webinar IA 15/06' },
];

export const DEFAULT_EDITION = 'webinar-13-07';

export const editionLabel = (id: string) =>
  EDITIONS.find((e) => e.id === id)?.label ?? id;

// Esta edição tem etapa de pesquisa? (falso só nas que qualificam no formulário)
export const editionTemPesquisas = (id: string) =>
  !EDITIONS.find((e) => e.id === id)?.semPesquisas;
