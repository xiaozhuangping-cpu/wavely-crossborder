// 采集箱 → 草稿商品：选类目、填名称、勾选要保留的规格、按目标毛利批量定价
import { useMemo, useState } from 'react';
import { useNotify, useRefresh, useGetList } from 'react-admin';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack, Typography, Box, Checkbox,
  Table, TableHead, TableRow, TableCell, TableBody, InputAdornment, Link, Alert, Chip,
} from '@mui/material';
import { supabase } from '../supabase';
import { fmtMoney } from '../constants';

const CATEGORIES = ['家居', '户外', '宠物', '美妆', '数码配件'];
const FEE = 0.15;                       // 与商品页毛利估算一致：头程 ¥45/kg + 尾程 $4 + 平台佣金 15%
const freightUsd = (g, cny) => (g / 1000) * 45 * cny + 4;
// 目标毛利率反推售价，取 .99 结尾
const suggestPrice = (costCny, g, cny, margin) => {
  const p = (costCny * cny + freightUsd(g, cny)) / (1 - FEE - margin);
  return Number.isFinite(p) && p > 0 ? Math.max(Math.ceil(p) - 0.01, 0.99) : '';
};
const marginOf = (price, costCny, g, cny) => (price ? (price * (1 - FEE) - costCny * cny - freightUsd(g, cny)) / price : null);

