import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture() {
  console.log('Iniciando servidor Vite para captura...');
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { port: 5179 }
  });
  await server.listen();
  console.log('Servidor rodando em http://localhost:5179');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const out65 = path.resolve('screenshots/iphone-6.5');
  const out55 = path.resolve('screenshots/iphone-5.5');
  fs.mkdirSync(out65, { recursive: true });
  fs.mkdirSync(out55, { recursive: true });

  const routes = [
    { url: 'http://localhost:5179/', name: '01_home' },
    { url: 'http://localhost:5179/login', name: '02_login' },
    { url: 'http://localhost:5179/terms', name: '03_terms' },
    { url: 'http://localhost:5179/privacy.html', name: '04_privacy' }
  ];

  // Captura 6.5 polegadas (1242 x 2688)
  console.log('Capturando telas para iPhone 6.5 (1242x2688)...');
  await page.setViewport({ width: 1242, height: 2688, deviceScaleFactor: 1 });
  for (const r of routes) {
    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(2000);
      await page.screenshot({ path: path.join(out65, `${r.name}.png`) });
      console.log(`Salvo: iphone-6.5/${r.name}.png`);
    } catch (e) {
      console.error(`Erro ao capturar ${r.name} 6.5:`, e.message);
    }
  }

  // Captura 5.5 polegadas (1242 x 2208)
  console.log('Capturando telas para iPhone 5.5 (1242x2208)...');
  await page.setViewport({ width: 1242, height: 2208, deviceScaleFactor: 1 });
  for (const r of routes) {
    try {
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(2000);
      await page.screenshot({ path: path.join(out55, `${r.name}.png`) });
      console.log(`Salvo: iphone-5.5/${r.name}.png`);
    } catch (e) {
      console.error(`Erro ao capturar ${r.name} 5.5:`, e.message);
    }
  }

  await browser.close();
  await server.close();
  console.log('Todas as capturas de tela foram salvas com sucesso!');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
