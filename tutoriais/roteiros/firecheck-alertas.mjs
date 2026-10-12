// Tutorial da aba "Alertas IA" do painel do dono.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (AdminDashboard.jsx › tab === 'alertas'):
// - em cima, as ocorrências e os descartes da equipe (api › GET /api/ocorrencias,
//   no período das duas datas do alto); a equipe registra pelos botões "Registrar
//   Ocorrência" e "Registrar Descarte" da Tela de Execução (EmployeeDashboard.jsx);
//   ocorrência: quem, quando, o relato; descarte: item, quantidade, motivo, valor e
//   foto. Esses cartões NÃO têm botão nenhum (a API tem DELETE, a tela não usa):
//   ficam enquanto estiverem no período. A foto do descarte abre outra aba
//   (window.open): o vídeo não clica;
// - embaixo, cada tarefa com parecer "warning"/"error" da IA nos checklists do
//   período: tarefa, funcionário, loja e a frase da IA. A IA só grava "success" ou
//   "warning" (api › processarAuditoria): o subtítulo fala em "ignoradas", a fala não;
// - "Analisar Evidência e Resolver" abre a mesma janela do Dashboard (foto, parecer,
//   Exportar PDF, Finalizar Ocorrência). "Finalizar Ocorrência (Ciente)" marca o
//   checklist como resolvido, sem confirmação; o cartão fica verde, com
//   "(Concluída)", e o botão vira "Ver Evidência Salva".
// - o título da tarefa reprovada sai em branco sobre fundo claro (cor 'white' fixa):
//   ilegível até ser resolvida. Defeito do app, anotado no relatório.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal } from "./_gestor-comum.mjs";

const cartaoDoRegistro = (p, texto) => p.getByText(texto).first().locator("xpath=../../..");
const cartaoDaReprovacao = (p) => p.getByText(/A bancada ainda tem farelos/).first().locator("xpath=..");

