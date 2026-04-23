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
    console.error('Firebase Upload Error:', error);
    return base64; // Fallback para base64 se falhar
  }
};

export default admin;
