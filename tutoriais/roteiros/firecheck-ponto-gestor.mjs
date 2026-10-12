// Tutorial da aba Controle de Ponto IA do painel do dono: funcionários, a ficha
// (extrato com selfie e GPS, um atraso, a visão mensal), escalas e configurações.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
//
// Conferido no código antes de cada frase (src/components/ponto/*.jsx e api/index.js):
// - Funcionários (EmployeesTab): um cartão por pessoa da loja, com função e escala;
//   a busca filtra por nome ou e-mail; o cartão abre a ficha (EmployeeProfile);
// - a ficha: foto, e-mail, função; "Regra de Ponto" com a escala vinculada e
//   "Salvar Regras" (o vídeo não clica: abre um alert() do navegador);
// - "Extrato de Pontos": cada batida do mês (mais nova primeiro) com a selfie
//   (selfie_url), a hora (hora_local), a data, o endereço e a precisão do GPS;
// - o atraso: a semente põe o Rafael (Turno da noite, 17:00) entrando 17:18 anteontem.
//   O aviso de atraso vai para o WhatsApp do dono/gestor quando "Atrasos de
//   Colaborador" está ligado em Notificações (api › /api/ponto POST, wa_ponto_atraso);
// - "Visão Mensal": verde = dia com batida (Presente), vermelho = dia de trabalho
//   que passou sem batida (Falta), azul = folga da escala;
// - Escalas de Trabalho (SchedulesTab): nome, tipo (Semanal Fixa ou Plantão 12x36),
//   cor, entrada e saída padrão, dias da semana; lápis edita, lixeira apaga (confirm());
// - Configurações Gerais (SettingsTab): entrada/saída padrão e tolerância valem para
//   quem não tem escala (getEmployeeScheduleForDay); fuso, e-mail do contador e dia de
//   fechamento são só GUARDADOS — nada no api/index.js envia a folha ao contador, então
//   a fala não promete envio.
// - O cartão "Atrasos (Mês)" da ficha fica em 0 (defeito: EmployeeProfile só conta atraso
//   quando o dia da semana da escala tem hora própria, e as escalas não têm): a fala não
//   aponta o cartão.
import { dormir } from "../motor/palco.mjs";
import { foto } from "../ambiente/semente.mjs";
import { abrirAba, cenaFinal } from "./_equipe-ponto-comum.mjs";

const cartao = (p, nome) => p.locator(".card", { has: p.locator("h4", { hasText: nome }) }).first();
const aba = (p, nome) => p.getByRole("button", { name: new RegExp(nome) }).first();
const batida = (p, hora) => p.locator("div.hover-lift", { has: p.locator("span", { hasText: hora }) }).filter({ has: p.locator("h4") }).first();
const janelaEscala = (p) => p.locator(".modal-janela", { hasText: "Nova Escala" }).first();

