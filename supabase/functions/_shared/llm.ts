// 两个 AI 助手共用：鉴权、配额、DeepSeek 流式工具调用循环、SSE 输出
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = Deno.env.get('DEEPSEEK_MODEL') ?? 'deepseek-chat';
const MAX_ROUNDS = 5;

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

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) return json({ error: 'AI 服务未配置' }, 500);

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
  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'Missing user message' }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: quota, error: qErr } = await admin.rpc('ai_take_quota', { p_user: user.id });
  if (qErr) return json({ error: 'Quota check failed' }, 500);
  if (!quota.ok) return json({ error: cfg.messages?.tooMany ?? '今天的 AI 演示额度已用完，明天再来试试吧', code: 'quota' }, 429);

  const messages: any[] = [{ role: 'system', content: cfg.systemPrompt(body) }, ...history];
  const enc = new TextEncoder();

  // SSE：{type:'text',delta} | {type:'tool',part} | {type:'done',quota} | {type:'error',message}
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: MODEL, messages, tools: cfg.tools, temperature: 0.3, max_tokens: 1500, stream: true }),
          });
          if (!res.ok || !res.body) {
            console.error('deepseek', res.status, (await res.text()).slice(0, 500));
            send({ type: 'error', message: `AI service unavailable (${res.status})` });
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
                const c = (calls[tc.index] ??= { id: '', name: '', args: '' });
                if (tc.id) c.id = tc.id;
                if (tc.function?.name) c.name += tc.function.name;
                if (tc.function?.arguments) c.args += tc.function.arguments;
              }
            }
          }

          const toolCalls = calls.filter(Boolean);
          if (!toolCalls.length) { send({ type: 'done', quota: { used: quota.used, limit: quota.limit } }); break; }

          messages.push({ role: 'assistant', content: text, tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })) });
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
