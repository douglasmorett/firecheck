// Tutorial da aba Equipe do painel do dono: cadastrar, gestor e permissões,
// editar, acessar a conta, remover e o limite do plano.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (src/pages/AdminDashboard.jsx e api/index.js):
// - a lista vem de /api/users da loja, mais nova primeiro (ORDER BY created_at DESC):
//   quem acaba de ser cadastrado entra no ALTO da lista;
// - "Adicionar Colaborador" abre "Cadastrar Colaborador": nome, e-mail de acesso,
//   senha inicial, telefone/WhatsApp e papel; só o dono vê a opção Gestor / Gerente
//   (isAdmin || isMaster). Funcionário entra na Tela de Execução; gestor, no painel;
//   o telefone recebe o comprovante de cada ponto batido no WhatsApp (api › /api/ponto POST);
// - as caixinhas de "Permissões do Gestor" escondem do menu dele a aba correspondente
//   (TAB_PERMISSION_MAP); "Editar" muda nome, telefone, papel, permissões e escala;
// - "Acessar Conta" entra no FireCheck como a pessoa (handleImpersonateUser) — o vídeo não clica;
// - a lixeira apaga a pessoa depois de um confirm() do navegador — o vídeo não clica
//   (a janela do navegador não aparece na gravação);
// - o limite: tetoDeColaboradores (Combo anual = 50) conta funcionários e gestores
//   da loja; o dono não entra. No limite, o cadastro recusa com a mensagem
//   "Seu plano permite N colaboradores e você já cadastrou todos". O número aparece
//   em Perfil da Empresa ("Colaboradores: até 50 cadastrados").
// - Não existe "desativar" colaborador: a fala não promete.
import { dormir } from "../motor/palco.mjs";
import { menu, abrirAba, cenaFinal } from "./_equipe-ponto-comum.mjs";

const linha = (p, nome) => p.locator("h4", { hasText: nome }).first().locator("xpath=ancestor::div[3]");
const janelaNova = (p) => p.locator(".card", { has: p.locator("h3", { hasText: "Cadastrar Colaborador" }) }).first();
const janelaEditar = (p) => p.locator(".modal-janela", { hasText: "Editar Colaborador" }).first();

