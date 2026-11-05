// 导出平台上架模板：选择平台 → 生成预检结果 → 下载（Shopify CSV / 其他平台 Excel）
import { useState } from 'react';
import { useListContext, useNotify } from 'react-admin';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography, Alert,
} from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { supabase } from '../supabase';
import { exportXlsx, downloadCsv } from '../utils/xlsx';
import { PLATFORMS, GUIDE, buildListing, toCsv } from '../utils/listingTemplates';

async function loadData(ids) {
  let q = supabase.from('products').select('*, skus(*)').order('sku');
  q = ids ? q.in('id', ids) : q.eq('status', 'active');
  const [{ data: products, error }, { data: inv, error: e2 }, { data: fx, error: e3 }] = await Promise.all([
    q, supabase.from('v_inventory').select('sku_id, qty'), supabase.from('exchange_rates').select('currency, rate_to_usd'),
  ]);
  const err = error || e2 || e3;
  if (err) throw err;
  const stock = {};
  for (const r of inv) if (r.sku_id) stock[r.sku_id] = (stock[r.sku_id] ?? 0) + (r.qty ?? 0);
  const rates = Object.fromEntries(fx.map((r) => [r.currency, Number(r.rate_to_usd)]));
  return { products, stock, rates };
}

async function download(platformKey, result) {
  const { platform: pf, rows, columns, issues } = result;
  const name = `上架模板-${pf.label}`;
  if (pf.format === 'csv') { downloadCsv(name, toCsv(columns, rows)); return; }
  await exportXlsx(name, [
    { name: pf.group, columns: columns.map((c) => ({ header: c, key: c, width: /description|Description|bullet/.test(c) ? 48 : /name|Name|image|Image/.test(c) ? 30 : 16 })), rows },
    { name: '上架前检查', columns: [
      { header: '级别', key: 'level', width: 8 }, { header: '商品编码', key: 'product', width: 16 }, { header: 'SKU', key: 'sku', width: 22 },
      { header: '商品', key: 'name', width: 20 }, { header: '问题', key: 'message', width: 60 }],
    rows: issues.map((i) => ({ ...i, level: i.level === 'error' ? '必须处理' : '建议处理' })) },
    { name: '填写说明', columns: [{ header: '步骤', key: 'n', width: 8 }, { header: '说明', key: 't', width: 100 }],
      rows: GUIDE[pf.group].map((t, i) => ({ n: i + 1, t })) },
  ]);
}

export const ListingExportButton = ({ selected = false }) => {
  const { selectedIds = [] } = useListContext();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState('shopify');
  const [brand, setBrand] = useState('Wavely');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setOpen(true); setData(null);
    try { setData(await loadData(selected ? selectedIds : null)); }
    catch (e) { notify(e.message, { type: 'error' }); setOpen(false); }
  };
  const result = data ? buildListing(platform, data.products, { ...data, brand }) : null;
  const errors = result?.issues.filter((i) => i.level === 'error') ?? [];
  const warns = result?.issues.filter((i) => i.level === 'warn') ?? [];

  const run = async () => {
    setBusy(true);
    try { await download(platform, result); setOpen(false); }
    catch (e) { notify(e.message, { type: 'error' }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Button size="small" startIcon={<StorefrontOutlinedIcon />} onClick={start}>导出上架模板</Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>导出平台上架模板{selected ? ` · 已选 ${selectedIds.length} 个商品` : ' · 全部在售商品'}</DialogTitle>
        <DialogContent>
          <Stack direction="row" sx={{ gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <TextField select size="small" label="目标平台" value={platform} onChange={(e) => setPlatform(e.target.value)} sx={{ minWidth: 200 }}>
              {Object.entries(PLATFORMS).map(([k, p]) => <MenuItem key={k} value={k}>{p.label}（{p.lang.toUpperCase()} · {p.currency}）</MenuItem>)}
            </TextField>
            <TextField size="small" label="品牌名" value={brand} onChange={(e) => setBrand(e.target.value)} sx={{ width: 160 }} />
          </Stack>
          {!result ? <Typography sx={{ mt: 2, color: 'text.secondary' }}>正在读取商品…</Typography> : (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 14 }}>
                {result.productCount} 个商品 · {result.skuCount} 个 SKU → {result.rows.length} 行，
                {result.platform.format === 'csv' ? 'Shopify 后台可直接导入的 CSV' : 'Excel（模板 / 上架前检查 / 填写说明 三页）'}
              </Typography>
              <Stack direction="row" sx={{ gap: 1, my: 1.5 }}>
                <Chip size="small" color={errors.length ? 'error' : 'success'} variant="outlined" label={`必须处理 ${errors.length}`} />
                <Chip size="small" color={warns.length ? 'warning' : 'success'} variant="outlined" label={`建议处理 ${warns.length}`} />
              </Stack>
              {result.issues.length > 0 && (
                <Box sx={{ maxHeight: 240, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                  {[...errors, ...warns].slice(0, 60).map((i, n) => (
                    <Typography key={n} sx={{ fontSize: 12.5, py: 0.25, color: i.level === 'error' ? 'error.main' : 'text.secondary' }}>
                      {i.sku || i.product} · {i.name}：{i.message}
                    </Typography>
                  ))}
                  {result.issues.length > 60 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>…其余见导出文件</Typography>}
                </Box>
              )}
              <Alert severity="info" sx={{ mt: 1.5, py: 0, fontSize: 12.5 }}>{GUIDE[result.platform.group][0]}。价格按汇率换算为 {result.platform.currency}，缺少目标语言文案时用英文代替。</Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>取消</Button>
          <Button variant="contained" onClick={run} disabled={busy || !result?.rows.length}>{busy ? '生成中…' : '下载'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
