import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry';
import { getRuntimeConfigIssues } from './lib/runtimeConfig';
import ConfigurationError from './pages/ConfigurationError';
import { LanguageProvider } from './i18n/LanguageContext';
import { initializeSessionStorage } from './lib/session';
import { initializeNativeRuntime, initializeNetworkRuntime } from './lib/mobile';

async function bootstrap(): Promise<void> {
  await initializeSessionStorage();
  await initializeNetworkRuntime();
  await initializeNativeRuntime();

  const runtimeConfigIssues = getRuntimeConfigIssues();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LanguageProvider>
        {runtimeConfigIssues.length > 0 ? (
          <ConfigurationError issues={runtimeConfigIssues} />
        ) : (
          <App />
        )}
      </LanguageProvider>
    </StrictMode>,
  );

  // La télémétrie est chargée après le premier rendu afin de ne pas ralentir
  // l’affichage initial. Une erreur précoce déclenchera tout de même son
  // chargement via captureError.
  if (runtimeConfigIssues.length === 0) {
    window.setTimeout(() => {
      void initSentry();
    }, 1500);
  }
}

void bootstrap().catch(error => {
  console.error('[Omnia] Échec du démarrage de l’application.', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Inter,sans-serif;color:#002050;text-align:center"><div><h1 style="font-size:22px;margin:0 0 10px">Omnia Global Academy</h1><p style="margin:0;color:#667085">Le démarrage de l’application a échoué. Fermez puis rouvrez l’application.</p></div></main>';
  }
});
