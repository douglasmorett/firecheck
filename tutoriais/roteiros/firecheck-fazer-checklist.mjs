// Tutorial da EQUIPE: fazer um checklist na Tela de Execução (/funcionario →
// /execucao/:id), gravado em tela de celular, com a conta da Ana Souza.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Conferido no código (EmployeeDashboard.jsx, ChecklistExecution.jsx,
// api/index.js) antes de cada frase:
// - os checklists da loja sem responsável aparecem para toda a equipe; a lista
//   separa "Checklists Pendentes" de "Concluídos Hoje" (dia de São Paulo);
// - "Iniciar" abre /execucao/:id; a barra do alto conta as tarefas respondidas;
// - o preenchimento fica guardado no aparelho (rascunho do dia, "Rascunho salvo"),
//   e a lista passa a mostrar "Continuar" com a porcentagem;
// - tarefa com foto: "Câmera ao Vivo" abre a câmera, "Capturar Foto" tira; o xis
//   apaga a foto; sem a foto obrigatória o Finalizar não envia (avisa e para);
// - "Finalizar e Enviar" grava e dispara a auditoria da IA em segundo plano
//   (process-audit-background): o parecer vai para o painel do gestor;
// - a tela "Checklist Enviado!" volta sozinha para a lista em 5 segundos.
//
// O que a fala NÃO diz de propósito: que a IA confere a foto NA HORA, com aviso
// de reprovação e "Refazer a foto". O código existe (conferirFoto), mas nesta
// build ele nunca é chamado (ver relatório): mostrar isso seria mentir.
import { dormir } from "../motor/palco.mjs";

/** O "Fechamento da loja" deste vídeo: uma tarefa de cada tipo e uma com foto. */
export const TAREFAS = [
  { id: 101, text: "Registro do gás fechado", type: "boolean" },
  { id: 102, text: "Óleo da fritadeira", type: "multiple", options: ["Bom para usar", "Trocar amanhã"] },
  { id: 103, text: "Dinheiro do caixa conferido (R$)", type: "numeric", unit: "reais" },
  { id: 104, text: "Piso da cozinha lavado", type: "boolean", requirePhoto: true },
].map((t) => ({ requirePhoto: false, timeLimit: "", notifyDelay: true, options: [], assignee: "", section: "", maxPhotos: 1, minQuantity: "", unit: "un", ...t }));

const INICIO_DO_DIA = `((date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'`;

/**
 * O dia da gravação fica sempre igual, a qualquer hora: o "Fechamento da loja"
 * pendente (com as tarefas deste vídeo) e os outros três já feitos hoje.
 */
export async function preparar(banco, base) {
  const fechamento = base.checklists.find((c) => c.titulo === "Fechamento da loja");
  await banco.query("UPDATE checklists SET tasks = $1 WHERE id = $2", [JSON.stringify(TAREFAS), fechamento.id]);
  await banco.query(`DELETE FROM checklist_submissions WHERE checklist_id = $1 AND created_at >= ${INICIO_DO_DIA}`, [fechamento.id]);
  for (const c of base.checklists.filter((x) => x.id !== fechamento.id)) {
    const { rows } = await banco.query(`SELECT 1 FROM checklist_submissions WHERE checklist_id = $1 AND created_at >= ${INICIO_DO_DIA}`, [c.id]);
    if (rows.length) continue;
    await banco.query(
      `INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, checklist_id, resolved, created_at)
       SELECT employee_name, store, tasks, feedback_info, checklist_id, TRUE,
              GREATEST((NOW() AT TIME ZONE 'UTC') - INTERVAL '40 minutes', ${INICIO_DO_DIA} + INTERVAL '1 minute')
         FROM checklist_submissions WHERE checklist_id = $1 ORDER BY created_at DESC LIMIT 1`, [c.id]);
  }
}

/** Cartão de uma tarefa (na execução) ou de um checklist (na lista). */
const cartao = (p, texto) => p.locator(".card", { hasText: texto }).first();
/** A barra do progresso e o texto "N/4 tarefas concluídas" logo abaixo dela. */
const barraDoProgresso = (p) => {
  const texto = p.getByText(/tarefas concluídas/);
  return [texto.locator("xpath=../preceding-sibling::div[1]"), texto];
};
const botao = (dentro, nome) => dentro.getByRole("button", { name: nome, exact: typeof nome === "string" }).first();

