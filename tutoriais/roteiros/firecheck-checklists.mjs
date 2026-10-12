// Tutorial da aba Checklists do painel do dono e do criador (/admin/creator).
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase:
// - aba Checklists (AdminDashboard.jsx › tab === 'checklists'; api › GET /api/checklists):
//   "Status dos Checklists (Hoje)": em cima os pendentes (sem envio hoje, ou nunca, se
//   for único), embaixo os concluídos, com "Concluído por <quem enviou>"; a lista vem
//   do mais novo para o mais velho (ORDER BY id DESC), então o recém-criado é o 1º;
//   "Visualizar" abre /execucao/:id?preview=true ("Modo Preview — Visualizando como o
//   funcionário vê", só leitura); "Editar" abre /admin/creator/:id;
//   "Excluir" pede para digitar EXCLUIR num prompt() (o vídeo não clica);
// - criador (ChecklistCreator.jsx):
//   "Gerar com Inteligência Artificial" abre o Bill: áudio ou texto, ele SEMPRE faz
//   perguntas antes de montar (api › generate-checklist-ai-v2, regra #2) — o vídeo
//   só aponta: a janela do Bill não tem estilo de janela (.modal-overlay não existe
//   no CSS) e aparece solta no pé da página;
//   recorrência: único (pede a data), diário, dias alternados (marca os dias),
//   semanal, mensal; selfie no fim; categoria; "Toda a Equipe" ou pessoas marcadas
//   (só elas veem); assinatura com o dedo;
//   "Exigir Foto Real" + "O que a foto precisa mostrar": a IA confere a foto por essa
//   descrição na hora (ChecklistExecution › conferirFoto manda task.aiCriteria);
//   número com mínimo/máximo: a execução mostra "Acima do Máximo!"/"Abaixo do Mínimo!";
//   tipos: checkbox, sim/não, estrelas 1 a 5, número, estoque, múltipla escolha,
//   lista de itens, texto livre;
//   "Salvar Checklist" grava, mostra um alert() (o motor dispensa) e volta ao /admin,
//   que reabre na aba guardada (Checklists).
// - "Hora Limite" NÃO é usada por nada no app nem na API: a fala não fala dela.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal, INICIO_DE_HOJE } from "./_gestor-comum.mjs";

const NOVO = "Recebimento de mercadoria";
const tarefa = (p, n) => p.locator(".card", { hasText: `Tarefa ${n} de` }).first();
const linha = (p, titulo) => p.locator("div", { has: p.locator("h4", { hasText: titulo }) })
  .filter({ has: p.getByRole("button", { name: /Editar/ }) }).last();

