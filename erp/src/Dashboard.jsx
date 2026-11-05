import { useEffect, useMemo, useState } from 'react';
import { Title, Link } from 'react-admin';
import { Box, Card, CardContent, Typography, Grid, ToggleButton, ToggleButtonGroup, Skeleton, Chip, Stack, List, ListItem, ListItemText, Alert, useTheme } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from './supabase';
import { PLATFORMS, COUNTRIES, ORDER_STATUS, fmtMoney } from './constants';

const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const num = { fontVariantNumeric: 'tabular-nums' };

// 统计卡：标签 + 数字 + 说明，不加颜色和装饰
const Kpi = ({ label, value, hint }) => (
  <Card sx={{ height: '100%', containerType: 'inline-size' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ ...num, fontWeight: 500, my: 1, fontSize: 'clamp(1.05rem, 11cqi, 1.75rem)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{value}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{hint}</Typography>}
    </CardContent>
  </Card>
);

const Panel = ({ title, children, action }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap', minHeight: 24 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{title}</Typography>
        {action && <Box sx={{ fontSize: 13 }}>{action}</Box>}
      </Stack>
      {children}
    </CardContent>
  </Card>
);

// 排行列表：名称、数值、细条。color 不传时只有第一名用强调色，其余为中性灰
const RankList = ({ rows, total, color }) => (
  <Stack spacing={1.75}>
    {rows.map((r, i) => {
      const pct = total ? (r.value / total) * 100 : 0;
      return (
        <Box key={r.key}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 0.75 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minWidth: 0 }}>
              {color && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color(r), flexShrink: 0 }} />}
              <Typography noWrap sx={{ fontSize: 14 }}>{r.name}</Typography>
            </Stack>
            <Typography sx={{ ...num, fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {fmtMoney(r.value)}<Box component="span" sx={{ display: 'inline-block', minWidth: 40, textAlign: 'right' }}>{Math.round(pct)}%</Box>
            </Typography>
          </Stack>
          <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 2, bgcolor: color ? color(r) : i === 0 ? 'primary.main' : 'text.disabled' }} />
          </Box>
        </Box>
      );
    })}
  </Stack>
);

