// Wavely 独立站 AI 客服：多语言导购、订单物流查询、店铺政策问答（只读）
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handleChat, today } from '../_shared/llm.ts';

const LANG_NAME: Record<string, string> = { en: 'English', de: 'Deutsch', zh: '简体中文', ja: '日本語', es: 'Español' };

const systemPrompt = (body: Record<string, unknown>) => {
  const lang = LANG_NAME[String(body.lang)] ? String(body.lang) : 'en';
  const currency = /^[A-Z]{3}$/.test(String(body.currency)) ? String(body.currency) : 'USD';
  return `You are the friendly customer-service assistant of "Wavely", a cross-border online store selling home, outdoor, pet, beauty and tech accessories.
Today is ${today()}. The shopper's site language is ${LANG_NAME[lang]} and their display currency is ${currency}.

Store policies (the only facts you may state about policies):
- Free worldwide shipping on every order. Orders ship within 24h from local warehouses (US: Los Angeles, EU: Frankfurt) or from Shenzhen.
- Typical delivery: US 3–6 business days, EU 5–8, UK 5–8, Japan 4–7, Singapore/Malaysia 4–7, elsewhere 7–12.
- 30-day hassle-free returns for unused items in original packaging; refund within 5 business days after the return arrives.
- Shoppers do not have accounts. They can track any order on the "Track order" page (top of the site) with their order number.
- Payment: this is a DEMO store, no real payment is taken. Never ask for card numbers, passwords or real personal data.

Rules:
1. Reply in the same language the shopper writes in (default ${LANG_NAME[lang]}). Be warm, concise, and helpful.
2. For product questions ALWAYS call search_products first. Only recommend products returned by the tool; never invent products, prices, stock or features.
   The interface shows product cards with "Add to cart" buttons automatically, so do not list every field again — give a short reason for each pick.
3. Products may have several variants (skus: color/size/pack…) with their own prices; mention the options briefly when relevant. Prices from tools are in USD. If you mention a price, you may quote it in USD; the cards already show ${currency}.
4. For order status ask for the order number (format like WV261104123456) and call track_order. Never guess an order status. Use the order's country to pick the delivery estimate.
5. If something is outside your knowledge (e.g. warranty claims, wholesale), say a human teammate will follow up by email — do not make promises.`;
};

const tools = [
  { type: 'function', function: {
    name: 'search_products',
    description: 'Search the store catalog. Use English or Chinese keywords; leave query empty to browse a category. Categories (Chinese values): 家居 home, 户外 outdoor, 宠物 pets, 美妆 beauty, 数码配件 tech.',
    parameters: { type: 'object', properties: {
      query: { type: 'string', description: 'keyword, e.g. "cat", "charger", "猫"' },
      category: { type: 'string', enum: ['家居', '户外', '宠物', '美妆', '数码配件'] },
      max_price_usd: { type: 'number' },
      limit: { type: 'integer', minimum: 1, maximum: 6 },
    } } } },
  { type: 'function', function: {
    name: 'track_order', description: 'Look up an order and its shipping timeline by order number',
    parameters: { type: 'object', properties: { order_no: { type: 'string' } }, required: ['order_no'] } } },
];

async function runTool(db: SupabaseClient, name: string, a: Record<string, any>) {
  if (name === 'search_products') {
    let q = db.from('products').select('id,sku,name,description,category,price_usd,listing,image_url,option_name,skus(id,sku,option_value,price_usd,image_url,status,sort)').eq('status', 'active').order('price_usd').limit(Math.min(a.limit ?? 4, 6));
    if (a.category) q = q.eq('category', a.category);
    if (a.max_price_usd) q = q.lte('price_usd', a.max_price_usd);
    const kw = String(a.query ?? '').replace(/[%,()*]/g, ' ').trim().slice(0, 40);
    if (kw) q = q.or(`sku.ilike.*${kw}*,name->>zh.ilike.*${kw}*,name->>en.ilike.*${kw}*,name->>ja.ilike.*${kw}*,name->>es.ilike.*${kw}*,listing->de->>title.ilike.*${kw}*,description->>en.ilike.*${kw}*`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    // 只给模型必要字段，listing 只保留标题，避免上下文过长
    return { rows: (data ?? []).map((p: any) => ({ ...p, listing: Object.fromEntries(Object.entries(p.listing ?? {}).map(([k, v]: any) => [k, { title: v.title }])) })) };
  }
  if (name === 'track_order') {
    const no = String(a.order_no ?? '').trim().toUpperCase().slice(0, 20);
    const { data, error } = await db.rpc('track_order', { p_order_no: no });
    if (error) throw new Error(error.message);
    return data ?? { not_found: true, order_no: no };
  }
  throw new Error(`unknown tool ${name}`);
}

Deno.serve((req) => handleChat(req, {
  systemPrompt, tools, runTool,
  messages: { tooMany: 'Daily AI demo limit reached — please come back tomorrow. / 今天的 AI 演示额度已用完，明天再来试试吧' },
}));
