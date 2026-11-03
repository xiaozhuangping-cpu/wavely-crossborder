import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../supabase';

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

export const deepseekAdapter = {
  async run({ messages, abortSignal }) {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: toText(m) }))
      .filter((m) => m.content.trim());

    const { data: { session } } = await supabase.auth.getSession();
    let d;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        signal: abortSignal,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: history }),
      });
      d = await res.json().catch(() => ({ error: `服务返回异常（HTTP ${res.status}）` }));
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      d = { error: '网络异常，请稍后再试' };
    }

    const content = (d.parts ?? []).map((p) => ({
      type: 'tool-call',
      toolCallId: p.toolCallId,
      toolName: p.toolName,
      args: p.args ?? {},
      argsText: JSON.stringify(p.args ?? {}),
      result: p.result,
    }));
    content.push({ type: 'text', text: d.error ? `⚠️ ${d.error}` : d.text || '（没有返回内容）' });
    return { content, metadata: { custom: { quota: d.quota } } };
  },
};
