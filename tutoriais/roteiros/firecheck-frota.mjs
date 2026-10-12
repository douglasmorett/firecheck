// Tutorial da aba "Frota e Veículos" do painel do dono.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (AdminDashboard.jsx › tab 'vehicles' e
// o modal do veículo; api/index.js › /api/vehicles; EmployeeDashboard.jsx ›
// "Meus Veículos Vinculados"):
// - o cartão mostra foto, marca e modelo, placa, "KM Atual" e o motorista;
// - só Placa e Modelo são obrigatórios na hora de salvar (a quilometragem tem
//   asterisco, mas não é cobrada) — a fala não diz "obrigatório";
// - o motorista vinculado vê o veículo na tela dele, com "Iniciar Vistoria";
// - agendamento: Diário = pendente todo dia; Dias da Semana = nos dias marcados;
//   Datas = nas datas da lista; Sob Demanda = pendente por 24 h depois de
//   "Solicitar" (last_requested_at);
// - "Solicitar" só aparece em veículo ativo com motorista; o vídeo não clica
//   (o retorno é um alert(), que não aparece na gravação, e a tela não muda);
// - "Copiar Checklist de..." pede confirmação num confirm() do navegador, que a
//   gravação dispensa: o vídeo não usa;
// - critérios: texto, tipo (Sim/Não, Texto, Feito/Pendente, Valor Numérico,
//   Estrelas) e "Foto Obrigatória";
// - a vistoria enviada é um checklist_submissions com vehicle_id: aparece na
//   Auditoria do Dashboard (com o título genérico "Checklist Concluído", porque
//   não há checklist_id) e passa pela mesma conferência das fotos pela IA.
//
// preparar(): a vistoria de hoje da moto do Rafael (a semente não tem nenhuma),
// gravada como a Tela de Execução grava (created_at em UTC sem fuso, como em produção).
import { dormir } from "../motor/palco.mjs";
import path from "node:path";
import { foto } from "../ambiente/semente.mjs";
import { abrirAba, cenaFinal, menu } from "./_a4-comum.mjs";

const FOTO_DA_MOTO = path.join(process.cwd(), "tutoriais", "ambiente", "fotos", "moto.jpg");
const titulo = (p) => p.getByText("Gerenciamento de Frota e Veículos").first();
const cartao = (p, placa) => p.locator(".card", { hasText: placa }).filter({ hasText: "KM Atual" }).last();
const janela = (p) => p.locator(".modal-janela", { hasText: "Cadastrar Veículo" }).first();
const colunaEsquerda = (p) => janela(p).getByText("Informações Gerais").locator("xpath=..");
const colunaDireita = (p) => janela(p).getByText("Critérios de Checklist").locator("xpath=../..");

