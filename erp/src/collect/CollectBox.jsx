// 「1688 采集」页：插件安装入口 + 采集箱（插件写入的商品，审核后导入为草稿商品）
import { useState } from 'react';
import { List, useUpdate, useNotify, SimpleList } from 'react-admin';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Stack, Typography, Link, useMediaQuery } from '@mui/material';
import { AgList, col, render } from '../grid';
import { InstallCard } from './InstallCard';
import { ImportDialog, Img } from './ImportDialog';

export const DRAFT_STATUS = {
  new: { label: '待处理', color: 'warning' },
  imported: { label: '已导入', color: 'success' },
  discarded: { label: '已丢弃', color: 'default' },
};
const STATUS_CHOICES = Object.entries(DRAFT_STATUS).map(([id, v]) => ({ id, name: v.label }));
const cny = (v) => (v == null ? '-' : `¥${Number(v).toFixed(2)}`);
const priceRange = (r) => (r.price_min == null ? '-' : Number(r.price_min) === Number(r.price_max) ? cny(r.price_min) : `${cny(r.price_min)} – ${cny(r.price_max)}`);
const fmtTime = (s) => new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const Actions = ({ r, onImport }) => {
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const setStatus = (status) => update('import_drafts', { id: r.id, data: { status }, previousData: r },
    { onSuccess: () => notify(status === 'discarded' ? '已丢弃' : '已恢复'), onError: (e) => notify(e.message, { type: 'error' }) });
  if (r.status === 'imported') {
    return r.product_id ? <Button size="small" component={RouterLink} to={`/products/${r.product_id}`}>查看商品</Button> : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>商品已删除</Typography>;
  }
  if (r.status === 'discarded') return <Button size="small" color="inherit" disabled={isPending} onClick={() => setStatus('new')}>恢复</Button>;
  return (
    <Stack direction="row" spacing={0.5}>
      <Button size="small" variant="contained" disableElevation onClick={() => onImport(r)}>导入</Button>
      <Button size="small" color="inherit" disabled={isPending} onClick={() => setStatus('discarded')}>丢弃</Button>
    </Stack>
  );
};

const Title = ({ r }) => (
  <Box sx={{ minWidth: 0, lineHeight: 1.3 }}>
    <Link href={r.source_url} target="_blank" rel="noopener" underline="hover" color="inherit" title="在 1688 打开"
      sx={{ fontSize: 14, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</Link>
    <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
      {[r.supplier, r.data?.category].filter(Boolean).join(' · ')}
    </Typography>
  </Box>
);

const columns = (onImport) => [
  render('', ({ r }) => <Img src={r.image_url} size={44} />, { width: 72 }),
  render('商品（点击在 1688 打开）', ({ r }) => <Title r={r} />, { flex: 2, minWidth: 260, filterSpec: { type: 'text', source: 'title@ilike', placeholder: '标题', value: (p) => p.data?.title ?? '' } }),
  render('批发价', ({ r }) => priceRange(r), { field: 'price_min', sortable: true, width: 150 }),
  col('sku_count', '规格数', { width: 100 }),
  render('状态', ({ r }) => <Chip size="small" color={DRAFT_STATUS[r.status]?.color} label={DRAFT_STATUS[r.status]?.label} />,
    { field: 'status', sortable: true, width: 110, filterSpec: { type: 'select', source: 'status', choices: STATUS_CHOICES, placeholder: '全部' } }),
  render('采集时间', ({ r }) => fmtTime(r.updated_at), { field: 'updated_at', sortable: true, width: 130 }),
  render('操作', ({ r }) => <Actions r={r} onImport={onImport} />, { width: 160 }),
];

export const CollectBox = () => {
  const isSmall = useMediaQuery((t) => t.breakpoints.down('md'));
  const [draft, setDraft] = useState(null);
  const [cols] = useState(() => columns(setDraft));   // 列定义保持引用稳定（AgList 要求）
  return (
    <>
      <InstallCard />
      <List resource="import_drafts" title="1688 采集" sort={{ field: 'updated_at', order: 'DESC' }} perPage={25}
        pagination={isSmall ? undefined : false} actions={false} empty={false}>
        {isSmall ? (
          <SimpleList leftAvatar={(r) => <Img src={r.image_url} size={40} />} primaryText={(r) => r.title}
            secondaryText={(r) => `${priceRange(r)} · ${r.sku_count} 个规格`} tertiaryText={(r) => DRAFT_STATUS[r.status]?.label}
            rowClick={(id, _res, r) => { if (r.status === 'new') setDraft(r); return false; }} />
        ) : (
          <AgList columnDefs={cols} rowHeight={64} />
        )}
      </List>
      {draft && <ImportDialog draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
};
