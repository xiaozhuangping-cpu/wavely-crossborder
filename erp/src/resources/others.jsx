import {
  List, Datagrid, TextField, NumberField, DateField, FunctionField, SimpleList, SearchInput, SelectInput,
  BooleanInput, Edit, Create, SimpleForm, TextInput, NumberInput, required, EmailField, ReferenceField,
  TopToolbar, useRefresh, useNotify, useListContext, Button as RaButton, useDataProvider,
} from 'react-admin';
import { Chip, useMediaQuery, LinearProgress, Box, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { PLATFORMS, WAREHOUSE_KIND, COUNTRIES, SHIP_STATUS, toChoices } from '../constants';
import { AgList, col, render } from '../grid';

const mono = { fontFamily: 'monospace', display: 'flex', alignItems: 'center' };
const dt = (v, time) => (v ? new Date(v).toLocaleString('zh-CN', time ? undefined : { dateStyle: 'medium' }) : '-');

const useSmall = () => useMediaQuery((t) => t.breakpoints.down('md'));

// ========== 库存 ==========
const StockBar = ({ r }) => {
  const pct = Math.min(100, (r.qty / Math.max(r.safety_qty * 4, 1)) * 100);
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: r.low_stock ? 'error.main' : 'text.primary' }}>{r.qty}</Typography>
      <LinearProgress variant="determinate" value={pct} color={r.low_stock ? 'error' : 'primary'} sx={{ height: 6, borderRadius: 3 }} />
    </Box>
  );
};

const inventoryFilters = [
  <SearchInput key="q" source="sku@ilike" placeholder="搜索 SKU" alwaysOn />,
  <SelectInput key="k" source="warehouse_kind" choices={toChoices(WAREHOUSE_KIND)} alwaysOn label={false} emptyText="全部仓库" />,
  <BooleanInput key="l" source="low_stock" label="只看低库存" alwaysOn />,
];

export const InventoryList = () => {
  const isSmall = useSmall();
  return (
  <List resource="v_inventory" filters={isSmall ? inventoryFilters : undefined} pagination={isSmall ? undefined : false} perPage={50} sort={{ field: 'qty', order: 'ASC' }} title="库存" exporter={false}>
    {isSmall ? (
      <SimpleList primaryText={(r) => `${r.product_name} · ${r.option_label ?? ''}`} secondaryText={(r) => `${r.sku} · ${r.warehouse_name}`}
                  tertiaryText={(r) => `${r.qty} / ${r.safety_qty}`} linkType={(r) => `/inventory/${r.id}`} />
    ) : (
      <AgList rowClick={(id) => `/inventory/${id}`} columnDefs={[
        col('sku', 'SKU', { width: 180, cellStyle: mono, filterSpec: { type: 'text', source: 'sku@ilike', placeholder: 'SKU' } }),
        render('商品 / 规格', ({ r }) => <Box sx={{ lineHeight: 1.3 }}><Typography variant="body2">{r.product_name}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.option_label}</Typography></Box>, { field: 'product_name', sortable: true, flex: 2, minWidth: 180, filterSpec: { type: 'text', source: 'product_name@ilike', placeholder: '商品名' } }),
        col('warehouse_name', '仓库', { width: 160, filterSpec: { type: 'text', source: 'warehouse_name@ilike', placeholder: '仓库' } }),
        render('仓库类型', ({ r }) => <Chip size="small" variant="outlined" label={WAREHOUSE_KIND[r.warehouse_kind]} />, { field: 'warehouse_kind', sortable: true, width: 120, filterSpec: { type: 'select', source: 'warehouse_kind', choices: toChoices(WAREHOUSE_KIND), placeholder: '全部' } }),
        render('可用库存', ({ r }) => <StockBar r={r} />, { field: 'qty', sortable: true, width: 160 }),
        col('safety_qty', '安全库存', { width: 100, type: 'rightAligned' }),
        render('补货', ({ r }) => r.low_stock && <Chip size="small" color="error" label="需补货" />, { width: 120, filterSpec: { type: 'select', source: 'low_stock', choices: [{ id: true, name: '需补货' }, { id: false, name: '充足' }], placeholder: '全部' } }),
      ]} />
    )}
  </List>
  );
};

