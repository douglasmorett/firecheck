import { useState } from 'react';
import { Play, PlayCircle } from 'lucide-react';
import {
  arquivosDoTutorial, CHAVE_FAIXA_OCULTA, foiVisto, gravarChave, lerChave, lerUsuario, nomeDaTela, relogio,
  titulosCurtos, tutoriaisDaTela,
} from '../../tutoriais/telas';
import JanelaDoTutorial from './JanelaDoTutorial';
import './tutoriais.css';

/**
 * O botão "Tutorial <tela>" no cabeçalho de cada tela que tem vídeo, e a
 * faixa no alto das abas do painel ("Tem um tutorial desta tela").
 *
 * Sutil de propósito — é ajuda para quem procura, não propaganda: sem abrir
 * sozinho, sem piscar. O único chamariz é uma bolinha amarela até a pessoa
 * assistir os vídeos daquela tela. Tela sem vídeo publicado (fichas.json) não
 * desenha nada.
 *
 * Use com key={tela} quando a mesma instância troca de tela (as abas do painel).
 *
 * @param tela     chave em src/tutoriais/telas.js (TELAS): "admin:ranking", "/ponto"...
 * @param variante "botao" (padrão) ou "faixa"
 * @param encolhe  no celular, o botão fica só "Tutorial" (sem o nome da tela)
 */
export default function BotaoTutorial({ tela, usuario, variante = 'botao', encolhe = false, rotulo, style }) {
  const tutoriais = tutoriaisDaTela(tela, usuario || lerUsuario());
  const nome = nomeDaTela(tela);
  const [aberto, setAberto] = useState(false);
  // A bolinha some quando a pessoa abre; volta só se ainda falta assistir algum.
  const [jaAbriu, setJaAbriu] = useState(false);
  const [faixaOculta, setFaixaOculta] = useState(() => lerChave(CHAVE_FAIXA_OCULTA + tela) === '1');

  if (!tutoriais.length) return null;
  if (variante === 'faixa' && faixaOculta) return null;

  const total = tutoriais.length;
  const serie = total > 1;
  const novo = !jaAbriu && tutoriais.some((t) => !foiVisto(t.id));
  const abrir = () => { setJaAbriu(true); setAberto(true); };
  const janela = aberto && (
    <JanelaDoTutorial tutoriais={tutoriais} nome={nome} onFechar={() => setAberto(false)} />
  );

  if (variante === 'faixa') {
    const curtos = titulosCurtos(tutoriais);
    const primeiro = tutoriais[0];
    return (
      <>
        <div className="fc-tut-faixa" style={style}>
          <button
            type="button"
            className={primeiro.emPe ? 'fc-tut-miniatura em-pe' : 'fc-tut-miniatura'}
            onClick={abrir}
            aria-label={serie ? `Assistir os ${total} vídeos desta tela` : `Assistir: ${primeiro.titulo}`}
          >
            <img src={arquivosDoTutorial(primeiro).capa} alt="" loading="lazy" />
            <span className="fc-tut-play"><Play size={14} fill="currentColor" /></span>
            {serie && <span className="fc-tut-qtd">{total} vídeos</span>}
          </button>
          <div className="fc-tut-faixa-texto">
            <b>{serie ? `Esta tela tem ${total} vídeos tutoriais` : 'Tem um tutorial desta tela'}</b>
            <span>
              {serie ? curtos.map((c, i) => `${i + 1}. ${c}`).join('  ·  ') : `${primeiro.titulo} · ${relogio(primeiro.duracao)}`}
            </span>
          </div>
          <div className="fc-tut-acoes">
            <button type="button" className="fc-tut-assistir" onClick={abrir}>
              <Play size={13} fill="currentColor" /> {serie ? `Assistir os ${total}` : 'Assistir'}
            </button>
            <button
              type="button"
              className="fc-tut-ocultar"
              onClick={() => { gravarChave(CHAVE_FAIXA_OCULTA + tela, '1'); setFaixaOculta(true); }}
            >
              Não mostrar mais nesta tela
            </button>
          </div>
        </div>
        {janela}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={encolhe ? 'fc-tut-botao encolhe' : 'fc-tut-botao'}
        onClick={abrir}
        style={style}
        title={serie ? `${total} vídeos desta tela` : `Vídeo de ${Math.max(1, Math.ceil(tutoriais[0].duracao / 60))} min: ${tutoriais[0].titulo}`}
        aria-label={nome ? `Tutorial da tela ${nome}${serie ? ` (${total} vídeos)` : ''}` : 'Tutorial: como usar esta tela'}
      >
        <PlayCircle size={16} />
        <span>{rotulo || <>Tutorial{nome && <span className="fc-tut-nome"> {nome}</span>}</>}</span>
        {novo && <i className="fc-tut-novo" aria-hidden="true" />}
      </button>
      {janela}
    </>
  );
}
