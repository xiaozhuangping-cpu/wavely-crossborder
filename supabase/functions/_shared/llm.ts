// 两个 AI 助手共用：鉴权、配额、OpenAI 兼容的流式工具调用循环、SSE 输出
// - 默认使用站点内置的 DeepSeek（计入每日配额）
// - 访客可在前端填自己的 OpenAI 兼容服务（baseUrl + apiKey + model），此时不计配额；
//   Key 只随本次请求转发给对应服务，不落库、不写日志
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const BUILTIN_BASE = 'https://api.deepseek.com';
const BUILTIN_MODEL = Deno.env.get('DEEPSEEK_MODEL') ?? 'deepseek-chat';
const MAX_ROUNDS = 5;

type Llm = { base: string; key: string; model: string; own: boolean };

// 自定义服务地址：只允许 https 公网域名，防止被当作跳板访问内网（SSRF）
function parseBase(raw: unknown): string | null {
  let u: URL;
  try { u = new URL(String(raw ?? '').trim()); } catch { return null; }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (!h.includes('.') || h === 'localhost' || /\.(local|internal|localhost)$/.test(h)) return null;
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return null;   // 不接受 IP 直连
  return u.origin + u.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
}

function resolveLlm(body: Body, builtinKey: string | undefined): Llm | { error: string } {
  const c = (body.llm ?? {}) as Record<string, unknown>;
  const key = typeof c.apiKey === 'string' ? c.apiKey.trim() : '';
  if (!key) return builtinKey ? { base: BUILTIN_BASE, key: builtinKey, model: BUILTIN_MODEL, own: false } : { error: 'AI 服务未配置' };
  const base = parseBase(c.baseUrl);
  if (!base) return { error: '接口地址无效：需要 https 公网地址 / Invalid API base URL (https only)' };
  const model = typeof c.model === 'string' ? c.model.trim().slice(0, 120) : '';
  if (!model) return { error: '请选择模型 / Please choose a model' };
  if (key.length > 400 || /\s/.test(key)) return { error: 'API Key 格式不正确 / Invalid API key' };
  return { base, key, model, own: true };
}

// 上游错误：自带 Key 时把服务商的报错原文（截断）带给用户，方便排查 Key/模型名
async function upstreamError(res: Response, own: boolean) {
  const raw = await res.text().catch(() => '');
  if (!own) { console.error('llm', res.status, raw.slice(0, 500)); return `AI service unavailable (${res.status})`; }
  let msg = raw;
  try { const j = JSON.parse(raw); msg = j.error?.message ?? j.message ?? j.error ?? raw; } catch { /* 原文 */ }
  const hint = res.status === 401 || res.status === 403 ? ' — API Key 无效或无权限 / check your API key'
    : res.status === 404 ? ' — 模型名或接口地址不对 / check model & base URL' : '';
  return `Model API error ${res.status}: ${String(msg).slice(0, 200)}${hint}`;
}

// 各家参数差异：OpenAI 新模型不接受 max_tokens / 非默认 temperature
const requestBody = (llm: Llm, messages: unknown[], tools: unknown[]) => {
  const openai = new URL(llm.base).hostname === 'api.openai.com';
  return {
    model: llm.model, messages, tools, stream: true,
    ...(openai ? { max_completion_tokens: 2000 } : { temperature: 0.3, max_tokens: 1500 }),
  };
};

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // 北京时间

type Body = { messages?: { role: string; content: string }[]; [k: string]: unknown };

export type ChatConfig = {
  systemPrompt: (body: Body) => string;
  tools: unknown[];
  runTool: (db: SupabaseClient, name: string, args: Record<string, any>) => Promise<unknown>;
  /** 工具结果是否为「待用户确认的提案」 */
  isProposal?: (result: any) => boolean;
  messages?: { tooMany: string };
};

