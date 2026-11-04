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

// 旧版用 Hash 路由（shop/#/p/7）：分享出去的旧链接换成正常路径（shop/p/7），搜索引擎才能收录每个商品页
if (location.hash.startsWith('#/')) {
  history.replaceState(null, '', import.meta.env.BASE_URL + location.hash.slice(2).replace(/^\//, ''));
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
