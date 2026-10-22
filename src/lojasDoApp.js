/**
 * Links do aplicativo FireCheck nas lojas (no ar desde 16/10/2026).
 *
 * Douglas, 22/10/2026: "o FireCheck já tá oferecendo baixar o app quando
 * acessa?" — não estava: o site só ensinava a instalar o atalho do navegador
 * (WebApp). No celular aparece a loja daquele aparelho; no computador, as duas.
 * Dentro do app nativo nada disto aparece.
 */
import { Capacitor } from '@capacitor/core';

export const LOJAS = {
  android: { nome: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.grupohakim.firecheck' },
  ios: { nome: 'App Store', url: 'https://apps.apple.com/br/app/firecheck/id6787563772' },
};

/** 'android', 'ios' ou null (computador). iPad novo se apresenta como Mac com toque. */
export function lojaDoAparelho() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

export const mostrarBaixarOApp = () => !Capacitor.isNativePlatform();
