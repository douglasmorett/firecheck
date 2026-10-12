// Tutorial do painel do dono (aba Dashboard do /admin) — o passeio pelo FireCheck.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase:
// - cartões (AdminDashboard.jsx › stats, api › /api/stats):
//   "Checklists hoje" = checklists ENVIADOS hoje (dia de São Paulo);
//   "N concluídos" = os enviados no período das datas do alto;
//   "Conformidade geral" = % do período sem tarefa reprovada pela IA;
//   "Alertas IA" = enviados no período com tarefa reprovada e ainda não resolvidos;
//   o quarto cartão é o número de colaboradores da loja;
// - "Auditoria em Tempo Real": cada checklist enviado, com quem fez, a hora e o
//   selo Aprovado/Reprovado pela IA; clicar abre as respostas, as fotos e o
//   parecer da IA de cada tarefa;
// - "Finalizar Ocorrência (Ciente)" marca o checklist como resolvido (sem
//   janela de confirmação) e o alerta sai da conta do cartão;
// - "Exportar PDF" gera o relatório do checklist (o vídeo não clica: abre outra janela);
// - "Tela de Execução" leva à tela em que a equipe faz os checklists.
import { dormir } from "../motor/palco.mjs";

const cartao = (p, titulo) => p.locator(".card", { hasText: titulo }).first();
const menu = (p, nome) => p.locator("aside.sidebar button", { hasText: nome }).first();
const linhaReprovada = (p) => p.getByText("Reprovado pela IA").first();

