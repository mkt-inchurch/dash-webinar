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

// Anota o motivo da falha no resumo do run (visível na página do Actions SEM login,
// ao contrário dos logs). Nunca receba aqui o valor de uma chave — só contagens,
// status HTTP e códigos de erro da SendAPI.
const anota = (msg) => console.log(`::error title=Sendflow snapshot::${msg}`);

const keys = getKeys();
if (!keys.length) {
  anota(
    'Nenhuma chave chegou ao job. Confira em Settings → Secrets and variables → ' +
      '**Actions** (aba "Secrets", não "Variables"; secret de repositório, não de ' +
      'Environment/Dependabot) se existe SENDFLOW_API_KEY.',
  );
  process.exit(1);
}
console.log(`${keys.length} chave(s) recebida(s) do secret.`);

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
    // Problema de conta/credencial (bloqueio de 24h ou chave inválida): as demais
    // edições dariam o mesmo. Abortar mantém o run em UMA requisição, em vez de uma
    // por edição — é o que dá ao bloqueio a chance de esfriar.
    if (res.erro.includes('api-key-blocked') || res.erro.startsWith('401')) {
      console.error(`Falha de conta/chave — run abortado (snapshot anterior preservado).`);
      break;
    }
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
  const causa = Object.values(erros)[0] || 'sem resposta da SendAPI';
  anota(`Nenhuma edição coletada com ${keys.length} chave(s) — snapshot preservado. SendAPI: ${causa}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify({ geradoEm: new Date().toISOString(), edicoes, erros }, null, 2) + '\n');
console.log(`\n${OUT}: ${total} edição(ões), ${Object.keys(erros).length} erro(s).`);
