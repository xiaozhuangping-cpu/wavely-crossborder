// 商品编辑页「视频」标签：上传到 Supabase Storage（product-media 桶），自动截取封面；保存商品后生效
import { useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useRecordContext, TextInput } from 'react-admin';
import { Box, Button, Stack, Typography, Alert, LinearProgress } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { supabase } from '../supabase';

const BUCKET = 'product-media';
const MAX_MB = 20;

// 在浏览器里截取视频第 1.5 秒（不足则取中间）作为封面
const capturePoster = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  const done = (blob) => { URL.revokeObjectURL(url); resolve(blob); };
  v.onloadedmetadata = () => { v.currentTime = Math.min(1.5, (v.duration || 2) / 2); };
  v.onseeked = () => {
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(done, 'image/jpeg', 0.82);
  };
  v.onerror = () => done(null);
  setTimeout(() => done(null), 15000);
});

const upload = async (path, body, contentType) => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

export const ProductVideoTab = () => {
  const p = useRecordContext();
  const { setValue } = useFormContext();
  const videoUrl = useWatch({ name: 'video_url' });
  const poster = useWatch({ name: 'video_poster' });
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { setErr('请选择视频文件（mp4 / webm / mov）'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`视频不能超过 ${MAX_MB} MB，建议先压缩为 720p`); return; }
    setBusy(true); setErr('');
    try {
      const stamp = Date.now();
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const src = await upload(`${p.id}/${stamp}.${ext}`, file, file.type);
      const shot = await capturePoster(file);
      const cover = shot ? await upload(`${p.id}/${stamp}.jpg`, shot, 'image/jpeg') : '';
      setValue('video_url', src, { shouldDirty: true });
      setValue('video_poster', cover, { shouldDirty: true });
    } catch (e2) { setErr(`上传失败：${e2.message}`); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 720 }}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>
        有视频的商品会在独立站详情页图集里显示 ▶ 视频，并出现在首页「在生活里看看它们」区块。建议 16:9、8–30 秒、720p，{MAX_MB} MB 以内。
      </Typography>
      {videoUrl ? (
        <Box component="video" key={videoUrl} src={videoUrl} poster={poster || undefined} controls muted playsInline
          sx={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 3, bgcolor: '#000', display: 'block', mb: 2 }} />
      ) : (
        <Box sx={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 3, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', mb: 2 }}>
          <Typography sx={{ color: 'text.secondary' }}>还没有视频</Typography>
        </Box>
      )}
      {busy && <LinearProgress sx={{ mb: 2 }} />}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={onFile} />
        <Button variant="outlined" startIcon={<UploadIcon />} disabled={busy} onClick={() => input.current?.click()}>
          {videoUrl ? '更换视频' : '上传视频'}
        </Button>
        {videoUrl && (
          <Button color="error" startIcon={<DeleteOutlinedIcon />} disabled={busy}
            onClick={() => { setValue('video_url', null, { shouldDirty: true }); setValue('video_poster', null, { shouldDirty: true }); }}>
            移除视频
          </Button>
        )}
      </Stack>
      <TextInput source="video_url" label="视频地址" fullWidth helperText="也可以直接填写视频链接（mp4）" />
      <TextInput source="video_poster" label="封面图地址" fullWidth helperText="上传视频时自动截取，可替换为自己的封面" />
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>上传或移除后，记得点下方「保存」。</Typography>
    </Box>
  );
};
