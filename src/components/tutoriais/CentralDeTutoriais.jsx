import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Check, PlayCircle, Search, X } from 'lucide-react';
import {
  ABRIR_CENTRAL, capituloNoSegundo, centralAbreSozinha, CHAVE_CENTRAL_FECHADA, CHAVE_CENTRAL_NAO_MOSTRAR, CHAVE_VISTO,
  duracaoEmMinutos, ehFuncionario, foiVisto, gravarChave, idDoUsuario, lerUsuario, relogio, todosOsTutoriais, VELOCIDADES,
} from '../../tutoriais/telas';
import { buscarNosTutoriais } from '../../tutoriais/busca';
import { useJanelaAberta, useNaAreaVisivel } from './useNaAreaVisivel';
import VideoDoTutorial from './VideoDoTutorial';
import './tutoriais.css';

/**
 * CentralDeTutoriais — todos os vídeos, um depois do outro, com busca.
 *
 * Montada uma vez só (App.jsx), escuta a rota para saber quem está logado.
 *
 * ── Quando abre ─────────────────────────────────────────────────────────────
 * - Sozinha, uma vez depois do login, na primeira tela do painel (/admin ou
 *   /funcionario), se houver vídeo para aquela pessoa (telas.js ›
 *   centralAbreSozinha). Nunca no acesso remoto / Modo Simulação.
 * - "Fechar" (ou X, ou Esc): some até o próximo login (o Login apaga a marca).
 * - "Já vi, não mostrar mais": não abre sozinha nunca mais neste aparelho, para
 *   este usuário. O gravador dos vídeos clica nesse texto exato.
 * - A qualquer hora pelo "Tutoriais em vídeo" (menu lateral, Tela de Execução)
 *   e pelo "Todos os tutoriais" da janela de cada tela.
 *
 * Funcionário vê só os vídeos da equipe; dono e gestor veem os dois grupos,
 * separados. Ao fechar a que abriu sozinha, uma seta destaca o botão
 * "Tutorial": a pessoa sai sabendo onde a ajuda fica.
 */

/** O botão de tutorial que está à vista: o da tela; senão o "Tutoriais em vídeo". */
function botaoAVista() {
  const aVista = (b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.left < window.innerWidth && r.right > 0;
  };
  return Array.from(document.querySelectorAll('.fc-tut-botao')).find(aVista)
    || Array.from(document.querySelectorAll('.fc-tut-central-botao')).find(aVista)
    || null;
}

function medirSeta() {
  const b = botaoAVista();
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const largura = Math.min(290, window.innerWidth - 24);
  const meio = r.left + r.width / 2;
  const left = Math.max(12, Math.min(meio - largura / 2, window.innerWidth - largura - 12));
  return {
    daTela: b.classList.contains('fc-tut-botao'),
    anel: { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 },
    balao: { top: r.bottom + 14, left, x: Math.max(14, Math.min(meio - left - 7, largura - 28)) },
  };
}

