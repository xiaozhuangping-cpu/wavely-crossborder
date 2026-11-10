import { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Alert, Box, Button, Checkbox, FormControlLabel, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { supabase } from '../supabase';

const abilities = [[2, '智能抠图', '生成白底或透明底商品图'], [3, '智能消除', '清理背景文字与色块'], [4, '图片翻译', '翻译图片中的文字'], [5, '智能裁剪', '调整目标图片尺寸'], [6, '高清放大', '提升商品图清晰度']];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function ProductImageTab() {
  const { setValue } = useFormContext();
  const imageUrl = useWatch({ name: 'image_url' });
  const [id, setId] = useState(''); const [secret, setSecret] = useState('');
  const [region, setRegion] = useState('china'); const [selected, setSelected] = useState([2]);
  const [background, setBackground] = useState('WHITE_BACKGROUND'); const [target, setTarget] = useState('en');
  const [width, setWidth] = useState(1000); const [height, setHeight] = useState(1000); const [factor, setFactor] = useState(2);
  const [state, setState] = useState(''); const [error, setError] = useState(''); const [result, setResult] = useState(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const call = async (body) => {
    const { data, error: err } = await supabase.functions.invoke('vision-flow', { body: { ...body, accessKeyId: id, accessKeySecret: secret, region } });
    if (err) { let detail; try { detail = await err.context.json(); } catch { /* network error */ } throw new Error(detail?.error || err.message); }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const run = async () => {
    setError(''); setResult(null);
    if (!imageUrl || !id.trim() || !secret.trim() || !selected.length) { setError('请填写主图地址、AccessKey 并选择处理能力。'); return; }
    if (selected.includes(5) && (![width, height].every((n) => Number.isInteger(Number(n)) && n >= 100 && n <= 5000))) { setError('裁剪宽高须为 100–5000 的整数。'); return; }
    try {
      setState('正在提交任务');
      const params = { imageUrl, ability: selected, ...(selected.includes(2) && { backGroundType: background }), ...(selected.includes(3) && { nonobjectRemoveElements: [1, 3, 4] }), ...(selected.includes(4) && { sourceLanguage: target === 'en' || target === 'ja' || target === 'ko' ? 'zh' : 'zh-en', targetLanguage: target, includingProductArea: false, translatingBrandInTheProduct: false }), ...(selected.includes(5) && { targetWidth: Number(width), targetHeight: Number(height) }), ...(selected.includes(6) && { upscaleFactor: Number(factor) }) };
      const { taskId } = await call({ action: 'submit', params });
      for (let i = 0; i < 120 && alive.current; i++) {
        setState(`处理中 · 任务 ${taskId}`); await pause(5000);
        const data = await call({ action: 'query', taskId });
        if (data.status === 'FAILED') throw new Error(data.result?.error || '图片处理失败');
        if (data.status === 'COMPLETED') { const output = data.result?.Result ?? data.result; if (!output?.FinalUrl) throw new Error('任务已完成，但没有返回结果图片'); setResult(output); setState(''); return; }
      }
      if (alive.current) throw new Error(`任务仍在处理，请记录任务 ID：${taskId}`);
    } catch (e) { if (alive.current) { setError(e.message); setState(''); } }
  };
  const apply = async () => {
    try { setState('正在保存图片'); setError(''); const data = await call({ action: 'save', resultUrl: result.FinalUrl }); setValue('image_url', data.url, { shouldDirty: true }); setState(''); setResult(null); }
    catch (e) { setError(e.message); setState(''); }
  };
  return <Box sx={{ width: '100%', maxWidth: 1100 }}>
    <Typography variant="h6" fontWeight={700}>商品图片工作台</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>选择处理方式，预览结果后应用到商品主图。处理按阿里云实际调用计费。</Typography>
    <Alert severity="info" sx={{ mb: 2 }}>使用基本信息中的主图地址。图片需可公开访问、大于 256 × 256，长边不超过 1920、短边不超过 1080，且不超过 5 MB。</Alert>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' }, gap: 2 }}>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          {[['原图', imageUrl], ['处理结果', result?.FinalUrl]].map(([label, url]) => <Box key={label} sx={{ flex: '1 1 220px', minWidth: 0 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography><Box sx={{ aspectRatio: '1', bgcolor: 'action.hover', borderRadius: 2, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>{url ? <Box component="img" src={url} alt={label} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Typography color="text.secondary" variant="body2">{label === '原图' ? '请先填写主图地址' : '处理完成后显示'}</Typography>}</Box></Box>)}
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{state && <><Typography variant="body2" sx={{ mt: 2 }}>{state}</Typography><LinearProgress sx={{ mt: 1 }} /></>}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button variant="contained" disabled={!!state} onClick={run}>开始处理</Button><Button variant="outlined" disabled={!result || !!state} onClick={apply}>应用为主图</Button>{result?.FinalUrl && <Button component="a" href={result.FinalUrl} target="_blank" rel="noreferrer">查看原始结果</Button>}</Stack>
        <Typography variant="caption" color="text.secondary">应用后请点击页面底部的「保存」。</Typography>
      </Box>
      <Stack spacing={1.5} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>处理设置</Typography>
        {abilities.map(([value, title, desc]) => <Box key={value}><FormControlLabel control={<Checkbox checked={selected.includes(value)} onChange={() => setSelected((s) => s.includes(value) ? s.filter((x) => x !== value) : [...s, value].sort())} />} label={title} /><Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>{desc}</Typography></Box>)}
        {selected.includes(2) && <TextField select size="small" label="抠图背景" value={background} onChange={(e) => setBackground(e.target.value)}><MenuItem value="WHITE_BACKGROUND">白色</MenuItem><MenuItem value="TRANSPARENT">透明</MenuItem></TextField>}
        {selected.includes(4) && <TextField select size="small" label="目标语言（原文中文）" value={target} onChange={(e) => setTarget(e.target.value)}>{[['en','英语'],['ja','日语'],['ko','韩语'],['de','德语'],['fr','法语'],['es','西班牙语']].map(([v,l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>}
        {selected.includes(5) && <Stack direction="row" spacing={1}><TextField type="number" size="small" label="宽 px" value={width} onChange={(e) => setWidth(e.target.value)} /><TextField type="number" size="small" label="高 px" value={height} onChange={(e) => setHeight(e.target.value)} /></Stack>}
        {selected.includes(6) && <TextField select size="small" label="放大倍数" value={factor} onChange={(e) => setFactor(e.target.value)}>{[2,3,4].map((v) => <MenuItem key={v} value={v}>{v}×</MenuItem>)}</TextField>}
        <Typography variant="subtitle2" sx={{ pt: 1 }}>阿里云凭证</Typography>
        <TextField select size="small" label="地域" value={region} onChange={(e) => setRegion(e.target.value)}><MenuItem value="china">中国站 · 北京</MenuItem><MenuItem value="singapore">国际站 · 新加坡</MenuItem></TextField>
        <TextField size="small" label="AccessKey ID" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" />
        <TextField size="small" label="AccessKey Secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" />
        <Typography variant="caption" color="text.secondary">凭证仅用于当前会话请求，不保存到数据库。</Typography>
      </Stack>
    </Box>
  </Box>;
}
