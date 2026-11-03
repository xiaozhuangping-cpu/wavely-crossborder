import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  List, Show, Edit, SimpleForm, TextField, SelectInput, useRecordContext, useRefresh, useNotify, useListContext,
  useGetList, useGetOne, useUpdate, useUpdateMany,
} from 'react-admin';
import {
  Box, Chip, Stack, Typography, Divider, Checkbox, IconButton, Tooltip, Avatar, useMediaQuery, Skeleton, Button,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import InboxIcon from '@mui/icons-material/Inbox';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import LabelImportantIcon from '@mui/icons-material/LabelImportant';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../supabase';
import { ORDER_STATUS, SHIP_STATUS, COUNTRIES, PLATFORMS, toChoices, fmtMoney } from '../constants';

export const StatusChip = ({ source = 'status' }) => {
  const r = useRecordContext();
  if (!r) return null;
  const s = ORDER_STATUS[r[source]];
  return <Chip size="small" label={s?.label ?? r[source]} color={s?.color ?? 'default'} />;
};

const ORDER_COLUMNS = ['*', 'shops(name,platform)', 'customers(name)', 'order_items(qty,products(name))'];
const ACTIONABLE = ['paid', 'pending'];       // 相当于「未读」：需要处理的订单
const AVATAR_COLORS = ['#e8710a', '#1a73e8', '#d93025', '#188038', '#9334e6', '#e52592', '#12b5cb', '#f9ab00'];
const avatarColor = (s = '') => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const fmtDate = (iso) => {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.toLocaleDateString('zh-CN');
};

const snippet = (r) => (r.order_items ?? []).map((i) => `${i.products?.name?.zh ?? '商品'} ×${i.qty}`).join('，');

const shipOrders = async (ids) => {
  const results = await Promise.allSettled(ids.map((id) => supabase.rpc('ship_order', { p_order_id: id })));
  return results.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
};

// ========== 列表（收件箱） ==========
const TABS = [
  { key: 'all',     label: '全部',   icon: <InboxIcon />,          color: '#0b57d0', filter: {} },
  { key: 'paid',    label: '待发货', icon: <ScheduleIcon />,        color: '#d93025', filter: { status: 'paid' } },
  { key: 'transit', label: '运输中', icon: <FlightTakeoffIcon />,   color: '#188038', filter: { 'status@in': '(shipped,in_transit)' } },
  { key: 'done',    label: '已妥投', icon: <TaskAltIcon />,         color: '#9334e6', filter: { status: 'delivered' } },
];
const STATUS_KEYS = ['status', 'status@in'];

const Tabs = () => {
  const { filterValues, setFilters } = useListContext();
  const active = TABS.find((t) => STATUS_KEYS.every((k) => (t.filter[k] ?? undefined) === filterValues[k]))?.key;
  const pick = (t) => {
    const rest = Object.fromEntries(Object.entries(filterValues).filter(([k]) => !STATUS_KEYS.includes(k)));
    setFilters({ ...rest, ...t.filter }, {});
  };
  return (
    <Box sx={{ display: { xs: 'none', md: 'flex' }, borderBottom: 1, borderColor: 'divider' }}>
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <Box key={t.key} role="tab" aria-selected={on} onClick={() => pick(t)}
            sx={(th) => ({
              flex: '0 1 250px', height: 56, display: 'flex', alignItems: 'center', gap: 2, px: 2, cursor: 'pointer', position: 'relative',
              color: on ? t.color : th.palette.text.secondary, fontWeight: on ? 600 : 500, fontSize: 14,
              '&:hover': { bgcolor: th.palette.gm.navHover },
              '&::after': on ? { content: '""', position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderRadius: '3px 3px 0 0', bgcolor: t.color } : {},
            })}>
            {t.icon}{t.label}
          </Box>
        );
      })}
    </Box>
  );
};

