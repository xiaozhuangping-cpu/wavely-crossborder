// 商品场景短片（Google Flow · Veo 3.1 生成），静态文件放在 public/videos/<SPU>.mp4 / .jpg
import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

// 商品视频来自数据库 products.video_url / video_poster（ERP 商品编辑页「视频」标签上传）
export const videoOf = (p) => (p?.video_url ? { src: p.video_url, poster: p.video_poster || undefined } : null);

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
