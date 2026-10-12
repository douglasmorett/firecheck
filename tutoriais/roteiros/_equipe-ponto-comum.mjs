// Peças comuns dos vídeos do painel do dono (Equipe, Ponto, Ranking, Notificações).
import { dormir } from "../motor/palco.mjs";

/** Item do menu lateral do painel. */
export const menu = (p, nome) => p.locator("aside.sidebar button", { hasText: nome }).first();

/**
 * Abre uma aba do painel ANTES da gravação (clique pelo código) e deixa tudo no
 * topo: a página, o menu e qualquer caixa rolada. `prova` é um texto da aba.
 */
export async function abrirAba(palco, nome, prova) {
  const p = palco.pagina;
  await menu(p, nome).evaluate((b) => b.click());
  await p.getByText(prova).first().waitFor({ state: "visible", timeout: 20_000 });
  await dormir(1200);
  await p.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll("*")]) if (el && el.scrollTop > 0) el.scrollTop = 0; });
  await dormir(400);
}

/**
 * A última cena de todo vídeo: aponta o botão "Tutorial" se ele estiver na tela
 * (depois de publicar); senão, o título da tela.
 */
export function cenaFinal(titulo, antes) {
  return {
    fala: "Para rever este vídeo, é só clicar em Tutorial, aqui no alto da tela.",
    acao: async (palco, ctx) => {
      const p = palco.pagina;
      if (antes) await antes(palco);
      const botao = p.locator("button", { hasText: /^\s*Tutorial/ }).filter({ visible: true }).first();
      const alvo = (await botao.isVisible().catch(() => false)) ? botao : titulo(p);
      await palco.destacar(alvo, { folga: 6 });
      await palco.mover(alvo, { ms: 800 });
      await ctx.ate(1);
      await palco.apagarDestaque();
    },
    pausa: 900,
  };
}
