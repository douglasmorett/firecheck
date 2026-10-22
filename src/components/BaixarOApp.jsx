/** Botões das lojas para baixar o FireCheck (constantes em ../lojasDoApp). */
import { LOJAS, lojaDoAparelho, mostrarBaixarOApp } from '../lojasDoApp';

/** Botões das lojas: só a do aparelho no celular, as duas no computador. */
export default function BaixarOApp({ estilo }) {
  if (!mostrarBaixarOApp()) return null;
  const aqui = lojaDoAparelho();
  const lojas = aqui ? [aqui] : ['android', 'ios'];
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', ...estilo }}>
      {lojas.map((chave) => (
        <a key={chave} href={LOJAS[chave].url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#0f172a', color: '#fff', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.85rem', lineHeight: 1.1 }}>
          <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>{chave === 'android' ? '▶' : ''}</span>
          <span>
            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 500, opacity: 0.8 }}>{chave === 'android' ? 'Disponível no' : 'Baixar na'}</span>
            {LOJAS[chave].nome}
          </span>
        </a>
      ))}
    </div>
  );
}
