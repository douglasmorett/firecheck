// Tutorial da aba "Compras e Estoque" do painel do dono.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (AdminDashboard.jsx › tab 'compras';
// api/index.js › /api/shopping):
// - o cartão da lista mostra a recorrência, o número de itens e quantos itens
//   estão com o estoque contado abaixo do mínimo (shopping_items.current_stock,
//   que a contagem da equipe atualiza);
// - o lápis edita; a lixeira DESATIVA a lista (some da tela) e o histórico das
//   contagens fica (o DELETE virou active = FALSE);
// - "Ver Relatório Detalhado": cada item contado, o mínimo, e em vermelho os que
//   ficaram abaixo, com "Faltam N";
// - Recorrência é só o rótulo (Diária/Semanal/Mensal): a tela da equipe mostra a
//   lista até alguém conferir NAQUELE dia, sem olhar a recorrência — por isso a
//   fala não promete "aparece toda segunda";
// - "Atribuir a": com uma pessoa, só ela vê a lista na tela dela
//   (EmployeeDashboard › pendingShopping); "Qualquer colaborador" = todos;
// - uma conferência por lista por dia (o servidor recusa a segunda: 409);
// - ao enviar a contagem, o dono e os gestores com o WhatsApp ligado recebem a
//   lista do que falta (shopping/submit → enviarWhatsapp);
// - "Cadastrar com IA": conversa com o Bill IA (texto ou áudio) que, pronta,
//   preenche o formulário (handleShoppingAISend). O vídeo não clica (Gemini).
//
// A semente grava a contagem de ontem com os campos em snake_case
// (min_stock/current_stock), mas a contagem de verdade grava em camelCase
// (minStock/currentStock) e é isso que o relatório lê; e não preenche o estoque
// contado dos itens. O preparar() deixa os dois como o app deixaria.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal, menu } from "./_a4-comum.mjs";

const cartaoDaSemana = (p) => p.locator(".card", { hasText: "Compras da semana" }).filter({ hasText: "Semanal" }).first();
const linhaDoHistorico = (p) => p.locator(".card", { hasText: "Conferido por" }).first();
const relatorio = (p) => p.locator(".modal-content", { hasText: "Relatório de Conferência de Estoque" }).first();
const formulario = (p) => p.locator(".modal-content", { hasText: "Nova Lista de Compras" }).first();
const titulo = (p) => p.getByRole("heading", { name: "Listas de Compras" }).first();

