/**
 * WhatsApp DA LOJA, na aba Notificações (api › /api/whatsapp-loja).
 *
 * Os avisos (atraso, ausência, checklist, ocorrência, descarte, compras) saem
 * do WhatsApp da própria loja, conectado aqui pelo QR Code — não de um número
 * do FireCheck, que levaria o bloqueio de todas as lojas junto. E aqui a loja
 * diz quais números, além do dono e dos gestores, recebem os avisos.
 *
 * Só o dono conecta e muda os números; o gestor vê o estado.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import API_URL from '../api';

const cabecalhos = () => ({
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + (localStorage.getItem('firecheck_token') || ''),
});

const formatarNumero = (n) => {
  const d = String(n || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n || '';
};

// O servidor guarda com o 55 na frente; na tela, o número como a pessoa digitou.
const paraTela = (lista) => (lista || []).map((d) => ({ ...d, numero: formatarNumero(d.numero) }));

const VERDE = '#25D366';

export default function WhatsappDaLoja() {
  const [estado, setEstado] = useState(null);
  const [qr, setQr] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [destinos, setDestinos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const espera = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/whatsapp-loja`, { headers: cabecalhos() });
      if (!r.ok) return null;
      const j = await r.json();
      setEstado(j);
      setDestinos((atual) => (atual.length ? atual : paraTela(j.destinos)));
      return j;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    carregar();
    return () => clearInterval(espera.current);
  }, [carregar]);

  // Com o QR na tela, pergunta a cada 3 s se o celular já leu (até 3 min).
  const esperarLeitura = () => {
    clearInterval(espera.current);
    const inicio = Date.now();
    espera.current = setInterval(async () => {
      const j = await carregar();
      if (j?.conectado) {
        clearInterval(espera.current);
        setQr(null);
        setCodigo(null);
        setAviso({ ok: true, texto: 'WhatsApp da loja conectado. Os avisos já saem por ele.' });
      } else if (Date.now() - inicio > 180000) {
        clearInterval(espera.current);
        setQr(null);
        setCodigo(null);
        setAviso({ ok: false, texto: 'O QR Code expirou. Clique em Conectar para gerar outro.' });
      }
    }, 3000);
  };

  // novo = true: QR Code novo mesmo com a tela dizendo "Conectado" (a sessão
  // pode estar aberta no servidor e não entregar nada).
  const conectar = async (novo = false) => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fetch(`${API_URL}/api/whatsapp-loja/conectar`, { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ novo }) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) {
        setAviso({ ok: false, texto: j.motivo || j.error || 'Não deu para gerar o QR Code.' });
      } else if (j.conectado) {
        await carregar();
        setAviso({ ok: true, texto: 'WhatsApp da loja conectado.' });
      } else {
        setQr(j.qr || null);
        setCodigo(j.codigo || null);
        esperarLeitura();
      }
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão com o servidor. Tente de novo.' });
    } finally {
      setOcupado(false);
    }
  };

  const desconectar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      await fetch(`${API_URL}/api/whatsapp-loja/desconectar`, { method: 'POST', headers: cabecalhos(), body: '{}' });
      await carregar();
      setAviso({ ok: true, texto: 'WhatsApp da loja desconectado.' });
    } finally {
      setOcupado(false);
    }
  };

  const salvarDestinos = async () => {
    setSalvando(true);
    setAviso(null);
    try {
      const r = await fetch(`${API_URL}/api/whatsapp-loja/destinos`, {
        method: 'PUT', headers: cabecalhos(),
        body: JSON.stringify({ destinos: destinos.filter((d) => String(d.numero || '').trim()) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAviso({ ok: false, texto: j.error || 'Não deu para salvar os números.' });
      } else {
        setDestinos(paraTela(j.destinos));
        setAviso({ ok: true, texto: 'Números salvos. Eles recebem os mesmos avisos que você marcou abaixo.' });
      }
    } finally {
      setSalvando(false);
    }
  };

  if (!estado) return null;
  const podeMexer = !!estado.podeMexer;

  return (
    <div className="card" style={{ padding: '24px', borderLeft: `4px solid ${VERDE}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: VERDE }}>
            📲 WhatsApp da loja (quem envia os avisos)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
            Os avisos saem do WhatsApp da <strong>sua</strong> loja, não de um número do FireCheck. Conecte lendo o QR Code com o
            celular da loja: no WhatsApp, toque em <strong>⋮ › Aparelhos conectados › Conectar um aparelho</strong>.
          </p>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap',
          backgroundColor: estado.conectado ? 'rgba(37,211,102,0.12)' : 'rgba(234,179,8,0.14)',
          color: estado.conectado ? '#15803d' : '#a16207',
        }}>
          {estado.conectado ? `● Conectado${estado.numero ? ` · ${formatarNumero(estado.numero)}` : ''}` : '● Não conectado'}
        </div>
      </div>

      {!estado.conectado && (estado.centralCobre ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '12px 0 0' }}>
          Enquanto não conectar, os avisos continuam saindo pelo número do FireCheck.
        </p>
      ) : (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', fontSize: '0.86rem', backgroundColor: 'rgba(234,179,8,0.12)', border: '1px solid #eab308', color: '#854d0e' }}>
          <strong>Sem o WhatsApp da loja conectado, nenhum aviso chega no WhatsApp</strong> — nem para você, nem para os gestores.
          Os avisos no aplicativo (notificação no celular) continuam normalmente.
        </div>
      ))}

      {estado.conectado && estado.ultimaFalhaEm && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', fontSize: '0.86rem', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', color: '#b91c1c', lineHeight: 1.5 }}>
          <strong>⚠️ O último aviso não saiu</strong>
          {' '}({new Date(estado.ultimaFalhaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          {estado.ultimaFalhaPara ? `, para ${formatarNumero(estado.ultimaFalhaPara)}` : ''}): {estado.ultimaFalha || 'o servidor de WhatsApp recusou o envio.'}
          {' '}Se os avisos pararam para todo mundo, clique em <strong>Conectar de novo</strong> e leia o QR Code com o celular da loja.
        </div>
      )}

      {podeMexer && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          {!estado.conectado ? (
            <button className="btn" onClick={() => conectar()} disabled={ocupado} style={{ padding: '12px 18px', borderRadius: '8px', backgroundColor: VERDE, opacity: ocupado ? 0.7 : 1 }}>
              {ocupado ? 'Gerando o QR Code...' : qr ? 'Gerar outro QR Code' : 'Conectar o WhatsApp da loja'}
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => conectar(true)} disabled={ocupado} style={{ padding: '12px 18px', borderRadius: '8px' }}>
                {ocupado ? 'Gerando o QR Code...' : 'Conectar de novo (novo QR Code)'}
              </button>
              <button className="btn-secondary" onClick={desconectar} disabled={ocupado} style={{ padding: '12px 18px', borderRadius: '8px' }}>
                Desconectar
              </button>
            </>
          )}
        </div>
      )}

      {(qr || codigo) && (
        <div style={{ marginTop: '16px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {qr && <img src={qr} alt="QR Code para conectar o WhatsApp da loja" style={{ width: '240px', maxWidth: '100%', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#fff', padding: '8px' }} />}
          <div style={{ flex: '1 1 220px', fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
            <strong>Leia com o celular da loja:</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
              <li>Abra o WhatsApp da loja.</li>
              <li>Toque em ⋮ (ou Configurações) › <strong>Aparelhos conectados</strong>.</li>
              <li>Toque em <strong>Conectar um aparelho</strong> e aponte para o QR Code.</li>
            </ol>
            {codigo && <p style={{ margin: '8px 0 0' }}>Ou use o código: <strong style={{ letterSpacing: '2px' }}>{codigo}</strong></p>}
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Esta tela atualiza sozinha quando o celular conectar.</p>
          </div>
        </div>
      )}

      {aviso && (
        <div style={{
          marginTop: '14px', padding: '10px 14px', borderRadius: '10px', fontSize: '0.86rem',
          backgroundColor: aviso.ok ? 'rgba(37,211,102,0.10)' : 'rgba(239,68,68,0.10)',
          border: `1px solid ${aviso.ok ? VERDE : '#ef4444'}`, color: aviso.ok ? '#0f766e' : '#b91c1c',
        }}>
          {aviso.texto}
        </div>
      )}

      <div style={{ marginTop: '22px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
        <strong style={{ display: 'block', fontSize: '0.98rem' }}>📞 Quem recebe os avisos</strong>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 12px', lineHeight: 1.5 }}>
          O dono e cada gestor recebem no número que cadastraram (o seu fica logo abaixo). Para mandar também para outros números
          (sócio, gerente da noite), adicione aqui. Eles recebem os mesmos avisos que estão marcados nesta tela.
        </p>
        {destinos.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <input className="input-field" style={{ flex: '1 1 140px' }} placeholder="Nome (ex.: Sócio)" value={d.nome || ''} disabled={!podeMexer}
              onChange={(e) => setDestinos((l) => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
            <input className="input-field" style={{ flex: '1 1 160px' }} placeholder="DDD + número" inputMode="tel" value={d.numero || ''} disabled={!podeMexer}
              onChange={(e) => setDestinos((l) => l.map((x, j) => (j === i ? { ...x, numero: e.target.value } : x)))} />
            {podeMexer && (
              <button type="button" className="btn-secondary" onClick={() => setDestinos((l) => l.filter((_, j) => j !== i))} style={{ padding: '0 14px', borderRadius: '8px' }} aria-label="Remover número">
                ✕
              </button>
            )}
          </div>
        ))}
        {!destinos.length && <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>Nenhum número a mais.</p>}
        {podeMexer && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {destinos.length < 10 && (
              <button type="button" className="btn-secondary" onClick={() => setDestinos((l) => [...l, { nome: '', numero: '' }])} style={{ padding: '10px 14px', borderRadius: '8px' }}>
                + Adicionar número
              </button>
            )}
            <button type="button" className="btn" onClick={salvarDestinos} disabled={salvando} style={{ padding: '10px 14px', borderRadius: '8px', opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando...' : 'Salvar números'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
