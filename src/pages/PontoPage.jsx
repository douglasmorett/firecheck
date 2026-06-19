import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Camera, Clock, CheckCircle, AlertTriangle, LogOut, Flame, Navigation, Smartphone, ArrowLeft, RefreshCw, X } from 'lucide-react';
import API_URL from '../api';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
});

const handle401 = (res, navigate) => {
  if (res.status === 401) {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  }
  return res;
};

// Comprime a selfie para max 600px de largura, JPEG 60% qualidade
function compressSelfie(canvas) {
  const maxWidth = 600;
  const quality = 0.6;
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  let { width, height } = canvas;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  tempCanvas.width = width;
  tempCanvas.height = height;
  ctx.drawImage(canvas, 0, 0, width, height);
  return tempCanvas.toDataURL('image/jpeg', quality);
}

// Retorna informações do dispositivo
function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'pt-BR',
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timestamp: new Date().toISOString(),
  };
}

export default function PontoPage() {
  const navigate = useNavigate();

  // Usuário logado
  const [user, setUser] = useState(null);

  // GPS
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [address, setAddress] = useState('Buscando endereço...');
  const [gpsLoading, setGpsLoading] = useState(true);

  // Câmera / Selfie
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieData, setSelfieData] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Registros do dia
  const [todayRecords, setTodayRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Estado de envio
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [apiError, setApiError] = useState(null);

  // ─── Autenticação ───
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(savedUser));
  }, [navigate]);

  // ─── Geolocalização ───
  const fetchGPS = useCallback(() => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolocalização não é suportada pelo seu navegador.');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setLatitude(lat);
        setLongitude(lng);
        setAccuracy(acc);
        setGpsLoading(false);
        // Reverse geocoding via Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          } else {
            setAddress('Endereço não encontrado');
          }
        } catch {
          setAddress('Erro ao buscar endereço');
        }
      },
      (err) => {
        setGpsLoading(false);
        switch (err.code) {
          case 1:
            setGpsError('Permissão de localização negada. Ative nas configurações.');
            break;
          case 2:
            setGpsError('Posição indisponível. Verifique o GPS do dispositivo.');
            break;
          case 3:
            setGpsError('Tempo esgotado ao buscar localização. Tente novamente.');
            break;
          default:
            setGpsError('Erro desconhecido ao buscar localização.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    fetchGPS();
  }, [fetchGPS]);

  // ─── Buscar registros de hoje ───
  const fetchTodayRecords = useCallback(async () => {
    if (!user) return;
    setLoadingRecords(true);
    try {
      const res = await fetch(
        `${API_URL}/api/ponto/today?userId=${encodeURIComponent(user.id)}&store=${encodeURIComponent(user.store)}`,
        { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') } }
      );
      handle401(res, navigate);
      const data = await res.json();
      if (data && Array.isArray(data.records)) {
        setTodayRecords(data.records);
      }
    } catch (err) {
      console.error('Erro ao buscar registros:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTodayRecords();
  }, [fetchTodayRecords]);

  // ─── Câmera ───
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Espelha a imagem horizontalmente para parecer natural
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const compressed = compressSelfie(canvas);
    setSelfieData(compressed);
    stopCamera();
  };

  // Limpa a câmera ao desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ─── Registrar Ponto ───
  const handleRegistrar = async (type) => {
    setApiError(null);

    // Validações
    if (!latitude || !longitude) {
      setApiError('GPS não disponível. Aguarde a localização ou tente atualizar.');
      return;
    }
    if (accuracy > 200) {
      setApiError(`Precisão do GPS muito baixa (${Math.round(accuracy)}m). Vá para um local aberto e tente novamente.`);
      return;
    }
    if (!selfieData) {
      setApiError('Tire uma selfie antes de registrar o ponto.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/ponto`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          store: user.store,
          type,
          latitude,
          longitude,
          accuracy,
          selfie: selfieData,
          address,
          deviceInfo: getDeviceInfo(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || data.message || 'Erro ao registrar ponto.');
        setSubmitting(false);
        return;
      }
      // Sucesso
      setToast(type === 'entrada' ? '✅ Entrada registrada com sucesso!' : '✅ Saída registrada com sucesso!');
      setSelfieData(null);
      setTimeout(() => setToast(null), 4000);
      await fetchTodayRecords();
    } catch (err) {
      console.error('Erro ao registrar ponto:', err);
      setApiError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('firecheck_token');
    navigate('/login');
  };

  // ─── Helpers de exibição ───
  const getAccuracyColor = (acc) => {
    if (acc == null) return 'var(--text-muted)';
    if (acc < 30) return 'var(--success)';
    if (acc <= 100) return '#eab308';
    return 'var(--error)';
  };

  const getAccuracyLabel = (acc) => {
    if (acc == null) return 'Indisponível';
    if (acc < 30) return 'Excelente';
    if (acc <= 100) return 'Moderada';
    return 'Baixa';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const canRegister = latitude && longitude && accuracy <= 200 && selfieData && !submitting;

  // ─── Loading ───
  if (!user) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '600px', paddingBottom: '48px' }}>

      {/* ═══ Toast de Sucesso ═══ */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--success)', color: '#fff', padding: '14px 28px',
          borderRadius: '12px', fontSize: '0.95rem', fontWeight: '600',
          zIndex: 9999, boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
          animation: 'fadeIn 0.3s ease-out', display: 'flex', alignItems: 'center', gap: '8px',
          maxWidth: 'calc(100vw - 48px)',
        }}>
          <CheckCircle size={18} /> {toast}
        </div>
      )}

      {/* ═══ Header ═══ */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/funcionario')}
            style={{
              background: 'none', border: '1px solid var(--border-color)',
              borderRadius: '10px', padding: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-main)',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
              <Flame size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Ponto Digital</h2>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{user.store}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', color: 'var(--error)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.85rem', fontWeight: 'bold',
          }}
        >
          Sair <LogOut size={16} />
        </button>
      </header>

      {/* ═══ Card do Usuário ═══ */}
      <div style={{
        backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '14px',
        marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 69, 0, 0.1)', padding: '12px',
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Smartphone size={22} color="var(--primary)" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{user.name}</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {user.role === 'admin' ? 'Administrador' : 'Funcionário'} • {user.store}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)' }}>
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </p>
        </div>
      </div>

      {/* ═══ Erro da API ═══ */}
      {apiError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--error)',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <AlertTriangle size={18} color="var(--error)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--error)', fontWeight: '600' }}>{apiError}</p>
          </div>
          <button onClick={() => setApiError(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '0',
          }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══ GPS / Localização ═══ */}
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '20px',
        marginBottom: '20px', border: '1px solid var(--border-color)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '14px',
        }}>
          <h4 style={{
            margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Navigation size={14} /> Localização GPS
          </h4>
          <button onClick={fetchGPS} style={{
            background: 'none', border: '1px solid var(--border-color)',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
            fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex',
            alignItems: 'center', gap: '4px',
          }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        {gpsLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="animate-spin" style={{
              width: '28px', height: '28px', border: '3px solid var(--primary)',
              borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 10px',
            }}></div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Buscando localização...</p>
          </div>
        ) : gpsError ? (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: '10px',
            padding: '16px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <AlertTriangle size={20} color="var(--error)" />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--error)' }}>{gpsError}</p>
          </div>
        ) : (
          <>
            {/* Coordenadas e Precisão */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
              marginBottom: '14px',
            }}>
              <div style={{
                backgroundColor: 'var(--bg-color)', borderRadius: '10px', padding: '12px',
              }}>
                <p style={{ margin: '0 0 2px 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <MapPin size={10} style={{ verticalAlign: 'middle' }} /> Coordenadas
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', fontFamily: 'monospace' }}>
                  {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                </p>
              </div>
              <div style={{
                backgroundColor: 'var(--bg-color)', borderRadius: '10px', padding: '12px',
              }}>
                <p style={{ margin: '0 0 2px 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Precisão
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: getAccuracyColor(accuracy),
                    boxShadow: `0 0 6px ${getAccuracyColor(accuracy)}`,
                  }}></div>
                  <p style={{
                    margin: 0, fontSize: '0.8rem', fontWeight: '600',
                    color: getAccuracyColor(accuracy),
                  }}>
                    {accuracy != null ? `${Math.round(accuracy)}m` : '—'} • {getAccuracyLabel(accuracy)}
                  </p>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div style={{
              backgroundColor: 'var(--bg-color)', borderRadius: '10px', padding: '12px',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
            }}>
              <MapPin size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                {address}
              </p>
            </div>

            {/* Alerta de precisão */}
            {accuracy > 100 && (
              <div style={{
                marginTop: '12px', backgroundColor: accuracy > 200 ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
                borderRadius: '8px', padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: '8px',
                border: `1px solid ${accuracy > 200 ? 'var(--error)' : '#eab308'}`,
              }}>
                <AlertTriangle size={14} color={accuracy > 200 ? 'var(--error)' : '#eab308'} />
                <p style={{
                  margin: 0, fontSize: '0.78rem',
                  color: accuracy > 200 ? 'var(--error)' : '#eab308',
                }}>
                  {accuracy > 200
                    ? 'Precisão insuficiente para registro. Vá para um local aberto.'
                    : 'Precisão moderada. Tente um local com melhor sinal GPS.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ Câmera / Selfie ═══ */}
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '20px',
        marginBottom: '20px', border: '1px solid var(--border-color)',
      }}>
        <h4 style={{
          margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '1px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Camera size={14} /> Selfie de Verificação
        </h4>

        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {cameraError && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.06)', borderRadius: '10px',
            padding: '14px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertTriangle size={16} color="var(--error)" />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--error)' }}>{cameraError}</p>
          </div>
        )}

        {selfieData ? (
          /* Selfie capturada */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              position: 'relative', display: 'inline-block',
              borderRadius: '12px', overflow: 'hidden',
              border: '3px solid var(--success)', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
            }}>
              <img
                src={selfieData}
                alt="Selfie capturada"
                style={{
                  width: '100%', maxWidth: '300px', display: 'block',
                  borderRadius: '9px',
                }}
              />
              <div style={{
                position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'var(--success)', color: '#fff', padding: '4px 14px',
                borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <CheckCircle size={12} /> Foto capturada
              </div>
            </div>
            <button
              onClick={() => { setSelfieData(null); startCamera(); }}
              style={{
                marginTop: '12px', background: 'none', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '8px 16px', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex',
                alignItems: 'center', gap: '6px', margin: '12px auto 0',
              }}
            >
              <RefreshCw size={14} /> Tirar novamente
            </button>
          </div>
        ) : cameraActive ? (
          /* Câmera ativa */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              position: 'relative', borderRadius: '12px', overflow: 'hidden',
              border: '2px solid var(--primary)', display: 'inline-block',
              maxWidth: '100%',
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%', maxWidth: '400px', display: 'block',
                  transform: 'scaleX(-1)', borderRadius: '10px',
                }}
              />
              {/* Overlay com guia circular */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: '160px', height: '160px', borderRadius: '50%',
                  border: '2px dashed rgba(255,255,255,0.5)',
                }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px' }}>
              <button
                onClick={capturePhoto}
                style={{
                  backgroundColor: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: '60px', height: '60px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(255, 77, 0, 0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Camera size={24} />
              </button>
              <button
                onClick={stopCamera}
                style={{
                  backgroundColor: 'transparent', border: '1px solid var(--border-color)',
                  borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* Botão para abrir câmera */
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              backgroundColor: 'var(--bg-color)', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed var(--border-color)',
            }}>
              <Camera size={32} color="var(--text-muted)" />
            </div>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tire uma selfie para confirmar sua identidade
            </p>
            <button
              onClick={startCamera}
              style={{
                backgroundColor: 'rgba(255, 77, 0, 0.1)', color: 'var(--primary)',
                border: '1px solid var(--primary)', borderRadius: '10px',
                padding: '10px 24px', cursor: 'pointer', fontSize: '0.9rem',
                fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px',
              }}
            >
              <Camera size={16} /> Abrir Câmera
            </button>
          </div>
        )}
      </div>

      {/* ═══ Botões de Registro ═══ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
        marginBottom: '24px',
      }}>
        {/* Botão Entrada */}
        <button
          onClick={() => handleRegistrar('entrada')}
          disabled={!canRegister}
          style={{
            backgroundColor: canRegister ? 'var(--success)' : 'rgba(16, 185, 129, 0.3)',
            color: '#fff', border: 'none', borderRadius: '14px',
            padding: '22px 16px', cursor: canRegister ? 'pointer' : 'not-allowed',
            fontSize: '1rem', fontWeight: '700', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '8px',
            boxShadow: canRegister ? '0 6px 24px rgba(16, 185, 129, 0.3)' : 'none',
            transition: 'all 0.2s ease', opacity: canRegister ? 1 : 0.6,
          }}
        >
          <Clock size={28} />
          Registrar Entrada
        </button>

        {/* Botão Saída */}
        <button
          onClick={() => handleRegistrar('saida')}
          disabled={!canRegister}
          style={{
            backgroundColor: canRegister ? 'var(--error)' : 'rgba(239, 68, 68, 0.3)',
            color: '#fff', border: 'none', borderRadius: '14px',
            padding: '22px 16px', cursor: canRegister ? 'pointer' : 'not-allowed',
            fontSize: '1rem', fontWeight: '700', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '8px',
            boxShadow: canRegister ? '0 6px 24px rgba(239, 68, 68, 0.3)' : 'none',
            transition: 'all 0.2s ease', opacity: canRegister ? 1 : 0.6,
          }}
        >
          <LogOut size={28} />
          Registrar Saída
        </button>
      </div>

      {/* Requisitos pendentes */}
      {!canRegister && !submitting && (
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.06)', borderRadius: '10px',
          padding: '12px 16px', marginBottom: '24px',
          border: '1px solid rgba(234, 179, 8, 0.2)',
        }}>
          <p style={{
            margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: '600',
            color: '#eab308', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <AlertTriangle size={14} /> Requisitos para registro:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <li style={{
              color: latitude && longitude ? 'var(--success)' : 'var(--text-muted)',
              marginBottom: '4px',
            }}>
              {latitude && longitude ? '✓' : '○'} Localização GPS ativada
            </li>
            <li style={{
              color: accuracy && accuracy <= 200 ? 'var(--success)' : 'var(--text-muted)',
              marginBottom: '4px',
            }}>
              {accuracy && accuracy <= 200 ? '✓' : '○'} Precisão GPS ≤ 200m
            </li>
            <li style={{
              color: selfieData ? 'var(--success)' : 'var(--text-muted)',
            }}>
              {selfieData ? '✓' : '○'} Selfie de verificação
            </li>
          </ul>
        </div>
      )}

      {/* Indicador de envio */}
      {submitting && (
        <div style={{
          textAlign: 'center', padding: '16px', marginBottom: '24px',
          backgroundColor: 'var(--bg-card)', borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}>
          <div className="animate-spin" style={{
            width: '28px', height: '28px', border: '3px solid var(--primary)',
            borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 10px',
          }}></div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Registrando ponto...
          </p>
        </div>
      )}

      {/* ═══ Histórico de Hoje ═══ */}
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: '14px', padding: '20px',
        border: '1px solid var(--border-color)',
      }}>
        <h4 style={{
          margin: '0 0 16px 0', fontSize: '0.8rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '1px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Clock size={14} /> Registros de Hoje
        </h4>

        {loadingRecords ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="animate-spin" style={{
              width: '24px', height: '24px', border: '3px solid var(--primary)',
              borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto',
            }}></div>
          </div>
        ) : todayRecords.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '30px', backgroundColor: 'var(--bg-color)',
            borderRadius: '10px', border: '1px dashed var(--border-color)',
          }}>
            <Clock size={28} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nenhum registro hoje
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todayRecords.map((record, index) => (
              <div
                key={record.id || index}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px', backgroundColor: 'var(--bg-color)',
                  borderRadius: '10px',
                  borderLeft: `4px solid ${record.type === 'entrada' ? 'var(--success)' : 'var(--error)'}`,
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  backgroundColor: record.type === 'entrada'
                    ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {record.type === 'entrada'
                    ? <CheckCircle size={18} color="var(--success)" />
                    : <LogOut size={18} color="var(--error)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: 0, fontSize: '0.9rem', fontWeight: '600',
                    textTransform: 'capitalize',
                  }}>
                    {record.type === 'entrada' ? 'Entrada' : 'Saída'}
                  </p>
                  {record.address && (
                    <p style={{
                      margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: '200px',
                    }}>
                      <MapPin size={9} style={{ verticalAlign: 'middle' }} /> {record.address}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                    {formatTime(record.createdAt || record.timestamp || record.created_at)}
                  </p>
                  {record.accuracy && (
                    <p style={{
                      margin: '2px 0 0 0', fontSize: '0.65rem',
                      color: getAccuracyColor(record.accuracy),
                    }}>
                      ±{Math.round(record.accuracy)}m
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Footer ═══ */}
      <footer style={{
        marginTop: '32px', textAlign: 'center', padding: '20px',
        borderTop: '1px solid var(--border-color)',
      }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          FireCheck v1.0 • Ponto Digital com GPS e Verificação Facial
        </p>
      </footer>
    </div>
  );
}
