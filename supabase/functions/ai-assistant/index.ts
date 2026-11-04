// Wavely AI 运营助手：DeepSeek（OpenAI 兼容）+ 工具调用
// - 只读工具在服务端执行，且使用调用者自己的 JWT（遵守 RLS）
// - 写操作只生成「提案」，由前端展示确认卡片、用户确认后再执行
// - 每位访客每天 30 次、全站每天 1500 次调用上限
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handleChat, today, complete, parseJson, type ActionCtx } from '../_shared/llm.ts';

const systemPrompt = () => `你是「Wavely 跨境 ERP」里的 AI 运营助手，服务一家在 Amazon / Shopee / TikTok Shop / 独立站卖货的跨境品牌。
今天是 ${today()}（北京时间）。系统里有最近约 90 天的演示数据，金额统一折算为美元。

规则：
1. 涉及数字、订单、库存的问题，必须先调用工具查询，绝不编造数据。时间范围不明确时默认最近 30 天，并在回答里说明。
2. 写操作（发货、保存 Listing）只能调用 propose_* 工具生成提案，界面会弹出确认卡片，由用户点击确认后执行。不要声称已经完成。
3. 写多语言 Listing 时，先用 get_product 获取商品信息，再按目标站点语言写：标题 ≤ 200 字符、5 条要点、一段描述，符合当地电商平台的表达习惯，不夸大功效。
4. 工具返回的数据界面会自动画成图表/表格/确认卡片，回答里不要重复罗列全部数字，也不要把 Listing 全文再写一遍，给出 2-4 句结论和建议即可。
5. 用简体中文回答，简洁专业，可以用 Markdown。`;

const tools = [
  { type: 'function', function: {
    name: 'sales_summary', description: '按维度汇总销售额（美元）与订单数，已排除取消/退款订单（按 status 分组时除外）',
    parameters: { type: 'object', properties: {
      start_date: { type: 'string', description: '开始日期 YYYY-MM-DD' },
      end_date: { type: 'string', description: '结束日期 YYYY-MM-DD' },
      group_by: { type: 'string', enum: ['platform', 'country', 'shop', 'day', 'week', 'status'] },
    }, required: ['start_date', 'end_date', 'group_by'] } } },
  { type: 'function', function: {
    name: 'top_products', description: '查询畅销商品排行，可按国家（ISO 两位代码，如 DE/US/JP）或平台（amazon/shopee/tiktok/site）筛选',
    parameters: { type: 'object', properties: {
      start_date: { type: 'string' }, end_date: { type: 'string' },
      country: { type: 'string' }, platform: { type: 'string', enum: ['amazon', 'shopee', 'tiktok', 'site'] },
      limit: { type: 'integer', minimum: 1, maximum: 20 },
    }, required: ['start_date', 'end_date'] } } },
  { type: 'function', function: {
    name: 'low_stock', description: '查询低于安全库存的商品',
    parameters: { type: 'object', properties: { warehouse_kind: { type: 'string', enum: ['domestic', 'overseas', 'fba'] } } } } },
  { type: 'function', function: {
    name: 'find_orders', description: '查询订单列表（最新在前）',
    parameters: { type: 'object', properties: {
      status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'in_transit', 'delivered', 'cancelled', 'refunded'] },
      country: { type: 'string' }, platform: { type: 'string', enum: ['amazon', 'shopee', 'tiktok', 'site'] },
      limit: { type: 'integer', minimum: 1, maximum: 30 },
    } } } },
  { type: 'function', function: {
    name: 'get_product', description: '按 SKU 或商品名（中英文关键词）查找商品详情',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: {
    name: 'propose_ship_orders', description: '提议批量发货。只会包含「待发货/待付款」状态的订单，需要用户在界面确认',
    parameters: { type: 'object', properties: { order_ids: { type: 'array', items: { type: 'integer' }, maxItems: 30 } }, required: ['order_ids'] } } },
  { type: 'function', function: {
    name: 'propose_listing', description: '提议为商品保存某个站点语言的 Listing 文案，需要用户在界面确认',
    parameters: { type: 'object', properties: {
      product_id: { type: 'integer' },
      locale: { type: 'string', enum: ['en', 'de', 'ja', 'es', 'fr'] },
      title: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
      description: { type: 'string' },
    }, required: ['product_id', 'locale', 'title', 'bullets', 'description'] } } },
];

const ORDER_COLS = 'id,order_no,status,country,currency,total_amount,total_usd,created_at,shops(name,platform),customers(name)';

