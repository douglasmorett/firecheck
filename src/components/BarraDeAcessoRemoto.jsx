import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Faixa fixa no topo enquanto você está dentro da conta de outro usuário.
 *
 * Por que ela precisa existir: o retorno só morava na tela de execução de
 * checklist ("Voltar ao Painel do Administrador"). Quem acessava a conta de
 * alguém e não abria um checklist só saía pelo logout — e, pior, nada na tela
 * dizia que aquilo não era a própria conta. Ao passar a levar cliente admin
 * para /admin, isso ficaria grave: você veria um painel de administrador
 * idêntico ao seu, com os dados de outra empresa, sem nenhum aviso.
 *
 * Some sozinha quando não há acesso remoto em curso, então pode ser montada
 * incondicionalmente em qualquer página.
 */
const ALTURA = 34;

export default function BarraDeAcessoRemoto() {
  const navigate = useNavigate();
  const backup = typeof window !== 'undefined' ? localStorage.getItem('firecheck_admin_backup') : null;

  // Sendo fixed, a faixa sai do fluxo e cobriria o topo do painel — o logo e o
  // começo do menu ficariam escondidos atrás dela. O empurrão vai no body
  // porque o container do painel é flex em linha: um espaçador ali dentro
  // viraria mais uma coluna, que é justamente o defeito que se está corrigindo.
  useEffect(() => {
    if (!backup) return;
    const anterior = document.body.style.paddingTop;
    document.body.style.paddingTop = `${ALTURA}px`;
    return () => { document.body.style.paddingTop = anterior; };
  }, [backup]);

  if (!backup) return null;

  let alvo = '';
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    alvo = u.name || u.email || '';
  } catch { /* nome é enfeite: sem ele a barra ainda cumpre o papel */ }

  const voltar = () => {
    localStorage.setItem('user', backup);
    localStorage.removeItem('firecheck_admin_backup');
    localStorage.removeItem('firecheck_impersonated');
    // Recarrega em vez de navegar: as telas leem o usuário do localStorage no
    // primeiro render, então navegar deixaria a conta antiga em memória.
    window.location.href = '/admin';
  };

  return (
    /* position:fixed, não sticky.
       A raiz do painel é um `display:flex` em linha, então uma faixa em fluxo
       normal vira COLUNA: ela ocupou toda a lateral esquerda e empurrou o
       sistema inteiro para o lado. Fixed a tira do fluxo — ela deixa de ser
       item do flex e passa a ocupar a largura da janela, como uma barra de
       aviso deve fazer. */
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '12px', flexWrap: 'wrap',
      padding: '6px 16px',
      backgroundColor: '#f59e0b', color: '#1f2937',
      fontSize: '0.82rem', fontWeight: 'bold',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span>
        👁️ Você está vendo a conta {alvo ? <>de <strong>{alvo}</strong></> : 'de outro usuário'} — as alterações afetam a conta dela.
      </span>
      <button
        onClick={voltar}
        style={{
          padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          backgroundColor: '#1f2937', color: '#fff', fontWeight: 'bold', fontSize: '0.8rem',
        }}
      >
        🛡️ Voltar para a minha conta
      </button>
    </div>
  );
}
