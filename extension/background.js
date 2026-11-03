// Wavely 1688 采集助手：后台（采集队列、页面数据解析、写入 Supabase）
// - 详情页：直接读取当前页面已加载的数据
// - 列表页勾选：逐个在后台标签页打开详情页读取，带随机间隔限速；遇到登录/验证页面暂停，等用户手动处理
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const VERSION = chrome.runtime.getManifest().version;
// 每个商品之间的间隔（秒），用户可在浮动栏或插件弹窗里设置；实际间隔在设定值 ±30% 内随机
export const DEFAULT_DELAY_SEC = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getDelaySec = async () => {
  const { delaySec } = await chrome.storage.local.get('delaySec');
  const n = Number(delaySec ?? DEFAULT_DELAY_SEC);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 60) : DEFAULT_DELAY_SEC;
};
const jitter = async () => (await getDelaySec()) * 1000 * (0.7 + Math.random() * 0.6);

// ---------- 页面数据解析（在 1688 页面的 MAIN world 执行，必须自包含） ----------
function extract1688() {
  const r = window.context && window.context.result;
  const model = r && r.global && r.global.globalData && r.global.globalData.model;
  const od = model && model.offerDetail;
  if (!od || !od.offerId) return null;
  const d = r.data || {};
  const clean = (s) => String(s == null ? '' : s).replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const trade = (((d.mainPrice || {}).fields || {}).finalPriceModel || {}).tradeWithoutPromotion || {};
  const weights = {};
  ((((d.productPackInfo || {}).fields || {}).pieceWeightScale || {}).pieceWeightScaleInfo || [])
    .forEach((x) => { weights[String(x.skuId)] = num(x.weight); });
  const props = (od.skuProps || []).map((p) => ({
    name: clean(p.prop),
    values: (p.value || []).map((v) => ({ name: clean(v.name), image: v.imageUrl || null })),
  }));
  const imageOf = (spec) => {
    for (let i = 0; i < props.length; i++) {
      const hit = props[i].values.find((v) => v.name === spec[i] && v.image);
      if (hit) return hit.image;
    }
    return null;
  };
  const unitWeight = num(((model.detailDescription || {}).freightInfo || {}).unitWeight);
  let skus = (trade.skuMapOriginal || []).map((s) => {
    const spec = clean(s.specAttrs).split('>').map((x) => x.trim()).filter(Boolean);
    return {
      skuId: String(s.skuId), spec, specText: spec.join(' / '),
      price: num(s.discountPrice) || num(s.price), stock: s.canBookCount == null ? null : Number(s.canBookCount),
      weight_g: weights[String(s.skuId)] || (unitWeight ? Math.round(unitWeight * 1000) : null), image: imageOf(spec),
    };
  });
  // 阶梯价（按采购量分档，所有规格同价）：规格没有单价时取起订档价格——最贴近小批量采购的真实成本
  const tm = model.tradeModel || {};
  const tiers = (((tm.offerPriceModel || {}).currentPrices) || tm.disPriceRanges || [])
    .map((t) => ({ min: Number(t.beginAmount) || 1, price: num(t.price) })).filter((t) => t.price)
    .sort((a, b) => a.min - b.min);
  const tierPrice = tiers.length ? tiers[0].price : null;
  skus.forEach((s) => { if (!s.price && tierPrice) { s.price = tierPrice; s.priceFromTier = true; } });
  const priceMin = num(trade.offerMinPrice), priceMax = num(trade.offerMaxPrice);
  if (!skus.length) skus = [{ skuId: null, spec: [], specText: '默认', price: tierPrice || priceMax || priceMin, stock: null, weight_g: unitWeight ? Math.round(unitWeight * 1000) : null, image: null }];
  // 规格顺序与页面一致
  const order = (props[0] && props[0].values.map((v) => v.name)) || [];
  skus.sort((a, b) => (order.indexOf(a.spec[0]) - order.indexOf(b.spec[0])) || a.specText.localeCompare(b.specText, 'zh'));
  const images = (od.mainImageList && od.mainImageList.length ? od.mainImageList : od.imageList || [])
    .map((i) => i.fullPathImageURI).filter(Boolean);
  return {
    offerId: String(od.offerId),
    url: `https://detail.1688.com/offer/${od.offerId}.html`,
    title: clean(od.subject),
    category: clean(od.leafCategoryName),
    images: [...new Set(images)].slice(0, 12),
    props, skus: skus.slice(0, 200),
    priceMin, priceMax: priceMax || priceMin, priceTiers: tiers.slice(0, 6),
    moq: num(trade.offerBeginAmount),
    unit: clean(((d.productTitle || {}).fields || {}).unit) || null,
    attributes: (od.featureAttributes || []).map((a) => ({ name: clean(a.name), value: clean(a.value) })).filter((a) => a.name && a.value).slice(0, 40),
    supplier: clean((model.sellerModel || {}).companyName) || null,
    collectedAt: new Date().toISOString(),
  };
}

