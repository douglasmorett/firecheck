// Tutorial da aba Notificações do painel do dono: o número que recebe e quais
// avisos chegam no WhatsApp.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
// Nada sai da máquina: o vídeo NÃO clica em "Enviar mensagem de teste agora".
//
// Conferido no código antes de cada frase (AdminDashboard.jsx › tab 'notificacoes' e api/index.js):
// - todo aviso exige whatsapp_active !== false ("Habilitar Disparos no WhatsApp") e vai
//   para whatsapp_phone || phone (em branco = telefone do perfil);
// - "Enviar mensagem de teste agora" manda uma mensagem real e mostra o motivo se falhar;
// - Atrasos (wa_ponto_atraso): entrada ou saída batida depois do horário + tolerância
//   (api › /api/ponto POST). OBS: a tolerância usada ali é sempre 15 min (defeito) — a fala
//   não cita minutos;
// - Reprovado (wa_checklist_reprovado): IA com status warning/error numa foto OU quantidade
//   fora do mínimo/máximo; Concluído (wa_checklist_aprovado): sem nenhum dos dois;
// - Ocorrência (wa_ocorrencia) e Descarte (wa_descarte, com item, quantidade, valor e motivo);
// - Checklist Pendente/Atrasado (wa_checklist_atrasado): cron de meia em meia hora, checklist
//   com horário marcado que ninguém enviou;
// - Ausência: cron ponto-ausencia, quem não bateu entrada até entrada + tolerância + 30 min.
//   NÃO tem caixinha na tela (wa_ponto_ausencia não aparece): chega com os disparos habilitados;
// - "Fechamento Diário de Ponto" (wa_ponto_diario) é só guardado: nada no api/index.js envia
//   esse resumo. A fala não fala dele;
// - os mesmos avisos vão para os gestores (role gestor), cada um com as caixinhas da própria aba;
// - "Salvar Configurações de Notificações" grava e mostra o aviso verde no canto.
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal } from "./_equipe-ponto-comum.mjs";

const titulo = (p) => p.locator("h2", { hasText: "Notificações do Sistema" });
const opcao = (p, id) => p.locator(`#${id}`).locator("xpath=..");
const cartaoWhats = (p) => p.locator(".card", { hasText: "Conexão do WhatsApp" }).first();
const cartaoAvisos = (p) => p.locator(".card", { hasText: "Alertas de Notificação Personalizados" }).first();