export default {
  id: "firecheck-alertas",
  titulo: "Alertas da IA: reprovações, ocorrências e descartes",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á" },

  async antesDeGravar(palco) {
    await abrirAba(palco, "alertas", "Alertas IA", "Alertas da Inteligência Artificial");
    await palco.pagina.getByText(/Ocorrência · Bruno/).waitFor({ state: "visible", timeout: 20_000 });
    await palco.pagina.getByText(/A bancada ainda tem farelos/).waitFor({ state: "attached", timeout: 20_000 });
  },

  cenas: [
    {
      capitulo: "O que aparece aqui",
      fala: "A aba Alertas IA junta o que pede a sua atenção: as tarefas que a inteligência artificial reprovou e o que a equipe registrou fora da rotina.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const titulo = p.getByText("Alertas da Inteligência Artificial");
        const cabecalho = titulo.locator("xpath=..");
        await dormir(300);
        await palco.mover(titulo, { ms: 900 });
        await ctx.ate(0.3);
        await palco.destacar(cabecalho, { folga: 8 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Ocorrências e descartes",
      fala: "Em cima, o que a equipe registrou por conta própria, nos botões Registrar Ocorrência e Registrar Descarte da Tela de Execução.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const oc = cartaoDoRegistro(p, /Ocorrência · Bruno/);
        const de = cartaoDoRegistro(p, /Descarte · Ana/);
        await palco.destacar([oc, de], { folga: 6 });
        await palco.mover(oc, { ms: 800 });
        await ctx.ate(0.6);
        await palco.mover(de, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "A ocorrência mostra quem registrou, quando, e o que aconteceu: aqui, o freezer 2 com a porta que não fecha.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const oc = cartaoDoRegistro(p, /Ocorrência · Bruno/);
        await palco.camera(oc, { zoomMax: 1.6, margem: 50 });
        await palco.destacar(oc, { folga: 4 });
        await palco.mover(p.getByText(/Ocorrência · Bruno/), { ms: 700 });
        await ctx.ate(0.5);
        await palco.mover(p.getByText(/freezer 2/), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "O descarte traz o item, a quantidade, o motivo, o valor perdido e a foto do que foi para o lixo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const de = cartaoDoRegistro(p, /Descarte · Ana/);
        await palco.camera(de, { zoomMax: 1.6, margem: 50 });
        await palco.destacar(de, { folga: 4 });
        await palco.mover(p.getByText("Esfirra de carne"), { ms: 700 });
        await ctx.ate(0.45);
        await palco.mover(p.getByText(/R\$ 14/), { ms: 700 });
        await ctx.ate(0.75);
        await palco.mover(p.locator('img[alt="Foto do registro"]').first(), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      fala: "Esses registros são só aviso: não têm botão. Ficam aqui enquanto estiverem dentro das datas do alto da tela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.45);
        const datas = p.locator('input[type="date"]').first().locator("xpath=..");
        await palco.destacar(datas, { folga: 6 });
        await palco.mover(p.locator('input[type="date"]').first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Tarefas reprovadas",
      fala: "Embaixo, cada tarefa que a inteligência artificial reprovou: quem fez, a loja, e o que ela viu de errado na foto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartao = cartaoDaReprovacao(p);
        await palco.rolarAte(cartao, { bloco: "center" });
        await palco.esperarRolagemParar(cartao);
        await palco.destacar(cartao, { folga: 4 });
        await palco.mover(cartao.getByText(/Funcionário/), { ms: 700 });
        await ctx.ate(0.55);
        await palco.mover(p.getByText(/A bancada ainda tem farelos/), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Clique em Analisar Evidência e Resolver: abre o checklist, com a foto e o parecer.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Analisar Evidência e Resolver/ });
        await palco.mover(botao, { ms: 700 });
        await ctx.ate(0.4);
        await palco.clicar(botao);
        await p.getByText("Respostas do Checklist").waitFor({ state: "visible", timeout: 10_000 });
        await p.locator(".modal-janela").getByText(/A bancada ainda tem farelos/).waitFor({ state: "visible", timeout: 10_000 });
        await p.locator(".modal-janela img[alt=\"Evidência\"]").first().waitFor({ state: "visible", timeout: 15_000 });
        await dormir(700);
        const parecer = p.locator(".modal-janela").getByText(/A bancada ainda tem farelos/).locator("xpath=..");
        await palco.destacar(parecer, { folga: 6 });
        await palco.mover(parecer, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Resolver o alerta",
      fala: "Converse com a equipe e, quando estiver resolvido, clique em Finalizar Ocorrência.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Finalizar Ocorrência/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(0.7);
        await palco.apagarDestaque();
        await palco.clicar(botao);
        await p.getByText("Respostas do Checklist").waitFor({ state: "hidden", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "O alerta fica verde, marcado como concluído, e o botão vira Ver Evidência Salva, para consultar depois.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartao = cartaoDaReprovacao(p);
        await p.getByRole("button", { name: /Ver Evidência Salva/ }).waitFor({ state: "visible", timeout: 10_000 });
        await palco.rolarAte(cartao, { bloco: "center" });
        await palco.esperarRolagemParar(cartao);
        await palco.destacar(cartao, { folga: 4 });
        await palco.mover(cartao.getByText(/Concluída/), { ms: 700 });
        await ctx.ate(0.6);
        await palco.mover(p.getByRole("button", { name: /Ver Evidência Salva/ }), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 300,
    },
    {
      capitulo: "Consultar depois",
      fala: "Clicando em Ver Evidência Salva, o checklist abre de novo, agora marcado como Ocorrência Resolvida.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Ver Evidência Salva/ });
        await palco.clicar(botao);
        await p.getByText("Respostas do Checklist").waitFor({ state: "visible", timeout: 10_000 });
        const selo = p.getByText(/Ocorrência Resolvida/);
        await selo.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(700);
        await ctx.ate(0.6);
        await palco.destacar(selo, { folga: 6 });
        await palco.mover(selo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "No Dashboard",
      fala: "E lá no Dashboard, o cartão de alertas conta só os que ainda não foram resolvidos. Agora, nenhum.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(p.locator(".modal-janela").first().locator("button").first());
        await p.getByText("Respostas do Checklist").waitFor({ state: "hidden", timeout: 10_000 });
        await palco.rolarPagina(0);
        const menu = p.locator("aside.sidebar button", { hasText: "Dashboard" }).first();
        await palco.clicar(menu);
        const cartao = p.locator(".card", { hasText: "Alertas IA (Falhas)" }).first();
        await cartao.waitFor({ state: "visible", timeout: 10_000 });
        await p.getByText("Nenhum alerta").waitFor({ state: "visible", timeout: 15_000 });
        await dormir(400);
        await ctx.ate(0.4);
        await palco.camera(cartao, { zoomMax: 1.8, margem: 70 });
        await palco.destacar(cartao, { folga: 4 });
        await palco.mover(cartao, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
      pausa: 500,
    },
    cenaFinal((p) => p.getByText("Painel do Dono")),
  ],
};
