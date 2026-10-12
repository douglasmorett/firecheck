import { Capacitor } from '@capacitor/core';

// App da Apple e do Google não pode vender a assinatura fora da loja deles
// (App Store 3.1.1 / política de pagamentos do Play). No app nativo o FireCheck
// funciona como acesso de quem já tem conta: nenhum preço, botão de assinar ou
// link de checkout aparece. No site, tudo continua igual.
export const vendeNoApp = !Capacitor.isNativePlatform();
