import { ERP_URL } from './config.js';

document.getElementById('erp').href = ERP_URL;
chrome.runtime.sendMessage({ type: 'status' }).then((r) => {
  document.getElementById('ver').textContent = `v${r.version}`;
  const s = r.stats ?? { total: 0 };
  document.getElementById('stat').textContent = s.total
    ? `已采集 ${s.total} 次 · 最近：${s.last?.slice(0, 18) ?? ''}`
    : '还没有采集过商品';
});
