// Vercel Serverless Function — conta o "Total de Inscritos" a partir da planilha
// de inscritos da edição, deduplicando por e-mail. Processa no servidor para NÃO
// expor dados pessoais (nome/telefone/e-mail) ao navegador — só contagens saem daqui.

import { getEdition } from './_editions.js';
import { lerInscritos, dedupInscritos, porDiaDeContagem } from './_planilha-inscritos.js';

export default async function handler(req, res) {
  const ed = getEdition(req);
  try {
    const { header, linhas } = await lerInscritos(ed);

    // Como identificar "Inscritos ADS" nesta edição. Padrão (webinar IA): a coluna
    // UTM Source contém "WEBINAR_IA". Edições onde o valor do tráfego pago varia
    // demais (macros quebradas, nomes de campanha diferentes) usam o critério
    // INVERSO: `inscritosAdsExclude` lista as origens NÃO pagas (orgânico, e-mail) e
    // vale tudo que estiver preenchido e fora dessa lista.
    const adsField = ed.inscritosAdsField || 'source'; // 'source' | 'medium'
    const adsMatch = (ed.inscritosAdsMatch || 'WEBINAR_IA').toUpperCase();
    const adsExclude = (ed.inscritosAdsExclude || []).map((s) => s.toUpperCase());

    // Dedup por e-mail dentro da janela da edição, guardando a data da PRIMEIRA
    // inscrição de cada pessoa e a UTM que a trouxe.
    const firstByEmail = dedupInscritos(ed, header, linhas, {
      ads: adsField === 'medium' ? 'UTM Medium' : 'UTM Source',
    });

    const total = firstByEmail.size;

    // Inscritos ADS = veio de campanha do Meta. Por inclusão (IA: UTM Source contém
    // "WEBINAR_IA") ou, quando há `inscritosAdsExclude`, por exclusão das origens
    // não pagas — nesse modo a UTM precisa estar preenchida (linha sem UTM não conta).
    const isAds = adsExclude.length
      ? (v) => {
          const s = v.trim().toUpperCase();
          return !!s && !adsExclude.some((term) => s.includes(term));
        }
      : (v) => v.toUpperCase().includes(adsMatch);

    // Novos únicos por dia (soma = total) + acumulado, para o filtro de tempo.
    const byDay = {};
    const byDayAds = {};
    let totalAds = 0;
    for (const { iso, ads } of firstByEmail.values()) {
      byDay[iso] = (byDay[iso] || 0) + 1;
      if (isAds(ads)) {
        byDayAds[iso] = (byDayAds[iso] || 0) + 1;
        totalAds++;
      }
    }
    const porDia = porDiaDeContagem(byDay);
    let acc = 0;
    for (const d of porDia) { acc += d.novos; d.acumulado = acc; }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      inscritos: total,
      inscritosAds: totalAds,
      desde: ed.inscritosDesde,
      porDia,
      porDiaAds: porDiaDeContagem(byDayAds),
    });
  } catch (err) {
    return res.status(err.status ? 502 : 500).json({ error: String(err.message || err) });
  }
}
