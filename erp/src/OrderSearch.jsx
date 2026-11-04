import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetList } from 'react-admin';
import { Badge, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputBase, MenuItem, Stack, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import { COUNTRIES, ORDER_STATUS } from './constants';

export const ordersUrl = (filter = {}) => `/orders?filter=${encodeURIComponent(JSON.stringify(filter))}`;
const empty = { number: '', status: '', shop: '', country: '', start: '', end: '', min: '', max: '', starred: false };
const keys = ['order_no@ilike', 'status', 'status@in', 'shop_id', 'country', 'created_at@gte', 'created_at@lt', 'total_usd@gte', 'total_usd@lte', 'starred'];
const dateText = (value, previousDay = false) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (previousDay) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const fromFilter = (f) => ({
  number: f['order_no@ilike'] ?? '', status: f.status ?? f['status@in'] ?? '', shop: f.shop_id ?? '', country: f.country ?? '',
  start: dateText(f['created_at@gte']), end: dateText(f['created_at@lt'], true),
  min: f['total_usd@gte'] ?? '', max: f['total_usd@lte'] ?? '', starred: f.starred === true,
});

export function OrderSearch() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const small = useMediaQuery((t) => t.breakpoints.down('sm'));
  let filter = {};
  try { if (pathname.startsWith('/orders')) filter = JSON.parse(new URLSearchParams(search).get('filter') || '{}') || {}; } catch { /* 无效筛选按空条件处理 */ }
  const [q, setQ] = useState(filter['order_no@ilike'] ?? '');
  const [focus, setFocus] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState('');
  const { data: shops = [], isPending, error: shopError } = useGetList('shops', {
    pagination: { page: 1, perPage: 100 }, sort: { field: 'name', order: 'ASC' },
  }, { enabled: open });
  useEffect(() => { setQ(filter['order_no@ilike'] ?? ''); }, [pathname, search]);
  const count = Object.entries(filter).filter(([key, value]) => key !== 'order_no@ilike' && value !== '' && value != null).length;
  const change = (key) => (e) => { setDraft((d) => ({ ...d, [key]: e.target.value })); setError(''); };
  const apply = (e) => {
    e.preventDefault();
    if (draft.start && draft.end && draft.start > draft.end) { setError('开始日期不能晚于结束日期'); return; }
    if (draft.min !== '' && draft.max !== '' && Number(draft.min) > Number(draft.max)) { setError('最低金额不能高于最高金额'); return; }
    const next = Object.fromEntries(Object.entries(filter).filter(([key]) => !keys.includes(key)));
    if (draft.number.trim()) next['order_no@ilike'] = draft.number.trim();
    if (draft.status) next[draft.status.startsWith('(') ? 'status@in' : 'status'] = draft.status;
    if (draft.shop !== '') next.shop_id = Number(draft.shop);
    if (draft.country) next.country = draft.country;
    if (draft.start) next['created_at@gte'] = new Date(`${draft.start}T00:00:00`).toISOString();
    if (draft.end) {
      const end = new Date(`${draft.end}T00:00:00`);
      end.setDate(end.getDate() + 1);
      next['created_at@lt'] = end.toISOString();
    }
    if (draft.min !== '') next['total_usd@gte'] = Number(draft.min);
    if (draft.max !== '') next['total_usd@lte'] = Number(draft.max);
    if (draft.starred) next.starred = true;
    navigate(ordersUrl(next));
    setOpen(false);
  };
  return <>
    <Box component="form" onSubmit={(e) => {
      e.preventDefault();
      const next = { ...filter };
      if (q.trim()) next['order_no@ilike'] = q.trim(); else delete next['order_no@ilike'];
      navigate(ordersUrl(next));
    }} sx={(t) => ({ flex: 1, minWidth: 0, maxWidth: 720, height: 48, display: 'flex', alignItems: 'center', borderRadius: 6, px: 0.5,
      bgcolor: focus ? t.palette.gm.searchFocus : t.palette.gm.search,
      boxShadow: focus ? '0 1px 3px rgba(65,69,73,.3)' : 'none', transition: 'background .2s, box-shadow .2s' })}>
      <IconButton type="submit" aria-label="搜索订单"><SearchIcon /></IconButton>
      <InputBase placeholder="搜索订单号" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        sx={{ flex: 1, minWidth: 0, fontSize: 16 }} inputProps={{ 'aria-label': '搜索订单号' }} />
      {(q || Object.keys(filter).length > 0) && <Tooltip title="清除全部查询条件"><IconButton type="button" aria-label="清除全部查询条件" onClick={() => { setQ(''); navigate(ordersUrl()); }}><CloseIcon fontSize="small" /></IconButton></Tooltip>}
      <Tooltip title={count ? `高级筛选 · 已应用 ${count} 项` : '高级筛选'}><IconButton type="button" aria-label="高级筛选" aria-haspopup="dialog" aria-expanded={open}
        color={count ? 'primary' : 'default'} onClick={() => { setDraft({ ...fromFilter(filter), number: q }); setError(''); setOpen(true); }}>
        <Badge badgeContent={count} color="primary"><TuneIcon /></Badge>
      </IconButton></Tooltip>
    </Box>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={small} aria-labelledby="order-search-title">
      <Box component="form" onSubmit={apply} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DialogTitle id="order-search-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          订单高级筛选<IconButton aria-label="关闭高级筛选" onClick={() => setOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>多个条件同时满足时显示订单，留空表示不限。</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField label="订单号" placeholder="输入完整或部分订单号" value={draft.number} onChange={change('number')} autoFocus />
            <TextField select label="订单状态" value={draft.status} onChange={change('status')}>
              <MenuItem value="">全部状态</MenuItem>
              {Object.entries(ORDER_STATUS).map(([id, s]) => <MenuItem key={id} value={id}>{s.label}</MenuItem>)}
              <MenuItem value="(shipped,in_transit)">已发货及运输中</MenuItem><MenuItem value="(refunded,cancelled)">退款及取消</MenuItem>
            </TextField>
            <TextField select label="店铺" value={draft.shop} onChange={change('shop')} helperText={shopError ? '店铺加载失败，可关闭后重试' : isPending ? '正在加载店铺…' : undefined}>
              <MenuItem value="">全部店铺</MenuItem>
              {shops.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField select label="收货国家" value={draft.country} onChange={change('country')}>
              <MenuItem value="">全部国家</MenuItem>{Object.entries(COUNTRIES).map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
            </TextField>
            <TextField label="下单开始日期" type="date" value={draft.start} onChange={change('start')} InputLabelProps={{ shrink: true }} />
            <TextField label="下单结束日期（含当天）" type="date" value={draft.end} onChange={change('end')} InputLabelProps={{ shrink: true }} />
            <TextField label="最低金额（USD）" type="number" value={draft.min} onChange={change('min')} inputProps={{ min: 0, step: '0.01' }} />
            <TextField label="最高金额（USD）" type="number" value={draft.max} onChange={change('max')} inputProps={{ min: 0, step: '0.01' }} />
          </Box>
          <Stack sx={{ mt: 1 }}><FormControlLabel control={<Checkbox checked={draft.starred} onChange={(e) => setDraft((d) => ({ ...d, starred: e.target.checked }))} />} label="仅显示星标订单" /></Stack>
          {error && <Typography role="alert" color="error" variant="body2">{error}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => { setDraft(empty); setError(''); }}>重置条件</Button><Box sx={{ flex: 1 }} />
          <Button onClick={() => setOpen(false)}>取消</Button><Button type="submit" variant="contained" disableElevation>应用筛选</Button>
        </DialogActions>
      </Box>
    </Dialog>
  </>;
}
