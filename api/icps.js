// Vercel Serverless Function — ICPs (P1–P4) da edição.
//
// A classificação é a que o time preenche à mão: "Filtro de Leads" na planilha de
// pesquisa, hoje espelhada na coluna `filtro_leads`. Nas edições que qualificam no
// próprio formulário (Calculadora), ela vem de `inscritos.qualificacao`. A função
// do banco escolhe a fonte pela flag da edição — as duas deduplicam igual, pelo
// registro mais antigo de cada e-mail.

import { rpc, edicaoPedida, falha } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const ed = await edicaoPedida(req);
    if (!ed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Edição não encontrada.', permanente: true });
    }
    const dados = await rpc('fn_icps', { p_ed: ed.id });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(dados);
  } catch (err) {
    return falha(res, err);
  }
}
