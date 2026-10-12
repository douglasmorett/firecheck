// Tutorial da EQUIPE: registrar ocorrência e descarte (Tela de Execução,
// /funcionario), gravado em tela de celular com a conta da Ana Souza.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Conferido no código antes de cada frase:
// - EmployeeDashboard.jsx: "Registrar Ocorrência" e "Registrar Descarte" no
//   alto; a janela diz "Seu gestor recebe na hora". Ocorrência pede "O que
//   aconteceu?" (obrigatório) e foto opcional. Descarte pede o item
//   (obrigatório), quantidade, unidade (un, kg, g, L, ml, cx, pct), valor
//   estimado (R$), motivo (lista), detalhe opcional e foto opcional. "Enviar
//   para o gestor" grava (POST /api/ocorrencias) e mostra embaixo "Registrado.
//   Seu gestor foi avisado." (os erros são alert(): o vídeo não passa por eles).
// - A foto é um <input type="file" capture="environment">: no celular abre a
//   câmera traseira. A câmera falsa da gravação não serve aqui; o roteiro
//   entrega a foto (ambiente/fotos/descarte.jpg) pelo seletor de arquivo.
// - api/index.js: avisarOcorrencia manda push/WhatsApp para admin e gestor.
//   Loja ligada ao FireHub mostraria "vai para o FireHub e conta como perda":
//   a loja da semente NÃO é ligada, e a fala não fala disso.
// - AdminDashboard.jsx (aba Alertas IA): lista ocorrências e descartes com o
//   nome de quem registrou, item, quantidade, motivo, valor e a foto.
import path from "node:path";
import { dormir } from "../motor/palco.mjs";

const FOTO_DO_DESCARTE = path.join(process.cwd(), "tutoriais", "ambiente", "fotos", "descarte.jpg");

const botao = (p, nome) => p.getByRole("button", { name: nome }).first();
const janela = (p) => p.locator("div.card", { has: p.getByRole("heading", { name: /Registrar (Ocorrência|Descarte)/ }) }).first();
const avisoOk = (p) => p.getByText("Registrado. Seu gestor foi avisado.");

