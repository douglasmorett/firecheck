// Peças comuns aos vídeos das abas do painel do dono (Compras, Frota, Bill, Perfil).
import { dormir } from "../motor/palco.mjs";

/** Item do menu lateral do painel. */
export const menu = (p, nome) => p.locator("aside.sidebar button", { hasText: nome }).first();

/**
 * Abre a aba do painel antes de gravar: a aba aberta fica guardada no aparelho
 * (localStorage.admin_active_tab), então o clique é feito pelo código, e toda
 * caixa rolada volta ao topo para o vídeo abrir com o logo inteiro.
 */
export async function abrirAba(palco, { chave, nomeNoMenu, prova }) {
  const p = palco.pagina;
  await p.evaluate((c) => localStorage.setItem("admin_active_tab", c), chave);
  await menu(p, nomeNoMenu).evaluate((b) => b.click());
  await p.locator(prova).first().waitFor({ state: "visible", timeout: 20_000 });
  await dormir(1500);
  await p.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll("*")]) if (el && el.scrollTop > 0) el.scrollTop = 0; });
  await dormir(400);
}

/**
 * Última cena: "Para rever este vídeo…" apontando o botão Tutorial do alto da
 * tela quando ele existe (só aparece depois de o vídeo ser publicado); senão,
 * o título da aba.
 */
export function cenaFinal(tituloDaAba) {
  return {
    fala: "Para rever este vídeo, é só clicar em Tutorial, aqui no alto da tela.",
    acao: async (palco, ctx) => {
      const p = palco.pagina;
      await palco.cameraAberta({ ms: 400 });
      if (await p.evaluate(() => window.scrollY > 0)) await palco.rolarPagina(0);
      const botao = p.locator("button.fc-tut-botao").first();
      const alvo = (await botao.isVisible().catch(() => false)) ? botao : tituloDaAba(p);
      await palco.destacar(alvo, { folga: 6 });
      await palco.mover(alvo, { ms: 800 });
      await ctx.ate(1);
      await palco.apagarDestaque();
    },
    pausa: 900,
  };
}
