// Vercel Serverless Function — lê "Entradas no Grupo" ao vivo do Sendflow.
// Token seguro no servidor (env var SENDFLOW_API_KEY), nunca vai ao navegador.

const RELEASE_ID = 'hZh6HtKTvj9jUu8ZYbml'; // Campanha: Webinar: IA na Igreja
const GROUP_ID = 'ZUOxWMArOvbfjakb8r0L'; // Grupo: Webinar: IA na Igreja #3
const API_BASE = 'https://sendflow.pro/sendapi';

// A API do Sendflow fica atrás do Cloudflare, que bloqueia clientes sem
// User-Agent de navegador (erro 1010). Por isso enviamos um UA de browser.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

export default async function handler(_req, res) {
  const token = process.env.SENDFLOW_API_KEY;
  if (!token) {
    return res.status(500).json({ error: 'SENDFLOW_API_KEY não configurado na Vercel.' });
  }

  try {
    const url = `${API_BASE}/releases/${RELEASE_ID}/groups`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      // Cacheia o erro por alguns minutos para NÃO martelar a API do Sendflow em
      // rajada (o rate limit dela é rígido). O front cai no /sendflow.json nesse caso.
      res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
      return res.status(502).json({ error: `Sendflow respondeu ${response.status}`, detail: text.slice(0, 200) });
    }

    const groups = await response.json();
    const list = Array.isArray(groups) ? groups : groups.items || [];
    const group =
      list.find((g) => g.id === GROUP_ID) ||
      list.find((g) => (g.name || '').includes('#3'));

    if (!group || typeof group.participantsAmount !== 'number') {
      return res.status(404).json({ error: 'Grupo #3 não encontrado na resposta do Sendflow.' });
    }

    // Cache na borda da Vercel por 5 min (mesma cadência do resto do dashboard).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      entradasGrupo: group.participantsAmount,
      grupo: group.name,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
