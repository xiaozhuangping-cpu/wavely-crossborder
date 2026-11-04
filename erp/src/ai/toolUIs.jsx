// 工具结果在对话里的「生成式 UI」：图表、列表、确认卡片
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRefresh, useNotify } from 'react-admin';
import { Box, Typography, Stack, Chip, Button, Divider, CircularProgress } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { supabase } from '../supabase';
import { PLATFORMS, COUNTRIES, ORDER_STATUS, WAREHOUSE_KIND, fmtMoney } from '../constants';

const Card = ({ title, children, footer }) => (
  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, my: 1, overflow: 'hidden', bgcolor: 'background.paper' }}>
    {title && <Typography sx={{ fontSize: 13, fontWeight: 600, px: 1.5, pt: 1.25, pb: 0.5, color: 'text.secondary' }}>{title}</Typography>}
    <Box sx={{ px: 1.5, pb: 1.25 }}>{children}</Box>
    {footer && <><Divider /><Box sx={{ px: 1.5, py: 1 }}>{footer}</Box></>}
  </Box>
);

const ErrorNote = ({ result }) => result?.error ? <Typography sx={{ fontSize: 13, color: 'error.main', my: 1 }}>查询失败：{result.error}</Typography> : null;

const GROUP_LABEL = { platform: '平台', country: '国家', shop: '店铺', day: '日期', week: '周', status: '状态' };
const labelOf = (group, v) =>
  group === 'platform' ? PLATFORMS[v]?.label ?? v
  : group === 'country' ? COUNTRIES[v] ?? v
  : group === 'status' ? ORDER_STATUS[v]?.label ?? v
  : group === 'day' || group === 'week' ? v.slice(5) : v;

