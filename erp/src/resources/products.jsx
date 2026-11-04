import {
  List, Datagrid, TextField, NumberField, FunctionField, SimpleList, SearchInput, SelectInput,
  Edit, Create, TabbedForm, TextInput, NumberInput, required, useRecordContext, useGetList,
  ReferenceManyField, CreateButton, TopToolbar, ListButton,
  ExportButton,
} from 'react-admin';
import { Chip, useMediaQuery, Box, Typography, Stack, Button, Tooltip, IconButton, Alert } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import { fmtMoney, shopUrl } from '../constants';
import { Thumb, SkuStatus, SKU_GRID_COLS } from './skus';
import { AgList, col, render } from '../grid';
import { ProductVideoTab } from './ProductVideoTab';

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

export const MarginChip = ({ record }) => {
  const ctx = useRecordContext();
  const m = estimateMargin(record ?? ctx);
  if (!m) return null;
  const pct = Math.round(m.rate * 100);
  return <Chip size="small" label={`${fmtMoney(m.profit)} · ${pct}%`} color={pct >= 25 ? 'success' : pct >= 10 ? 'warning' : 'error'} />;
};

// 商品名链接：点击直接在独立站打开
export const ShopNameLink = ({ productId, skuId, title, subtitle }) => (
  <Box component="a" href={shopUrl(productId, skuId)} target="_blank" rel="noopener" title="在独立站打开"
    sx={{ color: 'inherit', textDecoration: 'none', lineHeight: 1.3, minWidth: 0, '&:hover .t': { color: 'primary.main', textDecoration: 'underline' } }}>
    <Typography className="t" variant="body2" noWrap sx={{ fontWeight: 600 }}>{title} <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle', opacity: 0.6 }} /></Typography>
    {subtitle && <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>{subtitle}</Typography>}
  </Box>
);

const PRODUCT_COLS = [
  render('', ({ r }) => <Thumb src={r.image_url} />, { width: 72 }),
  col('sku', 'SPU', { width: 140, cellStyle: { fontFamily: 'monospace', display: 'flex', alignItems: 'center' }, filterSpec: { type: 'text', source: 'sku@ilike', placeholder: 'SPU' } }),
  render('商品名（点击在独立站打开）', ({ r }) => <ShopNameLink productId={r.id} title={r.name?.zh} subtitle={r.name?.en} />, { flex: 2, minWidth: 220, filterSpec: { type: 'text', source: 'name->>zh@ilike', placeholder: '商品名', value: (p) => p.data?.name?.zh ?? '' } }),
  col('category', '类目', { width: 120, filterSpec: { type: 'select', source: 'category', choices: CATEGORIES, placeholder: '全部类目' } }),
  render('规格', ({ r }) => <Chip size="small" variant="outlined" label={`${r.option_name?.zh ?? '规格'} · ${r.skus?.length ?? 0} 个 SKU`} />, { width: 150 }),
  render('售价', ({ r }) => priceRange(r.skus), { field: 'price_usd', sortable: true, width: 160 }),
  render('起售价毛利', ({ r }) => <MarginChip record={r} />, { width: 130 }),
  render('状态', ({ r }) => STATUS.find((x) => x.id === r.status)?.name, { field: 'status', sortable: true, width: 110, filterSpec: { type: 'select', source: 'status', choices: STATUS, placeholder: '全部' } }),
];

