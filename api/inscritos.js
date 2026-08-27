// Vercel Serverless Function — "Total de Inscritos" e "Inscritos ADS" da edição.
//
// A conta vive no banco (fn_inscritos): uma pessoa por e-mail, ficando com a
// inscrição mais antiga dentro da janela da edição. "Inscritos ADS" continua sendo
// o critério INVERSO — UTM preenchida e sem nenhum termo da lista de origens não
// pagas —, só que a lista agora está na tabela `edicoes`, não no código: ajustá-la
// recalcula o histórico inteiro sem precisar de deploy.
//
// Nenhum dado pessoal sai daqui: a função do banco devolve só contagens.

import { rpc, edicaoPedida, falha } from './_supabase.js';

export default async function handler(req, res) {
  try {
    const ed = await edicaoPedida(req);
    if (!ed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Edição não encontrada.', permanente: true });
    }
    const dados = await rpc('fn_inscritos', { p_ed: ed.id });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(dados);
  } catch (err) {
    return falha(res, err);
  }
}
