# Inscritos, pesquisas e diagnósticos saíram do Google Sheets

Migração feita em 27/08/2026. Antes, cada rota `/api/*` baixava a planilha inteira
em CSV e refazia em JavaScript, a cada requisição, a dedup por e-mail, a janela da
edição e a atribuição por UTM. Agora esses três conjuntos vivem num Postgres
(Supabase, região São Paulo) e as rotas só repassam o que o banco já calculou.

O que **não** mudou: Meta Ads (`/api/meta`, `/api/cobertura`) continua na Graph API,
e "Entradas no Grupo" (`/api/sendflow`) continua lendo o snapshot horário do GitHub
Actions.

## Por que

| | antes | depois |
|---|---|---|
| Latência por rota | 1,0 s a 1,8 s | ~0,2 s |
| Planilha de pesquisa | baixada 3× por edição | — |
| Teto do Google (HTTP 429) | risco a cada visita | não existe mais |
| Dados pessoais | planilha aberta por link, IDs num repo público | Postgres com RLS, sem acesso anônimo |
| Histórico | editar a planilha reescrevia o passado | linhas imutáveis, com data de carga |
| `?ed=` inexistente | 200 com os números de outra edição | 404 |

## Configuração

Duas variáveis na Vercel (Settings → Environment Variables), em Production e Preview:

```
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<chave service_role>
```

A `service_role` ignora RLS. Ela existe **só** nas funções serverless — nunca no
front-end. As tabelas estão com RLS ligada e sem nenhuma policy, então a chave
anônima não lê nada mesmo que vaze.

## O banco

Quatro tabelas: `edicoes`, `inscritos`, `pesquisas`, `diagnosticos`.

Seis funções devolvem, prontos, os mesmos payloads que as rotas montavam em JS:
`fn_inscritos`, `fn_pesquisas`, `fn_icps`, `fn_diagnosticos`, `fn_utms` e
`fn_edicoes`. A regra de dedup é sempre a mesma — uma pessoa por e-mail por edição,
ficando com o registro mais antigo.

As migrações estão versionadas no próprio projeto Supabase. Para trazê-las para cá:

```
supabase link --project-ref <ref> && supabase db pull
```

Dois detalhes que não são óbvios e é caro redescobrir:

**`inscrito_em` é `timestamp` sem fuso**, guardando o horário local do Brasil igual
ao que a planilha registra, com a coluna `dia` gerada a partir dele. Com
`timestamptz`, quem se inscreve depois das 21h cairia no dia seguinte em UTC e o
"novos por dia" mudaria em silêncio. Agrupe sempre por `dia`.

**A lista de origens não pagas vive na tabela `edicoes`** (`origens_nao_pagas`), não
no código. Ao aparecer uma origem nova (um disparo com outra tag, um parceiro),
mude a linha da edição: o histórico se recalcula sozinho, sem deploy. A comparação é
`strpos`, não `LIKE` — a lista tem termos com underline (`HS_EMAIL`, `X1_DISPARAI`) e
no `LIKE` o `_` casaria com qualquer caractere, marcando como orgânico quem é pago.

## O nó do n8n

O workflow que hoje abastece a planilha passa a gravar também no Supabase. Node
**HTTP Request**, depois do que já existe:

- **Method**: `POST`
- **URL**: `{{SUPABASE_URL}}/rest/v1/inscritos`
- **Headers**:
  - `apikey`: a `service_role`
  - `Authorization`: `Bearer <service_role>`
  - `Content-Type`: `application/json`
  - `Prefer`: `resolution=merge-duplicates`
- **Body** (JSON):

```json
{
  "edicao_id": "webinar-31-08",
  "email": "{{ $json.email.toLowerCase().trim() }}",
  "nome": "{{ $json.nome }}",
  "telefone": "{{ $json.telefone }}",
  "membresia": "{{ $json.membresia }}",
  "cargo": "{{ $json.cargo }}",
  "utm_source": "{{ $json.utm_source }}",
  "utm_medium": "{{ $json.utm_medium }}",
  "utm_campaign": "{{ $json.utm_campaign }}",
  "utm_content": "{{ $json.utm_content }}",
  "utm_term": "{{ $json.utm_term }}",
  "url": "{{ $json.url }}",
  "origem": "n8n",
  "payload": {{ JSON.stringify($json) }}
}
```

`edicao_id` fixo por workflow (ou derivado da LP de origem) é o ponto mais
importante da migração: hoje "de qual edição é este inscrito" é *deduzido* depois,
por janela de data e casamento de UTM, e é daí que vieram os erros históricos —
respostas com UTM genérica que não caíam em edição nenhuma, diagnóstico contado em
duas edições, campanha renomeada que sumiu do painel. Carimbando na origem, essa
classe de problema acaba.

`Prefer: resolution=merge-duplicates` faz o upsert: um webhook reenviado bate no
índice único `(edicao_id, lower(email))` e atualiza em vez de duplicar. Reprocessar
um lote inteiro é seguro.

Sem `inscrito_em` no corpo, o banco usa `now()` — que é o horário do servidor, em
UTC. **Mande o campo explicitamente** com o horário local do Brasil se o webhook
trouxer a data.

Mantenha o nó do Google Sheets ligado por uma edição inteira e compare os dois
totais antes de desligar. É o mesmo raciocínio do snapshot do Sendflow: o antigo só
sai depois que o novo provar que bate.

## Como conferir

`scripts/verifica-edicoes.mjs` continua valendo. Para conferir o banco contra o que
o painel mostrava antes da virada, os totais congelados no dia da migração:

| edição | inscritos | ADS | pesquisas | ICPs | diagnósticos |
|---|---|---|---|---|---|
| webinar-15-06 | 1801 | 1168 | 654 | 181 | 121 |
| webinar-04-07 | 1204 | 916 | 478 | 131 | 70 |
| webinar-13-07 | 590 | 560 | 179 | 45 | 24 |
| webinar-20-07 | 1432 | 904 | 491 | 144 | 137 |
| webinar-27-07 | 552 | 526 | 196 | 51 | 22 |
| webinar-03-08 | 925 | 538 | 298 | 95 | 59 |
| webinar-10-08 | 726 | 716 | 268 | 76 | 36 |
| webinar-17-08 | 585 | 503 | 231 | 64 | 45 |
| webinar-24-08 | 1792 | 521 | 886 | 335 | 157 |
| webinar-31-08 | 430 | 172 | 112 | 34 | 0 |
| calculadora-lideres | 130 | 111 | 0 | 66 | 68 |

Os 54 payloads das rotas migradas foram comparados byte a byte com produção antes da
virada: idênticos.

## Rollback

`git revert` do commit da migração devolve as rotas antigas, que continuam lendo as
planilhas — elas não foram apagadas. `api/_planilha-inscritos.js` e o `lerCSV` de
`api/_http.js` ficaram no repositório de propósito, sem uso, como caminho de volta.
Depois de algumas semanas estáveis, podem sair.

## O que sobrou para depois

- **308 respostas de pesquisa com `edicao_id` nulo.** Não casaram com nenhuma edição
  e hoje o painel simplesmente as perde. Estão no banco, recuperáveis:
  `select utm_campaign, count(*) from pesquisas where edicao_id is null group by 1`.
- **`/api/edicoes` existe mas ninguém consome.** O seletor da tela ainda usa a lista
  de `src/lib/editions.ts`. Trocar acaba com a duplicação entre front e servidor.
- **Congelar edições encerradas.** Com os dados no Postgres isso fica trivial: uma
  coluna `fechada_em` na tabela `edicoes` e as funções passam a servir o retrato.
