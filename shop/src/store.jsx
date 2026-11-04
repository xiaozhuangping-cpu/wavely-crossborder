import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { detectLang, t } from './i18n';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const ERP_URL = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/erp/';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'MYR'];
const LANG_CURRENCY = { en: 'USD', de: 'EUR', zh: 'USD', ja: 'JPY', es: 'EUR' };
const LANGS = Object.keys(LANG_CURRENCY);

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等情况下忽略 */ } };

const Ctx = createContext(null);

export const StoreProvider = ({ children }) => {
  // ?lang= 优先（分享指定语言的链接用），其次上次选择，最后按浏览器语言
  const [lang, setLang] = useState(() => {
    const q = new URLSearchParams(location.search).get('lang');
    return LANGS.includes(q) ? q : load('wv.lang', detectLang());
  });
  const [currency, setCurrency] = useState(() => load('wv.currency', LANG_CURRENCY[lang] ?? 'USD'));
  const [rates, setRates] = useState({ USD: 1 });
  const [products, setProducts] = useState(null);
  // [{skuId, qty}]；旧版按商品存的购物车直接丢弃
  const [cart, setCart] = useState(() => load('wv.cart', []).filter((x) => x.skuId));
  const [cartOpen, setCartOpen] = useState(false);
  const [orders, setOrders] = useState(() => load('wv.orders', [])); // 最近下单的订单号

  useEffect(() => { save('wv.lang', lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { save('wv.currency', currency); }, [currency]);
  useEffect(() => { save('wv.cart', cart); }, [cart]);
  useEffect(() => { save('wv.orders', orders); }, [orders]);

  useEffect(() => {
    supabase.from('exchange_rates').select('currency,rate_to_usd').then(({ data }) => {
      if (data) setRates(Object.fromEntries(data.map((r) => [r.currency, Number(r.rate_to_usd)])));
    });
    supabase.from('products').select('id,sku,name,description,category,price_usd,weight_g,listing,image_url,option_name,video_url,video_poster,skus(id,sku,option_value,price_usd,image_url,status,sort)').eq('status', 'active').order('id').then(({ data, error }) => {
      setProducts(error ? [] : data);
    });
  }, []);

  const price = useCallback((usd) => {
    const r = rates[currency] ?? 1;
    const v = Number(usd) / r;
    return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : lang, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(currency === 'JPY' ? Math.round(v) : v);
  }, [rates, currency, lang]);

  const add = (skuId, qty = 1) => setCart((c) => {
    const i = c.findIndex((x) => x.skuId === skuId);
    if (i < 0) return [...c, { skuId, qty: Math.min(qty, 10) }];
    const n = [...c]; n[i] = { ...n[i], qty: Math.min(n[i].qty + qty, 10) }; return n;
  });
  const setQty = (skuId, qty) => setCart((c) => (qty <= 0 ? c.filter((x) => x.skuId !== skuId) : c.map((x) => (x.skuId === skuId ? { ...x, qty: Math.min(qty, 10) } : x))));
  const clear = () => setCart([]);

  const lines = useMemo(() => cart.map((l) => {
    const product = products?.find((p) => p.skus?.some((k) => k.id === l.skuId));
    return { ...l, id: l.skuId, product, sku: product?.skus.find((k) => k.id === l.skuId) };
  }).filter((l) => l.sku && l.sku.status === 'active'), [cart, products]);
  const subtotalUsd = lines.reduce((s, l) => s + Number(l.sku.price_usd) * l.qty, 0);
  const shippingUsd = 0;   // 演示站全球包邮，与 place_order 记账一致

  const value = {
    lang, setLang, tr: t(lang), currency, setCurrency, rates, price, products,
    cart, lines, add, setQty, clear, count: cart.reduce((s, l) => s + l.qty, 0), subtotalUsd, shippingUsd,
    cartOpen, setCartOpen, orders, addOrder: (no) => setOrders((o) => [no, ...o.filter((x) => x !== no)].slice(0, 10)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useStore = () => useContext(Ctx);

// ---------- SKU 工具 ----------
export const activeSkus = (p) => (p?.skus ?? []).filter((k) => k.status === 'active').sort((a, b) => a.sort - b.sort || a.id - b.id);
export const optionLabel = (obj, lang) => obj?.[lang] || obj?.en || obj?.zh || '';
export const priceFrom = (p) => { const ps = activeSkus(p).map((k) => Number(k.price_usd)); return ps.length ? Math.min(...ps) : Number(p?.price_usd); };
export const hasVariants = (p) => activeSkus(p).length > 1;
