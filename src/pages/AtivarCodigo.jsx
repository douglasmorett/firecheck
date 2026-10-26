import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, KeyRound, ShieldCheck, CheckCircle2 } from 'lucide-react';
import API_URL from '../api';
import { vendeNoApp } from '../vendaNoApp';

// Resgate do código comprado no Mercado Livre (FC-CHK-... ou FC-PNT-...).
// Nenhum preço aparece aqui. No app nativo a tela só orienta: ativar licença
// dentro do app da loja contraria a App Store (3.1.1) — a ativação é no site.
const PRODUTO_DO_PREFIXO = { CHK: 'Checklist inteligente', PNT: 'Controle de ponto do funcionário' };
const dia = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'sem vencimento');

function produtoDoTexto(texto) {
  const limpo = String(texto || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return limpo.startsWith('FC') ? PRODUTO_DO_PREFIXO[limpo.slice(2, 5)] || null : null;
}

const FUNDO = { 'var(--success)': 'rgba(16, 185, 129, 0.1)', 'var(--error)': 'rgba(239, 68, 68, 0.1)', 'var(--primary)': 'rgba(255, 77, 0, 0.08)' };
const caixa = (cor) => ({ backgroundColor: FUNDO[cor], color: cor === 'var(--primary)' ? 'var(--text-main)' : cor, border: `1px solid ${cor}`, padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.88rem', lineHeight: 1.5 });

export default function AtivarCodigo() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState(params.get('codigo') || '');
  const [modo, setModo] = useState(params.get('email') ? 'existente' : 'nova');
  const [form, setForm] = useState({ empresa: '', nome: '', email: params.get('email') || '', whatsapp: '', senha: '' });
  const [previa, setPrevia] = useState(null);
  const [pronto, setPronto] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const produto = produtoDoTexto(codigo);
  const campo = (k) => ({ value: form[k], onChange: (e) => { setForm({ ...form, [k]: e.target.value }); setPrevia(null); } });

  if (!vendeNoApp) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '32px', textAlign: 'center' }}>
          <KeyRound size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '12px' }}>Código de ativação</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            O código é ativado no site do FireCheck, pelo navegador. Depois de ativado, entre aqui com o seu e-mail e senha.
          </p>
          <button className="btn" style={{ width: '100%' }} onClick={() => navigate('/login')}>Voltar ao login</button>
        </div>
      </div>
    );
  }

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const corpo = modo === 'nova'
        ? { codigo, modo, ...form }
        : { codigo, modo, email: form.email, senha: form.senha, confirmar: !!previa };
      const r = await fetch(`${API_URL}/api/ativar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const dados = await r.json();
      if (dados.status === 'previa') {
        setPrevia(dados);
      } else if (dados.status === 'success') {
        localStorage.setItem('firecheck_token', dados.token);
        localStorage.setItem('user', JSON.stringify(dados.user));
        localStorage.removeItem('firecheck_admin_backup');
        localStorage.removeItem('firecheck_impersonated');
        setPronto(dados.resumo);
      } else {
        setErro(dados.error || 'Não foi possível ativar o código.');
        setPrevia(null);
      }
    } catch {
      setErro('Erro ao conectar com o servidor.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="animate-fade" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Flame color="white" size={32} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Ativar código</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>O código que veio na sua compra libera o FireCheck na hora.</p>
        </div>

        {pronto ? (
          <div data-testid="ativado">
            <div style={caixa('var(--success)')}>
              <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              <strong>Pronto! {pronto.nomeDoPlano} ativo até {dia(pronto.validade)}.</strong>
              <div style={{ marginTop: 6 }}>{pronto.explicacao}</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Quando os dias acabarem, você continua pela assinatura no site ou com outro código. Nada é cobrado sozinho.
            </p>
            <button className="btn" style={{ width: '100%', padding: '14px' }} onClick={() => navigate('/admin')}>Entrar no painel</button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            {erro && <div data-testid="erro" style={caixa('var(--error)')}>⚠️ {erro}</div>}

            <label className="input-label">Código de ativação</label>
            <input className="input-field" required placeholder="FC-CHK-XXXX-XXXX" value={codigo} autoCapitalize="characters"
              onChange={(e) => { setCodigo(e.target.value); setPrevia(null); }} style={{ fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }} />
            <p style={{ fontSize: '0.8rem', color: produto ? 'var(--success)' : 'var(--text-muted)', margin: '6px 0 20px' }}>
              {produto ? `Código do ${produto}` : 'Está na mensagem da sua compra.'}
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[['nova', 'Sou novo no FireCheck'], ['existente', 'Já tenho conta']].map(([m, rotulo]) => (
                <button key={m} type="button" className={modo === m ? 'btn' : 'btn-secondary'} style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                  onClick={() => { setModo(m); setPrevia(null); setErro(null); }}>{rotulo}</button>
              ))}
            </div>

            {modo === 'nova' && (
              <>
                <label className="input-label">Nome da empresa</label>
                <input className="input-field" required {...campo('empresa')} style={{ marginBottom: '14px' }} />
                <label className="input-label">Seu nome</label>
                <input className="input-field" required {...campo('nome')} style={{ marginBottom: '14px' }} />
                <label className="input-label">WhatsApp (com DDD)</label>
                <input className="input-field" required inputMode="tel" placeholder="21999998888" {...campo('whatsapp')} style={{ marginBottom: '14px' }} />
              </>
            )}
            <label className="input-label">E-mail</label>
            <input className="input-field" type="email" required {...campo('email')} style={{ marginBottom: '14px' }} />
            <label className="input-label">{modo === 'nova' ? 'Crie uma senha (mínimo 6)' : 'Senha'}</label>
            <input className="input-field" type="password" required minLength={modo === 'nova' ? 6 : undefined} {...campo('senha')} style={{ marginBottom: '20px' }} />

            {previa && (
              <div data-testid="previa" style={caixa('var(--primary)')}>
                <div>Hoje: <strong>{previa.antes.nomeDoPlano}</strong>{previa.antes.validade ? `, até ${dia(previa.antes.validade)}` : ''}</div>
                <div>Depois do código: <strong>{previa.depois.nomeDoPlano}</strong>, até <strong>{dia(previa.depois.validade)}</strong></div>
                <div style={{ marginTop: 6 }}>{previa.explicacao}</div>
              </div>
            )}

            <button className="btn" style={{ width: '100%', padding: '14px' }} disabled={enviando}>
              {enviando ? 'Aguarde...' : modo === 'nova' ? 'Criar conta e ativar' : previa ? 'Confirmar ativação' : 'Continuar'}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px', textAlign: 'center', lineHeight: 1.5 }}>
              Sem período de teste e sem cobrança automática.
            </p>
          </form>
        )}

        <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <ShieldCheck size={14} /> Cada código ativa uma conta uma vez só.
        </div>
      </div>
    </div>
  );
}
