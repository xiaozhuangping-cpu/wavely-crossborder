import { useMemo, useState } from 'react';
import { Title, useGetList } from 'react-admin';
import { Box, Card, CardContent, Grid, TextField, MenuItem, Typography, Stack, Divider, Slider, InputAdornment, Chip } from '@mui/material';
import { fmtMoney } from './constants';

const PRESETS = {
  amazon: { label: 'Amazon', fee: 15, last: 5.5 },
  shopee: { label: 'Shopee', fee: 8, last: 2.5 },
  tiktok: { label: 'TikTok Shop', fee: 9, last: 4 },
  site:   { label: '独立站', fee: 3, last: 6 },
};

const Num = ({ label, value, onChange, unit, step = 1 }) => (
  <TextField label={label} type="number" size="small" fullWidth value={value} inputProps={{ step }}
    onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    slotProps={{ input: { endAdornment: unit && <InputAdornment position="end">{unit}</InputAdornment> } }} />
);

export const ProfitCalculator = () => {
  const { data: rates = [] } = useGetList('exchange_rates', { pagination: { page: 1, perPage: 20 }, sort: { field: 'currency', order: 'ASC' } });
  const rate = (c) => Number(rates.find((r) => r.currency === c)?.rate_to_usd ?? (c === 'USD' ? 1 : NaN));

  const [platform, setPlatform] = useState('amazon');
  const [v, setV] = useState({ cost: 35, weight: 500, firstLeg: 45, price: 29.99, currency: 'USD', fee: 15, last: 5.5, ads: 10, returns: 3 });
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  const pickPlatform = (p) => { setPlatform(p); setV((s) => ({ ...s, fee: PRESETS[p].fee, last: PRESETS[p].last })); };

  const r = useMemo(() => {
    const cny = rate('CNY'), cur = rate(v.currency);
    if (!cny || !cur) return null;
    const revenue = v.price * cur;                          // USD
    const parts = [
      ['采购成本', v.cost * cny],
      ['头程运费', (v.weight / 1000) * v.firstLeg * cny],
      ['尾程 / 配送费', v.last],
      ['平台佣金', revenue * (v.fee / 100)],
      ['广告投放', revenue * (v.ads / 100)],
      ['退货损耗', revenue * (v.returns / 100)],
    ];
    const total = parts.reduce((s, [, x]) => s + x, 0);
    const profit = revenue - total;
    // 保本售价：成本固定部分 / (1 - 比例费用)
    const fixed = parts.slice(0, 3).reduce((s, [, x]) => s + x, 0);
    const breakeven = fixed / (1 - (v.fee + v.ads + v.returns) / 100) / cur;
    return { revenue, parts, total, profit, margin: revenue ? profit / revenue : 0, breakeven, roi: profit / (parts[0][1] + parts[1][1]) };
  }, [v, rates]);

  const pct = r ? Math.round(r.margin * 1000) / 10 : 0;

  return (
    <Box sx={{ py: 2 }}>
      <Title title="利润计算器" />
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>跨境利润计算器</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {Object.entries(PRESETS).map(([k, p]) => (
                <Chip key={k} label={p.label} color={platform === k ? 'primary' : 'default'} onClick={() => pickPlatform(k)} />
              ))}
            </Stack>
            <Grid container spacing={2}>
              <Grid size={6}><Num label="采购价" unit="¥" value={v.cost} onChange={set('cost')} /></Grid>
              <Grid size={6}><Num label="重量" unit="g" value={v.weight} onChange={set('weight')} /></Grid>
              <Grid size={6}><Num label="头程运费" unit="¥/kg" value={v.firstLeg} onChange={set('firstLeg')} /></Grid>
              <Grid size={6}><Num label="尾程费" unit="$" step={0.1} value={v.last} onChange={set('last')} /></Grid>
              <Grid size={7}><Num label="售价" step={0.01} value={v.price} onChange={set('price')} /></Grid>
              <Grid size={5}>
                <TextField select size="small" fullWidth label="币种" value={v.currency} onChange={(e) => set('currency')(e.target.value)}>
                  {rates.filter((x) => x.currency !== 'CNY').map((x) => <MenuItem key={x.currency} value={x.currency}>{x.currency}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
            {[['fee', '平台佣金', 30], ['ads', '广告占比', 40], ['returns', '退货率', 20]].map(([k, label, max]) => (
              <Box key={k} sx={{ mt: 2 }}>
                <Typography variant="body2">{label}：{v[k]}%</Typography>
                <Slider value={v[k]} min={0} max={max} step={0.5} onChange={(_, x) => set(k)(x)} />
              </Box>
            ))}
          </CardContent></Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}><CardContent>
            {!r ? <Typography sx={{ color: 'text.secondary' }}>加载汇率中…</Typography> : (
              <>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>单件净利润</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, color: r.profit >= 0 ? 'success.main' : 'error.main' }}>{fmtMoney(r.profit)}</Typography>
                <Stack direction="row" sx={{ gap: 1, my: 1.5, flexWrap: 'wrap' }}>
                  <Chip label={`毛利率 ${pct}%`} color={pct >= 25 ? 'success' : pct >= 10 ? 'warning' : 'error'} />
                  <Chip variant="outlined" label={`投入回报 ${Math.round(r.roi * 100)}%`} />
                  <Chip variant="outlined" label={`保本售价 ${fmtMoney(r.breakeven, v.currency)}`} />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.2}>
                  <Row label="售价（折合美元）" value={fmtMoney(r.revenue)} bold />
                  {r.parts.map(([l, x]) => <Row key={l} label={l} value={`- ${fmtMoney(x)}`} sub={`${Math.round((x / r.revenue) * 100)}%`} />)}
                  <Divider />
                  <Row label="净利润" value={fmtMoney(r.profit)} bold />
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>汇率取自「汇率」表，可在汇率页一键拉取欧洲央行实时汇率。</Typography>
              </>
            )}
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const Row = ({ label, value, sub, bold }) => (
  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
    <Typography sx={{ fontWeight: bold ? 700 : 400 }}>{label}{sub && <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>{sub}</Typography>}</Typography>
    <Typography sx={{ fontWeight: bold ? 700 : 400 }}>{value}</Typography>
  </Stack>
);
