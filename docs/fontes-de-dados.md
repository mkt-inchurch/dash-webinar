# De onde vem cada número do painel

**Hoje o painel lê as planilhas do Google direto, em CSV.** Não há banco de dados no
caminho. Cada rota de `/api` baixa a planilha da vez e faz, em JavaScript, a dedup por
e-mail, o recorte da janela da edição e a atribuição por UTM.

| rota | planilha | o que devolve |
|---|---|---|
| `/api/inscritos` | Inscritos (uma aba por edição, `inscritosSheet` + `inscritosGid`) | total e "Inscritos ADS" |
| `/api/pesquisas` | Pesquisa Geral | respostas da edição |
| `/api/icps` | Pesquisa Geral | P1–P4, a partir da coluna "Filtro de Leads" |
| `/api/utms` | Pesquisa Geral | tabela UTM × prioridade |
| `/api/diagnosticos` | Diagnósticos (compartilhada por todos os webinars) | diagnósticos da janela |
| `/api/meta` · `/api/cobertura` | Graph API do Meta | mídia |
| `/api/sendflow` | snapshot na branch `data` | entradas no grupo |

As regras de recorte de cada edição vivem em `api/_editions.js`, que é a fonte única —
inclusive `ORIGENS_NAO_PAGAS`, a lista que define o que **não** é tráfego pago.

## A ida ao Postgres e a volta

Em **27/08/2026** as cinco primeiras rotas passaram a ler um Postgres no Supabase, com
a conta feita por funções `fn_*` no banco. O ganho era real — ~0,2 s por rota no lugar
de 1,0–1,8 s, e sem esbarrar no teto do Google.

Em **09/09/2026** o projeto Supabase foi apagado. O host parou de resolver (NXDOMAIN),
as quatro rotas que dependiam dele passaram a responder `502 fetch failed` em todas as
edições, e o painel ficou só com mídia e grupo: "Conv. Captura 0%" e nenhuma UTM. A
decisão foi **não recriar o banco** e voltar para as planilhas, que é o estado atual.

Duas lições que valem mais que a história:

**O schema não tinha cópia aqui.** As quatro tabelas e as seis funções `fn_*` — que
carregavam a regra de dedup, a janela da edição e a atribuição por UTM — existiam
apenas dentro do projeto Supabase, e este documento chegou a dizer, sem ironia, que
"as migrações estão versionadas no próprio projeto Supabase". Sumiram com ele. Se um
dia voltar a existir banco neste projeto, o `supabase db pull` entra no repositório
**no mesmo commit** que o criar.

**A volta só foi barata porque o caminho antigo ficou no lugar.** `api/_planilha-inscritos.js`
e o `lerCSV` de `api/_http.js` foram mantidos sem uso, de propósito, como caminho de
volta — e o `git revert` do commit da migração devolveu as cinco rotas sem um conflito
sequer. Valeu cada byte de código morto.

## O que essa escolha custa

- **Cada rota leva de 0,6 s a 1,2 s**, contra ~0,2 s do banco. O cache HTTP
  (`s-maxage`) absorve a maior parte disso para quem abre o painel.
- **A mesma planilha de pesquisa é baixada 3× por edição** (pesquisas, ICPs, UTMs).
- **O teto do Google (HTTP 429)** volta a ser um risco em dia de pico.
- ⚠️ **O compartilhamento por link das planilhas não pode ser revogado.** As rotas leem
  pelo endpoint público `/export?format=csv`, sem credencial. Revogar o link derruba
  cinco cards do painel de uma vez.

Em compensação, some a classe inteira de problema que motivou este documento: não há
mais um segundo lugar guardando os dados, nem sincronização para atrasar, nem
reclassificação feita na planilha que não chega ao painel. O que o time escreve na
planilha é o que o painel mostra, na hora.

## Como conferir

`node scripts/verifica-edicoes.mjs` roda as cinco rotas para **todas** as edições, fora
da Vercel e sem nenhum segredo, e valida as invariantes: soma das séries = total,
ICPs = P1..P4, MQL da tabela UTM = ICPs, inscritos ADS ≤ total, e nenhum dia de
diagnóstico em duas edições. Use `--diag` para checar só a sobreposição das janelas.

Os totais abaixo foram congelados em 27/08, no dia da migração, e reconferidos em
09/09, no dia da volta. **Edição encerrada que se mexe é bug** — é o teste que pega
mudança acidental de regra de atribuição.

| edição | inscritos | ADS | pesquisas | ICPs | diagnósticos | conferência de 09/09 |
|---|---|---|---|---|---|---|
| webinar-15-06 | 1801 | 1168 | 654 | 181 | 121 | idêntica |
| webinar-04-07 | 1204 | 916 | 478 | 131 | 70 | idêntica |
| webinar-13-07 | 590 | 560 | 179 | 45 | 24 | idêntica |
| webinar-20-07 | 1432 | 904 | 491 | 144 | 137 | idêntica |
| webinar-27-07 | 552 | 526 | 196 | 51 | 22 | idêntica |
| webinar-03-08 | 925 | 538 | 298 | 95 | 59 | idêntica |
| webinar-10-08 | 726 | 716 | 268 | 76 | 36 | idêntica |
| webinar-17-08 | 585 | 503 | 231 | 64 | 45 | +3 pesquisas, +1 ICP |
| webinar-24-08 | 1792 | 521 | 886 | 335 | 157 | +4 / +7 / +2 / +6 |
| webinar-31-08 | 430 | 172 | 112 | 34 | 0 | ativa: 631 / 223 / 207 / 74 / 72 |
| calculadora-lideres | 130 | 111 | 0 | 66 | 68 | ativa: 164 / 137 / 0 / 80 / 89 |

As quatro linhas que se mexeram têm a mesma explicação, e ela é boa notícia: em 27/08
as janelas delas ainda estavam abertas (o `pesquisaExtra` do 17/08 ia até 30/08, o do
24/08 estava sem fim), e a coluna "Filtro de Leads" é preenchida **à mão** na planilha.
Ou seja, são respostas e reclassificações que existiam na planilha e que o banco nunca
chegou a receber.

## Detalhes que é caro redescobrir

**A coluna "Filtro de Leads" (P1–P4/Cliente/Desqualificado) é preenchida à mão** na
planilha Pesquisa Geral, e o mesmo vale para Diagnósticos. Foi o motivo de a migração
congelar dados que o time achava vivos.

**O horário da inscrição é o horário local do Brasil**, do jeito que a planilha
registra. Ao agrupar por dia, não converta para UTC: quem se inscreve depois das 21h
cairia no dia seguinte e o "novos por dia" mudaria em silêncio.

**A comparação de origem não paga é por conteúdo, não por padrão de SQL.** A lista tem
termos com underline (`HS_EMAIL`, `X1_DISPARAI`); num `LIKE` o `_` casaria com qualquer
caractere e marcaria como orgânico quem é pago.

## O que sobrou para depois

- **`inscritosDesde` de algumas edições ainda é `null`** (janela aberta). Hoje é
  inofensivo, mas edição nova da mesma linha exige fechar a anterior — ver o checklist
  no topo de `api/_editions.js`.
- **Respostas de pesquisa que não casam com nenhuma edição** continuam invisíveis para
  o painel. O `pesquisaExtra` cobre ~90% delas; o resto tem utm que ninguém emitiu.
