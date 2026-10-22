/**
 * O app nativo se atualiza sozinho.
 *
 * O Capacitor empacota as telas (o `dist`) dentro do app: sem isto, cada
 * melhoria publicada no site só chegava ao celular com versão nova na loja
 * (Pet Nature, 22/10/2026: a gerente no app ainda via a tela antiga). Agora o
 * build da Vercel publica o pacote das telas em /ota (scripts/pacote-do-app.mjs);
 * o app confere ao abrir e ao voltar para a tela, baixa a versão nova em
 * segundo plano e troca quando o app sai da tela — ninguém perde o que estava
 * fazendo. Se a versão nova não abrir, o plugin volta sozinho para a anterior.
 *
 * Plugin @capgo/capacitor-updater no modo manual (sem a nuvem da Capgo, sem
 * estatística: capacitor.config.json). Telas que precisem de plugin nativo novo
 * sobem `NATIVO_MINIMO` no script do pacote: aparelho com app mais velho não
 * recebe e fica esperando a versão da loja.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import API_URL from './api';

const INTERVALO = 10 * 60 * 1000;
let ultimaConferencia = 0;
let conferindo = false;

/** '1.0.10' < '1.0.3'? Compara número a número. */
export function versaoMenor(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  }
  return false;
}

async function conferir() {
  if (conferindo || Date.now() - ultimaConferencia < INTERVALO) return;
  conferindo = true;
  ultimaConferencia = Date.now();
  try {
    // HTTP nativo: o fetch do WebView esbarraria no CORS (a origem do app é localhost).
    const r = await CapacitorHttp.get({ url: `${API_URL}/ota/versao.json?t=${Date.now()}`, headers: { 'Cache-Control': 'no-cache' } });
    const novo = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    if (r.status !== 200 || !novo?.versao || !novo?.arquivo) return;
    const { bundle, native } = await CapacitorUpdater.current();
    if (bundle?.version === novo.versao) return;
    if (versaoMenor(native, novo.nativoMinimo)) return;
    const { bundles } = await CapacitorUpdater.list();
    let pacote = (bundles || []).find(b => b.version === novo.versao && b.status !== 'error');
    if (!pacote) pacote = await CapacitorUpdater.download({ version: novo.versao, url: `${API_URL}${novo.arquivo}` });
    await CapacitorUpdater.next({ id: pacote.id });
  } catch (e) {
    console.warn('[Atualização do app]', e?.message || e);
  } finally {
    conferindo = false;
  }
}

export function atualizarAppSozinho() {
  if (!Capacitor.isNativePlatform()) return;
  // Avisa que esta versão abriu bem; sem isto o plugin desfaz a atualização.
  CapacitorUpdater.notifyAppReady().catch(() => {});
  conferir();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') conferir();
  });
}
