// 构建后预渲染：GitHub Pages 只能发静态文件，SPA 的商品页对爬虫是空壳。
// 这里为每个在售商品生成 dist/p/<id>/index.html（独立标题、描述、分享卡片、canonical、Product 结构化数据、
// 可直接阅读的商品内容），再生成首页商品列表、sitemap.xml 与 404.html（其他路径回落到 SPA）。
// 静态内容只有英文一份，所以不声明 hreflang：?lang= 只是运行时切换语言的便利参数，各语言共用同一个 canonical。
// 要做多语言收录，需要按语言生成独立路径（/shop/de/p/<id>/），而不是给同一份英文页挂 hreflang。
// 数据取不到时只告警、不让构建失败：商品页仍会由 404.html 回落到 SPA 正常打开。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, DEFAULT_META, productMeta, productUrl } from '../src/seo.js';
import { productTitle, productDesc, productBullets } from '../src/i18n.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')
  .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const URL_ = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_KEY;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const TEMPLATE = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

/** 用模板生成一页：替换 <title> 与描述 / 分享卡片，<head> 末尾追加 canonical、结构化数据，#root 放可读内容 */
function page({ title, description, image, url, jsonLd = [], body = '', noindex = false }) {
  let h = TEMPLATE;
  const rep = (re, val) => { if (!re.test(h)) throw new Error(`template missing ${re}`); h = h.replace(re, val); };
  rep(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  rep(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`);
  for (const [k, v] of [['title', title], ['description', description], ['image', image], ['url', url]]) rep(new RegExp(`(<meta property="og:${k}" content=")[^"]*`), `$1${esc(v)}`);
  for (const [k, v] of [['title', title], ['description', description], ['image', image]]) rep(new RegExp(`(<meta name="twitter:${k}" content=")[^"]*`), `$1${esc(v)}`);
  const head = [
    `<link rel="canonical" href="${esc(url)}" />`,
    noindex ? '<meta name="robots" content="noindex" />' : '',
    ...jsonLd.map((o) => `<script type="application/ld+json">${ldJson(o)}</script>`),
  ].filter(Boolean).join('\n    ');
  h = h.replace('</head>', `    ${head}\n  </head>`);
  rep(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  return h;
}
const write = (rel, html) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
// React 挂载前的可读内容（爬虫与禁用脚本的访客看到的就是它；挂载后被应用替换）
const shell = (inner) => `<main style="max-width:960px;margin:0 auto;padding:32px 16px;font-family:Inter,system-ui,sans-serif;color:#1f2933;line-height:1.6">${inner}</main>`;

let products = [];
try {
  const r = await fetch(`${URL_}/rest/v1/products?select=id,sku,name,description,category,price_usd,listing,image_url,video_url,video_poster,skus(sku,option_value,price_usd,image_url,status)&status=eq.active&order=id`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  products = await r.json();
} catch (e) {
  console.warn(`prerender: 商品数据获取失败（${e.message}），只生成首页与 404 回落`);
}

// 商品页
for (const p of products) {
  const m = productMeta(p, 'en');
  const bullets = productBullets(p, 'en');
  const img = m.image ? `<img src="${esc(m.image)}" alt="${esc(productTitle(p, 'en'))}" width="480" height="480" style="max-width:100%;height:auto;border-radius:16px" />` : '';
  const body = shell(`<p><a href="${SITE}">Wavely</a></p><h1>${esc(productTitle(p, 'en'))}</h1>${img}
    <p><strong>${esc(m.jsonLd.offers.price ? `$${m.jsonLd.offers.price}` : `$${m.jsonLd.offers.lowPrice} – $${m.jsonLd.offers.highPrice}`)}</strong></p>
    <p>${esc(productDesc(p, 'en'))}</p>${bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}`);
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Wavely', item: SITE }, { '@type': 'ListItem', position: 2, name: productTitle(p, 'en'), item: m.url }] };
  write(`p/${p.id}/index.html`, page({ ...m, jsonLd: [m.jsonLd, crumbs], body }));
}

// 首页：商品链接列表（爬虫从这里发现所有商品页）+ ItemList / Organization
const list = products.map((p) => `<li><a href="${productUrl(p)}">${esc(productTitle(p, 'en'))}</a></li>`).join('');
write('index.html', page({ ...DEFAULT_META, url: SITE,
  body: shell(`<h1>Wavely · Thoughtful everyday goods</h1><p>${esc(DEFAULT_META.description)}</p>${list ? `<ul>${list}</ul>` : ''}`),
  jsonLd: [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Wavely', url: SITE, logo: `${SITE}og.jpg` },
    ...(products.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p) })) }] : []),
  ] }));
write('track/index.html', page({ ...DEFAULT_META, title: 'Track your order · Wavely', url: `${SITE}track/` }));
write('checkout/index.html', page({ ...DEFAULT_META, title: 'Checkout · Wavely', url: `${SITE}checkout/`, noindex: true }));
// 其他路径（/done/<单号>、已下架商品）：GitHub Pages 返回 404.html，由 SPA 接管
write('404.html', page({ ...DEFAULT_META, url: SITE, noindex: true }));

// sitemap
const today = new Date().toISOString().slice(0, 10);
const urls = [SITE, ...products.map(productUrl)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
  <url><loc>${SITE}track/</loc><lastmod>${today}</lastmod></url>
</urlset>
`);
console.log(`prerender: ${products.length} 个商品页 + 首页 / track / checkout / 404 + sitemap.xml（${urls.length + 1} 个地址）`);
