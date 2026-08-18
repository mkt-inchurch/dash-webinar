// Roda as serverless functions que leem planilha (diagnósticos, pesquisas, ICPs,
// UTMs, inscritos) fora da Vercel, para conferir os números de TODAS as edições
// antes de publicar. Não precisa de token — só o Meta e o Sendflow ficam de fora.
//
//   node scripts/verifica-edicoes.mjs            # resumo por edição
//   node scripts/verifica-edicoes.mjs --diag     # só diagnósticos (checa sobreposição)
//
// Além dos totais, valida invariantes: soma das séries = total, ICPs = P1..P4,
// MQL da tabela UTM = ICPs, e NENHUM dia de diagnóstico em duas edições.

import { EDITIONS } from '../api/_editions.js';
import diagnosticos from '../api/diagnosticos.js';
import pesquisas from '../api/pesquisas.js';
import icps from '../api/icps.js';
import utms from '../api/utms.js';
import inscritos from '../api/inscritos.js';

const ORDEM = [
  'webinar-15-06', 'webinar-04-07', 'webinar-13-07', 'webinar-20-07', 'webinar-27-07',
  'webinar-03-08', 'webinar-10-08', 'webinar-17-08', 'webinar-24-08', 'webinar-31-08',
  'calculadora-lideres',
];

// req/res mínimos no formato que os handlers esperam.
function chamar(handler, ed, query = {}) {
  return new Promise((resolve) => {
    const req = { query: { ed, ...query }, url: `/?ed=${ed}` };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
    };
    handler(req, res).catch((e) => resolve({ status: 500, body: { error: String(e) } }));
  });
}

const soDiag = process.argv.includes('--diag');
const erros = [];
const diasDiag = new Map(); // dia -> [edições]

for (const id of ORDEM) {
  const ed = EDITIONS[id];
  const [d, p, i, u, ins] = await Promise.all([
    chamar(diagnosticos, id),
    soDiag ? null : chamar(pesquisas, id),
    soDiag ? null : chamar(icps, id),
    soDiag ? null : chamar(utms, id, { dim: 'utm_campaign' }),
    soDiag ? null : chamar(inscritos, id),
  ]);

  const diag = d.body;
  // A checagem de sobreposição vale só para quem divide a planilha compartilhada de
  // diagnósticos (separada por janela de data). Edições que leem o diagnóstico da
  // própria planilha de inscritos não disputam essas linhas — incluí-las aqui
  // acusaria conflito em todo dia em que as duas fontes tivessem registro.
  if (ed.diagFonte !== 'inscritos') {
    for (const dia of diag.porDia || []) {
      if (!diasDiag.has(dia.data)) diasDiag.set(dia.data, []);
      diasDiag.get(dia.data).push(id);
    }
  }
  const somaDiag = (diag.porDia || []).reduce((a, x) => a + x.novos, 0);
  if (somaDiag !== diag.diagnosticos) erros.push(`${id}: soma diária de diagnósticos (${somaDiag}) ≠ total (${diag.diagnosticos})`);

  let linha = `${ed.label.padEnd(30)} diag ${String(diag.diagnosticos).padStart(4)}  [${diag.inicio || 'início'} → ${diag.fim || 'aberto'}]`;

  if (!soDiag) {
    const pes = p.body, ic = i.body, ut = u.body, iu = ins.body;
    const somaPes = (pes.porDia || []).reduce((a, x) => a + x.novos, 0);
    if (somaPes !== pes.pesquisas) erros.push(`${id}: soma diária de pesquisas ≠ total`);
    const somaIcp = ic.p1 + ic.p2 + ic.p3 + ic.p4;
    if (somaIcp !== ic.icps) erros.push(`${id}: ICPs (${ic.icps}) ≠ P1..P4 (${somaIcp})`);
    const mql = (ut.rows || []).reduce((a, r) => a + r.mql, 0);
    if (mql !== ic.icps) erros.push(`${id}: MQL da tabela UTM (${mql}) ≠ ICPs (${ic.icps})`);
    if (ut.melhor && ut.pior && ut.melhor.nome === ut.pior.nome) erros.push(`${id}: melhor e pior qualidade são a MESMA utm`);
    if (iu.inscritosAds > iu.inscritos) erros.push(`${id}: inscritos ADS > total de inscritos`);
    linha += `  inscritos ${String(iu.inscritos).padStart(5)} (ads ${String(iu.inscritosAds).padStart(5)})`;
    linha += `  pesquisas ${String(pes.pesquisas).padStart(4)}  icps ${String(ic.icps).padStart(4)}`;
    linha += `  n/class. ${String(ut.naoClassificados ?? 0).padStart(4)}`;
  }
  console.log(linha);
}

// Um diagnóstico não pode pertencer a duas edições: as janelas têm que ser disjuntas.
const sobrepostos = [...diasDiag.entries()].filter(([, eds]) => eds.length > 1);
console.log();
if (sobrepostos.length) {
  console.log('SOBREPOSIÇÃO de janelas de diagnóstico:');
  for (const [dia, eds] of sobrepostos) console.log(`  ${dia}: ${eds.join(', ')}`);
  erros.push(`${sobrepostos.length} dia(s) de diagnóstico em mais de uma edição`);
} else {
  console.log('Janelas de diagnóstico: sem sobreposição entre edições.');
}

console.log();
if (erros.length) {
  console.log('INCONSISTÊNCIAS:');
  for (const e of erros) console.log('  -', e);
  process.exitCode = 1;
} else {
  console.log('Todas as invariantes passaram.');
}
