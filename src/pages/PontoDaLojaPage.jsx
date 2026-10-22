import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, CheckCircle, AlertTriangle, Lock, X } from 'lucide-react';
import API_URL from '../api';
import { carregarReconhecimento, lerRostos, escolherPessoa, distancia } from '../utils/rosto';
import { lerQuiosque, esquecerQuiosque } from '../utils/quiosque';

// ── Ponto da loja ──────────────────────────────────────────────────────────
// Um tablet/celular da loja vira relógio de ponto: a tela é a câmera; quem
// chega olha para ela, o aparelho reconhece o rosto (comparação aqui mesmo,
// contra os descritores da equipe), pede uma virada de rosto (prova de vida
// simples: foto parada não vira) e pergunta "Olá, Ana! Registrar Saída
// almoço?". Confirmado, a batida vai para o servidor com a selfie, o GPS do
// aparelho e o descritor de agora — o servidor confere o rosto de novo.
//
// O aparelho não tem login de ninguém: só o token do quiosque, que serve
// apenas para as rotas /api/quiosque daquela loja.

const PASSO_MS = 200;               // intervalo entre leituras da câmera
const QUADROS_PARA_RECONHECER = 3;  // o mesmo rosto em quadros seguidos
const VIRADA_DA_PROVA = 0.12;       // quanto a cabeça precisa girar (ver viradaDoRosto)
const TEMPO_DA_PROVA_MS = 8000;
const TEMPO_PARA_CONFIRMAR_MS = 20000;
const ROSTO_MINIMO = 0.18;          // fração da largura do vídeo; menor = longe demais
const RECARREGAR_EQUIPE_MS = 5 * 60 * 1000;

const MSG_INICIAL = 'Olhe para a câmera para bater o ponto';

function selfieDoVideo(video) {
  const largura = Math.min(600, video.videoWidth);
  const altura = Math.round(video.videoHeight * (largura / video.videoWidth));
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  const ctx = c.getContext('2d');
  // Espelhada, como a pessoa se vê na tela (igual à selfie do PontoPage).
  ctx.translate(largura, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, largura, altura);
  return c.toDataURL('image/jpeg', 0.6);
}

const horaDoRegistro = (r) => String(r?.timestamp || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/)?.[1] || '';

