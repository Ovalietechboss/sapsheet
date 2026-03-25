// Resolve env safely in Vite/browser without using process.env
const ENV: any = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

// API_BASE_URL: Use hardcoded IP for Android/Capacitor, or env var for web
// For local web development, set VITE_API_URL in .env
const apiBaseUrl = ENV.VITE_API_URL || '172.18.176.1:4000';

export const APP_CONFIG = {
  APP_NAME: 'SAP Sheet',
  VERSION: '1.0.0',
  DB_NAME: 'sap-sheet-db',
  DB_VERSION: 1,
  API_BASE_URL: `http://${apiBaseUrl}`,
  
  // Firebase (P2 - future backend)
  FIREBASE_CONFIG: {
    apiKey: ENV.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: ENV.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: ENV.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: ENV.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: ENV.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: ENV.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  },
  
  // Legal defaults
  LEGAL_MENTIONS: {
    TVA: 'TVA non applicable, art. 293 B du CGI',
    PAYMENT_TEXT: 'En votre aimable règlement par virement :',
    PAYMENT_IBAN: 'FR76 3000 4031 8200 0005 1709 487',
    PAYMENT_BIC: 'BNPAFRPPXXX'
  },
  
  // Pagination
  ITEMS_PER_PAGE: 20,
  
  // Sync (P2)
  SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_SYNC_RETRIES: 3
};