export const Img = ({ src, size = 40 }) => (
  <Box sx={{ width: size, height: size, borderRadius: 1, overflow: 'hidden', bgcolor: '#fff', border: 1, borderColor: 'divider', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
    {src ? <Box component="img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ opacity: 0.4 }}>📦</span>}
  </Box>
);

const num = (v) => (v === '' || v == null ? '' : Number(v));

export function ImportDialog({ draft, onClose }) {
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const { data: rates = [] } = useGetList('exchange_rates', { pagination: { page: 1, perPage: 20 }, sort: { field: 'currency', order: 'ASC' } });
  const cny = Number(rates.find((r) => r.currency === 'CNY')?.rate_to_usd ?? 0.138);

  const d = draft.data ?? {};
  const [margin, setMargin] = useState(30);
  const [f, setF] = useState(() => ({
    zh: d.title?.slice(0, 60) ?? '', en: '', category: '',
    optionName: (d.props ?? []).map((p) => p.name).join(' / ') || '规格',
    image: d.images?.[0] ?? '',
  }));
  const [rows, setRows] = useState(() => (d.skus ?? []).map((s) => {
    const w = s.weight_g || 500;
    return { key: s.skuId ?? s.specText, on: true, spec: s.specText || '默认', cost: s.price ?? d.priceMin ?? 0, weight: w, image: s.image || '', price: suggestPrice(s.price ?? d.priceMin ?? 0, w, cny, 0.3) };
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const reprice = () => setRows((rs) => rs.map((r) => ({ ...r, price: suggestPrice(Number(r.cost), Number(r.weight), cny, margin / 100) })));
  const picked = rows.filter((r) => r.on);
  const allOn = picked.length === rows.length;
  const invalid = useMemo(() => {
    if (!f.zh.trim()) return '请填写中文名';
    if (!f.category) return '请选择类目';
    if (!picked.length) return '至少保留一个规格';
    if (picked.length > 100) return '最多保留 100 个规格';
    if (picked.some((r) => !(Number(r.price) > 0))) return '有规格的售价为空';
    return '';
  }, [f, picked]);

  const submit = async () => {
    if (invalid) { setErr(invalid); return; }
    setBusy(true); setErr('');
    const desc = (d.attributes ?? []).slice(0, 12).map((a) => `${a.name}：${a.value}`).join('；');
    const { data: id, error } = await supabase.rpc('import_draft', {
      p_draft: draft.id,
      p: {
        name: { zh: f.zh.trim(), ...(f.en.trim() ? { en: f.en.trim() } : {}) },
        category: f.category,
        option_name: { zh: f.optionName.trim() || '规格' },
        image_url: f.image || null,
        description: desc ? { zh: desc } : {},
        skus: picked.map((r) => ({ option_value: { zh: r.spec.slice(0, 80) }, cost_cny: Number(r.cost) || 0, price_usd: Number(r.price), weight_g: Math.round(Number(r.weight) || 500), image_url: r.image || null })),
      },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    notify(`已导入为草稿商品，共 ${picked.length} 个 SKU`, { type: 'success' });
    refresh();
    onClose();
    navigate(`/products/${id}`);
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        导入为商品
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          <Link href={draft.source_url} target="_blank" rel="noopener">{draft.title}</Link>
          {d.supplier && ` · ${d.supplier}`}{d.moq && ` · ${d.moq}${d.unit ?? '件'}起批`}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="中文名" value={f.zh} onChange={(e) => set({ zh: e.target.value })} size="small" fullWidth required
              helperText="1688 标题通常堆砌关键词，建议改成简洁的商品名" />
            <TextField select label="类目" value={f.category} onChange={(e) => set({ category: e.target.value })} size="small" sx={{ minWidth: 140 }} required
              helperText={d.category ? `1688：${d.category}` : ' '}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="English name（可选）" value={f.en} onChange={(e) => set({ en: e.target.value })} size="small" fullWidth
              helperText="也可以导入后让 ✦ AI 运营助手写多语言 Listing" />
            <TextField label="规格名" value={f.optionName} onChange={(e) => set({ optionName: e.target.value })} size="small" sx={{ minWidth: 180 }} />
          </Stack>

          {d.images?.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>主图（点击选择）</Typography>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                {d.images.map((src) => (
                  <Box key={src} onClick={() => set({ image: src })} sx={{ cursor: 'pointer', borderRadius: 1.5, outline: f.image === src ? '2px solid' : 'none', outlineColor: 'primary.main', outlineOffset: 2 }}>
                    <Img src={src} size={64} />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>规格 SKU</Typography>
            <Chip size="small" label={`已选 ${picked.length} / ${rows.length}`} />
            <Box sx={{ flex: 1 }} />
            <TextField label="目标毛利率" type="number" size="small" value={margin} onChange={(e) => setMargin(num(e.target.value))} sx={{ width: 120 }}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
            <Button size="small" variant="outlined" onClick={reprice}>按毛利重算售价</Button>
          </Stack>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: '4px !important' }}>
            成本为 1688 批发价；毛利按 头程 ¥45/kg + 尾程 $4 + 佣金 15% 估算，汇率 1 CNY = ${cny}
          </Typography>

          <Box sx={{ maxHeight: 360, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={allOn} indeterminate={!allOn && picked.length > 0}
                    onChange={() => setRows((rs) => rs.map((r) => ({ ...r, on: !allOn })))} /></TableCell>
                  <TableCell>规格</TableCell>
                  <TableCell sx={{ width: 110 }}>成本 ¥</TableCell>
                  <TableCell sx={{ width: 100 }}>重量 g</TableCell>
                  <TableCell sx={{ width: 120 }}>售价 $</TableCell>
                  <TableCell sx={{ width: 80 }}>毛利</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => {
                  const m = marginOf(Number(r.price), Number(r.cost), Number(r.weight), cny);
                  return (
                    <TableRow key={r.key ?? i} sx={{ opacity: r.on ? 1 : 0.45 }}>
                      <TableCell padding="checkbox"><Checkbox size="small" checked={r.on} onChange={() => setRow(i, { on: !r.on })} /></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Img src={r.image} size={32} />
                          <TextField variant="standard" value={r.spec} onChange={(e) => setRow(i, { spec: e.target.value })} fullWidth
                            slotProps={{ input: { disableUnderline: true, sx: { fontSize: 13 } } }} />
                        </Stack>
                      </TableCell>
                      <TableCell><TextField variant="standard" type="number" value={r.cost} onChange={(e) => setRow(i, { cost: num(e.target.value) })} slotProps={{ input: { sx: { fontSize: 13 } } }} /></TableCell>
                      <TableCell><TextField variant="standard" type="number" value={r.weight} onChange={(e) => setRow(i, { weight: num(e.target.value) })} slotProps={{ input: { sx: { fontSize: 13 } } }} /></TableCell>
                      <TableCell><TextField variant="standard" type="number" value={r.price} onChange={(e) => setRow(i, { price: num(e.target.value) })} slotProps={{ input: { sx: { fontSize: 13 } } }} /></TableCell>
                      <TableCell sx={{ fontSize: 13, color: m == null ? 'text.secondary' : m >= 0.25 ? 'success.main' : m >= 0.1 ? 'warning.main' : 'error.main' }}>
                        {m == null ? '-' : `${Math.round(m * 100)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          {picked.length > 0 && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              售价区间 {fmtMoney(Math.min(...picked.map((r) => Number(r.price) || Infinity)))} – {fmtMoney(Math.max(...picked.map((r) => Number(r.price) || 0)))}
              · 导入后为<b>草稿</b>状态，不会出现在独立站，确认无误后在商品页改为「在售」
            </Typography>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={busy}>取消</Button>
        <Button onClick={submit} variant="contained" disableElevation disabled={busy}>{busy ? '导入中…' : `导入 ${picked.length} 个 SKU`}</Button>
      </DialogActions>
    </Dialog>
  );
}
