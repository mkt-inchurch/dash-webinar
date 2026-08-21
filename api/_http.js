// Leitura resiliente das fontes externas (Google Sheets e Graph API).
//
// POR QUE EXISTE: até aqui cada handler dava UM fetch e, na primeira falha, a
// função devolvia erro. O painel então zerava aquele card e acendia a faixa
// "Fonte de dados indisponível". Com 6 fontes por edição — e 66 chamadas de uma
// vez na tela Comparar — bastava um soluço de rede ou um 429 do Google para a
// tela parecer quebrada, mesmo com todos os dados intactos do outro lado.
//
// Aqui a leitura tenta de novo, com espera crescente, e só desiste depois disso.

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// Vale a pena tentar de novo? Erro de rede, 429 (limite) e 5xx são transitórios.
// 403/404 são permissão ou URL errada: repetir só gasta o tempo da requisição.
const vaiPassarSozinho = (status) => status === 429 || status === 408 || status >= 500;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// GET com timeout por tentativa e reenvio nos erros transitórios.
// Devolve o Response da última tentativa (ok ou não) ou lança o erro de rede.
//
// ORÇAMENTO DE TEMPO (`orcamentoMs`): a função serverless tem um teto de execução
// na Vercel. Tentar 3× com timeout generoso cada podia ultrapassá-lo e transformar
// uma leitura lenta — mas recuperável — num timeout duro da função, que é pior do
// que a falha original. Por isso a próxima tentativa só começa se ainda couber no
// orçamento; senão devolve o que tem. Na prática as leituras levam ~1,8s, então há
// espaço para as três.
export async function fetchComRetry(url, { tentativas = 3, timeoutMs = 4000, orcamentoMs = 9000, headers = {} } = {}) {
  const inicio = Date.now();
  const restante = () => orcamentoMs - (Date.now() - inicio);
  let ultimoErro = null;
  let ultimaResposta = null;

  for (let i = 0; i < tentativas; i++) {
    if (i > 0) {
      const pausa = 300 * Math.pow(3, i - 1); // 300ms, 900ms
      // Só insiste se a pausa MAIS uma tentativa inteira ainda cabem.
      if (restante() < pausa + 1200) break;
      await espera(pausa);
    }
    const ctrl = new AbortController();
    const limite = Math.min(timeoutMs, Math.max(1200, restante()));
    const t = setTimeout(() => ctrl.abort(), limite);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, ...headers }, signal: ctrl.signal });
      if (r.ok || !vaiPassarSozinho(r.status)) return r;
      ultimaResposta = r;
      ultimoErro = new Error(`HTTP ${r.status}`);
      ultimoErro.status = r.status;
    } catch (err) {
      ultimoErro = err;
    } finally {
      clearTimeout(t);
    }
  }
  // Devolve a resposta ruim para o handler explicar o status; só lança quando nem
  // resposta houve (erro de rede ou timeout em todas as tentativas).
  if (ultimaResposta) return ultimaResposta;
  throw ultimoErro || new Error('Falha ao ler a fonte');
}

// Baixa um CSV do Google Sheets e valida que veio CSV mesmo.
//
// A validação importa: quando a planilha perde o compartilhamento público, o
// Google responde 200 com uma PÁGINA DE LOGIN em HTML. Sem esta checagem o
// parser engolia o HTML, devolvia contagens absurdas (ou zero) e o painel
// mostrava isso como se fosse o dado real — o pior modo de falha possível.
export async function lerCSV(url, oQueE) {
  const r = await fetchComRetry(url);
  if (!r.ok) {
    const err = new Error(
      r.status === 429
        ? `O Google limitou as leituras da planilha de ${oQueE} (HTTP 429). Costuma liberar sozinho em alguns minutos.`
        : r.status === 403 || r.status === 404
          ? `Sem acesso à planilha de ${oQueE} (HTTP ${r.status}). Compartilhe como "Qualquer pessoa com o link · Leitor".`
          : `A planilha de ${oQueE} respondeu ${r.status}.`
    );
    err.status = 502;
    throw err;
  }
  const texto = await r.text();
  const inicio = texto.slice(0, 400).toLowerCase();
  if (inicio.includes('<!doctype html') || inicio.includes('<html')) {
    const err = new Error(
      `A planilha de ${oQueE} devolveu uma página de login em vez do CSV. Compartilhe como "Qualquer pessoa com o link · Leitor".`
    );
    err.status = 502;
    throw err;
  }
  return texto;
}