export default {
  id: "firecheck-painel",
  titulo: "Um passeio pelo painel do FireCheck",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á", PDF: "pê dê éfe" },

  async antesDeGravar(palco) {
    const p = palco.pagina;
    // A aba aberta fica guardada no aparelho: o passeio começa sempre no Dashboard.
    await palco.pagina.evaluate(() => localStorage.setItem("admin_active_tab", "auditoria"));
    await menu(p, "Dashboard").evaluate((b) => b.click());
    await p.getByText("Auditoria em Tempo Real").waitFor({ state: "visible", timeout: 20_000 });
    await p.evaluate(() => { window.scrollTo({ top: 0 }); document.querySelector("aside.sidebar")?.scrollTo?.({ top: 0 }); });
    await dormir(1200);
    // Qualquer caixa rolada (a página, o menu) volta ao topo: o vídeo abre com o logo inteiro.
    await p.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll("*")]) if (el && el.scrollTop > 0) el.scrollTop = 0; });
    await dormir(300);
  },

  cenas: [
    {
      capitulo: "O que é o FireCheck",
      fala: "Este é o painel do FireCheck. Daqui o dono acompanha a rotina da loja: os checklists que a equipe faz no celular, com foto, conferidos pela inteligência artificial.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        await palco.mover(p.getByText("Painel do Dono"), { ms: 900 });
        await ctx.ate(0.45);
        await palco.destacar(p.locator("header", { hasText: "Painel do Dono" }).first(), { folga: 4 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Aqui em cima, o selo mostra que a inteligência artificial está ligada. E nas duas datas você escolhe o período que os números vão mostrar.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const selo = p.getByText("IA Online").first();
        await palco.camera([selo, p.locator('input[type="date"]').last()], { zoomMax: 1.7, margem: 60 });
        await palco.destacar(selo, { folga: 6 });
        await palco.mover(selo, { ms: 700 });
        await ctx.ate(0.45);
        await palco.apagarDestaque();
        const datas = p.locator('input[type="date"]').first().locator("xpath=..");
        await palco.destacar(datas, { folga: 6 });
        await palco.mover(p.locator('input[type="date"]').first(), { ms: 700 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Os números da loja",
      fala: "No primeiro cartão, quantos checklists a equipe já enviou hoje, e embaixo quantos foram feitos no período.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartao(p, "Checklists Hoje");
        await palco.camera(c, { zoomMax: 1.8, margem: 70 });
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "A conformidade é a parte dos checklists em que nenhuma tarefa foi reprovada pela inteligência artificial.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartao(p, "Conformidade Geral");
        await palco.camera(c, { zoomMax: 1.8, margem: 70 });
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E os alertas contam os checklists com alguma tarefa reprovada que ainda ninguém resolveu. Hoje tem um pedindo atenção.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartao(p, "Alertas IA");
        await palco.camera(c, { zoomMax: 1.8, margem: 70 });
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "A auditoria em tempo real",
      fala: "Logo abaixo fica a auditoria em tempo real: cada checklist enviado, quem fez, a hora, e o que a inteligência artificial achou das fotos.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const titulo = p.getByText("Auditoria em Tempo Real").first();
        await palco.rolarAte(titulo, { bloco: "start" });
        await palco.esperarRolagemParar(titulo);
        await palco.mover(titulo, { ms: 700 });
        await ctx.ate(0.5);
        const primeiro = p.getByText("Aprovado pela IA").first();
        await palco.destacar(primeiro, { folga: 6 });
        await palco.mover(primeiro, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Este aqui foi reprovado. Vamos abrir para ver o que aconteceu.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const reprovado = linhaReprovada(p);
        await palco.rolarAte(reprovado, { bloco: "center" });
        await palco.esperarRolagemParar(reprovado);
        await palco.destacar(reprovado, { folga: 6 });
        await palco.mover(reprovado, { ms: 700 });
        await ctx.ate(0.75);
        await palco.apagarDestaque();
        await palco.clicar(reprovado);
        await p.getByText("Respostas do Checklist").waitFor({ state: "visible", timeout: 10_000 });
        // A janela entra com animação: o destaque da cena seguinte espera ela assentar.
        await p.getByText("A bancada ainda tem farelos").first().waitFor({ state: "visible", timeout: 10_000 });
        await dormir(700);
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Abrir um checklist feito",
      fala: "Abre com cada tarefa, a foto que a funcionária tirou na hora e o parecer da inteligência artificial ao lado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const parecer = p.getByText("A bancada ainda tem farelos").first();
        const foto = p.locator("img").filter({ visible: true }).nth(0);
        await palco.camera([p.getByText("1. Bancada de inox limpa e seca"), parecer], { zoomMax: 1.5, margem: 50 });
        await palco.mover(p.getByText("1. Bancada de inox limpa e seca"), { ms: 700 });
        await ctx.ate(0.5);
        await palco.destacar(parecer.locator("xpath=.."), { folga: 6 });
        await palco.mover(parecer, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        void foto;
      },
    },
    {
      fala: "A tarefa pedia a bancada limpa, e a foto mostra farelo, molho e uma faca em cima. A inteligência artificial reprovou e explicou o porquê.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const parecer = p.getByText("A bancada ainda tem farelos").first();
        await palco.destacar(parecer.locator("xpath=.."), { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      fala: "Depois de conversar com a equipe, clique em Finalizar Ocorrência. O checklist fica como resolvido e sai da conta dos alertas.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Finalizar Ocorrência/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(0.5);
        await palco.apagarDestaque();
        await palco.clicar(botao);
        await p.getByText("Respostas do Checklist").waitFor({ state: "hidden", timeout: 10_000 });
        await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await dormir(900);
        const c = cartao(p, "Alertas IA");
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 700,
    },
    {
      capitulo: "O menu",
      fala: "No menu ao lado fica o resto do FireCheck: o controle de ponto, os alertas, os checklists, a frota, as compras e a equipe. Cada um tem o seu vídeo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const itens = ["Controle de Ponto IA", "Alertas IA", "Checklists", "Frota e Veículos", "Compras e Estoque", "Equipe"];
        await palco.destacar(p.locator("aside.sidebar"), { folga: 0 });
        for (const [i, nome] of itens.entries()) {
          await palco.mover(menu(p, nome), { ms: 450 });
          await ctx.ate(0.15 + (0.65 * (i + 1)) / itens.length);
        }
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "A tela da equipe",
      fala: "E o botão Tela de Execução abre a tela que a equipe usa no celular para fazer os checklists e bater o ponto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Tela de Execução/ }).first();
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Ficou alguma dúvida? Cada tela do FireCheck tem o seu vídeo: é só clicar em Tutorial, no alto da tela, ou em Tutoriais em vídeo, no menu.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tutoriais = p.locator("aside.sidebar").getByText("Tutoriais em vídeo").first();
        if (await tutoriais.isVisible().catch(() => false)) {
          await palco.destacar(tutoriais, { folga: 6 });
          await palco.mover(tutoriais, { ms: 800 });
        } else {
          await palco.mover(p.getByText("Painel do Dono"), { ms: 800 });
        }
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 900,
    },
  ],
};
