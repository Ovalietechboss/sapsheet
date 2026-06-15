import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import './index.css';

// Register service worker for PWA/offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.log('Service Worker registration failed:', err);
  });
}

// Auto-récupération après redéploiement : un import dynamique (ex. jspdf) dont le hash
// a changé déclenche `vite:preloadError` → on recharge une fois pour récupérer les assets
// à jour, au lieu d'échouer ("Failed to fetch dynamically imported module").
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('vitePreloadReloaded')) return; // garde anti-boucle
  sessionStorage.setItem('vitePreloadReloaded', '1');
  window.location.reload();
});
setTimeout(() => sessionStorage.removeItem('vitePreloadReloaded'), 10000);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
