import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../supabase';
import { llmPayload } from './llmConfig';

const FN_URL = `${SUPABASE_URL}/functions/v1/ai-assistant`;
const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ''}` };
};

/** 批量改写多语言商品名：items = [{id, title}]（每次最多 20 个），返回 {id: {zh,en,de,ja,es}} */
export async function translateNames(items) {
  const res = await fetch(FN_URL, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'translate_names', items, llm: llmPayload() }) })
    .catch(() => { throw new Error('网络异常，请稍后再试'); });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
  return Object.fromEntries((d.items ?? []).map(({ id, ...names }) => [id, names]));
}

/** 整个商品多语言（名称、规格、描述），items 见 collect/localize.js；返回 {id: 结果} */
export async function translateProducts(items) {
  const res = await fetch(FN_URL, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'translate_products', items, llm: llmPayload() }) })
    .catch(() => { throw new Error('网络异常，请稍后再试'); });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
  return Object.fromEntries((d.items ?? []).map((x) => [x.id, x]));
}

/** 经边缘函数拉取自定义服务的模型列表（供设置对话框使用） */
export async function fetchModels(llm) {
  const res = await fetch(FN_URL, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'models', llm }) })
    .catch(() => { throw new Error('网络异常，请稍后再试'); });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
  return d.models ?? [];
}

// 把 assistant-ui 的消息压成纯文本历史：工具结果以摘要形式带上，方便模型理解追问
const toText = (m) =>
  (m.content ?? [])
    .map((p) => {
      if (p.type === 'text') return p.text;
      if (p.type === 'tool-call') return `[已调用工具 ${p.toolName}，结果：${JSON.stringify(p.result ?? {}).slice(0, 1200)}]`;
      return '';
    })
    .filter(Boolean)
    .join('\n');

const toolPart = (p) => ({
  type: 'tool-call',
  toolCallId: p.toolCallId,
  toolName: p.toolName,
  args: p.args ?? {},
  argsText: JSON.stringify(p.args ?? {}),
  result: p.result,
});

// 流式适配器：边收 SSE 边产出内容，文字与工具卡片按到达顺序排列
export const deepseekAdapter = {
  async *run({ messages, abortSignal }) {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: toText(m) }))
      .filter((m) => m.content.trim());

    const content = [];
    const snapshot = () => ({ content: content.map((p) => ({ ...p })) });

    let res;
    try {
      res = await fetch(FN_URL, {
        method: 'POST',
        signal: abortSignal,
        headers: await authHeaders(),
        body: JSON.stringify({ messages: history, llm: llmPayload() }),
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      yield { content: [{ type: 'text', text: '⚠️ 网络异常，请稍后再试' }] };
      return;
    }

    // 鉴权/配额等错误在开始流式之前以 JSON 返回
    if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
      const d = await res.json().catch(() => ({}));
      yield { content: [{ type: 'text', text: `⚠️ ${d.error ?? `服务返回异常（HTTP ${res.status}）`}` }] };
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let changed = false, sep;
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, sep).trim();
        buf = buf.slice(sep + 2);
        if (!line.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'text') {
          const last = content[content.length - 1];
          if (last?.type === 'text') last.text += ev.delta; else content.push({ type: 'text', text: ev.delta });
        } else if (ev.type === 'tool') {
          content.push(toolPart(ev.part));
        } else if (ev.type === 'error') {
          content.push({ type: 'text', text: `\n\n⚠️ ${ev.message}` });
        }
        changed = true;
      }
      if (changed) yield snapshot();
    }
    if (!content.some((p) => p.type === 'text')) content.push({ type: 'text', text: '' });
    yield snapshot();
  },
};
