// Vercel Serverless Function — "Diagnósticos" da edição.
//
// A planilha de diagnósticos é compartilhada por todos os webinars e a utm_campaign
// dela não separa edição — só a DATA separa. Essa janela foi resolvida uma vez, na
// migração, e gravada em cada linha: aqui é só ler. É o que impede o mesmo
// diagnóstico de ser contado em 2, 3 ou 4 edições, como já aconteceu.

import { rpc, edicaoPedida, falha } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const ed = await edicaoPedida(req);
    if (!ed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Edição não encontrada.', permanente: true });
    }
    const dados = await rpc('fn_diagnosticos', { p_ed: ed.id });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(dados);
  } catch (err) {
    return falha(res, err);
  }
}
