// Tutorial da aba Notificações do painel do dono: conectar o WhatsApp da loja,
// quem recebe os avisos e quais avisos chegam.
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Se a frase descreve um clique, o clique acontece na imagem.
// Nada sai da máquina: o vídeo NÃO clica em "Enviar mensagem de teste agora".
//
// O ambiente de gravação não tem servidor de WhatsApp. As duas respostas que
// dependem dele (o estado da conexão e o QR Code) são servidas pelo próprio
// navegador da gravação, no formato exato de api › /api/whatsapp-loja; a tela,
// os textos e o "Salvar números" (PUT, banco local) são os de verdade.
//
// Conferido no código antes de cada frase (components/WhatsappDaLoja.jsx,
// AdminDashboard.jsx › tab 'notificacoes' e api/index.js):
// - os avisos de loja saem pela instância da loja (enviarWhatsapp com `loja`); sem ela
//   conectada, nenhum aviso sai no WhatsApp (centralCobreLojas() = false em produção);
// - "Conectar o WhatsApp da loja" devolve { qr, codigo }; a tela pergunta a cada 3 s e,
//   conectado, mostra "● Conectado · <número>" e "WhatsApp da loja conectado...";
// - "Quem recebe os avisos": até 10 números extras, que recebem os mesmos avisos
//   marcados; só o dono muda (podeMexer);
// - todo aviso do dono/gestor exige whatsapp_active !== false e vai para
//   whatsapp_phone || phone (em branco = telefone do perfil);
// - "Enviar mensagem de teste agora" manda uma mensagem real e mostra o motivo se falhar;
// - Atrasos, Reprovado (IA ou quantidade fora do mínimo/máximo), Concluído, Ocorrência,
//   Descarte, Checklist Pendente/Atrasado (cron de meia em meia hora);
// - Ausência: cron ponto-ausencia, sem caixinha; chega com os disparos habilitados;
// - "Fechamento Diário de Ponto" (wa_ponto_diario) é só guardado: a fala não fala dele;
// - "Salvar Configurações de Notificações" grava e mostra o aviso verde no canto.
import QRCode from "qrcode";
import { dormir } from "../motor/palco.mjs";
import { abrirAba, cenaFinal } from "./_equipe-ponto-comum.mjs";

const titulo = (p) => p.locator("h2", { hasText: "Notificações do Sistema" });
const opcao = (p, id) => p.locator(`#${id}`).locator("xpath=..");
const cartaoLoja = (p) => p.locator(".card", { hasText: "WhatsApp da loja (quem envia os avisos)" }).first();
const cartaoWhats = (p) => p.locator(".card", { hasText: "Seu número para receber os avisos" }).first();
const cartaoAvisos = (p) => p.locator(".card", { hasText: "Alertas de Notificação Personalizados" }).first();

// O que o servidor de WhatsApp responderia. `conectado` vira true na cena em que
// o celular "lê" o QR Code.
const whats = { conectado: false };
const NUMERO_DA_LOJA = "5522998887766";

