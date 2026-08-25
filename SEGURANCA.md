# Segurança — o que ainda depende de configuração

Este arquivo lista o que o **código já faz** e o que ainda **depende de uma
variável de ambiente** para passar a valer. Nenhum segredo real mora aqui.

## Variáveis a configurar na Vercel

Enquanto estas não existirem, as rotas correspondentes continuam **abertas** e
gravam um aviso no log a cada requisição. No instante em que forem definidas, a
verificação passa a valer sozinha — não é preciso mexer no código.

| Variável | O que ela fecha | O que acontece sem ela |
|---|---|---|
| `CRON_SECRET` | `/api/cron/*`, `/api/send-trial-welcome`, `/api/auto-process-pending` | Qualquer um dispara os crons, inclusive o envio de WhatsApp de ausência |
| `CAKTO_WEBHOOK_SECRET` | `/api/webhooks/cakto` | Qualquer um ativa um plano pago para si ou cancela o de um cliente |
| `WHATSAPP_WEBHOOK_SECRET` | `/api/webhooks/whatsapp` | Qualquer um injeta mensagem como se fosse um cliente |

**`CRON_SECRET` é especial na Vercel:** basta defini-la no projeto. A Vercel
passa a mandar `Authorization: Bearer <valor>` nas chamadas do agendador
sozinha, e é exatamente isso que o código confere. Não é preciso mexer no
`vercel.json`.

**`CAKTO_WEBHOOK_SECRET`** precisa do mesmo valor cadastrado **dos dois lados**:
na Vercel e no painel da Cakto. O código aceita o segredo por cabeçalho
(`x-cakto-signature`, `x-webhook-secret`, `x-hub-signature`, `Authorization`),
por query (`?secret=`) ou no corpo, porque cada gateway envia de um jeito.

**`WHATSAPP_WEBHOOK_SECRET`** não precisa de nada do outro lado: a Evolution API
não assina requisição, então o segredo viaja na própria URL do webhook — e é o
próprio código que a cadastra na Evolution, já com o valor.

## O que já está valendo, sem depender de configuração

- **Login com freio progressivo.** Três falhas passam; da quarta em diante a
  espera cresce (1, 5, 15, 30 minutos). A contagem principal é por **conta**, não
  por IP: o IP vem de `x-forwarded-for`, que quem chama escreve, e trocá-lo a
  cada tentativa contornava o limite anterior. Acertar a senha limpa o contador.
- **Trocar a senha derruba as sessões antigas.** A coluna `password_changed_at`
  invalida todo token emitido antes da troca. Antes, redefinir a senha não
  expulsava quem já estava dentro com um token roubado.
- **Rotas que gastam Gemini exigem token** (`/api/process-camera-ai`,
  `/api/generate-checklist-ai`). Estavam abertas e queimavam a cota da conta.
- **Escopo de loja nas rotas alcançáveis por id.** Ponto (editar/excluir
  marcação, consultar o dia de um funcionário), compras (itens, exclusão de
  lista) e `/api/resolve-submission` conferem a loja dona do registro. Antes, um
  id sequencial e qualquer conta válida bastavam para alcançar outra empresa.
- **Campos de autoria vêm do token.** `resolved_by` e `edited_by` eram lidos do
  corpo da requisição — dava para assinar a ação com o nome de outra pessoa,
  justamente no dado que serve para provar quem mexeu.
- **`/api/quota` exige token e escopo.** Lia a loja da query: dava para enumerar
  o cadastro comercial de todos os clientes trocando um parâmetro.
- **`JWT_SECRET` é obrigatória em produção.** Sem ela, cada instância sorteava a
  sua e o usuário era deslogado ao acaso.

## Pendências que não se resolvem no código

- **Chave do Gemini** — está no histórico do git, em repositório público, e
  **não foi rotacionada**. Rotacionar no Google AI Studio e atualizar
  `GEMINI_API_KEY` na Vercel.
- **Repositório público** — o histórico ainda guarda os blobs das credenciais
  antigas. Rotacionar mata o dano; deixar o repositório privado fecha a porta.
- **`android/app/firecheck.jks`** versionado, com a senha em texto puro no
  `build.gradle`. Não se resolve trocando a senha: depende de Play App Signing e
  key upgrade.
- **Row-Level Security** — não está ativa. A separação entre lojas hoje é feita
  no `WHERE` de cada consulta, não pelo banco. RLS de verdade exige uma role
  separada da dona das tabelas (a atual ignora RLS) e `SET LOCAL` por transação.
