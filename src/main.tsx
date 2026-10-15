import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/utils/Toast';
import { loadProductCatalog } from './services/pricelistService';

async function startApp() {
  await loadProductCatalog();

  ReactDOM.createRoot(document.getElementById('root')!).render(
      <ToastProvider>
        <App />
      </ToastProvider>
  );
}

void startApp();