const Toolbar = () => {
  const { data = [], selectedIds, onSelect, onUnselectItems, page, perPage, total = 0, setPage, refetch } = useListContext();
  const [updateMany] = useUpdateMany();
  const notify = useNotify();
  const refresh = useRefresh();
  const all = data.length > 0 && data.every((r) => selectedIds.includes(r.id));
  const some = selectedIds.length > 0;
  const from = total ? (page - 1) * perPage + 1 : 0, to = Math.min(page * perPage, total);

  return (
    <Box sx={{ height: 48, display: 'flex', alignItems: 'center', px: { xs: 1, md: 1.5 }, gap: 0.5, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
      <Checkbox size="small" checked={all} indeterminate={some && !all} onChange={() => (all || some ? onUnselectItems() : onSelect(data.map((r) => r.id)))} />
      {some ? (
        <>
          <Tooltip title="批量发货"><IconButton onClick={async () => {
            const n = await shipOrders(selectedIds);
            notify(`已发货 ${n} 单（仅「待发货」订单可发货）`, { type: n ? 'success' : 'warning' });
            onUnselectItems(); refresh();
          }}><LocalShippingOutlinedIcon /></IconButton></Tooltip>
          <Tooltip title="添加星标"><IconButton onClick={() => updateMany('orders', { ids: selectedIds, data: { starred: true } }, { onSuccess: () => { onUnselectItems(); refresh(); } })}><StarBorderIcon /></IconButton></Tooltip>
          <Tooltip title="取消选择"><IconButton onClick={onUnselectItems}><CloseIcon /></IconButton></Tooltip>
          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>已选 {selectedIds.length} 项</Typography>
        </>
      ) : (
        <Tooltip title="刷新"><IconButton onClick={() => refetch()}><RefreshIcon /></IconButton></Tooltip>
      )}
      <Box sx={{ flex: 1 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>第 {from}–{to} 条，共 {total.toLocaleString()} 条</Typography>
      <IconButton size="small" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeftIcon /></IconButton>
      <IconButton size="small" disabled={to >= total} onClick={() => setPage(page + 1)}><ChevronRightIcon /></IconButton>
    </Box>
  );
};

const Star = ({ record, size = 'small' }) => {
  const [update] = useUpdate();
  const on = !!record.starred;
  return (
    <Tooltip title={on ? '取消星标' : '添加星标'}>
      <IconButton size={size} onClick={(e) => { e.stopPropagation(); update('orders', { id: record.id, data: { starred: !on }, previousData: record, meta: { columns: ORDER_COLUMNS } }); }}
        sx={{ color: on ? '#f4b400' : 'text.secondary' }}>
        {on ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

const ShopLabel = ({ shop }) => shop ? (
  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', px: 0.75, height: 18, mr: 0.75, borderRadius: 1, fontSize: 12, fontWeight: 500,
    bgcolor: `${PLATFORMS[shop.platform]?.color}22`, color: PLATFORMS[shop.platform]?.color, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
    {shop.name}
  </Box>
) : null;

const Row = ({ r }) => {
  const { selectedIds, onToggleItem } = useListContext();
  const navigate = useNavigate();
  const unread = ACTIONABLE.includes(r.status);
  const selected = selectedIds.includes(r.id);
  const open = () => navigate(`/orders/${r.id}/show`);

  return (
    <Box onClick={open} role="row"
      sx={(t) => ({
        display: 'flex', alignItems: 'center', height: 40, pl: 1.5, pr: 2, cursor: 'pointer', fontSize: 14,
        borderBottom: `1px solid ${t.palette.gm.border}`,
        bgcolor: selected ? t.palette.gm.selectedRow : unread ? t.palette.gm.unreadRow : t.palette.gm.readRow,
        fontWeight: unread ? 700 : 400, color: 'text.primary',
        '&:hover': { boxShadow: t.palette.gm.rowShadow, position: 'relative', zIndex: 1 },
        '&:hover .row-date': { display: 'none' }, '&:hover .row-actions': { display: 'flex' },
      })}>
      <Checkbox size="small" checked={selected} onClick={(e) => e.stopPropagation()} onChange={() => onToggleItem(r.id)} />
      <Star record={r} />
      <Box sx={{ width: 200, flexShrink: 0, pl: 1, pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.customers?.name ?? '访客'}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <ShopLabel shop={r.shops} />
        <span>订单 {r.order_no} · {fmtMoney(r.total_amount, r.currency)}</span>
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}> - {ORDER_STATUS[r.status]?.label}：{snippet(r)}</Box>
      </Box>
      <Box className="row-date" sx={{ width: 80, textAlign: 'right', fontSize: 12, flexShrink: 0, color: unread ? 'text.primary' : 'text.secondary' }}>
        {fmtDate(r.created_at)}
      </Box>
      <Box className="row-actions" sx={{ width: 80, display: 'none', justifyContent: 'flex-end', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {ACTIONABLE.includes(r.status) && <RowShip id={r.id} />}
      </Box>
    </Box>
  );
};

const RowShip = ({ id }) => {
  const refresh = useRefresh();
  const notify = useNotify();
  return (
    <Tooltip title="发货"><IconButton size="small" onClick={async () => {
      const { error } = await supabase.rpc('ship_order', { p_order_id: id });
      if (error) notify(error.message, { type: 'error' }); else { notify('已生成运单并发货', { type: 'success' }); refresh(); }
    }}><LocalShippingOutlinedIcon fontSize="small" /></IconButton></Tooltip>
  );
};

const MobileRow = ({ r }) => {
  const navigate = useNavigate();
  const unread = ACTIONABLE.includes(r.status);
  const name = r.customers?.name ?? '访客';
  return (
    <Box onClick={() => navigate(`/orders/${r.id}/show`)} sx={{ display: 'flex', gap: 1.5, px: 2, py: 1.25, cursor: 'pointer' }}>
      <Avatar sx={{ bgcolor: avatarColor(name), width: 40, height: 40, fontSize: 18 }}>{name[0]}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
          <Typography noWrap sx={{ fontWeight: unread ? 700 : 400, fontSize: 16, minWidth: 0 }}>{name}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: unread ? 700 : 400, flexShrink: 0, color: unread ? 'text.primary' : 'text.secondary' }}>{fmtDate(r.created_at)}</Typography>
        </Stack>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: unread ? 700 : 400 }}>{r.shops?.name} · {fmtMoney(r.total_amount, r.currency)}</Typography>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Typography noWrap sx={{ fontSize: 14, color: 'text.secondary', flex: 1, minWidth: 0 }}>{ORDER_STATUS[r.status]?.label}：{snippet(r)}</Typography>
          <Box sx={{ mr: -1 }}><Star record={r} /></Box>
        </Stack>
      </Box>
    </Box>
  );
};

const Inbox = () => {
  const { data, isPending } = useListContext();
  const small = useMediaQuery((t) => t.breakpoints.down('md'));
  return (
    <Box>
      <Toolbar />
      <Tabs />
      {isPending && [...Array(12)].map((_, i) => <Skeleton key={i} variant="rectangular" height={39} sx={{ mb: '1px' }} />)}
      {!isPending && data?.length === 0 && (
        <Box sx={{ py: 10, textAlign: 'center', color: 'text.secondary' }}>
          <InboxIcon sx={{ fontSize: 64, opacity: 0.4 }} />
          <Typography>这里没有订单</Typography>
        </Box>
      )}
      {data?.map((r) => (small ? <MobileRow key={r.id} r={r} /> : <Row key={r.id} r={r} />))}
    </Box>
  );
};

export const OrderList = () => (
  <List
    actions={false}
    perPage={50}
    sort={{ field: 'created_at', order: 'DESC' }}
    queryOptions={{ meta: { columns: ORDER_COLUMNS } }}
    pagination={false}
    empty={false}
    title="订单"
  >
    <Inbox />
  </List>
);

// ========== 详情（阅读邮件） ==========
const Items = () => {
  const r = useRecordContext();
  const { data: items = [] } = useGetList('order_items', { filter: { order_id: r?.id }, pagination: { page: 1, perPage: 50 }, sort: { field: 'id', order: 'ASC' }, meta: { columns: ['*', 'products(sku,name)'] } }, { enabled: !!r });
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
      {items.map((i) => (
        <Stack key={i.id} direction="row" sx={{ justifyContent: 'space-between', gap: 2, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 500 }}>{i.products?.name?.zh ?? '…'}</Typography>
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>{i.products?.sku} · {i.products?.name?.en}</Typography>
          </Box>
          <Typography sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(i.unit_price, r.currency)} × {i.qty}</Typography>
        </Stack>
      ))}
      <Stack direction="row" sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
        <Typography sx={{ fontWeight: 600 }}>合计</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontWeight: 600 }}>{fmtMoney(r?.total_amount, r?.currency)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>≈ {fmtMoney(r?.total_usd)}</Typography>
        </Box>
      </Stack>
    </Box>
  );
};

const Tracking = () => {
  const r = useRecordContext();
  const { data: ships = [] } = useGetList('shipments', { filter: { order_id: r?.id }, pagination: { page: 1, perPage: 5 }, sort: { field: 'id', order: 'ASC' } }, { enabled: !!r });
  const ship = ships[0];
  const { data: events = [] } = useGetList('tracking_events', { filter: { shipment_id: ship?.id }, pagination: { page: 1, perPage: 50 }, sort: { field: 'event_time', order: 'DESC' } }, { enabled: !!ship });
  if (!ship) return <Typography sx={{ color: 'text.secondary' }}>尚未发货</Typography>;
  return (
    <Box>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Chip label={ship.carrier} size="small" />
        <Chip label={ship.tracking_no} size="small" variant="outlined" />
        <Chip label={SHIP_STATUS[ship.status]} size="small" color={ship.status === 'delivered' ? 'success' : 'info'} />
      </Stack>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {events.map((e, idx) => (
          <Box component="li" key={e.id} sx={{ position: 'relative', pl: 3, pb: 2,
            '&::before': { content: '""', position: 'absolute', left: 5, top: 6, width: 10, height: 10, borderRadius: '50%', bgcolor: idx === 0 ? 'primary.main' : 'grey.500' },
            '&::after': idx < events.length - 1 ? { content: '""', position: 'absolute', left: 9, top: 18, bottom: 0, width: 2, bgcolor: 'divider' } : {} }}>
            <Typography sx={{ fontWeight: idx === 0 ? 600 : 400 }}>{e.description}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{e.location} · {new Date(e.event_time).toLocaleString('zh-CN')}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ShipButton = () => {
  const r = useRecordContext();
  const refresh = useRefresh();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  if (!r || !ACTIONABLE.includes(r.status)) return null;
  return (
    <Button variant="contained" startIcon={<LocalShippingOutlinedIcon />} disabled={busy} onClick={async () => {
      setBusy(true);
      const { error } = await supabase.rpc('ship_order', { p_order_id: r.id });
      setBusy(false);
      if (error) notify(error.message, { type: 'error' });
      else { notify('已生成运单并发货', { type: 'success' }); refresh(); }
    }}>发货</Button>
  );
};

const Message = () => {
  const r = useRecordContext();
  const navigate = useNavigate();
  const { data: c } = useGetOne('customers', { id: r?.customer_id }, { enabled: !!r?.customer_id });
  const { data: s } = useGetOne('shops', { id: r?.shop_id }, { enabled: !!r?.shop_id });
  if (!r) return null;
  const name = c?.name ?? '访客';
  return (
    <Box>
      <Box sx={{ height: 48, display: 'flex', alignItems: 'center', px: 1, gap: 0.5, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
        <Tooltip title="返回"><IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton></Tooltip>
        <Box sx={{ flex: 1 }} />
        <Star record={r} size="medium" />
      </Box>
      <Box sx={{ px: { xs: 2, md: 9 }, pb: 4 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 2 }}>
          <Typography sx={{ fontSize: { xs: 20, md: 22 }, fontWeight: 400 }}>订单 {r.order_no}</Typography>
          <StatusChip />
          {s && <Chip size="small" icon={<LabelImportantIcon sx={{ color: `${PLATFORMS[s.platform]?.color} !important` }} />} label={s.name} variant="outlined" />}
        </Stack>
        <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start', mb: 3 }}>
          <Avatar sx={{ bgcolor: avatarColor(name), width: 40, height: 40 }}>{name[0]}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14 }}><b>{name}</b> <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>&lt;{c?.email ?? '-'}&gt;</Box></Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              收货国家 {COUNTRIES[r.country] ?? r.country} · {r.source === 'site' ? '独立站下单' : `来自 ${s?.name ?? '平台'}`}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('zh-CN')}</Typography>
        </Stack>

        <Box sx={{ pl: { md: 7 } }}>
          <Typography sx={{ mb: 2 }}>
            {ACTIONABLE.includes(r.status) ? '这笔订单已付款，等待发货。' : `订单当前状态：${ORDER_STATUS[r.status]?.label}。`}
          </Typography>
          <Items />
          <Typography sx={{ fontWeight: 600, mt: 4, mb: 2 }}>物流轨迹</Typography>
          <Tracking />
          <Divider sx={{ my: 3 }} />
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
            <ShipButton />
            <Button variant="outlined" onClick={() => navigate(`/orders/${r.id}`)}>修改状态</Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export const OrderShow = () => (
  <Show actions={false} title="订单详情" component="div">
    <Message />
  </Show>
);

export const OrderEdit = () => (
  <Edit mutationMode="pessimistic" title="修改订单" redirect="show">
    <SimpleForm>
      <TextField source="order_no" />
      <SelectInput source="status" choices={toChoices(ORDER_STATUS)} />
    </SimpleForm>
  </Edit>
);
