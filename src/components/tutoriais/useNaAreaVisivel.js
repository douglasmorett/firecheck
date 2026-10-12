import { useEffect, useRef } from 'react';

/**
 * Encaixa o fundo da janela na parte da tela que a pessoa VÊ.
 *
 * No celular, tela com conteúdo mais largo que o aparelho faz o navegador
 * alargar a página inteira: `position: fixed; inset: 0` passa a cobrir mais do
 * que a pessoa enxerga, e a janela do vídeo sai cortada, com o rodapé fora de
 * alcance (foi o que aconteceu no FireHub). O `visualViewport` diz a área
 * visível; quando ela difere da página, o fundo é posto exatamente sobre ela.
 * Também acompanha o teclado do celular abrindo (a busca da central).
 */
export function useNaAreaVisivel(ativo) {
  const ref = useRef(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const el = ref.current;
    if (!ativo || !vv || !el) return;
    const ajustar = () => {
      const igual = Math.abs(window.innerWidth - vv.width) < 2 && Math.abs(window.innerHeight - vv.height) < 2;
      el.style.left = igual ? '' : `${vv.offsetLeft}px`;
      el.style.top = igual ? '' : `${vv.offsetTop}px`;
      el.style.width = igual ? '' : `${vv.width}px`;
      el.style.height = igual ? '' : `${vv.height}px`;
      el.style.right = igual ? '' : 'auto';
      el.style.bottom = igual ? '' : 'auto';
    };
    ajustar();
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    return () => {
      vv.removeEventListener('resize', ajustar);
      vv.removeEventListener('scroll', ajustar);
    };
  }, [ativo]);
  return ref;
}

/** Esc fecha; o foco vai para o X ao abrir; a página atrás não rola. */
export function useJanelaAberta(aberto, fechar, focoRef) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', tecla);
    focoRef?.current?.focus({ preventScroll: true });
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = anterior;
    };
  }, [aberto, fechar, focoRef]);
}