export default {
  id: "firecheck-descarte",
  titulo: "Registrar ocorrência e descarte",
  publico: "funcionario",
  conta: "funcionario",
  camera: "descarte",
  tela: { width: 390, height: 844, celular: true },
  rota: "funcionario",
  prontaQuando: 'button:has-text("Registrar Descarte")',
  pronuncia: { IA: "i á" },

  async antesDeGravar(palco) {
    await palco.pagina.evaluate(() => window.scrollTo({ top: 0 }));
    await dormir(500);
  },

  cenas: [
    {
      capitulo: "Avisar o que fugiu da rotina",
      fala: "Na Tela de Execução, logo no alto, ficam dois botões para avisar o gestor do que fugiu da rotina: Registrar Ocorrência e Registrar Descarte.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const oc = botao(p, /Registrar Ocorrência/);
        const de = botao(p, /Registrar Descarte/);
        await dormir(400);
        await ctx.ate(0.35);
        await palco.destacar([oc, de], { folga: 6 });
        await palco.mover(oc, { ms: 600 });
        await ctx.ate(0.75);
        await palco.mover(de, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Registrar uma ocorrência",
      fala: "Ocorrência é um problema que o gestor precisa saber: um freezer que parou, um equipamento quebrado. Toque em Registrar Ocorrência.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.75);
        await palco.clicar(botao(p, /Registrar Ocorrência/), { ms: 600 });
        await janela(p).locator("textarea").waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Conte o que aconteceu neste campo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(300);
        await palco.digitar(janela(p).locator("textarea"), "A torneira da pia da cozinha está vazando.");
        await ctx.ate(1);
      },
    },
    {
      fala: "Se ajudar, anexe uma foto. Depois, toque em Enviar para o gestor.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const foto = janela(p).getByText("Anexar foto");
        await palco.destacar(foto.locator("xpath=.."), { folga: 4 });
        await palco.mover(foto, { ms: 600 });
        await ctx.ate(0.5);
        await palco.apagarDestaque();
        await palco.clicar(botao(p, /Enviar para o gestor/), { ms: 600 });
        await avisoOk(p).waitFor({ state: "visible", timeout: 20_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Pronto. Embaixo, a tela confirma que o registro foi feito e que o seu gestor foi avisado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const aviso = avisoOk(p);
        await palco.destacar(aviso, { folga: 6 });
        await palco.mover(aviso, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        // O aviso some sozinho em 4 s: a próxima cena começa sem ele.
        await aviso.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
      },
      pausa: 300,
    },
    {
      capitulo: "Registrar um descarte",
      fala: "Descarte é o que precisou ir para o lixo. Toque em Registrar Descarte.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.55);
        await palco.clicar(botao(p, /Registrar Descarte/), { ms: 600 });
        await p.getByPlaceholder("Ex.: caixa de tomate").waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Escreva o que foi descartado, a quantidade e a unidade.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(300);
        await palco.digitar(p.getByPlaceholder("Ex.: caixa de tomate"), "Esfirra de frango");
        await ctx.ate(0.55);
        await palco.digitar(p.getByPlaceholder("Ex.: 3"), "6");
        await ctx.ate(0.8);
        const unidade = janela(p).locator("select").first();
        await palco.apontar(unidade, { ms: 500 });
        await unidade.selectOption("un");
        await ctx.ate(1);
      },
    },
    {
      fala: "Se souber, ponha o valor estimado em reais. E escolha o motivo na lista.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.digitar(p.getByPlaceholder("Ex.: 45.00"), "21");
        await ctx.ate(0.6);
        const motivo = janela(p).locator("select").nth(1);
        await palco.apontar(motivo, { ms: 500 });
        await motivo.selectOption("Erro de preparo");
        await ctx.ate(1);
      },
    },
    {
      fala: "Quer explicar melhor? Use o campo de detalhes. Aqui, as esfirras queimaram no forno.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const detalhe = janela(p).locator("textarea");
        await palco.rolarAte(detalhe, { bloco: "center" });
        await palco.esperarRolagemParar(detalhe);
        await ctx.ate(0.4);
        await palco.digitar(detalhe, "Queimaram no forno.");
        await ctx.ate(1);
      },
    },
    {
      capitulo: "A foto do descarte",
      fala: "Agora a foto. Toque em Anexar foto, e o celular abre a câmera para você fotografar o que vai para o lixo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const anexar = janela(p).getByText("Anexar foto");
        await palco.rolarAte(anexar, { bloco: "center" });
        await palco.esperarRolagemParar(anexar);
        await ctx.ate(0.35);
        // No celular abre a câmera traseira; na gravação, o seletor de arquivo recebe a foto.
        const escolha = p.waitForEvent("filechooser", { timeout: 10_000 });
        await palco.clicar(anexar, { ms: 600 });
        await (await escolha).setFiles(FOTO_DO_DESCARTE);
        const foto = p.getByAltText("Foto do registro");
        await foto.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(300);
        await palco.rolarAte(foto, { bloco: "center" });
        await palco.esperarRolagemParar(foto);
        await ctx.ate(0.8);
        await palco.destacar(foto, { folga: 4 });
        await palco.mover(foto, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Confira tudo e toque em Enviar para o gestor.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const enviar = botao(p, /Enviar para o gestor/);
        await palco.rolarAte(enviar, { bloco: "center" });
        await palco.esperarRolagemParar(enviar);
        await ctx.ate(0.5);
        await palco.clicar(enviar, { ms: 600 });
        await avisoOk(p).waitFor({ state: "visible", timeout: 20_000 });
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Quem vê o registro",
      fala: "O descarte sai com o seu nome, e o gestor recebe na hora. No painel, o dono vê cada ocorrência e cada descarte, com a foto e o valor, na aba Alertas IA.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const aviso = avisoOk(p);
        if (await aviso.isVisible().catch(() => false)) {
          await palco.destacar(aviso, { folga: 6 });
          await palco.mover(aviso, { ms: 600 });
        }
        await ctx.ate(0.4);
        await palco.apagarDestaque();
        const de = botao(p, /Registrar Descarte/);
        const oc = botao(p, /Registrar Ocorrência/);
        await palco.rolarPagina(0);
        await dormir(500);
        await palco.destacar([oc, de], { folga: 6 });
        await palco.mover(de, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para rever este vídeo, é só tocar em Tutorial, aqui no alto da tela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tutorial = p.getByRole("button", { name: /Tutorial/ }).first();
        const alvo = (await tutorial.isVisible().catch(() => false)) ? tutorial : p.getByRole("heading", { name: "FireCheck" }).locator("xpath=..");
        await palco.rolarPagina(0);
        await dormir(400);
        await palco.destacar(alvo, { folga: 6 });
        await palco.mover(alvo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 900,
    },
  ],
};