async function extractFromTab(tabId, tries = 10, interval = 1000) {
  for (let i = 0; i < tries; i++) {
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: extract1688 });
      if (res && res.result) return res.result;
    } catch { /* 页面还在跳转 */ }
    await sleep(interval);
  }
  return null;
}

// 后台标签页里等商品数据出现：页面数据是内嵌在 HTML 里的，不必等图片等资源全部加载完
async function waitForData(tabId, ms = 25000) {
  const end = Date.now() + ms;
  let completeAt = 0;
  while (Date.now() < end) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (!t) return { data: null, url: '' };
    const url = t.pendingUrl || t.url || '';
    if (NEEDS_USER.test(url)) return { data: null, url };
    if (/detail\.1688\.com\/offer\//.test(t.url || '')) {
      const data = await extractFromTab(tabId, 1);
      if (data) return { data, url };
    }
    if (t.status === 'complete') {
      completeAt ||= Date.now();
      if (Date.now() - completeAt > 4000) return { data: null, url: t.url || '' };   // 加载完 4 秒仍无数据
    }
    await sleep(300);
  }
  return { data: null, url: (await chrome.tabs.get(tabId).catch(() => ({}))).url || '' };
}

// ---------- Supabase：插件自己的匿名会话 ----------
async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.access_token) throw new Error(d.msg || d.error_description || `登录失败（${res.status}）`);
  const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in ?? 3600) * 1000 };
  await chrome.storage.local.set({ session: s });
  return s;
}

async function getSession(force = false) {
  const { session } = await chrome.storage.local.get('session');
  if (session && !force && session.expires_at - Date.now() > 60e3) return session;
  if (session?.refresh_token) {
    try { return await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token }); } catch { /* 演示站每日清理匿名用户，重新登录 */ }
  }
  return authRequest('signup', { data: {} });
}

