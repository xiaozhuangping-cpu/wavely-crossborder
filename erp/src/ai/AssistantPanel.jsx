import { useEffect, useState } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime, ThreadPrimitive, MessagePrimitive, ComposerPrimitive, AuiIf } from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, IconButton, Typography, Tooltip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import StopIcon from '@mui/icons-material/Stop';
import { Sparkle } from './Sparkle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TuneIcon from '@mui/icons-material/Tune';
import { deepseekAdapter, fetchModels } from './adapter';
import { LlmSettingsDialog, useLlmConfig, llmLabel, isOwnKey } from './llmConfig';
import { TOOL_UIS, ToolFallback } from './toolUIs';

const SUGGESTIONS = [
  { title: '最近 30 天各平台销售额', prompt: '最近 30 天各平台的销售额和订单数是多少？哪个平台增长最快？' },
  { title: '德国站畅销商品', prompt: '最近 30 天德国站卖得最好的 5 个商品是什么？' },
  { title: '哪些商品需要补货', prompt: '现在有哪些商品低于安全库存？优先补哪几个？' },
  { title: '写德语 Listing', prompt: '帮「猫抓板沙发」写一条 Amazon 德国站的标题、五点描述和产品描述' },
  { title: '发掉日本的待发货订单', prompt: '把所有待发货的日本订单准备发货' },
];


const MarkdownText = () => (
  <Box sx={{ fontSize: 14, lineHeight: 1.65, '& p': { my: 0.75 }, '& ul, & ol': { pl: 2.5, my: 0.5 }, '& li': { mb: 0.25 },
    '& table': { borderCollapse: 'collapse', my: 1, fontSize: 13 }, '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5 },
    '& code': { bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, fontSize: 12.5 } }}>
    <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} />
  </Box>
);

