import { useState } from 'react';
import { Lock } from 'lucide-react';

/**
 * Troca de senha logado (POST /api/change-password). A API devolve um token novo
 * porque trocar a senha derruba os antigos: guardamos para não deslogar quem trocou.
 */
export default function AlterarSenha({ apiUrl }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { ok, texto }

  const trocar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (nova.length < 8) return setAviso({ ok: false, texto: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    if (nova !== confirma) return setAviso({ ok: false, texto: 'A confirmação não é igual à nova senha.' });
    setEnviando(true); setAviso(null);
    try {
      const res = await fetch(`${apiUrl}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('firecheck_token') || '') },
        body: JSON.stringify({ currentPassword: atual, newPassword: nova }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.token) localStorage.setItem('firecheck_token', data.token);
        setAtual(''); setNova(''); setConfirma('');
        setAviso({ ok: true, texto: 'Senha alterada.' });
      } else if (res.status === 429) {
        setAviso({ ok: false, texto: 'Muitas tentativas. Espere um pouco e tente de novo.' });
      } else {
        setAviso({ ok: false, texto: data.error || data.message || 'Não foi possível trocar a senha.' });
      }
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' });
    }
    setEnviando(false);
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Lock size={20} /> Alterar senha
      </h3>
      <form onSubmit={trocar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
        <div>
          <label className="input-label">Senha atual</label>
          <input type="password" autoComplete="current-password" className="input-field" value={atual} onChange={(e) => setAtual(e.target.value)} required />
        </div>
        <div>
          <label className="input-label">Nova senha (mínimo 8)</label>
          <input type="password" autoComplete="new-password" className="input-field" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={8} />
        </div>
        <div>
          <label className="input-label">Repita a nova senha</label>
          <input type="password" autoComplete="new-password" className="input-field" value={confirma} onChange={(e) => setConfirma(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={enviando} style={{ padding: '12px' }}>{enviando ? 'Salvando...' : 'Trocar senha'}</button>
      </form>
      {aviso && <p role="status" style={{ marginTop: '12px', fontSize: '0.9rem', fontWeight: 600, color: aviso.ok ? 'var(--success)' : 'var(--error)' }}>{aviso.texto}</p>}
    </div>
  );
}
