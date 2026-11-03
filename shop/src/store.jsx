import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { detectLang, t } from './i18n';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const ERP_URL = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/erp/';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'MYR'];
const LANG_CURRENCY = { en: 'USD', de: 'EUR', zh: 'USD', ja: 'JPY', es: 'EUR' };

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等情况下忽略 */ } };

const Ctx = createContext(null);

export const StoreProvider = ({ children }) => {
  const [lang, setLang] = useState(() => load('wv.lang', detectLang()));
  const [currency, setCurrency] = useState(() => load('wv.currency', LANG_CURRENCY[load('wv.lang', detectLang())] ?? 'USD'));
  const [rates, setRates] = useState({ USD: 1 });
  const [products, setProducts] = useState(null);
  const [cart, setCart] = useState(() => load('wv.cart', []));      // [{id, qty}]
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
    supabase.from('products').select('id,sku,name,description,category,price_usd,weight_g,listing').order('id').then(({ data, error }) => {
      setProducts(error ? [] : data);
    });
  }, []);

  const price = useCallback((usd) => {
    const r = rates[currency] ?? 1;
    const v = Number(usd) / r;
    return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : lang, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(currency === 'JPY' ? Math.round(v) : v);
  }, [rates, currency, lang]);

  const add = (id, qty = 1) => setCart((c) => {
    const i = c.findIndex((x) => x.id === id);
    if (i < 0) return [...c, { id, qty: Math.min(qty, 10) }];
    const n = [...c]; n[i] = { ...n[i], qty: Math.min(n[i].qty + qty, 10) }; return n;
  });
  const setQty = (id, qty) => setCart((c) => (qty <= 0 ? c.filter((x) => x.id !== id) : c.map((x) => (x.id === id ? { ...x, qty: Math.min(qty, 10) } : x))));
  const clear = () => setCart([]);

  const lines = useMemo(() => cart.map((l) => ({ ...l, product: products?.find((p) => p.id === l.id) })).filter((l) => l.product), [cart, products]);
  const subtotalUsd = lines.reduce((s, l) => s + Number(l.product.price_usd) * l.qty, 0);
  const shippingUsd = 0;   // 演示站全球包邮，与 place_order 记账一致

  const value = {
    lang, setLang, tr: t(lang), currency, setCurrency, rates, price, products,
    cart, lines, add, setQty, clear, count: cart.reduce((s, l) => s + l.qty, 0), subtotalUsd, shippingUsd,
    cartOpen, setCartOpen, orders, addOrder: (no) => setOrders((o) => [no, ...o.filter((x) => x !== no)].slice(0, 10)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useStore = () => useContext(Ctx);
