// Vercel Serverless Function — COBERTURA DE MÍDIA.
//
// Responde uma pergunta que nenhuma das outras funções responde: existe campanha
// de webinar gastando dinheiro que NÃO está caindo em edição nenhuma do painel?
//
// POR QUE EXISTE: cada edição tem a sua janela (`metaDesde`/`metaAte`) e o seu
// filtro de nome (`metaMatch`). Quando o time cria uma campanha nova, renomeia uma
// existente ou o painel ganha uma edição sem atualizar esses campos, o gasto some
// da tela — e some em silêncio, porque todos os cards continuam mostrando números
// coerentes entre si. Foi exatamente o que aconteceu com o Igreja Digital 24/08:
// R$ 6.570 de mídia e ~899 leads rodaram por 9 dias fora do painel, e só apareceu
// quando alguém foi conferir na mão.
//
// Aqui a conta é feita ao contrário: pergunta à Graph API TUDO que a conta gastou
// em campanhas com "WEBINAR" no nome, sem recorte de edição. O painel compara essa
// lista com a soma das edições e avisa o que ficou de fora. Uma requisição só, em
// nível de campanha e sem série diária — é barata.

import { EDITIONS } from './_editions.js';
import { fetchComRetry } from './_http.js';

const DEFAULT_AD_ACCOUNT_ID = '1511142633474747'; // InChurch 03 [Cartão de crédito]
const GRAPH_VERSION = 'v21.0';

// Termo que cobre as três linhas de webinar (WEBINAR_IA, WEBINAR_TRILHA,
// WEBINAR_IGREJA_DIGITAL). Edições fora dessa conta (ex.: a Calculadora de
// Líderes, que roda na "inChurch - Principal") ficam fora desta checagem — elas
// não competem pelo mesmo orçamento nem pelo mesmo filtro.
const TERMO = 'WEBINAR';

// Piso da varredura: a 1ª edição do painel começa a captar em 29/05/2026.
const DESDE = '2026-05-01';

export default async function handler(req, res) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'META_ACCESS_TOKEN não está configurado na Vercel.', permanente: true });
  }

  const ate = new Date().toISOString().slice(0, 10);
  const params = {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend',
    time_range: JSON.stringify({ since: DESDE, until: ate }),
    filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: TERMO }]),
    limit: '500',
    access_token: token,
  };

  try {
    let url = `https://graph.facebook.com/${GRAPH_VERSION}/act_${DEFAULT_AD_ACCOUNT_ID}/insights?` + new URLSearchParams(params);
    const linhas = [];
    for (let page = 0; page < 10 && url; page++) {
      const r = await fetchComRetry(url, { timeoutMs: 6000, orcamentoMs: 11000 });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'Erro da Graph API');
      if (Array.isArray(j.data)) linhas.push(...j.data);
      url = j.paging && j.paging.next ? j.paging.next : null;
    }

    // Rede de segurança: se a Graph API ignorar o `filtering`, a conta inteira
    // voltaria aqui e o painel acusaria "mídia fora das edições" que na verdade é
    // de outro funil. O filtro por nome é reaplicado no Node.
    const campanhas = linhas
      .filter((row) => String(row.campaign_name || '').toUpperCase().includes(TERMO))
      .map((row) => ({
        id: row.campaign_id,
        nome: row.campaign_name,
        spend: parseFloat(row.spend || '0'),
      }))
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend);

    const total = campanhas.reduce((a, c) => a + c.spend, 0);

    // Edições que disputam ESTA conta — as únicas que o painel deve comparar com a
    // lista acima. `metaAccount` marca as que rodam em outra conta.
    const edicoesDaConta = Object.values(EDITIONS)
      .filter((e) => !e.metaAccount)
      .map((e) => e.id);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({
      conta: DEFAULT_AD_ACCOUNT_ID,
      termo: TERMO,
      desde: DESDE,
      ate,
      total,
      campanhas,
      edicoesDaConta,
    });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: String(err.message || err) });
  }
}
