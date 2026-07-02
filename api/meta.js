// Vercel Serverless Function — puxa métricas de captação direto do Meta Ads.
// O token fica seguro no servidor (env var META_ACCESS_TOKEN) e nunca vai ao navegador.
//
// Soma TODAS as campanhas de captação do webinar (nome contém WEBINAR_IA), para
// bater com o total do painel de anúncios e incluir novas campanhas automaticamente.

const AD_ACCOUNT_ID = '1511142633474747'; // InChurch 03 [Cartão de crédito]
const CAMPAIGN_NAME_MATCH = 'WEBINAR_IA'; // filtra as campanhas de captação do webinar
const GRAPH_VERSION = 'v21.0';

async function fetchCampaigns(token) {
  let url =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${AD_ACCOUNT_ID}/insights?` +
    new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,actions',
      date_preset: 'maximum', // campanhas do webinar começam em 19/06 = vida toda
      limit: '200',
      access_token: token,
    });

  const all = [];
  for (let page = 0; page < 10 && url; page++) {
    const response = await fetch(url);
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    if (Array.isArray(json.data)) all.push(...json.data);
    url = json.paging && json.paging.next ? json.paging.next : null;
  }
  return all;
}

export default async function handler(_req, res) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN não configurado na Vercel.' });
  }

  try {
    const campaigns = await fetchCampaigns(token);

    let spend = 0;
    let leads = 0;
    let campanhas = 0;
    for (const row of campaigns) {
      if (!String(row.campaign_name || '').includes(CAMPAIGN_NAME_MATCH)) continue;
      const s = parseFloat(row.spend || '0');
      const leadAction = (row.actions || []).find((a) => a.action_type === 'lead');
      const l = leadAction ? parseFloat(leadAction.value || '0') : 0;
      spend += s;
      leads += l;
      if (s > 0 || l > 0) campanhas++;
    }

    const cpl = leads > 0 ? spend / leads : 0;

    // Cache na borda da Vercel por 5 min (mesma cadência do resto do dashboard).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      investimentoTrafego: spend,
      leadsMeta: leads,
      cplMeta: cpl,
      campanhas,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
