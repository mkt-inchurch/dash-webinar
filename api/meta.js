// Vercel Serverless Function — métricas do Meta Ads das campanhas do webinar.
// Token seguro no servidor (env var META_ACCESS_TOKEN).
//
// Faz 2 consultas (só campanhas cujo nome contém WEBINAR_IA, desde 19/06):
//  - diária (time_increment=1): série por dia para KPIs filtráveis e gráficos.
//  - por campanha (período total, com reach): tabela + gráficos "Por Campanha".

import { getEdition } from './_editions.js';

// Conta padrão das campanhas de webinar. Edições cuja mídia roda em outra conta
// (ex.: a Calculadora de Líderes, na "inChurch - Principal") definem `metaAccount`.
const DEFAULT_AD_ACCOUNT_ID = '1511142633474747'; // InChurch 03 [Cartão de crédito]
const GRAPH_VERSION = 'v21.0';

function actionVal(actions, type) {
  const a = (actions || []).find((x) => x.action_type === type);
  return a ? parseFloat(a.value || '0') : 0;
}
const num = (v) => parseInt(v || '0', 10) || 0;

async function fetchInsights(token, account, daily, since, until, match) {
  const params = {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,reach,actions',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    access_token: token,
  };
  if (daily) params.time_increment = '1';
  let url = `https://graph.facebook.com/${GRAPH_VERSION}/act_${account}/insights?` + new URLSearchParams(params);
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

// Alcance REAL do conjunto de campanhas da edição: uma consulta no nível da CONTA
// filtrando por nome de campanha, que devolve o reach já deduplicado (uma pessoa
// impactada por 3 campanhas conta 1). Antes o painel somava o reach campanha a
// campanha, o que inflava o alcance e, por consequência, DEFLACIONAVA a frequência
// (impressões ÷ alcance). Se o filtro não for aceito pela Graph API, devolve null
// e o chamador cai no comportamento antigo (soma), sinalizando isso na resposta.
async function fetchAlcanceDedup(token, account, since, until, match) {
  const params = {
    level: 'account',
    fields: 'spend,impressions,reach',
    time_range: JSON.stringify({ since, until }),
    filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: match }]),
    limit: '10',
    access_token: token,
  };
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/act_${account}/insights?` + new URLSearchParams(params)
    );
    const j = await r.json();
    if (j.error || !Array.isArray(j.data) || !j.data.length) return null;
    const reach = num(j.data[0].reach);
    const impressions = num(j.data[0].impressions);
    const spend = parseFloat(j.data[0].spend || '0');
    return reach > 0 ? { reach, impressions, spend } : null;
  } catch {
    return null;
  }
}

// O alcance deduplicado só vale se a consulta no nível da conta tiver respeitado o
// filtro de nome de campanha. Se a Graph API ignorasse o `filtering`, ela devolveria
// a conta INTEIRA (outros webinars, meio de funil) e o alcance ficaria maior, não
// menor. O gasto é a prova: no recorte certo ele bate com a soma das campanhas.
// Também exigimos reach <= soma por campanha, que é o teto matemático da dedup.
function dedupConfere(dedup, gastoCampanhas, somaReach) {
  if (!dedup) return false;
  const difGasto = Math.abs(dedup.spend - gastoCampanhas);
  const tolerancia = Math.max(1, gastoCampanhas * 0.01); // 1% ou R$1
  return difGasto <= tolerancia && dedup.reach <= somaReach;
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
  const account = ed.metaAccount || DEFAULT_AD_ACCOUNT_ID;

  try {
    const [dailyRows, campRows, dedup] = await Promise.all([
      fetchInsights(token, account, true, since, until, match),
      fetchInsights(token, account, false, since, until, match),
      fetchAlcanceDedup(token, account, since, until, match),
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

    // Alcance/Frequência do PERÍODO TOTAL (reach não é somável por dia).
    // Preferência: o reach deduplicado da consulta no nível da conta. Fallback:
    // soma do reach por campanha — que conta 2x quem foi impactado por mais de uma
    // campanha e, por isso, vem marcado com `alcanceDedup: false` para a tela avisar.
    let somaReach = 0, somaImp = 0, somaGasto = 0;
    for (const c of campanhas) { somaReach += c.alcance; somaImp += c.impressoes; somaGasto += c.spend; }
    const dedupOk = dedupConfere(dedup, somaGasto, somaReach);
    const alcance = dedupOk ? dedup.reach : somaReach;
    const impressoesRef = dedupOk ? dedup.impressions : somaImp;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      investimentoTrafego: spend,
      leadsMeta: leads,
      cplMeta: leads > 0 ? spend / leads : 0,
      alcance,
      frequencia: alcance > 0 ? impressoesRef / alcance : 0,
      // true = alcance deduplicado pela própria Meta; false = soma por campanha.
      alcanceDedup: dedupOk,
      // Nenhuma campanha do período casou com `metaMatch` — normalmente é config
      // desatualizada (campanha renomeada, edição nova sem o termo certo). A tela
      // usa isso para avisar em vez de mostrar R$ 0,00 como se fosse o resultado.
      semCampanhas: campanhas.length === 0,
      porDia,
      campanhas,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
