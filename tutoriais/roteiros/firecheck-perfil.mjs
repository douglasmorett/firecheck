// Tutorial da aba "Perfil da Empresa" do painel do dono.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (AdminDashboard.jsx › tab 'perfil' e
// handleSaveCompanyProfile; api/index.js › PUT /api/users/:id):
// - "Nome da Empresa / Loja" grava o RÓTULO (store_name) da loja inteira — o
//   painel e a tela da equipe mostram store_name; a chave da loja não muda;
// - "Salvar Perfil" grava nome da empresa, nome do dono e telefone, mostra um
//   alert() (que a gravação dispensa) e recarrega a página — que volta no
//   Dashboard, porque a aba Perfil não está entre as que a recarga restaura;
// - "Plano Atual": userProfile.plan (o código cru, ex. COMBO_ANUAL) e Ativo ou
//   Trial; "Checklists: Ilimitados"; "Colaboradores: até N";
// - os dois botões de upgrade abrem a página de pagamento da Cakto numa aba nova
//   (window.open) — o vídeo não clica;
// - os avisos por WhatsApp (número e interruptores) ficam na aba Notificações.
// O que a fala evita: não há fuso horário nem uso do mês nesta aba (o fuso só é
// lido do cadastro; não há campo para mudá-lo), então o vídeo não fala deles.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal, menu } from "./_a4-comum.mjs";

const titulo = (p) => p.getByText("Perfil da Empresa / Conta").first();
const campo = (p, rotulo) => p.locator("label", { hasText: rotulo }).first().locator("xpath=following-sibling::input[1]");
const caixaDoPlano = (p) => p.getByText("Plano Atual", { exact: true }).locator("xpath=../..");

export default {
  id: "firecheck-perfil",
  titulo: "Perfil da empresa e plano no FireCheck",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { Cakto: "Cákto" },

  async antesDeGravar(palco) {
    await abrirAba(palco, { chave: "perfil", nomeNoMenu: "Perfil da Empresa", prova: "text=Perfil da Empresa / Conta" });
  },

  cenas: [
    {
      capitulo: "O que é esta tela",
      fala: "Em Perfil da Empresa ficam os dados da sua conta e o seu plano do FireCheck.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        await palco.mover(titulo(p), { ms: 900 });
        await ctx.ate(0.3);
        await palco.destacar(titulo(p), { folga: 8 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Os dados da empresa",
      fala: "O nome da empresa é o que aparece no painel e na tela da equipe.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const nome = campo(p, "Nome da Empresa / Loja");
        await palco.camera(nome.locator("xpath=../.."), { zoomMax: 1.6, margem: 40 });
        await palco.destacar(nome, { folga: 6 });
        await palco.mover(nome, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Embaixo, o nome do dono e o telefone de contato.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const dono = campo(p, "Nome do Gestor / Dono");
        const fone = campo(p, "Telefone de Contato");
        await palco.destacar(dono, { folga: 6 });
        await palco.mover(dono, { ms: 600 });
        await ctx.ate(0.5);
        await palco.apagarDestaque();
        await palco.destacar(fone, { folga: 6 });
        await palco.mover(fone, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para mudar, é só escrever por cima. Aqui, o nome da loja ganha o Lanchonete.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const nome = campo(p, "Nome da Empresa / Loja");
        await palco.clicar(nome);
        await p.keyboard.press("End");
        const comeco = Date.now();
        for (const [i, letra] of [..." Lanchonete"].entries()) {
          await p.keyboard.insertText(letra);
          const falta = comeco + (i + 1) * 90 - Date.now();
          if (falta > 0) await dormir(falta);
        }
        await ctx.ate(1);
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      fala: "Depois, clique em Salvar Perfil. A página recarrega e abre no Dashboard, já com o nome novo da loja.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const salvar = p.getByRole("button", { name: "Salvar Perfil" });
        await palco.mover(salvar, { ms: 800 });
        await ctx.ate(0.3);
        await palco.clicar(salvar);
        await p.getByText("Auditoria em Tempo Real").first().waitFor({ state: "visible", timeout: 30_000 });
        await dormir(900);
        const loja = p.locator(".card", { hasText: "Sabor da Praça Lanchonete" }).last();
        await palco.camera(loja, { zoomMax: 1.8, margem: 70 });
        await palco.destacar(loja, { folga: 4 });
        await palco.mover(loja.getByText(/Lanchonete/).first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
      pausa: 600,
    },
    {
      fala: "Para voltar ao perfil, clique de novo em Perfil da Empresa.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.4);
        await palco.clicar(menu(p, "Perfil da Empresa"));
        await titulo(p).waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      capitulo: "O seu plano",
      fala: "Do lado, o plano atual da conta, e se ele está ativo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const plano = p.getByText("Plano Atual", { exact: true }).locator("xpath=..");
        await palco.camera(caixaDoPlano(p), { zoomMax: 1.6, margem: 30 });
        await palco.destacar(plano, { folga: 6 });
        await palco.mover(plano, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Os checklists não têm limite. E neste plano cabem até 50 colaboradores cadastrados.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const checklists = p.getByText(/Checklists:/).first();
        const colaboradores = p.getByText(/Colaboradores:/).first();
        await palco.destacar(checklists, { folga: 6 });
        await palco.mover(checklists, { ms: 700 });
        await ctx.ate(0.4);
        await palco.apagarDestaque();
        await palco.destacar(colaboradores, { folga: 6 });
        await palco.mover(colaboradores, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Trocar de plano",
      fala: "Para mudar de plano, estes botões abrem a página de pagamento numa aba nova: o combo anual ou o mensal.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const anual = p.getByRole("button", { name: /anual/ }).first();
        const mensal = p.getByRole("button", { name: /mensal/ }).first();
        await palco.destacar([anual, mensal], { folga: 6 });
        await palco.mover(anual, { ms: 700 });
        await ctx.ate(0.6);
        await palco.mover(mensal, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E atenção ao aviso em vermelho: depois da troca, cancele o plano antigo na Cakto, para não pagar duas vezes.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const aviso = p.getByText(/Lembre-se de cancelar o plano anterior/).first();
        await palco.destacar(aviso, { folga: 6 });
        await palco.mover(aviso, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "O que fica em outras abas",
      fala: "O número que recebe os avisos de WhatsApp fica em Notificações. E as pessoas da loja, em Equipe.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const notificacoes = menu(p, "Notificações");
        const equipe = menu(p, "Equipe");
        await palco.destacar(notificacoes, { folga: 4 });
        await palco.mover(notificacoes, { ms: 800 });
        await ctx.ate(0.55);
        await palco.apagarDestaque();
        await palco.destacar(equipe, { folga: 4 });
        await palco.mover(equipe, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    cenaFinal(titulo),
  ],
};
