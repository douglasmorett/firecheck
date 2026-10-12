// Tutorial: ler um checklist que a equipe enviou (Dashboard › Auditoria em Tempo Real).
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
// O piloto (firecheck-painel) já mostra a reprovação da bancada e o Finalizar:
// aqui o foco é ler um checklist aprovado inteiro, cada tipo de resposta, a foto
// ampliada, o PDF e o filtro de categoria.
//
// Conferido no código antes de cada frase:
// - a lista da Auditoria segue as duas datas do alto (api › GET /api/submissions
//   com ?start=&end=). O rótulo "Últimas 24h" ao lado do filtro NÃO corresponde ao
//   que a lista mostra: a fala não o repete;
// - selo da linha (StatusBadge): aprovado só quando todas as fotos foram conferidas;
// - clicar na linha abre a janela com o registro completo (?id=): cabeçalho com quem
//   fez e quando; por tarefa, a resposta à direita — "Sim"/"Não", ou o próprio valor
//   (número, opção escolhida, nota) —, a foto e o parecer da IA;
// - foto em base64: clicar abre o visualizador em tela cheia (fotoAmpliada), que
//   fecha no X ou clicando fora (foto com link do Firebase abriria outra aba);
// - "Exportar PDF" (handleExportPDF) abre OUTRA janela com o relatório e chama
//   print(): o vídeo não clica. O relatório traz checklist, loja, responsável,
//   data/hora, % concluído, e por tarefa as fotos e o parecer da IA. A resposta de
//   número/escolha/nota NÃO vai para o PDF (só "Sim"/"Não"): a fala não promete;
// - "Finalizar Ocorrência (Ciente)" marca o checklist como resolvido (o vídeo não clica);
// - "Filtrar Categoria" compara com a categoria do checklist, escolhida no criador
//   ("Cozinha / Alimentos" lá = "Restaurante / Alimentação" aqui: o mesmo valor).
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal } from "./_gestor-comum.mjs";

const linhaDaAuditoria = (p, titulo, selo) => {
  const l = p.locator('div[style*="cursor: pointer"]', { hasText: titulo });
  return (selo ? l.filter({ hasText: selo }) : l).first();
};
const janela = (p) => p.locator(".modal-janela").first();
const cabecaDaTarefa = (p, texto) => janela(p).locator("h4", { hasText: texto }).first().locator("xpath=..");
const resposta = (p, texto) => cabecaDaTarefa(p, texto).locator("span").first();
const cartaoDaTarefa = (p, texto) => cabecaDaTarefa(p, texto).locator("xpath=..");
/** Ponto logo à esquerda e abaixo de um selo pequeno: a seta aponta sem cobrir o valor. */
const aoLado = async (alvo) => {
  const c = await alvo.boundingBox();
  return { x: c.x - 18, y: c.y + c.height + 8 };
};
const filtro = (p) => p.locator("select").filter({ has: p.locator('option[value="restaurante"]') }).first();

async function fecharJanela(palco) {
  const p = palco.pagina;
  await palco.clicar(janela(p).locator("button").first());
  await p.getByText("Respostas do Checklist").waitFor({ state: "hidden", timeout: 10_000 });
  await dormir(300);
}

async function abrirLinha(palco, linha, provaNaJanela) {
  const p = palco.pagina;
  await palco.rolarAte(linha, { bloco: "center" });
  await palco.esperarRolagemParar(linha);
  await palco.clicar(linha.locator("h4"));
  await p.getByText("Respostas do Checklist").waitFor({ state: "visible", timeout: 10_000 });
  // As fotos chegam numa segunda busca (?id=): espera a imagem e a animação da janela.
  await janela(p).locator('img[alt="Evidência"]').first().waitFor({ state: "visible", timeout: 15_000 });
  await janela(p).getByText(provaNaJanela).first().waitFor({ state: "visible", timeout: 10_000 });
  await dormir(700);
}

