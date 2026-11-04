// 采购闭环：补货建议（按 SKU × 仓库）→ 生成采购单 → 下单 → 分批收货入库；供应商管理
// 业务规则全部在数据库函数里（create/place/receive/cancel_purchase_order、v_replenishment），这里只做界面
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  List, SimpleList, Edit, Create, SimpleForm, TextInput, NumberInput, SelectInput, required, minValue, maxValue,
  useListContext, useNotify, useRefresh, useRecordContext, Show, CreateButton, Button as RaButton, TopToolbar, ListButton,
} from 'react-admin';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Chip, Stack, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, Alert, FormControlLabel, Checkbox, useMediaQuery, LinearProgress, Link, Tooltip,
} from '@mui/material';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useRole, APPROVAL_THRESHOLD } from '../auth/role';
import { exportXlsx } from '../utils/xlsx';
import { supabase } from '../supabase';
import { WAREHOUSE_KIND, fmtMoney } from '../constants';
import { AgList, col, render } from '../grid';
import { Thumb } from './skus';

export const PO_STATUS = {
  draft: { label: '草稿', color: 'default' },
  approval: { label: '待审批', color: 'secondary' },
  placed: { label: '已下单', color: 'info' },
  partial: { label: '部分到货', color: 'warning' },
  received: { label: '已到货', color: 'success' },
  cancelled: { label: '已取消', color: 'default' },
};
const PO_CHOICES = Object.entries(PO_STATUS).map(([id, v]) => ({ id, name: v.label }));
const KIND_CHOICES = Object.entries(WAREHOUSE_KIND).map(([id, name]) => ({ id, name }));
const cny = (v) => fmtMoney(v, 'CNY');
const day = (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-');
const useSmall = () => useMediaQuery((t) => t.breakpoints.down('md'));
const POStatus = ({ s }) => <Chip size="small" color={PO_STATUS[s]?.color} label={PO_STATUS[s]?.label ?? s} />;
const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

// ========== 补货建议 ==========
const GeneratePOs = () => {
  const { can, label } = useRole();
  const { selectedIds, data = [], onUnselectItems } = useListContext();
  const notify = useNotify();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(false);
  const [busy, setBusy] = useState(false);
  const rows = data.filter((r) => selectedIds.includes(r.id));
  // 按 供应商 × 收货仓 拆单
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows.filter((x) => x.supplier_id)) {
      const k = `${r.supplier_id}-${r.warehouse_id}`;
      if (!m.has(k)) m.set(k, { supplier_id: r.supplier_id, supplier_name: r.supplier_name, warehouse_id: r.warehouse_id, warehouse_name: r.warehouse_name, items: [] });
      m.get(k).items.push(r);
    }
    return [...m.values()];
  }, [rows]);
  const noSupplier = rows.filter((x) => !x.supplier_id).length;

  const run = async () => {
    setBusy(true);
    let ok = 0, approval = 0;
    try {
      for (const g of groups) {
        const id = await rpc('create_purchase_order', { p: { supplier_id: g.supplier_id, warehouse_id: g.warehouse_id, notes: '由补货建议生成',
          items: g.items.map((r) => ({ sku_id: r.sku_id, qty: r.suggested_qty })) } });
        if (place && (await rpc('place_purchase_order', { p_id: id })) === 'approval') approval += 1;
        ok += 1;
      }
      notify(`已生成 ${ok} 张采购单${place ? (approval ? `，其中 ${approval} 张超过 ¥${APPROVAL_THRESHOLD.toLocaleString()} 已提交老板审批` : '并下单') : '（草稿）'}`, { type: 'success' });
      onUnselectItems();
      navigate('/purchase_orders');
    } catch (e) {
      notify(`已生成 ${ok} 张，其余失败：${e.message}`, { type: 'error' });
    } finally { setBusy(false); setOpen(false); }
  };

  return (
    <>
      {can('createPO')
        ? <RaButton label="生成采购单" onClick={() => setOpen(true)}><ShoppingCartCheckoutIcon /></RaButton>
        : <Tooltip title={`当前身份「${label}」不能生成采购单，可在顶栏切换为采购或老板`}><span><RaButton label="生成采购单" disabled><ShoppingCartCheckoutIcon /></RaButton></span></Tooltip>}
      <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>生成采购单 · {groups.length} 张</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>按「供应商 × 收货仓」拆单，数量取建议补货量（已按起批量取整），生成后可在采购单里修改备注、下单与收货。</Typography>
          {noSupplier > 0 && <Alert severity="warning" sx={{ mb: 1.5 }}>{noSupplier} 行商品没有供应商，已跳过；可在商品所属的供应商页面补齐</Alert>}
          <Stack spacing={1}>
            {groups.map((g) => (
              <Box key={`${g.supplier_id}-${g.warehouse_id}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{g.supplier_name} → {g.warehouse_name}</Typography>
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                  {g.items.length} 个 SKU · {g.items.reduce((s, r) => s + r.suggested_qty, 0)} 件 · 约 {cny(g.items.reduce((s, r) => s + r.suggested_qty * Number(r.cost_cny), 0))}
                </Typography>
              </Box>
            ))}
          </Stack>
          <FormControlLabel sx={{ mt: 1 }} control={<Checkbox size="small" checked={place} onChange={(e) => setPlace(e.target.checked)} />}
            label={<Typography sx={{ fontSize: 14 }}>生成后直接提交（超过 ¥{APPROVAL_THRESHOLD.toLocaleString()} 的单需老板审批）</Typography>} />
          {busy && <LinearProgress sx={{ mt: 1 }} />}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpen(false)} disabled={busy}>取消</Button>
          <Button variant="contained" disableElevation onClick={run} disabled={busy || !groups.length}>生成 {groups.length} 张采购单</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const REPL_COLS = [
  render('', ({ r }) => <Thumb src={r.image_url} />, { width: 72 }),
  render('商品 / 规格', ({ r }) => (
    <Box sx={{ lineHeight: 1.3, minWidth: 0 }}>
      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{r.product_name}</Typography>
      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>{r.sku} · {r.option_label}</Typography>
    </Box>
  ), { flex: 2, minWidth: 220, filterSpec: { type: 'text', source: 'product_name@ilike', placeholder: '商品名', value: (p) => p.data?.product_name ?? '' } }),
  render('补货仓', ({ r }) => `${r.warehouse_name}`, { field: 'warehouse_kind', sortable: true, width: 150, filterSpec: { type: 'select', source: 'warehouse_kind', choices: KIND_CHOICES, placeholder: '全部' } }),
  render('在库 / 安全', ({ r }) => <span><b style={{ color: '#d93025' }}>{r.on_hand}</b> / {r.safety_qty}</span>, { field: 'on_hand', sortable: true, width: 110, type: 'rightAligned' }),
  render('在途', ({ r }) => (r.in_transit ? <Chip size="small" color="info" variant="outlined" label={r.in_transit} /> : '-'), { field: 'in_transit', sortable: true, width: 90 }),
  render('近 30 天销量', ({ r }) => `${r.sales_30d}（日均 ${r.daily_sales}）`, { field: 'sales_30d', sortable: true, width: 150 }),
  render('补货周期', ({ r }) => `${r.lead_days} 天`, { field: 'lead_days', sortable: true, width: 100 }),
  render('建议补货', ({ r }) => <b>{r.suggested_qty}{r.moq ? <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 400 }}> （{r.moq} 起批）</Typography> : null}</b>, { field: 'suggested_qty', sortable: true, width: 140 }),
  render('预估金额', ({ r }) => cny(r.suggested_qty * Number(r.cost_cny)), { width: 120, type: 'rightAligned' }),
  render('供应商', ({ r }) => r.supplier_name ?? <Typography sx={{ fontSize: 13, color: 'error.main' }}>未关联</Typography>, { flex: 1, minWidth: 160 }),
];

const ExportReplenishment = () => {
  const notify = useNotify();
  const run = async () => {
    const { data, error } = await supabase.from('v_replenishment').select('*').order('sales_30d', { ascending: false });
    if (error) { notify(error.message, { type: 'error' }); return; }
    await exportXlsx('补货建议', [{ name: '补货建议', columns: [
      { header: 'SKU', key: 'sku', width: 26 }, { header: '商品', key: 'product_name', width: 26 }, { header: '规格', key: 'option_label', width: 18 },
      { header: '补货仓', key: 'warehouse_name', width: 18 }, { header: '在库', key: 'on_hand', width: 8 }, { header: '安全库存', key: 'safety_qty', width: 10 },
      { header: '在途', key: 'in_transit', width: 8 }, { header: '近30天销量', key: 'sales_30d', width: 12 }, { header: '补货周期（天）', key: 'lead_days', width: 14 },
      { header: '建议补货', key: 'suggested_qty', width: 10 }, { header: '单价（¥）', key: 'cost', width: 10, numFmt: '#,##0.00' },
      { header: '预估金额（¥）', key: 'amount', width: 14, numFmt: '#,##0.00' }, { header: '供应商', key: 'supplier_name', width: 28 }],
      rows: data.map((r) => ({ ...r, cost: Number(r.cost_cny), amount: r.suggested_qty * Number(r.cost_cny) })) }]);
  };
  return <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={run}>导出 Excel</Button>;
};

const ReplHelp = () => (
  <Alert severity="info" sx={{ mx: 2, mt: 1, mb: 0.5, py: 0 }}>
    在库 + 在途 低于安全库存时建议补货：建议量 = 安全库存 × 2 + 日均销量 × 补货周期（供应商交期 + 头程）− 在库 − 在途，按起批量取整。勾选后一键按「供应商 × 收货仓」生成采购单。
  </Alert>
);

export const ReplenishmentList = () => {
  const isSmall = useSmall();
  return (
    <List resource="v_replenishment" title="补货建议" sort={{ field: 'sales_30d', order: 'DESC' }} perPage={50}
      pagination={isSmall ? undefined : false} actions={false} empty={false}>
      {isSmall ? (
        <SimpleList primaryText={(r) => `${r.product_name} · ${r.option_label}`} secondaryText={(r) => `${r.warehouse_name} · 在库 ${r.on_hand} / 在途 ${r.in_transit}`}
          tertiaryText={(r) => `建议 ${r.suggested_qty}`} linkType={false} />
      ) : (<>
        <ReplHelp />
        <AgList columnDefs={REPL_COLS} bulkActions={<GeneratePOs />} actions={<ExportReplenishment />} />
      </>)}
    </List>
  );
};

// ========== 采购单 ==========
const PO_COLS = [
  col('po_no', '采购单号', { width: 150, cellStyle: { fontFamily: 'monospace', display: 'flex', alignItems: 'center' }, filterSpec: { type: 'text', source: 'po_no@ilike', placeholder: '单号' } }),
  render('供应商', ({ r }) => r.suppliers?.name, { flex: 1, minWidth: 200 }),
  render('收货仓', ({ r }) => r.warehouses?.name, { width: 150 }),
  render('状态', ({ r }) => <POStatus s={r.status} />, { field: 'status', sortable: true, width: 110, filterSpec: { type: 'select', source: 'status', choices: PO_CHOICES, placeholder: '全部' } }),
  render('金额', ({ r }) => cny(r.total_cny), { field: 'total_cny', sortable: true, width: 130, type: 'rightAligned' }),
  render('预计到货', ({ r }) => day(r.expected_at), { field: 'expected_at', sortable: true, width: 120 }),
  render('创建时间', ({ r }) => day(r.created_at), { field: 'created_at', sortable: true, width: 120 }),
];
const PO_META = { columns: ['*', 'suppliers(name)', 'warehouses(name,kind)'] };

// 采购单 + 明细两个工作表
const exportPOs = async (notify) => {
  const { data: pos, error } = await supabase.from('purchase_orders')
    .select('po_no,status,total_cny,expected_at,created_at,placed_at,received_at,notes,suppliers(name),warehouses(name),'
      + 'purchase_order_items(qty,received_qty,unit_cost_cny,skus(sku,option_value,products(name)))')
    .order('created_at', { ascending: false });
  if (error) { notify(error.message, { type: 'error' }); return; }
  await exportXlsx('采购单', [
    { name: '采购单', columns: [
      { header: '采购单号', key: 'po_no', width: 16 }, { header: '状态', key: 'status', width: 10 }, { header: '供应商', key: 'supplier', width: 28 },
      { header: '收货仓', key: 'warehouse', width: 18 }, { header: '金额（¥）', key: 'total', width: 12, numFmt: '#,##0.00' },
      { header: '创建', key: 'created', width: 12 }, { header: '下单', key: 'placed', width: 12 }, { header: '预计到货', key: 'expected', width: 12 },
      { header: '到货', key: 'received', width: 12 }, { header: '备注', key: 'notes', width: 30 }],
      rows: pos.map((p) => ({ po_no: p.po_no, status: PO_STATUS[p.status]?.label, supplier: p.suppliers?.name, warehouse: p.warehouses?.name,
        total: Number(p.total_cny), created: day(p.created_at), placed: day(p.placed_at), expected: day(p.expected_at), received: day(p.received_at), notes: p.notes })) },
    { name: '采购明细', columns: [
      { header: '采购单号', key: 'po_no', width: 16 }, { header: 'SKU', key: 'sku', width: 26 }, { header: '商品', key: 'name', width: 28 },
      { header: '规格', key: 'spec', width: 22 }, { header: '采购数量', key: 'qty', width: 10 }, { header: '已收', key: 'received', width: 8 },
      { header: '单价（¥）', key: 'cost', width: 10, numFmt: '#,##0.00' }, { header: '小计（¥）', key: 'amount', width: 12, numFmt: '#,##0.00' }],
      rows: pos.flatMap((p) => (p.purchase_order_items ?? []).map((i) => ({ po_no: p.po_no, sku: i.skus?.sku, name: i.skus?.products?.name?.zh,
        spec: i.skus?.option_value?.zh, qty: i.qty, received: i.received_qty, cost: Number(i.unit_cost_cny), amount: i.qty * Number(i.unit_cost_cny) }))) },
  ]);
};
const ExportPOs = () => { const notify = useNotify(); return <Button size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={() => exportPOs(notify)}>导出 Excel</Button>; };

export const PurchaseOrderList = () => {
  const isSmall = useSmall();
  return (
    <List resource="purchase_orders" title="采购单" sort={{ field: 'created_at', order: 'DESC' }} perPage={25}
      queryOptions={{ meta: PO_META }} pagination={isSmall ? undefined : false} actions={false}>
      {isSmall ? (
        <SimpleList primaryText={(r) => r.po_no} secondaryText={(r) => `${r.suppliers?.name ?? ''} → ${r.warehouses?.name ?? ''}`}
          tertiaryText={(r) => PO_STATUS[r.status]?.label} linkType="show" />
      ) : (
        <AgList columnDefs={PO_COLS} rowClick={(id) => `/purchase_orders/${id}/show`}
          actions={<><Button size="small" component={RouterLink} to="/v_replenishment" startIcon={<ShoppingCartCheckoutIcon />}>从补货建议生成</Button><ExportPOs /></>} />
      )}
    </List>
  );
};

const ReceiveDialog = ({ open, onClose, items, po, onDone }) => {
  const notify = useNotify();
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setQty(Object.fromEntries(items.map((i) => [i.id, i.qty - i.received_qty]))); }, [open, items]);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await rpc('receive_purchase_order', { p_id: po.id, p_items: items.map((i) => ({ item_id: i.id, qty: Number(qty[i.id]) || 0 })) });
      notify(`已入库 ${r.received} 件 → ${po.warehouses?.name}，采购单${PO_STATUS[r.status]?.label}`, { type: 'success' });
      onDone();
    } catch (e) { notify(e.message, { type: 'error' }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>收货入库 · {po.warehouses?.name}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>默认填入剩余数量，可分批收货；确认后在同一事务内增加收货仓库存。</Typography>
        <Table size="small">
          <TableHead><TableRow><TableCell>SKU</TableCell><TableCell align="right">采购</TableCell><TableCell align="right">已收</TableCell><TableCell sx={{ width: 120 }}>本次收货</TableCell></TableRow></TableHead>
          <TableBody>
            {items.filter((i) => i.received_qty < i.qty).map((i) => (
              <TableRow key={i.id}>
                <TableCell sx={{ fontSize: 13 }}>{i.skus?.sku}<br /><Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{i.skus?.products?.name?.zh} · {i.skus?.option_value?.zh}</Typography></TableCell>
                <TableCell align="right">{i.qty}</TableCell>
                <TableCell align="right">{i.received_qty}</TableCell>
                <TableCell><TextField size="small" type="number" value={qty[i.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                  slotProps={{ htmlInput: { min: 0, max: i.qty - i.received_qty } }} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={busy}>取消</Button>
        <Button variant="contained" disableElevation onClick={submit} disabled={busy}>确认收货</Button>
      </DialogActions>
    </Dialog>
  );
};

const PODetail = () => {
  const po = useRecordContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [items, setItems] = useState([]);
  const [receiving, setReceiving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { can, role, label } = useRole();
  const load = useCallback(async () => {
    if (!po?.id) return;
    const { data } = await supabase.from('purchase_order_items')
      .select('id,qty,received_qty,unit_cost_cny,skus(id,sku,option_value,image_url,products(id,name,image_url,source_url))').eq('po_id', po.id).order('id');
    setItems(data ?? []);
  }, [po?.id]);
  useEffect(() => { load(); }, [load, po?.status]);
  if (!po) return null;
  const act = async (fn, args, msg) => {
    setBusy(true);
    try { const r = await rpc(fn, { p_id: po.id, ...args }); notify(typeof msg === 'function' ? msg(r) : msg, { type: 'success' }); refresh(); return true; }
    catch (e) { notify(e.message, { type: 'error' }); return false; }
    finally { setBusy(false); }
  };
  const received = items.reduce((s, i) => s + i.received_qty, 0), total = items.reduce((s, i) => s + i.qty, 0);
  const canCancel = ['draft', 'approval', 'placed'].includes(po.status) && received === 0;
  const needsApproval = Number(po.total_cny) > APPROVAL_THRESHOLD && role !== 'owner';
  // 无权限的按钮禁用并提示原因（数据库同样会拒绝）
  const Act = ({ perm, children, ...p }) => (can(perm)
    ? <Button disableElevation disabled={busy} {...p}>{children}</Button>
    : <Tooltip title={`当前身份「${label}」无权操作，可在顶栏切换身份`}><span><Button disableElevation disabled {...p}>{children}</Button></span></Tooltip>);
  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 500, fontFamily: 'monospace' }}>{po.po_no}</Typography>
        <POStatus s={po.status} />
        <Box sx={{ flex: 1 }} />
        {po.status === 'draft' && <Act perm="submitPO" variant="contained" onClick={() => act('place_purchase_order', {}, (s) => (s === 'approval' ? '已提交老板审批' : '已下单'))}>{needsApproval ? '提交审批' : '确认下单'}</Act>}
        {po.status === 'approval' && <>
          <Act perm="approvePO" variant="contained" color="success" onClick={() => act('approve_purchase_order', { p_approve: true, p_note: null }, '审批通过，已下单')}>审批通过</Act>
          <Act perm="approvePO" color="warning" onClick={() => { setNote(''); setRejecting(true); }}>驳回</Act>
        </>}
        {['placed', 'partial'].includes(po.status) && <Act perm="receivePO" variant="contained" onClick={() => setReceiving(true)}>收货入库</Act>}
        {canCancel && <Act perm="cancelPO" color="error" onClick={() => act('cancel_purchase_order', {}, '采购单已取消')}>取消采购单</Act>}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {[['供应商', <Link component={RouterLink} to={`/suppliers/${po.supplier_id}`} key="s">{po.suppliers?.name}</Link>], ['收货仓', `${po.warehouses?.name}（${WAREHOUSE_KIND[po.warehouses?.kind] ?? ''}）`],
          ['金额', cny(po.total_cny)], ['到货进度', `${received} / ${total} 件`], ['创建', day(po.created_at)], ['下单', day(po.placed_at)],
          ['预计到货', day(po.expected_at)], ['到货', day(po.received_at)]].map(([k, v]) => (
          <Box key={k}><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{k}</Typography><Typography sx={{ fontSize: 14 }}>{v}</Typography></Box>
        ))}
      </Box>
      {po.status === 'approval' && <Alert severity="warning" sx={{ mb: 2 }}>金额超过 ¥{APPROVAL_THRESHOLD.toLocaleString()}，等待老板审批{role === 'owner' ? '：请核对数量与金额后审批' : '（可在顶栏切换为「老板」体验审批）'}</Alert>}
      {po.status === 'draft' && po.approval_note && <Alert severity="error" sx={{ mb: 2 }}>已被驳回：{po.approval_note}。修改后可重新提交。</Alert>}
      {po.approved_at && <Alert severity="success" icon={false} sx={{ mb: 2 }}>老板已于 {new Date(po.approved_at).toLocaleString('zh-CN')} 审批通过{po.approval_note ? `：${po.approval_note}` : ''}</Alert>}
      {po.notes && <Alert severity="info" icon={false} sx={{ mb: 2 }}>{po.notes}</Alert>}
      <Table size="small">
        <TableHead><TableRow>
          <TableCell /><TableCell>SKU / 规格</TableCell><TableCell align="right">单价</TableCell><TableCell align="right">采购</TableCell>
          <TableCell align="right">已收</TableCell><TableCell align="right">小计</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell sx={{ width: 56 }}><Thumb src={i.skus?.image_url || i.skus?.products?.image_url} size={40} /></TableCell>
              <TableCell>
                <Link component={RouterLink} to={`/skus/${i.skus?.id}`} underline="hover" sx={{ fontFamily: 'monospace', fontSize: 13 }}>{i.skus?.sku}</Link>
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{i.skus?.products?.name?.zh} · {i.skus?.option_value?.zh}
                  {i.skus?.products?.source_url && <> · <Link href={i.skus.products.source_url} target="_blank" rel="noopener">1688 货源 ↗</Link></>}</Typography>
              </TableCell>
              <TableCell align="right">{cny(i.unit_cost_cny)}</TableCell>
              <TableCell align="right">{i.qty}</TableCell>
              <TableCell align="right" sx={{ color: i.received_qty >= i.qty ? 'success.main' : 'text.primary' }}>{i.received_qty}</TableCell>
              <TableCell align="right">{cny(i.qty * i.unit_cost_cny)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={rejecting} onClose={() => setRejecting(false)} maxWidth="xs" fullWidth>
        <DialogTitle>驳回采购单</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth multiline minRows={2} label="驳回原因（必填）" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRejecting(false)}>取消</Button>
          <Button variant="contained" color="warning" disableElevation disabled={!note.trim() || busy}
            onClick={async () => { if (await act('approve_purchase_order', { p_approve: false, p_note: note }, '已驳回，退回采购修改')) setRejecting(false); }}>驳回</Button>
        </DialogActions>
      </Dialog>
      <ReceiveDialog open={receiving} onClose={() => setReceiving(false)} items={items} po={po} onDone={() => { setReceiving(false); refresh(); load(); }} />
    </Box>
  );
};

export const PurchaseOrderShow = () => (
  <Show title="采购单" queryOptions={{ meta: PO_META }} actions={<TopToolbar><ListButton label="返回采购单" /></TopToolbar>} component="div">
    <PODetail />
  </Show>
);

// ========== 供应商 ==========
const SupplierForm = () => (
  <SimpleForm>
    <TextInput source="name" label="供应商名称" validate={required()} />
    <SelectInput source="source" label="来源" choices={[{ id: 'manual', name: '手动录入' }, { id: '1688', name: '1688' }]} defaultValue="manual" />
    <TextInput source="contact" label="联系人" />
    <TextInput source="phone" label="电话" />
    <TextInput source="url" label="店铺 / 网址" fullWidth />
    <NumberInput source="lead_days" label="交期（天）" defaultValue={7} validate={[required(), minValue(0), maxValue(180)]} helperText="下单到工厂发货的天数，补货周期 = 交期 + 头程" />
    <TextInput source="notes" label="备注" multiline fullWidth />
  </SimpleForm>
);
export const SupplierList = () => {
  const isSmall = useSmall();
  return (
    <List resource="suppliers" title="供应商" sort={{ field: 'id', order: 'ASC' }} pagination={false} actions={isSmall ? undefined : false}>
      {isSmall ? (
        <SimpleList primaryText={(r) => r.name} secondaryText={(r) => `${r.contact ?? ''} ${r.phone ?? ''}`} tertiaryText={(r) => `交期 ${r.lead_days} 天`} linkType="edit" />
      ) : (
        <AgList pagination={false} rowClick={(id) => `/suppliers/${id}`} actions={<SupplierActions />} columnDefs={SUPPLIER_COLS} />
      )}
    </List>
  );
};
const SUPPLIER_COLS = [
  col('name', '供应商', { flex: 2, minWidth: 220, filterSpec: { type: 'text', source: 'name@ilike', placeholder: '名称' } }),
  render('来源', ({ r }) => <Chip size="small" variant="outlined" label={r.source === '1688' ? '1688' : '手动'} />, { field: 'source', sortable: true, width: 100 }),
  col('contact', '联系人', { width: 120 }),
  col('phone', '电话', { width: 160 }),
  render('交期', ({ r }) => `${r.lead_days} 天`, { field: 'lead_days', sortable: true, width: 100 }),
  render('网址', ({ r }) => (r.url ? <Link href={r.url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>打开 ↗</Link> : '-'), { width: 100 }),
];
const SupplierActions = () => {
  const { can, label } = useRole();
  return can('editSupplier') ? <CreateButton label="新建供应商" />
    : <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1 }}>当前身份「{label}」只能查看供应商</Typography>;
};
export const SupplierEdit = () => <Edit mutationMode="pessimistic" title="编辑供应商"><SupplierForm /></Edit>;
export const SupplierCreate = () => <Create redirect="list" title="新建供应商"><SupplierForm /></Create>;
