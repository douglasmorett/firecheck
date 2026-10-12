// Peças comuns dos vídeos do painel do dono (checklists, resultados, alertas).
import { dormir } from "../motor/palco.mjs";

export const menu = (p, nome) => p.locator("aside.sidebar button", { hasText: nome }).first();

/** Abre uma aba do painel pelo código (antes de gravar) e volta tudo ao topo. */
export async function abrirAba(palco, aba, nomeNoMenu, prova) {
  const p = palco.pagina;
  await p.evaluate((a) => localStorage.setItem("admin_active_tab", a), aba);
  await menu(p, nomeNoMenu).evaluate((b) => b.click());
  await p.getByText(prova).first().waitFor({ state: "visible", timeout: 20_000 });
  await dormir(1200);
  await p.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll("*")]) if (el && el.scrollTop > 0) el.scrollTop = 0; });
  await dormir(300);
}

/** Início do dia de hoje em São Paulo, no relógio UTC sem fuso de checklist_submissions. */
export const INICIO_DE_HOJE = "((date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'";

/**
 * Última cena de todo vídeo: aponta o botão Tutorial se ele estiver na tela
 * (depois de publicado); senão, o título da tela.
 */
export function cenaFinal(tituloDaTela) {
  return {
    fala: "Para rever este vídeo, é só clicar em Tutorial, aqui no alto da tela.",
    acao: async (palco, ctx) => {
      const p = palco.pagina;
      const botao = p.locator("button", { hasText: /^\s*Tutorial/ }).first();
      const alvo = (await botao.isVisible().catch(() => false)) ? botao : tituloDaTela(p);
      const caixa = await alvo.boundingBox();
      if (!caixa || caixa.y < 0 || caixa.y + caixa.height > palco.pagina.viewportSize().height) {
        await palco.rolarAte(alvo, { bloco: "center" });
      }
      await palco.destacar(alvo, { folga: 6 });
      await palco.mover(alvo, { ms: 800 });
      await ctx.ate(1);
      await palco.apagarDestaque();
    },
    pausa: 900,
  };
}
