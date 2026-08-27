// Vercel Serverless Function — lista de edições do seletor.
//
// POR QUE EXISTE: a lista vivia duplicada em src/lib/editions.ts (rótulos da tela) e
// api/_editions.js (fontes e janelas), com o próprio código pedindo, em comentário,
// que fossem mantidas iguais. Quando saíam de sincronia, a tela mostrava o rótulo de
// uma edição e os números de outra. Agora a lista tem uma dona só: a tabela
// `edicoes` no banco.

import { rpc, falha } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const edicoes = await rpc('fn_edicoes', {});
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ edicoes });
  } catch (err) {
    return falha(res, err);
  }
}
