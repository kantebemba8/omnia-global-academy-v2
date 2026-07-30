import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// La télémétrie est chargée après le premier rendu afin de ne pas ralentir
// l’affichage initial. Une erreur précoce déclenchera tout de même son
// chargement via captureError.
window.setTimeout(() => {
  void initSentry();
}, 1500);
