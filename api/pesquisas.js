// Vercel Serverless Function — "Total de Pesquisas" da edição (respostas únicas por
// e-mail da pesquisa de qualificação, atribuídas a esta edição).
//
// A atribuição por UTM + janela de data foi congelada no banco no momento da
// migração: cada resposta já chega gravada com o seu `edicao_id`. As 308 respostas
// que não casaram com edição nenhuma ficaram no banco com `edicao_id` nulo — antes
// elas simplesmente sumiam da conta, sem deixar rastro.

import { rpc, edicaoPedida, falha } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const ed = await edicaoPedida(req);
    if (!ed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Edição não encontrada.', permanente: true });
    }
    // Edições que qualificam no próprio formulário de captação não têm etapa de
    // pesquisa. Zero aqui é a resposta certa, e a tela esconde o card.
    const dados = await rpc('fn_pesquisas', { p_ed: ed.id });
    res.setHeader('Cache-Control', ed.semPesquisas ? 's-maxage=1800' : 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(dados);
  } catch (err) {
    return falha(res, err);
  }
}
