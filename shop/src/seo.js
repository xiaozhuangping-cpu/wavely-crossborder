// 页面 SEO：商品元信息 / 结构化数据（纯函数，运行时与构建期预渲染 scripts/prerender.mjs 共用）+ 运行时更新 <head>
import { productTitle, productName, productDesc } from './i18n.js';

export const SITE = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/';
export const DEFAULT_META = {
  title: 'Wavely · Thoughtful everyday goods',
  description: 'Wavely demo store — multilingual, multi-currency, with an AI shopping assistant. Orders sync to the Wavely ERP.',
  image: `${SITE}og.jpg`,
};

const clip = (s, n = 158) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
export const productUrl = (p) => `${SITE}p/${p.id}/`;
const activeSkus = (p) => (p.skus || []).filter((k) => k.status === 'active');

export function productMeta(p, lang = 'en') {
  const title = productTitle(p, lang) || productName(p, lang);
  const desc = productDesc(p, lang);
  const skus = activeSkus(p);
  const prices = (skus.length ? skus.map((k) => Number(k.price_usd)) : [Number(p.price_usd)]).filter((x) => x > 0);
  const images = [p.image_url, ...skus.map((k) => k.image_url)].filter((x, i, a) => x && a.indexOf(x) === i);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const offers = prices.length > 1 && lo !== hi
    ? { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: lo.toFixed(2), highPrice: hi.toFixed(2), offerCount: prices.length, availability: 'https://schema.org/InStock', url: productUrl(p) }
    : { '@type': 'Offer', priceCurrency: 'USD', price: lo.toFixed(2), availability: 'https://schema.org/InStock', url: productUrl(p) };
  return {
    title: `${title} · Wavely`,
    description: clip(desc || title),
    image: images[0] || DEFAULT_META.image,
    url: productUrl(p),
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Product', name: title, description: clip(desc, 500) || undefined,
      image: images, sku: p.sku, brand: { '@type': 'Brand', name: 'Wavely' }, offers,
      ...(p.video_url ? { subjectOf: { '@type': 'VideoObject', name: title, contentUrl: p.video_url, thumbnailUrl: p.video_poster || images[0], uploadDate: '2026-11-04', description: clip(desc || title) } } : {}),
    },
  };
}

// ---------- 运行时：切换页面时同步 <head>（客户端导航后标题、描述、分享卡片也正确） ----------
const setMeta = (attr, key, val) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', val);
};
export function applySeo({ title, description, image, url, jsonLd } = {}) {
  const m = { ...DEFAULT_META, url: SITE, ...Object.fromEntries(Object.entries({ title, description, image, url }).filter(([, v]) => v)) };
  document.title = m.title;
  setMeta('name', 'description', m.description);
  for (const [k, v] of [['title', m.title], ['description', m.description], ['image', m.image], ['url', m.url]]) setMeta('property', `og:${k}`, v);
  for (const [k, v] of [['title', m.title], ['description', m.description], ['image', m.image]]) setMeta('name', `twitter:${k}`, v);
  let can = document.head.querySelector('link[rel="canonical"]');
  if (!can) { can = document.createElement('link'); can.rel = 'canonical'; document.head.appendChild(can); }
  can.href = m.url;
  let ld = document.getElementById('ld-page');
  if (jsonLd) {
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'ld-page'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(jsonLd);
  } else if (ld) ld.remove();
}
