import React from 'react';
import { X } from 'lucide-react';
import './ponto.css';

// Janela (modal) do módulo de ponto, no visual de 21/11/2026: rótulo pequeno em
// cima do título, sem ícone, e o X redondo à direita. `.modal-janela` mantém a
// rolagem por dentro (index.css) e é por ela que os testes leem a janela.
export default function Janela({ rotulo, titulo, onFechar, larga = false, children }) {
  return (
    <div className="pt-fundo">
      <div className={`card animate-fade-up modal-janela pt-janela${larga ? ' larga' : ''}`}>
        <div className="pt-janela-cab">
          <div>
            {rotulo && <span className="fc-olho-rot">{rotulo}</span>}
            <h3>{titulo}</h3>
          </div>
          <button type="button" className="pt-fechar" onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
