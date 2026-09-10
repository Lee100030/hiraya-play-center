import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@hiraya/ui/tokens.css';
import './desktop.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
