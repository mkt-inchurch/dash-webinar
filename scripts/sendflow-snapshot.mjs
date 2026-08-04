// Coleta agendada do Sendflow (roda no GitHub Actions, de hora em hora).
//
// Faz UMA requisição por edição à SendAPI e escreve o snapshot em
// `sendflow-snapshot.json`, que o workflow publica na branch `data`. A função
// /api/sendflow lê esse arquivo — ou seja, nenhuma visita ao painel toca a SendAPI.
//
// Por quê: o Sendflow bloqueia a CONTA/IP por 24h (`api-key-blocked`) quando recebe
// requisições demais. No modelo antigo (consulta ao vivo), o volume crescia com o
// tráfego, com o nº de edições e com a tela de Comparação. Aqui é fixo: N edições
// por hora, de um IP do GitHub.
//
// Uso: SENDFLOW_API_KEY=... node scripts/sendflow-snapshot.mjs
// Sai com código 1 só se NENHUMA edição foi coletada (para o job falhar visivelmente).

import { writeFileSync } from 'node:fs';
import { EDITIONS } from '../api/_editions.js';
import { API_BASE, getKeys, sfHeaders, computeSendflow } from '../api/_sendflow.js';

const OUT = 'sendflow-snapshot.json';
// Espaçamento entre edições: evita o `rate-limit-exceeded` (limite por minuto), que
// é diferente do bloqueio de 24h e some sozinho.
const DELAY_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const keys = getKeys();
if (!keys.length) {
  console.error('Nenhuma chave configurada (secret SENDFLOW_API_KEY).');
  process.exit(1);
}

// Uma release pode ser compartilhada por mais de uma edição (janelas de data
// diferentes) — busca o analytics uma vez por release e reaproveita.
const analyticsCache = new Map();

async function fetchAnalytics(releaseId) {
  if (analyticsCache.has(releaseId)) return analyticsCache.get(releaseId);
  let last = '';
  for (const k of keys) {
    const r = await fetch(`${API_BASE}/releases/${releaseId}/analytics`, { headers: sfHeaders(k) });
    if (r.ok) {
      const json = await r.json();
      analyticsCache.set(releaseId, { data: json, token: k });
      return { data: json, token: k };
    }
    last = `${r.status} ${(await r.text()).slice(0, 160)}`;
    // Bloqueio é da conta, não da chave: insistir nas outras só acumula violações.
    if (last.includes('api-key-blocked')) break;
  }
  const err = { erro: last };
  analyticsCache.set(releaseId, err);
  return err;
}

const edicoes = {};
const erros = {};

for (const ed of Object.values(EDITIONS)) {
  if (!ed.sendflowRelease) continue;
  const res = await fetchAnalytics(ed.sendflowRelease);
  if (res.erro) {
    erros[ed.id] = res.erro;
    console.error(`✗ ${ed.id}: ${res.erro}`);
    continue;
  }
  let grupos = null;
  if (ed.sendflowMode !== 'campaign' && ed.sendflowGroup) {
    const g = await fetch(`${API_BASE}/releases/${ed.sendflowRelease}/groups`, { headers: sfHeaders(res.token) });
    if (g.ok) grupos = await g.json();
  }
  edicoes[ed.id] = computeSendflow(ed, res.data, grupos);
  console.log(`✓ ${ed.id}: ${edicoes[ed.id].entradasGrupo} entradas / ${edicoes[ed.id].saidas ?? '—'} saídas`);
  await sleep(DELAY_MS);
}

const total = Object.keys(edicoes).length;
if (!total) {
  console.error('Nenhuma edição coletada — snapshot NÃO foi sobrescrito.');
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify({ geradoEm: new Date().toISOString(), edicoes, erros }, null, 2) + '\n');
console.log(`\n${OUT}: ${total} edição(ões), ${Object.keys(erros).length} erro(s).`);