export default function CentralDeTutoriais() {
  const { pathname } = useLocation();
  const [usuario, setUsuario] = useState(lerUsuario);
  const grupos = useMemo(() => todosOsTutoriais(usuario), [usuario]);
  const lista = useMemo(() => grupos.flatMap((g) => g.tutoriais), [grupos]);

  const [aberto, setAberto] = useState(false);
  const [qual, setQual] = useState(0);
  // O navegador não deixa vídeo com som começar sem um clique na página: o
  // primeiro espera o play; depois que a pessoa escolheu, o próximo emenda.
  const [tocar, setTocar] = useState(false);
  const [segundo, setSegundo] = useState(0);
  const [velocidade, setVelocidade] = useState(1);
  const [busca, setBusca] = useState('');
  const [vistos, setVistos] = useState(() => new Set());
  const [seta, setSeta] = useState(null);
  // Capítulo escolhido na busca em OUTRO vídeo: o pulo acontece quando o vídeo novo carrega.
  const pulo = useRef(null);
  const abriuSozinha = useRef(false);
  const video = useRef(null);
  const fecharRef = useRef(null);
  const fundoRef = useNaAreaVisivel(aberto);

  const abrir = useCallback((sozinha, quem) => {
    const u = quem || lerUsuario();
    const todos = todosOsTutoriais(u).flatMap((g) => g.tutoriais);
    if (!todos.length) return;
    const v = new Set(todos.filter((t) => foiVisto(t.id)).map((t) => t.id));
    setUsuario(u);
    setVistos(v);
    // Começa no primeiro que a pessoa ainda não viu.
    setQual(Math.max(0, todos.findIndex((t) => !v.has(t.id))));
    setSegundo(0);
    setTocar(false);
    setBusca('');
    setSeta(null);
    abriuSozinha.current = sozinha;
    setAberto(true);
  }, []);

  // A cada tela, relê quem está logado (o login troca o usuário sem recarregar)
  // e abre sozinha se for a vez.
  useEffect(() => {
    const u = lerUsuario();
    setUsuario(u);
    if (centralAbreSozinha(u, pathname)) abrir(true, u);
  }, [pathname, abrir]);

  useEffect(() => {
    const pedir = () => abrir(false);
    window.addEventListener(ABRIR_CENTRAL, pedir);
    return () => window.removeEventListener(ABRIR_CENTRAL, pedir);
  }, [abrir]);

  const fechar = useCallback((naoMostrarMais) => {
    video.current?.pause();
    const id = idDoUsuario(usuario);
    if (id) {
      gravarChave(CHAVE_CENTRAL_FECHADA + id, '1');
      if (naoMostrarMais === true) gravarChave(CHAVE_CENTRAL_NAO_MOSTRAR + id, '1');
    }
    setAberto(false);
    if (abriuSozinha.current) requestAnimationFrame(() => setSeta(medirSeta()));
  }, [usuario]);

  const fecharSimples = useCallback(() => fechar(false), [fechar]);
  useJanelaAberta(aberto, fecharSimples, fecharRef);

  // A seta acompanha a tela (girar o celular, rolar) e some no primeiro toque ou em 12 s.
  const comSeta = seta !== null;
  useEffect(() => {
    if (!comSeta) return;
    const medir = () => setSeta(medirSeta());
    const sumir = () => setSeta(null);
    const tempo = window.setTimeout(sumir, 12000);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    window.addEventListener('pointerdown', sumir, true);
    return () => {
      window.clearTimeout(tempo);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('pointerdown', sumir, true);
    };
  }, [comSeta]);

  const seta_ = seta && createPortal(
    <>
      <div className="fc-seta-anel" style={seta.anel} />
      <div className="fc-seta-balao" role="status" style={{ top: seta.balao.top, left: seta.balao.left, '--x': `${seta.balao.x}px` }}>
        <strong>{seta.daTela ? 'O tutorial fica sempre aqui' : 'Os tutoriais ficam sempre aqui'}</strong>
        {seta.daTela
          ? 'Em cada tela, este botão abre o vídeo daquela tela. A lista completa continua em “Todos os tutoriais”.'
          : 'Ficou com dúvida? Este botão abre de novo todos os vídeos.'}
        <div><button type="button" onClick={() => setSeta(null)}>Entendi</button></div>
      </div>
    </>,
    document.body,
  );

  if (!aberto || !lista.length) return seta_ || null;

  const tutorial = lista[Math.min(qual, lista.length - 1)];
  const capituloAtual = capituloNoSegundo(tutorial.capitulos, segundo);
  const soEquipe = ehFuncionario(usuario);

  const escolher = (i) => {
    // O vídeo que já está na tela não troca de elemento: o autoPlay não dispararia de novo.
    if (i === qual) {
      video.current?.play().catch(() => {});
      return;
    }
    setQual(i);
    setSegundo(0);
    setTocar(true);
  };

  const marcarVisto = () => {
    gravarChave(CHAVE_VISTO + tutorial.id, '1');
    setVistos((v) => (v.has(tutorial.id) ? v : new Set(v).add(tutorial.id)));
  };

  const irPara = (em) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = em;
    v.play().catch(() => {});
  };

  const irParaCapitulo = (i, em) => {
    if (i === qual) return irPara(em);
    pulo.current = em;
    setQual(i);
    setSegundo(em);
    setTocar(true);
  };

  const buscando = busca.trim().length >= 2;
  const resultados = buscando ? buscarNosTutoriais(busca, lista) : [];

  const item = (t, i) => (
    <button key={t.id} type="button" className="fc-central-item" aria-current={i === qual} onClick={() => escolher(i)}>
      <span className={vistos.has(t.id) ? 'fc-central-marca visto' : 'fc-central-marca'} aria-label={vistos.has(t.id) ? 'assistido' : undefined}>
        {vistos.has(t.id) && <Check size={12} strokeWidth={3} />}
      </span>
      {t.titulo}
      <span className="fc-central-dur">{duracaoEmMinutos(t.duracao)}</span>
    </button>
  );

  return (
    <>
      {createPortal(
        <div ref={fundoRef} className="fc-tut-fundo">
          <div className="fc-tut-janela fc-central-janela" role="dialog" aria-modal="true" aria-labelledby="fc-central-titulo">
            <div className="fc-tut-topo">
              <div className="fc-tut-cabeca">
                <span className="fc-tut-sobre">Tutoriais em vídeo</span>
                <h2 id="fc-central-titulo">Como usar o FireCheck</h2>
              </div>
              <button ref={fecharRef} type="button" className="fc-tut-fechar" onClick={() => fechar(false)} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
            <p className="fc-central-boas">
              Vídeos curtos, um depois do outro, mostrando o passo a passo do dia a dia. Ficou com dúvida depois?{' '}
              {soEquipe ? 'Toque em' : 'Clique em'} <span className="fc-central-chave"><PlayCircle size={12} /> Tutorial</span> no alto
              da tela: ele abre o vídeo exatamente daquela tela.
              {!soEquipe && <> A lista completa fica em <strong>Tutoriais em vídeo</strong>, no menu lateral.</>}
            </p>

            <div className="fc-tut-corpo fc-central-corpo">
              <div>
                <VideoDoTutorial
                  tutorial={tutorial}
                  videoRef={video}
                  autoPlay={tocar}
                  velocidade={velocidade}
                  pulo={pulo}
                  onSegundo={setSegundo}
                  onPlay={() => { setTocar(true); marcarVisto(); }}
                  onEnded={() => { if (qual < lista.length - 1) escolher(qual + 1); }}
                />
                <div className="fc-tut-barra">
                  <span style={{ marginRight: 'auto', fontWeight: 700, color: 'var(--text-main)' }}>
                    {qual + 1}. {tutorial.titulo}
                  </span>
                  Velocidade
                  {VELOCIDADES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={velocidade === v}
                      onClick={() => { setVelocidade(v); if (video.current) video.current.playbackRate = v; }}
                    >
                      {String(v).replace('.', ',')}x
                    </button>
                  ))}
                </div>
                {tutorial.capitulos.length > 0 && (
                  <div className="fc-central-capitulos">
                    {tutorial.capitulos.map((c, i) => (
                      <button key={`${c.em}-${i}`} type="button" aria-current={i === capituloAtual} onClick={() => irPara(c.em)}>
                        <time>{relogio(c.em)}</time>{c.titulo}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="fc-tut-lista-titulo">Passo a passo</div>
                <label className="fc-central-busca">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={soEquipe ? 'Buscar: ex. bater o ponto' : 'Buscar: ex. criar checklist'}
                    aria-label="Buscar nos tutoriais"
                  />
                  {busca && (
                    <button type="button" onClick={() => setBusca('')} aria-label="Limpar a busca"><X size={13} /></button>
                  )}
                </label>
                <div className="fc-central-lista">
                  {buscando && !resultados.length && (
                    <p className="fc-central-vazio">Nenhum vídeo fala de “{busca.trim()}”. Tente outra palavra, como o nome da tela.</p>
                  )}
                  {buscando && resultados.map(({ tutorial: t, capitulos }) => {
                    const i = lista.indexOf(t);
                    return (
                      <div key={t.id} className="fc-central-achado">
                        {item(t, i)}
                        {capitulos.map((c) => (
                          <button key={c.em} type="button" className="fc-central-trecho" onClick={() => irParaCapitulo(i, c.em)}>
                            <time>{relogio(c.em)}</time>{c.titulo}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {!buscando && grupos.map((g) => (
                    <div key={g.publico}>
                      {grupos.length > 1 && <div className="fc-central-grupo">{g.titulo}</div>}
                      {g.tutoriais.map((t) => item(t, lista.indexOf(t)))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fc-central-rodape">
              <span className="fc-central-progresso">
                <Check size={14} /> {vistos.size} de {lista.length} vídeos assistidos
              </span>
              <button type="button" className="fc-central-btn-fechar" onClick={() => fechar(false)}>Fechar</button>
              <button type="button" className="fc-central-btn-nao" onClick={() => fechar(true)}>Já vi, não mostrar mais</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {seta_}
    </>
  );
}