// 在独立站打开（新标签页）
export const ShopLink = ({ productId, skuId, size = 'small' }) => (
  <Tooltip title="在独立站查看">
    <IconButton size={size} component="a" href={shopUrl(productId, skuId)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
      <OpenInNewIcon fontSize="small" />
    </IconButton>
  </Tooltip>
);

const priceRange = (skus = []) => {
  const ps = skus.filter((s) => s.status === 'active').map((s) => Number(s.price_usd));
  if (!ps.length) return '-';
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? fmtMoney(lo) : `${fmtMoney(lo)} – ${fmtMoney(hi)}`;
};

const filters = [
  <SearchInput key="q" source="sku@ilike" placeholder="搜索 SPU 编码" alwaysOn />,
  <SelectInput key="c" source="category" choices={CATEGORIES} alwaysOn label={false} emptyText="全部类目" slotProps={{ select: { displayEmpty: true } }} />,
  <SelectInput key="s" source="status" choices={STATUS} label={false} emptyText="全部状态" slotProps={{ select: { displayEmpty: true } }} />,
];

const LIST_META = { columns: ['*', 'skus(id,price_usd,status)'] };

export const ProductList = () => {
  const isSmall = useMediaQuery((t) => t.breakpoints.down('md'));
  return (
    <List filters={isSmall ? filters : undefined} pagination={isSmall ? undefined : false} actions={isSmall ? undefined : false} perPage={25}
      sort={{ field: 'sku', order: 'ASC' }} queryOptions={{ meta: LIST_META }} title="商品">
      {isSmall ? (
        <SimpleList leftAvatar={(r) => <Thumb src={r.image_url} size={40} />} primaryText={(r) => r.name?.zh}
          secondaryText={(r) => `${r.sku} · ${r.skus?.length ?? 0} 个 SKU`} tertiaryText={(r) => priceRange(r.skus)} linkType="edit" />
      ) : (
        <AgList columnDefs={PRODUCT_COLS} rowClick={(id) => `/products/${id}`} actions={<><CreateButton label="新建商品" /><ExportButton /></>} />
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

// 列定义放在模块级，保持引用稳定（AgList 要求）
const SKU_TAB_COLS = SKU_GRID_COLS.filter((c) => !['商品 / 规格', '类目'].includes(c.headerName)).map(({ filterSpec, ...c }) => c);

// 「规格 SKU」标签页：该商品下的全部 SKU + 新增入口
const SkuTab = () => {
  const p = useRecordContext();
  if (!p?.id) return <Alert severity="info">先保存商品，再添加 SKU。</Alert>;
  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <TextInput fullWidth={false} sx={{ width: 200 }} source="option_name.zh" label="规格名（中文）" helperText="如：颜色 / 尺寸 / 容量" />
        <TextInput fullWidth={false} sx={{ width: 200 }} source="option_name.en" label="Option name (EN)" />
        <TextInput fullWidth={false} sx={{ width: 200 }} source="option_name.de" label="Optionsname (DE)" />
        <TextInput fullWidth={false} sx={{ width: 200 }} source="option_name.ja" label="オプション名 (JA)" />
        <TextInput fullWidth={false} sx={{ width: 200 }} source="option_name.es" label="Opción (ES)" />
      </Stack>
      <ReferenceManyField reference="v_skus" target="product_id" sort={{ field: 'sort', order: 'ASC' }} perPage={25}>
        <AgList columnDefs={SKU_TAB_COLS} rowClick={(id) => `/skus/${id}`} rowHeight={48} />
      </ReferenceManyField>
      <Button component="a" href={`#/skus/create?source=${encodeURIComponent(JSON.stringify({ product_id: p.id, sku: `${p.sku}-`, weight_g: p.weight_g, price_usd: p.price_usd, cost_cny: p.cost_cny }))}`}
        startIcon={<AddIcon />} variant="outlined" sx={{ mt: 2 }}>添加 SKU</Button>
    </Box>
  );
};

const PriceTab = ({ create }) => (
  <>
    {!create && <Alert severity="info" sx={{ mb: 2 }}>售价和成本由该商品下在售 SKU 的最低值自动计算，请在「规格 SKU」里修改。</Alert>}
    <NumberInput source="cost_cny" label="采购成本 (¥)" validate={required()} disabled={!create} />
    <NumberInput source="price_usd" label="售价 ($)" validate={required()} disabled={!create} />
    <NumberInput source="weight_g" label="重量 (g)" />
    <Typography variant="subtitle2" sx={{ mt: 2 }}>各站点售价（按当前汇率）</Typography>
    <LocalPrices />
    <Typography variant="subtitle2" sx={{ mt: 2 }}>预估单件毛利（头程 ¥45/kg + 尾程 $4 + 佣金 15%）</Typography>
    <MarginChip />
  </>
);

const ProductForm = ({ create }) => (
  <TabbedForm>
    <TabbedForm.Tab label="基本信息">
      <TextInput source="sku" label="SPU 编码" validate={required()} helperText="如 WV-PET-002，SKU 编码在此基础上加规格后缀" />
      <SelectInput source="category" choices={CATEGORIES} validate={required()} />
      <SelectInput source="status" choices={STATUS} defaultValue="active" />
      <TextInput source="image_url" label="主图地址" fullWidth helperText="白底主图，建议 1:1、≥1000px" />
      <ImagePreview />
    </TabbedForm.Tab>
    {!create && <TabbedForm.Tab label="规格 SKU"><SkuTab /></TabbedForm.Tab>}
    <TabbedForm.Tab label="多语言">
      <TextInput source="name.zh" label="中文名" validate={required()} fullWidth />
      <TextInput source="name.en" label="English" validate={required()} fullWidth />
      <TextInput source="name.de" label="Deutsch" fullWidth />
      <TextInput source="name.ja" label="日本語" fullWidth />
      <TextInput source="name.es" label="Español" fullWidth />
      <TextInput source="description.zh" label="中文描述" multiline fullWidth />
      <TextInput source="description.en" label="English description" multiline fullWidth />
    </TabbedForm.Tab>
    {!create && <TabbedForm.Tab label="视频"><ProductVideoTab /></TabbedForm.Tab>}
    {!create && <TabbedForm.Tab label="AI Listing"><SavedListings /></TabbedForm.Tab>}
    <TabbedForm.Tab label="价格与利润"><PriceTab create={create} /></TabbedForm.Tab>
  </TabbedForm>
);

const ImagePreview = () => {
  const p = useRecordContext();
  return p?.image_url ? <Thumb src={p.image_url} size={160} /> : null;
};

const EditActions = () => {
  const p = useRecordContext();
  return (
    <TopToolbar>
      <ListButton label="返回列表" />
      {p && <Button size="small" startIcon={<OpenInNewIcon />} href={shopUrl(p.id)} target="_blank" rel="noopener">在独立站查看</Button>}
    </TopToolbar>
  );
};

export const ProductEdit = () => <Edit mutationMode="pessimistic" actions={<EditActions />} title="编辑商品"><ProductForm /></Edit>;
export const ProductCreate = () => <Create redirect={(res, id) => `products/${id}/1`} title="新建商品"><ProductForm create /></Create>;
