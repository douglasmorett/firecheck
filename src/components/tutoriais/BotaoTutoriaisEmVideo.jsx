import { MonitorPlay } from 'lucide-react';
import { abrirCentralDeTutoriais, lerUsuario, temTutoriais } from '../../tutoriais/telas';
import './tutoriais.css';

/**
 * "Tutoriais em vídeo": abre a central com todos os vídeos daquela pessoa.
 * Mora no menu lateral do painel (variante "menu"; recolhido = só o ícone) e
 * na Tela de Execução (variante "cartao"). Sem vídeo publicado para quem está
 * logado, não desenha nada.
 */
export default function BotaoTutoriaisEmVideo({ usuario, variante = 'menu', recolhido = false, onClick }) {
  if (!temTutoriais(usuario || lerUsuario())) return null;
  const classe = ['fc-tut-central-botao', variante === 'cartao' ? 'cartao' : '', recolhido ? 'recolhido' : ''].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={classe}
      title={recolhido ? 'Tutoriais em vídeo' : 'Vídeos curtos ensinando a usar o FireCheck'}
      aria-label="Tutoriais em vídeo"
      onClick={() => { onClick?.(); abrirCentralDeTutoriais(); }}
    >
      <MonitorPlay size={18} />
      {!recolhido && <span>Tutoriais em vídeo</span>}
    </button>
  );
}
