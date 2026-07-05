// Vercel Serverless Function — métricas do Meta Ads das campanhas do webinar.
// Token seguro no servidor (env var META_ACCESS_TOKEN).
//
// Faz 2 consultas (só campanhas cujo nome contém WEBINAR_IA, desde 19/06):
//  - diária (time_increment=1): série por dia para KPIs filtráveis e gráficos.
//  - por campanha (período total, com reach): tabela + gráficos "Por Campanha".

import { getEdition } from './_editions.js';

const AD_ACCOUNT_ID = '1511142633474747'; // InChurch 03 [Cartão de crédito]
const GRAPH_VERSION = 'v21.0';

function actionVal(actions, type) {
  const a = (actions || []).find((x) => x.action_type === type);
  return a ? parseFloat(a.value || '0') : 0;
}
const num = (v) => parseInt(v || '0', 10) || 0;

async function fetchInsights(token, daily, since, until, match) {
  const params = {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,reach,actions',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    access_token: token,
  };
  if (daily) params.time_increment = '1';
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/act_${AD_ACCOUNT_ID}/insights?` + new URLSearchParams(params);
  const all = [];
  for (let page = 0; page < 10 && url; page++) {
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    if (Array.isArray(j.data)) all.push(...j.data);
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return all.filter((row) => String(row.campaign_name || '').includes(match));
}

export default async function handler(req, res) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN não configurado na Vercel.' });
  }

  const ed = getEdition(req);
  const since = ed.metaDesde;
  const until = ed.metaAte || new Date().toISOString().slice(0, 10);
  const match = ed.metaMatch;

  try {
    const [dailyRows, campRows] = await Promise.all([
      fetchInsights(token, true, since, until, match),
      fetchInsights(token, false, since, until, match),
    ]);

    // ---- Série diária (KPIs filtráveis + gráficos de tendência) ----
    const byDay = {};
    for (const row of dailyRows) {
      const day = row.date_start;
      if (!byDay[day]) byDay[day] = { spend: 0, leads: 0, impressions: 0, reach: 0, linkClicks: 0, lpViews: 0 };
      byDay[day].spend += parseFloat(row.spend || '0');
      byDay[day].leads += actionVal(row.actions, 'lead');
      byDay[day].impressions += num(row.impressions);
      byDay[day].reach += num(row.reach);
      byDay[day].linkClicks += actionVal(row.actions, 'link_click');
      byDay[day].lpViews += actionVal(row.actions, 'landing_page_view');
    }
    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, v]) => ({ data, ...v }));

    let spend = 0, leads = 0;
    for (const d of porDia) { spend += d.spend; leads += d.leads; }

    // ---- Por campanha (período total, com reach dedup por campanha) ----
    const campanhas = campRows
      .map((row) => {
        const s = parseFloat(row.spend || '0');
        const imp = num(row.impressions);
        const reach = num(row.reach);
        const lc = actionVal(row.actions, 'link_click');
        const lpv = actionVal(row.actions, 'landing_page_view');
        const conv = actionVal(row.actions, 'lead');
        return {
          id: row.campaign_id,
          name: row.campaign_name,
          spend: s,
          impressoes: imp,
          alcance: reach,
          frequencia: reach > 0 ? imp / reach : 0,
          linkClicks: lc,
          lpViews: lpv,
          ctrLink: imp > 0 ? lc / imp : 0,
          cpm: imp > 0 ? (s / imp) * 1000 : 0,
          cpc: lc > 0 ? s / lc : 0,
          conversoes: conv,
          cpl: conv > 0 ? s / conv : 0,
        };
      })
      .filter((c) => c.spend > 0 || c.conversoes > 0)
      .sort((a, b) => b.spend - a.spend);

    // Alcance/Frequência do PERÍODO TOTAL (reach não é somável por dia). Soma o
    // reach por campanha (aproxima; ainda conta 2x quem está em >1 campanha).
    let totalReach = 0, totalImp = 0;
    for (const c of campanhas) { totalReach += c.alcance; totalImp += c.impressoes; }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      investimentoTrafego: spend,
      leadsMeta: leads,
      cplMeta: leads > 0 ? spend / leads : 0,
      alcance: totalReach,
      frequencia: totalReach > 0 ? totalImp / totalReach : 0,
      porDia,
      campanhas,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
