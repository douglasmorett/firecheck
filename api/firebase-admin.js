import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let app;

if (!admin.apps.length) {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = JSON.parse(
      readFileSync(join(process.cwd(), 'api', 'serviceAccount.json'), 'utf8')
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'fire-check-storage.firebasestorage.app'
  });
} else {
  app = admin.app();
}

const bucket = admin.storage().bucket();

export const uploadImage = async (base64, folder = 'checklists') => {
  if (!base64 || !base64.includes('base64,')) return base64;
  
  try {
    const mimeType = base64.match(/data:([^;]+);base64,/)[1];
    const extension = mimeType.split('/')[1] || 'jpg';
    const buffer = Buffer.from(base64.split('base64,')[1], 'base64');
    
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const file = bucket.file(fileName);
    
    await file.save(buffer, {
      metadata: { contentType: mimeType },
      public: true
    });

    // Torna o arquivo público para visualização no dashboard
    await file.makePublic();
    
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error) {
    // Uma tentativa a mais antes de desistir: falha de rede pontual não deveria
    // condenar a foto a ficar em base64 dentro do banco.
    try {
      const mimeType = base64.match(/data:([^;]+);base64,/)[1];
      const extension = mimeType.split('/')[1] || 'jpg';
      const buffer = Buffer.from(base64.split('base64,')[1], 'base64');
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
      const file = bucket.file(fileName);
      await file.save(buffer, { metadata: { contentType: mimeType }, public: true });
      await file.makePublic();
      console.warn('[Firebase] Upload recuperado na segunda tentativa.');
      return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (erroFinal) {
      // Devolve o base64 para não perder a evidência do checklist, mas registra em
      // voz alta: cada ocorrência é uma imagem inteira gravada no Postgres, que
      // depois pesa em toda listagem.
      console.error('[Firebase] Upload falhou nas duas tentativas — a imagem será gravada em base64 no banco. Verifique as credenciais e a cota do bucket.', erroFinal?.message || error?.message);
      return base64;
    }
  }
};

export default admin;
