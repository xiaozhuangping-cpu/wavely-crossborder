import {
  List, Datagrid, TextField, NumberField, FunctionField, SimpleList, SearchInput, SelectInput,
  Edit, Create, TabbedForm, TextInput, NumberInput, required, useRecordContext, useGetList,
} from 'react-admin';
import { Chip, useMediaQuery, Box, Typography } from '@mui/material';
import { fmtMoney } from '../constants';

const CATEGORIES = ['家居', '户外', '宠物', '美妆', '数码配件'].map((c) => ({ id: c, name: c }));
const STATUS = [{ id: 'active', name: '在售' }, { id: 'draft', name: '草稿' }, { id: 'archived', name: '已下架' }];

// 粗略利润模型：头程 ¥45/kg + 尾程 $4 + 平台佣金 15%
export const estimateMargin = (p, cnyToUsd = 0.138) => {
  if (!p) return null;
  const cost = Number(p.cost_cny) * cnyToUsd;
  const freight = (Number(p.weight_g) / 1000) * 45 * cnyToUsd + 4;
  const fee = Number(p.price_usd) * 0.15;
  const profit = Number(p.price_usd) - cost - freight - fee;
  return { profit, rate: profit / Number(p.price_usd) };
};

const MarginChip = () => {
  const p = useRecordContext();
  const m = estimateMargin(p);
  if (!m) return null;
  const pct = Math.round(m.rate * 100);
  return <Chip size="small" label={`${fmtMoney(m.profit)} · ${pct}%`} color={pct >= 25 ? 'success' : pct >= 10 ? 'warning' : 'error'} />;
};

const filters = [
  <SearchInput key="q" source="sku@ilike" placeholder="搜索 SKU" alwaysOn />,
  <SelectInput key="c" source="category" choices={CATEGORIES} alwaysOn />,
  <SelectInput key="s" source="status" choices={STATUS} />,
];

export const ProductList = () => {
  const isSmall = useMediaQuery((t) => t.breakpoints.down('md'));
  return (
    <List filters={filters} sort={{ field: 'sku', order: 'ASC' }}>
      {isSmall ? (
        <SimpleList primaryText={(r) => r.name?.zh} secondaryText={(r) => `${r.sku} · ${r.category}`} tertiaryText={(r) => fmtMoney(r.price_usd)} linkType="edit" />
      ) : (
        <Datagrid rowClick="edit">
          <TextField source="sku" />
          <FunctionField label="商品名" render={(r) => (
            <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name?.zh}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{r.name?.en}</Typography></Box>
          )} />
          <TextField source="category" />
          <NumberField source="cost_cny" options={{ style: 'currency', currency: 'CNY' }} />
          <NumberField source="price_usd" options={{ style: 'currency', currency: 'USD' }} />
          <FunctionField label="预估单件毛利" render={() => <MarginChip />} />
          <FunctionField source="status" render={(r) => STATUS.find((s) => s.id === r.status)?.name} />
        </Datagrid>
      )}
    </List>
  );
};

const LocalPrices = () => {
  const p = useRecordContext();
  const { data: rates = [] } = useGetList('exchange_rates', { pagination: { page: 1, perPage: 20 }, sort: { field: 'currency', order: 'ASC' } });
  if (!p) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {rates.filter((r) => r.currency !== 'CNY').map((r) => (
        <Chip key={r.currency} variant="outlined" label={fmtMoney(Number(p.price_usd) / Number(r.rate_to_usd), r.currency)} />
      ))}
    </Box>
  );
};

const LOCALES = { en: 'English', de: 'Deutsch', ja: '日本語', es: 'Español', fr: 'Français' };
const SavedListings = () => {
  const p = useRecordContext();
  const entries = Object.entries(p?.listing ?? {});
  if (!entries.length) return <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>还没有保存的 Listing。打开右上角 ✦ AI 运营助手，让它帮你写一条吧。</Typography>;
  return (
    <Box sx={{ display: 'grid', gap: 2, width: '100%' }}>
      {entries.map(([loc, l]) => (
        <Box key={loc} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 2 }}>
          <Chip size="small" label={LOCALES[loc] ?? loc} sx={{ mb: 1 }} />
          <Typography sx={{ fontWeight: 600, mb: 1 }}>{l.title}</Typography>
          <Box component="ul" sx={{ pl: 2.5, my: 0 }}>{(l.bullets ?? []).map((b, i) => <li key={i}><Typography sx={{ fontSize: 14 }}>{b}</Typography></li>)}</Box>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1, whiteSpace: 'pre-wrap' }}>{l.description}</Typography>
        </Box>
      ))}
    </Box>
  );
};

const ProductForm = () => (
  <TabbedForm>
    <TabbedForm.Tab label="基本信息">
      <TextInput source="sku" validate={required()} />
      <SelectInput source="category" choices={CATEGORIES} validate={required()} />
      <SelectInput source="status" choices={STATUS} defaultValue="active" />
      <TextInput source="image_url" fullWidth />
    </TabbedForm.Tab>
    <TabbedForm.Tab label="多语言">
      <TextInput source="name.zh" label="中文名" validate={required()} fullWidth />
      <TextInput source="name.en" label="English" validate={required()} fullWidth />
      <TextInput source="name.ja" label="日本語" fullWidth />
      <TextInput source="name.es" label="Español" fullWidth />
      <TextInput source="description.zh" label="中文描述" multiline fullWidth />
      <TextInput source="description.en" label="English description" multiline fullWidth />
    </TabbedForm.Tab>
    <TabbedForm.Tab label="AI Listing">
      <SavedListings />
    </TabbedForm.Tab>
    <TabbedForm.Tab label="价格与利润">
      <NumberInput source="cost_cny" validate={required()} />
      <NumberInput source="price_usd" validate={required()} />
      <NumberInput source="weight_g" />
      <Typography variant="subtitle2" sx={{ mt: 2 }}>各站点售价（按当前汇率）</Typography>
      <LocalPrices />
      <Typography variant="subtitle2" sx={{ mt: 2 }}>预估单件毛利（头程 ¥45/kg + 尾程 $4 + 佣金 15%）</Typography>
      <MarginChip />
    </TabbedForm.Tab>
  </TabbedForm>
);

export const ProductEdit = () => <Edit mutationMode="pessimistic"><ProductForm /></Edit>;
export const ProductCreate = () => <Create redirect="list"><ProductForm /></Create>;