export default {
  id: "firecheck-resultados",
  titulo: "Ver o checklist feito: fotos, IA e PDF",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á", PDF: "pê dê éfe" },

  // A abertura da cozinha passa a ser da categoria Cozinha: é o que o filtro mostra no fim.
  async preparar(banco, base) {
    const abertura = base.checklists.find((c) => c.titulo === "Abertura da cozinha");
    await banco.query("UPDATE checklists SET category = 'restaurante' WHERE id = $1", [abertura.id]);
  },

  async antesDeGravar(palco) {
    await abrirAba(palco, "auditoria", "Dashboard", "Auditoria em Tempo Real");
  },

  cenas: [
    {
      capitulo: "Onde ficam os checklists feitos",
      fala: "Todo checklist que a equipe envia aparece aqui no Dashboard, dentro do período destas duas datas.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const datas = p.locator('input[type="date"]').first().locator("xpath=..");
        await dormir(300);
        await palco.mover(p.getByText("Painel do Dono"), { ms: 800 });
        await ctx.ate(0.5);
        await palco.destacar(datas, { folga: 6 });
        await palco.mover(p.locator('input[type="date"]').first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Na Auditoria em Tempo Real, cada linha é um checklist enviado: quem fez, a hora, e o selo da inteligência artificial.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const titulo = p.getByText("Auditoria em Tempo Real").first();
        await palco.rolarAte(titulo, { bloco: "start" });
        await palco.esperarRolagemParar(titulo);
        await palco.mover(titulo, { ms: 700 });
        await ctx.ate(0.35);
        const primeira = p.locator('div[style*="cursor: pointer"]').first();
        await palco.destacar(primeira, { folga: 4 });
        await palco.mover(primeira.locator("h4"), { ms: 600 });
        await ctx.ate(0.75);
        await palco.mover(primeira.getByText(/pela IA|Sem fotos/).first(), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Abrir um checklist",
      fala: "Vamos abrir esta Abertura da cozinha, que foi aprovada.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const linha = linhaDaAuditoria(p, "Abertura da cozinha", "Aprovado pela IA");
        await palco.rolarAte(linha, { bloco: "center" });
        await palco.esperarRolagemParar(linha);
        await palco.destacar(linha, { folga: 4 });
        await palco.mover(linha.locator("h4"), { ms: 700 });
        await ctx.ate(0.7);
        await palco.apagarDestaque();
        await abrirLinha(palco, linha, "Bancada de inox limpa e seca");
        await ctx.ate(1);
      },
    },
    {
      fala: "No alto, quem fez e quando. Embaixo vem cada tarefa: a resposta, a foto que ela tirou e o parecer da inteligência artificial.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cabecalho = janela(p).locator("h2").first().locator("xpath=..");
        await palco.destacar(cabecalho, { folga: 6 });
        await palco.mover(cabecalho.locator("p").first(), { ms: 700 });
        await ctx.ate(0.35);
        await palco.apagarDestaque();
        const cartao = cartaoDaTarefa(p, "Bancada de inox");
        await palco.destacar(cartao, { folga: 4 });
        await palco.mover(cabecaDaTarefa(p, "Bancada de inox").locator("h4"), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Aqui a resposta foi sim, e a inteligência artificial aprovou a foto e disse o porquê.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const sim = resposta(p, "Bancada de inox");
        const parecer = cartaoDaTarefa(p, "Bancada de inox").getByText("Aprovado pela IA").locator("xpath=..");
        await palco.camera([sim, parecer, cartaoDaTarefa(p, "Bancada de inox").locator('img[alt="Evidência"]')], { zoomMax: 1.5, margem: 40 });
        await palco.destacar(sim, { folga: 6 });
        await palco.mover(await aoLado(sim), { ms: 600 });
        await ctx.ate(0.4);
        await palco.apagarDestaque();
        await palco.destacar(parecer, { folga: 4 });
        await palco.mover(parecer, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Ampliar a foto",
      fala: "Clique na foto para ver grande.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const foto = cartaoDaTarefa(p, "Bancada de inox").locator('img[alt="Evidência"]');
        await palco.mover(foto, { ms: 700 });
        await ctx.ate(0.4);
        await palco.clicar(foto);
        await p.locator('img[alt="Evidência ampliada"]').waitFor({ state: "visible", timeout: 5000 });
        await ctx.ate(1);
      },
      pausa: 1200,
    },
    {
      fala: "Para fechar, é o X, ou um clique fora da foto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const x = p.getByRole("button", { name: "Fechar" });
        await palco.mover(x, { ms: 700 });
        await ctx.ate(0.6);
        await palco.clicar(x);
        await p.locator('img[alt="Evidência ampliada"]').waitFor({ state: "hidden", timeout: 5000 });
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Número e múltipla escolha",
      fala: "Na tarefa de número, a resposta é o valor que a funcionária digitou: a geladeira estava a três graus.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartao = cartaoDaTarefa(p, "Temperatura da geladeira");
        await palco.rolarAte(cartao, { bloco: "start" });
        await palco.esperarRolagemParar(cartao);
        await palco.mover(cabecaDaTarefa(p, "Temperatura da geladeira").locator("h4"), { ms: 700 });
        await ctx.ate(0.5);
        const valor = resposta(p, "Temperatura da geladeira");
        await palco.camera([cabecaDaTarefa(p, "Temperatura da geladeira")], { zoomMax: 1.7, margem: 60 });
        await palco.destacar(valor, { folga: 6 });
        await palco.mover(await aoLado(valor), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 450 });
      },
    },
    {
      fala: "Na de múltipla escolha, aparece a opção que ela tocou: o óleo está bom para usar.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartao = cartaoDaTarefa(p, "Óleo da fritadeira");
        await palco.rolarAte(cartao, { bloco: "start" });
        await palco.esperarRolagemParar(cartao);
        await palco.mover(cabecaDaTarefa(p, "Óleo da fritadeira").locator("h4"), { ms: 700 });
        await ctx.ate(0.45);
        const valor = resposta(p, "Óleo da fritadeira");
        await palco.camera([cabecaDaTarefa(p, "Óleo da fritadeira")], { zoomMax: 1.7, margem: 60 });
        await palco.destacar(valor, { folga: 6 });
        await palco.mover(await aoLado(valor), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 450 });
      },
    },
    {
      capitulo: "O relatório em PDF",
      fala: "Exportar PDF abre, numa janela nova, o relatório deste checklist pronto para imprimir ou salvar: com cada tarefa, as fotos e o parecer da inteligência artificial.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = janela(p).getByRole("button", { name: /Exportar PDF/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Já o Finalizar Ocorrência marca o checklist como resolvido: é o que você usa quando alguma tarefa sai reprovada.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = janela(p).getByRole("button", { name: /Finalizar Ocorrência/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Tarefa de nota",
      fala: "Agora, um checklist do salão.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await fecharJanela(palco);
        const linha = linhaDaAuditoria(p, "Salão pronto para abrir", "Aprovado pela IA");
        await abrirLinha(palco, linha, "Nota para a limpeza do salão");
        await ctx.ate(1);
      },
      pausa: 200,
    },
    {
      fala: "Na tarefa de nota, aparece a nota que a funcionária deu ao salão. Aqui, a nota máxima.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartao = cartaoDaTarefa(p, "Nota para a limpeza");
        await palco.rolarAte(cartao, { bloco: "center" });
        await palco.esperarRolagemParar(cartao);
        await ctx.ate(0.55);
        const valor = resposta(p, "Nota para a limpeza");
        await palco.camera([cabecaDaTarefa(p, "Nota para a limpeza")], { zoomMax: 1.7, margem: 60 });
        await palco.destacar(valor, { folga: 6 });
        await palco.mover(await aoLado(valor), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 450 });
      },
      pausa: 1300,
    },
    {
      capitulo: "Filtrar por categoria",
      fala: "Para achar mais rápido, use o Filtrar Categoria. A categoria é a que você escolheu ao criar o checklist. Aqui, só os da cozinha.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await fecharJanela(palco);
        const sel = filtro(p);
        await palco.rolarAte(sel, { bloco: "start" });
        await palco.esperarRolagemParar(sel);
        await palco.mover(sel, { ms: 700 });
        await ctx.ate(0.6);
        await palco.apontar(sel);
        await sel.selectOption("restaurante");
        await dormir(500);
        const linha = linhaDaAuditoria(p, "Abertura da cozinha");
        await palco.destacar(linha, { folga: 4 });
        await palco.mover(linha.locator("h4"), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 600,
    },
    cenaFinal((p) => p.getByText("Painel do Dono")),
  ],
};