export const InventoryEdit = () => (
  <Edit mutationMode="pessimistic" redirect={() => 'v_inventory'} title="调整库存">
    <SimpleForm>
      <NumberInput source="qty" validate={required()} min={0} />
      <NumberInput source="safety_qty" validate={required()} min={0} />
    </SimpleForm>
  </Edit>
);

// ========== 店铺 ==========
const ShopForm = () => (
  <SimpleForm>
    <SelectInput source="platform" choices={toChoices(PLATFORMS)} validate={required()} />
    <TextInput source="name" validate={required()} />
    <SelectInput source="country" choices={toChoices(COUNTRIES)} validate={required()} />
    <TextInput source="currency" validate={required()} helperText="ISO 币种代码，如 USD / EUR / JPY" />
  </SimpleForm>
);
export const ShopList = () => {
  const isSmall = useSmall();
  return (
  <List sort={{ field: 'id', order: 'ASC' }} pagination={false}>
    {isSmall ? (
      <SimpleList primaryText={(r) => r.name} secondaryText={(r) => `${PLATFORMS[r.platform]?.label} · ${r.currency}`} linkType="edit" />
    ) : (
      <AgList pagination={false} rowClick={(id) => `/shops/${id}`} columnDefs={[
        render('平台', ({ r }) => <Chip size="small" label={PLATFORMS[r.platform]?.label} sx={{ bgcolor: PLATFORMS[r.platform]?.color, color: '#fff' }} />, { field: 'platform', sortable: true, width: 150, filterSpec: { type: 'select', source: 'platform', choices: toChoices(PLATFORMS), placeholder: '全部平台' } }),
        col('name', '店铺名', { flex: 1, minWidth: 180, filterSpec: { type: 'text', source: 'name@ilike', placeholder: '店铺名' } }),
        render('站点', ({ r }) => COUNTRIES[r.country] ?? r.country, { field: 'country', sortable: true, width: 140 }),
        col('currency', '结算币种', { width: 110 }),
      ]} />
    )}
  </List>
  );
};
export const ShopEdit = () => <Edit mutationMode="pessimistic"><ShopForm /></Edit>;
export const ShopCreate = () => <Create redirect="list"><ShopForm /></Create>;

// ========== 客户 ==========
const customerFilters = [
  <SearchInput key="q" source="name@ilike" placeholder="搜索姓名" alwaysOn />,
  <SelectInput key="c" source="country" choices={toChoices(COUNTRIES)} alwaysOn label={false} emptyText="全部国家" />,
];
export const CustomerList = () => {
  const isSmall = useSmall();
  return (
  <List filters={isSmall ? customerFilters : undefined} pagination={isSmall ? undefined : false} perPage={50} sort={{ field: 'created_at', order: 'DESC' }}>
    {isSmall ? (
      <SimpleList primaryText={(r) => r.name} secondaryText={(r) => r.email} tertiaryText={(r) => COUNTRIES[r.country] ?? r.country} linkType={false} />
    ) : (
      <AgList columnDefs={[
        col('name', '姓名', { flex: 1, minWidth: 160, filterSpec: { type: 'text', source: 'name@ilike', placeholder: '姓名' } }),
        render('邮箱', ({ r }) => <a href={`mailto:${r.email}`} style={{ color: 'inherit' }}>{r.email}</a>, { field: 'email', sortable: true, flex: 1, minWidth: 220, filterSpec: { type: 'text', source: 'email@ilike', placeholder: '邮箱' } }),
        render('国家', ({ r }) => COUNTRIES[r.country] ?? r.country, { field: 'country', sortable: true, width: 150, filterSpec: { type: 'select', source: 'country', choices: toChoices(COUNTRIES), placeholder: '全部国家' } }),
        render('注册时间', ({ r }) => dt(r.created_at), { field: 'created_at', sortable: true, width: 140 }),
      ]} />
    )}
  </List>
  );
};

