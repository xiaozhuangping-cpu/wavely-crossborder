// 商品场景短片（Google Flow · Veo 3.1 生成），静态文件放在 public/videos/<SPU>.mp4 / .jpg
import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

// SPU 编码 → 视频；新增视频时把 mp4 与封面 jpg 放进 public/videos 并在这里登记
const FILMS = ['WV-PET-001', 'WV-OUT-001', 'WV-ELE-001', 'WV-HOM-003'];
const base = import.meta.env.BASE_URL;
export const videoOf = (p) => (p && FILMS.includes(p.sku)
  ? { src: `${base}videos/${p.sku}.mp4`, poster: `${base}videos/${p.sku}.jpg` } : null);
export const FILM_SKUS = FILMS;

// 进入可视区域自动静音循环播放，离开时暂停（省流量、省电）
export const AutoVideo = ({ src, poster, sx, controls = false, autoPlay = true }) => {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !autoPlay) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, [src, autoPlay]);
  return (
    <Box component="video" ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" controls={controls}
      sx={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', bgcolor: '#000', ...sx }} />
  );
};