export default {
  id: "firecheck-equipe",
  titulo: "Como cadastrar a equipe e os gestores",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { "DDD": "dê dê dê" },

  async antesDeGravar(palco) {
    await abrirAba(palco, "Equipe", "Equipe da Loja");
  },

  cenas: [
    {
      capitulo: "A equipe da loja",
      fala: "Na aba Equipe fica todo mundo que usa o FireCheck na sua loja: o nome, o papel, a escala de trabalho, o e-mail e o telefone.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(300);
        await palco.mover(menu(p, "Equipe"), { ms: 800 });
        await ctx.ate(0.3);
        const l = linha(p, "Lucas Oliveira");
        await palco.destacar(l, { folga: 4 });
        await palco.mover(l.locator("h4"), { ms: 700 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para cadastrar alguém, clique em Adicionar Colaborador.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Adicionar Colaborador/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(0.7);
        await palco.apagarDestaque();
        await palco.clicar(botao);
        await janelaNova(p).waitFor({ state: "visible", timeout: 10_000 });
        await dormir(500);
      },
    },
    {
      capitulo: "Cadastrar um funcionário",
      fala: "Escreva o nome completo e o e-mail. É com esse e-mail que a pessoa entra no FireCheck.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janelaNova(p);
        await palco.camera(j, { zoomMax: 1.35, margem: 30 });
        await palco.digitar(j.locator('input[placeholder="Ex: Douglas Hakim"]'), "Marcos Ribeiro");
        await palco.digitar(j.locator('input[type="email"]'), "marcos@sabordapraca.com.br");
        await ctx.ate(1);
      },
      pausa: 300,
    },
    {
      fala: "Crie uma senha inicial e passe para ele. No telefone, com DDD, ele recebe no WhatsApp o comprovante de cada ponto que bater.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janelaNova(p);
        await palco.digitar(j.locator('input[placeholder="Defina a senha"]'), "marcos123");
        await ctx.ate(0.45);
        await palco.digitar(j.locator('input[placeholder="Ex: 21999999999"]'), "(22) 99555-1020");
        await ctx.ate(1);
      },
      pausa: 300,
    },
    {
      fala: "No papel, Funcionário: ele usa a Tela de Execução no celular, para fazer os checklists e bater o ponto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const papel = janelaNova(p).locator("select").first();
        await palco.destacar(papel, { folga: 6 });
        await palco.apontar(papel, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Clique em Cadastrar Colaborador. Pronto: o Marcos já aparece no alto da lista.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = janelaNova(p).getByRole("button", { name: "Cadastrar Colaborador" });
        await palco.clicar(botao);
        await janelaNova(p).waitFor({ state: "hidden", timeout: 15_000 });
        await palco.cameraAberta({ ms: 500 });
        const l = linha(p, "Marcos Ribeiro");
        await l.waitFor({ state: "visible", timeout: 15_000 });
        await dormir(400);
        await ctx.ate(0.5);
        await palco.destacar(l, { folga: 4 });
        await palco.mover(l.locator("h4"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O gestor e as permissões",
      fala: "O gestor ajuda a tocar a loja e entra neste painel, como o dono. Só o dono pode cadastrar um gestor. A Fernanda é a gestora daqui.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const l = linha(p, "Fernanda Lima");
        await palco.rolarAte(l, { bloco: "center" });
        await ctx.ate(0.55);
        const selo = l.getByText("Gestor / Gerente");
        await palco.destacar(l, { folga: 4 });
        await palco.mover(selo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Clique em Editar para ver o que ela pode fazer.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = linha(p, "Fernanda Lima").getByRole("button", { name: "Editar" });
        await palco.clicar(botao);
        await janelaEditar(p).waitFor({ state: "visible", timeout: 10_000 });
        await dormir(600);
        await ctx.ate(1);
      },
    },
    {
      fala: "Em Permissões do Gestor, cada caixinha libera uma aba do painel. O que ficar desmarcado some do menu dela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const bloco = janelaEditar(p).getByText("Permissões do Gestor").locator("xpath=..");
        await palco.camera(bloco, { zoomMax: 1.5, margem: 40 });
        await palco.destacar(bloco, { folga: 4 });
        await palco.mover(janelaEditar(p).getByText("Permissões do Gestor"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Por exemplo: desmarcando Compras e estoque, a Fernanda deixa de ver as compras.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const caixa = janelaEditar(p).locator("label", { hasText: "Compras e estoque" });
        await palco.mover(caixa, { ms: 700 });
        await ctx.ate(0.5);
        await palco.clicar(caixa.locator("input"));
        await ctx.ate(1);
      },
    },
    {
      fala: "Nesta mesma janela você muda o nome, o telefone, o papel e a escala de trabalho. No fim, clique em Salvar Alterações.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janelaEditar(p);
        await palco.cameraAberta({ ms: 500 });
        const salvar = j.getByRole("button", { name: "Salvar Alterações" });
        await palco.rolarAte(salvar, { bloco: "end" });
        const escala = j.getByText("Escala de Trabalho").first().locator("xpath=..");
        await palco.destacar(escala, { folga: 4 });
        await palco.mover(escala, { ms: 700 });
        await ctx.ate(0.75);
        await palco.apagarDestaque();
        await palco.clicar(salvar);
        await janelaEditar(p).waitFor({ state: "hidden", timeout: 15_000 });
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Acessar a conta e remover",
      fala: "Acessar Conta abre o FireCheck como se você fosse aquela pessoa, para ver o que ela vê.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = linha(p, "Fernanda Lima").getByRole("button", { name: /Acessar Conta/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E a lixeira tira a pessoa da equipe. Antes de apagar, o FireCheck pede para você confirmar.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const lixeira = linha(p, "Fernanda Lima").locator("button").last();
        await palco.destacar(lixeira, { folga: 6 });
        await palco.mover(lixeira, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O limite do plano",
      fala: "O seu plano tem um limite de colaboradores. Ele aparece em Perfil da Empresa.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        await palco.clicar(menu(p, "Perfil da Empresa"));
        const limite = p.locator("p", { hasText: "Colaboradores:" }).first();
        await limite.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(500);
        await palco.camera(limite, { zoomMax: 1.8, margem: 80 });
        await palco.destacar(limite, { folga: 6 });
        await palco.mover(limite, { ms: 700 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Contam os funcionários e os gestores; o dono fica de fora. Quando a equipe chega no limite, o cadastro avisa e não deixa passar.",
      acao: async (palco, ctx) => {
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    cenaFinal((p) => p.getByText("Equipe da Loja").first(), async (palco) => {
      const p = palco.pagina;
      await palco.clicar(menu(p, "Equipe"));
      await p.getByText("Equipe da Loja").waitFor({ state: "visible", timeout: 10_000 });
      await dormir(400);
    }),
  ],
};
