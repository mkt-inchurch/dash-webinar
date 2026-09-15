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
//
// ALÉM DO SNAPSHOT, ESTE SCRIPT PUBLICA O PRÓPRIO ESTADO em `sendflow-status.json`,
// SEMPRE — inclusive (e principalmente) quando a coleta falha. Sem isso o painel só
// conseguia ver a IDADE do snapshot, e idade não distingue as duas situações que
// pedem reações opostas: um job que simplesmente não rodou (rodar de novo resolve) e
// um job que roda de hora em hora e falha (rodar de novo não resolve nada). Em
// set/2026 a segunda durou 6 dias sem ninguém perceber, porque o aviso do painel
// dizia apenas "a última coleta foi há 140h — rode o workflow".

import { writeFileSync } from 'node:fs';
import { EDITIONS } from '../api/_editions.js';
import { API_BASE, getKeys, sfHeaders, computeSendflow } from '../api/_sendflow.js';

const OUT = 'sendflow-snapshot.json';
const OUT_STATUS = 'sendflow-status.json';
// Espaçamento entre edições: evita o `rate-limit-exceeded` (limite por minuto), que
// é diferente do bloqueio de 24h e some sozinho.
const DELAY_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Quantas requisições este run fez à SendAPI. É a métrica que o desenho todo existe
// para manter baixa (o bloqueio de 24h vem de volume), então vai no resumo do job e
// no status publicado.
let reqs = 0;

// Traduz o erro cru da SendAPI na instrução que resolve. O painel mostra este texto
// direto para quem abrir o selo de auditoria, então ele tem de dizer o que FAZER —
// em especial quando a ação NÃO é "rodar o workflow de novo".
function dicaPara(causa) {
  const c = String(causa || '');
  // A chave chegou mas a SendAPI não a reconhece (valor errado/revogado); o painel do
  // Sendflow mostra as chaves MASCARADAS, então copiar de lá não funciona.
  if (c.startsWith('401'))
    return 'Chave inválida: copie o valor completo (o painel do Sendflow mostra mascarado; a env var SENDFLOW_API_KEY da Vercel tem o valor bom) e atualize o secret do repositório.';
  // Bloqueio por volume, por CONTA/IP. Passa sozinho.
  if (c.includes('api-key-blocked'))
    return 'Conta bloqueada por rate limit; o próximo run pega sozinho após a liberação. Não adianta rodar de novo agora.';
  // Delegação: a conta virou perfil de atendente e a chave perdeu permissão. Nenhuma
  // mexida no repositório resolve — só a aprovação dentro do Sendflow. Foi o caso de
  // 09 a 15/09/2026. Atenção: a chave do Actions e a credencial do MCP são aprovadas
  // SEPARADAMENTE, então uma pode voltar antes da outra.
  if (c.includes('api-key-delegation-required'))
    return 'A chave perdeu permissão: o dono da conta do Sendflow precisa aprovar a delegação. Rodar o workflow de novo NÃO resolve — quando aprovarem, o próximo run coleta sozinho.';
  if (c.startsWith('403'))
    return 'A SendAPI recusou a chave (403). Confira as permissões dela no Sendflow — rodar o workflow de novo só repete o erro.';
  if (c.includes('secret ausente'))
    return 'Falta o secret SENDFLOW_API_KEY no repositório (Settings → Secrets and variables → Actions).';
  return 'Veja o log do run no GitHub Actions para a resposta completa da SendAPI.';
}

// Estado desta tentativa, publicado junto do snapshot na branch `data`. Nunca receba
// aqui o valor de uma chave — só contagens, status HTTP e códigos de erro.
function gravaStatus(ok, { causa, edicoes: n } = {}) {
  writeFileSync(
    OUT_STATUS,
    JSON.stringify(
      {
        em: new Date().toISOString(),
        ok,
        chaves: keys.length,
        ...(ok ? { edicoes: n, requisicoes: reqs } : { causa, dica: dicaPara(causa) }),
      },
      null,
      2,
    ) + '\n',
  );
}

// Anota o motivo da falha no resumo do run (visível na página do Actions SEM login,
// ao contrário dos logs). Nunca receba aqui o valor de uma chave — só contagens,
// status HTTP e códigos de erro da SendAPI.
const anota = (msg) => console.log(`::error title=Sendflow snapshot::${msg}`);

const keys = getKeys();
if (!keys.length) {
  const causa = 'nenhuma chave chegou ao job (secret ausente)';
  anota(
    'Nenhuma chave chegou ao job. Confira em Settings → Secrets and variables → ' +
      '**Actions** (aba "Secrets", não "Variables"; secret de repositório, não de ' +
      'Environment/Dependabot) se existe SENDFLOW_API_KEY.',
  );
  gravaStatus(false, { causa });
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
    reqs++;
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
    reqs++;
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
  // O snapshot NÃO é reescrito: o painel continua servindo o último retrato bom. O
  // status, sim — é ele que faz a tela dizer "a coleta está falhando" em vez de "o
  // snapshot está velho", que pedem ações diferentes.
  gravaStatus(false, { causa });
  anota(`Nenhuma edição coletada com ${keys.length} chave(s) — snapshot preservado. SendAPI: ${causa} → ${dicaPara(causa)}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify({ geradoEm: new Date().toISOString(), edicoes, erros }, null, 2) + '\n');
gravaStatus(true, { edicoes: total });
console.log(`\n${OUT}: ${total} edição(ões), ${Object.keys(erros).length} erro(s), ${reqs} requisição(ões) à SendAPI.`);
