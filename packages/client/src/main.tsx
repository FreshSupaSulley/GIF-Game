import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log('[main] Script loaded');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

console.log('[main] Rendering App');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

console.log('[main] Render called');
