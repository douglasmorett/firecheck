// Tutorial da aba Ranking do painel do dono: o período, como a nota é
// calculada, o que não entra nela, o pódio e a lista.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (src/pages/AdminDashboard.jsx › tab 'ranking'):
// - períodos Hoje / Semana (últimos 7 dias) / Mês (mês corrente) / Personalizado (De, Até),
//   aplicados sobre os checklists enviados (submissions; o painel já os busca pelas datas do alto);
// - a nota de cada pessoa = tarefas com `done` verdadeiro ÷ total de tarefas, somando
//   todos os checklists que ela ENVIOU no período (agrupado por employee_name);
//   quem não enviou nenhum não aparece;
// - o parecer da IA (feedback_info) NÃO entra na conta: um checklist com foto
//   reprovada conta 100% se todas as tarefas foram marcadas como feitas;
// - cartões: "Tarefas Concluídas" (soma do período), "Média de Conformidade"
//   (feitas ÷ possíveis da equipe toda) e "Líder do Ranking" (maior nota);
// - pódio com os 3 primeiros (coroa no 1º); lista com posição, nota, barra e "x/y tarefas";
// - cor da barra: verde de 90% para cima, amarela de 70% a 89%, vermelha abaixo de 70%.
//
// Dados: a semente marca tudo como feito (todo mundo 100%). `preparar` desmarca
// algumas tarefas SEM foto da Juliana e do Lucas, para o ranking ter diferença.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal } from "./_equipe-ponto-comum.mjs";

const NAO_FEITAS = [
  // [quem, tarefa, dias atrás]
  ...[1, 2, 3, 4].map((d) => ["Juliana Costa", "Cardápios e guardanapos nas mesas", d]),
  ...[1, 2, 3].map((d) => ["Juliana Costa", "Papel e sabonete abastecidos", d]),
  ...[1, 2, 3].map((d) => ["Lucas Oliveira", "Registro do gás fechado", d]),
];

const titulo = (p) => p.locator("h3", { hasText: "Ranking de Performance da Equipe" });
const periodo = (p, nome) => p.getByRole("button", { name: nome, exact: true });
// A linha da lista (o nome aparece também no pódio, antes: a lista é a última ocorrência).
const linha = (p, nome) => p.locator(`span:text-is("${nome}")`).last().locator("xpath=ancestor::div[3]");