export default {
  id: "firecheck-fazer-checklist",
  titulo: "Como fazer um checklist",
  publico: "funcionario",
  conta: "funcionario",
  camera: "piso",
  tela: { width: 390, height: 844, celular: true },
  rota: "funcionario",
  prontaQuando: "text=Checklists Pendentes",
  pronuncia: { IA: "i á" },
  preparar,

  async antesDeGravar(palco) {
    await palco.pagina.evaluate(() => window.scrollTo({ top: 0 }));
    await dormir(500);
  },

  cenas: [
    {
      capitulo: "A Tela de Execução",
      fala: "Esta é a Tela de Execução do FireCheck. É nela que você faz, pelo celular, os checklists do dia.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        const ola = p.getByText(/Olá, Ana Souza/).locator("xpath=../..");
        await palco.mover(p.getByText(/Olá, Ana Souza/), { ms: 800 });
        await ctx.ate(0.4);
        await palco.destacar(ola, { folga: 4 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Mais abaixo, em Checklists pendentes, ficam os que ainda faltam hoje. Os que já foram feitos descem para Concluídos hoje.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const pendentes = p.getByText(/Checklists Pendentes/);
        await palco.rolarAte(pendentes, { bloco: "start" });
        await palco.destacar([pendentes, cartao(p, "Fechamento da loja")], { folga: 6 });
        await ctx.ate(0.6);
        await palco.destacar(p.getByText(/Concluídos Hoje/), { folga: 6 });
        await palco.mover(p.getByText(/Concluídos Hoje/), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Começar o checklist",
      fala: "Hoje falta o Fechamento da loja. Para começar, toque em Iniciar.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const iniciar = botao(cartao(p, "Fechamento da loja"), /Iniciar/);
        await palco.mover(iniciar, { ms: 700 });
        await ctx.ate(0.75);
        await palco.clicar(iniciar, { ms: 300 });
        await p.getByText("Registro do gás fechado").waitFor({ state: "visible", timeout: 20_000 });
        await dormir(600);
        await ctx.ate(1);
      },
    },
    {
      fala: "No alto fica o nome do checklist, e a barra mostra quantas tarefas você já respondeu.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.destacar(p.getByRole("heading", { name: "Fechamento da loja" }), { folga: 6 });
        await ctx.ate(0.45);
        await palco.destacar(barraDoProgresso(p), { folga: 6 });
        await palco.mover(p.getByText(/tarefas concluídas/), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Responder as tarefas",
      fala: "Cada tarefa tem o seu jeito de responder. Esta é de Sim ou Não.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.6);
        await palco.clicar(botao(cartao(p, "Registro do gás"), "Sim"));
        await ctx.ate(1);
      },
      pausa: 450,
    },
    {
      fala: "Nesta, você escolhe uma das opções.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.4);
        await palco.clicar(botao(cartao(p, "Óleo da fritadeira"), "Bom para usar"));
        await ctx.ate(1);
      },
      pausa: 450,
    },
    {
      fala: "E nesta, você digita o valor: aqui, o dinheiro que tem no caixa.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const campo = cartao(p, "Dinheiro do caixa").locator("input");
        await palco.rolarAte(campo);
        await palco.digitar(campo, "412");
        await ctx.ate(1);
      },
      pausa: 450,
    },
    {
      fala: "O celular vai guardando o que você responde. Se precisar sair da tela, o checklist fica em andamento e você continua de onde parou.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        await palco.destacar(barraDoProgresso(p), { folga: 6 });
        await palco.mover(p.getByText(/tarefas concluídas/), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Tirar a foto",
      fala: "Tarefa com foto avisa: Obrigatório, foto ao vivo. Responda e toque em Câmera ao Vivo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tarefa = cartao(p, "Piso da cozinha");
        await palco.rolarAte(tarefa, { bloco: "start" });
        await palco.destacar(tarefa.getByText(/Obrigatório: Foto ao vivo/), { folga: 6 });
        await ctx.ate(0.5);
        await palco.apagarDestaque();
        await palco.clicar(botao(tarefa, "Sim"));
        await ctx.ate(0.85);
        await palco.clicar(botao(tarefa, /Câmera ao Vivo/));
        // A câmera tem que estar mostrando imagem antes da captura da cena seguinte.
        await p.waitForFunction(() => { const v = document.querySelector("video"); return v && v.videoWidth > 0; }, null, { timeout: 15_000 });
        await dormir(900);
        await ctx.ate(1);
      },
    },
    {
      fala: "Aponte o celular para o que a tarefa pede, aqui o piso da cozinha, e toque em Capturar Foto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tarefa = cartao(p, "Piso da cozinha");
        const capturar = botao(tarefa, /Capturar Foto/);
        await palco.rolarAte(capturar);
        await palco.destacar(tarefa.locator("video"), { folga: 4 });
        await ctx.ate(0.6);
        await palco.apagarDestaque();
        await palco.clicar(capturar);
        await tarefa.locator("img").first().waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "A foto fica na tarefa. Saiu ruim? Toque no xis e tire outra. Sem a foto, o checklist não pode ser enviado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tarefa = cartao(p, "Piso da cozinha");
        const fotoTirada = tarefa.locator("img").first();
        await palco.rolarAte(fotoTirada);
        await palco.destacar(fotoTirada, { folga: 4 });
        await ctx.ate(0.35);
        const xis = fotoTirada.locator("xpath=..").locator("button");
        await palco.mover(xis, { ms: 600 });
        await ctx.ate(0.7);
        await palco.apagarDestaque();
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Finalizar",
      fala: "Com tudo respondido, é hora de enviar. Depois do envio, a inteligência artificial confere as fotos, e o gestor vê o resultado no painel. Toque em Finalizar e Enviar.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const finalizar = p.getByRole("button", { name: /Finalizar e Enviar/ });
        await palco.rolarAte(finalizar);
        await palco.destacar(finalizar, { folga: 6 });
        await palco.mover(finalizar, { ms: 600 });
        await ctx.ate(0.8);
        await palco.apagarDestaque();
        await palco.clicar(finalizar, { ms: 200 });
        await p.getByText("Checklist Enviado!").waitFor({ state: "visible", timeout: 20_000 });
        await palco.rolarPagina(0);
        await palco.mover(p.getByText("Checklist Enviado!"), { ms: 700 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Pronto, checklist enviado! Em alguns segundos, a tela volta sozinha para a lista.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const enviado = p.getByText("Checklist Enviado!");
        // A tela troca sozinha em 5 s: se ela já trocou, o destaque não acontece.
        if (await enviado.isVisible().catch(() => false)) {
          await palco.destacar(p.getByText(/Retornando em/), { folga: 8 }).catch(() => {});
          await ctx.ate(0.6);
          await palco.apagarDestaque();
        }
        await p.getByText(/Concluídos Hoje/).waitFor({ state: "visible", timeout: 15_000 });
        await dormir(600);
        await ctx.ate(1);
      },
    },
    {
      fala: "E o Fechamento da loja aparece em Concluídos hoje, riscado e com o selo de finalizado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const feito = p.locator(".card", { hasText: "Fechamento da loja" }).filter({ hasText: "Finalizado" }).first();
        await palco.rolarAte(feito);
        await palco.destacar([p.getByText(/Concluídos Hoje/), feito], { folga: 6 });
        await palco.mover(feito.getByText("Fechamento da loja"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 600,
    },
    {
      capitulo: "Para rever este vídeo",
      fala: "Ficou alguma dúvida? Para rever este vídeo, é só tocar em Tutorial, aqui no alto da tela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        const tutorial = p.getByRole("button", { name: /Tutorial/ }).first();
        const alvo = (await tutorial.isVisible().catch(() => false)) ? tutorial : p.getByRole("heading", { name: "FireCheck", exact: true });
        await palco.destacar(alvo, { folga: 6 });
        await palco.mover(alvo, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 900,
    },
  ],
};
