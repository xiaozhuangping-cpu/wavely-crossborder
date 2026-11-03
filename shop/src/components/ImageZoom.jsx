// 亚马逊式商品图放大镜
// 桌面（精确指针）：悬停出现取景框，右侧弹出放大窗口（覆盖商品信息区）
// 触屏：点击打开全屏大图，双击切换 1x / 2.5x，放大后可拖动/滚动查看
import { useRef, useState } from 'react';
import { Box, Dialog, IconButton, Typography, useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { useStore } from '../store';

const ZOOM = 2.5;

export const ImageZoom = ({ src, alt, paneWidth }) => {
  const { tr } = useStore();
  const hover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const wide = useMediaQuery((t) => t.breakpoints.up('md'));
  const box = useRef(null);
  const [pos, setPos] = useState(null);       // 鼠标在图片上的相对位置 0~1
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const sheet = useRef(null);

  const lens = 1 / ZOOM;                         // 取景框占图片的比例
  const clamp = (v) => Math.min(Math.max(v, lens / 2), 1 - lens / 2);
  const onMove = (e) => {
    const r = box.current.getBoundingClientRect();
    setPos({ x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) });
  };
  const desktopZoom = hover && wide;

  return (
    <Box>
      <Box ref={box} onMouseMove={desktopZoom ? onMove : undefined} onMouseLeave={() => setPos(null)}
        onClick={desktopZoom ? undefined : () => setOpen(true)}
        sx={{ position: 'relative', aspectRatio: '1 / 1', bgcolor: '#fff', borderRadius: 5,
          cursor: desktopZoom ? 'crosshair' : 'zoom-in', userSelect: 'none' }}>
        <Box component="img" src={src} alt={alt} draggable={false} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 5 }} />

        {/* 取景框 */}
        {desktopZoom && pos && (
          <Box sx={{ position: 'absolute', pointerEvents: 'none', border: '1px solid rgba(14,116,144,.55)', bgcolor: 'rgba(14,116,144,.12)',
            width: `${lens * 100}%`, height: `${lens * 100}%`, left: `${(pos.x - lens / 2) * 100}%`, top: `${(pos.y - lens / 2) * 100}%` }} />
        )}

        {/* 放大窗口：贴在图片右侧，覆盖商品信息 */}
        {desktopZoom && pos && (
          <Box aria-hidden sx={{ position: 'absolute', zIndex: 20, top: 0, left: 'calc(100% + 24px)', width: paneWidth ?? '110%', aspectRatio: '1 / 1',
            bgcolor: '#fff', borderRadius: 3, boxShadow: '0 20px 50px rgba(16,32,31,.18)', pointerEvents: 'none',
            backgroundImage: `url("${src}")`, backgroundRepeat: 'no-repeat', backgroundSize: `${ZOOM * 100}%`,
            backgroundPosition: `${((pos.x - lens / 2) / (1 - lens)) * 100}% ${((pos.y - lens / 2) / (1 - lens)) * 100}%` }} />
        )}
      </Box>

      <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        <ZoomInIcon sx={{ fontSize: 16 }} />{desktopZoom ? tr.zoomHint : tr.tapZoom}
      </Typography>

      {/* 触屏全屏大图 */}
      <Dialog fullScreen open={open} onClose={() => { setOpen(false); setBig(false); }}>
        <IconButton onClick={() => { setOpen(false); setBig(false); }} aria-label="close"
          sx={{ position: 'fixed', top: 12, right: 12, zIndex: 2, bgcolor: 'rgba(0,0,0,.06)' }}><CloseIcon /></IconButton>
        <Box ref={sheet} onDoubleClick={(e) => {
            // 以双击位置为中心放大
            const el = sheet.current;
            const img = el.querySelector('img').getBoundingClientRect();
            const rx = Math.min(Math.max((e.clientX - img.left) / img.width, 0), 1);
            const ry = Math.min(Math.max((e.clientY - img.top) / img.height, 0), 1);
            const next = !big;
            setBig(next);
            requestAnimationFrame(() => {
              if (!next) return;
              const z = el.querySelector('img').getBoundingClientRect();
              el.scrollLeft = rx * z.width - el.clientWidth / 2;
              el.scrollTop = ry * z.height - el.clientHeight / 2;
            });
          }}
          sx={{ width: '100%', height: '100%', overflow: 'auto', bgcolor: '#fff', display: 'flex', alignItems: big ? 'flex-start' : 'center', justifyContent: big ? 'flex-start' : 'center' }}>
          <Box component="img" src={src} alt={alt} draggable={false}
            sx={{ width: big ? `${ZOOM * 100}%` : '100%', maxWidth: big ? 'none' : 900, flexShrink: 0, display: 'block', cursor: big ? 'zoom-out' : 'zoom-in' }} />
        </Box>
        <Typography sx={{ position: 'fixed', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: 'text.secondary' }}>{tr.dblZoom}</Typography>
      </Dialog>
    </Box>
  );
};

// 左侧竖排缩略图（亚马逊式：悬停预览，点击选中）
export const Thumbs = ({ items, activeSrc, onHover, onPick }) => (
  // 规格图很多时（如 50+ 个颜色）限制高度，竖向滚动；p 给选中描边留出空间
  <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 1, p: '3px', flexShrink: 0,
    overflowX: { xs: 'auto', md: 'hidden' }, overflowY: { xs: 'hidden', md: 'auto' }, maxHeight: { md: 'min(560px, 70vh)' },
    scrollbarWidth: 'thin' }}>
    {items.map((it) => (
      <Box key={it.src} component="button" type="button" onMouseEnter={() => onHover?.(it)} onClick={() => onPick?.(it)} aria-label={it.label}
        sx={{ width: 56, height: 56, p: 0.5, flexShrink: 0, bgcolor: '#fff', borderRadius: 2, cursor: 'pointer',
          border: 0, boxShadow: it.src === activeSrc ? '0 0 0 2px #0e7490' : 'none' }}>
        <Box component="img" src={it.src} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </Box>
    ))}
  </Box>
);