export default {
  id: "firecheck-notificacoes",
  titulo: "Como escolher os avisos que chegam no WhatsApp",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á", DDD: "dê dê dê" },

  async antesDeGravar(palco) {
    await abrirAba(palco, "Notificações", "Notificações do Sistema");
  },

  cenas: [
    {
      capitulo: "Os avisos no WhatsApp",
      fala: "Na aba Notificações você escolhe quais avisos da loja chegam no seu WhatsApp, e em qual número.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(300);
        await palco.destacar(titulo(p).locator("xpath=.."), { folga: 8 });
        await palco.mover(titulo(p), { ms: 900 });
        await ctx.ate(0.95);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O número que recebe",
      fala: "Primeiro, deixe marcado Habilitar Disparos no WhatsApp. Desmarcado, nenhum aviso sai para o seu número.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const caixa = cartaoWhats(p).locator("label", { hasText: "Habilitar Disparos no WhatsApp" });
        await palco.camera(cartaoWhats(p), { zoomMax: 1.5, margem: 40 });
        await palco.destacar(caixa, { folga: 6 });
        await palco.mover(caixa.locator("input"), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "No telefone, coloque o número com DDD. Se ficar em branco, os avisos vão para o telefone do seu perfil.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const campo = cartaoWhats(p).locator('input[type="text"]').first();
        await palco.destacar(campo.locator("xpath=.."), { folga: 6 });
        await palco.mover(campo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E o botão de teste manda uma mensagem de verdade para esse número. Se ela não chegar, o motivo aparece logo embaixo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = cartaoWhats(p).getByRole("button", { name: /mensagem de teste/ });
        await palco.destacar([botao, cartaoWhats(p).getByText("Manda uma mensagem real")], { folga: 6 });
        await palco.mover(botao, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "Escolha os avisos",
      fala: "Do lado, cada caixinha liga ou desliga um tipo de aviso.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoAvisos(p);
        await palco.destacar(c.locator("h3"), { folga: 8 });
        await palco.mover(c.locator("h3"), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Atrasos: quando alguém da equipe bate a entrada ou a saída depois do horário combinado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const o = opcao(p, "opt-ponto-atraso");
        await palco.camera([o, opcao(p, "opt-checklist-aprovado")], { zoomMax: 1.6, margem: 40 });
        await palco.destacar(o, { folga: 6 });
        await palco.mover(o.locator("strong"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Checklist reprovado: quando a inteligência artificial aponta problema numa foto, ou uma quantidade fica fora do mínimo ou do máximo.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const o = opcao(p, "opt-checklist-reprovado");
        await palco.destacar(o, { folga: 6 });
        await palco.mover(o.locator("strong"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "E checklist concluído: chega quando alguém termina um checklist sem nenhum problema.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const o = opcao(p, "opt-checklist-aprovado");
        await palco.destacar(o, { folga: 6 });
        await palco.mover(o.locator("strong"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Ocorrência é o que a equipe registra fora da rotina, como um freezer com defeito. E descarte é o que foi jogado fora, com a quantidade, o motivo e o valor.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const o1 = opcao(p, "opt-ocorrencia");
        await palco.rolarAte(o1, { bloco: "center" });
        await palco.camera([o1, opcao(p, "opt-descarte")], { zoomMax: 1.6, margem: 40 });
        await palco.destacar(o1, { folga: 6 });
        await palco.mover(o1.locator("strong"), { ms: 700 });
        await ctx.ate(0.5);
        const o2 = opcao(p, "opt-descarte");
        await palco.destacar(o2, { folga: 6 });
        await palco.mover(o2.locator("strong"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Checklist atrasado: quando passa o horário marcado de um checklist e ninguém enviou.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const o = opcao(p, "opt-checklist-atrasado");
        await palco.rolarAte(o, { bloco: "center" });
        await palco.camera(o, { zoomMax: 1.6, margem: 60 });
        await palco.destacar(o, { folga: 6 });
        await palco.mover(o.locator("strong"), { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "O aviso de ausência",
      fala: "Tem ainda o aviso de ausência: quem não bater a entrada até meia hora depois da tolerância aparece numa lista. Ele não tem caixinha, e chega sempre que os disparos estão habilitados.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const caixa = cartaoWhats(p).locator("label", { hasText: "Habilitar Disparos no WhatsApp" });
        await palco.rolarAte(caixa, { bloco: "center" });
        await ctx.ate(0.6);
        await palco.destacar(caixa, { folga: 6 });
        await palco.mover(caixa.locator("input"), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Gestores e salvar",
      fala: "Esses avisos também vão para os gestores da loja. Cada gestor com acesso a esta aba escolhe os dele, no número dele.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.mover(titulo(p), { ms: 800 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Por exemplo: para não receber um aviso a cada checklist que dá certo, desmarque Checklist Concluído com Sucesso.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const caixa = p.locator("#opt-checklist-aprovado");
        await palco.rolarAte(caixa, { bloco: "center" });
        await palco.destacar(opcao(p, "opt-checklist-aprovado"), { folga: 6 });
        await ctx.ate(0.65);
        await palco.clicar(caixa);
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "No fim, clique em Salvar Configurações de Notificações, aqui embaixo. O aviso verde no canto mostra que ficou tudo gravado.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const salvar = p.getByRole("button", { name: "Salvar Configurações de Notificações" });
        await palco.rolarAte(salvar, { bloco: "center" });
        await palco.clicar(salvar);
        const aviso = p.getByText("Configurações de Notificações salvas com sucesso!").first();
        await aviso.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
        // O aviso verde some sozinho em poucos segundos: destaca na hora e apaga junto.
        if (await aviso.isVisible().catch(() => false)) {
          await palco.destacar(aviso, { folga: 6 });
          await palco.mover(aviso, { ms: 600 });
          await dormir(1200);
          await palco.apagarDestaque();
        }
        await ctx.ate(1);
      },
    },
    cenaFinal((p) => titulo(p), async (palco) => {
      await palco.rolarPagina(0);
    }),
  ],
};
