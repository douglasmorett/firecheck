# Tutoriais em vídeo do FireCheck — como escrever um roteiro

O motor é o mesmo dos tutoriais do FireHub (`C:\Users\Micro\Documents\firehub-site\tutoriais\`,
leia o `README.md` e o `ROTEIRO.md` de lá: as regras de fala e as armadilhas valem aqui).
O modelo pronto deste repositório é `roteiros/firecheck-painel.mjs`: leia inteiro antes de começar.

## O que muda no FireCheck

- **Loja fictícia:** "Sabor da Praça" (`ambiente/semente.mjs`), recomeçada do zero a cada gravação.
  Dono Carlos Mendes, gestora Fernanda Lima, equipe Ana (cozinha), Bruno, Juliana, Rafael (moto), Lucas.
  4 checklists com uma semana de histórico (a "Abertura da cozinha" de ontem foi REPROVADA pela IA na
  bancada), ponto da semana com selfie, 2 escalas, 2 veículos, lista "Compras da semana", 1 descarte e
  1 ocorrência. Fotos e rostos em `ambiente/fotos/` (gerados; ninguém real).
- **Quem entra:** `conta: "dono"` (padrão), `"gestora"` ou `"funcionario"` (Ana Souza) no roteiro.
- **Celular:** `tela: { width: 390, height: 844, celular: true }` — o vídeo sai em pé e a seta vira dedo.
  Todo vídeo da equipe (Tela de Execução, ponto, descarte, compras) é em celular.
- **Câmera:** `camera: "rosto-ana"` (ou o nome de qualquer foto de `ambiente/fotos/`, sem .jpg). O Chrome
  da gravação usa essa foto como a câmera do aparelho, sem pedir permissão: a selfie do ponto e a foto da
  tarefa saem com ela. Uma câmera por vídeo.
- **GPS:** fixo na praça da loja; o endereço que o OpenStreetMap devolveria é trocado pelo da loja fictícia.
- **IA de verdade:** o ambiente tem a chave do Gemini do FireCheck. A auditoria das fotos e o "IA Online"
  funcionam de verdade (demora uns segundos: ponha a espera numa fala).
- **Nada sai da máquina:** WhatsApp, Cakto, Firebase e e-mail ficam sem chave. Não clique em nada que
  dependa deles na frente da câmera (conectar Bill, pagar plano, notificação push).
- **Dados extras de uma tela:** `async preparar(banco, base)` — `banco` é um cliente `pg` já conectado
  (`await banco.query(sql, params)`), `base` = `{ loja, dono, pessoas, checklists, escalas }`.
  Atenção ao fuso: `checklist_submissions.created_at` é UTC sem fuso (como em produção);
  `ponto_records.timestamp` e `ocorrencias.created_at` são hora de São Paulo sem fuso.
- **Aba do painel:** o painel guarda a aba aberta (`localStorage.admin_active_tab`). No `antesDeGravar`,
  clique no item do menu pelo código: `menu(p, "Equipe").evaluate((b) => b.click())`
  (`p.locator("aside.sidebar button", { hasText: nome })`). Clique "de verdade" na frente da câmera é com
  `palco.clicar`.
- **Fim do vídeo:** "Para rever este vídeo, é só clicar em Tutorial, aqui no alto da tela." apontando o
  botão "Tutorial" SE ele estiver na tela (`isVisible`); senão aponte o título da tela. (Os vídeos ainda não
  estão publicados na primeira gravação; depois de publicar, todos são regravados e a seta cai no botão.)
- **Pronúncia:** `pronuncia: { IA: "i á" }` quando a fala tiver "IA" escrito; "FireCheck" já vira "Fire Check".

## O passo a passo

1. `npx vite build --outDir tutoriais/.dist --emptyOutDir` (já feito; refaça só se o app mudou).
2. `node tutoriais/ambiente/ambiente.mjs subir N` e, no MESMO comando de cada passo seguinte,
   `eval "$(node tutoriais/ambiente/ambiente.mjs variaveis N)" && ...`.
3. Olhar as telas: `node tutoriais/ambiente/semente.mjs` (semeia) e
   `node tutoriais/motor/passear.mjs dono|funcionario` (foto de cada aba), ou
   `node tutoriais/motor/explorar.mjs <passos.mjs> [conta] [celular]` (um arquivo com
   `export default async (pagina, foto, BASE) => {...}` para clicar e fotografar).
4. Ler o código da tela em `src/pages/...` e `api/index.js`: a fala só afirma o que o código faz.
5. Escrever `tutoriais/roteiros/<id>.mjs` com a ferramenta de escrever arquivo (nunca heredoc).
6. `node tutoriais/produzir.mjs <id> --rascunho` → `node tutoriais/motor/revisar.mjs <id> 0.5,0.97` e LER
   as folhas em `saida/<id>/revisao/`. Repetir até ficar bom.
7. `node tutoriais/produzir.mjs <id>` (com voz) → `node tutoriais/motor/ouvir.mjs <id>` tem que terminar em
   "trilha conferida". Se reclamar de tela parada, a máquina estava ocupada: grave de novo.
8. Apagar `saida/<id>/quadros` no fim. Não rodar `publicar.mjs`.
