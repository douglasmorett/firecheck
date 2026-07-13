import { Capacitor } from '@capacitor/core';

const API_URL = Capacitor.isNativePlatform()
  ? 'https://www.firecheckapp.com.br'
  : (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '');

export default API_URL;
