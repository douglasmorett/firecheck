import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Image as ImageIcon, Trash2, UserCircle } from 'lucide-react';
import API_URL from '../../api';
import Janela from './Janela';
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
    <div className="card pt-card" data-testid="cartao-rosto">
      <div className="pt-card-cab">
        <div>
          <span className="fc-olho-rot">Reconhecimento facial</span>
          <h3>Ponto da loja (rosto)</h3>
        </div>
      </div>
      {erro && <p className="pt-erro">{erro}</p>}
      {!info ? (
        <p className="pt-nota">Carregando…</p>
      ) : (
        <div className="pt-campos">
          {info.rosto ? (
            <span className="fc-selo" style={{ '--c': 'var(--ok)' }} data-testid="rosto-status">
              <i /><span>Rosto cadastrado em <span className="mono">{dataBR(info.rosto.cadastrado_em)}</span></span>
            </span>
          ) : (
            <span className="fc-selo" style={{ '--c': 'var(--text-muted)' }} data-testid="rosto-status"><i /><span>Sem rosto cadastrado.</span></span>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-secondary" onClick={() => setAberto(true)} style={{ flex: 1, padding: '9px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Camera size={14} /> {info.rosto ? 'Trocar rosto' : 'Cadastrar rosto'}
            </button>
            {info.rosto && (
              <button type="button" className="fc-mini-btn perigo" onClick={apagar} style={{ padding: '9px 12px' }}>
                <Trash2 size={13} /> Apagar rosto
              </button>
            )}
          </div>
          <div>
            <label className="input-label">Como bate o ponto</label>
            <select className="input-field" value={info.ponto_modo} disabled={salvandoModo} onChange={e => trocarModo(e.target.value)} data-testid="modo-ponto">
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

  const botao = { padding: '9px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
  const procurando = aviso.startsWith('Procurando');

  return (
    <Janela rotulo="Cadastrar rosto" titulo={employee.name} onFechar={() => { desligarCamera(); onFechar(); }}>
      <p className="pt-nota" style={{ marginBottom: '14px' }}>
        Com o funcionário presente, de frente para a câmera e com boa luz. Só um código numérico do rosto é guardado, não a foto.
      </p>

      {preparando ? (
        <div className="fc-vazio">Preparando o reconhecimento facial…</div>
      ) : (
        <>
          <div className={`pt-camera${rosto ? ' achou' : ''}`}>
            {cameraLigada ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', transform: 'scaleX(-1)' }} />
            ) : foto ? (
              <img src={foto} alt="Foto do cadastro" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} />
            ) : (
              <span className="fc-olho-rot">Sem foto</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {cameraLigada ? (
              <button type="button" className="btn-primary" style={botao} onClick={tirarFoto}><Camera size={14} /> Tirar foto</button>
            ) : (
              <button type="button" className="btn-secondary" style={botao} onClick={ligarCamera}><Camera size={14} /> Abrir câmera</button>
            )}
            <button type="button" className="btn-secondary" style={botao} onClick={() => arquivoRef.current?.click()}><ImageIcon size={14} /> Escolher foto</button>
            {employee.photo && (
              <button type="button" className="btn-secondary" style={botao} onClick={() => { desligarCamera(); analisar(employee.photo); }}><UserCircle size={14} /> Foto do perfil</button>
            )}
            <input ref={arquivoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={escolherArquivo} data-testid="arquivo-rosto" />
          </div>
          {aviso && (procurando
            ? <p className="pt-nota" style={{ marginBottom: '12px' }}>{aviso}</p>
            : <p className="pt-erro" style={{ marginBottom: '12px' }}>{aviso}</p>)}
          {rosto && <p className="pt-ok" style={{ marginBottom: '12px' }}>✓ Rosto encontrado.</p>}

          <div style={{ boxShadow: '0 -1px 0 var(--bg-inset)', paddingTop: '14px', marginBottom: '16px' }}>
            <span className="fc-olho-rot" style={{ marginBottom: '6px' }}>Consentimento (LGPD)</span>
            <p className="pt-termo">{termo}</p>
            <label className="pt-autoriza">
              <input type="checkbox" checked={autorizou} onChange={e => setAutorizou(e.target.checked)} data-testid="consentimento" />
              {employee.name} leu e autorizou o uso do rosto para o ponto.
            </label>
          </div>
          <button type="button" className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.92rem' }} disabled={!rosto || !autorizou || salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar rosto'}
          </button>
        </>
      )}
    </Janela>
  );
}
