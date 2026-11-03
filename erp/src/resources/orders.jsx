import { useState } from 'react';
import {
  List, Datagrid, TextField, DateField, ReferenceField, FunctionField, SimpleList,
  SearchInput, SelectInput, ReferenceInput, Show, useRecordContext, useRefresh, useNotify,
  useGetList, useGetOne, TopToolbar, ListButton, ExportButton, FilterButton, useListContext,
  Edit, SimpleForm, Button as RaButton,
} from 'react-admin';
import { Box, Card, CardContent, Chip, Grid, Stack, Typography, Divider, Button, useMediaQuery } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { supabase } from '../supabase';
import { ORDER_STATUS, SHIP_STATUS, COUNTRIES, PLATFORMS, toChoices, fmtMoney } from '../constants';

export const StatusChip = ({ source = 'status' }) => {
  const r = useRecordContext();
  if (!r) return null;
  const s = ORDER_STATUS[r[source]];
  return <Chip size="small" label={s?.label ?? r[source]} color={s?.color ?? 'default'} />;
};

const Money = ({ amount = 'total_amount', currency = 'currency' }) => {
  const r = useRecordContext();
  return r ? <span>{fmtMoney(r[amount], r[currency])}</span> : null;
};

const shipOrders = async (ids) => {
  const results = await Promise.allSettled(ids.map((id) => supabase.rpc('ship_order', { p_order_id: id })));
  return results.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
};

const BulkShip = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const refresh = useRefresh();
  const notify = useNotify();
  return (
    <RaButton label="批量发货" onClick={async () => {
      const n = await shipOrders(selectedIds);
      notify(`已发货 ${n} 单（只有「待发货」状态的订单可以发货）`, { type: n ? 'success' : 'warning' });
      onUnselectItems(); refresh();
    }}><LocalShippingIcon /></RaButton>
  );
};

const orderFilters = [
  <SearchInput key="q" source="order_no@ilike" placeholder="搜索订单号" alwaysOn />,
  <SelectInput key="s" source="status" label="状态" choices={toChoices(ORDER_STATUS)} alwaysOn />,
  <ReferenceInput key="shop" source="shop_id" reference="shops" label="店铺"><SelectInput optionText="name" label="店铺" /></ReferenceInput>,
  <SelectInput key="c" source="country" label="国家" choices={toChoices(COUNTRIES)} />,
  <SelectInput key="src" source="source" label="来源" choices={[{ id: 'platform', name: '平台订单' }, { id: 'site', name: '独立站' }]} />,
];

const ListActions = () => (
  <TopToolbar><FilterButton /><ExportButton /></TopToolbar>
);

export const OrderList = () => {
  const isSmall = useMediaQuery((t) => t.breakpoints.down('md'));
  return (
    <List filters={orderFilters} sort={{ field: 'created_at', order: 'DESC' }} actions={<ListActions />} perPage={25}>
      {isSmall ? (
        <SimpleList
          primaryText={(r) => r.order_no}
          secondaryText={(r) => `${COUNTRIES[r.country] ?? r.country} · ${new Date(r.created_at).toLocaleString('zh-CN')}`}
          tertiaryText={(r) => `${fmtMoney(r.total_amount, r.currency)} · ${ORDER_STATUS[r.status]?.label}`}
          linkType="show"
        />
      ) : (
        <Datagrid rowClick="show" bulkActionButtons={<BulkShip />}>
          <TextField source="order_no" />
          <ReferenceField source="shop_id" reference="shops" link={false}>
            <FunctionField render={(s) => <Chip size="small" label={s.name} sx={{ bgcolor: PLATFORMS[s.platform]?.color, color: '#fff' }} />} />
          </ReferenceField>
          <FunctionField source="country" render={(r) => COUNTRIES[r.country] ?? r.country} />
          <FunctionField source="total_amount" render={() => <Money />} textAlign="right" />
          <FunctionField source="total_usd" render={(r) => fmtMoney(r.total_usd)} textAlign="right" />
          <FunctionField source="status" render={() => <StatusChip />} />
          <DateField source="created_at" showTime />
        </Datagrid>
      )}
    </List>
  );
};

