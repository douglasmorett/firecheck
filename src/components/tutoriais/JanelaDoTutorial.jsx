import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ListVideo, Play, X } from 'lucide-react';
import {
  abrirCentralDeTutoriais, arquivosDoTutorial, capituloNoSegundo, CHAVE_VISTO, duracaoEmMinutos, ESPERA_DO_PROXIMO,
  foiVisto, gravarChave, relogio, titulosCurtos, VELOCIDADES,
} from '../../tutoriais/telas';
import { useJanelaAberta, useNaAreaVisivel } from './useNaAreaVisivel';
import VideoDoTutorial from './VideoDoTutorial';
import './tutoriais.css';

/**
 * A janela do vídeo de uma tela, por cima dela, sem trocar de página: a pessoa
 * assiste, fecha (X, Esc ou clique fora) e continua de onde estava.
 *
 * Capítulos ao lado (embaixo, no celular) levam direto ao ponto. Tela com
 * vários vídeos ganha uma fileira de cartões numerados com a capa ("Esta tela
 * tem 2 vídeos"), o título diz "vídeo 1 de 2", e quando um acaba o próximo
 * começa sozinho depois de uma contagem de 6 s — a não ser que a pessoa
 * cancele ou feche. No FireHub, com pílulas de texto, o Douglas assistiu o
 * primeiro e não percebeu que havia outros.
 */
