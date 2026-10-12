// Tutorial da aba "Conectar com Bill" do painel do dono.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (AdminDashboard.jsx › tab 'bill',
// handleBillLink/handleBillUnlink; api/index.js › /api/bill/link|unlink|status):
// - o texto da tela: "O Bill é a IA dos participantes do projeto Empresa
//   Inteligente, por @douglasmorett";
// - conectar = e-mail e senha da conta do Bill; o servidor do FireCheck faz o
//   login no servidor do Bill (backend-grupohakim…/api/auth/login) e guarda a
//   ligação; senha errada volta como aviso em vermelho acima do formulário;
// - conectado, a aba troca para "Conectado ao Bill" com "Desvincular conta";
// - o vídeo NÃO clica em "Conectar minha conta": o clique iria ao servidor de
//   verdade do Bill.
// O que a fala evita de propósito: dizer o que a integração faz. Os quatro
// itens do quadro ("Checklists sincronizados", "Dashboard integrado"...) não
// têm código correspondente neste repositório — o token do Bill é guardado e
// nunca usado —, então a fala só aponta o quadro. Também não diz "WhatsApp":
// a tela não fala disso, e o robô do WhatsApp (/api/webhooks/whatsapp) é outra
// coisa, ligada por variável de ambiente, sem relação com esta conexão.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal } from "./_a4-comum.mjs";

const titulo = (p) => p.getByRole("heading", { name: "Conectar com o Bill" }).first();

export default {
  id: "firecheck-bill",
  titulo: "Como conectar o FireCheck ao Bill",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á" },

  async antesDeGravar(palco) {
    await abrirAba(palco, { chave: "bill", nomeNoMenu: "Conectar com Bill", prova: "text=Conectar minha conta" });
  },

  cenas: [
    {
      capitulo: "O que é o Bill",
      fala: "Nesta aba você liga o FireCheck à sua conta do Bill. Como diz a tela, o Bill é a inteligência artificial dos participantes do projeto Empresa Inteligente, do Douglas Morett.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        await palco.mover(titulo(p), { ms: 900 });
        await ctx.ate(0.35);
        const texto = p.getByText("O Bill é a IA dos participantes").first();
        await palco.camera([titulo(p), texto], { zoomMax: 1.6, margem: 60 });
        await palco.destacar(texto, { folga: 8 });
        await palco.mover(texto, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      fala: "Logo abaixo, a tela mostra o que entra na integração.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const quadro = p.getByText("O que a integração faz:").locator("xpath=..");
        await palco.destacar(quadro, { folga: 4 });
        await palco.mover(p.getByText("O que a integração faz:"), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Como conectar",
      fala: "Para conectar, use o mesmo e-mail e a mesma senha da sua conta do Bill. O FireCheck confere os dois direto com o Bill.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const email = p.getByPlaceholder("seu@email.com");
        await palco.rolarAte(email, { bloco: "center" });
        await palco.camera(p.locator("form").first(), { zoomMax: 1.5, margem: 30, ms: 600 });
        await palco.digitar(email, "carlos@sabordapraca.com.br");
        await palco.digitar(p.getByPlaceholder("Sua senha do Bill"), "sabor123");
        await ctx.ate(1);
      },
    },
    {
      fala: "Depois, é só clicar em Conectar minha conta.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Conectar minha conta/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Se a senha estiver errada",
      fala: "Se o e-mail ou a senha estiverem errados, aparece um aviso em vermelho logo acima do e-mail, e nada é ligado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.mover(p.getByText("E-mail do Bill", { exact: true }), { ms: 800 });
        await ctx.ate(1);
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Depois de conectar",
      fala: "Com a conta ligada, esta aba passa a mostrar Conectado ao Bill, e o botão Desvincular conta, para desligar quando quiser.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        const topo = titulo(p).locator("xpath=..");
        await palco.destacar(topo, { folga: 0 });
        await palco.mover(titulo(p), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Quem ainda não tem o Bill",
      fala: "E quem ainda não tem o Bill encontra o caminho aqui embaixo: o link leva ao Instagram do Douglas Morett.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const link = p.getByText("Fale com @douglasmorett no Instagram").first();
        await palco.rolarAte(link, { bloco: "center" });
        const rodape = link.locator("xpath=../..");
        await palco.destacar(rodape, { folga: 4 });
        await palco.mover(link, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    cenaFinal(titulo),
  ],
};