export default {
  id: "firecheck-notificacoes",
  titulo: "Como conectar o WhatsApp da loja e escolher os avisos",
  publico: "gestor",
  rota: "admin",
  prontaQuando: "text=Painel do Dono",
  pronuncia: { IA: "i á", DDD: "dê dê dê" },

  async antesDeGravar(palco) {
    const p = palco.pagina;
    whats.conectado = false;
    const qr = await QRCode.toDataURL("FireCheck · Sabor da Praça · conectar o WhatsApp da loja", { width: 480, margin: 1 });
    // Só o GET do estado e o "conectar" passam por aqui; o PUT dos números vai ao servidor local.
    // No contexto, não na página: o service worker do app (PWA) faz as chamadas, e a
    // rota da página não as vê.
    await p.context().route(/\/api\/whatsapp-loja(\/conectar)?(\?.*)?$/, async (rota) => {
      const pedido = rota.request();
      if (pedido.method() === "POST") {
        await dormir(900);
        return rota.fulfill({ json: { ok: true, conectado: false, qr, codigo: null } });
      }
      if (pedido.method() !== "GET") return rota.fallback();
      const real = await rota.fetch();
      const corpo = await real.json().catch(() => ({}));
      return rota.fulfill({
        json: { ...corpo, conectado: whats.conectado, numero: whats.conectado ? NUMERO_DA_LOJA : null, centralCobre: false, podeMexer: true },
      });
    });
    await abrirAba(palco, "Notificações", "Notificações do Sistema");
    // A faixa "Tem um tutorial desta tela" traria a ficha da gravação ANTERIOR deste vídeo.
    const ocultar = p.getByRole("button", { name: "Não mostrar mais nesta tela" });
    if (await ocultar.isVisible().catch(() => false)) {
      await ocultar.evaluate((b) => b.click());
      await dormir(600);
    }
    await cartaoLoja(p).waitFor({ state: "visible", timeout: 20_000 });
  },

  cenas: [
    {
      capitulo: "Os avisos no WhatsApp",
      fala: "Na aba Notificações você conecta o WhatsApp da loja, escolhe quem recebe os avisos e quais avisos chegam.",
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
      capitulo: "Conectar o WhatsApp da loja",
      fala: "Os avisos saem do WhatsApp da sua própria loja, não de um número do FireCheck. Enquanto ele não estiver conectado, nenhum aviso chega no WhatsApp.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoLoja(p);
        await palco.camera(c, { zoomMax: 1.4, margem: 40 });
        await palco.destacar(c.locator("h3"), { folga: 6 });
        await palco.mover(c.locator("h3"), { ms: 800 });
        await ctx.ate(0.5);
        const alerta = c.getByText("Sem o WhatsApp da loja conectado").locator("xpath=..");
        await palco.destacar(alerta, { folga: 6 });
        await palco.mover(alerta, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para conectar, clique em Conectar o WhatsApp da loja. Na hora aparece um QR Code.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const botao = cartaoLoja(p).getByRole("button", { name: "Conectar o WhatsApp da loja" });
        await palco.destacar(botao, { folga: 6 });
        await ctx.ate(0.5);
        await palco.clicar(botao);
        await palco.apagarDestaque();
        const img = cartaoLoja(p).locator('img[alt^="QR Code"]');
        await img.waitFor({ state: "visible", timeout: 10_000 });
        await palco.camera(cartaoLoja(p), { zoomMax: 1.3, margem: 30 });
        await palco.mover(img, { ms: 700 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Pegue o celular da loja, abra o WhatsApp, toque em Aparelhos conectados, depois em Conectar um aparelho, e aponte a câmera para o QR Code.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const passos = cartaoLoja(p).locator("ol");
        await palco.destacar(passos, { folga: 8 });
        await palco.mover(passos.locator("li").nth(1), { ms: 800 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Quando o celular lê, a tela se atualiza sozinha e mostra Conectado, com o número da loja. A partir daí, os avisos saem por ele.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        whats.conectado = true;
        const selo = cartaoLoja(p).getByText(/● Conectado/);
        await selo.waitFor({ state: "visible", timeout: 15_000 });
        await palco.destacar(selo, { folga: 6 });
        await palco.mover(selo, { ms: 700 });
        await ctx.ate(0.6);
        const aviso = cartaoLoja(p).getByText("WhatsApp da loja conectado.", { exact: false });
        if (await aviso.isVisible().catch(() => false)) {
          await palco.destacar(aviso, { folga: 6 });
          await palco.mover(aviso, { ms: 600 });
        }
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Quem recebe os avisos",
      fala: "Você e cada gestor recebem no número que cadastraram. Para mandar também para outro número, como um sócio, clique em Adicionar número.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoLoja(p);
        const secao = c.getByText("📞 Quem recebe os avisos");
        await palco.rolarAte(secao, { bloco: "center" });
        await palco.camera(c, { zoomMax: 1.3, margem: 30 });
        await palco.destacar(secao.locator("xpath=.."), { folga: 6 });
        await palco.mover(secao, { ms: 700 });
        await ctx.ate(0.65);
        await palco.apagarDestaque();
        await palco.clicar(c.getByRole("button", { name: "+ Adicionar número" }));
        await ctx.ate(1);
      },
    },
    {
      fala: "Coloque o nome e o número com DDD, e clique em Salvar números. Ele passa a receber os mesmos avisos que estão marcados nesta tela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoLoja(p);
        await palco.digitar(c.locator('input[placeholder="Nome (ex.: Sócio)"]').last(), "Sócio");
        await ctx.ate(0.3);
        await palco.digitar(c.locator('input[placeholder="DDD + número"]').last(), "22 99876-5432");
        await ctx.ate(0.5);
        await palco.clicar(c.getByRole("button", { name: "Salvar números" }));
        const ok = c.getByText("Números salvos.", { exact: false });
        await ok.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
        if (await ok.isVisible().catch(() => false)) {
          await palco.destacar(ok, { folga: 6 });
          await palco.mover(ok, { ms: 600 });
        }
        await ctx.ate(1);
        await palco.apagarDestaque();
        await palco.cameraAberta({ ms: 500 });
      },
    },
    {
      capitulo: "O seu número",
      fala: "Logo abaixo fica o seu número. Deixe marcado Habilitar Disparos no WhatsApp. Desmarcado, nenhum aviso sai para você.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const caixa = cartaoWhats(p).locator("label", { hasText: "Habilitar Disparos no WhatsApp" });
        await palco.rolarAte(cartaoWhats(p), { bloco: "center" });
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
        await palco.destacar(botao, { folga: 6 });
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
        await palco.rolarAte(c.locator("h3"), { bloco: "center" });
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
        await palco.mover(cartaoWhats(p).locator("h3"), { ms: 800 });
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
