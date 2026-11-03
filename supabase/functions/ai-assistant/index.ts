// Wavely AI 运营助手：DeepSeek（OpenAI 兼容）+ 工具调用
// - 只读工具在服务端执行，且使用调用者自己的 JWT（遵守 RLS）
// - 写操作只生成「提案」，由前端展示确认卡片、用户确认后再执行
// - 每位访客每天 30 次、全站每天 1500 次调用上限
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = Deno.env.get('DEEPSEEK_MODEL') ?? 'deepseek-chat';
const MAX_ROUNDS = 5;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // 北京时间

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
      const rows = must(await db.from('products').select('id,sku,name,description,category,price_usd,cost_cny,weight_g,listing')
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) return json({ error: 'AI 服务未配置' }, 500);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization') ?? '';

  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!user) return json({ error: '请先进入演示' }, 401);

  let body: { messages?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: '请求格式错误' }, 400); }
  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: '缺少用户消息' }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: quota, error: qErr } = await admin.rpc('ai_take_quota', { p_user: user.id });
  if (qErr) return json({ error: '配额检查失败' }, 500);
  if (!quota.ok) {
    return json({ error: quota.reason === 'global' ? '今天全站的 AI 演示额度已用完，明天再来试试吧' : `你今天的 ${quota.limit} 次 AI 演示额度已用完，明天再来试试吧` }, 429);
  }

  const messages: any[] = [{ role: 'system', content: systemPrompt() }, ...history];
  const parts: any[] = [];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL, messages, tools, temperature: 0.3, max_tokens: 1500 }),
      });
      if (!res.ok) {
        console.error('deepseek', res.status, (await res.text()).slice(0, 500));
        return json({ error: `AI 服务暂时不可用（${res.status}）`, parts }, 502);
      }
      const msg = (await res.json()).choices?.[0]?.message;
      if (!msg) return json({ error: 'AI 没有返回内容', parts }, 502);

      if (!msg.tool_calls?.length) {
        return json({ parts, text: msg.content ?? '', quota: { used: quota.used, limit: quota.limit } });
      }

      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args: Record<string, any> = {};
        let result: any;
        try {
          args = JSON.parse(call.function.arguments || '{}');
          result = await runTool(db, call.function.name, args);
        } catch (e) {
          result = { error: (e as Error).message };
        }
        parts.push({ toolCallId: call.id, toolName: call.function.name, args, result });
        const forModel = result?.pending_confirmation
          ? { ...result, note: '已在界面展示确认卡片，等待用户点击确认。请提示用户确认，不要声称已经执行。' }
          : result;
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(forModel).slice(0, 8000) });
      }
    }
    return json({ parts, text: '这个问题需要的步骤有点多，我先停在这里。可以把问题拆小一点再问我。' });
  } catch (e) {
    console.error(e);
    return json({ error: 'AI 处理失败，请稍后再试', parts }, 500);
  }
});
