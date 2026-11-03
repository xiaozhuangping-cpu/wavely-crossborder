import { AssistantRuntimeProvider, useLocalRuntime, ThreadPrimitive, MessagePrimitive, ComposerPrimitive, AuiIf } from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, IconButton, Typography, Tooltip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import StopIcon from '@mui/icons-material/Stop';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { deepseekAdapter } from './adapter';
import { TOOL_UIS, ToolFallback } from './toolUIs';

const SUGGESTIONS = [
  { title: '最近 30 天各平台销售额', prompt: '最近 30 天各平台的销售额和订单数是多少？哪个平台增长最快？' },
  { title: '德国站畅销商品', prompt: '最近 30 天德国站卖得最好的 5 个商品是什么？' },
  { title: '哪些商品需要补货', prompt: '现在有哪些商品低于安全库存？优先补哪几个？' },
  { title: '写德语 Listing', prompt: '帮「猫抓板沙发」写一条 Amazon 德国站的标题、五点描述和产品描述' },
  { title: '发掉日本的待发货订单', prompt: '把所有待发货的日本订单准备发货' },
];

export const Sparkle = ({ size = 20 }) => (
  <AutoAwesomeIcon sx={{ fontSize: size, color: '#4f8cf7', filter: 'drop-shadow(0 0 0 transparent)' }} />
);

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
      <AuiIf condition={(s) => s.message.status?.type === 'running'}>
        <Box sx={{ pt: 0.5, flexShrink: 0, display: 'flex', '@keyframes spin': { to: { transform: 'rotate(360deg)' } }, animation: 'spin 1.6s linear infinite', height: 'fit-content' }}><Sparkle /></Box>
      </AuiIf>
      <AuiIf condition={(s) => s.message.status?.type !== 'running'}>
        <Box sx={{ pt: 0.5, flexShrink: 0 }}><Sparkle /></Box>
      </AuiIf>
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
      <Typography sx={(t) => ({ fontSize: 26, fontWeight: 500, lineHeight: 1.3,
        background: 'linear-gradient(90deg, #4f8cf7, #9b72cb 50%, #d96570)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' })}>
        你好，我是运营助手
      </Typography>
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

const Composer = () => (
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
      由 DeepSeek 驱动 · AI 可能出错，请核对重要信息 · 每位访客每天 30 次
    </Typography>
  </Box>
);

export const AssistantProvider = ({ children }) => {
  const runtime = useLocalRuntime(deepseekAdapter);
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
};

export const AssistantPanel = ({ onClose, onReset }) => (
  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', minWidth: 0 }}>
    <Stack direction="row" sx={{ alignItems: 'center', px: 2, height: 56, flexShrink: 0, gap: 1 }}>
      <Sparkle />
      <Typography sx={{ fontSize: 16, fontWeight: 500, flex: 1 }}>Wavely AI 运营助手</Typography>
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