async function runTool(db: SupabaseClient, name: string, a: Record<string, any>) {
  const must = <T>(r: { data: T; error: any }) => { if (r.error) throw new Error(r.error.message); return r.data; };
  switch (name) {
    case 'sales_summary':
      return { rows: must(await db.rpc('ai_sales_summary', { p_start: a.start_date, p_end: a.end_date, p_group: a.group_by })), ...a };
    case 'top_products':
      return { rows: must(await db.rpc('ai_top_products', { p_start: a.start_date, p_end: a.end_date, p_country: a.country ?? null, p_platform: a.platform ?? null, p_limit: a.limit ?? 5 })), ...a };
    case 'low_stock': {
      let q = db.from('v_inventory').select('id,sku,product_name,warehouse_name,warehouse_kind,qty,safety_qty').eq('low_stock', true).order('qty').limit(20);
      if (a.warehouse_kind) q = q.eq('warehouse_kind', a.warehouse_kind);
      return { rows: must(await q) };
    }
    case 'find_orders': {
      let q = db.from('orders').select(a.platform ? ORDER_COLS.replace('shops(', 'shops!inner(') : ORDER_COLS)
        .order('created_at', { ascending: false }).limit(Math.min(a.limit ?? 10, 30));
      if (a.status) q = q.eq('status', a.status);
      if (a.country) q = q.eq('country', String(a.country).toUpperCase());
      if (a.platform) q = q.eq('shops.platform', a.platform);
      return { rows: must(await q) };
    }
    case 'get_product': {
      const kw = String(a.query ?? '').replace(/[%,()]/g, ' ').trim().slice(0, 40);
      const rows = must(await db.from('products').select('id,sku,name,description,category,price_usd,cost_cny,weight_g,listing,option_name,skus(id,sku,option_value,barcode,price_usd,cost_cny,status)')
        .or(`sku.ilike.*${kw}*,name->>zh.ilike.*${kw}*,name->>en.ilike.*${kw}*`).limit(5));
      return { rows };
    }
    case 'propose_ship_orders': {
      const ids = (a.order_ids ?? []).map(Number).filter(Number.isFinite).slice(0, 30);
      const rows = ids.length ? must(await db.from('orders').select(ORDER_COLS).in('id', ids).in('status', ['paid', 'pending'])) : [];
      return { pending_confirmation: true, orders: rows, skipped: ids.length - (rows as any[]).length };
    }
    case 'propose_listing': {
      const p = must(await db.from('products').select('id,sku,name').eq('id', a.product_id).maybeSingle());
      if (!p) throw new Error('商品不存在');
      return { pending_confirmation: true, product: p, locale: a.locale, title: String(a.title).slice(0, 250),
               bullets: (a.bullets ?? []).slice(0, 5).map((b: string) => String(b).slice(0, 500)), description: String(a.description).slice(0, 2000) };
    }
    default:
      throw new Error(`未知工具 ${name}`);
  }
}

// 批量把 1688 标题改写为多语言商品名（采集箱批量导入用）
const LANGS = ['zh', 'en', 'de', 'ja', 'es'] as const;
async function translateNames({ body, llm }: ActionCtx) {
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 20)
    .map((x: any) => ({ id: String(x?.id ?? ''), title: String(x?.title ?? '').slice(0, 200) }))
    .filter((x) => x.id && x.title);
  if (!items.length) throw new Error('没有需要翻译的商品');
  const text = await complete(llm, [
    { role: 'system', content: `你是跨境电商商品文案编辑。输入是 1688 批发商品标题（常堆砌关键词、营销词、批发用语）。
为每个商品写简洁的商品名：
- zh：中文名 ≤ 20 字；en / de / es：≤ 60 个字符，符合当地电商标题习惯，首字母大写；ja：≤ 30 字
- 去掉营销词（爆款、新款、2026 年份、ins 风、网红等）、批发用语（厂家、批发、一件代发、跨境、货源）和尺码体重说明
- 保留品类、关键材质与卖点；不要编造原标题没有的信息
只输出 JSON：{"items":[{"id":"…","zh":"…","en":"…","de":"…","ja":"…","es":"…"}]}，id 原样返回。` },
    { role: 'user', content: JSON.stringify({ items }) },
  ], { json: true, maxTokens: 200 + items.length * 220 });
  const out = parseJson(text);
  const byId = new Map(items.map((x) => [x.id, x]));
  return {
    items: (Array.isArray(out?.items) ? out.items : []).filter((x: any) => byId.has(String(x?.id))).map((x: any) => ({
      id: String(x.id),
      ...Object.fromEntries(LANGS.map((l) => [l, String(x[l] ?? '').trim().slice(0, l === 'zh' || l === 'ja' ? 40 : 120)]).filter(([, v]) => v)),
    })),
  };
}

