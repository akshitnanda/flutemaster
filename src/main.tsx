import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { StudioErrorBoundary } from './components/StudioErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StudioErrorBoundary variant="fullscreen">
    <App />
  </StudioErrorBoundary>
);
