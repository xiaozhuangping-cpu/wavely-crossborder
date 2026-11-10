import { useEffect, useRef, useState } from 'react';
import { Title, useGetList } from 'react-admin';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import { supabase } from '../supabase';

const abilities = [[1,'元素识别'],[2,'智能抠图'],[3,'智能消除'],[4,'图片翻译'],[5,'智能裁剪'],[6,'高清放大']];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const panel = { border: 1, borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.paper', p: { xs: 2, md: 2.5 }, minWidth: 0 };
export function ImageWorkbench() {
  const [items, setItems] = useState([]), [link, setLink] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [keyId, setKeyId] = useState(''), [secret, setSecret] = useState(''), [region, setRegion] = useState('china');
  const [selected, setSelected] = useState([2]), [background, setBackground] = useState('WHITE_BACKGROUND'), [target, setTarget] = useState('en');
  const [detectObject, setDetectObject] = useState([]), [detectBackground, setDetectBackground] = useState([1,2,3,4]), [filterMatch, setFilterMatch] = useState(true);
  const [removeObject, setRemoveObject] = useState([]), [removeBackground, setRemoveBackground] = useState([1,3,4]), [productText, setProductText] = useState(false), [brandText, setBrandText] = useState(false);
  const [width, setWidth] = useState(1000), [height, setHeight] = useState(1000), [factor, setFactor] = useState(2), [productId, setProductId] = useState('');
  const alive = useRef(true), input = useRef(null);
  const { data: products = [] } = useGetList('products', { pagination: { page: 1, perPage: 100 }, sort: { field: 'id', order: 'DESC' } });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const patch = (id, changes) => { if (alive.current) setItems((all) => all.map((x) => x.id === id ? { ...x, ...changes } : x)); };
  const call = async (body) => {
    const { data, error: err } = await supabase.functions.invoke('vision-flow', { body: { ...body, accessKeyId: keyId, accessKeySecret: secret, region } });
    if (err) { let d; try { d = await err.context.json(); } catch { /* network error */ } throw new Error(d?.error || err.message); }
    if (data?.error) throw new Error(data.error); return data;
  };
  const addUrl = () => { try { const url = new URL(link.trim()); if (!['https:', 'http:'].includes(url.protocol)) throw Error(); setItems((s) => [...s, { id: crypto.randomUUID(), source: url.href, name: '图片链接', status: '待处理' }]); setLink(''); setError(''); } catch { setError('请输入有效的 HTTP 或 HTTPS 图片地址'); } };
  const addFiles = async (event) => {
    const files = Array.from(event.target.files || []); event.target.value = ''; setError(''); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('请先登录');
      for (const file of files) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(`${file.name}：仅支持 5 MB 以内的 JPG、PNG、WebP。`); continue; }
        const img = await createImageBitmap(file); const long = Math.max(img.width,img.height), short = Math.min(img.width,img.height); img.close();
        if (short <= 256 || long > 1920 || short > 1080) { setError(`${file.name}：图片尺寸不符合要求。`); continue; }
        const ext = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }[file.type];
        const path = `vision-flow/${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: e } = await supabase.storage.from('product-media').upload(path, file, { contentType: file.type }); if (e) throw e;
        setItems((s) => [...s, { id: crypto.randomUUID(), source: supabase.storage.from('product-media').getPublicUrl(path).data.publicUrl, name: file.name, status: '待处理' }]);
      }
    } catch (e) { setError(`上传失败：${e.message}`); } finally { setBusy(false); }
  };
  const run = async () => {
    setError('');
    if (!items.some((x) => ['待处理','失败'].includes(x.status)) || !keyId.trim() || !secret.trim() || !selected.length) { setError('请添加图片、填写阿里云凭证并选择处理能力。'); return; }
    if (selected.includes(5) && ![width,height].every((n) => Number.isInteger(Number(n)) && n >= 100 && n <= 5000)) { setError('裁剪宽高须为 100–5000 的整数。'); return; }
    if (selected.includes(1) && !detectObject.length && !detectBackground.length) { setError('元素识别至少选择一项检测内容。'); return; }
    if (selected.includes(3) && !removeObject.length && !removeBackground.length) { setError('智能消除至少选择一项消除内容。'); return; }
    setBusy(true);
    const params = { ability: selected, ...(selected.includes(1) && { objectDetectElements: detectObject, nonobjectDetectElements: detectBackground, isFilter: filterMatch }), ...(selected.includes(2) && { backGroundType: background }), ...(selected.includes(3) && { objectRemoveElements: removeObject, nonobjectRemoveElements: removeBackground }), ...(selected.includes(4) && { sourceLanguage: ['en','ja','ko'].includes(target) ? 'zh' : 'zh-en', targetLanguage: target, includingProductArea: productText, translatingBrandInTheProduct: brandText }), ...(selected.includes(5) && { targetWidth: Number(width), targetHeight: Number(height) }), ...(selected.includes(6) && { upscaleFactor: Number(factor) }) };
    for (const item of items.filter((x) => ['待处理','失败'].includes(x.status))) {
      if (!alive.current) break;
      try {
        patch(item.id, { status: '提交中', error: '', result: null });
        const { taskId } = await call({ action: 'submit', params: { ...params, imageUrl: item.source } }); patch(item.id, { status: '处理中', taskId });
        let done = false;
        for (let n = 0; n < 120 && alive.current; n++) {
          await wait(5000); if (!alive.current) break;
          const data = await call({ action: 'query', taskId });
          if (data.status === 'FAILED') throw new Error(data.result?.error || '处理失败');
          if (data.status === 'COMPLETED') { const output = data.result?.Result ?? data.result; if (!output?.FinalUrl) { if (!selected.includes(1)) throw new Error('任务完成但未返回图片'); patch(item.id, { status: '已完成', detection: output ?? {} }); done = true; break; } patch(item.id, { status: '保存中', result: output.FinalUrl }); const saved = await call({ action: 'save', resultUrl: output.FinalUrl }); patch(item.id, { status: '已完成', result: saved.url }); done = true; break; }
        }
        if (!done && alive.current) patch(item.id, { status: '超时', error: `任务仍在处理，任务 ID：${taskId}` });
      } catch (e) { patch(item.id, { status: '失败', error: e.message }); }
    }
    if (alive.current) setBusy(false);
  };
  const apply = async (item) => {
    setBusy(true); setError('');
    const { data, error: e } = await supabase.from('products').update({ image_url: item.result }).eq('id', productId).select('id');
    if (e || !data?.length) setError(`更新商品失败：${e?.message || '没有权限或商品不存在'}`); else patch(item.id, { applied: true }); setBusy(false);
  };
  return <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1440, mx: 'auto' }}><Title title="商品图片工作台" />
    <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" gap={1} sx={{ mb: 3 }}><Box><Typography variant="overline" color="primary.main" fontWeight={700}>PRODUCT STUDIO</Typography><Typography variant="h5" fontWeight={700}>商品图片工作台</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>准备素材、组合处理能力，批量生成适合跨境上架的商品图。</Typography></Box><Chip label="阿里云 VisionFlow" variant="outlined" sx={{ alignSelf:'start' }} /></Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'minmax(0, 1fr)', md:'minmax(0, 1fr) 300px', xl:'minmax(0, 1fr) 340px' }, gap:2, alignItems:'start' }}><Stack spacing={2} sx={{ minWidth: 0 }}>
      <Box sx={panel}><Typography variant="subtitle1" fontWeight={700}>添加商品图片</Typography><Typography variant="body2" color="text.secondary" sx={{ mt:.5 }}>上传本地图片或添加公网链接，支持批量处理。</Typography><Stack direction={{ xs:'column', sm:'row' }} spacing={1} sx={{ mt:2 }}><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles} /><Button variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={busy} onClick={() => input.current?.click()} sx={{ whiteSpace:'nowrap', minWidth:130 }}>上传图片</Button><TextField variant="outlined" size="small" fullWidth placeholder="粘贴可公开访问的图片链接" value={link} onChange={(e) => setLink(e.target.value)} /><Button variant="outlined" disabled={busy || !link.trim()} onClick={addUrl} sx={{ whiteSpace:'nowrap', minWidth:100 }}>添加链接</Button></Stack><Typography variant="caption" color="text.secondary" sx={{ display:'block', mt:1.5 }}>JPG / PNG / WebP，最大 5 MB；短边大于 256 且不超过 1080 px，长边不超过 1920 px。</Typography></Box>
      <Box sx={panel}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="subtitle1" fontWeight={700}>处理队列</Typography><Typography variant="body2" color="text.secondary">{items.length} 张图片 · 按顺序处理，每张单独显示结果</Typography></Box><Button disabled={busy || !items.length} onClick={() => setItems([])}>清空</Button></Stack>
        {!items.length && <Box sx={{ minHeight:{ xs:120, md:180 }, display:'grid', placeItems:'center', color:'text.secondary', textAlign:'center' }}><Box><AddPhotoAlternateOutlinedIcon sx={{ fontSize:32, opacity:.45 }} /><Typography>添加商品图片，开始制作</Typography></Box></Box>}
        <Stack spacing={2} sx={{ mt:2 }}>{items.map((item) => <Box key={item.id} sx={{ border:1, borderColor:'divider', borderRadius:2, p:2 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="subtitle2" noWrap sx={{ maxWidth:'65%' }}>{item.name}</Typography><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={item.status} color={item.status === '已完成' ? 'success' : item.status === '失败' ? 'error' : 'default'} /><Button size="small" disabled={busy} onClick={() => setItems((s) => s.filter((x) => x.id !== item.id))}>移除</Button></Stack></Stack>
          <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.5, mt:1 }}>{[['原图',item.source],['处理结果',item.result]].map(([label,url]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Box sx={{ aspectRatio:'1.3', bgcolor:'action.hover', borderRadius:1.5, display:'grid', placeItems:'center', overflow:'hidden' }}>{url ? <Box component="img" src={url} alt={label} sx={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <Typography variant="caption" color="text.secondary">等待处理</Typography>}</Box></Box>)}</Box>
          {item.detection && <Alert severity="info" sx={{ mt:1 }}>识别完成：{JSON.stringify(item.detection)}</Alert>}{item.error && <Alert severity="error" sx={{ mt:1 }}>{item.error}</Alert>}{item.status === '已完成' && item.result && <Stack direction="row" spacing={1} sx={{ mt:1, flexWrap:'wrap' }}><Button size="small" component="a" href={item.result} target="_blank" rel="noreferrer">查看 / 下载</Button><Button size="small" disabled={busy || !productId} onClick={() => apply(item)}>应用到所选商品</Button>{item.applied && <Chip size="small" color="success" label="已应用" />}</Stack>}
        </Box>)}</Stack>{busy && <LinearProgress sx={{ mt:2 }} />}{!!items.length && <TextField select fullWidth size="small" label="将结果应用为商品主图（可选）" value={productId} onChange={(e) => setProductId(e.target.value)} sx={{ mt:2 }}><MenuItem value="">不关联商品</MenuItem>{products.map((p) => <MenuItem key={p.id} value={p.id}>{p.sku} · {p.name?.zh}</MenuItem>)}</TextField>}
      </Box></Stack><Stack spacing={2} sx={{ alignSelf:'start', minWidth:0, position:{ md:'sticky' }, top:16 }}><Box sx={panel}><Typography variant="subtitle1" fontWeight={700}>处理设置</Typography><Typography variant="body2" color="text.secondary" sx={{ mb:1 }}>可组合多项能力，按阿里云实际调用计费。</Typography>{abilities.map(([value,label]) => <FormControlLabel key={value} sx={{ display:'inline-flex', width:'50%', mr:0, my:-.25 }} control={<Checkbox size="small" checked={selected.includes(value)} onChange={() => setSelected((s) => s.includes(value) ? s.filter((x) => x !== value) : [...s,value].sort())} />} label={label} />)}
        <Stack spacing={1.5} sx={{ mt:1 }}>
          {selected.includes(1) && <Box><Typography variant="subtitle2">检测元素</Typography>{[[detectObject,setDetectObject,'商品主体'],[detectBackground,setDetectBackground,'背景']].map(([values,setValues,label]) => <Box key={label} sx={{ mt:1 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Box>{[[1,'水印'],[2,'Logo'],[3,'文字'],[4,'含字色块']].map(([v,l]) => <FormControlLabel key={v} sx={{ mr:1 }} control={<Checkbox size="small" checked={values.includes(v)} onChange={() => setValues((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s,v])} />} label={<Typography variant="body2">{l}</Typography>} />)}</Box></Box>)}<TextField select fullWidth size="small" label="后续处理" value={filterMatch ? 'match' : 'other'} onChange={(e) => setFilterMatch(e.target.value === 'match')}><MenuItem value="match">仅处理检测到元素的图片</MenuItem><MenuItem value="other">仅处理未检测到元素的图片</MenuItem></TextField></Box>}
          {selected.includes(3) && <Box><Typography variant="subtitle2">消除内容</Typography>{[[removeObject,setRemoveObject,'商品主体'],[removeBackground,setRemoveBackground,'背景']].map(([values,setValues,label]) => <Box key={label} sx={{ mt:1 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Box>{[[1,'透明字块'],[2,'特定名称'],[3,'文字'],[4,'牛皮癣']].map(([v,l]) => <FormControlLabel key={v} sx={{ mr:1 }} control={<Checkbox size="small" checked={values.includes(v)} onChange={() => setValues((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s,v])} />} label={<Typography variant="body2">{l}</Typography>} />)}</Box></Box>)}</Box>}
          {selected.includes(4) && <Box><FormControlLabel control={<Checkbox size="small" checked={productText} onChange={(e) => setProductText(e.target.checked)} />} label={<Typography variant="body2">翻译商品主体文字</Typography>} /><FormControlLabel control={<Checkbox size="small" checked={brandText} onChange={(e) => setBrandText(e.target.checked)} />} label={<Typography variant="body2">翻译品牌名称</Typography>} /><Typography variant="caption" color="text.secondary" display="block">默认保留主体文字和品牌名，避免误翻。</Typography></Box>}
{selected.includes(2) && <TextField select size="small" label="抠图背景" value={background} onChange={(e) => setBackground(e.target.value)}><MenuItem value="WHITE_BACKGROUND">白色</MenuItem><MenuItem value="TRANSPARENT">透明</MenuItem></TextField>}{selected.includes(4) && <TextField select size="small" label="目标语言（原文中文）" value={target} onChange={(e) => setTarget(e.target.value)}>{[['en','英语'],['ja','日语'],['ko','韩语'],['de','德语'],['fr','法语'],['es','西班牙语']].map(([v,l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>}{selected.includes(5) && <Stack direction="row" spacing={1}><TextField size="small" type="number" label="宽 px" value={width} onChange={(e) => setWidth(e.target.value)} /><TextField size="small" type="number" label="高 px" value={height} onChange={(e) => setHeight(e.target.value)} /></Stack>}{selected.includes(6) && <TextField select size="small" label="放大倍数" value={factor} onChange={(e) => setFactor(e.target.value)}>{[2,3,4].map((v) => <MenuItem key={v} value={v}>{v}×</MenuItem>)}</TextField>}</Stack></Box>
        <Box sx={panel}><Typography variant="subtitle1" fontWeight={700}>阿里云凭证</Typography><Typography variant="caption" color="text.secondary">使用自己的 AccessKey，凭证仅保留在当前页面内存。</Typography><Stack spacing={1.5} sx={{ mt:2 }}><TextField select size="small" label="地域" value={region} onChange={(e) => setRegion(e.target.value)}><MenuItem value="china">中国站 · 北京</MenuItem><MenuItem value="singapore">国际站 · 新加坡</MenuItem></TextField><TextField size="small" label="AccessKey ID" value={keyId} onChange={(e) => setKeyId(e.target.value)} autoComplete="off" /><TextField size="small" type="password" label="AccessKey Secret" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" /><Button variant="contained" size="large" disabled={busy || !items.length} onClick={run}>开始处理 {items.length ? `· ${items.length} 张` : ''}</Button></Stack></Box></Stack>
    </Box></Box>;
}
