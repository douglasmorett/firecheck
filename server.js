/**
 * Servidor HTTP para hospedagem em container (Coolify).
 *
 * Na Vercel, api/index.js é uma função serverless e o dist/ é servido pela CDN.
 * Fora dela, este arquivo faz os dois papéis: monta o mesmo handler em /api/* e
 * serve o build do frontend.
 *
 * O handler lê req.url e monta `new URL(url, http://host)` para extrair a query,
 * e o roteamento interno usa url.includes('/api/...'). Por isso a montagem é
 * app.all('/api/*', ...) e não app.use('/api', ...): app.use remove o prefixo de
 * req.url e todas as rotas deixariam de casar.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiHandler from './api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const app = express();

// Atrás do proxy do Coolify: preserva o IP e o protocolo originais.
app.set('trust proxy', true);
app.disable('x-powered-by');

// A Vercel entrega req.body já parseado (e recusa corpo acima de 4,5 MB). O limite
// aqui acompanha o uso real, sem ficar em 50 MB: as fotos do app saem do canvas em
// JPEG 800 px, qualidade 0,6 (~100 KB cada, uns 130 KB em base64), então um
// checklist grande com selfie e assinatura fica na casa de poucos MB; 15 MB
// também comporta o atestado enviado em /api/ponto/abonos (foto de celular em base64).
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Sonda de saúde para o Coolify — responde sem tocar no banco.
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

// A API. app.all preserva req.url completo, que o handler precisa para rotear.
app.all('/api/*', async (req, res) => {
  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error('[api] erro não tratado:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }
});

// Assets do build. index.html fica de fora para o fallback abaixo decidir.
app.use(express.static(DIST, { index: false, maxAge: '1h' }));

// SPA: qualquer rota não-API devolve o index.html para o React Router resolver.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rota não encontrada.' });
  }
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FireCheck ouvindo na porta ${PORT}`);
});
