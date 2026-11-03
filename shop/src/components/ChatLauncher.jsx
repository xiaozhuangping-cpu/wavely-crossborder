import { lazy, Suspense, useState } from 'react';
import { Fab, CircularProgress, useMediaQuery } from '@mui/material';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '../store';

// 对话窗口（assistant-ui、Markdown）体积较大：首次点开才加载，首屏只有这个按钮
const ChatWindow = lazy(() => import('./ChatWidget'));
const hasSavedChat = () => { try { return !!localStorage.getItem('wv.chat'); } catch { return false; } };

export const ChatWidget = () => {
  const { tr } = useStore();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mobile = useMediaQuery('(max-width:600px)');
  const toggle = () => { setLoaded(true); setOpen((v) => !v); };

  return (
    <>
      {loaded && (
        <Suspense fallback={<CircularProgress size={28} sx={{ position: 'fixed', right: 40, bottom: 110, zIndex: 1300 }} />}>
          <ChatWindow open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
      {!(mobile && open) && (
        <Fab color="primary" onClick={toggle} onMouseEnter={() => import('./ChatWidget')} aria-label={tr.chatTitle}
          sx={{ position: 'fixed', right: { xs: 16, sm: 24 }, bottom: { xs: 16, sm: 24 }, zIndex: 1300, width: 60, height: 60,
            ...(hasSavedChat() && !loaded ? { '&::after': { content: '""', position: 'absolute', top: 6, right: 6, width: 12, height: 12, borderRadius: '50%', bgcolor: 'secondary.main', border: '2px solid #fff' } } : {}) }}>
          {open ? <CloseIcon /> : <ChatBubbleOutlinedIcon />}
        </Fab>
      )}
    </>
  );
};
