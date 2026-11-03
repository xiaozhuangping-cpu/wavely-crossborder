// SKU 管理：列表（读视图 v_skus）、编辑/新建（写表 skus）、批量改价与上下架
import { useState } from 'react';
import {
  List, Datagrid, TextField, NumberField, FunctionField, SimpleList, SearchInput, SelectInput, BooleanInput,
  Edit, Create, SimpleForm, TextInput, NumberInput, ReferenceInput, AutocompleteInput, required, regex,
  useListContext, useDataProvider, useNotify, useRefresh, useRecordContext, useGetList, TopToolbar, ListButton,
  Button as RaButton,
  CreateButton, ExportButton,
} from 'react-admin';
import { useFormContext } from 'react-hook-form';
// 新建 SKU 后在各仓自动建 0 库存
import {
  Box, Chip, Stack, Typography, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField as MuiTextField, ToggleButton, ToggleButtonGroup, InputAdornment, IconButton, Tooltip,
} from '@mui/material';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fmtMoney, shopUrl, WAREHOUSE_KIND } from '../constants';
import { AgList, col, render } from '../grid';

const CATEGORIES = ['家居', '户外', '宠物', '美妆', '数码配件'].map((c) => ({ id: c, name: c }));
const SKU_STATUS = [{ id: 'active', name: '在售' }, { id: 'inactive', name: '已下架' }];