export const Dashboard = () => {
  const theme = useTheme();
  const tick = { fontSize: 11, fill: theme.palette.text.secondary, fontFamily: MONO };
  const [range, setRange] = useState(30);
  const [daily, setDaily] = useState(null);
  const [countries, setCountries] = useState([]);
  const [low, setLow] = useState([]);
  const [todo, setTodo] = useState({ paid: 0, in_transit: 0 });
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, c, l, p, t, r] = await Promise.all([
          supabase.from('v_daily_sales').select('*').order('day'),
          supabase.from('v_country_sales').select('*').order('gmv_usd', { ascending: false }),
          supabase.from('v_inventory').select('*').eq('low_stock', true).order('qty').limit(6),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
          supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['shipped', 'in_transit']),
          supabase.from('orders').select('id,order_no,total_amount,currency,status,created_at,shops(name)').order('created_at', { ascending: false }).limit(6),
        ]);
        const e = [d, c, l, p, t, r].find((x) => x.error);
        if (e) throw e.error;
        setDaily(d.data); setCountries(c.data); setLow(l.data); setRecent(r.data);
        setTodo({ paid: p.count ?? 0, in_transit: t.count ?? 0 });
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    if (!daily) return null;
    const since = new Date(); since.setDate(since.getDate() - range + 1);
    const key = since.toISOString().slice(0, 10);
    const rows = daily.filter((r) => r.day >= key);
    const byDay = {}, byPlat = {};
    rows.forEach((r) => {
      byDay[r.day] ??= { day: r.day.slice(5), ...Object.fromEntries(Object.keys(PLATFORMS).map((k) => [k, 0])) };
      byDay[r.day][r.platform] = Number(r.gmv_usd);
      byPlat[r.platform] = (byPlat[r.platform] ?? 0) + Number(r.gmv_usd);
    });
    const gmv = rows.reduce((s, r) => s + Number(r.gmv_usd), 0);
    const orders = rows.reduce((s, r) => s + Number(r.orders), 0);
    return {
      gmv, orders, aov: orders ? gmv / orders : 0,
      series: Object.values(byDay),
      platforms: Object.entries(byPlat).map(([k, v]) => ({ name: PLATFORMS[k]?.label ?? k, key: k, value: Math.round(v) })).sort((a, b) => b.value - a.value),
    };
  }, [daily, range]);

  if (err) return <Alert severity="error" sx={{ m: 2 }}>加载失败：{err}</Alert>;

  const usedPlatforms = Object.keys(PLATFORMS).filter((k) => stats?.platforms.some((p) => p.key === k));

  return (
    <Box sx={{ py: 2 }}>
      <Title title="经营看板" />
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 500 }}>经营看板</Typography>
        <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, v) => v && setRange(v)}>
          <ToggleButton value={7}>近 7 天</ToggleButton>
          <ToggleButton value={30}>近 30 天</ToggleButton>
          <ToggleButton value={90}>近 90 天</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Grid container spacing={2}>
        {[
          ['销售额 GMV', stats && fmtMoney(stats.gmv), '已折算美元，不含退款/取消'],
          ['订单数', stats?.orders.toLocaleString(), `近 ${range} 天`],
          ['客单价', stats && fmtMoney(stats.aov), '平均每单'],
          ['待发货', todo.paid, `运输中 ${todo.in_transit} 单`],
        ].map(([l, v, h]) => (
          <Grid size={{ xs: 6, md: 3 }} key={l}>
            {v == null ? <Skeleton variant="rounded" height={112} /> : <Kpi label={l} value={v} hint={h} />}
          </Grid>
        ))}

        <Grid size={{ xs: 12, lg: 8 }} >
          <Panel title="每日销售额（按平台，USD）">
            {!stats ? <Skeleton variant="rounded" height={280} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.series} margin={{ left: -8, right: 8, top: 4 }}>
                  <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="day" tick={tick} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={tick} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  {usedPlatforms.map((k) => (
                    <Area key={k} type="monotone" dataKey={k} name={PLATFORMS[k].label} stackId="1"
                          stroke={PLATFORMS[k].color} strokeWidth={1.5} fill={PLATFORMS[k].color} fillOpacity={0.18} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }} >
          <Panel title="平台占比">
            {!stats ? <Skeleton variant="rounded" height={280} /> : (
              <RankList rows={stats.platforms} total={stats.gmv} color={(r) => PLATFORMS[r.key]?.color} />
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }} >
          <Panel title="国家/地区销售额（累计）">
            <RankList rows={countries.slice(0, 6).map((c) => ({ key: c.country, name: COUNTRIES[c.country] ?? c.country, value: Number(c.gmv_usd) }))}
              total={countries.reduce((a, c) => a + Number(c.gmv_usd), 0)} />
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }} >
          <Panel title="低库存预警" action={<Link to="/v_inventory?filter=%7B%22low_stock%22%3Atrue%7D">查看全部</Link>}>
            <List dense disablePadding>
              {low.length === 0 && <Typography sx={{ color: 'text.secondary' }}>暂无低库存商品</Typography>}
              {low.map((r) => (
                <ListItem key={r.id} disableGutters divider>
                  <ListItemText primary={r.product_name} secondary={<><Box component="span" sx={{ fontFamily: MONO, fontSize: 12 }}>{r.sku}</Box> · {r.warehouse_name}</>} />
                  <Typography sx={{ ...num, fontFamily: MONO, fontSize: 13, color: r.qty === 0 ? 'error.main' : 'warning.main', whiteSpace: 'nowrap' }}>{r.qty} / {r.safety_qty}</Typography>
                </ListItem>
              ))}
            </List>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }} >
          <Panel title="最新订单" action={<Link to="/orders">全部订单</Link>}>
            <List dense disablePadding>
              {recent.map((o) => (
                <ListItem key={o.id} disableGutters divider component={Link} to={`/orders/${o.id}/show`} sx={{ color: 'inherit' }}>
                  <ListItemText primary={o.order_no} secondary={o.shops?.name} slotProps={{ primary: { sx: { fontFamily: MONO, fontSize: 13 } } }} />
                  <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                    <Typography variant="body2" sx={{ ...num, fontWeight: 500 }}>{fmtMoney(o.total_amount, o.currency)}</Typography>
                    <Chip size="small" variant="outlined" label={ORDER_STATUS[o.status]?.label} color={ORDER_STATUS[o.status]?.color} />
                  </Stack>
                </ListItem>
              ))}
            </List>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
};
