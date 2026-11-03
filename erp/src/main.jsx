import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// 发布新版本后，已打开的旧页面按需加载的旧文件会 404：自动刷新一次拿到新版本（10 秒内不重复刷新，避免死循环）
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('wv.reloadAt') || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem('wv.reloadAt', String(Date.now()));
  } catch { /* 存储不可用时也刷新 */ }
  e.preventDefault();
  location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
