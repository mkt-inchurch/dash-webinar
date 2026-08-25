// Servidor local que roda o painel COM as serverless functions — o `vite dev`
// sozinho não executa nada de /api, então em dev todos os cards caíam no aviso de
// "fonte indisponível" e não dava para conferir mudança de número na tela.
//
//   npm run build && node scripts/dev-local.mjs      # http://localhost:4178
//
// /api/* é atendido pelos handlers deste repo (mesmo código da Vercel). O único que
// exigem segredo são /api/meta e /api/cobertura (META_ACCESS_TOKEN): sem token no
// ambiente, eles são encaminhados para a produção, só para a tela ter com o que
// desenhar os cards.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const PORT = process.env.PORT || 4178;
const PROD = 'https://dash-webinar-ia.vercel.app';

const rotas = {
  '/api/meta': () => import('../api/meta.js'),
  '/api/sendflow': () => import('../api/sendflow.js'),
  '/api/inscritos': () => import('../api/inscritos.js'),
  '/api/pesquisas': () => import('../api/pesquisas.js'),
  '/api/icps': () => import('../api/icps.js'),
  '/api/diagnosticos': () => import('../api/diagnosticos.js'),
  '/api/utms': () => import('../api/utms.js'),
  '/api/cobertura': () => import('../api/cobertura.js'),
};

const app = express();

for (const [rota, carregar] of Object.entries(rotas)) {
  app.get(rota, async (req, res) => {
    // Sem token do Meta em dev: usa a produção para não deixar a tela vazia.
    if ((rota === '/api/meta' || rota === '/api/cobertura') && !process.env.META_ACCESS_TOKEN) {
      const r = await fetch(`${PROD}${req.originalUrl}`);
      res.status(r.status).json(await r.json());
      return;
    }
    const mod = await carregar();
    await mod.default(req, res);
  });
}

app.use(express.static(path.join(raiz, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(raiz, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`painel local em http://localhost:${PORT}`));