const ShipButton = () => {
  const r = useRecordContext();
  const refresh = useRefresh();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  if (!r || !['paid', 'pending'].includes(r.status)) return null;
  return (
    <Button variant="contained" startIcon={<LocalShippingIcon />} disabled={busy} onClick={async () => {
      setBusy(true);
      const { error } = await supabase.rpc('ship_order', { p_order_id: r.id });
      setBusy(false);
      if (error) notify(error.message, { type: 'error' });
      else { notify('已生成运单并发货', { type: 'success' }); refresh(); }
    }}>发货</Button>
  );
};

const Items = () => {
  const r = useRecordContext();
  const { data: items = [] } = useGetList('order_items', { filter: { order_id: r?.id }, pagination: { page: 1, perPage: 50 }, sort: { field: 'id', order: 'ASC' } }, { enabled: !!r });
  const { data: products = [] } = useGetList('products', { filter: { 'id@in': `(${items.map((i) => i.product_id).join(',') || 0})` }, pagination: { page: 1, perPage: 50 }, sort: { field: 'id', order: 'ASC' } }, { enabled: items.length > 0 });
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  return (
    <Stack divider={<Divider />} spacing={1.5}>
      {items.map((i) => (
        <Stack key={i.id} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontWeight: 600 }}>{byId[i.product_id]?.name?.zh ?? '…'}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{byId[i.product_id]?.sku} · {byId[i.product_id]?.name?.en}</Typography>
          </Box>
          <Typography sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(i.unit_price, r.currency)} × {i.qty}</Typography>
        </Stack>
      ))}
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 700 }}>合计</Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontWeight: 700 }}>{fmtMoney(r?.total_amount, r?.currency)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>≈ {fmtMoney(r?.total_usd)}</Typography>
        </Box>
      </Stack>
    </Stack>
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
            '&::before': { content: '""', position: 'absolute', left: 5, top: 6, width: 10, height: 10, borderRadius: '50%', bgcolor: idx === 0 ? 'primary.main' : 'grey.400' },
            '&::after': idx < events.length - 1 ? { content: '""', position: 'absolute', left: 9, top: 18, bottom: 0, width: 2, bgcolor: 'grey.300' } : {} }}>
            <Typography sx={{ fontWeight: idx === 0 ? 700 : 400 }}>{e.description}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{e.location} · {new Date(e.event_time).toLocaleString('zh-CN')}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const Customer = () => {
  const r = useRecordContext();
  const { data: c } = useGetOne('customers', { id: r?.customer_id }, { enabled: !!r?.customer_id });
  const { data: s } = useGetOne('shops', { id: r?.shop_id }, { enabled: !!r?.shop_id });
  return (
    <Stack spacing={1}>
      <Typography><b>店铺：</b>{s?.name}</Typography>
      <Typography><b>客户：</b>{c?.name ?? '-'}</Typography>
      <Typography><b>邮箱：</b>{c?.email ?? '-'}</Typography>
      <Typography><b>收货国家：</b>{COUNTRIES[r?.country] ?? r?.country}</Typography>
      <Typography><b>来源：</b>{r?.source === 'site' ? '独立站' : '平台订单'}</Typography>
    </Stack>
  );
};

const OrderHeader = () => {
  const r = useRecordContext();
  if (!r) return null;
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 2 }}>
      <Box>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{r.order_no}</Typography>
          <StatusChip />
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>下单时间 {new Date(r.created_at).toLocaleString('zh-CN')}</Typography>
      </Box>
      <ShipButton />
    </Stack>
  );
};

export const OrderShow = () => (
  <Show actions={<TopToolbar><ListButton label="返回列表" /></TopToolbar>}>
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <OrderHeader />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined"><CardContent><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>商品明细</Typography><Items /></CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined"><CardContent><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>客户与店铺</Typography><Customer /></CardContent></Card>
        </Grid>
        <Grid size={12}>
          <Card variant="outlined"><CardContent><Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>物流轨迹</Typography><Tracking /></CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  </Show>
);

export const OrderEdit = () => (
  <Edit mutationMode="pessimistic">
    <SimpleForm>
      <TextField source="order_no" />
      <SelectInput source="status" choices={toChoices(ORDER_STATUS)} />
    </SimpleForm>
  </Edit>
);
