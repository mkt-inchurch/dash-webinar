// Acesso ao Postgres do painel (Supabase), pelas funções fn_* que vivem no banco.
//
// POR QUE O CÁLCULO ESTÁ NO BANCO E NÃO AQUI: até 27/08/2026 cada rota baixava a
// planilha inteira em CSV e refazia, em JavaScript, a dedup por e-mail, a janela da
// edição e a atribuição por UTM — a cada requisição sem cache. Eram de 1,0 s a 1,8 s
// por rota, a mesma planilha de pesquisa baixada 3× por edição, e o teto do Google
// (HTTP 429) sempre por perto. As funções `fn_*` fazem a mesma conta em SQL, em
// ~0,2 s, e devolvem exatamente o mesmo JSON que estas rotas devolviam.
//
// A chave é a `service_role`: ela ignora RLS, então NUNCA pode ir para o navegador.
// Ela existe só aqui, nas funções serverless. As tabelas estão com RLS ligada e sem
// nenhuma policy, ou seja, a chave anônima não lê nada — mesmo que vaze.

const BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Chama uma função do banco e devolve o JSON dela.
 *
 * Reenvia nos erros que passam sozinhos (rede, 5xx), com a mesma lógica de
 * `_http.js`: um soluço de rede não pode zerar um card. Erro de configuração
 * (401/404) não se repete — insistir só gasta o tempo da função.
 */
export async function rpc(fn, args, { tentativas = 3, timeoutMs = 5000 } = {}) {
  if (!BASE || !CHAVE) {
    const err = new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados na Vercel.');
    err.permanente = true;
    throw err;
  }
  let ultimoErro = null;
  for (let i = 0; i < tentativas; i++) {
    if (i > 0) await espera(300 * Math.pow(3, i - 1)); // 300ms, 900ms
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: CHAVE,
          Authorization: `Bearer ${CHAVE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args || {}),
        signal: ctrl.signal,
      });
      if (r.ok) return await r.json();
      const corpo = await r.text();
      ultimoErro = new Error(`O banco respondeu ${r.status}: ${corpo.slice(0, 200)}`);
      if (r.status < 500) { ultimoErro.permanente = true; break; } // config errada
    } catch (err) {
      ultimoErro = err;
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoErro || new Error('Falha ao ler o banco');
}

/**
 * Edição pedida na URL. Devolve null quando não existe — e aí a rota responde 404.
 *
 * Antes, `?ed=` desconhecida caía calada na edição padrão: a resposta vinha 200 com
 * os números de OUTRA edição, sem nenhuma marca disso. Bastava um id renomeado no
 * código para quem tinha a edição antiga salva no navegador ler o rótulo novo com os
 * números do 24/08 por baixo.
 */
export async function edicaoPedida(req) {
  const id = String((req.query && req.query.ed) || '').trim();
  if (!id) return null;
  const lista = await rpc('fn_edicoes', {});
  return lista.find((e) => e.id === id) || null;
}

/** Resposta padrão de erro, no formato que o painel já sabe ler. */
export function falha(res, err) {
  const permanente = !!err.permanente;
  res.setHeader('Cache-Control', permanente ? 'no-store' : 's-maxage=30');
  return res.status(502).json({ error: String(err.message || err), permanente });
}
