// Tutorial da EQUIPE: como bater o ponto (Tela de Execução › /ponto), gravado
// em tela de celular, com a conta da Ana Souza (cozinha, "Turno do dia").
//
// Regra de todo roteiro: a fala só afirma o que a tela faz DE VERDADE nesta
// gravação. Conferido no código antes de cada frase:
// - EmployeeDashboard.jsx: o cartão "Meu Ponto (Hoje)" mostra a escala da
//   pessoa e a entrada/saída de hoje (/api/ponto/today); o botão "Registrar
//   Ponto com IA" leva a /ponto. (Não há IA conferindo o rosto: a fala não diz
//   que a IA confere, só lê o nome do botão.)
// - PontoPage.jsx: GPS com coordenadas, precisão (Excelente < 30 m) e endereço;
//   acima de 200 m não registra (handleRegistrar e a API); "Atualizar" busca de
//   novo. Selfie: "Abrir Câmera" → botão redondo laranja tira a foto →
//   "Foto capturada" / "Tirar novamente". "Requisitos para registro" só aparece
//   enquanto falta algo. Entrada/Saída acendem com GPS + precisão + selfie.
//   Sucesso = aviso verde no topo e a batida em "Registros de hoje".
// - api/index.js (POST /api/ponto): saída sem entrada antes (e sem turno aberto)
//   dá "Registre a entrada antes da saída."; batida depois do horário do turno
//   + tolerância manda aviso (push/WhatsApp) para admin e gestor da loja.
//
// A Ana já tem entrada e saída de hoje na semente: o preparar apaga as batidas
// de hoje dela, para o vídeo gravar a ENTRADA.
import { dormir } from "../motor/palco.mjs";

const botao = (p, nome) => p.getByRole("button", { name: nome }).first();
const cartaoDoPonto = (p) => p.locator("section", { hasText: "Meu Ponto (Hoje)" }).locator(".card").first();
const cartaoGps = (p) => p.getByText("Localização GPS", { exact: true }).locator("xpath=../..");
const cartaoSelfie = (p) => p.getByText("Selfie de Verificação", { exact: true }).locator("xpath=..");
const cartaoRegistros = (p) => p.getByText("Registros de Hoje", { exact: true }).locator("xpath=..");

