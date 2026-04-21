export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ 
    status: 'online', 
    info: 'Teste de sanidade do servidor FireCheck' 
  });
}
