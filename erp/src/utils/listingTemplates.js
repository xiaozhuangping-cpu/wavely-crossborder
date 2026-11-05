// 平台上架模板：把商品（SPU + SKU + 多语言 Listing）整理成各平台批量上架表格的行
// - Shopify：官方商品 CSV 格式，可在 Shopify 后台「商品 → 导入」直接上传
// - Amazon / Shopee / TikTok Shop：按各平台批量上架模板的字段整理；平台模板随类目变化，
//   需在卖家后台下载对应类目模板，把本表各列粘贴进去（列名与平台模板一致）
// 纯函数，不依赖 React / Supabase，方便单独验证

export const PLATFORMS = {
  shopify: { label: 'Shopify', group: 'Shopify', lang: 'en', currency: 'USD', titleMax: 255, format: 'csv' },
  amazon_us: { label: 'Amazon 美国站', group: 'Amazon', lang: 'en', currency: 'USD', titleMax: 200, needGtin: true },
  amazon_de: { label: 'Amazon 德国站', group: 'Amazon', lang: 'de', currency: 'EUR', titleMax: 200, needGtin: true },
  amazon_jp: { label: 'Amazon 日本站', group: 'Amazon', lang: 'ja', currency: 'JPY', titleMax: 200, needGtin: true },
  shopee_sg: { label: 'Shopee 新加坡', group: 'Shopee', lang: 'en', currency: 'SGD', titleMax: 120 },
  shopee_my: { label: 'Shopee 马来西亚', group: 'Shopee', lang: 'en', currency: 'MYR', titleMax: 120 },
  tiktok_us: { label: 'TikTok Shop 美国', group: 'TikTok', lang: 'en', currency: 'USD', titleMax: 255 },
  tiktok_uk: { label: 'TikTok Shop 英国', group: 'TikTok', lang: 'en', currency: 'GBP', titleMax: 255 },
};

const LANG_LABEL = { en: '英文', de: '德语', ja: '日语', es: '西语', fr: '法语', zh: '中文' };

// ERP 类目 → 平台类目参考（平台类目 ID 需在后台选择，这里只给英文名方便搜索）
const CATEGORY_HINT = {
  数码配件: 'Electronics > Accessories', 美妆: 'Beauty & Personal Care', 宠物: 'Pet Supplies',
  户外: 'Sports & Outdoors', 家居: 'Home & Kitchen',
};

