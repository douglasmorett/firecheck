import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { arquivosDoTutorial } from '../../tutoriais/telas';

/**
 * O <video> de um tutorial, igual na janela da tela e na central.
 *
 * - Os arquivos moram no servidor do FireHub (outra origem): crossOrigin
 *   "anonymous" é o que deixa o navegador carregar a legenda de lá.
 * - No app (iPhone/Android) o vídeo vai SEM crossOrigin e a legenda chega por
 *   fetch, como blob local: o <video> com CORS não tocava no WKWebView do
 *   iPhone (origem capacitor://localhost), e vídeo não precisa de CORS.
 * - Legenda ligada de saída — loja e cozinha são barulhentas, e o `default`
 *   do <track> não basta em todo navegador.
 * - Sem internet ou vídeo fora do ar: o aviso aparece em cima do vídeo, com
 *   "Tentar de novo" (nada de alert()).
 */
export default function VideoDoTutorial({
  tutorial, videoRef, autoPlay = true, velocidade = 1, pulo, onSegundo, onPlay, onEnded, children,
}) {
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const arquivos = arquivosDoTutorial(tutorial);
  const noApp = Capacitor.isNativePlatform();
  const [legendaLocal, setLegendaLocal] = useState(null);

  useEffect(() => {
    if (!noApp) return undefined;
    let url = null;
    let vivo = true;
    fetch(arquivos.legendas)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || !vivo) return;
        url = URL.createObjectURL(new Blob([b], { type: 'text/vtt' }));
        setLegendaLocal(url);
      })
      .catch(() => {});
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [noApp, arquivos.legendas]);

  return (
    <div className={tutorial.emPe ? 'fc-tut-palco em-pe' : 'fc-tut-palco'}>
      <video
        key={`${tutorial.id}:${tentativa}`}
        ref={videoRef}
        className={tutorial.emPe ? 'fc-tut-video em-pe' : 'fc-tut-video'}
        src={arquivos.video}
        poster={arquivos.capa}
        crossOrigin={noApp ? undefined : 'anonymous'}
        controls
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        controlsList="nodownload"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          for (const faixa of Array.from(v.textTracks || [])) {
            if (faixa.kind === 'subtitles' || faixa.kind === 'captions') faixa.mode = 'showing';
          }
          v.playbackRate = velocidade;
          if (pulo && pulo.current != null) {
            v.currentTime = pulo.current;
            pulo.current = null;
          }
        }}
        onPlay={() => { setErro(false); onPlay?.(); }}
        onTimeUpdate={(e) => onSegundo?.(e.currentTarget.currentTime)}
        onEnded={onEnded}
        onError={() => setErro(true)}
      >
        {(!noApp || legendaLocal) && (
          <track kind="subtitles" src={noApp ? legendaLocal : arquivos.legendas} srcLang="pt" label="Português" default />
        )}
      </video>

      {erro && (
        <div className="fc-tut-aviso" role="alert">
          <span>Não foi possível carregar o vídeo agora.<br />Confira a internet do aparelho e tente de novo.</span>
          <button type="button" onClick={() => { setErro(false); setTentativa((n) => n + 1); }}>Tentar de novo</button>
        </div>
      )}
      {children}
    </div>
  );
}