// 整个商品的多语言：商品名（中文同时精简）、规格名、各维度规格值、描述。每次最多 5 个商品 / 80 个规格值
const FOREIGN = ['en', 'de', 'ja', 'es'] as const;
const pick = (o: any, langs: readonly string[], max = 120) =>
  Object.fromEntries(langs.map((l) => [l, String(o?.[l] ?? '').trim().slice(0, max)]).filter(([, v]) => v));

type Dim = { name: string; values: string[] };
type Item = { id: string; title: string; dims: Dim[]; description: string };

async function translateProducts({ body, llm }: ActionCtx) {
  let budget = 80;
  const items: Item[] = (Array.isArray(body.items) ? body.items : []).slice(0, 5).map((x: any): Item => {
    const dims: Dim[] = (Array.isArray(x?.dims) ? x.dims : []).slice(0, 3).map((d: any) => {
      const values = (Array.isArray(d?.values) ? d.values : []).map((v: any) => String(v).slice(0, 60)).slice(0, Math.max(budget, 0));
      budget -= values.length;
      return { name: String(d?.name ?? '').slice(0, 20), values };
    });
    return { id: String(x?.id ?? ''), title: String(x?.title ?? '').slice(0, 200), dims, description: String(x?.description ?? '').slice(0, 300) };
  }).filter((x: Item) => x.id && x.title);
  if (!items.length) throw new Error('没有需要翻译的商品');
  const nValues = items.reduce((s, x) => s + x.dims.reduce((t, d) => t + d.values.length, 0), 0);

  const text = await complete(llm, [
    { role: 'system', content: `你是跨境电商本地化编辑。输入是 1688 批发商品（标题常堆砌关键词、营销词、批发用语），把每个商品本地化为 zh / en / de / ja / es：
1. name：简洁商品名。zh ≤ 20 字；en / de / es ≤ 60 个字符、符合当地电商标题习惯；ja ≤ 30 字。去掉营销词（爆款、新款、年份、ins 风、网红）、批发用语（厂家、批发、一件代发、跨境、货源）和尺码体重说明，保留品类、材质与卖点，不编造。
2. dims：与输入 dims 一一对应、顺序不变。name 为规格名的 en/de/ja/es 译名；values 为与输入 values 一一对应、长度相同的数组，每项给出 en/de/ja/es 简短译名（颜色、尺码等常用说法，尺码字母如 S/M/L/XL 保持原样，括号里的体重身高说明换算成当地习惯可省略，去掉"不退不换""拍此选项"等交易说明）。
3. description：把中文属性描述译为 en/de/ja/es 的一两句自然描述（≤ 200 字符），没有描述则省略。
只输出 JSON：{"items":[{"id":"…","name":{"zh":"…","en":"…","de":"…","ja":"…","es":"…"},"dims":[{"name":{"en":"…","de":"…","ja":"…","es":"…"},"values":[{"en":"…","de":"…","ja":"…","es":"…"}]}],"description":{"en":"…","de":"…","ja":"…","es":"…"}}]}，id 原样返回。` },
    { role: 'user', content: JSON.stringify({ items }) },
  ], { json: true, maxTokens: Math.min(8000, 400 + items.length * 600 + nValues * 70) });

  const out = parseJson(text);
  const byId = new Map(items.map((x) => [x.id, x]));
  return {
    items: (Array.isArray(out?.items) ? out.items : []).filter((x: any) => byId.has(String(x?.id))).map((x: any) => {
      const src = byId.get(String(x.id))!;
      return {
        id: src.id,
        name: { ...pick(x.name, FOREIGN), ...pick(x.name, ['zh'], 40) },
        // 规格按输入对齐；模型漏掉或长度不符的项保持为空，前端回退中文
        dims: src.dims.map((d: Dim, i: number) => {
          const od = Array.isArray(x.dims) ? x.dims[i] : null;
          const vals = Array.isArray(od?.values) && od.values.length === d.values.length ? od.values : [];
          return { name: pick(od?.name, FOREIGN, 40), values: d.values.map((_: string, j: number) => pick(vals[j], FOREIGN, 80)) };
        }),
        description: pick(x.description, FOREIGN, 400),
      };
    }),
  };
}

Deno.serve((req) => handleChat(req, {
  systemPrompt, tools, runTool,
  actions: { translate_names: translateNames, translate_products: translateProducts },
  isProposal: (r) => !!r?.pending_confirmation,
  messages: { tooMany: '你今天的内置 AI 额度（30 次）已用完。可以点右上角 ⚙ 填自己的 API Key 继续使用，或明天再来' },
}));