export default {
  id: "firecheck-compras",
  titulo: "Listas de compras e estoque no FireCheck",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á" },

  async preparar(banco) {
    const { rows } = await banco.query("SELECT id, shopping_list_id, items FROM shopping_submissions");
    for (const s of rows) {
      const crus = typeof s.items === "string" ? JSON.parse(s.items) : s.items;
      const itens = crus.map((i) => ({
        name: i.name, unit: i.unit || "un",
        minStock: Number(i.minStock ?? i.min_stock), currentStock: Number(i.currentStock ?? i.current_stock),
      }));
      const abaixo = itens.filter((i) => i.currentStock < i.minStock);
      await banco.query("UPDATE shopping_submissions SET items = $1, below_minimum = $2 WHERE id = $3",
        [JSON.stringify(itens), JSON.stringify(abaixo), s.id]);
      for (const i of itens) {
        await banco.query("UPDATE shopping_items SET current_stock = $1 WHERE shopping_list_id = $2 AND name = $3",
          [i.currentStock, s.shopping_list_id, i.name]);
      }
    }
  },

  async antesDeGravar(palco) {
    await abrirAba(palco, { chave: "compras", nomeNoMenu: "Compras e Estoque", prova: "text=Histórico de Conferências de Estoque" });
  },

  cenas: [
    {
      capitulo: "O que é esta tela",
      fala: "Em Compras e Estoque você monta as listas de compras da loja, cada produto com o seu estoque mínimo. A equipe conta o que tem, e o FireCheck mostra o que está faltando.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        await palco.mover(titulo(p), { ms: 900 });
        await ctx.ate(0.4);
        await palco.destacar(titulo(p), { folga: 8 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "As listas da loja",
      fala: "Cada lista é um cartão. Esta é a das compras da semana: tem cinco itens, e três deles ficaram abaixo do mínimo na última contagem.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoDaSemana(p);
        await palco.camera(c, { zoomMax: 1.8, margem: 80 });
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c.getByText("itens").first(), { ms: 700 });
        await ctx.ate(0.6);
        await palco.mover(c.getByText(/abaixo do mínimo/).first(), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "O lápis edita a lista. A lixeira tira a lista da tela, mas as contagens já feitas continuam no histórico.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoDaSemana(p);
        const lapis = c.locator("button").nth(0);
        const lixeira = c.locator("button").nth(1);
        await palco.destacar(lapis, { folga: 6 });
        await palco.mover(lapis, { ms: 600 });
        await ctx.ate(0.35);
        await palco.apagarDestaque();
        await palco.destacar(lixeira, { folga: 6 });
        await palco.mover(lixeira, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "O que a equipe contou",
      fala: "Logo abaixo fica o histórico das conferências: quem contou, quando, e quantos itens ficaram abaixo do mínimo. Ontem, quem conferiu foi a Fernanda.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const linha = linhaDoHistorico(p);
        await palco.destacar(linha, { folga: 4 });
        await palco.mover(linha.getByText("Conferido por").first(), { ms: 800 });
        await ctx.ate(0.6);
        await palco.mover(linha.getByText(/abaixo do estoque mínimo/).first(), { ms: 600 });
        await ctx.ate(0.85);
        await palco.mover(linha.getByText("Fernanda Lima").first(), { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Clique em Ver Relatório Detalhado para ver a contagem item por item.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = linhaDoHistorico(p).getByRole("button", { name: /Ver Relatório Detalhado/ });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(0.45);
        await palco.clicar(botao);
        const r = relatorio(p);
        await r.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(400);
        await palco.rolarAte(r.getByText("Relatório de Conferência de Estoque"), { bloco: "start" });
        await ctx.ate(1);
      },
    },
    {
      fala: "No alto, quem contou, quando, e o recado que deixou: a muçarela acaba antes de sexta.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const r = relatorio(p);
        const caixa = r.locator("p", { hasText: "Funcionário:" }).first().locator("xpath=..");
        await palco.destacar(caixa, { folga: 4 });
        await palco.mover(r.locator("p", { hasText: "Funcionário:" }).first(), { ms: 700 });
        await ctx.ate(0.5);
        await palco.mover(r.locator("p", { hasText: "Obs:" }).first(), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Em vermelho, o que está abaixo do mínimo e quanto falta. A muçarela tem 4 quilos, e o mínimo é 10: faltam 6.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const r = relatorio(p);
        const mucarela = r.getByText("Queijo muçarela", { exact: true }).locator("xpath=../..");
        await palco.rolarAte(mucarela, { bloco: "center" });
        await palco.camera(mucarela, { zoomMax: 1.7, margem: 90 });
        await palco.destacar(mucarela, { folga: 4 });
        await palco.mover(mucarela.getByText(/Mínimo exigido/), { ms: 700 });
        await ctx.ate(0.55);
        await palco.mover(mucarela.getByText(/Faltam/), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Criar uma lista",
      fala: "Para montar uma lista nova, feche o relatório e clique em Nova Lista de Compras.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const fechar = relatorio(p).getByRole("button", { name: "Fechar" });
        await palco.rolarAte(fechar, { bloco: "center" });
        await palco.clicar(fechar);
        await relatorio(p).waitFor({ state: "hidden", timeout: 10_000 });
        await palco.rolarPagina(0);
        const nova = p.getByRole("button", { name: /Nova Lista de Compras/ });
        await ctx.ate(0.6);
        await palco.clicar(nova);
        const f = formulario(p);
        await f.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(300);
        await palco.rolarAte(f.getByText("Nova Lista de Compras").first(), { bloco: "start" });
        await ctx.ate(1);
      },
    },
    {
      fala: "Dê um nome para a lista.",
      acao: async (palco, ctx) => {
        const f = formulario(palco.pagina);
        await palco.camera(f, { zoomMax: 1.5, margem: 30, ms: 600 });
        await palco.digitar(f.getByPlaceholder("Ex: Compras Semanais da Cozinha"), "Hortifrúti do dia");
        await ctx.ate(1);
      },
      pausa: 300,
    },
    {
      fala: "Em Recorrência, escolha se ela é diária, semanal ou mensal.",
      acao: async (palco, ctx) => {
        const f = formulario(palco.pagina);
        const rec = f.locator("select").nth(0);
        await palco.apontar(rec, { ms: 700 });
        await ctx.ate(0.6);
        await rec.selectOption("daily");
        await ctx.ate(1);
      },
    },
    {
      fala: "Em Atribuir a, escolha quem confere a lista: só essa pessoa vê a lista na tela dela. Deixando qualquer colaborador, ela aparece para todos.",
      acao: async (palco, ctx) => {
        const f = formulario(palco.pagina);
        const quem = f.locator("select").nth(1);
        await palco.apontar(quem, { ms: 700 });
        await ctx.ate(0.3);
        await quem.selectOption("Ana Souza");
        await palco.destacar(quem, { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Os itens e o estoque mínimo",
      fala: "Agora os itens: o produto, a unidade e o estoque mínimo. Quando a contagem fica abaixo desse número, o item aparece como falta.",
      acao: async (palco, ctx) => {
        const f = formulario(palco.pagina);
        await palco.digitar(f.getByPlaceholder("Nome do produto").nth(0), "Tomate");
        const unidade = f.locator("select").nth(2);
        await palco.apontar(unidade, { ms: 500 });
        await unidade.selectOption("kg");
        await dormir(300);
        await palco.digitar(f.locator('input[type="number"]').nth(0), "8");
        await ctx.ate(1);
      },
    },
    {
      fala: "Para mais um produto, clique em Adicionar Item.",
      acao: async (palco, ctx) => {
        const f = formulario(palco.pagina);
        await palco.clicar(f.getByRole("button", { name: /Adicionar Item/ }));
        await dormir(300);
        await palco.digitar(f.getByPlaceholder("Nome do produto").nth(1), "Alface");
        await palco.digitar(f.locator('input[type="number"]').nth(1), "12");
        await ctx.ate(1);
      },
      pausa: 300,
    },
    {
      fala: "Se preferir, em Cadastrar com IA você descreve a lista, escrevendo ou por áudio, e a inteligência artificial preenche o formulário para você conferir.",
      acao: async (palco, ctx) => {
        const f = formulario(palco.pagina);
        const ia = f.getByRole("button", { name: /Cadastrar com IA/ });
        await palco.destacar(ia, { folga: 6 });
        await palco.mover(ia, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Tudo certo? Clique em Criar Lista.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const criar = formulario(p).getByRole("button", { name: "Criar Lista" });
        await palco.clicar(criar);
        await formulario(p).waitFor({ state: "hidden", timeout: 10_000 });
        await palco.cameraAberta({ ms: 500 });
        await p.locator(".card", { hasText: "Hortifrúti do dia" }).first().waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "A lista nova aparece primeiro: diária, com dois itens, e o nome de quem vai conferir.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = p.locator(".card", { hasText: "Hortifrúti do dia" }).first();
        await palco.rolarAte(c, { bloco: "center" });
        await palco.camera(c, { zoomMax: 1.8, margem: 80 });
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c.getByText("Diária").first(), { ms: 700 });
        await ctx.ate(0.5);
        await palco.mover(c.getByText(/Atribuído/).first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "A contagem da equipe",
      fala: "A Ana faz a contagem na Tela de Execução, pelo celular, e envia. Cada lista é conferida uma vez por dia, e a contagem entra aqui no histórico.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        if (await p.evaluate(() => window.scrollY > 0)) await palco.rolarPagina(0);
        const botao = p.getByRole("button", { name: /Tela de Execução/ }).first();
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(0.65);
        await palco.apagarDestaque();
        const h = p.getByText("Histórico de Conferências de Estoque").first();
        await palco.mover(h, { ms: 700 });
        await ctx.ate(1);
      },
    },
    {
      fala: "E com o WhatsApp ligado, em Notificações, o dono e os gestores recebem a lista do que precisa comprar assim que a contagem chega.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const item = menu(p, "Notificações");
        await palco.destacar(item, { folga: 4 });
        await palco.mover(item, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    cenaFinal(titulo),
  ],
};
