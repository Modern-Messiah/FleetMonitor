import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import 'leaflet/dist/leaflet.css';
import App from './App';
import { ErrorBoundary } from './components/error-boundary';
import { I18nProvider } from './lib/i18n';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster theme="dark" position="top-right" />
          </BrowserRouter>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
