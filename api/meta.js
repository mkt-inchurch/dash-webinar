// Vercel Serverless Function — puxa métricas de captação direto do Meta Ads.
// O token fica seguro no servidor (env var META_ACCESS_TOKEN) e nunca vai ao navegador.
//
// Soma TODAS as campanhas de captação do webinar (nome contém WEBINAR_IA), para
// bater com o total do painel de anúncios e incluir novas campanhas automaticamente.

const AD_ACCOUNT_ID = '1511142633474747'; // InChurch 03 [Cartão de crédito]
const CAMPAIGN_NAME_MATCH = 'WEBINAR_IA'; // filtra as campanhas de captação do webinar
const CAPTACAO_INICIO = '2026-06-19'; // início da captação (ignora webinars anteriores)
const GRAPH_VERSION = 'v21.0';

async function fetchCampaigns(token) {
  // Recorte a partir de 19/06: campanhas antigas com "WEBINAR_IA" no nome (de um
  // webinar anterior) zeram nessa janela e não entram no total.
  const until = new Date().toISOString().slice(0, 10);
  let url =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${AD_ACCOUNT_ID}/insights?` +
    new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,impressions,actions',
      time_range: JSON.stringify({ since: CAPTACAO_INICIO, until }),
      time_increment: '1', // quebra diária, para o filtro temporal do dashboard
      limit: '500',
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
    const rows = await fetchCampaigns(token);

    // Cada linha é uma campanha em um dia (time_increment=1). Soma por dia, só
    // campanhas WEBINAR_IA.
    const actionVal = (actions, type) => {
      const a = (actions || []).find((x) => x.action_type === type);
      return a ? parseFloat(a.value || '0') : 0;
    };

    const byDay = {};
    const campanhasIds = new Set();
    for (const row of rows) {
      if (!String(row.campaign_name || '').includes(CAMPAIGN_NAME_MATCH)) continue;
      const day = row.date_start;
      const s = parseFloat(row.spend || '0');
      const l = actionVal(row.actions, 'lead');
      const imp = parseInt(row.impressions || '0', 10) || 0;
      const linkClicks = actionVal(row.actions, 'link_click');
      const lpViews = actionVal(row.actions, 'landing_page_view');
      if (!byDay[day]) byDay[day] = { spend: 0, leads: 0, impressions: 0, linkClicks: 0, lpViews: 0 };
      byDay[day].spend += s;
      byDay[day].leads += l;
      byDay[day].impressions += imp;
      byDay[day].linkClicks += linkClicks;
      byDay[day].lpViews += lpViews;
      if (s > 0 || l > 0) campanhasIds.add(row.campaign_id);
    }

    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, v]) => ({
        data,
        spend: v.spend,
        leads: v.leads,
        impressions: v.impressions,
        linkClicks: v.linkClicks,
        lpViews: v.lpViews,
      }));

    let spend = 0, leads = 0;
    for (const d of porDia) { spend += d.spend; leads += d.leads; }
    const cpl = leads > 0 ? spend / leads : 0;

    // Cache na borda da Vercel por 5 min (mesma cadência do resto do dashboard).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      investimentoTrafego: spend,
      leadsMeta: leads,
      cplMeta: cpl,
      campanhas: campanhasIds.size,
      porDia,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
