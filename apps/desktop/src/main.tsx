import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createErrorReport, reportClientError } from '@hiraya/utils';
import App from './App';
import '@hiraya/ui/tokens.css';
import './desktop.css';

window.addEventListener('error', (event) => {
  reportClientError(
    createErrorReport({
      platform: 'desktop',
      environment: import.meta.env.MODE,
      feature: 'window.onerror',
      type: 'frontend',
      message: event.message,
    }),
  );
});
window.addEventListener('unhandledrejection', (event) => {
  reportClientError(
    createErrorReport({
      platform: 'desktop',
      environment: import.meta.env.MODE,
      feature: 'unhandledrejection',
      type: 'frontend',
      message: event.reason instanceof Error ? event.reason.message : String(event.reason || ''),
    }),
  );
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
