// Vercel Serverless Function — puxa métricas de captação direto do Meta Ads.
// O token fica seguro no servidor (env var META_ACCESS_TOKEN) e nunca vai ao navegador.

const AD_ACCOUNT_ID = '1511142633474747'; // InChurch 03 [Cartão de crédito]
const CAMPAIGN_IDS = [
  '120246999746290003', // [IN][INCH][LEADS] TOPO DE FUNIL | WEBINAR_IA_02 | 29_06 [2]
  '120247329870910003', // ...[3]_Teste_LP_Branca
];
const GRAPH_VERSION = 'v21.0';

export default async function handler(_req, res) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN não configurado na Vercel.' });
  }

  try {
    const params = new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,actions',
      filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: CAMPAIGN_IDS }]),
      date_preset: 'maximum',
      limit: '100',
      access_token: token,
    });

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/act_${AD_ACCOUNT_ID}/insights?${params}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      return res.status(502).json({ error: json.error.message });
    }

    let spend = 0;
    let leads = 0;
    for (const row of json.data || []) {
      spend += parseFloat(row.spend || '0');
      const leadAction = (row.actions || []).find((a) => a.action_type === 'lead');
      if (leadAction) leads += parseFloat(leadAction.value || '0');
    }

    const cpl = leads > 0 ? spend / leads : 0;

    // Cache na borda da Vercel por 5 min (mesma cadência do sync da planilha).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      investimentoTrafego: spend,
      leadsMeta: leads,
      cplMeta: cpl,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
