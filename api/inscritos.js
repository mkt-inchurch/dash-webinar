// Vercel Serverless Function — conta o "Total de Inscritos" a partir da planilha
// de inscritos da edição, deduplicando por e-mail. Processa no servidor para NÃO
// expor dados pessoais (nome/telefone/e-mail) ao navegador — só contagens saem daqui.

import { getEdition, ORIGENS_NAO_PAGAS } from './_editions.js';
import { lerInscritos, dedupInscritos, porDiaDeContagem } from './_planilha-inscritos.js';

export default async function handler(req, res) {
  const ed = getEdition(req);
  try {
    const { header, linhas } = await lerInscritos(ed);

    // Como identificar "Inscritos ADS": critério INVERSO em todas as edições — é ADS
    // tudo que tem UTM Source preenchida e NÃO contém nenhuma das origens não pagas.
    // Não existe termo fixo que identifique o pago (o valor chega ora com o nome da
    // campanha, ora truncado, ora como macro quebrada `{{campaign.name}}`, ora como o
    // placement "ig"/"fb", ora como "TRAFEGO"); o que é constante é o não pago.
    const adsField = ed.inscritosAdsField || 'source'; // 'source' | 'medium'
    const adsExclude = (ed.inscritosAdsExclude || ORIGENS_NAO_PAGAS).map((s) => s.toUpperCase());

    // Dedup por e-mail dentro da janela da edição, guardando a data da PRIMEIRA
    // inscrição de cada pessoa e a UTM que a trouxe.
    const firstByEmail = dedupInscritos(ed, header, linhas, {
      ads: adsField === 'medium' ? 'UTM Medium' : 'UTM Source',
    });

    const total = firstByEmail.size;

    // A UTM precisa estar preenchida: linha sem UTM Source (tráfego direto) não conta.
    const isAds = (v) => {
      const s = v.trim().toUpperCase();
      return !!s && !adsExclude.some((term) => s.includes(term));
    };

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
