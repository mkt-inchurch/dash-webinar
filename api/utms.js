// Vercel Serverless Function — tabela "UTM × Prioridade".
//
// Agrupa os leads da edição por uma dimensão de UTM e conta por prioridade
// (P1–P4 = MQL) e Desqualificado. "Cliente" e sem classificação ficam FORA das
// linhas e voltam à parte: sem isso a soma da tabela não fecha com o card e não há
// como saber o porquê.

import { rpc, edicaoPedida, falha } from './_supabase.js';

const DIMS = ['utm_source', 'utm_medium', 'utm_campaign'];

export default async function handler(req, res) {
  try {
    const ed = await edicaoPedida(req);
    if (!ed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Edição não encontrada.', permanente: true });
    }
    const pedida = req.query && req.query.dim;
    const dim = DIMS.includes(pedida) ? pedida : 'utm_campaign';
    const dados = await rpc('fn_utms', { p_ed: ed.id, p_dim: dim });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(dados);
  } catch (err) {
    return falha(res, err);
  }
}
