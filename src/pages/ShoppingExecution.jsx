import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, CheckCircle, AlertTriangle, Package, Send, ShieldCheck } from 'lucide-react';
import API_URL from '../api';

export default function ShoppingExecution() {
  const { id, shoppingListId } = useParams();
  const targetId = shoppingListId || id;
  const navigate = useNavigate();
  const [listInfo, setListInfo] = useState(null);
  const [items, setItems] = useState([]);
  const [stockValues, setStockValues] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const fetchItems = useCallback(async (user) => {
    if (!targetId) return;
    try {
      // Buscar dados da lista
      const listRes = await fetch(`${API_URL}/api/shopping?store=${encodeURIComponent(user.store || '')}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (listRes.ok) {
        const lists = await listRes.json();
        const found = lists.find(l => String(l.id) === String(targetId));
        if (found) setListInfo(found);
      }

      // Buscar itens da lista
      const itemsRes = await fetch(`${API_URL}/api/shopping/items?listId=${targetId}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '') }
      });
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data);
        
        // Inicializar valores com o estoque atual se houver, ou vazio
        const initialMap = {};
        data.forEach(item => {
          initialMap[item.id] = item.current_stock !== null && item.current_stock !== undefined ? String(item.current_stock) : '';
        });
        setStockValues(initialMap);
      }
    } catch (err) {
      console.error('Erro ao carregar itens da lista de compras:', err);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    const profile = JSON.parse(savedUser);
    setUserProfile(profile);
    fetchItems(profile);
  }, [navigate, fetchItems]);

  const handleStockChange = (itemId, val) => {
    setStockValues(prev => ({ ...prev, [itemId]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userProfile) return;

    setSubmitting(true);
    try {
      const formattedItems = items.map(item => {
        const rawVal = stockValues[item.id];
        const numVal = rawVal !== '' && rawVal !== null && rawVal !== undefined ? parseFloat(rawVal) : 0;
        return {
          id: item.id,
          name: item.name,
          unit: item.unit || 'un',
          minStock: parseFloat(item.min_stock || 0),
          currentStock: numVal
        };
      });

      const res = await fetch(`${API_URL}/api/shopping/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('firecheck_token') || '')
        },
        body: JSON.stringify({
          shoppingListId: targetId,
          employeeName: userProfile.name,
          store: userProfile.store,
          items: formattedItems,
          notes: notes
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResultData(data);
        setSubmitted(true);
      } else {
        alert('Erro ao enviar a conferência de estoque. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao submeter compras:', err);
      alert('Erro de conexão ao enviar dados.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
      </div>
    );
  }

  if (submitted) {
    const belowMinCount = resultData?.belowMinimum?.length || 0;

    return (
      <div className="page-container" style={{ maxWidth: '600px', textAlign: 'center', paddingTop: '40px' }}>
        <div className="card animate-scale" style={{ padding: '36px 24px', borderRadius: '20px', borderTop: '6px solid var(--success)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={36} />
          </div>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>Conferência Finalizada!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>
            Os dados do estoque foram registrados com sucesso no sistema.
          </p>

          {belowMinCount > 0 ? (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 'bold', marginBottom: '8px' }}>
                <AlertTriangle size={18} />
                <span>{belowMinCount} item(ns) abaixo do estoque mínimo</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', opacity: 0.9 }}>
                📲 Uma notificação automática com a lista de reposição foi enviada para o WhatsApp do gestor/dono!
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 'bold' }}>
                <ShieldCheck size={18} />
                <span>Estoque Completo</span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-main)', opacity: 0.9 }}>
                Todos os itens estão com quantidades iguais ou superiores ao mínimo exigido.
              </p>
            </div>
          )}

          <button
            onClick={() => navigate('/funcionario')}
            className="btn"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', backgroundColor: '#0f172a', color: 'white', borderRadius: '12px', fontWeight: 'bold' }}
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/funcionario')}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={20} color="var(--primary)" />
            {listInfo?.title || 'Checklist de Compras'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Insira a quantidade disponível em estoque para cada item
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Banner Informativo */}
        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid #3b82f6', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px', fontSize: '0.85rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
          <div>
            <strong>Conferência de Estoque Mínimo</strong>
            <p style={{ margin: '2px 0 0 0', opacity: 0.9 }}>
              Confira os itens abaixo. O sistema avisará automaticamente no WhatsApp se algum produto estiver com estoque insuficiente!
            </p>
          </div>
        </div>

        {/* Lista de Itens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
          {items.map((item, index) => {
            const currentValStr = stockValues[item.id] ?? '';
            const currentVal = parseFloat(currentValStr);
            const minVal = parseFloat(item.min_stock || 0);
            const hasValue = currentValStr !== '';
            const isBelowMin = hasValue && !isNaN(currentVal) && currentVal < minVal;
            const diff = minVal - currentVal;

            return (
              <div
                key={item.id || index}
                className="card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '14px',
                  borderLeft: isBelowMin ? '4px solid #ef4444' : (hasValue ? '4px solid #10b981' : '4px solid var(--border-color)'),
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 'bold' }}>
                      {item.name}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-color)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      Categoria: {item.category || 'Geral'}
                    </span>
                  </div>

                  {/* Informação do Estoque Mínimo Cadastrado */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Estoque Mínimo Exigido:</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>
                      {item.min_stock || 0} {item.unit || 'un'}
                    </strong>
                  </div>
                </div>

                {/* Input para preencher o Estoque Atual */}
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', marginBottom: '6px', color: 'var(--text-main)' }}>
                    📦 Quanto tem na loja agora? ({item.unit || 'un'}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '1.05rem',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: isBelowMin ? '2px solid #ef4444' : '1px solid var(--border-color)',
                      backgroundColor: isBelowMin ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-color)'
                    }}
                    placeholder={`Digite a quantidade em ${item.unit || 'un'}...`}
                    value={currentValStr}
                    onChange={e => handleStockChange(item.id, e.target.value)}
                    required
                  />
                </div>

                {/* Status Indicator */}
                {hasValue && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {isBelowMin ? (
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} />
                        Abaixo do mínimo! Faltam {diff % 1 === 0 ? diff : diff.toFixed(1)} {item.unit || 'un'} para atingir a cota.
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} />
                        Estoque Suficiente
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Campo de Observações Adicionais */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '6px' }}>
            📝 Observações / Comentários (opcional):
          </label>
          <textarea
            className="input-field"
            style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '10px', resize: 'vertical' }}
            placeholder="Ex: Embalagem danificada, fornecedor sem entrega esta semana..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Botão de Envio */}
        <button
          type="submit"
          className="btn"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '1.05rem',
            fontWeight: 'bold',
            backgroundColor: 'var(--primary)',
            color: 'white',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(255, 69, 0, 0.3)'
          }}
        >
          {submitting ? (
            <>
              <div className="animate-spin" style={{ width: '20px', height: '20px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
              Enviando...
            </>
          ) : (
            <>
              <Send size={18} /> Finalizar e Enviar Conferência
            </>
          )}
        </button>
      </form>
    </div>
  );
}
