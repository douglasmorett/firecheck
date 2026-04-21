export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method === 'POST') {
    const { email, password } = req.body;
    
    // Login de Emergência (Hardcoded para destravar o usuário)
    if (email === 'dugaburguer@gmail.com' || email === 'douglas@firecheck.com') {
      return res.status(200).json({ 
        status: 'success', 
        user: { id: 1, name: 'Douglas', email: email, role: 'admin', store: 'Loja Matriz' } 
      });
    }
  }

  return res.status(401).json({ error: 'Falha na autenticação de emergência' });
}
