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
//
// Além do snapshot, esta função serve o ESTADO DA COLETA (`sendflow-status.json`,
// publicado pelo mesmo job a cada tentativa, inclusive nas que falham). É o que
// permite ao painel dizer "a coleta está falhando desde X, e rodar o workflow não
// resolve" em vez de só "o snapshot está velho" — duas situações que pedem ações
// opostas e que a idade do snapshot, sozinha, não distingue.

import { getEdition } from './_editions.js';

const SNAPSHOT_URL =
  process.env.SENDFLOW_SNAPSHOT_URL ||
  'https://raw.githubusercontent.com/mkt-inchurch/dash-webinar/data/sendflow-snapshot.json';
const STATUS_URL = SNAPSHOT_URL.replace(/sendflow-snapshot\.json$/, 'sendflow-status.json');

// O status é um extra: se faltar (branch ainda sem o arquivo, run antigo, rede), a
// função segue servindo o snapshot normalmente e o painel cai no aviso só por idade,
// que é o comportamento que existia antes. Nunca deixe isso derrubar o card.
async function lerStatus() {
  try {
    const r = await fetch(STATUS_URL, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j.em === 'string' ? j : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const ed = getEdition(req);

  if (!ed.sendflowRelease) {
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(502).json({ error: 'Esta edição não tem campanha do Sendflow configurada.' });
  }

  try {
    // Em paralelo: o status não pode custar uma viagem a mais no caminho crítico.
    const [r, coleta] = await Promise.all([
      fetch(SNAPSHOT_URL, { headers: { Accept: 'application/json' } }),
      lerStatus(),
    ]);
    if (!r.ok) {
      res.setHeader('Cache-Control', 's-maxage=300');
      return res.status(502).json({
        error: `Snapshot do Sendflow indisponível (${r.status}).` +
          (coleta && coleta.ok === false
            ? ` A coleta falhou em ${coleta.em}: ${coleta.dica || coleta.causa}`
            : ' Rode o workflow "Sendflow snapshot" no GitHub Actions.'),
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
    return res.status(200).json({
      ...dados,
      geradoEm: snap.geradoEm,
      ...(coleta ? { coleta } : {}),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
