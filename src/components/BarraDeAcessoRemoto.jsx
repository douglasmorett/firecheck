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
export default function BarraDeAcessoRemoto() {
  const navigate = useNavigate();
  const backup = typeof window !== 'undefined' ? localStorage.getItem('firecheck_admin_backup') : null;

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
    <div style={{
      position: 'sticky', top: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '12px', flexWrap: 'wrap',
      padding: '8px 16px',
      backgroundColor: '#f59e0b', color: '#1f2937',
      fontSize: '0.85rem', fontWeight: 'bold',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