// 美元基准价 → 目标币种：JPY 取整到 10 円，其他币种取 .99 尾数
export function localPrice(usd, currency, rates) {
  const rate = Number(rates[currency] ?? (currency === 'USD' ? 1 : NaN));
  if (!rate) return null;
  const v = Number(usd) / rate;
  if (currency === 'JPY') return Math.ceil(v / 10) * 10;
  return Math.max(0.99, Math.ceil(v) - 0.01);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// 取目标语言文案；缺失时回退英文（再回退中文），并记录问题
function textsFor(p, lang, issue) {
  const l = p.listing?.[lang] ?? {};
  const en = p.listing?.en ?? {};
  const fallback = [];
  const pick = (field, ...cands) => {
    for (const [v, isTarget] of cands) if (v) { if (!isTarget) fallback.push(field); return v; }
    return '';
  };
  const title = pick('标题', [l.title, true], [p.name?.[lang], true], [en.title, false], [p.name?.en, false], [p.name?.zh, false]);
  const description = pick('描述', [l.description, true], [p.description?.[lang], true], [en.description, false], [p.description?.en, false], [p.description?.zh, false]);
  let bullets = l.bullets?.length ? l.bullets : [];
  if (!bullets.length && en.bullets?.length) { bullets = en.bullets; fallback.push('卖点'); }
  if (fallback.length) {
    const toZh = lang !== 'en' ? '英文' : '中文';
    issue('warn', `缺少${LANG_LABEL[lang] ?? lang}${fallback.join('、')}，已用${toZh}代替`);
  }
  if (!title) issue('error', '没有任何语言的商品标题');
  return { title, description, bullets };
}

const optionText = (obj, lang) => obj?.[lang] || obj?.en || obj?.zh || '';

// products: [{ ...product, skus: [...] }]；stock: { [sku_id]: qty }；rates: { EUR: 1.08, ... }（1 单位外币 = x 美元）
export function buildListing(platformKey, products, { stock = {}, rates = {}, brand = 'Wavely' } = {}) {
  const pf = PLATFORMS[platformKey];
  const issues = [];
  const rows = [];
  const handles = new Set();
  let skuCount = 0;

  for (const p of products) {
    const issue = (level, msg, sku) => issues.push({ level, product: p.sku, sku: sku ?? '', name: p.name?.zh ?? '', message: msg });
    const skus = (p.skus ?? []).filter((s) => s.status !== 'inactive').sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    if (!skus.length) { issue('error', '没有在售 SKU，已跳过'); continue; }
    if (p.status !== 'active') issue('warn', `商品状态为「${p.status}」，上架前请确认`);

    const t = textsFor(p, pf.lang, issue);
    if (t.title.length > pf.titleMax) issue('warn', `标题 ${t.title.length} 字符，超过 ${pf.label} 上限 ${pf.titleMax}`);
    if (!p.image_url) issue('error', '缺少主图');
    if (pf.group === 'Amazon' && t.bullets.length < 3) issue('warn', '五点描述不足 3 条（可用 AI 运营助手生成 Listing）');

    const multi = skus.length > 1;
    const optName = multi ? optionText(p.option_name, pf.lang) || 'Option' : '';
    const v = skus.map((s) => {
      const price = localPrice(s.price_usd, pf.currency, rates);
      if (price == null) issue('error', `缺少 ${pf.currency} 汇率，无法换算售价`, s.sku);
      if (pf.needGtin && !s.barcode) issue('error', '缺少 EAN 条码（Amazon 需要 GTIN 或品牌备案豁免）', s.sku);
      const qty = stock[s.id] ?? 0;
      if (!qty) issue('warn', '库存为 0', s.sku);
      return { s, price, qty, value: optionText(s.option_value, pf.lang), image: s.image_url || p.image_url, kg: +(Number(s.weight_g ?? p.weight_g ?? 0) / 1000).toFixed(3) };
    });
    skuCount += v.length;

    if (pf.group === 'Shopify') {
      let handle = slug(p.name?.en) || slug(p.sku);
      if (handles.has(handle)) handle = `${handle}-${slug(p.sku)}`;
      handles.add(handle);
      const body = [t.description && `<p>${esc(t.description)}</p>`, t.bullets.length && `<ul>${t.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`].filter(Boolean).join('');
      v.forEach((x, i) => rows.push({
        Handle: handle,
        Title: i === 0 ? t.title : '', 'Body (HTML)': i === 0 ? body : '', Vendor: i === 0 ? brand : '',
        'Product Category': '', Type: i === 0 ? (CATEGORY_HINT[p.category] ?? p.category) : '', Tags: i === 0 ? [p.category, CATEGORY_HINT[p.category]].filter(Boolean).join(', ') : '',
        Published: i === 0 ? 'TRUE' : '',
        'Option1 Name': i === 0 ? (multi ? optName : 'Title') : '', 'Option1 Value': multi ? x.value : 'Default Title',
        'Variant SKU': x.s.sku, 'Variant Grams': Math.round(x.kg * 1000), 'Variant Inventory Tracker': 'shopify', 'Variant Inventory Qty': x.qty,
        'Variant Inventory Policy': 'deny', 'Variant Fulfillment Service': 'manual', 'Variant Price': x.price ?? '',
        'Variant Requires Shipping': 'TRUE', 'Variant Taxable': 'TRUE', 'Variant Barcode': x.s.barcode ?? '',
        'Image Src': i === 0 ? p.image_url ?? '' : (x.s.image_url ?? ''), 'Image Position': i === 0 ? 1 : (x.s.image_url ? i + 1 : ''),
        'Variant Image': x.s.image_url ?? '', 'Variant Weight Unit': 'g', Status: p.status === 'active' ? 'active' : 'draft',
      }));
    } else if (pf.group === 'Amazon') {
      const en = (p.option_name?.en ?? '').toLowerCase();
      const theme = /colou?r/.test(en) ? 'Color' : /size/.test(en) ? 'Size' : 'Style';
      const base = {
        feed_product_type: '', category_hint: CATEGORY_HINT[p.category] ?? p.category, brand_name: brand, item_name: t.title,
        product_description: t.description, ...Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`bullet_point${i + 1}`, t.bullets[i] ?? ''])),
        currency: pf.currency, condition_type: 'New',
      };
      if (multi) rows.push({ ...base, item_sku: p.sku, parent_child: 'parent', variation_theme: theme, main_image_url: p.image_url ?? '' });
      v.forEach((x) => rows.push({
        ...base, item_sku: x.s.sku, external_product_id: x.s.barcode ?? '', external_product_id_type: x.s.barcode ? 'EAN' : '',
        standard_price: x.price ?? '', quantity: x.qty, main_image_url: x.image ?? '',
        parent_child: multi ? 'child' : '', parent_sku: multi ? p.sku : '', relationship_type: multi ? 'Variation' : '', variation_theme: multi ? theme : '',
        color_name: multi && theme === 'Color' ? x.value : '', size_name: multi && theme === 'Size' ? x.value : '', style_name: multi && theme === 'Style' ? x.value : '',
        item_weight: x.kg, item_weight_unit_of_measure: 'KG',
      }));
    } else if (pf.group === 'Shopee') {
      v.forEach((x) => rows.push({
        Category: CATEGORY_HINT[p.category] ?? p.category, 'Product Name': t.title,
        'Product Description': [t.description, ...t.bullets.map((b) => `• ${b}`)].filter(Boolean).join('\n'),
        'Parent SKU': p.sku, 'Variation Integration No.': multi ? p.sku : '',
        'Variation Name1': optName, 'Option for Variation 1': multi ? x.value : '', 'Image per Variation': multi ? (x.s.image_url ?? '') : '',
        Price: x.price ?? '', Stock: x.qty, SKU: x.s.sku, 'Cover image': p.image_url ?? '', 'Weight (kg)': x.kg, Brand: brand,
      }));
    } else if (pf.group === 'TikTok') {
      v.forEach((x) => rows.push({
        Category: CATEGORY_HINT[p.category] ?? p.category, Brand: brand, 'Product Name': t.title,
        'Product Description': [t.description, ...t.bullets.map((b) => `• ${b}`)].filter(Boolean).join('\n'),
        'Main Image': p.image_url ?? '', 'Package Weight (kg)': x.kg,
        'Variation 1 Name': optName, 'Variation 1 Value': multi ? x.value : '', 'Variation 1 Image': multi ? (x.s.image_url ?? '') : '',
        [`Retail Price (${pf.currency})`]: x.price ?? '', Quantity: x.qty, 'Seller SKU': x.s.sku,
        'GTIN Type': x.s.barcode ? 'EAN' : '', 'GTIN Code': x.s.barcode ?? '',
      }));
    }
  }
  const columns = rows.length ? Object.keys(rows.reduce((a, r) => Object.assign(a, r), {})) : [];
  return { platform: pf, rows, columns, issues, productCount: products.length, skuCount };
}

// 每个平台的导入说明（写进 Excel「填写说明」页）
export const GUIDE = {
  Shopify: ['Shopify 后台 → 商品 → 导入，上传本 CSV', '图片地址需公网可访问；导入后在商品页选择 Shopify 标准类目', '价格按汇率换算为店铺币种（.99 尾数）'],
  Amazon: ['Seller Central → 目录 → 批量上传商品，下载对应类目的库存模板', '把本表各列按列名粘贴进模板（列名与模板属性名一致），并在 feed_product_type 选择商品类型', '无 EAN 时需先完成品牌备案或申请 GTIN 豁免', 'category_hint 仅供搜索类目，不需要上传'],
  Shopee: ['Seller Centre → 商品 → 批量上传，下载基础模板', '把本表各列粘贴到模板对应列；Category 需替换为模板里的类目 ID', '同一「Variation Integration No.」的行会合并为一个多规格商品'],
  TikTok: ['Seller Center → 商品 → 批量上传，按类目下载模板', '把本表各列粘贴到模板对应列；Category 需替换为模板里的类目', '价格为店铺本地币种'],
};

export function toCsv(columns, rows) {
  const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns.map(cell).join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n');
}
