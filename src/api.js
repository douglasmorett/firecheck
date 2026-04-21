const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://firecheck-grupohakim.vercel.app'; // Forçando a URL de produção para evitar erro de localhost

export default API_URL;
