import {
  List, Datagrid, TextField, NumberField, DateField, FunctionField, SimpleList, SearchInput, SelectInput,
  BooleanInput, Edit, Create, SimpleForm, TextInput, NumberInput, required, EmailField, ReferenceField,
  TopToolbar, useRefresh, useNotify, useListContext, Button as RaButton, useDataProvider,
} from 'react-admin';
import { Chip, useMediaQuery, LinearProgress, Box, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { PLATFORMS, WAREHOUSE_KIND, COUNTRIES, SHIP_STATUS, toChoices } from '../constants';

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
  <SelectInput key="k" source="warehouse_kind" choices={toChoices(WAREHOUSE_KIND)} alwaysOn />,
  <BooleanInput key="l" source="low_stock" label="只看低库存" alwaysOn />,
];

export const InventoryList = () => (
  <List resource="v_inventory" filters={inventoryFilters} sort={{ field: 'qty', order: 'ASC' }} title="库存" exporter={false}>
    {useSmall() ? (
      <SimpleList primaryText={(r) => `${r.product_name} · ${r.option_label ?? ''}`} secondaryText={(r) => `${r.sku} · ${r.warehouse_name}`}
                  tertiaryText={(r) => `${r.qty} / ${r.safety_qty}`} linkType={(r) => `/inventory/${r.id}`} />
    ) : (
      <Datagrid rowClick={(id) => `/inventory/${id}`} bulkActionButtons={false}>
        <TextField source="sku" />
        <FunctionField source="product_name" render={(r) => <Box><Typography variant="body2">{r.product_name}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.option_label}</Typography></Box>} />
        <TextField source="warehouse_name" />
        <FunctionField source="warehouse_kind" render={(r) => <Chip size="small" variant="outlined" label={WAREHOUSE_KIND[r.warehouse_kind]} />} />
        <FunctionField source="qty" render={(r) => <StockBar r={r} />} />
        <NumberField source="safety_qty" />
        <FunctionField source="low_stock" render={(r) => r.low_stock && <Chip size="small" color="error" label="需补货" />} />
      </Datagrid>
    )}
  </List>
);

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
export const ShopList = () => (
  <List sort={{ field: 'id', order: 'ASC' }} pagination={false}>
    {useSmall() ? (
      <SimpleList primaryText={(r) => r.name} secondaryText={(r) => `${PLATFORMS[r.platform]?.label} · ${r.currency}`} linkType="edit" />
    ) : (
      <Datagrid rowClick="edit">
        <FunctionField source="platform" render={(r) => <Chip size="small" label={PLATFORMS[r.platform]?.label} sx={{ bgcolor: PLATFORMS[r.platform]?.color, color: '#fff' }} />} />
        <TextField source="name" />
        <FunctionField source="country" render={(r) => COUNTRIES[r.country] ?? r.country} />
        <TextField source="currency" />
      </Datagrid>
    )}
  </List>
);
export const ShopEdit = () => <Edit mutationMode="pessimistic"><ShopForm /></Edit>;
export const ShopCreate = () => <Create redirect="list"><ShopForm /></Create>;

// ========== 客户 ==========
export const CustomerList = () => (
  <List filters={[<SearchInput key="q" source="name@ilike" placeholder="搜索姓名" alwaysOn />,
                  <SelectInput key="c" source="country" choices={toChoices(COUNTRIES)} alwaysOn />]}
        sort={{ field: 'created_at', order: 'DESC' }}>
    {useSmall() ? (
      <SimpleList primaryText={(r) => r.name} secondaryText={(r) => r.email} tertiaryText={(r) => COUNTRIES[r.country] ?? r.country} linkType={false} />
    ) : (
      <Datagrid rowClick={false} bulkActionButtons={false}>
        <TextField source="name" />
        <EmailField source="email" />
        <FunctionField source="country" render={(r) => COUNTRIES[r.country] ?? r.country} />
        <DateField source="created_at" />
      </Datagrid>
    )}
  </List>
);

// ========== 物流 ==========
export const ShipmentList = () => (
  <List filters={[<SearchInput key="q" source="tracking_no@ilike" placeholder="搜索运单号" alwaysOn />,
                  <SelectInput key="s" source="status" choices={toChoices(SHIP_STATUS)} alwaysOn />]}
        sort={{ field: 'updated_at', order: 'DESC' }}>
    {useSmall() ? (
      <SimpleList primaryText={(r) => r.tracking_no} secondaryText={(r) => `${r.carrier} · ${SHIP_STATUS[r.status]}`}
                  linkType={(r) => `/orders/${r.order_id}/show`} />
    ) : (
      <Datagrid rowClick={(id, res, r) => `/orders/${r.order_id}/show`} bulkActionButtons={false}>
        <TextField source="tracking_no" />
        <TextField source="carrier" />
        <ReferenceField source="order_id" reference="orders" link="show"><TextField source="order_no" /></ReferenceField>
        <FunctionField source="status" render={(r) => <Chip size="small" color={r.status === 'delivered' ? 'success' : 'info'} label={SHIP_STATUS[r.status]} />} />
        <DateField source="updated_at" showTime />
      </Datagrid>
    )}
  </List>
);

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
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="currency" />
      <NumberField source="rate_to_usd" options={{ maximumFractionDigits: 6 }} />
      <FunctionField label="1 USD =" render={(r) => (1 / r.rate_to_usd).toFixed(r.currency === 'JPY' ? 1 : 4) + ' ' + r.currency} />
      <DateField source="updated_at" showTime />
    </Datagrid>
  </List>
);
export const RateEdit = () => (
  <Edit mutationMode="pessimistic"><SimpleForm><TextField source="currency" /><NumberInput source="rate_to_usd" validate={required()} /></SimpleForm></Edit>
);
