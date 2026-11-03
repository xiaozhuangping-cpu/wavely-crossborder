import { useEffect, useMemo, useState } from 'react';
import { Title, Link } from 'react-admin';
import { Box, Card, CardContent, Typography, Grid, ToggleButton, ToggleButtonGroup, Skeleton, Chip, Stack, List, ListItem, ListItemText, Alert } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { supabase } from './supabase';
import { PLATFORMS, COUNTRIES, ORDER_STATUS, fmtMoney } from './constants';

const Kpi = ({ label, value, hint, color = 'primary.main' }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, color: color, my: 0.5, fontSize: 'clamp(1.05rem, 1.7vw, 2rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography>
      {hint && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{hint}</Typography>}
    </CardContent>
  </Card>
);

const Panel = ({ title, children, action }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </CardContent>
  </Card>
);

export const Dashboard = () => {
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
        <Typography variant="h5" sx={{ fontWeight: 800 }}>经营看板</Typography>
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
          ['待发货', todo.paid, `运输中 ${todo.in_transit} 单`, 'warning.main'],
        ].map(([l, v, h, c]) => (
          <Grid size={{ xs: 6, md: 3 }} key={l}>
            {v == null ? <Skeleton variant="rounded" height={118} /> : <Kpi label={l} value={v} hint={h} color={c} />}
          </Grid>
        ))}

        <Grid size={{ xs: 12, lg: 8 }} >
          <Panel title="每日销售额（按平台，USD）">
            {!stats ? <Skeleton variant="rounded" height={280} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.series} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} minTickGap={16} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  {usedPlatforms.map((k) => (
                    <Area key={k} type="monotone" dataKey={k} name={PLATFORMS[k].label} stackId="1"
                          stroke={PLATFORMS[k].color} fill={PLATFORMS[k].color} fillOpacity={0.55} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }} >
          <Panel title="平台占比">
            {!stats ? <Skeleton variant="rounded" height={280} /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.platforms} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {stats.platforms.map((p) => <Cell key={p.key} fill={PLATFORMS[p.key]?.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {stats.platforms.map((p) => (
                    <Chip key={p.key} size="small" label={`${p.name} ${Math.round((p.value / stats.gmv) * 100)}%`}
                          sx={{ bgcolor: PLATFORMS[p.key]?.color, color: '#fff' }} />
                  ))}
                </Stack>
              </>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }} >
          <Panel title="国家/地区销售额（累计）">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={countries.map((c) => ({ ...c, label: COUNTRIES[c.country] ?? c.country, gmv: Math.round(c.gmv_usd) }))} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Bar dataKey="gmv" name="GMV" fill="#0e7490" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }} >
          <Panel title="⚠️ 低库存预警" action={<Link to="/v_inventory?filter=%7B%22low_stock%22%3Atrue%7D">查看全部</Link>}>
            <List dense disablePadding>
              {low.length === 0 && <Typography sx={{ color: 'text.secondary' }}>暂无低库存商品</Typography>}
              {low.map((r) => (
                <ListItem key={r.id} disableGutters divider>
                  <ListItemText primary={r.product_name} secondary={`${r.sku} · ${r.warehouse_name}`} />
                  <Chip size="small" color={r.qty === 0 ? 'error' : 'warning'} label={`${r.qty} / ${r.safety_qty}`} />
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
                  <ListItemText primary={o.order_no} secondary={o.shops?.name} />
                  <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtMoney(o.total_amount, o.currency)}</Typography>
                    <Chip size="small" label={ORDER_STATUS[o.status]?.label} color={ORDER_STATUS[o.status]?.color} />
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