export default function PontoDaLojaPage() {
  const navigate = useNavigate();
  const [quiosque] = useState(() => lerQuiosque());
  const [fase, setFase] = useState('carregando'); // carregando | procurando | prova | confirmar | enviando | feito | revogado | erro
  const [mensagem, setMensagem] = useState('Preparando o reconhecimento facial…');
  const [loja, setLoja] = useState('');
  const [pessoa, setPessoa] = useState(null);
  const [rotulo, setRotulo] = useState('');
  const [agora, setAgora] = useState(new Date());
  const [saindo, setSaindo] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const equipeRef = useRef([]);
  const faseRef = useRef('carregando');
  const candRef = useRef(null);
  const ignorarRef = useRef({});
  const desconhecidoRef = useRef(0);
  const gpsRef = useRef({});
  const timerRef = useRef(null);
  const prazoRef = useRef(null);
  // Depois de um aviso ("não deu para confirmar", "não sou eu") a tela espera
  // um pouco antes de reconhecer de novo: senão o aviso some no quadro seguinte.
  const pausaRef = useRef(0);

  const mudarFase = useCallback((f, msg) => {
    faseRef.current = f;
    setFase(f);
    if (msg !== undefined) setMensagem(msg);
  }, []);

  const chamar = useCallback(async (caminho, opcoes = {}) => {
    const res = await fetch(`${API_URL}${caminho}`, {
      ...opcoes,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (quiosque?.token || '') },
    });
    const dados = await res.json().catch(() => ({}));
    if (res.status === 401) {
      // Desativado pelo gestor: este aparelho não bate mais ponto.
      esquecerQuiosque();
      mudarFase('revogado', dados.error || 'Este aparelho não é mais o ponto da loja.');
    }
    return { ok: res.ok, status: res.status, dados };
  }, [quiosque, mudarFase]);

  const carregarEquipe = useCallback(async () => {
    const r = await chamar('/api/quiosque/rostos');
    if (r.ok) {
      equipeRef.current = (r.dados.funcionarios || []).map(f => ({
        id: f.id, nome: f.nome, descritor: typeof f.descritor === 'string' ? JSON.parse(f.descritor) : f.descritor,
      }));
      setLoja(r.dados.loja || '');
    } else if (r.status !== 401) {
      mudarFase('erro', r.dados.error || 'Não deu para carregar a equipe.');
    }
    return r.ok;
  }, [chamar, mudarFase]);

  const voltarAProcurar = useCallback((msg = MSG_INICIAL, { pausa = 0 } = {}) => {
    candRef.current = null;
    pausaRef.current = Date.now() + pausa;
    desconhecidoRef.current = 0;
    clearTimeout(prazoRef.current);
    setPessoa(null);
    setRotulo('');
    mudarFase('procurando', msg);
  }, [mudarFase]);

  // Um quadro da câmera: identifica (de frente), depois prova de vida (virada).
  const analisarQuadro = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    const f = faseRef.current;
    if (f !== 'procurando' && f !== 'prova') return;
    const rostos = await lerRostos(video, { tamanho: 320 });
    if (faseRef.current !== f) return; // mudou enquanto lia

    if (f === 'procurando') {
      if (Date.now() < pausaRef.current) return;
      if (rostos.length === 0) { candRef.current = null; setMensagem(MSG_INICIAL); return; }
      if (rostos.length > 1) { candRef.current = null; setMensagem('Uma pessoa por vez, por favor'); return; }
      const r = rostos[0];
      if (r.tamanho < ROSTO_MINIMO) { setMensagem('Chegue mais perto da câmera'); return; }
      if (Math.abs(r.virada) > 0.1) { setMensagem('Olhe de frente para a câmera'); return; }
      const agoraMs = Date.now();
      const ignorar = Object.entries(ignorarRef.current).filter(([, ate]) => ate > agoraMs).map(([id]) => Number(id));
      const escolha = escolherPessoa(r.descritor, equipeRef.current, { ignorar });
      if (escolha.pessoa) {
        desconhecidoRef.current = 0;
        const c = candRef.current;
        if (c && c.pessoa.id === escolha.pessoa.id) c.seguidos += 1;
        else candRef.current = { pessoa: escolha.pessoa, seguidos: 1, melhor: Infinity };
        const cand = candRef.current;
        // Guarda o quadro mais parecido: é a selfie e o descritor da batida.
        if (escolha.distancia < cand.melhor) {
          cand.melhor = escolha.distancia;
          cand.descritor = r.descritor;
          cand.selfie = selfieDoVideo(video);
        }
        setMensagem('Reconhecendo…');
        if (cand.seguidos >= QUADROS_PARA_RECONHECER) {
          cand.provaDesde = Date.now();
          cand.viradaMin = r.virada;
          cand.viradaMax = r.virada;
          mudarFase('prova', 'Agora vire o rosto devagar para um lado');
        }
      } else if (escolha.ambiguo) {
        candRef.current = null;
        setMensagem('Chegue mais perto e olhe de frente para a câmera');
      } else {
        candRef.current = null;
        desconhecidoRef.current += 1;
        if (desconhecidoRef.current >= 6) setMensagem('Rosto não reconhecido. Bata o ponto pela sua própria conta ou fale com o gestor.');
      }
      return;
    }

    // Prova de vida: a mesma pessoa, girando a cabeça.
    const cand = candRef.current;
    if (!cand) { voltarAProcurar(); return; }
    if (Date.now() - cand.provaDesde > TEMPO_DA_PROVA_MS) {
      voltarAProcurar('Não deu para confirmar. Olhe de frente e depois vire o rosto devagar.', { pausa: 3000 });
      return;
    }
    if (rostos.length !== 1) return;
    const r = rostos[0];
    // De lado o descritor se afasta um pouco do cadastrado; longe demais é
    // outra pessoa que entrou na frente.
    if (distancia(r.descritor, cand.pessoa.descritor) > 0.7) { voltarAProcurar('Uma pessoa por vez, por favor'); return; }
    cand.viradaMin = Math.min(cand.viradaMin, r.virada);
    cand.viradaMax = Math.max(cand.viradaMax, r.virada);
    if (cand.viradaMax - cand.viradaMin >= VIRADA_DA_PROVA) {
      mudarFase('confirmar', '');
      setPessoa(cand.pessoa);
      const prox = await chamar(`/api/quiosque/proxima?userId=${cand.pessoa.id}`);
      if (!prox.ok) { if (prox.status !== 401) voltarAProcurar(prox.dados.error || MSG_INICIAL); return; }
      setRotulo(prox.dados.rotulo);
      // Ninguém confirmou (a pessoa foi embora): volta a procurar.
      prazoRef.current = setTimeout(() => { if (faseRef.current === 'confirmar') voltarAProcurar(); }, TEMPO_PARA_CONFIRMAR_MS);
    }
  }, [chamar, mudarFase, voltarAProcurar]);

  // Câmera, modelos, equipe e GPS.
  useEffect(() => {
    if (!quiosque) { mudarFase('revogado', 'Este aparelho não está configurado como ponto da loja.'); return undefined; }
    let vivo = true;
    let travaDaTela = null;
    (async () => {
      try {
        const [okEquipe] = await Promise.all([carregarEquipe(), carregarReconhecimento()]);
        if (!vivo || !okEquipe) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (!vivo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        voltarAProcurar();
      } catch (e) {
        if (vivo) mudarFase('erro', e?.name === 'NotAllowedError'
          ? 'Sem permissão para a câmera. Libere a câmera para o FireCheck nas configurações do aparelho.'
          : 'Não deu para abrir a câmera ou o reconhecimento facial neste aparelho.');
      }
      // Tablet da recepção não pode apagar a tela no meio do expediente.
      try { travaDaTela = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte: segue */ }
    })();

    // GPS do aparelho: uma leitura e o endereço; o tablet não sai do lugar.
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      gpsRef.current = { latitude, longitude, accuracy };
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const d = await r.json();
        if (d?.display_name) gpsRef.current.address = d.display_name;
      } catch { /* sem endereço, fica a coordenada */ }
    }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10 * 60 * 1000 });

    const ciclo = async () => {
      try { await analisarQuadro(); } catch { /* um quadro ruim não para o ponto */ }
      if (vivo) timerRef.current = setTimeout(ciclo, PASSO_MS);
    };
    timerRef.current = setTimeout(ciclo, PASSO_MS);
    const equipeDeNovo = setInterval(() => carregarEquipe(), RECARREGAR_EQUIPE_MS);
    const relogio = setInterval(() => setAgora(new Date()), 15000);

    return () => {
      vivo = false;
      clearTimeout(timerRef.current);
      clearTimeout(prazoRef.current);
      clearInterval(equipeDeNovo);
      clearInterval(relogio);
      streamRef.current?.getTracks().forEach(t => t.stop());
      travaDaTela?.release?.().catch?.(() => {});
    };
  }, [quiosque, carregarEquipe, analisarQuadro, voltarAProcurar, mudarFase]);

  const confirmar = async () => {
    const cand = candRef.current;
    if (!cand) return;
    clearTimeout(prazoRef.current);
    mudarFase('enviando', 'Registrando…');
    const r = await chamar('/api/quiosque/bater', {
      method: 'POST',
      body: JSON.stringify({
        userId: cand.pessoa.id,
        descritor: cand.descritor,
        selfie: cand.selfie,
        latitude: gpsRef.current.latitude ?? null,
        longitude: gpsRef.current.longitude ?? null,
        accuracy: gpsRef.current.accuracy ?? null,
        address: gpsRef.current.address || null,
        deviceInfo: { userAgent: navigator.userAgent, platform: navigator.platform || 'unknown', screenWidth: window.screen.width, screenHeight: window.screen.height, timestamp: new Date().toISOString() },
      }),
    });
    if (r.status === 401) return;
    // Esta pessoa não é oferecida de novo logo em seguida (fila no relógio).
    ignorarRef.current[cand.pessoa.id] = Date.now() + 60000;
    if (r.ok) {
      mudarFase('feito', `${rotulo || 'Ponto'} registrada às ${horaDoRegistro(r.dados.record)}, ${cand.pessoa.nome.split(' ')[0]}!`);
    } else {
      mudarFase('feito', r.dados.error || 'Não deu para registrar. Tente de novo.');
    }
    setTimeout(() => voltarAProcurar(), 4000);
  };

  const naoSouEu = () => {
    const cand = candRef.current;
    if (cand) ignorarRef.current[cand.pessoa.id] = Date.now() + 20000;
    voltarAProcurar('Tudo bem. Olhe de novo para a câmera ou bata o ponto pela sua própria conta.', { pausa: 3000 });
  };

  const irParaLogin = () => { esquecerQuiosque(); navigate('/login', { replace: true }); };

  const corDaFase = fase === 'feito' ? '#10B981' : fase === 'erro' || fase === 'revogado' ? '#EF4444' : '#8B5CF6';
  const primeiroNome = pessoa?.nome?.split(' ')[0] || '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1020', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><ScanFace size={22} color="#8B5CF6" /> Ponto da loja</div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{loja}{quiosque?.nome ? ` · ${quiosque.nome}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
        </div>
      </div>

      <div style={{ position: 'relative', width: 'min(92vw, 560px)', aspectRatio: '4 / 3', borderRadius: '24px', overflow: 'hidden', border: `4px solid ${corDaFase}`, background: '#000', boxShadow: `0 0 40px ${corDaFase}55` }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: '46%', height: '72%', borderRadius: '50%', border: '3px dashed rgba(255,255,255,0.45)' }} />
        </div>
        {(fase === 'confirmar' || fase === 'enviando') && pessoa && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,16,32,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800 }} data-testid="quiosque-pessoa">Olá, {primeiroNome}!</div>
            <div style={{ fontSize: '1.2rem' }}>Registrar <strong data-testid="quiosque-rotulo">{rotulo || '…'}</strong>?</div>
            <button onClick={confirmar} disabled={fase === 'enviando' || !rotulo} data-testid="quiosque-confirmar"
              style={{ width: '100%', maxWidth: '360px', padding: '20px', fontSize: '1.3rem', fontWeight: 800, borderRadius: '16px', border: 'none', background: '#10B981', color: '#fff', cursor: 'pointer' }}>
              {fase === 'enviando' ? 'Registrando…' : 'Confirmar'}
            </button>
            <button onClick={naoSouEu} disabled={fase === 'enviando'} data-testid="quiosque-nao-sou-eu"
              style={{ padding: '12px 22px', fontSize: '1rem', borderRadius: '12px', border: '1px solid #475569', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
              Não sou eu
            </button>
          </div>
        )}
      </div>

      <div data-testid="quiosque-mensagem" style={{ marginTop: '22px', minHeight: '2.4em', fontSize: '1.35rem', fontWeight: 600, textAlign: 'center', color: fase === 'feito' ? '#34d399' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '560px' }}>
        {fase === 'feito' && <CheckCircle size={26} />}
        {(fase === 'erro' || fase === 'revogado') && <AlertTriangle size={26} color="#f87171" />}
        {mensagem}
      </div>
      {fase === 'prova' && <div style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Isso confirma que é você, e não uma foto.</div>}
      {fase === 'revogado' && (
        <button onClick={irParaLogin} style={{ marginTop: '16px', padding: '12px 22px', borderRadius: '12px', border: 'none', background: '#8B5CF6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Ir para o login</button>
      )}

      {fase !== 'revogado' && (
        <button onClick={() => setSaindo(true)} style={{ position: 'absolute', bottom: 16, right: 16, background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Lock size={14} /> Sair do ponto da loja
        </button>
      )}
      {saindo && <SairDoQuiosque chamar={chamar} onFechar={() => setSaindo(false)} onSaiu={irParaLogin} />}
    </div>
  );
}

// Só o dono ou um gestor tira o aparelho do modo ponto da loja.
function SairDoQuiosque({ chamar, onFechar, onSaiu }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const sair = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    const r = await chamar('/api/quiosque/sair', { method: 'POST', body: JSON.stringify({ email, senha }) });
    setEnviando(false);
    if (r.ok) onSaiu();
    else if (r.status !== 401) setErro(r.dados.error || 'Não deu para sair.');
  };
  const campo = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 10 }}>
      <form onSubmit={sair} style={{ width: '100%', maxWidth: '380px', background: '#1e293b', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Sair do ponto da loja</strong>
          <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>E-mail e senha do dono ou de um gestor da loja. O aparelho deixa de ser o ponto da loja.</p>
        <input style={campo} type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" required />
        <input style={campo} type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="off" required />
        {erro && <div style={{ color: '#f87171', fontSize: '0.88rem' }}>{erro}</div>}
        <button type="submit" disabled={enviando} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {enviando ? 'Conferindo…' : 'Sair do modo ponto da loja'}
        </button>
      </form>
    </div>
  );
}
