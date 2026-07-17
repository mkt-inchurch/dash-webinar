// Edições do Webinar IA (lado cliente). O detalhamento das fontes por edição fica
// no servidor (api/_editions.js); aqui só o necessário para o seletor e o rótulo.
// Mantenha os `id` iguais aos de api/_editions.js.

export interface Edition {
  id: string;
  label: string;
}

// Mais recente primeiro (a primeira também é o rótulo padrão do seletor).
export const EDITIONS: Edition[] = [
  { id: 'webinar-27-07', label: 'Webinar IA 27/07' },
  { id: 'webinar-20-07', label: 'Webinar Trilha 20/07' },
  { id: 'webinar-13-07', label: 'Webinar IA 13/07' },
  { id: 'webinar-04-07', label: 'Webinar IA 04/07' },
  { id: 'webinar-15-06', label: 'Webinar IA 15/06' },
];

export const DEFAULT_EDITION = 'webinar-13-07';

export const editionLabel = (id: string) =>
  EDITIONS.find((e) => e.id === id)?.label ?? id;
