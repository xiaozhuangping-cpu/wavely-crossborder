// 检测「Wavely 1688 采集助手」是否已安装（插件通过 externally_connectable 允许本站发消息）
import { useEffect, useState } from 'react';

// manifest.json 里的 key 固定了扩展 ID；上架 Chrome 应用商店后商店会分配新 ID，加到这里即可
export const EXTENSION_IDS = ['eiahlmpjdglpdchmdnhapflafemmljbe'];
// 最新版本号：与 extension/manifest.json 保持一致（打包脚本会校验）
export const EXTENSION_LATEST = '0.1.1';
export const EXTENSION_ZIP = `${import.meta.env.BASE_URL}wavely-1688-collector.zip`;
export const WEB_STORE_URL = null;   // 上架后填商店地址，安装卡片会切换为「添加至 Chrome」

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
export const BROWSER = /Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) && !/OPR\/|SamsungBrowser/.test(ua) ? 'chrome' : 'other';
export const EXTENSIONS_PAGE = BROWSER === 'edge' ? 'edge://extensions' : 'chrome://extensions';

const ask = (id, timeout) => new Promise((resolve) => {
  const rt = window.chrome?.runtime;
  if (!rt?.sendMessage) return resolve(null);
  const timer = setTimeout(() => resolve(null), timeout);
  try {
    rt.sendMessage(id, { type: 'ping' }, (r) => {
      clearTimeout(timer);
      // 未安装时 lastError 为 “Could not establish connection”，读取它以免控制台报错
      resolve(window.chrome.runtime.lastError ? null : r ?? null);
    });
  } catch { clearTimeout(timer); resolve(null); }
});

export async function pingExtension(timeout = 1000) {
  for (const id of EXTENSION_IDS) {
    const r = await ask(id, timeout);
    if (r?.ok) return { id, ...r };
  }
  return null;
}

const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
export const isOutdated = (v) => !!v && newer(EXTENSION_LATEST, v);

/** { status: 'checking' | 'installed' | 'missing', info } */
export function useExtension() {
  const [s, setS] = useState({ status: 'checking', info: null });
  useEffect(() => {
    let alive = true;
    const check = () => pingExtension().then((info) => alive && setS({ status: info ? 'installed' : 'missing', info }));
    check();
    // 页面切回前台时重新检测（例如刚在扩展页面里重新加载了插件）
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return s;
}