export default {
  id: "firecheck-bater-ponto",
  titulo: "Como bater o ponto",
  publico: "funcionario",
  conta: "funcionario",
  camera: "rosto-ana",
  tela: { width: 390, height: 844, celular: true },
  rota: "funcionario",
  prontaQuando: 'button:has-text("Registrar Ponto com IA")',
  pronuncia: { IA: "i á" },

  async preparar(banco, base) {
    const ana = base.pessoas.find((p) => p.nome.startsWith("Ana"));
    await banco.query(
      `DELETE FROM ponto_records WHERE user_id = $1 AND timestamp::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`,
      [ana.id]);
  },

  async antesDeGravar(palco) {
    const p = palco.pagina;
    await p.evaluate(() => window.scrollTo({ top: 0 }));
    await dormir(500);
  },

  cenas: [
    {
      capitulo: "Onde fica o ponto",
      fala: "Na Tela de Execução, o seu ponto fica neste cartão. Ele mostra o seu turno e a hora da entrada e da saída de hoje.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoDoPonto(p);
        await palco.rolarAte(c, { bloco: "center" });
        await palco.esperarRolagemParar(c);
        await palco.destacar(c, { folga: 4 });
        await palco.mover(p.getByText("Meu Ponto (Hoje)"), { ms: 600 });
        await ctx.ate(0.45);
        const turno = p.getByText("Turno do dia").first();
        await palco.destacar(turno.locator("xpath=.."), { folga: 4 });
        await palco.mover(turno, { ms: 500 });
        await ctx.ate(0.7);
        const horas = p.getByText("Entrada", { exact: true }).first();
        await palco.destacar(horas.locator("xpath=../.."), { folga: 4 });
        await palco.mover(horas, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para bater o ponto, toque em Registrar Ponto com IA.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await ctx.ate(0.35);
        await palco.clicar(botao(p, /Registrar Ponto com IA/), { ms: 600 });
        await p.getByRole("heading", { name: "Ponto Digital" }).waitFor({ state: "visible", timeout: 20_000 });
        await p.getByText(/Excelente/).first().waitFor({ state: "visible", timeout: 20_000 });
        await ctx.ate(1);
      },
    },
    {
      capitulo: "A tela do ponto",
      fala: "Esta é a tela do ponto. No alto, o seu nome e a hora de agora. Logo abaixo, o horário do seu turno de hoje.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await dormir(400);
        const nome = p.getByRole("heading", { name: "Ana Souza" });
        await palco.destacar(nome.locator("xpath=../.."), { folga: 4 });
        await palco.mover(nome, { ms: 600 });
        await ctx.ate(0.6);
        const turno = p.getByText("Horário de hoje:");
        await palco.destacar(turno.locator("xpath=../.."), { folga: 4 });
        await palco.mover(turno, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "A localização",
      fala: "O ponto só vale com a localização do celular ligada. Aqui aparece onde você está e a precisão do sinal.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoGps(p);
        await palco.rolarAte(c, { bloco: "center" });
        await palco.esperarRolagemParar(c);
        await palco.destacar(c, { folga: 4 });
        await palco.mover(p.getByText("Localização GPS", { exact: true }), { ms: 600 });
        await ctx.ate(0.5);
        const endereco = p.getByText(/Praça da Independência/).first();
        await palco.destacar(endereco, { folga: 6 });
        await palco.mover(endereco, { ms: 500 });
        await ctx.ate(0.75);
        const precisao = p.getByText(/Excelente/).first();
        await palco.destacar(precisao.locator("xpath=../.."), { folga: 4 });
        await palco.mover(precisao, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Se a precisão passar de duzentos metros, o ponto não registra. Vá para um lugar aberto e toque em Atualizar.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        await palco.destacar(p.getByText(/Excelente/).first().locator("xpath=../.."), { folga: 4 });
        await ctx.ate(0.55);
        const atualizar = cartaoGps(p).getByRole("button", { name: /Atualizar/ });
        await palco.destacar(atualizar, { folga: 6 });
        await palco.mover(atualizar, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "O que falta",
      fala: "Mais abaixo, esta lista mostra o que ainda falta para registrar. A localização já está certa; falta a selfie.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const req = p.getByText("Requisitos para registro:").locator("xpath=..");
        await palco.rolarAte(req, { bloco: "center" });
        await palco.esperarRolagemParar(req);
        await palco.destacar(req, { folga: 4 });
        await ctx.ate(0.6);
        await palco.destacar(p.getByText(/Selfie de verificação$/), { folga: 6 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "A selfie",
      fala: "A selfie confirma que é você mesmo batendo o ponto. Toque em Abrir Câmera.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoSelfie(p);
        await palco.rolarAte(c, { bloco: "center" });
        await palco.esperarRolagemParar(c);
        await ctx.ate(0.55);
        await palco.clicar(botao(p, /Abrir Câmera/), { ms: 600 });
        await p.waitForFunction(() => (document.querySelector("video")?.videoWidth || 0) > 0, null, { timeout: 15_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Enquadre o rosto no círculo e toque no botão laranja.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const video = p.locator("video");
        await palco.rolarAte(video, { bloco: "center" });
        await palco.esperarRolagemParar(video);
        await ctx.ate(0.5);
        await palco.clicar(p.locator("button:has(svg.lucide-camera)").first(), { ms: 600 });
        await p.getByText("Foto capturada").waitFor({ state: "visible", timeout: 10_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "Pronto, foto capturada. Se ficou ruim, toque em Tirar novamente.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const foto = p.getByAltText("Selfie capturada");
        await palco.rolarAte(foto, { bloco: "center" });
        await palco.esperarRolagemParar(foto);
        await palco.destacar(foto, { folga: 6 });
        await ctx.ate(0.55);
        const denovo = botao(p, /Tirar novamente/);
        await palco.destacar(denovo, { folga: 6 });
        await palco.mover(denovo, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Registrar a entrada",
      fala: "Com tudo certo, os botões acendem. Na chegada, toque em Registrar Entrada.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const entrada = botao(p, /Registrar Entrada/);
        await palco.rolarAte(entrada, { bloco: "center" });
        await palco.esperarRolagemParar(entrada);
        await ctx.ate(0.5);
        await palco.clicar(entrada, { ms: 600 });
        await p.getByText(/Entrada registrada com sucesso/).waitFor({ state: "visible", timeout: 20_000 });
        await ctx.ate(1);
      },
    },
    {
      fala: "A tela confirma, e a entrada aparece em Registros de hoje, com a hora e o endereço.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const c = cartaoRegistros(p);
        const linha = c.getByText("Entrada", { exact: true }).locator("xpath=../..");
        // O aviso verde fica 4 s no alto: é o "a tela confirma".
        const aviso = p.getByText(/Entrada registrada com sucesso/);
        if (await aviso.isVisible().catch(() => false)) {
          await palco.destacar(aviso, { folga: 4 });
          await palco.mover(aviso, { ms: 500 });
        }
        await linha.waitFor({ state: "visible", timeout: 20_000 });
        await ctx.ate(0.3);
        await palco.apagarDestaque();
        await palco.rolarAte(c, { bloco: "center" });
        await palco.esperarRolagemParar(c);
        await palco.destacar(linha, { folga: 4 });
        await palco.mover(linha, { ms: 500 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "A saída",
      fala: "Cada batida pede uma selfie nova. No fim do turno, tire a selfie de novo e toque em Registrar Saída. A saída só registra depois da entrada.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const saida = botao(p, /Registrar Saída/);
        await palco.rolarAte(saida, { bloco: "center" });
        await palco.esperarRolagemParar(saida);
        await ctx.ate(0.3);
        await palco.destacar(saida, { folga: 6 });
        await palco.mover(saida, { ms: 600 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      capitulo: "Fora do horário",
      fala: "E atenção ao horário: ponto batido depois do horário do turno, passando da tolerância, gera um aviso para o dono e o gestor da loja.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const turno = p.getByText("Horário de hoje:").locator("xpath=../..");
        await palco.rolarAte(turno, { bloco: "center" });
        await palco.esperarRolagemParar(turno);
        await palco.destacar(turno, { folga: 4 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
    },
    {
      fala: "Para rever este vídeo, é só tocar em Tutorial, aqui no alto da tela.",
      acao: async (palco, ctx) => {
        const p = palco.pagina;
        const tutorial = p.getByRole("button", { name: /Tutorial/ }).first();
        const alvo = (await tutorial.isVisible().catch(() => false)) ? tutorial : p.getByRole("heading", { name: "Ponto Digital" }).locator("xpath=..");
        await palco.rolarPagina(0);
        await dormir(400);
        await palco.destacar(alvo, { folga: 6 });
        await palco.mover(alvo, { ms: 700 });
        await ctx.ate(1);
        await palco.apagarDestaque();
      },
      pausa: 900,
    },
  ],
};