export default {
  id: "firecheck-ponto-gestor",
  titulo: "Como acompanhar o ponto da equipe",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á", GPS: "gê pê ésse", "12x36": "doze por trinta e seis" },

  /**
   * A semente traz só a última semana de ponto. Sem o começo do mês, a ficha
   * mostraria faltas nos primeiros dias: aqui a loja usa o ponto desde o dia 1.
   */
  async preparar(banco, base) {
    const { rows: [{ d }] } = await banco.query("SELECT EXTRACT(DAY FROM NOW() AT TIME ZONE 'America/Sao_Paulo')::int AS d");
    for (let dia = d - 1; dia >= 7; dia--) {
      for (const pessoa of base.pessoas) {
        const e = base.escalas[pessoa.escala];
        const [he, me] = e.entrada.split(":").map(Number);
        const [hs, ms] = e.saida.split(":").map(Number);
        const entrada = he * 60 + me + (((pessoa.id * 7 + dia * 3) % 9) - 4);
        const saida = hs * 60 + ms + ((pessoa.id + dia) % 6);
        for (const [tipo, mins] of [["entrada", entrada], ["saida", saida]]) {
          await banco.query(
            `INSERT INTO ponto_records (user_id, user_name, store, type, timestamp, latitude, longitude, accuracy, selfie_url, address, device_info)
             VALUES ($1, $2, $3, $4, date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - make_interval(days => $5) + make_interval(mins => $6),
               -22.5269, -41.9447, 12, $7, 'Praça da Independência, 120 - Centro', 'Android')`,
            [pessoa.id, pessoa.nome, base.loja, tipo, dia, mins, await foto(pessoa.rosto, 240)]);
        }
      }
    }
  },

  async antesDeGravar(palco) {
    await abrirAba(palco, "Controle de Ponto IA", "Gestão profissional de presença");
    await palco.pagina.locator(".card", { hasText: "Rafael Pereira" }).first().waitFor({ state: "visible", timeout: 20_000 });
  },

  cenas: [
    {
      capitulo: "O controle de ponto",
      fala: "No Controle de Ponto você acompanha a presença da equipe: quem bateu o ponto, a que horas, com selfie e localização.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const titulo = p.locator("h2", { hasText: "Controle de Ponto IA" });
        await dormir(300);
        await palco.destacar(titulo.locator("xpath=.."), { folga: 8 });
        await palco.mover(titulo, { ms: 900 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "A tela tem três partes. Os funcionários, as escalas de trabalho e as configurações gerais do ponto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        for (const [i, nome] of ["Funcionários", "Escalas de Trabalho", "Configurações Gerais"].entries()) {
          await ctx.ate(0.15 + 0.25 * i);
          await palco.mover(aba(p, nome), { ms: 550 });
        }
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Os funcionários",
      fala: "Em Funcionários, cada cartão mostra a pessoa, a função e a escala dela. A busca acha pelo nome ou pelo e-mail.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartao(p, "Rafael Pereira");
        await palco.destacar(c, { folga: 4 });
        await palco.mover(c.locator("h4"), { ms: 800 });
        await ctx.ate(0.6);
        await palco.apagarDestaque();
        const busca = p.locator('input[placeholder="Buscar por nome ou e-mail..."]');
        await palco.destacar(busca, { folga: 4 });
        await palco.mover(busca, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Vamos abrir a ficha do Rafael, o motoboy.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(cartao(p, "Rafael Pereira"));
        await p.getByText("Regra de Ponto").waitFor({ state: "visible", timeout: 10_000 });
        await dormir(600);
        await ctx.ate(1);
      },
    },
    {
      capitulo: "A ficha do funcionário",
      fala: "Na ficha aparecem a foto, o e-mail e a função. Em Regra de Ponto fica a escala dele: o Turno da noite. Para trocar, escolha outra e clique em Salvar Regras.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const nome = p.locator("h2", { hasText: "Rafael Pereira" });
        await palco.mover(nome, { ms: 800 });
        await ctx.ate(0.3);
        const regra = p.locator(".card", { hasText: "Regra de Ponto" }).first();
        await palco.rolarAte(regra, { bloco: "start" });
        await palco.destacar(regra, { folga: 4 });
        await palco.mover(regra.locator("select"), { ms: 700 });
        await ctx.ate(0.75);
        await palco.mover(regra.getByRole("button", { name: /Salvar Regras/ }), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O extrato e a selfie",
      fala: "Ao lado, o Extrato de Pontos lista cada entrada e saída do mês, da mais nova para a mais antiga.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const primeira = p.locator("div.hover-lift", { has: p.locator("h4", { hasText: /Registrada/ }) }).first();
        await palco.rolarAte(primeira, { bloco: "center" });
        await palco.destacar(primeira, { folga: 4 });
        await palco.mover(primeira.locator("h4"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Cada batida traz a selfie que ele tirou na hora, o horário, e o endereço onde o celular estava, pelo GPS.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const primeira = p.locator("div.hover-lift", { has: p.locator("h4", { hasText: /Registrada/ }) }).first();
        const selfie = primeira.locator("img").first();
        await palco.camera(primeira, { zoomMax: 1.8, margem: 30 });
        await palco.destacar(selfie, { folga: 4 });
        await palco.mover(selfie, { ms: 700 });
        await ctx.ate(0.45);
        const hora = primeira.locator("h4").locator("xpath=following-sibling::span[1]");
        await palco.destacar(hora, { folga: 4 });
        await palco.mover(hora, { ms: 600 });
        await ctx.ate(0.65);
        const endereco = primeira.getByText("Praça da Independência").first().locator("xpath=..");
        await palco.destacar(endereco, { folga: 4 });
        await palco.mover(endereco, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Um atraso",
      fala: "O Turno da noite começa às cinco da tarde. Anteontem, o Rafael bateu a entrada com dezoito minutos de atraso.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const b = batida(p, "17:18");
        await palco.rolarAte(b, { bloco: "center" });
        await palco.camera(b, { zoomMax: 1.8, margem: 30 });
        await ctx.ate(0.35);
        await palco.destacar(b, { folga: 4 });
        const hora = b.locator("span", { hasText: "17:18" });
        await palco.mover(hora, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Se o aviso de atrasos estiver ligado em Notificações, um atraso assim chega no seu WhatsApp na hora em que ele bate o ponto.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const b = batida(p, "17:18");
        await palco.mover(b.locator("img").first(), { ms: 700 });
        await ctx.ate(1);
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      fala: "Em Visão Mensal, o mês vira um calendário: verde é dia com presença, e vermelho é dia de trabalho sem ponto batido.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = p.getByRole("button", { name: /Visão Mensal/ });
        await palco.rolarAte(botao, { bloco: "start" });
        await palco.clicar(botao);
        await p.getByText("Presente").first().waitFor({ state: "visible", timeout: 10_000 });
        await dormir(500);
        const dia = p.locator("div.hover-lift", { hasText: "Presente" }).first();
        await palco.destacar(dia, { folga: 4 });
        await palco.mover(dia, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "As escalas de trabalho",
      fala: "Agora as escalas. Em Escalas de Trabalho ficam os turnos da loja, com o horário e os dias da semana de cada um.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.rolarPagina(0);
        await palco.clicar(p.locator("button:has(svg.lucide-arrow-left)").first());
        await aba(p, "Escalas de Trabalho").waitFor({ state: "visible", timeout: 10_000 });
        await palco.clicar(aba(p, "Escalas de Trabalho"));
        const turno = p.locator("div.hover-lift", { has: p.locator("h4", { hasText: "Turno da noite" }) }).first();
        await turno.waitFor({ state: "visible", timeout: 10_000 });
        await dormir(400);
        await palco.destacar(turno, { folga: 4 });
        await palco.mover(turno.locator("h4"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para criar um turno, clique em Nova Escala.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(p.getByRole("button", { name: /Nova Escala/ }));
        await janelaEscala(p).waitFor({ state: "visible", timeout: 10_000 });
        await dormir(500);
        await ctx.ate(1);
      },
    },
    {
      fala: "Dê um nome, escolha o tipo, semanal fixa ou plantão 12x36, e uma cor para reconhecer o turno.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janelaEscala(p);
        await palco.digitar(j.locator('input[type="text"]').first(), "Reforço do fim de semana");
        await ctx.ate(0.45);
        await palco.apontar(j.locator("select").first(), { ms: 600 });
        await ctx.ate(0.75);
        await palco.clicar(j.locator('button[style*="rgb(16, 185, 129)"], button[style*="#10B981"]').first());
        await ctx.ate(1);
      },
    },
    {
      fala: "Coloque a entrada e a saída e marque os dias de trabalho. Este é um turno de reforço: só no sábado e no domingo, das onze às três da tarde.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const j = janelaEscala(p);
        const [entrada, saida] = [j.locator('input[type="time"]').nth(0), j.locator('input[type="time"]').nth(1)];
        await palco.clicar(entrada);
        await entrada.fill("11:00");
        await palco.clicar(saida);
        await saida.fill("15:00");
        await ctx.ate(0.4);
        const dia = (nome) => j.locator("div", { has: p.locator("span", { hasText: new RegExp(`^${nome}$`) }) }).last().locator('input[type="checkbox"]');
        for (const nome of ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
          const caixa = dia(nome);
          await palco.rolarAte(caixa, { bloco: "center" });
          await palco.clicar(caixa);
        }
        await ctx.ate(1);
      },
    },
    {
      fala: "Clique em Salvar Escala. Pronto: o turno novo já aparece aqui. O lápis edita e a lixeira apaga cada escala.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const salvar = janelaEscala(p).getByRole("button", { name: "Salvar Escala" });
        await palco.rolarAte(salvar, { bloco: "end" });
        await palco.clicar(salvar);
        const novo = p.locator("div.hover-lift", { has: p.locator("h4", { hasText: "Reforço do fim de semana" }) }).first();
        await novo.waitFor({ state: "visible", timeout: 15_000 });
        await dormir(500);
        await palco.destacar(novo, { folga: 4 });
        await palco.mover(novo.locator("h4"), { ms: 700 });
        await ctx.ate(0.7);
        await palco.mover(novo.locator("button").first(), { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Depois, vincule a escala a cada funcionário na ficha dele, ou na aba Equipe.",
      acao: async (palco, ctx) => {
        await ctx.ate(1);
      },
    },
    {
      capitulo: "Configurações gerais",
      fala: "Em Configurações Gerais ficam o horário padrão da loja e a tolerância de atraso. Eles valem para quem não tem escala.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.clicar(aba(p, "Configurações Gerais"));
        const horarios = p.locator(".card", { hasText: "Horários Padrão e Tolerância" }).first();
        await horarios.waitFor({ state: "visible", timeout: 10_000 });
        await palco.rolarAte(horarios, { bloco: "start" });
        await palco.destacar(horarios, { folga: 4 });
        await palco.mover(horarios.locator("h3"), { ms: 700 });
        await ctx.ate(0.6);
        await palco.mover(horarios.locator("select"), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E do lado, o fuso horário da loja, o e-mail do contador e o dia de fechamento da folha.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const contabil = p.locator(".card", { hasText: "Automação Contábil e Região" }).first();
        await palco.destacar(contabil, { folga: 4 });
        await palco.mover(contabil.locator("h3"), { ms: 700 });
        await ctx.ate(0.5);
        await palco.mover(contabil.locator('input[type="email"]'), { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    cenaFinal((p) => p.locator("h2", { hasText: "Controle de Ponto IA" }), async (palco) => {
      await palco.rolarPagina(0);
    }),
  ],
};
