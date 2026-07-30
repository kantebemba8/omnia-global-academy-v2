import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry';
import { getRuntimeConfigIssues } from './lib/runtimeConfig';
import ConfigurationError from './pages/ConfigurationError';

const runtimeConfigIssues = getRuntimeConfigIssues();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {runtimeConfigIssues.length > 0 ? (
      <ConfigurationError issues={runtimeConfigIssues} />
    ) : (
      <App />
    )}
  </StrictMode>
);

// La télémétrie est chargée après le premier rendu afin de ne pas ralentir
// l’affichage initial. Une erreur précoce déclenchera tout de même son
// chargement via captureError.
if (runtimeConfigIssues.length === 0) {
  window.setTimeout(() => {
    void initSentry();
  }, 1500);
}
