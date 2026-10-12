// Tutorial da EQUIPE: contar o estoque da lista de compras (Tela de Execução →
// "Listas de Compras" → Preencher → /execucao/compras/:id), gravado em tela de
// celular, com a conta da Ana Souza.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Conferido no código (EmployeeDashboard.jsx, ShoppingExecution.jsx,
// api/index.js › /api/shopping/submit) antes de cada frase:
// - a lista aparece em "Listas de Compras" enquanto não foi conferida hoje; o cartão
//   mostra "N abaixo do mínimo" pelo estoque gravado na última contagem;
// - cada item mostra o "Estoque Mínimo Exigido" e a "Última conferência", só de
//   referência: o campo começa VAZIO e é obrigatório (o envio não sai sem todos);
// - abaixo do mínimo: "Abaixo do mínimo! Faltam N ... para atingir a cota.";
//   senão "Estoque Suficiente";
// - "Finalizar e Enviar Conferência" grava a contagem, atualiza o estoque dos
//   itens e mostra quantos ficaram abaixo do mínimo; o gestor vê o histórico e o
//   "abaixo do mínimo" no painel (Compras e Estoque);
// - depois do envio a lista some da Tela de Execução até o dia seguinte.
//
// O que a fala NÃO diz de propósito: que o gestor recebe WhatsApp. A tela afirma
// isso sempre, mas o servidor só manda se o dono/gestor tiver o WhatsApp ligado
// e a loja tiver a conexão configurada (ver relatório).
import { dormir } from "../motor/palco.mjs";

/** A última contagem (a da semente, de ontem) vira o estoque atual dos itens: aparece como referência. */
async function preparar(banco, base) {
  const ultima = { "Farinha de trigo": 12, "Queijo muçarela": 4, "Óleo de soja": 20, "Caixa de esfirra G": 140, "Refrigerante lata": 60 };
  for (const [nome, qtd] of Object.entries(ultima)) {
    await banco.query("UPDATE shopping_items SET current_stock = $1 WHERE name = $2", [qtd, nome]);
  }
  void base;
}

const item = (p, nome) => p.locator(".card", { hasText: nome }).first();
const campo = (p, nome) => item(p, nome).locator("input");