const UserMessage = () => (
  <MessagePrimitive.Root>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: 1.5 }}>
      <Box sx={(t) => ({ maxWidth: '85%', px: 2, py: 1.25, borderRadius: '20px 20px 4px 20px', bgcolor: t.palette.gm.navActive, color: t.palette.gm.navActiveText, fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' })}>
        <MessagePrimitive.Parts />
      </Box>
    </Box>
  </MessagePrimitive.Root>
);

// 还没出字，或刚执行完工具、在等下一轮时显示等待提示
const waiting = (s) => {
  if (s.message.status?.type !== 'running') return false;
  const parts = s.message.parts ?? s.message.content ?? [];
  const last = parts[parts.length - 1];
  return !last || last.type === 'tool-call' || (last.type === 'text' && !last.text);
};

const AssistantMessage = () => (
  <MessagePrimitive.Root>
    <Box sx={{ display: 'flex', gap: 1.25, my: 1.5 }}>
      <Box sx={{ pt: 0.5, flexShrink: 0 }}><Sparkle /></Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MessagePrimitive.Parts components={{ Text: MarkdownText, tools: { by_name: TOOL_UIS, Fallback: ToolFallback } }} />
        <AuiIf condition={waiting}>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', pt: 0.25 }}>正在查询数据并思考…</Typography>
        </AuiIf>
      </Box>
    </Box>
  </MessagePrimitive.Root>
);

const Welcome = () => (
  <AuiIf condition={(s) => s.thread.isEmpty}>
    <Box sx={{ pt: 3 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>运营助手</Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1, mb: 2.5 }}>
        可以帮你查销售数据、找补货商品、写多语言 Listing、批量发货。写操作都会先让你确认。
      </Typography>
      <Stack spacing={1}>
        {SUGGESTIONS.map((s) => (
          <ThreadPrimitive.Suggestion key={s.title} prompt={s.prompt} send asChild>
            <Box component="button" sx={(t) => ({ textAlign: 'left', border: `1px solid ${t.palette.gm.border}`, bgcolor: 'transparent', color: 'text.primary',
              borderRadius: 3, px: 1.75, py: 1.1, fontSize: 13.5, cursor: 'pointer', font: 'inherit', '&:hover': { bgcolor: t.palette.gm.navHover } })}>
              {s.title}
            </Box>
          </ThreadPrimitive.Suggestion>
        ))}
      </Stack>
    </Box>
  </AuiIf>
);

const Composer = () => {
  const cfg = useLlmConfig();
  return (
  <Box sx={{ px: 2, pb: 1.5, pt: 1 }}>
    <ComposerPrimitive.Root>
      <Box sx={(t) => ({ display: 'flex', alignItems: 'flex-end', gap: 1, bgcolor: t.palette.gm.search, borderRadius: '24px', pl: 2, pr: 0.75, py: 0.75,
        '& textarea': { flex: 1, border: 0, outline: 0, resize: 'none', bgcolor: 'transparent', color: 'text.primary', font: 'inherit', fontSize: 14, py: 1, maxHeight: 160 } })}>
        <ComposerPrimitive.Input placeholder="问问运营助手…" autoFocus rows={1} />
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <IconButton size="small" color="primary" aria-label="发送"><ArrowUpwardIcon fontSize="small" /></IconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <IconButton size="small" aria-label="停止"><StopIcon fontSize="small" /></IconButton>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </Box>
    </ComposerPrimitive.Root>
    <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center', mt: 1 }}>
      {isOwnKey(cfg) ? `${llmLabel(cfg)} · 使用你自己的 API Key` : '内置 DeepSeek · 每位访客每天 30 次'} · AI 可能出错，请核对重要信息
    </Typography>
  </Box>
  );
};

// 对话持久化：刷新后恢复，24 小时过期（演示数据每日重置）
const STORE_KEY = 'wv.erp.chat';
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

// 懒加载入口：运行时只在第一次打开面板时创建
export default function AssistantPanelWithRuntime({ onClose }) {
  const [initialMessages] = useState(loadThread);
  const runtime = useLocalRuntime(deepseekAdapter, { initialMessages });
  useEffect(() => runtime.thread.subscribe(() => {
    const st = runtime.thread.getState();
    if (!st.isRunning) saveThread(st.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
  }), [runtime]);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantPanel onClose={onClose} onReset={() => { saveThread([]); runtime.thread.reset(); }} />
    </AssistantRuntimeProvider>
  );
}

// 顶栏：当前模型，点击打开模型设置
const ModelButton = () => {
  const cfg = useLlmConfig();
  const [open, setOpen] = useState(false);
  return (<>
    <Tooltip title="AI 模型设置">
      <Box component="button" onClick={() => setOpen(true)} sx={(t) => ({ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 160, border: `1px solid ${t.palette.gm.border}`,
        bgcolor: 'transparent', color: 'text.secondary', borderRadius: 4, px: 1, py: 0.25, fontSize: 12, font: 'inherit', cursor: 'pointer', '&:hover': { bgcolor: t.palette.gm.navHover } })}>
        <TuneIcon sx={{ fontSize: 14 }} />
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{llmLabel(cfg)}</Box>
      </Box>
    </Tooltip>
    <LlmSettingsDialog open={open} onClose={() => setOpen(false)} fetchModels={fetchModels} lang="zh" />
  </>);
};

export const AssistantPanel = ({ onClose, onReset }) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', minWidth: 0 }}>
    <Stack direction="row" sx={{ alignItems: 'center', px: 2, height: 56, flexShrink: 0, gap: 1 }}>
      <Sparkle />
      <Typography sx={{ fontSize: 16, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Wavely AI 运营助手</Typography>
      <ModelButton />
      <Tooltip title="新对话"><IconButton size="small" onClick={onReset}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="关闭"><IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton></Tooltip>
    </Stack>
    <ThreadPrimitive.Root style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ThreadPrimitive.Viewport style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        <Welcome />
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  </Box>
);
