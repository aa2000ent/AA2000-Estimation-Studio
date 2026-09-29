import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/utils/Toast';
import { loadProductCatalog } from './services/pricelistService';

// Share one loading operation, including during StrictMode checks.
let catalogRequest: Promise<number> | undefined;

function initializeCatalog() {
  if (!catalogRequest) {
    catalogRequest = loadProductCatalog().catch((error) => {
      catalogRequest = undefined;
      throw error;
    });
  }

  return catalogRequest;
}

function Startup() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    initializeCatalog()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Could not load products.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  if (error) {
    return (
      <div role="alert" style={{ padding: 24 }}>
        <p>Could not load the product catalog: {error}</p>
        <button
          onClick={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return <p role="status">Loading product catalog…</p>;
  }

  return (
    <>
      {(import.meta.env.VITE_PRODUCTS_MODE || 'mock') === 'mock' && (
        <div
          role="status"
          style={{ padding: 12, background: '#fff3cd', color: '#664d03' }}
        >
          DEMO MODE — product catalog uses fictional products and prices.
        </div>
      )}
      <ToastProvider>
        <App />
      </ToastProvider>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Startup />
  </React.StrictMode>
);