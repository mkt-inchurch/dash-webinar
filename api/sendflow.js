// Vercel Serverless Function — "Entradas no Grupo" a partir do Sendflow.
// Usa o endpoint de analytics da campanha (add/remove por dia = o painel de
// entradas/saídas). Valor = ENTRADAS (brutas) por dia a partir de 19/06.
// Isso equivale às entradas do grupo #3: como os grupos #1 e #2 já estavam cheios
// antes de 19/06, toda entrada nova a partir daí vai para o #3 (bate exato com o
// "Entraram" do painel). As SAÍDAS isoladas por grupo não vêm na API pública
// (o analytics só dá saídas da campanha inteira), por isso não são descontadas.
// Retorna a série diária (porDia) para o filtro temporal.
// Token seguro no servidor (env var SENDFLOW_API_KEY).

const RELEASE_ID = 'hZh6HtKTvj9jUu8ZYbml'; // Campanha: Webinar: IA na Igreja
const API_BASE = 'https://sendflow.pro/sendapi';
const CUTOFF = '2026-06-19'; // alinhado ao resto do dashboard (ignora grupos antigos)

// A API do Sendflow fica atrás do Cloudflare, que bloqueia clientes sem
// User-Agent de navegador (erro 1010).
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Chave "DDMMAAAA" -> "AAAA-MM-DD".
function keyToISO(k) {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(String(k));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export default async function handler(_req, res) {
  const token = process.env.SENDFLOW_API_KEY;
  if (!token) {
    return res.status(500).json({ error: 'SENDFLOW_API_KEY não configurado na Vercel.' });
  }

  try {
    const response = await fetch(`${API_BASE}/releases/${RELEASE_ID}/analytics`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': BROWSER_UA },
    });

    if (!response.ok) {
      const text = await response.text();
      // Cacheia o erro alguns minutos para não martelar a API (rate limit rígido).
      res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
      return res.status(502).json({ error: `Sendflow respondeu ${response.status}`, detail: text.slice(0, 200) });
    }

    const data = await response.json();
    const add = (data.add && data.add.dates) || {};

    // Entradas (brutas) por dia, só a partir do CUTOFF.
    const byDay = {};
    for (const [k, v] of Object.entries(add)) {
      const iso = keyToISO(k);
      if (iso && iso >= CUTOFF) byDay[iso] = (byDay[iso] || 0) + Number(v || 0);
    }

    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, novos]) => ({ data, novos }));

    let entradasGrupo = 0;
    for (const d of porDia) entradasGrupo += d.novos;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ entradasGrupo, porDia });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
