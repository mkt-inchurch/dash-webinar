// Lógica compartilhada do Sendflow entre a COLETA AGENDADA
// (scripts/sendflow-snapshot.mjs, roda no GitHub Actions) e a função /api/sendflow.
//
// Por que existe: a SendAPI bloqueia a CONTA/IP por 24h (`api-key-blocked`) quando
// recebe requisições demais. Consultá-la a cada visita do painel não escala — com 9
// edições, a tela de Comparação sozinha gerava um burst por acesso. Agora quem fala
// com a SendAPI é só o job agendado (1 requisição por edição, de hora em hora, de um
// IP do GitHub); o painel lê o snapshot que o job publica.

export const API_BASE = 'https://sendflow.pro/sendapi';

// A API do Sendflow fica atrás do Cloudflare, que bloqueia clientes sem
// User-Agent de navegador (erro 1010).
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

export const sfHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'User-Agent': BROWSER_UA,
});

// Chave "DDMMAAAA" -> "AAAA-MM-DD".
export function keyToISO(k) {
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
export function getKeys(env = process.env) {
  const raw = [
    env.SENDFLOW_API_KEY,
    env.SENDFLOW_API_KEY_2,
    env.SENDFLOW_API_KEY_3,
    env.SENDFLOW_API_KEY_4,
    env.SENDFLOW_API_KEY_5,
    ...String(env.SENDFLOW_API_KEYS || '').split(','),
  ];
  const seen = new Set();
  const keys = [];
  for (const k of raw) {
    const t = String(k || '').trim();
    if (t && !seen.has(t)) { seen.add(t); keys.push(t); }
  }
  return keys;
}

// Soma por dia (dentro da janela da edição) das chaves DDMMAAAA de add/remove.
function somaPorDia(dates, desde, ate) {
  const byDay = {};
  for (const [k, v] of Object.entries(dates || {})) {
    const iso = keyToISO(k);
    if (!iso) continue;
    if (desde && iso < desde) continue;
    if (ate && iso > ate) continue;
    byDay[iso] = (byDay[iso] || 0) + Number(v || 0);
  }
  return byDay;
}

// Converte o analytics cru da campanha no payload do card, respeitando a janela da
// edição. `grupos` (lista de /releases/{id}/groups) só é usada no modo 'group'.
export function computeSendflow(ed, data, grupos) {
  const byDay = somaPorDia(data.add && data.add.dates, ed.sendflowDesde, ed.sendflowAte);
  const porDia = Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([dia, novos]) => ({ data: dia, novos }));

  let entradasGrupo = 0;
  for (const d of porDia) entradasGrupo += d.novos;

  let saidas;
  // Série DIÁRIA das saídas. Existe só no modo 'campaign', onde a SendAPI devolve as
  // remoções datadas; no modo 'group' as saídas são uma estimativa do período inteiro
  // (entradas − membros atuais) e não têm por-dia nenhum.
  //
  // POR QUE IMPORTA: sem esta série, o painel filtrava as ENTRADAS por data e deixava
  // as SAÍDAS no total do período. Na edição 31/08, o preset "Hoje" mostrava
  // "8 entradas ↓ 11 saídas" — as 8 de hoje contra as 11 do mês inteiro, como se o
  // grupo tivesse encolhido no dia.
  let saidasPorDia;
  if (ed.sendflowMode === 'campaign') {
    // Campanha inteira: saídas = remoções reais por dia (dentro da janela).
    const rem = somaPorDia(data.remove && data.remove.dates, ed.sendflowDesde, ed.sendflowAte);
    saidasPorDia = Object.entries(rem)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([dia, novos]) => ({ data: dia, novos }));
    saidas = Object.values(rem).reduce((a, v) => a + v, 0);
  } else if (grupos) {
    // Modo grupo: estimativa de saídas do grupo #3 = entradas − membros atuais.
    // (A API não expõe saídas isoladas por grupo; isto é uma aproximação.)
    const list = Array.isArray(grupos) ? grupos : grupos.items || [];
    const g = ed.sendflowGroup ? list.find((x) => x.id === ed.sendflowGroup) : null;
    if (g && typeof g.participantsAmount === 'number') {
      saidas = Math.max(0, entradasGrupo - g.participantsAmount);
    }
  }

  const payload = { entradasGrupo, porDia };
  if (saidas != null) payload.saidas = saidas;
  if (saidasPorDia) payload.saidasPorDia = saidasPorDia;
  return payload;
}