const SalesSummary = ({ args, result }) => {
  if (result?.error) return <ErrorNote result={result} />;
  const rows = (result?.rows ?? []).map((r) => ({ ...r, name: labelOf(args.group_by, r.label), gmv: Number(r.gmv_usd) }));
  if (!rows.length) return <Card title="销售汇总">这个时间段没有数据</Card>;
  const total = rows.reduce((s, r) => s + r.gmv, 0);
  const time = args.group_by === 'day' || args.group_by === 'week';
  return (
    <Card title={`销售额 · 按${GROUP_LABEL[args.group_by] ?? args.group_by} · ${args.start_date} ~ ${args.end_date}`}
          footer={<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>合计 {fmtMoney(total)} · {rows.reduce((s, r) => s + Number(r.orders), 0)} 单</Typography>}>
      <ResponsiveContainer width="100%" height={time ? 180 : Math.max(120, rows.length * 30)}>
        {time ? (
          <LineChart data={rows} margin={{ left: -18, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#8884" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} minTickGap={12} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <Line dataKey="gmv" name="GMV" stroke="#0b57d0" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <Bar dataKey="gmv" name="GMV" fill="#0b57d0" radius={[0, 4, 4, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
};

const TopProducts = ({ args, result }) => {
  if (result?.error) return <ErrorNote result={result} />;
  const rows = result?.rows ?? [];
  const max = Math.max(...rows.map((r) => Number(r.gmv_usd)), 1);
  const scope = [args.country && (COUNTRIES[args.country.toUpperCase()] ?? args.country), args.platform && PLATFORMS[args.platform]?.label].filter(Boolean).join(' · ');
  return (
    <Card title={`畅销商品${scope ? ` · ${scope}` : ''} · ${args.start_date} ~ ${args.end_date}`}>
      {rows.length === 0 && <Typography sx={{ fontSize: 13 }}>没有数据</Typography>}
      <Stack spacing={1}>
        {rows.map((r, i) => (
          <Box key={r.product_id}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 13 }}>
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{i + 1}.</b> {r.name} <Box component="span" sx={{ color: 'text.secondary' }}>{r.sku}</Box></Box>
              <Box component="span" sx={{ whiteSpace: 'nowrap', pl: 1 }}>{r.qty} 件 · {fmtMoney(r.gmv_usd)}</Box>
            </Stack>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', mt: 0.5 }}>
              <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'primary.main', width: `${(Number(r.gmv_usd) / max) * 100}%` }} />
            </Box>
          </Box>
        ))}
      </Stack>
    </Card>
  );
};

const LowStock = ({ result }) => {
  if (result?.error) return <ErrorNote result={result} />;
  const rows = result?.rows ?? [];
  return (
    <Card title={`低库存 · ${rows.length} 项`} footer={<Link to="/v_inventory" style={{ fontSize: 13 }}>去库存页处理 →</Link>}>
      <Stack divider={<Divider flexItem />} spacing={0.75}>
        {rows.slice(0, 8).map((r) => (
          <Stack key={r.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>{r.product_name}</Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{r.sku} · {r.warehouse_name}（{WAREHOUSE_KIND[r.warehouse_kind]}）</Typography>
            </Box>
            <Chip size="small" color={r.qty === 0 ? 'error' : 'warning'} label={`${r.qty} / ${r.safety_qty}`} />
          </Stack>
        ))}
      </Stack>
    </Card>
  );
};

const Replenishment = ({ result }) => {
  if (result?.error) return <ErrorNote result={result} />;
  const rows = result?.rows ?? [];
  return (
    <Card title={`补货建议 · ${rows.length} 项`} footer={<Link to="/v_replenishment" style={{ fontSize: 13 }}>去补货建议生成采购单 →</Link>}>
      <Stack divider={<Divider flexItem />} spacing={0.75}>
        {rows.slice(0, 8).map((r) => (
          <Stack key={r.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>{r.product_name} · {r.option_label}</Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{r.warehouse_name} · 在库 {r.on_hand}/{r.safety_qty}{r.in_transit ? ` · 在途 ${r.in_transit}` : ''} · 周期 {r.lead_days} 天</Typography>
            </Box>
            <Chip size="small" color="primary" variant="outlined" label={`补 ${r.suggested_qty}`} />
          </Stack>
        ))}
      </Stack>
    </Card>
  );
};

const OrderLines = ({ rows }) => (
  <Stack divider={<Divider flexItem />} spacing={0.75}>
    {rows.map((o) => (
      <Stack key={o.id} direction="row" component={Link} to={`/orders/${o.id}/show`}
        sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 0.8 } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>{o.order_no}</Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{o.shops?.name} · {o.customers?.name ?? '访客'} · {COUNTRIES[o.country] ?? o.country}</Typography>
        </Box>
        <Stack sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 13 }}>{fmtMoney(o.total_amount, o.currency)}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{ORDER_STATUS[o.status]?.label}</Typography>
        </Stack>
      </Stack>
    ))}
  </Stack>
);

const FindOrders = ({ result }) => {
  if (result?.error) return <ErrorNote result={result} />;
  const rows = result?.rows ?? [];
  return <Card title={`订单 · ${rows.length} 笔`}>{rows.length ? <OrderLines rows={rows} /> : '没有符合条件的订单'}</Card>;
};

const GetProduct = ({ result }) => {
  if (result?.error) return <ErrorNote result={result} />;
  const rows = result?.rows ?? [];
  return (
    <Card title="商品">
      {rows.length === 0 && '没有找到商品'}
      {rows.map((p) => (
        <Stack key={p.id} direction="row" component={Link} to={`/products/${p.id}`} sx={{ justifyContent: 'space-between', color: 'inherit', textDecoration: 'none', py: 0.25 }}>
          <Typography noWrap sx={{ fontSize: 13 }}>{p.name?.zh} <Box component="span" sx={{ color: 'text.secondary' }}>{p.sku}</Box></Typography>
          <Typography sx={{ fontSize: 13, pl: 1 }}>{fmtMoney(p.price_usd)}</Typography>
        </Stack>
      ))}
    </Card>
  );
};

const Done = ({ text }) => (
  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'success.main' }}>
    <CheckCircleIcon fontSize="small" /><Typography sx={{ fontSize: 13 }}>{text}</Typography>
  </Stack>
);