export default {
  id: "firecheck-checklists",
  titulo: "Criar e editar um checklist",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á" },

  // Hoje: o fechamento ainda pendente e os outros três já feitos, seja qual for a hora da gravação.
  async preparar(banco, base) {
    const fechamento = base.checklists.find((c) => c.titulo === "Fechamento da loja");
    await banco.query(`DELETE FROM checklist_submissions WHERE checklist_id = $1 AND created_at >= ${INICIO_DE_HOJE}`, [fechamento.id]);
    for (const c of base.checklists) {
      if (c.id === fechamento.id) continue;
      const { rows } = await banco.query(`SELECT 1 FROM checklist_submissions WHERE checklist_id = $1 AND created_at >= ${INICIO_DE_HOJE}`, [c.id]);
      if (rows.length) continue;
      await banco.query(
        `INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, checklist_id, resolved, created_at)
         SELECT employee_name, store, tasks, feedback_info, checklist_id, resolved, (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute'
           FROM checklist_submissions WHERE checklist_id = $1 ORDER BY created_at DESC LIMIT 1`, [c.id]);
    }
  },

  async antesDeGravar(palco) {
    await abrirAba(palco, "checklists", "Checklists", "Status dos Checklists (Hoje)");
  },

  cenas: [
    {
      capitulo: "A lista de checklists",
      fala: "Na aba Checklists ficam todos os checklists da loja, com o que a equipe já fez hoje e o que ainda falta.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const titulo = p.getByText("Status dos Checklists (Hoje)");
        await dormir(300);
        await palco.mover(titulo, { ms: 900 });
        await ctx.ate(0.4);
        await palco.destacar(titulo, { folga: 8 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Em cima, os pendentes, com a faixa vermelha. Embaixo, os concluídos, com o nome de quem fez.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const pendente = linha(p, "Fechamento da loja");
        await palco.destacar(pendente, { folga: 4 });
        await palco.mover(pendente.locator("h4"), { ms: 700 });
        await ctx.ate(0.45);
        await palco.apagarDestaque();
        const feito = linha(p, "Limpeza do banheiro");
        await palco.destacar(feito, { folga: 4 });
        await palco.mover(feito.getByText(/Concluído por/), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Visualizar mostra o checklist do jeito que a funcionária vê. Editar abre para mudar. E Excluir apaga de vez: antes, pede para você digitar a palavra excluir.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const l = linha(p, "Fechamento da loja");
        await palco.camera(l, { zoomMax: 1.6, margem: 40 });
        for (const [nome, ate] of [["Visualizar", 0.3], ["Editar", 0.5], ["Excluir", 1]]) {
          const b = l.getByRole("button", { name: new RegExp(nome) });
          await palco.destacar(b, { folga: 4 });
          await palco.mover(b, { ms: 600 });
          await ctx.ate(ate);
          await palco.apagarDestaque();
        }
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Criar um checklist",
      fala: "Para criar um novo, clique em Novo Checklist.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Novo Checklist/ });
        await palco.mover(botao, { ms: 800 });
        await ctx.ate(0.6);
        await palco.clicar(botao);
        await p.getByText("Configurações Gerais").waitFor({ state: "visible", timeout: 15_000 });
        await dormir(600);
      },
    },
    {
      fala: "O botão Gerar com Inteligência Artificial chama o Bill: você explica por áudio ou por escrito, ele faz umas perguntas e monta as tarefas. Aqui, vamos montar à mão.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Gerar com Intelig/ });
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 900 });
        await ctx.ate(0.85);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Primeiro, escreva o nome do checklist.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.digitar(p.getByPlaceholder("Ex: Abertura da Loja"), NOVO);
        await ctx.ate(1);
      },
    },
    {
      fala: "Na recorrência você escolhe: uma vez só, numa data, todo dia, nos dias da semana que marcar, toda semana ou todo mês. Este vai ser todo dia.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const select = p.locator("select").filter({ has: p.locator('option[value="weekdays"]') }).first();
        await palco.camera([p.getByText("Recorrência", { exact: true }), select], { zoomMax: 1.6, margem: 80 });
        await palco.mover(select, { ms: 700 });
        await ctx.ate(0.8);
        await palco.apontar(select);
        await select.selectOption("daily");
        await ctx.ate(1);
      },
    },
    {
      fala: "Logo abaixo: se a funcionária tira uma selfie no fim, e a categoria do checklist.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.cameraAberta({ ms: 400 });
        const selfie = p.getByText("Exigir Selfie na Finalização").locator("xpath=..");
        await palco.rolarAte(selfie, { bloco: "start" });
        await palco.destacar(selfie, { folga: 4 });
        await palco.mover(selfie, { ms: 700 });
        await ctx.ate(0.6);
        await palco.apagarDestaque();
        const categoria = p.locator("select").filter({ has: p.locator('option[value="compras"]') }).first();
        await palco.destacar(categoria, { folga: 4 });
        await palco.mover(categoria, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Quem faz: Toda a Equipe vale para todo mundo, até quem entrar depois. Se marcar pessoas, só elas veem. E aqui, a assinatura com o dedo na tela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const equipe = p.getByText("Funcionários Responsáveis").locator("xpath=..");
        await palco.rolarAte(equipe, { bloco: "center" });
        await palco.destacar(equipe, { folga: 4 });
        await palco.mover(p.getByText(/^\W*Toda a Equipe$/), { ms: 700 });
        await ctx.ate(0.45);
        await palco.mover(p.getByText("Juliana Costa", { exact: true }), { ms: 600 });
        await ctx.ate(0.7);
        await palco.apagarDestaque();
        const assinatura = p.getByText("Exigir Assinatura Digital").locator("xpath=..");
        await palco.destacar(assinatura, { folga: 4 });
        await palco.mover(assinatura, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "As tarefas",
      fala: "Agora as tarefas. Cada uma tem a descrição e o tipo de resposta. A primeira é de sim ou não.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        const t1 = tarefa(p, 1);
        await palco.digitar(t1.getByPlaceholder("Descreva o que deve ser feito"), "Mercadoria conferida com a nota");
        await ctx.ate(0.75);
        await palco.destacar(t1.locator("select").first(), { folga: 4 });
        await palco.mover(t1.locator("select").first(), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Marcando Exigir Foto Real, ela precisa tirar a foto. E aqui você escreve o que a foto tem que mostrar: a inteligência artificial confere por essa descrição e avisa a funcionária na hora se faltar algo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const t1 = tarefa(p, 1);
        await palco.clicar(t1.locator(".custom-checkbox", { hasText: "Exigir Foto Real" }));
        const criterio = t1.locator("textarea");
        await criterio.waitFor({ state: "visible", timeout: 5000 });
        await ctx.ate(0.3);
        await palco.digitar(criterio, "A nota fiscal em cima das caixas recebidas");
        await palco.destacar(criterio.locator("xpath=.."), { folga: 4 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Adicionar Tarefa põe mais uma. Esta é de número, para a temperatura da carne. Com um máximo de sete graus, a tela avisa a funcionária quando passar disso.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(p.getByRole("button", { name: /Adicionar Tarefa/ }));
        const t2 = tarefa(p, 2);
        await t2.waitFor({ state: "visible", timeout: 5000 });
        await palco.rolarAte(t2, { bloco: "start" });
        const desc = t2.getByPlaceholder("Descreva o que deve ser feito");
        await palco.digitar(desc, "Temperatura da carne na chegada");
        const tipo = t2.locator("select").first();
        await palco.apontar(tipo);
        await tipo.selectOption("numeric");
        await ctx.ate(0.55);
        const max = t2.getByPlaceholder("Ex: 20");
        await palco.digitar(max, "7");
        const unidade = t2.locator("select").filter({ has: p.locator('option[value="kg"]') }).first();
        await palco.apontar(unidade);
        await unidade.selectOption("°C");
        await ctx.ate(1);
      },
    },
    {
      fala: "A terceira tarefa, sobre as embalagens, é de múltipla escolha.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        await palco.clicar(p.getByRole("button", { name: /Adicionar Tarefa/ }));
        const t3 = tarefa(p, 3);
        await t3.waitFor({ state: "visible", timeout: 5000 });
        await palco.rolarAte(t3, { bloco: "start" });
        await palco.digitar(t3.getByPlaceholder("Descreva o que deve ser feito"), "Embalagens");
        const tipo = t3.locator("select").first();
        await palco.apontar(tipo);
        await tipo.selectOption("multiple");
        await ctx.ate(1);
      },
      pausa: 200,
    },
    {
      fala: "Você escreve as opções, e a funcionária toca na que vale.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const t3 = tarefa(p, 3);
        await palco.digitar(t3.getByPlaceholder("Opção 1"), "Tudo inteiro");
        await palco.digitar(t3.getByPlaceholder("Opção 2"), "Alguma rasgada");
        await ctx.ate(1);
      },
    },
    {
      fala: "No tipo de resposta tem também estrelas de um a cinco, texto livre e lista de itens para conferir um por um.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tipo = tarefa(p, 3).locator("select").first();
        await palco.destacar(tipo, { folga: 4 });
        await palco.mover(tipo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Salvar",
      fala: "Pronto: clique em Salvar Checklist. Ele já aparece na lista, nos pendentes de hoje.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const salvar = p.getByRole("button", { name: /Salvar Checklist/ });
        await palco.rolarAte(salvar, { bloco: "center" });
        await palco.clicar(salvar);
        await p.getByText("Status dos Checklists (Hoje)").waitFor({ state: "visible", timeout: 15_000 });
        const novo = linha(p, NOVO);
        await novo.waitFor({ state: "visible", timeout: 15_000 });
        await dormir(500);
        await ctx.ate(0.55);
        await palco.destacar(novo, { folga: 4 });
        await palco.mover(novo.locator("h4"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Editar",
      fala: "Para mudar alguma coisa depois, é o Editar: abre o mesmo formulário com tudo preenchido. Mude e salve de novo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const editar = linha(p, NOVO).getByRole("button", { name: /Editar/ });
        await palco.clicar(editar);
        await p.getByText(`Editando: ${NOVO}`).waitFor({ state: "visible", timeout: 15_000 });
        await tarefa(p, 3).waitFor({ state: "visible", timeout: 10_000 });
        const titulo = p.getByText(`Editando: ${NOVO}`);
        // A tela entra com animação: o destaque espera o título assentar.
        await dormir(700);
        await palco.esperarRolagemParar(titulo);
        await ctx.ate(0.5);
        await palco.destacar(titulo, { folga: 6 });
        await palco.mover(titulo, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    cenaFinal((p) => p.getByText(`Editando: ${NOVO}`)),
  ],
};