// 白底缩略图；加载失败时显示占位
export const Thumb = ({ src, size = 44 }) => {
  const [err, setErr] = useState(false);
  return (
    <Box sx={{ width: size, height: size, borderRadius: 1.5, bgcolor: '#fff', border: 1, borderColor: 'divider', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
      {src && !err
        ? <Box component="img" src={src} alt="" loading="lazy" onError={() => setErr(true)} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : <Typography sx={{ fontSize: size * 0.4, opacity: 0.4 }}>📦</Typography>}
    </Box>
  );
};

export const SkuStatus = ({ status }) => <Chip size="small" color={status === 'active' ? 'success' : 'default'} variant={status === 'active' ? 'filled' : 'outlined'} label={status === 'active' ? '在售' : '已下架'} />;

// EAN-13：69（中国）+ 10 位随机 + 校验位
export const genEan13 = () => {
  const body = '69' + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
};
const validEan13 = (v) => {
  if (!v) return undefined;
  if (!/^\d{13}$/.test(v)) return '条码需为 13 位数字';
  const sum = [...v.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(v[12]) ? undefined : 'EAN-13 校验位不正确';
};

const margin = (r) => {
  const cost = Number(r.cost_cny) * 0.138, freight = (Number(r.weight_g) / 1000) * 45 * 0.138 + 4, fee = Number(r.price_usd) * 0.15;
  const profit = Number(r.price_usd) - cost - freight - fee;
  return { profit, pct: Math.round((profit / Number(r.price_usd)) * 100) };
};
export const MarginCell = ({ r }) => {
  const m = margin(r);
  return <Chip size="small" label={`${m.pct}%`} color={m.pct >= 25 ? 'success' : m.pct >= 10 ? 'warning' : 'error'} variant="outlined" />;
};

// ---------- 批量操作 ----------
const BulkPrice = () => {
  const { selectedIds, data = [], onUnselectItems } = useListContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('pct');      // pct：按百分比调整；set：统一设为
  const [val, setVal] = useState('');
  const apply = async () => {
    const n = Number(val);
    if (!Number.isFinite(n)) return;
    const rows = data.filter((r) => selectedIds.includes(r.id));
    await Promise.all(rows.map((r) => {
      const price = mode === 'set' ? n : Math.max(0.5, Number(r.price_usd) * (1 + n / 100));
      return dataProvider.update('skus', { id: r.id, data: { price_usd: Math.round(price * 100) / 100 }, previousData: { id: r.id } });
    }));
    notify(`已更新 ${rows.length} 个 SKU 的售价`, { type: 'success' });
    setOpen(false); setVal(''); onUnselectItems(); refresh();
  };
  return (
    <>
      <RaButton label="批量改价" onClick={() => setOpen(true)}><SellOutlinedIcon /></RaButton>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>批量改价 · {selectedIds.length} 个 SKU</DialogTitle>
        <DialogContent>
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 2 }}>
            <ToggleButton value="pct">按百分比调整</ToggleButton>
            <ToggleButton value="set">统一设为</ToggleButton>
          </ToggleButtonGroup>
          <MuiTextField autoFocus fullWidth type="number" value={val} onChange={(e) => setVal(e.target.value)}
            placeholder={mode === 'pct' ? '如 10 表示涨价 10%，-15 表示降价 15%' : '如 19.99'}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">{mode === 'pct' ? '%' : 'USD'}</InputAdornment> } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={apply} disabled={val === ''}>应用</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const BulkStatus = ({ status }) => {
  const { selectedIds, onUnselectItems } = useListContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  return (
    <RaButton label={status === 'active' ? '上架' : '下架'} onClick={async () => {
      await dataProvider.updateMany('skus', { ids: selectedIds, data: { status } });
      notify(`已${status === 'active' ? '上架' : '下架'} ${selectedIds.length} 个 SKU`, { type: 'success' });
      onUnselectItems(); refresh();
    }}>{status === 'active' ? <VisibilityOutlinedIcon /> : <VisibilityOffOutlinedIcon />}</RaButton>
  );
};

const BulkActions = () => <><BulkPrice /><BulkStatus status="active" /><BulkStatus status="inactive" /></>;

// ---------- 列表 ----------
const NameLink = ({ r }) => (
  <Box component="a" href={shopUrl(r.product_id, r.id)} target="_blank" rel="noopener" title="在独立站打开"
    sx={{ color: 'inherit', textDecoration: 'none', lineHeight: 1.3, minWidth: 0, '&:hover .t': { color: 'primary.main', textDecoration: 'underline' } }}>
    <Typography className="t" variant="body2" noWrap sx={{ fontWeight: 600 }}>{r.product_name ?? r.option_label} <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle', opacity: 0.6 }} /></Typography>
    <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>{r.option_name}：{r.option_label}</Typography>
  </Box>
);

const mono = { fontFamily: 'monospace', display: 'flex', alignItems: 'center' };
export const SKU_GRID_COLS = [
  render('', ({ r }) => <Thumb src={r.image_url} />, { width: 72 }),
  col('sku', 'SKU', { width: 180, cellStyle: mono, filterSpec: { type: 'text', source: 'sku@ilike', placeholder: 'SKU' } }),
  render('商品 / 规格', NameLink, { flex: 2, minWidth: 200, filterSpec: { type: 'text', source: 'product_name@ilike', placeholder: '商品名', value: (p) => p.data?.product_name ?? '' } }),
  col('category', '类目', { width: 110, filterSpec: { type: 'select', source: 'category', choices: CATEGORIES, placeholder: '全部类目' } }),
  render('规格值', ({ r }) => r.option_label, { field: 'option_label', sortable: true, width: 110 }),
  col('barcode', '条码', { width: 150, cellStyle: mono, filterSpec: { type: 'text', source: 'barcode@ilike', placeholder: '条码' } }),
  render('售价', ({ r }) => fmtMoney(r.price_usd), { field: 'price_usd', sortable: true, width: 110, type: 'rightAligned' }),
  render('成本', ({ r }) => fmtMoney(r.cost_cny, 'CNY'), { field: 'cost_cny', sortable: true, width: 110, type: 'rightAligned' }),
  render('毛利率', MarginCell, { width: 90 }),
  render('总库存', ({ r }) => <Chip size="small" color={r.low_stock ? 'warning' : 'default'} label={r.low_stock ? `${r.stock} · 有仓缺货` : r.stock} />, { field: 'stock', sortable: true, width: 150, filterSpec: { type: 'select', source: 'low_stock', choices: [{ id: true, name: '仅有仓缺货' }, { id: false, name: '库存充足' }], placeholder: '全部' } }),
  render('状态', ({ r }) => <SkuStatus status={r.status} />, { field: 'status', sortable: true, width: 110, filterSpec: { type: 'select', source: 'status', choices: SKU_STATUS, placeholder: '全部' } }),
];
const skuFilters = [
  <SearchInput key="q" source="sku@ilike" placeholder="搜索 SKU 编码" alwaysOn />,
  <TextInput key="b" source="barcode@ilike" label="条码" />,
  <TextInput key="n" source="product_name@ilike" label="商品名" />,
  <SelectInput key="c" source="category" choices={CATEGORIES} alwaysOn label={false} emptyText="全部类目" slotProps={{ select: { displayEmpty: true } }} />,
  <SelectInput key="s" source="status" choices={SKU_STATUS} label={false} emptyText="全部状态" slotProps={{ select: { displayEmpty: true } }} />,
  <BooleanInput key="l" source="low_stock" label="只看低库存" />,
];

export const SkuList = () => {
  const isSmall = useMediaQuery((t) => t.breakpoints.down('md'));
  return (
    <List resource="v_skus" filters={isSmall ? skuFilters : undefined} pagination={isSmall ? undefined : false} actions={isSmall ? undefined : false} sort={{ field: 'sku', order: 'ASC' }} perPage={50} title="SKU 管理">
      {isSmall ? (
        <SimpleList leftAvatar={(r) => <Thumb src={r.image_url} size={40} />} primaryText={(r) => `${r.product_name} · ${r.option_label ?? ''}`}
          secondaryText={(r) => `${r.sku} · 库存 ${r.stock}`} tertiaryText={(r) => fmtMoney(r.price_usd)} linkType={(r) => `/skus/${r.id}`} />
      ) : (
        <AgList columnDefs={SKU_GRID_COLS.filter((c) => c.headerName !== '规格值')} rowClick={(id) => `/skus/${id}`} bulkActions={<BulkActions />} actions={<><CreateButton resource="skus" label="新建 SKU" /><ExportButton /></>} />
      )}
    </List>
  );
};

// ---------- 编辑 / 新建 ----------
const BarcodeInput = () => {
  const { setValue } = useFormContext();
  return (
    <TextInput source="barcode" label="条码 (EAN-13)" validate={validEan13} fullWidth={false} sx={{ width: 240 }}
      slotProps={{ input: { endAdornment: (
        <InputAdornment position="end"><Tooltip title="生成条码"><IconButton size="small" onClick={() => setValue('barcode', genEan13(), { shouldDirty: true })}><AutorenewIcon fontSize="small" /></IconButton></Tooltip></InputAdornment>
      ) } }} />
  );
};

const StockByWarehouse = () => {
  const r = useRecordContext();
  const { data = [] } = useGetList('v_inventory', { filter: { sku_id: r?.id }, pagination: { page: 1, perPage: 20 }, sort: { field: 'warehouse_code', order: 'ASC' } }, { enabled: !!r?.id });
  if (!r?.id) return null;
  return (
    <Box sx={{ mt: 1, width: '100%' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>各仓库存</Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        {data.map((i) => (
          <Chip key={i.id} component="a" href={`#/inventory/${i.id}`} clickable color={i.low_stock ? 'warning' : 'default'} variant="outlined"
            label={`${i.warehouse_name}（${WAREHOUSE_KIND[i.warehouse_kind]}）：${i.qty}`} />
        ))}
      </Stack>
    </Box>
  );
};

const MarginPreview = () => {
  const { watch } = useFormContext();
  const [price, cost, weight] = watch(['price_usd', 'cost_cny', 'weight_g']);
  if (!price || !cost) return null;
  const m = margin({ price_usd: price, cost_cny: cost, weight_g: weight || 0 });
  return <Typography sx={{ fontSize: 14, color: m.pct >= 10 ? 'text.secondary' : 'error.main' }}>预估单件毛利 {fmtMoney(m.profit)}（{m.pct}%）· 头程 ¥45/kg + 尾程 $4 + 佣金 15%</Typography>;
};

const SkuForm = () => (
  <SimpleForm>
    <ReferenceInput source="product_id" reference="products">
      <AutocompleteInput label="所属商品 (SPU)" optionText={(p) => `${p.sku} · ${p.name?.zh}`} validate={required()} filterToQuery={(q) => ({ 'sku@ilike': q })} sx={{ minWidth: 360 }} />
    </ReferenceInput>
    <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
      <TextInput fullWidth={false} sx={{ width: 200 }} source="sku" label="SKU 编码" validate={[required(), regex(/^[A-Z0-9-]+$/, '只能包含大写字母、数字和 -')]} helperText="如 WV-PET-002-LRG" />
      <BarcodeInput />
    </Stack>
    <Typography variant="subtitle2">规格值（多语言）</Typography>
    <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
      <TextInput fullWidth={false} sx={{ width: 200 }} source="option_value.zh" label="中文" validate={required()} />
      <TextInput fullWidth={false} sx={{ width: 200 }} source="option_value.en" label="English" validate={required()} />
      <TextInput fullWidth={false} sx={{ width: 200 }} source="option_value.de" label="Deutsch" />
      <TextInput fullWidth={false} sx={{ width: 200 }} source="option_value.ja" label="日本語" />
      <TextInput fullWidth={false} sx={{ width: 200 }} source="option_value.es" label="Español" />
    </Stack>
    <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
      <NumberInput fullWidth={false} sx={{ width: 200 }} source="price_usd" label="售价 ($)" validate={required()} min={0} />
      <NumberInput fullWidth={false} sx={{ width: 200 }} source="cost_cny" label="采购成本 (¥)" validate={required()} min={0} />
      <NumberInput fullWidth={false} sx={{ width: 200 }} source="weight_g" label="重量 (g)" min={0} />
      <NumberInput fullWidth={false} sx={{ width: 200 }} source="sort" label="排序" defaultValue={0} />
    </Stack>
    <MarginPreview />
    <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <SelectInput fullWidth={false} sx={{ width: 200 }} source="status" label="状态" choices={SKU_STATUS} defaultValue="active" />
      <TextInput fullWidth={false} sx={{ width: 200 }} source="image_url" label="规格图地址（留空则用商品主图）" sx={{ minWidth: 360 }} />
    </Stack>
    <StockByWarehouse />
  </SimpleForm>
);

const SkuEditActions = () => {
  const r = useRecordContext();
  return (
    <TopToolbar>
      <ListButton resource="v_skus" label="返回 SKU 列表" />
      {r && <Button size="small" href={`#/products/${r.product_id}/1`}>所属商品</Button>}
      {r && <Button size="small" startIcon={<OpenInNewIcon />} href={shopUrl(r.product_id, r.id)} target="_blank" rel="noopener">在独立站查看</Button>}
    </TopToolbar>
  );
};

export const SkuEdit = () => <Edit mutationMode="pessimistic" title="编辑 SKU" actions={<SkuEditActions />} redirect={false}><SkuForm /></Edit>;

// 新建后：新 SKU 自动在各仓建 0 库存，回到所属商品的「规格 SKU」页
export const SkuCreate = () => {
  const dataProvider = useDataProvider();
  return (
    <Create title="新建 SKU"
      transform={(d) => ({ ...d, barcode: d.barcode || genEan13() })}
      mutationOptions={{ onSuccess: async (data) => {
        const { data: whs } = await dataProvider.getList('warehouses', { pagination: { page: 1, perPage: 20 }, sort: { field: 'id', order: 'ASC' }, filter: {} });
        await Promise.all(whs.map((w) => dataProvider.create('inventory', { data: { product_id: data.product_id, sku_id: data.id, warehouse_id: w.id, qty: 0, safety_qty: w.kind === 'domestic' ? 100 : 30 } })));
        window.location.hash = `#/products/${data.product_id}/1`;
      } }}>
      <SkuForm />
    </Create>
  );
};