// ========== 物流 ==========
const shipmentFilters = [
  <SearchInput key="q" source="tracking_no@ilike" placeholder="搜索运单号" alwaysOn />,
  <SelectInput key="s" source="status" choices={toChoices(SHIP_STATUS)} alwaysOn label={false} emptyText="全部状态" />,
];
export const ShipmentList = () => {
  const isSmall = useSmall();
  return (
  <List filters={isSmall ? shipmentFilters : undefined} pagination={isSmall ? undefined : false} perPage={50} sort={{ field: 'updated_at', order: 'DESC' }} queryOptions={{ meta: { columns: ['*', 'orders(order_no)'] } }}>
    {isSmall ? (
      <SimpleList primaryText={(r) => r.tracking_no} secondaryText={(r) => `${r.carrier} · ${SHIP_STATUS[r.status]}`}
                  linkType={(r) => `/orders/${r.order_id}/show`} />
    ) : (
      <AgList rowClick={(id, r) => `/orders/${r.order_id}/show`} columnDefs={[
        col('tracking_no', '运单号', { width: 170, cellStyle: mono, filterSpec: { type: 'text', source: 'tracking_no@ilike', placeholder: '运单号' } }),
        col('carrier', '承运商', { width: 140, filterSpec: { type: 'text', source: 'carrier@ilike', placeholder: '承运商' } }),
        render('订单', ({ r }) => r.orders?.order_no, { width: 170, cellStyle: mono }),
        render('物流状态', ({ r }) => <Chip size="small" color={r.status === 'delivered' ? 'success' : 'info'} label={SHIP_STATUS[r.status]} />, { field: 'status', sortable: true, width: 140, filterSpec: { type: 'select', source: 'status', choices: toChoices(SHIP_STATUS), placeholder: '全部' } }),
        render('最近更新', ({ r }) => dt(r.updated_at, true), { field: 'updated_at', sortable: true, flex: 1, minWidth: 170 }),
      ]} />
    )}
  </List>
  );
};

// ========== 汇率 ==========
const RefreshRates = () => {
  const { data = [] } = useListContext();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();
  const notify = useNotify();
  return (
    <RaButton label="拉取实时汇率" onClick={async () => {
      try {
        const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { rates } = await res.json();
        const updates = data.filter((r) => rates[r.currency]).map((r) =>
          dataProvider.update('exchange_rates', { id: r.id, data: { rate_to_usd: +(1 / rates[r.currency]).toFixed(6), updated_at: new Date().toISOString() }, previousData: r }));
        await Promise.all(updates);
        notify(`已更新 ${updates.length} 个币种（来源：欧洲央行 via Frankfurter）`, { type: 'success' });
        refresh();
      } catch (e) {
        notify(`拉取失败：${e.message}`, { type: 'error' });
      }
    }}><SyncIcon /></RaButton>
  );
};

export const RateList = () => (
  <List pagination={false} sort={{ field: 'currency', order: 'ASC' }} actions={<TopToolbar><RefreshRates /></TopToolbar>}>
    <AgList pagination={false} rowClick={(id) => `/exchange_rates/${id}`} columnDefs={[
      col('currency', '币种', { width: 110 }),
      render('1 单位 = ? USD', ({ r }) => Number(r.rate_to_usd).toFixed(6), { field: 'rate_to_usd', sortable: true, width: 160, type: 'rightAligned' }),
      render('1 USD =', ({ r }) => (1 / r.rate_to_usd).toFixed(r.currency === 'JPY' ? 1 : 4) + ' ' + r.currency, { width: 160, type: 'rightAligned' }),
      render('更新时间', ({ r }) => dt(r.updated_at, true), { field: 'updated_at', sortable: true, flex: 1, minWidth: 170 }),
    ]} />
  </List>
);
export const RateEdit = () => (
  <Edit mutationMode="pessimistic"><SimpleForm><TextField source="currency" /><NumberInput source="rate_to_usd" validate={required()} /></SimpleForm></Edit>
);