export default {
  id: "firecheck-ranking",
  titulo: "Como funciona o ranking da equipe",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á", "90%": "noventa por cento", "89%": "oitenta e nove por cento", "70%": "setenta por cento" },

  async preparar(banco) {
    const { rows } = await banco.query(`
      SELECT s.id, s.employee_name, s.tasks,
             ((NOW() AT TIME ZONE 'America/Sao_Paulo')::date
               - ((s.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) AS dias
        FROM checklist_submissions s`);
    for (const s of rows) {
      const tarefas = typeof s.tasks === "string" ? JSON.parse(s.tasks) : s.tasks;
      let mudou = false;
      for (const t of tarefas) {
        if (NAO_FEITAS.some(([quem, texto, d]) => quem === s.employee_name && texto === t.text && d === s.dias)) {
          t.done = false;
          mudou = true;
        }
      }
      if (mudou) await banco.query("UPDATE checklist_submissions SET tasks = $1 WHERE id = $2", [JSON.stringify(tarefas), s.id]);
    }
  },

  async antesDeGravar(palco) {
    await abrirAba(palco, "Ranking", "Ranking de Performance da Equipe");
    await palco.pagina.getByText("Líder do Ranking").waitFor({ state: "visible", timeout: 20_000 });
  },

  cenas: [
    {
      capitulo: "O ranking da equipe",
      fala: "O Ranking mostra quem da sua equipe está fazendo os checklists completos, do primeiro ao último colocado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(300);
        const cabeca = titulo(p).locator("xpath=../..");
        await palco.destacar(cabeca, { folga: 4 });
        await palco.mover(titulo(p), { ms: 900 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O período",
      fala: "No alto, escolha o período: hoje, a semana, o mês, ou Personalizado, com as datas que você quiser.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botoes = periodo(p, "Hoje").locator("xpath=..");
        await palco.destacar(botoes, { folga: 4 });
        for (const [i, nome] of ["Hoje", "Semana", "Mês"].entries()) {
          await ctx.ate(0.15 + 0.17 * i);
          await palco.mover(periodo(p, nome), { ms: 450 });
        }
        await ctx.ate(0.65);
        await palco.apagarDestaque();
        await palco.clicar(periodo(p, "Personalizado"));
        await p.getByText("De:").waitFor({ state: "visible", timeout: 5_000 });
        await ctx.ate(0.9);
        await palco.mover(p.getByText("Até:"), { ms: 500 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Aqui vamos ficar com o mês. O pódio, os cartões e a lista seguem sempre o período escolhido.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(periodo(p, "Mês"));
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Como a nota é calculada",
      fala: "A nota de cada pessoa é a parte das tarefas que ela marcou como feitas, somando todos os checklists que enviou no período.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const l = linha(p, "Juliana Costa");
        await palco.rolarAte(l, { bloco: "center" });
        await palco.camera(l, { zoomMax: 1.6, margem: 50 });
        await palco.destacar(l, { folga: 4 });
        await palco.mover(l.getByText(/tarefas$/), { ms: 800 });
        await ctx.ate(1);
      },
    },
    {
      fala: "A Juliana deixou algumas tarefas sem fazer, e a nota dela caiu. Quem não enviou nenhum checklist no período não entra no ranking.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const l = linha(p, "Juliana Costa");
        await palco.mover(l.locator("span", { hasText: /%$/ }).first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "O que não entra na nota",
      fala: "Atenção: o parecer da inteligência artificial não entra nesta conta. A Ana teve uma foto reprovada ontem e continua em primeiro, porque fez todas as tarefas.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const l = linha(p, "Ana Souza");
        await palco.destacar(l, { folga: 4 });
        await palco.mover(l.locator(`span:text-is("Ana Souza")`), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "As fotos reprovadas você acompanha em Alertas IA, aqui no menu.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const item = p.locator("aside.sidebar button", { hasText: "Alertas IA" }).first();
        await palco.rolarPagina(0);
        await ctx.ate(0.3);
        await palco.destacar(item, { folga: 4 });
        await palco.mover(item, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O pódio e os números",
      fala: "No pódio ficam os três primeiros, com a coroa no líder.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const podio = p.getByText("1º", { exact: true }).locator("xpath=../../..");
        await palco.rolarAte(podio, { bloco: "center" });
        await palco.destacar(podio, { folga: 8 });
        await palco.mover(p.getByText("👑").last(), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E nos cartões: o total de tarefas feitas no período, a média da equipe toda, e o nome do líder.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const cartoes = p.getByText("Tarefas Concluídas", { exact: true }).locator("xpath=../..");
        await palco.rolarAte(cartoes, { bloco: "center" });
        await palco.destacar(cartoes, { folga: 4 });
        for (const [i, nome] of ["Tarefas Concluídas", "Média de Conformidade", "Líder do Ranking"].entries()) {
          await ctx.ate(0.2 + 0.25 * i);
          await palco.mover(p.getByText(nome, { exact: true }), { ms: 500 });
        }
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "A lista completa",
      fala: "Embaixo vem a lista completa: a posição, a nota e quantas tarefas cada um fez.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const ultima = linha(p, "Juliana Costa");
        await palco.rolarAte(ultima, { bloco: "end" });
        const lista = ultima.locator("xpath=..");
        await palco.destacar(lista, { folga: 4 });
        await palco.mover(linha(p, "Ana Souza").locator("div").first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "A barra fica verde de 90% para cima, amarela de 70% a 89%, e vermelha abaixo de 70%.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        for (const [i, nome] of ["Lucas Oliveira", "Juliana Costa"].entries()) {
          const barra = linha(p, nome).locator("span", { hasText: /tarefas$/ }).locator("xpath=preceding-sibling::div[1]");
          await ctx.ate(0.1 + 0.35 * i);
          await palco.destacar(barra, { folga: 6 });
          await palco.mover(barra, { ms: 600 });
        }
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    cenaFinal((p) => titulo(p), async (palco) => {
      await palco.rolarPagina(0);
    }),
  ],
};