export async function handleChat(req: Request, cfg: ChatConfig): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('Authorization') ?? '';

  // 用调用者自己的 JWT 访问数据库：所有读取都受 RLS 约束
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!user) return json({ error: 'Unauthorized' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const llm = resolveLlm(body, Deno.env.get('DEEPSEEK_API_KEY'));
  if ('error' in llm) return json({ error: llm.error }, 400);

  // 拉取自定义服务的模型列表（浏览器直连多数服务商会被 CORS 拦，所以经这里转发）
  if (body.action === 'models') {
    if (!llm.own) return json({ models: [BUILTIN_MODEL] });
    const r = await fetch(`${llm.base}/models`, { headers: { Authorization: `Bearer ${llm.key}` } }).catch(() => null);
    if (!r) return json({ error: '连接失败 / Connection failed' }, 502);
    if (!r.ok) return json({ error: await upstreamError(r, true) }, 502);
    const d = await r.json().catch(() => ({}));
    const models = (d.data ?? d.models ?? []).map((m: any) => String(m.id ?? m.name ?? m).replace(/^models\//, '')).filter(Boolean).sort();
    return json({ models: models.slice(0, 300) });
  }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'Missing user message' }, 400);

  // 只有使用内置模型才计配额；自带 Key 的调用费用由访客自己承担
  let quota: { used?: number; limit?: number } | null = null;
  if (!llm.own) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data, error: qErr } = await admin.rpc('ai_take_quota', { p_user: user.id });
    if (qErr) return json({ error: 'Quota check failed' }, 500);
    if (!data.ok) return json({ error: cfg.messages?.tooMany ?? '今天的 AI 演示额度已用完，明天再来试试吧', code: 'quota' }, 429);
    quota = data;
  }

  const messages: any[] = [{ role: 'system', content: cfg.systemPrompt(body) }, ...history];
  const enc = new TextEncoder();

  // SSE：{type:'text',delta} | {type:'tool',part} | {type:'done',quota} | {type:'error',message}
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await fetch(`${llm.base}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.key}` },
            body: JSON.stringify(requestBody(llm, messages, cfg.tools)),
          });
          if (!res.ok || !res.body) {
            send({ type: 'error', message: await upstreamError(res, llm.own) });
            break;
          }

          // 文字实时转发；tool_calls 按 index 累积
          let text = '';
          const calls: { id: string; name: string; args: string }[] = [];
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buf = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += value;
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]') continue;
              let chunk; try { chunk = JSON.parse(data); } catch { continue; }
              const delta = chunk.choices?.[0]?.delta ?? {};
              if (delta.content) { text += delta.content; send({ type: 'text', delta: delta.content }); }
              for (const tc of delta.tool_calls ?? []) {
                // 个别兼容接口（如 Gemini）不带 index：新 id 视为新调用，否则续写上一个
                const idx = typeof tc.index === 'number' ? tc.index
                  : tc.id && !calls.some((x) => x?.id === tc.id) ? calls.length : Math.max(calls.length - 1, 0);
                const c = (calls[idx] ??= { id: '', name: '', args: '' });
                if (tc.id) c.id = tc.id;
                if (tc.function?.name) c.name += tc.function.name;
                if (tc.function?.arguments) c.args += tc.function.arguments;
              }
            }
          }

          const toolCalls = calls.filter(Boolean);
          if (!toolCalls.length) { send({ type: 'done', quota: quota && { used: quota.used, limit: quota.limit } }); break; }

          toolCalls.forEach((c, i) => { c.id ||= `call_${round}_${i}`; });   // 少数接口不返回 id
          messages.push({ role: 'assistant', content: text || (llm.own ? null : ''), tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })) });
          for (const c of toolCalls) {
            let args: Record<string, any> = {};
            let result: any;
            try { args = JSON.parse(c.args || '{}'); result = await cfg.runTool(db, c.name, args); }
            catch (e) { result = { error: (e as Error).message }; }
            send({ type: 'tool', part: { toolCallId: c.id, toolName: c.name, args, result } });
            const forModel = cfg.isProposal?.(result)
              ? { ...result, note: '已在界面展示确认卡片，等待用户点击确认。请提示用户确认，不要声称已经执行。' }
              : result;
            messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(forModel).slice(0, 8000) });
          }
          if (round === MAX_ROUNDS - 1) send({ type: 'text', delta: '\n\n…' });
        }
      } catch (e) {
        console.error(e);
        send({ type: 'error', message: 'AI processing failed, please try again later' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
