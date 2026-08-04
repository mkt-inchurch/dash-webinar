// Vercel Serverless Function — "Entradas no Grupo" a partir do Sendflow.
// Valor = ENTRADAS (brutas) por dia dentro da janela da edição; no modo 'campaign'
// as saídas são as remoções reais por dia, no modo 'group' são estimadas
// (entradas − membros atuais do grupo). Retorna a série diária (porDia) p/ o filtro.
//
// IMPORTANTE — esta função NÃO fala com a SendAPI. Ela lê o snapshot publicado pela
// coleta agendada (.github/workflows/sendflow-snapshot.yml → branch `data`).
// Motivo: a SendAPI bloqueia a CONTA/IP por 24h (`api-key-blocked`) por excesso de
// requisições, e no modelo antigo (consulta ao vivo) o volume crescia com o tráfego,
// com o nº de edições e com a tela de Comparação — o bloqueio nunca esfriava. Agora
// quem consulta é só o job de hora em hora: volume fixo, de um IP do GitHub.
// Se o card ficar desatualizado, o lugar de olhar é o Actions do repo (não as chaves).

import { getEdition } from './_editions.js';

const SNAPSHOT_URL =
  process.env.SENDFLOW_SNAPSHOT_URL ||
  'https://raw.githubusercontent.com/mkt-inchurch/dash-webinar/data/sendflow-snapshot.json';

export default async function handler(req, res) {
  const ed = getEdition(req);

  if (!ed.sendflowRelease) {
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(502).json({ error: 'Esta edição não tem campanha do Sendflow configurada.' });
  }

  try {
    const r = await fetch(SNAPSHOT_URL, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      res.setHeader('Cache-Control', 's-maxage=300');
      return res.status(502).json({
        error: `Snapshot do Sendflow indisponível (${r.status}). Rode o workflow "Sendflow snapshot" no GitHub Actions.`,
      });
    }
    const snap = await r.json();
    const dados = snap.edicoes && snap.edicoes[ed.id];
    if (!dados) {
      // Edição recém-criada (o job ainda não rodou) ou erro na coleta dela.
      res.setHeader('Cache-Control', 's-maxage=300');
      return res.status(502).json({
        error: 'Edição ainda não está no snapshot do Sendflow.',
        detail: (snap.erros && snap.erros[ed.id]) || `último snapshot: ${snap.geradoEm || '?'}`,
      });
    }

    // O snapshot é reescrito de hora em hora; 10 min de cache de borda mantêm o
    // painel fresco sem transformar cada poll em uma leitura do raw.githubusercontent.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ ...dados, geradoEm: snap.geradoEm });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
