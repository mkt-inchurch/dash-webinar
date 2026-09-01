// Acrescenta o par de nós "normaliza + grava no Supabase" a um workflow de captação.
//
// DESENHO: o ramo novo sai do WEBHOOK, em paralelo com o caminho que já existe
// (planilha → HubSpot → Disparaí). Nunca em série. Se o Supabase estiver fora do ar,
// a inscrição continua indo para a planilha e para o HubSpot como sempre foi — e os
// dois nós novos ainda vão marcados com `onError: continueRegularOutput`, para que
// uma falha ali não marque a execução inteira como falha.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const B = 'https://n8n.tools.inchurch.com.br';
const K = fs.readFileSync(path.join(os.homedir(), '.n8n-api.key'), 'utf8').trim();
const CRED = { id: 'EtKh6Ee1PpCcvh1X', name: 'Supabase · dash-webinar' };
const MODELO = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'dev/dash-webinar/docs/n8n-inscritos.json'), 'utf8'));

const api = async (rota, opts = {}) => {
  const r = await fetch(`${B}/api/v1${rota}`, {
    ...opts,
    headers: { 'X-N8N-API-KEY': K, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* deixa null */ }
  return { status: r.status, body: j, txt };
};

const ALVOS = process.argv.slice(2).map((s) => { const [id, ed] = s.split('='); return { id, ed }; });

for (const { id, ed } of ALVOS) {
  const atual = await api(`/workflows/${id}`);
  if (atual.status !== 200) { console.log(`${id}: não consegui ler (HTTP ${atual.status})`); continue; }
  const w = atual.body;

  if (w.nodes.some((n) => n.name === 'Grava no Supabase')) {
    console.log(`${w.name}: já tem os nós, pulando`);
    continue;
  }

  const webhook = w.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  if (!webhook) { console.log(`${w.name}: sem nó de webhook, pulando`); continue; }

  // Abaixo do webhook, para não cobrir nenhum nó existente.
  const [x, y] = webhook.position;
  const abaixo = Math.max(...w.nodes.map((n) => n.position[1])) + 220;

  const codigo = { ...MODELO.nodes[0] };
  const http = { ...MODELO.nodes[1] };

  const novos = [
    {
      ...codigo,
      id: undefined,
      name: 'Normaliza p/ Supabase',
      position: [x + 220, abaixo],
      onError: 'continueRegularOutput',
      parameters: { jsCode: codigo.parameters.jsCode.replace("const EDICAO = 'webinar-31-08';", `const EDICAO = '${ed}';`) },
    },
    {
      ...http,
      id: undefined,
      name: 'Grava no Supabase',
      position: [x + 440, abaixo],
      onError: 'continueRegularOutput',
      credentials: { supabaseApi: CRED },
    },
  ].map((n) => { const c = { ...n }; delete c.id; return c; });

  // Confere que a edição existe do outro lado antes de carimbar qualquer coisa.
  if (!novos[0].parameters.jsCode.includes(`const EDICAO = '${ed}'`)) {
    console.log(`${w.name}: FALHOU ao trocar a edição para ${ed} — não vou salvar`);
    continue;
  }

  const conexoes = JSON.parse(JSON.stringify(w.connections));
  conexoes[webhook.name] = conexoes[webhook.name] || { main: [[]] };
  conexoes[webhook.name].main[0] = [...(conexoes[webhook.name].main[0] || []), { node: 'Normaliza p/ Supabase', type: 'main', index: 0 }];
  conexoes['Normaliza p/ Supabase'] = { main: [[{ node: 'Grava no Supabase', type: 'main', index: 0 }]] };

  const corpo = {
    name: w.name,
    nodes: [...w.nodes, ...novos],
    connections: conexoes,
    settings: w.settings || {},
  };

  const put = await api(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(corpo) });
  if (put.status !== 200) { console.log(`${w.name}: PUT falhou (HTTP ${put.status}) ${put.txt.slice(0, 200)}`); continue; }

  const depois = await api(`/workflows/${id}`);
  const d = depois.body;
  const temNovos = d.nodes.filter((n) => ['Normaliza p/ Supabase', 'Grava no Supabase'].includes(n.name)).length;
  const saidaWebhook = (d.connections[webhook.name]?.main?.[0] || []).map((c) => c.node);
  console.log(`✅ ${d.name}`);
  console.log(`   edição carimbada: ${ed} · nós: ${w.nodes.length} → ${d.nodes.length} (+${temNovos}) · ativo: ${d.active}`);
  console.log(`   saídas do webhook: ${saidaWebhook.join(', ')}`);
}
