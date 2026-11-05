import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AssistantRuntimeProvider, useLocalRuntime, ThreadPrimitive, MessagePrimitive, ComposerPrimitive, AuiIf } from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Paper, Stack, Typography, IconButton, Slide, Chip, useMediaQuery, Tooltip } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import StopIcon from '@mui/icons-material/Stop';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useStore, supabase, SUPABASE_URL, SUPABASE_KEY } from '../store';
import { productTitle } from '../i18n';
import { ProductArt, AddButton, PriceFrom } from './ui';
import { Timeline } from '../pages/Track';
import TuneIcon from '@mui/icons-material/Tune';
import { LlmSettingsDialog, useLlmConfig, llmLabel, llmPayload } from './llmConfig';

const FN_URL = `${SUPABASE_URL}/functions/v1/shop-assistant`;
const authHeaders = async () => {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) ({ data: { session } } = await supabase.auth.signInAnonymously());   // 访客首次使用时匿名登录
  return { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token ?? ''}` };
};

// 经边缘函数拉取自定义服务的模型列表（供设置对话框使用）
const fetchModels = async (llm) => {
  const res = await fetch(FN_URL, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'models', llm }) })
    .catch(() => { throw new Error('Network error, please try again.'); });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
  return d.models ?? [];
};

// ---------- 运行时：流式读取 shop-assistant 的 SSE ----------
const toText = (m) => (m.content ?? []).map((p) =>
  p.type === 'text' ? p.text : p.type === 'tool-call' ? `[tool ${p.toolName} result: ${JSON.stringify(p.result ?? {}).slice(0, 1000)}]` : '').filter(Boolean).join('\n');

const makeAdapter = (getCtx) => ({
  async *run({ messages, abortSignal }) {
    const { lang, currency } = getCtx();
    const content = [];
    const snap = () => ({ content: content.map((p) => ({ ...p })) });

    const res = await fetch(FN_URL, {
      method: 'POST', signal: abortSignal,
      headers: await authHeaders(),
      body: JSON.stringify({ lang, currency, llm: llmPayload(), messages: messages.map((m) => ({ role: m.role, content: toText(m) })).filter((m) => m.content.trim()) }),
    }).catch((e) => { if (e.name === 'AbortError') throw e; return null; });

    if (!res || !res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
      const d = res ? await res.json().catch(() => ({})) : {};
      yield { content: [{ type: 'text', text: `${d.error ?? 'Network error, please try again.'}` }] };
      return;
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let sep, changed = false;
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, sep).trim(); buf = buf.slice(sep + 2);
        if (!line.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'text') { const last = content.at(-1); if (last?.type === 'text') last.text += ev.delta; else content.push({ type: 'text', text: ev.delta }); }
        else if (ev.type === 'tool') content.push({ type: 'tool-call', toolCallId: ev.part.toolCallId, toolName: ev.part.toolName, args: ev.part.args ?? {}, argsText: JSON.stringify(ev.part.args ?? {}), result: ev.part.result });
        else if (ev.type === 'error') content.push({ type: 'text', text: `\n\n${ev.message}` });
        changed = true;
      }
      if (changed) yield snap();
    }
    if (!content.length) content.push({ type: 'text', text: '' });
    yield snap();
  },
});

// ---------- 工具结果 UI ----------
const ProductsTool = ({ result }) => {
  const { lang, price } = useStore();
  const rows = result?.rows ?? [];
  if (!rows.length) return null;
  return (
    <Stack direction="row" spacing={1.25} sx={{ overflowX: 'auto', py: 1, mx: -0.5, px: 0.5, '&::-webkit-scrollbar': { height: 6 } }}>
      {rows.map((p) => (
        <Paper key={p.id} variant="outlined" sx={{ width: 168, flexShrink: 0, p: 1, borderRadius: '12px' }}>
          <Box component={RouterLink} to={`/p/${p.id}`} sx={{ textDecoration: 'none', color: 'inherit' }}>
            <ProductArt p={p} sx={{ borderRadius: '8px', '& span': { fontSize: '48px !important' } }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 1, lineHeight: 1.3, height: 34, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{productTitle(p, lang)}</Typography>
            <PriceFrom p={p} sx={{ fontSize: 14, fontWeight: 500, my: 0.5, fontFamily: 'inherit' }} />
          </Box>
          <AddButton product={p} size="small" fullWidth openCart={false} />
        </Paper>
      ))}
    </Stack>
  );
};

const TrackTool = ({ result }) => {
  const { tr, lang } = useStore();
  if (!result || result.not_found || result.error) return null;
  return <Paper variant="outlined" sx={{ p: 1.5, my: 1, borderRadius: '12px', '& li p': { fontSize: 13 } }}><Timeline data={result} tr={tr} lang={lang} /></Paper>;
};

const TOOLS = { search_products: ProductsTool, track_order: TrackTool };

// ---------- 对话界面 ----------
const Markdown = () => (
  <Box sx={{ fontSize: 14, lineHeight: 1.6, '& p': { my: 0.5 }, '& ul, & ol': { pl: 2.5, my: 0.5 } }}>
    <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} />
  </Box>
);

const UserMessage = () => (
  <MessagePrimitive.Root>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: 1 }}>
      <Box sx={{ maxWidth: '85%', px: 1.75, py: 1, borderRadius: '18px 18px 4px 18px', bgcolor: 'primary.main', color: '#fff', fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <MessagePrimitive.Parts />
      </Box>
    </Box>
  </MessagePrimitive.Root>
);

const waiting = (s) => {
  if (s.message.status?.type !== 'running') return false;
  const parts = s.message.parts ?? s.message.content ?? [];
  const last = parts[parts.length - 1];
  return !last || last.type === 'tool-call' || (last.type === 'text' && !last.text);
};

const AssistantMessage = () => (
  <MessagePrimitive.Root>
    <Box sx={{ my: 1, maxWidth: '100%' }}>
      <Box sx={{ display: 'inline-block', maxWidth: '100%', px: 1.75, py: 0.5, borderRadius: '18px 18px 18px 4px', bgcolor: '#f1efe9' }}>
        <MessagePrimitive.Parts components={{ Text: Markdown, tools: { by_name: TOOLS, Fallback: () => null } }} />
        <AuiIf condition={waiting}>
          <Stack direction="row" spacing={0.6} sx={{ py: 1.2, '@keyframes blink': { '0%,80%,100%': { opacity: 0.25 }, '40%': { opacity: 1 } },
            '& span': { width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.secondary', animation: 'blink 1.2s infinite' }, '& span:nth-of-type(2)': { animationDelay: '.2s' }, '& span:nth-of-type(3)': { animationDelay: '.4s' } }}>
            <span /><span /><span />
          </Stack>
        </AuiIf>
      </Box>
    </Box>
  </MessagePrimitive.Root>
);

const ChatPanel = ({ onClose, onReset }) => {
  const { tr, lang } = useStore();
  const cfg = useLlmConfig();
  const [settings, setSettings] = useState(false);
  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, px: 2, py: 1.5, bgcolor: 'primary.main', color: '#fff' }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}><AutoAwesomeIcon fontSize="small" /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 500, lineHeight: 1.2 }}>{tr.chatTitle}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.85 }}>● Online · AI</Typography>
        </Box>
        <Tooltip title={tr.aiSettings}><IconButton onClick={() => setSettings(true)} sx={{ color: '#fff' }} aria-label="model settings"><TuneIcon /></IconButton></Tooltip>
        <Tooltip title="New chat"><IconButton onClick={onReset} sx={{ color: '#fff' }} aria-label="new chat"><RestartAltIcon /></IconButton></Tooltip>
        <IconButton onClick={onClose} sx={{ color: '#fff' }} aria-label="close"><CloseIcon /></IconButton>
      </Stack>
      <ThreadPrimitive.Root style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ThreadPrimitive.Viewport style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <Box sx={{ py: 1 }}>
              <Box sx={{ display: 'inline-block', px: 1.75, py: 1.25, borderRadius: '18px 18px 18px 4px', bgcolor: '#f1efe9', fontSize: 14 }}>
                <b>{tr.chatHello}</b><br />{tr.chatSub}
              </Box>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                {tr.sugg.map((q) => (
                  <ThreadPrimitive.Suggestion key={q} prompt={q} send asChild>
                    <Chip label={q} variant="outlined" color="primary" onClick={() => {}} sx={{ height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                  </ThreadPrimitive.Suggestion>
                ))}
              </Stack>
            </Box>
          </AuiIf>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>
        <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <ComposerPrimitive.Root>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, bgcolor: '#f4f2ec', borderRadius: '22px', pl: 2, pr: 0.5, py: 0.5,
              '& textarea': { flex: 1, border: 0, outline: 0, resize: 'none', bgcolor: 'transparent', font: 'inherit', fontSize: 14, py: 1, maxHeight: 120, color: 'text.primary' } }}>
              <ComposerPrimitive.Input placeholder={tr.chatPlaceholder} rows={1} />
              <AuiIf condition={(s) => !s.thread.isRunning}>
                <ComposerPrimitive.Send asChild><IconButton color="primary" size="small" aria-label="send"><ArrowUpwardIcon fontSize="small" /></IconButton></ComposerPrimitive.Send>
              </AuiIf>
              <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel asChild><IconButton size="small" aria-label="stop"><StopIcon fontSize="small" /></IconButton></ComposerPrimitive.Cancel>
              </AuiIf>
            </Box>
          </ComposerPrimitive.Root>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center', mt: 0.75 }}>{llmLabel(cfg)} · {tr.chatNote}</Typography>
        </Box>
      </ThreadPrimitive.Root>
      <LlmSettingsDialog open={settings} onClose={() => setSettings(false)} fetchModels={fetchModels} lang={lang} />
    </Stack>
  );
};

// 对话持久化：刷新后恢复，24 小时过期（演示数据每日重置）
const STORE_KEY = 'wv.chat';
const loadThread = () => {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!d || Date.now() - d.at > 24 * 3600e3) return undefined;
    return d.messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
  } catch { return undefined; }
};
const saveThread = (messages) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now(), messages: messages.slice(-30) })); } catch { /* 忽略 */ }
};

// 懒加载的对话窗口：由 ChatLauncher 在第一次打开时加载
export default function ChatWindow({ open, onClose }) {
  const store = useStore();
  const mobile = useMediaQuery('(max-width:600px)');
  // 语言/币种通过 ref 读取：切换语言不会重建对话
  const ctx = useRef({});
  ctx.current = { lang: store.lang, currency: store.currency };
  const [adapter] = useState(() => makeAdapter(() => ctx.current));
  const [initialMessages] = useState(loadThread);
  const runtime = useLocalRuntime(adapter, { initialMessages });

  useEffect(() => runtime.thread.subscribe(() => {
    const st = runtime.thread.getState();
    if (st.isRunning) return;
    saveThread(st.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
  }), [runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Slide direction="up" in={open} appear>
        <Paper elevation={12} sx={{ position: 'fixed', zIndex: 1300, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          ...(mobile ? { inset: 0, borderRadius: 0 } : { right: 24, bottom: 96, width: 380, height: 'min(620px, calc(100dvh - 140px))', borderRadius: '16px' }),
          visibility: open ? 'visible' : 'hidden' }}>
          <ChatPanel onClose={onClose} onReset={() => { saveThread([]); runtime.thread.reset?.(); }} />
        </Paper>
      </Slide>
    </AssistantRuntimeProvider>
  );
}
