// Vercel Serverless Function — "Entradas no Grupo" a partir do Sendflow.
// Usa o endpoint de analytics da campanha (add/remove por dia = o painel de
// entradas/saídas). Valor = ENTRADAS (brutas) por dia a partir de 19/06.
// Isso equivale às entradas do grupo #3: como os grupos #1 e #2 já estavam cheios
// antes de 19/06, toda entrada nova a partir daí vai para o #3 (bate exato com o
// "Entraram" do painel). As SAÍDAS isoladas por grupo não vêm na API pública
// (o analytics só dá saídas da campanha inteira), por isso não são descontadas.
// Retorna a série diária (porDia) para o filtro temporal.
// Token seguro no servidor (env var SENDFLOW_API_KEY).

import { getEdition } from './_editions.js';

const API_BASE = 'https://sendflow.pro/sendapi';

// A API do Sendflow fica atrás do Cloudflare, que bloqueia clientes sem
// User-Agent de navegador (erro 1010).
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Chave "DDMMAAAA" -> "AAAA-MM-DD".
function keyToISO(k) {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(String(k));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Lê as chaves do Sendflow das env vars, na ordem de tentativa: as nomeadas
// SENDFLOW_API_KEY, SENDFLOW_API_KEY_2, _3, _4, _5 e/ou uma lista separada por
// vírgula em SENDFLOW_API_KEYS. Duplicatas e vazios são descartados.
// ATENÇÃO: várias chaves servem só para espalhar o rate limit por MINUTO
// (rate-limit-exceeded). Elas NÃO contornam o `api-key-blocked`, que é bloqueio da
// CONTA/IP de egress — nesse estado toda chave nova já nasce bloqueada. Criar mais
// chaves não resolve; o que resolve é reduzir o volume de requisições.
function getKeys() {
  const raw = [
    process.env.SENDFLOW_API_KEY,
    process.env.SENDFLOW_API_KEY_2,
    process.env.SENDFLOW_API_KEY_3,
    process.env.SENDFLOW_API_KEY_4,
    process.env.SENDFLOW_API_KEY_5,
    ...String(process.env.SENDFLOW_API_KEYS || '').split(','),
  ];
  const seen = new Set();
  const keys = [];
  for (const k of raw) {
    const t = String(k || '').trim();
    if (t && !seen.has(t)) { seen.add(t); keys.push(t); }
  }
  return keys;
}

const sfHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': BROWSER_UA });

// Distribui a carga entre as chaves. Sempre começar pela chave 1 concentra TODO o
// rate limit numa só (ela estoura primeiro e derruba as outras em cascata). Aqui a
// ordem é rotacionada por edição (release) + minuto: cada release/minuto prefere
// uma chave diferente, e o burst da tela de Comparação (7 edições de uma vez) se
// espalha entre as chaves em vez de socar todas na primeira.
function orderedKeys(keys, seed) {
  if (keys.length <= 1) return keys;
  let h = 0;
  for (const c of String(seed || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const offset = (h + Math.floor(Date.now() / 60000)) % keys.length;
  return keys.slice(offset).concat(keys.slice(0, offset));
}

export default async function handler(req, res) {
  const keys = getKeys();
  if (!keys.length) {
    return res.status(500).json({ error: 'Nenhuma chave do Sendflow configurada na Vercel (SENDFLOW_API_KEY / _2 / _3).' });
  }

  const ed = getEdition(req);
  const RELEASE_ID = ed.sendflowRelease;
  const GROUP_ID = ed.sendflowGroup;
  const DESDE = ed.sendflowDesde; // "AAAA-MM-DD" ou null (Sendflow é diário)
  const ATE = ed.sendflowAte; // "AAAA-MM-DD" ou null
  const MODE = ed.sendflowMode; // 'group' | 'campaign'

  // Soma por dia (dentro da janela da edição) das chaves DDMMAAAA de add/remove.
  const somaPorDia = (dates) => {
    const byDay = {};
    for (const [k, v] of Object.entries(dates || {})) {
      const iso = keyToISO(k);
      if (!iso) continue;
      if (DESDE && iso < DESDE) continue;
      if (ATE && iso > ATE) continue;
      byDay[iso] = (byDay[iso] || 0) + Number(v || 0);
    }
    return byDay;
  };

  try {
    // Tenta cada chave em ordem até uma responder OK. IMPORTANTE: para na PRIMEIRA
    // que responder `api-key-blocked` — esse bloqueio é da CONTA/IP (o egress da
    // Vercel), não da chave, então as outras responderiam o mesmo. Insistir nas 7
    // transformava cada request do painel em 7 requests na SendAPI (e a tela de
    // Comparação, 9 edições, em ~63), o que mantinha o rate limit sempre estourado e
    // acumulava bloqueios. Só erros específicos da chave (ex.: 401) fazem tentar a
    // próxima. Guarda a chave que funcionou p/ reusar no fetch de grupos.
    let data = null, token = null, lastStatus = 0, lastDetail = '', blocked = null, tried = 0;
    for (const k of orderedKeys(keys, RELEASE_ID)) {
      tried++;
      const response = await fetch(`${API_BASE}/releases/${RELEASE_ID}/analytics`, { headers: sfHeaders(k) });
      if (response.ok) { data = await response.json(); token = k; break; }
      lastStatus = response.status;
      lastDetail = (await response.text()).slice(0, 200);
      let code = '';
      try { const j = JSON.parse(lastDetail); code = j.code || ''; blocked = code === 'api-key-blocked' ? j : null; } catch { /* corpo não-JSON */ }
      if (blocked) break; // conta bloqueada: as demais chaves dariam o mesmo
    }

    if (!data) {
      // Sem SWR: a borda não re-dispara a origem em background, então a conta para de
      // ser cutucada e o bloqueio tem chance de esfriar. Quando a SendAPI diz até
      // quando está bloqueada (retryAfterMs), o cache do erro dura esse tempo — no
      // máximo 3h, para o card religar sozinho pouco depois da liberação. NÃO reduza.
      const ttl = blocked?.retryAfterMs
        ? Math.min(Math.round(blocked.retryAfterMs / 1000), 3 * 3600)
        : 1800;
      res.setHeader('Cache-Control', `s-maxage=${ttl}`);
      const alvo = blocked ? `conta bloqueada (api-key-blocked)` : `${tried} chave(s) de ${keys.length}`;
      return res.status(502).json({ error: `Sendflow respondeu ${lastStatus} — ${alvo}`, detail: lastDetail });
    }

    // Entradas (brutas) por dia, só a partir do CUTOFF.
    const byDay = somaPorDia(data.add && data.add.dates);
    const porDia = Object.entries(byDay)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([data, novos]) => ({ data, novos }));

    let entradasGrupo = 0;
    for (const d of porDia) entradasGrupo += d.novos;

    let saidas;
    if (MODE === 'campaign') {
      // Campanha inteira: saídas = remoções reais por dia (a partir do CUTOFF).
      const rem = somaPorDia(data.remove && data.remove.dates);
      saidas = Object.values(rem).reduce((a, v) => a + v, 0);
    } else {
      // Modo grupo: estimativa de saídas do grupo #3 = entradas − membros atuais.
      // (A API não expõe saídas isoladas por grupo; isto é uma aproximação.)
      try {
        const gResp = await fetch(`${API_BASE}/releases/${RELEASE_ID}/groups`, { headers: sfHeaders(token) });
        if (gResp.ok) {
          const groups = await gResp.json();
          const list = Array.isArray(groups) ? groups : groups.items || [];
          const g3 = GROUP_ID ? list.find((g) => g.id === GROUP_ID) : null;
          if (g3 && typeof g3.participantsAmount === 'number') {
            saidas = Math.max(0, entradasGrupo - g3.participantsAmount);
          }
        }
      } catch {
        // saídas fica indefinido; o card mostra só as entradas
      }
    }

    const payload = { entradasGrupo, porDia };
    if (saidas != null) payload.saidas = saidas;

    // Entradas do grupo são cumulativas e mudam devagar — 30 min de cache de borda
    // é folgado e absorve o polling do painel (a origem/Sendflow é tocada no máximo
    // ~1x a cada 30 min por edição, em vez de a cada poll).
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