export default {
  id: "firecheck-frota",
  titulo: "Frota e vistoria de veículos no FireCheck",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á" },

  async preparar(banco) {
    const { rows: [moto] } = await banco.query("SELECT id, tasks, store FROM vehicles WHERE plate = 'RJO-4B21'");
    const tarefas = typeof moto.tasks === "string" ? JSON.parse(moto.tasks) : moto.tasks;
    const imagem = await foto("moto", 480);
    const parecer = {};
    const feitas = tarefas.map((t) => {
      if (t.type === "numeric") return { ...t, done: "18620" };
      if (t.requirePhoto) {
        parecer[t.id] = { status: "success", message: "Os dois pneus aparecem cheios e a moto está inteira, sem avaria à vista." };
        return { ...t, done: true, photo: imagem, photos: [imagem] };
      }
      return { ...t, done: true };
    });
    await banco.query(
      `INSERT INTO checklist_submissions (employee_name, store, tasks, feedback_info, checklist_id, vehicle_id, resolved, created_at)
       VALUES ('Rafael Pereira', $1, $2, $3, NULL, $4, FALSE, (NOW() AT TIME ZONE 'UTC') - INTERVAL '35 minutes')`,
      [moto.store, JSON.stringify(feitas), JSON.stringify(parecer), moto.id]);
  },

  async antesDeGravar(palco) {
    await abrirAba(palco, { chave: "vehicles", nomeNoMenu: "Frota e Veículos", prova: "text=Gerenciamento de Frota e Veículos" });
    await palco.pagina.locator(".card", { hasText: "RJO-4B21" }).first().waitFor({ state: "visible", timeout: 20_000 });
  },

  cenas: [
    {
      capitulo: "O que é esta tela",
      fala: "Em Frota e Veículos ficam os veículos da loja, como a moto e o carro das entregas. Para cada um, você monta a vistoria que o motorista faz pelo celular.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        await palco.mover(titulo(p), { ms: 900 });
        await ctx.ate(0.35);
        await palco.destacar(titulo(p), { folga: 8 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Os veículos da loja",
      fala: "Cada cartão mostra a foto, a placa, a quilometragem e o motorista. A moto fica com o Rafael. A Fiorino não tem motorista fixo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const moto = cartao(p, "RJO-4B21");
        const fiorino = cartao(p, "KXP-7D90");
        await palco.camera([moto, fiorino], { zoomMax: 1.5, margem: 40 });
        await palco.destacar(moto, { folga: 4 });
        await palco.mover(moto.getByText("RJO-4B21"), { ms: 700 });
        await ctx.ate(0.3);
        await palco.mover(moto.getByText(/KM Atual/), { ms: 500 });
        await ctx.ate(0.45);
        await palco.mover(moto.getByText("Rafael Pereira"), { ms: 500 });
        await ctx.ate(0.75);
        await palco.apagarDestaque();
        await palco.destacar(fiorino, { folga: 4 });
        await palco.mover(fiorino.getByText("Sem motorista vinculado"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Em Editar você muda os dados e a vistoria do veículo. Excluir tira o veículo da frota.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const moto = cartao(p, "RJO-4B21");
        const editar = moto.getByRole("button", { name: "Editar" });
        const excluir = moto.getByRole("button", { name: "Excluir" });
        await palco.destacar(editar, { folga: 6 });
        await palco.mover(editar, { ms: 700 });
        await ctx.ate(0.6);
        await palco.apagarDestaque();
        await palco.destacar(excluir, { folga: 6 });
        await palco.mover(excluir, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Cadastrar um veículo",
      fala: "Para incluir um veículo, clique em Cadastrar Veículo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Cadastrar Veículo/ });
        await palco.mover(botao, { ms: 900 });
        await ctx.ate(0.5);
        await palco.clicar(botao);
        await janela(p).waitFor({ state: "visible", timeout: 10_000 });
        await dormir(500);
        await ctx.ate(1);
      },
    },
    {
      fala: "Preencha a placa, o modelo e a marca.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janela(p);
        await palco.camera(colunaEsquerda(p), { zoomMax: 1.5, margem: 24, ms: 600 });
        await palco.digitar(j.getByPlaceholder("Ex: ABC-1234"), "SBP-2E47");
        await palco.digitar(j.getByPlaceholder("Ex: Uno Way"), "CG 160 Fan");
        await palco.digitar(j.getByPlaceholder("Ex: Fiat"), "Honda");
        await ctx.ate(1);
      },
      pausa: 300,
    },
    {
      fala: "Depois, a quilometragem de hoje.",
      acao: async (palco, ctx) => {
        const j = janela(palco.pagina);
        await palco.digitar(j.getByPlaceholder("Ex: 120500"), "9300");
        await ctx.ate(1);
      },
      pausa: 300,
    },
    {
      fala: "Em Motorista Vinculado, escolha quem usa o veículo. É na tela dessa pessoa que a vistoria aparece.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janela(p);
        const motorista = j.locator("select").filter({ hasText: "Nenhum — Apenas livre demanda" }).first();
        await palco.apontar(motorista, { ms: 700 });
        await ctx.ate(0.35);
        const valor = await motorista.evaluate((s) => [...s.options].find((o) => o.textContent.includes("Lucas"))?.value);
        await motorista.selectOption(valor);
        await palco.destacar(motorista, { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E em Foto do Veículo, escolha uma foto do aparelho.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janela(p);
        const arquivo = j.locator('input[type="file"]').first();
        await palco.apontar(arquivo, { ms: 700 });
        await arquivo.setInputFiles(FOTO_DA_MOTO);
        const previa = j.locator('img[alt="Preview"]').first();
        await previa.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(300);
        await palco.mover(previa, { ms: 600 });
        await ctx.ate(1);
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "O que conferir na vistoria",
      fala: "Do lado ficam os critérios da vistoria. Clique em Adicionar Item ao Checklist e escreva o que o motorista tem que conferir.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janela(p);
        await palco.camera(colunaDireita(p), { zoomMax: 1.5, margem: 24, ms: 600 });
        await palco.clicar(j.getByRole("button", { name: /Adicionar Item ao Checklist/ }));
        await dormir(300);
        await palco.digitar(j.getByPlaceholder(/Descreva o que verificar/).nth(0), "Pneus calibrados");
        await ctx.ate(1);
      },
    },
    {
      fala: "Marque Foto Obrigatória quando quiser a foto daquele item. A foto passa pela conferência da inteligência artificial.",
      acao: async (palco, ctx) => {
        const j = janela(palco.pagina);
        const caixa = j.locator("label", { hasText: "Foto Obrigatória" }).nth(0);
        await palco.clicar(caixa);
        await dormir(300);
        await palco.destacar(caixa.locator("xpath=.."), { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Mais um item: a quilometragem do painel, com o tipo Valor Numérico.",
      acao: async (palco, ctx) => {
        const j = janela(palco.pagina);
        await palco.clicar(j.getByRole("button", { name: /Adicionar Item ao Checklist/ }));
        await dormir(300);
        await palco.digitar(j.getByPlaceholder(/Descreva o que verificar/).nth(1), "Quilometragem do painel");
        const tipo = j.locator("select").filter({ has: palco.pagina.locator('option[value="numeric"]') }).nth(1);
        await palco.apontar(tipo, { ms: 600 });
        await tipo.selectOption("numeric");
        await ctx.ate(1);
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Quando fazer a vistoria",
      fala: "Mais abaixo, em Recorrência, você diz quando a vistoria é cobrada: todo dia, em dias da semana, em datas marcadas, ou sob demanda.",
      acao: async (palco, ctx) => {
        const j = janela(palco.pagina);
        const rec = j.locator("select").filter({ has: palco.pagina.locator('option[value="manual"]') }).first();
        await palco.rolarAte(rec, { bloco: "center" });
        await palco.apontar(rec, { ms: 700 });
        await ctx.ate(0.75);
        await rec.selectOption("weekdays");
        await ctx.ate(1);
      },
    },
    {
      fala: "Aqui, segunda, quarta e sexta. Nesses dias, a vistoria aparece como pendente na tela do motorista.",
      acao: async (palco, ctx) => {
        const j = janela(palco.pagina);
        for (const dia of ["Seg", "Qua", "Sex"]) {
          const chip = j.locator("label", { hasText: new RegExp(`^${dia}$`) }).first();
          await palco.clicar(chip, { ms: 450 });
        }
        await ctx.ate(1);
      },
    },
    {
      fala: "Tudo pronto: clique em Salvar Veículo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const salvar = janela(p).getByRole("button", { name: /Salvar Veículo/ });
        await palco.rolarAte(salvar, { bloco: "center" });
        await palco.clicar(salvar);
        await janela(p).waitFor({ state: "hidden", timeout: 10_000 });
        await cartao(p, "SBP-2E47").waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "A moto nova já está na frota, com o Lucas como motorista.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const nova = cartao(p, "SBP-2E47");
        await palco.camera(nova, { zoomMax: 1.6, margem: 60 });
        await palco.destacar(nova, { folga: 4 });
        await palco.mover(nova.getByText("Lucas Oliveira"), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Pedir uma vistoria",
      fala: "No veículo sob demanda, como a moto do Rafael, use o botão Solicitar: a vistoria fica pendente na tela do motorista por 24 horas.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const moto = cartao(p, "RJO-4B21");
        await palco.rolarAte(moto, { bloco: "center" });
        const botao = moto.getByRole("button", { name: /Solicitar/ });
        await palco.destacar(moto, { folga: 4 });
        await palco.mover(moto.getByText("Rafael Pereira"), { ms: 800 });
        await ctx.ate(0.4);
        await palco.apagarDestaque();
        await palco.destacar(botao, { folga: 6 });
        await palco.mover(botao, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "As vistorias feitas",
      fala: "O motorista faz a vistoria na Tela de Execução, com as fotos. A vistoria enviada aparece no Dashboard, na auditoria. Hoje o Rafael já fez a da moto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        if (await p.evaluate(() => window.scrollY > 0)) await palco.rolarPagina(0);
        await palco.clicar(menu(p, "Dashboard"));
        const linha = p.getByText("Checklist Concluído").first();
        await linha.waitFor({ state: "visible", timeout: 20_000 });
        await dormir(600);
        await ctx.ate(0.45);
        await palco.rolarAte(linha, { bloco: "center" });
        const cartaoDaVistoria = linha.locator("xpath=../../..");
        await palco.destacar(cartaoDaVistoria, { folga: 4 });
        await palco.mover(cartaoDaVistoria.getByText(/Rafael Pereira/).first(), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Abrindo, estão as respostas do motorista, a foto e o parecer da inteligência artificial.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(p.getByText("Checklist Concluído").first());
        await p.getByText("Respostas do Checklist").waitFor({ state: "visible", timeout: 10_000 });
        const parecer = p.getByText("Os dois pneus aparecem cheios").first();
        await parecer.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(700);
        const tarefa = parecer.locator("xpath=ancestor::div[.//h4][1]");
        await palco.camera(tarefa, { zoomMax: 1.5, margem: 30 });
        await palco.destacar(tarefa, { folga: 4 });
        await palco.mover(parecer, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      fala: "Fechando, é só voltar para Frota e Veículos.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(p.locator(".modal-janela button").first());
        await p.getByText("Respostas do Checklist").waitFor({ state: "hidden", timeout: 10_000 });
        if (await p.evaluate(() => window.scrollY > 0)) await palco.rolarPagina(0);
        await palco.clicar(menu(p, "Frota e Veículos"));
        await titulo(p).waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    cenaFinal(titulo),
  ],
};