export default function JanelaDoTutorial({ tutoriais, nome, inicial = 0, onFechar }) {
  const [qual, setQual] = useState(inicial);
  const [segundo, setSegundo] = useState(0);
  const [velocidade, setVelocidade] = useState(1);
  const [vistos, setVistos] = useState(() => new Set(tutoriais.filter((t) => foiVisto(t.id)).map((t) => t.id)));
  // O vídeo acabou: "proximo" mostra a contagem para o seguinte; "ultimo", o fim da série.
  const [fim, setFim] = useState(null);
  const [contagem, setContagem] = useState(ESPERA_DO_PROXIMO);
  const video = useRef(null);
  const fecharRef = useRef(null);
  const cartoesRef = useRef(null);
  const fundoRef = useNaAreaVisivel(true);

  const total = tutoriais.length;
  const serie = total > 1;
  const tutorial = tutoriais[Math.min(qual, total - 1)];
  const curtos = titulosCurtos(tutoriais);

  const fechar = useCallback(() => {
    video.current?.pause();
    onFechar();
  }, [onFechar]);
  useJanelaAberta(true, fechar, fecharRef);

  /** Troca para outro vídeo da tela (o elemento de vídeo é outro: o autoPlay o começa). */
  const trocar = useCallback((i) => {
    setFim(null);
    if (i === qual) {
      const v = video.current;
      if (v) {
        if (v.ended) v.currentTime = 0;
        v.play().catch(() => {});
      }
      return;
    }
    setQual(i);
    setSegundo(0);
  }, [qual]);

  // A contagem do próximo vídeo. Fechar a janela ou cancelar desmonta a contagem.
  useEffect(() => {
    if (fim !== 'proximo') return;
    setContagem(ESPERA_DO_PROXIMO);
    const inicio = Date.now();
    const relogioDaEspera = window.setInterval(() => {
      const falta = ESPERA_DO_PROXIMO - Math.floor((Date.now() - inicio) / 1000);
      if (falta <= 0) {
        window.clearInterval(relogioDaEspera);
        trocar(qual + 1);
      } else {
        setContagem(falta);
      }
    }, 250);
    return () => window.clearInterval(relogioDaEspera);
  }, [fim, qual, trocar]);

  // No celular os cartões rolam de lado: o do vídeo que está tocando fica à vista.
  useEffect(() => {
    const lista = cartoesRef.current;
    const cartao = lista?.children[qual];
    if (!lista || !cartao || lista.scrollWidth <= lista.clientWidth) return;
    lista.scrollTo({ left: Math.max(0, cartao.offsetLeft - lista.offsetLeft - 8), behavior: 'smooth' });
  }, [qual]);

  if (!tutorial) return null;

  const capituloAtual = capituloNoSegundo(tutorial.capitulos, segundo);
  const assistidos = tutoriais.filter((t) => vistos.has(t.id)).length;
  const faltando = tutoriais.findIndex((t) => !vistos.has(t.id));

  const marcarVisto = (id) => {
    gravarChave(CHAVE_VISTO + id, '1');
    setVistos((v) => (v.has(id) ? v : new Set(v).add(id)));
  };

  const acabou = () => {
    if (!serie) return;
    // Em tela cheia a contagem ficaria escondida atrás do vídeo.
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setFim(qual < total - 1 ? 'proximo' : 'ultimo');
  };

  const irPara = (em) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = em;
    v.play().catch(() => {});
  };

  const mudarVelocidade = (v) => {
    setVelocidade(v);
    if (video.current) video.current.playbackRate = v;
  };

  return createPortal(
    <div ref={fundoRef} className="fc-tut-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="fc-tut-janela" role="dialog" aria-modal="true" aria-label={tutorial.titulo}>
        <div className="fc-tut-topo">
          <div className="fc-tut-cabeca">
            {(serie || nome) && (
              <span className="fc-tut-sobre">
                {nome ? `Tutorial ${nome}` : 'Tutorial'}{serie ? ` · vídeo ${qual + 1} de ${total}` : ''}
              </span>
            )}
            <h2>{tutorial.titulo}</h2>
          </div>
          <button type="button" className="fc-tut-todos" onClick={() => { fechar(); abrirCentralDeTutoriais(); }}>
            Todos<span className="fc-tut-todos-longo"> os tutoriais</span>
          </button>
          <button ref={fecharRef} type="button" className="fc-tut-fechar" onClick={fechar} aria-label="Fechar o vídeo">
            <X size={17} />
          </button>
        </div>

        {serie && (
          <section className="fc-tut-serie" aria-label={`Os ${total} vídeos desta tela`}>
            <div className="fc-tut-serie-topo">
              <b><ListVideo size={16} /> Esta tela tem {total} vídeos</b>
              <span>Assista na ordem: quando um termina, o próximo começa sozinho.</span>
              <em><Check size={13} strokeWidth={3} /> {assistidos} de {total} assistidos</em>
            </div>
            <ol className="fc-tut-cartoes" ref={cartoesRef} style={{ '--n': total }}>
              {tutoriais.map((t, i) => {
                const atual = i === qual;
                return (
                  <li key={t.id}>
                    <button type="button" className="fc-tut-cartao" aria-current={atual} title={t.titulo} onClick={() => trocar(i)}>
                      <span className={t.emPe ? 'fc-tut-cartao-capa em-pe' : 'fc-tut-cartao-capa'}>
                        <img src={arquivosDoTutorial(t).capa} alt="" loading="lazy" />
                        <i>{i + 1}</i>
                      </span>
                      <span className="fc-tut-cartao-texto">
                        <b>{curtos[i]}</b>
                        <small>
                          {duracaoEmMinutos(t.duracao)}
                          {atual
                            ? <span className="fc-tut-agora">· <Play size={9} fill="currentColor" /> Assistindo</span>
                            : vistos.has(t.id) && <span className="fc-tut-visto">· <Check size={11} strokeWidth={3} /> Assistido</span>}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <div className="fc-tut-corpo">
          <div>
            <VideoDoTutorial
              tutorial={tutorial}
              videoRef={video}
              velocidade={velocidade}
              onSegundo={setSegundo}
              onPlay={() => { setFim(null); marcarVisto(tutorial.id); }}
              onEnded={acabou}
            >
              {serie && fim === 'proximo' && (
                <div className="fc-tut-fim" role="status">
                  <span className="fc-tut-fim-rotulo">A seguir · vídeo {qual + 2} de {total}</span>
                  <div className="fc-tut-fim-proximo">
                    <img src={arquivosDoTutorial(tutoriais[qual + 1]).capa} alt="" />
                    <b>{curtos[qual + 1]}</b>
                  </div>
                  <span className="fc-tut-fim-conta">Começa em {contagem} s</span>
                  <i className="fc-tut-fim-barra" style={{ '--espera': `${ESPERA_DO_PROXIMO}s` }} />
                  <div className="fc-tut-fim-botoes">
                    <button type="button" className="sim" onClick={() => trocar(qual + 1)}>
                      <Play size={14} fill="currentColor" /> Assistir agora
                    </button>
                    <button type="button" onClick={() => setFim(null)}>Cancelar</button>
                  </div>
                </div>
              )}

              {serie && fim === 'ultimo' && (
                <div className="fc-tut-fim" role="status">
                  <span className="fc-tut-fim-ok"><Check size={24} strokeWidth={3} /></span>
                  <b className="fc-tut-fim-titulo">Este foi o último dos {total} vídeos desta tela.</b>
                  {faltando >= 0 && (
                    <span className="fc-tut-fim-sub">Ainda falta assistir o vídeo {faltando + 1}: {curtos[faltando]}.</span>
                  )}
                  <div className="fc-tut-fim-botoes">
                    {faltando >= 0 ? (
                      <>
                        <button type="button" className="sim" onClick={() => trocar(faltando)}>
                          <Play size={14} fill="currentColor" /> Assistir o vídeo {faltando + 1}
                        </button>
                        <button type="button" onClick={fechar}>Fechar</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="sim" onClick={fechar}>Fechar</button>
                        <button type="button" onClick={() => trocar(0)}>Rever do início</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </VideoDoTutorial>

            <div className="fc-tut-barra">
              Velocidade
              {VELOCIDADES.map((v) => (
                <button key={v} type="button" aria-pressed={velocidade === v} onClick={() => mudarVelocidade(v)}>
                  {String(v).replace('.', ',')}x
                </button>
              ))}
              {serie && qual < total - 1 && (
                <button type="button" className="fc-tut-proximo" onClick={() => trocar(qual + 1)} title={tutoriais[qual + 1].titulo}>
                  <span>Próximo: {qual + 2}. {curtos[qual + 1]}</span> ›
                </button>
              )}
            </div>
          </div>

          {tutorial.capitulos.length > 0 && (
            <div>
              <div className="fc-tut-lista-titulo">Neste vídeo</div>
              <ol className="fc-tut-lista">
                {tutorial.capitulos.map((c, i) => (
                  <li key={`${c.em}-${i}`}>
                    <button type="button" className="fc-tut-capitulo" aria-current={i === capituloAtual} onClick={() => irPara(c.em)}>
                      <time>{relogio(c.em)}</time>
                      {c.titulo}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
