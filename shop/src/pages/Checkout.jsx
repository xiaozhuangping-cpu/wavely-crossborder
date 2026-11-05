import { useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Grid, Stack, Button, TextField, MenuItem, Alert, Divider, Card } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useStore, supabase, ERP_URL, optionLabel } from '../store';
import { productTitle } from '../i18n';

const COUNTRIES = { US: '🇺🇸 United States', DE: '🇩🇪 Deutschland', GB: '🇬🇧 United Kingdom', JP: '🇯🇵 日本', SG: '🇸🇬 Singapore', MY: '🇲🇾 Malaysia', FR: '🇫🇷 France', ES: '🇪🇸 España', CA: '🇨🇦 Canada', AU: '🇦🇺 Australia' };

export const Checkout = () => {
  const { lines, price, lang, tr, subtotalUsd, currency, clear, addOrder } = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', country: lang === 'ja' ? 'JP' : lang === 'es' ? 'ES' : lang === 'de' ? 'DE' : 'US', address: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('place_order', {
      p_items: lines.map((l) => ({ sku_id: l.skuId, qty: l.qty })),
      p_customer: { name: f.name.trim(), email: f.email.trim(), country: f.country },
      p_currency: currency,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    addOrder(data); clear();
    navigate(`/done/${data}`);
  };

  if (!lines.length) return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 6, textAlign: 'center' }}>
      <Typography sx={{ mb: 3 }}>{tr.emptyCart}</Typography>
      <Button component={RouterLink} to="/" variant="contained">{tr.continueShopping}</Button>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: 2, pt: 4 }}>
      <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 40 }, mb: 3 }}>{tr.checkout}</Typography>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>{tr.demoNote}</Alert>
          <Stack component="form" spacing={2} onSubmit={submit} id="checkout">
            <TextField label={tr.name} value={f.name} onChange={set('name')} required inputProps={{ maxLength: 80 }} />
            <TextField label={tr.email} type="email" value={f.email} onChange={set('email')} required placeholder="demo@example.com" />
            <TextField select label={tr.country} value={f.country} onChange={set('country')}>
              {Object.entries(COUNTRIES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField label={tr.address} value={f.address} onChange={set('address')} multiline minRows={2} helperText={tr.demoNote} />
            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ p: 2.5, '&:hover': { transform: 'none', boxShadow: 'none' } }}>
            <Stack spacing={1.5}>
              {lines.map((l) => (
                <Stack key={l.id} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ fontSize: 14 }}>{productTitle(l.product, lang)}{l.product.skus.length > 1 ? ` · ${optionLabel(l.sku.option_value, lang)}` : ''} × {l.qty}</Typography>
                  <Typography sx={{ fontSize: 14, whiteSpace: 'nowrap' }}>{price(l.sku.price_usd * l.qty)}</Typography>
                </Stack>
              ))}
              <Divider />
              <Stack direction="row" sx={{ justifyContent: 'space-between', color: 'text.secondary' }}><Typography>{tr.shipping}</Typography><Typography>{tr.free}</Typography></Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography sx={{ fontWeight: 500 }}>{tr.total}</Typography><Typography sx={{ fontWeight: 500, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{price(subtotalUsd)}</Typography></Stack>
              <Button type="submit" form="checkout" size="large" variant="contained" disabled={busy}>{busy ? tr.placing : `${tr.placeOrder} · ${price(subtotalUsd)}`}</Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export const Done = () => {
  const { no } = useParams();
  const { tr } = useStore();
  return (
    <Box sx={{ maxWidth: 620, mx: 'auto', px: 2, pt: 8, textAlign: 'center' }}>
      <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main' }} />
      <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 40 }, my: 2 }}>{tr.thanks}</Typography>
      <Typography sx={{ color: 'text.secondary' }}>{tr.orderNo}</Typography>
      <Typography sx={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500, my: 1 }}>{no}</Typography>
      <Alert severity="success" icon={false} sx={{ my: 3, borderRadius: '12px', textAlign: 'left' }}>{tr.orderSynced}</Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center' }}>
        <Button component={RouterLink} to={`/track?no=${no}`} variant="contained">{tr.track}</Button>
        <Button href={`${ERP_URL}#/orders?filter=${encodeURIComponent(JSON.stringify({ 'order_no@ilike': no }))}`} variant="outlined">{tr.viewInErp} ↗</Button>
        <Button component={RouterLink} to="/" color="inherit">{tr.continueShopping}</Button>
      </Stack>
    </Box>
  );
};
