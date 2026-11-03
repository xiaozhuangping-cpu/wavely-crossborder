export const PLATFORMS = {
  amazon: { label: 'Amazon', color: '#ff9900' },
  shopee: { label: 'Shopee', color: '#ee4d2d' },
  tiktok: { label: 'TikTok Shop', color: '#a855f7' },
  temu:   { label: 'Temu', color: '#fb7701' },
  site:   { label: '独立站', color: '#0e7490' },
};

export const ORDER_STATUS = {
  pending:    { label: '待付款', color: 'default' },
  paid:       { label: '待发货', color: 'warning' },
  shipped:    { label: '已发货', color: 'info' },
  in_transit: { label: '运输中', color: 'info' },
  delivered:  { label: '已妥投', color: 'success' },
  cancelled:  { label: '已取消', color: 'default' },
  refunded:   { label: '已退款', color: 'error' },
};

export const SHIP_STATUS = {
  label_created:    '已生成运单',
  picked_up:        '已揽收',
  in_transit:       '干线运输',
  customs:          '清关中',
  out_for_delivery: '派送中',
  delivered:        '已签收',
};

export const WAREHOUSE_KIND = { domestic: '国内仓', overseas: '海外仓', fba: 'FBA 仓' };

export const COUNTRIES = {
  US: '🇺🇸 美国', DE: '🇩🇪 德国', JP: '🇯🇵 日本', SG: '🇸🇬 新加坡', MY: '🇲🇾 马来西亚',
  GB: '🇬🇧 英国', CA: '🇨🇦 加拿大', AU: '🇦🇺 澳大利亚', CN: '🇨🇳 中国', FR: '🇫🇷 法国',
};

export const toChoices = (obj) =>
  Object.entries(obj).map(([id, v]) => ({ id, name: typeof v === 'string' ? v : v.label }));

export const fmtMoney = (v, currency = 'USD') =>
  v == null ? '-' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(v);

// 独立站商品页（可带 SKU 预选规格）
export const SHOP_BASE = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/';
export const shopUrl = (productId, skuId) => `${SHOP_BASE}#/p/${productId}${skuId ? `?sku=${skuId}` : ''}`;