const ProposeShip = ({ result }) => {
  const refresh = useRefresh();
  const notify = useNotify();
  const [state, setState] = useState('idle');   // idle | busy | done | cancelled
  const [n, setN] = useState(0);
  if (result?.error) return <ErrorNote result={result} />;
  const rows = result?.orders ?? [];
  const confirm = async () => {
    setState('busy');
    const rs = await Promise.allSettled(rows.map((o) => supabase.rpc('ship_order', { p_order_id: o.id })));
    const ok = rs.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
    setN(ok); setState('done'); refresh();
    notify(`已发货 ${ok} 单`, { type: ok ? 'success' : 'warning' });
  };
  return (
    <Card title={`待确认 · 批量发货 ${rows.length} 笔${result?.skipped ? `（${result.skipped} 笔状态不符已跳过）` : ''}`}
      footer={
        state === 'done' ? <Done text={`已发货 ${n} 笔，运单已生成`} />
        : state === 'cancelled' ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>已取消</Typography>
        : rows.length === 0 ? null
        : <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setState('cancelled')} disabled={state === 'busy'}>取消</Button>
            <Button size="small" variant="contained" onClick={confirm} disabled={state === 'busy'}
              startIcon={state === 'busy' ? <CircularProgress size={14} color="inherit" /> : <LocalShippingOutlinedIcon />}>确认发货</Button>
          </Stack>
      }>
      {rows.length ? <OrderLines rows={rows} /> : '没有可发货的订单'}
    </Card>
  );
};

const LOCALE = { en: 'English', de: 'Deutsch', ja: '日本語', es: 'Español', fr: 'Français' };

const ProposeListing = ({ result }) => {
  const refresh = useRefresh();
  const [state, setState] = useState('idle');
  const [err, setErr] = useState('');
  if (result?.error) return <ErrorNote result={result} />;
  const { product, locale, title, bullets = [], description } = result ?? {};
  const save = async () => {
    setState('busy'); setErr('');
    const { data: cur, error: e1 } = await supabase.from('products').select('listing').eq('id', product.id).single();
    const { error } = e1 ? { error: e1 } : await supabase.from('products')
      .update({ listing: { ...(cur.listing ?? {}), [locale]: { title, bullets, description, updated_at: new Date().toISOString() } } }).eq('id', product.id);
    if (error) { setErr(error.message); setState('idle'); } else { setState('done'); refresh(); }
  };
  return (
    <Card title={`待确认 · ${product?.name?.zh ?? ''} · ${LOCALE[locale] ?? locale} Listing`}
      footer={state === 'done'
        ? <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Done text="已保存到商品" /><Link to={`/products/${product.id}`} style={{ fontSize: 13 }}>查看商品 →</Link></Stack>
        : <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
            {err && <Typography sx={{ fontSize: 12, color: 'error.main', mr: 'auto' }}>{err}</Typography>}
            <Button size="small" onClick={() => navigator.clipboard?.writeText([title, ...bullets.map((b) => `• ${b}`), description].join('\n'))}>复制</Button>
            <Button size="small" variant="contained" onClick={save} disabled={state === 'busy'} startIcon={<SaveOutlinedIcon />}>保存到商品</Button>
          </Stack>}>
      <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1, lineHeight: 1.4 }}>{title}</Typography>
      <Box component="ul" sx={{ pl: 2.5, my: 0, '& li': { fontSize: 13, mb: 0.5 } }}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, whiteSpace: 'pre-wrap' }}>{description}</Typography>
    </Card>
  );
};

const NAMES = { sales_summary: '查询销售汇总', top_products: '查询畅销商品', low_stock: '查询低库存', replenishment: '查询补货建议', find_orders: '查询订单', get_product: '查找商品', propose_ship_orders: '准备发货', propose_listing: '生成 Listing' };
export const ToolFallback = ({ toolName }) => <Chip size="small" variant="outlined" label={`已调用：${NAMES[toolName] ?? toolName}`} sx={{ my: 0.5 }} />;

export const TOOL_UIS = {
  sales_summary: SalesSummary,
  top_products: TopProducts,
  low_stock: LowStock,
  replenishment: Replenishment,
  find_orders: FindOrders,
  get_product: GetProduct,
  propose_ship_orders: ProposeShip,
  propose_listing: ProposeListing,
};