async function rpc(fn, args, retry = true) {
  const s = await getSession();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` },
    body: JSON.stringify(args),
  });
  if (res.status === 401 && retry) { await getSession(true); return rpc(fn, args, false); }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.message || `保存失败（${res.status}）`);
  return d;
}

const save = async (data) => {
  const r = await rpc('collect_offer', { p: data });
  const { stats = { total: 0 } } = await chrome.storage.local.get('stats');
  await chrome.storage.local.set({ stats: { total: stats.total + 1, last: data.title, at: Date.now() } });
  return r;
};

// ---------- 批量队列 ----------
// state: { items: [{offerId, title, status: pending|running|done|error, msg}], running, paused, verifyTabId, originTabId }
let state = null;
const persist = () => chrome.storage.session.set({ queue: state });
const broadcast = () => {
  if (state?.originTabId) chrome.tabs.sendMessage(state.originTabId, { type: 'progress', state }).catch(() => {});
};
const update = async (patch) => { Object.assign(state, patch); await persist(); broadcast(); };

const NEEDS_USER = /login\.|passport\.|punish|captcha|_____tmd_____|\/sec\.|nocaptcha/i;

async function waitComplete(tabId, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (!t) return null;
    if (t.status === 'complete') return t;
    await sleep(500);
  }
  return chrome.tabs.get(tabId).catch(() => null);
}

async function processOne(item) {
  const tab = await chrome.tabs.create({ url: `https://detail.1688.com/offer/${item.offerId}.html`, active: false });
  try {
    const { data, url } = await waitForData(tab.id);
    if (!data) {
      if (NEEDS_USER.test(url) || !/detail\.1688\.com\/offer\//.test(url)) {
        // 交给用户处理登录/滑块验证，不尝试绕过
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
        await update({ paused: true, verifyTabId: tab.id });
        return 'paused';
      }
      throw new Error('页面里没有找到商品数据');
    }
    await save(data);
    item.title = data.title;
    item.status = 'done';
  } finally {
    if (!state.paused || state.verifyTabId !== tab.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
  return 'done';
}

async function runQueue() {
  if (!state || state.running) return;
  await update({ running: true });
  try {
    while (state && !state.paused) {
      const item = state.items.find((x) => x.status === 'pending');
      if (!item) break;
      item.status = 'running'; await persist(); broadcast();
      try {
        if ((await processOne(item)) === 'paused') { item.status = 'pending'; break; }
      } catch (e) { item.status = 'error'; item.msg = String(e.message || e).slice(0, 120); }
      await persist(); broadcast();
      if (state.items.some((x) => x.status === 'pending')) await sleep(await jitter());
    }
  } finally {
    if (state) await update({ running: false });
  }
}

async function resume() {
  if (!state?.paused) return;
  const tabId = state.verifyTabId;
  // 用户完成验证后，当前标签页通常已回到详情页，直接读取；否则刷新详情页再读
  const item = state.items.find((x) => x.status === 'pending');
  if (tabId && item) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (t && !/detail\.1688\.com\/offer\//.test(t.url || '')) {
      await chrome.tabs.update(tabId, { url: `https://detail.1688.com/offer/${item.offerId}.html` });
      await waitComplete(tabId);
    }
    const data = t ? await extractFromTab(tabId, 5) : null;
    if (data) {
      try { await save(data); item.title = data.title; item.status = 'done'; } catch (e) { item.status = 'error'; item.msg = String(e.message || e); }
    }
    chrome.tabs.remove(tabId).catch(() => {});
    if (state.originTabId) chrome.tabs.update(state.originTabId, { active: true }).catch(() => {});
  }
  await update({ paused: false, verifyTabId: null });
  runQueue();
}

// 后台被浏览器回收后重新唤醒：恢复未完成的队列
chrome.storage.session.get('queue').then(({ queue }) => {
  if (queue && !state) { state = { ...queue, running: false }; if (!state.paused) runQueue(); }
});

// ---------- 消息 ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    switch (msg?.type) {
      case 'collectThis': {                       // 详情页「采集此商品」
        const data = await extractFromTab(sender.tab.id, 3);
        if (!data) throw new Error('没有读到商品数据，请刷新页面后重试');
        const r = await save(data);
        return { ok: true, title: data.title, skuCount: data.skus.length, status: r.status };
      }
      case 'collectList': {                       // 列表页勾选批量采集
        const ids = [...new Set((msg.ids || []).map(String).filter((x) => /^\d{6,20}$/.test(x)))].slice(0, 100);
        if (state?.running || state?.paused) {
          const known = new Set(state.items.map((x) => x.offerId));
          state.items.push(...ids.filter((id) => !known.has(id)).map((offerId) => ({ offerId, status: 'pending' })));
          state.originTabId = sender.tab.id;
          await persist(); broadcast();
        } else {
          state = { items: ids.map((offerId) => ({ offerId, status: 'pending' })), running: false, paused: false, originTabId: sender.tab.id };
          await persist();
          runQueue();
        }
        return { ok: true, queued: ids.length };
      }
      case 'resume': resume(); return { ok: true };
      case 'cancel':
        if (state) { state.items.forEach((x) => { if (x.status === 'pending') x.status = 'cancelled'; }); await update({ paused: false }); }
        return { ok: true };
      case 'getState': return { state };
      case 'clearState': state = null; await chrome.storage.session.remove('queue'); return { ok: true };
      case 'status': {
        const { stats, session } = await chrome.storage.local.get(['stats', 'session']);
        return { version: VERSION, stats: stats ?? { total: 0 }, connected: !!session, delaySec: await getDelaySec() };
      }
      case 'setDelay': {
        const n = Math.min(Math.max(Number(msg.delaySec) || 0, 0), 60);
        await chrome.storage.local.set({ delaySec: n });
        return { ok: true, delaySec: n };
      }
      default: return { error: 'unknown message' };
    }
  })().then(reply, (e) => reply({ error: String(e.message || e) }));
  return true;   // 异步回复
});

// ERP 页面检测插件是否安装（externally_connectable）
chrome.runtime.onMessageExternal.addListener((msg, _sender, reply) => {
  if (msg?.type === 'ping') {
    chrome.storage.local.get('stats').then(({ stats }) => reply({ ok: true, version: VERSION, stats: stats ?? { total: 0 } }));
    return true;
  }
  reply({ error: 'unknown message' });
});
