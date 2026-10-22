import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScanFace, Camera, Image as ImageIcon, Trash2, X, CheckCircle, AlertTriangle, UserCircle } from 'lucide-react';
import API_URL from '../../api';
import { carregarReconhecimento, lerRostos, abrirImagem, MODELO_DO_ROSTO } from '../../utils/rosto';

// Cartão "Ponto da loja (rosto)" na ficha do funcionário (gestor).
//
// O gestor cadastra o rosto aqui, com o funcionário presente: tira a foto pela
// câmera (ou usa uma foto/arquivo), o NAVEGADOR calcula o descritor e só ele
// vai para o servidor, junto do consentimento. Também é aqui que se escolhe
// como a pessoa bate ponto: pela própria conta, só no ponto da loja, ou os dois.

const cabecalhos = (json) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');

const MODOS = [
  ['ambos', 'Pela própria conta e no ponto da loja'],
  ['conta', 'Só pela própria conta'],
  ['loja', 'Só no ponto da loja (rosto)'],
];

export default function RostoDoFuncionario({ employee }) {
  const [info, setInfo] = useState(null); // { rosto, ponto_modo }
  const [termo, setTermo] = useState('');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [salvandoModo, setSalvandoModo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rostos`, { headers: cabecalhos() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(d.error || 'Não deu para ler o cadastro do rosto.'); return; }
      setTermo(d.termo || '');
      setInfo((d.funcionarios || []).find(f => String(f.user_id) === String(employee.id)) || { rosto: null, ponto_modo: 'ambos' });
    } catch {
      setErro('Erro de conexão.');
    }
  }, [employee.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const apagar = async () => {
    if (!window.confirm(`Apagar o rosto de ${employee.name}? Ele deixa de ser reconhecido no ponto da loja até cadastrar de novo.`)) return;
    const res = await fetch(`${API_URL}/api/rostos?userId=${employee.id}`, { method: 'DELETE', headers: cabecalhos() });
    if (!res.ok) { setErro((await res.json().catch(() => ({}))).error || 'Não deu para apagar.'); return; }
    carregar();
  };

  const trocarModo = async (modo) => {
    setSalvandoModo(true);
    setErro('');
    const res = await fetch(`${API_URL}/api/rostos/modo`, { method: 'PUT', headers: cabecalhos(true), body: JSON.stringify({ userId: employee.id, modo }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setErro(d.error || 'Não deu para salvar.');
    await carregar();
    setSalvandoModo(false);
  };

  return (
    <div className="card" style={{ padding: '24px', borderTop: '4px solid #8B5CF6', borderRadius: '20px' }} data-testid="cartao-rosto">
      <h3 style={{ margin: '0 0 14px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ScanFace size={22} color="#8B5CF6" /> Ponto da loja (rosto)
      </h3>
      {erro && <p style={{ margin: '0 0 12px 0', color: 'var(--error)', fontSize: '0.85rem' }}>{erro}</p>}
      {!info ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carregando…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {info.rosto ? (
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }} data-testid="rosto-status">
              <CheckCircle size={16} /> Rosto cadastrado em {dataBR(info.rosto.cadastrado_em)}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }} data-testid="rosto-status">Sem rosto cadastrado.</p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setAberto(true)} style={{ flex: 1, padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Camera size={16} /> {info.rosto ? 'Trocar rosto' : 'Cadastrar rosto'}
            </button>
            {info.rosto && (
              <button onClick={apagar} style={{ padding: '10px 12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={16} /> Apagar rosto
              </button>
            )}
          </div>
          <div>
            <label className="input-label" style={{ fontSize: '0.9rem' }}>Como bate o ponto</label>
            <select className="input-field" value={info.ponto_modo} disabled={salvandoModo} onChange={e => trocarModo(e.target.value)} data-testid="modo-ponto"
              style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '12px' }}>
              {MODOS.map(([valor, nome]) => (
                <option key={valor} value={valor} disabled={valor === 'loja' && !info.rosto}>{nome}{valor === 'loja' && !info.rosto ? ' — cadastre o rosto antes' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {aberto && (
        <CadastroDoRosto employee={employee} termo={termo} onFechar={() => setAberto(false)} onSalvo={() => { setAberto(false); carregar(); }} />
      )}
    </div>
  );
}

function CadastroDoRosto({ employee, termo, onFechar, onSalvo }) {
  const [preparando, setPreparando] = useState(true);
  const [foto, setFoto] = useState(null); // dataURL/URL da imagem escolhida
  const [rosto, setRosto] = useState(null); // { descritor }
  const [aviso, setAviso] = useState('');
  const [autorizou, setAutorizou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [cameraLigada, setCameraLigada] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const arquivoRef = useRef(null);

  // Os modelos (~7 MB) baixam uma vez e ficam no cache do aparelho.
  useEffect(() => {
    carregarReconhecimento().then(() => setPreparando(false)).catch(() => {
      setPreparando(false);
      setAviso('Não deu para carregar o reconhecimento facial neste aparelho.');
    });
  }, []);

  const desligarCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraLigada(false);
  };
  useEffect(() => desligarCamera, []);

  const analisar = async (origem) => {
    setFoto(origem);
    setRosto(null);
    setAviso('Procurando o rosto…');
    try {
      const img = await abrirImagem(origem);
      const achados = await lerRostos(img, { tamanho: 608 });
      if (achados.length === 0) { setAviso('Não achei um rosto nesta foto. Tire outra, de frente e com boa luz.'); return; }
      if (achados.length > 1) { setAviso('Há mais de um rosto na foto. Só o funcionário deve aparecer.'); return; }
      if (achados[0].confianca < 0.6 || Math.abs(achados[0].virada) > 0.12) { setAviso('O rosto não está nítido ou de frente. Tire outra foto olhando para a câmera.'); return; }
      setRosto(achados[0]);
      setAviso('');
    } catch {
      setAviso('Não deu para usar esta foto (o arquivo pode estar protegido). Tire uma pela câmera.');
    }
  };

  const ligarCamera = async () => {
    setAviso('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      setCameraLigada(true);
      setFoto(null);
      setRosto(null);
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      });
    } catch {
      setAviso('Não deu para abrir a câmera. Confira a permissão ou escolha uma foto.');
    }
  };

  const tirarFoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    desligarCamera();
    analisar(c.toDataURL('image/jpeg', 0.9));
  };

  const escolherArquivo = (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => analisar(leitor.result);
    leitor.readAsDataURL(arquivo);
    e.target.value = '';
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/api/rostos`, {
        method: 'POST', headers: cabecalhos(true),
        body: JSON.stringify({ userId: employee.id, descritor: rosto.descritor, consentimento: true, modelo: MODELO_DO_ROSTO })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setAviso(d.error || 'Não deu para salvar.'); setSalvando(false); return; }
      onSalvo();
    } catch {
      setAviso('Erro de conexão.');
      setSalvando(false);
    }
  };

  const botao = { padding: '10px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1 };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', padding: '16px' }}>
      <div className="card animate-fade-up modal-janela" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Cadastrar rosto — {employee.name}</h3>
          <button onClick={() => { desligarCamera(); onFechar(); }} style={{ background: 'var(--bg-main)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }}>
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Com o funcionário presente, de frente para a câmera e com boa luz. Só um código numérico do rosto é guardado, não a foto.
        </p>

        {preparando ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Preparando o reconhecimento facial…</p>
        ) : (
          <>
            <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '14px', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '12px', border: rosto ? '3px solid #10B981' : '1px solid var(--border-color)' }}>
              {cameraLigada ? (
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', transform: 'scaleX(-1)' }} />
              ) : foto ? (
                <img src={foto} alt="Foto do cadastro" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} />
              ) : (
                <UserCircle size={72} color="var(--border-color)" />
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {cameraLigada ? (
                <button className="btn-primary" style={botao} onClick={tirarFoto}><Camera size={16} /> Tirar foto</button>
              ) : (
                <button className="btn-secondary" style={botao} onClick={ligarCamera}><Camera size={16} /> Abrir câmera</button>
              )}
              <button className="btn-secondary" style={botao} onClick={() => arquivoRef.current?.click()}><ImageIcon size={16} /> Escolher foto</button>
              {employee.photo && (
                <button className="btn-secondary" style={botao} onClick={() => { desligarCamera(); analisar(employee.photo); }}><UserCircle size={16} /> Foto do perfil</button>
              )}
              <input ref={arquivoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={escolherArquivo} data-testid="arquivo-rosto" />
            </div>
            {aviso && (
              <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: aviso.startsWith('Procurando') ? 'var(--text-muted)' : 'var(--error)', display: 'flex', gap: '6px' }}>
                {!aviso.startsWith('Procurando') && <AlertTriangle size={16} style={{ flexShrink: 0 }} />} {aviso}
              </p>
            )}
            {rosto && <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#10B981', fontWeight: 600 }}>✓ Rosto encontrado.</p>}

            <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', lineHeight: 1.45 }}>{termo}</p>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={autorizou} onChange={e => setAutorizou(e.target.checked)} style={{ marginTop: '3px' }} data-testid="consentimento" />
                {employee.name} leu e autorizou o uso do rosto para o ponto.
              </label>
            </div>
            <button className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '12px' }} disabled={!rosto || !autorizou || salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : 'Salvar rosto'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