export default {
  id: "firecheck-compras-funcionario",
  titulo: "Contar o estoque da lista de compras",
  publico: "funcionario",
  conta: "funcionario",
  tela: { width: 390, height: 844, celular: true },
  rota: "funcionario",
  prontaQuando: "text=Listas de Compras",
  preparar,

  async antesDeGravar(palco) {
    await palco.pagina.evaluate(() => window.scrollTo({ top: 0 }));
    await dormir(500);
  },

  cenas: [
    {
      capitulo: "A lista de compras",
      fala: "Quando a loja tem uma lista de compras para conferir, ela aparece aqui na Tela de Execução, em Listas de compras.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const titulo = p.getByText(/Listas de Compras/);
        await dormir(500);
        await ctx.ate(0.35);
        await palco.rolarAte(titulo, { bloco: "start" });
        const cartao = p.locator(".card", { hasText: "Compras da semana" }).first();
        await palco.destacar([titulo, cartao], { folga: 6 });
        await palco.mover(cartao.getByText("Compras da semana"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "O cartão já avisa quantos itens estavam abaixo do mínimo na última contagem. Toque em Preencher.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartao = p.locator(".card", { hasText: "Compras da semana" }).first();
        const aviso = cartao.getByText(/abaixo do mínimo/);
        await palco.destacar(aviso, { folga: 6 });
        await palco.mover(aviso, { ms: 600 });
        await ctx.ate(0.65);
        await palco.apagarDestaque();
        await palco.clicar(cartao.getByRole("button", { name: /Preencher/ }), { ms: 600 });
        await p.getByText(/Quanto tem na loja agora/).first().waitFor({ state: "visible", timeout: 20_000 });
        await dormir(600);
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Contar cada item",
      fala: "Para cada item, conte o que tem na loja agora e digite a quantidade. A farinha de trigo: trinta quilos.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.destacar(item(p, "Farinha de trigo").locator("h3"), { folga: 6 });
        await ctx.ate(0.55);
        await palco.apagarDestaque();
        await palco.rolarAte(campo(p, "Farinha de trigo"));
        await palco.digitar(campo(p, "Farinha de trigo"), "30");
        await ctx.ate(1);
      },
    },
    {
      fala: "Do lado ficam o mínimo que a loja precisa ter e a última contagem. É só para referência: o campo começa vazio, para você contar de novo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const lado = item(p, "Farinha de trigo").getByText("Estoque Mínimo Exigido:").locator("xpath=..");
        await palco.rolarAte(lado);
        await palco.destacar(lado, { folga: 6 });
        await palco.mover(lado, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Se a quantidade fica abaixo do mínimo, o item fica vermelho e a tela mostra quanto falta. Aqui tem só quatro quilos de muçarela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarAte(campo(p, "Queijo muçarela"));
        await palco.digitar(campo(p, "Queijo muçarela"), "4");
        const aviso = item(p, "Queijo muçarela").getByText(/Abaixo do mínimo!/);
        await palco.rolarAte(aviso);
        await palco.destacar([campo(p, "Queijo muçarela"), aviso], { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E quando a quantidade chega ao mínimo, a tela mostra Estoque suficiente, em verde.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarAte(campo(p, "Óleo de soja"));
        await palco.digitar(campo(p, "Óleo de soja"), "20");
        await palco.destacar(item(p, "Óleo de soja").getByText("Estoque Suficiente"), { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Faça o mesmo com todos os itens. A conferência só é enviada com todos preenchidos.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarAte(campo(p, "Caixa de esfirra G"));
        await palco.digitar(campo(p, "Caixa de esfirra G"), "140");
        await palco.rolarAte(campo(p, "Refrigerante lata"));
        await palco.digitar(campo(p, "Refrigerante lata"), "60");
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Observação e envio",
      fala: "Se quiser, escreva uma observação para o gestor.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const obs = p.locator("textarea");
        await palco.rolarAte(obs);
        await palco.digitar(obs, "O queijo acaba antes de sexta.");
        await ctx.ate(1);
      },
    },
    {
      fala: "No fim, toque em Finalizar e Enviar Conferência.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const enviar = p.getByRole("button", { name: /Finalizar e Enviar Conferência/ });
        await palco.rolarAte(enviar);
        await palco.mover(enviar, { ms: 600 });
        await ctx.ate(0.75);
        await palco.clicar(enviar, { ms: 200 });
        await p.getByText("Conferência Finalizada!").waitFor({ state: "visible", timeout: 20_000 });
        await palco.rolarPagina(0);
        await ctx.ate(1);
      },
    },
    {
      fala: "Pronto: a contagem fica registrada, e a tela mostra quantos itens ficaram abaixo do mínimo. O gestor vê tudo no painel, em Compras e Estoque.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.destacar(p.getByText("Conferência Finalizada!"), { folga: 8 });
        await ctx.ate(0.3);
        const abaixo = p.getByText(/abaixo do estoque mínimo/);
        await palco.destacar(abaixo, { folga: 6 });
        await palco.mover(abaixo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Toque em Voltar para o Início. A lista de compras sai da tela por hoje.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(p.getByRole("button", { name: /Voltar para o Início/ }), { ms: 600 });
        await p.getByText(/Checklists Pendentes/).waitFor({ state: "visible", timeout: 20_000 });
        await dormir(800);
        await ctx.ate(0.55);
        const ponto = p.getByText(/Meu Ponto/);
        await palco.rolarAte(ponto, { bloco: "start" });
        await palco.mover(p.getByText(/Checklists Pendentes/), { ms: 700 });
        await ctx.ate(1);
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
