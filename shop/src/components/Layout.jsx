import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Box, Typography, IconButton, Badge, Select, MenuItem, Drawer, Stack, Button, Divider, Link, Menu, ListSubheader, ListItemIcon } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import CheckIcon from '@mui/icons-material/Check';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useStore, CURRENCIES, ERP_URL, optionLabel } from '../store';
import { LANGS, productTitle } from '../i18n';
import { ProductArt } from './ui';

export const Logo = () => (
  <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'text.primary' }}>
    <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0e7490" />
      <path d="M10 38c8-10 14-10 22 0s14 10 22 0" stroke="#c2e7ff" strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
    <Typography sx={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 500, letterSpacing: '-.01em' }}>Wavely</Typography>
  </Box>
);

const Picker = ({ value, onChange, options, label }) => (
  <Select size="small" value={value} onChange={(e) => onChange(e.target.value)} variant="standard" disableUnderline aria-label={label}
    sx={{ fontSize: 14, '& .MuiSelect-select': { py: 0.5, pr: '24px !important' } }}>
    {options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
  </Select>
);

// 小屏：语言 + 币种合并到一个菜单
const LocaleMenu = () => {
  const { lang, setLang, currency, setCurrency } = useStore();
  const [el, setEl] = useState(null);
  const item = (on, label, onClick) => (
    <MenuItem key={label} onClick={() => { onClick(); setEl(null); }} dense>
      <ListItemIcon>{on && <CheckIcon fontSize="small" />}</ListItemIcon>{label}
    </MenuItem>
  );
  return (
    <>
      <Button onClick={(e) => setEl(e.currentTarget)} color="inherit" startIcon={<LanguageIcon />} sx={{ px: 1, minWidth: 0, fontSize: 13 }}>
        {lang.toUpperCase()} · {currency}
      </Button>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        <ListSubheader>Language</ListSubheader>
        {Object.entries(LANGS).map(([k, v]) => item(k === lang, v, () => setLang(k)))}
        <ListSubheader>Currency</ListSubheader>
        {CURRENCIES.map((c) => item(c === currency, c, () => setCurrency(c)))}
      </Menu>
    </>
  );
};

export const Header = () => {
  const { lang, setLang, currency, setCurrency, count, setCartOpen, tr } = useStore();
  return (
    <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'rgba(251,250,247,.86)', backdropFilter: 'blur(12px)', borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ bgcolor: 'primary.dark', color: '#e0f7fa', textAlign: 'center', fontSize: 13, py: 0.75, px: 2 }}>{tr.freeShip} · {tr.returns}</Box>
      <Stack direction="row" sx={{ maxWidth: 1200, mx: 'auto', px: 2, height: 64, alignItems: 'center', gap: { xs: 0.5, sm: 2 } }}>
        <Logo />
        <Box sx={{ flex: 1 }} />
        <Button component={RouterLink} to="/track" startIcon={<LocalShippingOutlinedIcon />} color="inherit" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>{tr.track}</Button>
        <IconButton component={RouterLink} to="/track" sx={{ display: { xs: 'inline-flex', md: 'none' } }} aria-label={tr.track}><LocalShippingOutlinedIcon /></IconButton>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2 }}>
          <Picker value={lang} onChange={setLang} label="Language" options={Object.entries(LANGS)} />
          <Picker value={currency} onChange={setCurrency} label="Currency" options={CURRENCIES.map((c) => [c, c])} />
        </Box>
        <Box sx={{ display: { xs: 'block', md: 'none' } }}><LocaleMenu /></Box>
        <IconButton onClick={() => setCartOpen(true)} aria-label={tr.cart}>
          <Badge badgeContent={count} color="primary"><ShoppingBagOutlinedIcon /></Badge>
        </IconButton>
      </Stack>
    </Box>
  );
};

export const CartDrawer = () => {
  const { cartOpen, setCartOpen, lines, setQty, price, lang, tr, subtotalUsd } = useStore();
  const navigate = useNavigate();
  return (
    <Drawer anchor="right" open={cartOpen} onClose={() => setCartOpen(false)} slotProps={{ paper: { sx: { width: { xs: '100vw', sm: 420 }, bgcolor: 'background.default' } } }}>
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', px: 2.5, height: 64, borderBottom: 1, borderColor: 'divider' }}>
          <Typography sx={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 500, flex: 1 }}>{tr.cart}</Typography>
          <IconButton onClick={() => setCartOpen(false)} aria-label="close"><CloseIcon /></IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
          {lines.length === 0 && <Typography sx={{ color: 'text.secondary', textAlign: 'center', mt: 8 }}>{tr.emptyCart}</Typography>}
          <Stack spacing={2}>
            {lines.map((l) => (
              <Stack key={l.id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 72, flexShrink: 0 }}><ProductArt p={l.product} src={l.sku.image_url} sx={{ borderRadius: '8px', '& span': { fontSize: '36px !important' } }} /></Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{productTitle(l.product, lang)}</Typography>
                  {l.product.skus.length > 1 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{optionLabel(l.product.option_name, lang)}: {optionLabel(l.sku.option_value, lang)}</Typography>}
                  <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{price(l.sku.price_usd)}</Typography>
                </Box>
                <Stack direction="row" sx={{ alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: '8px' }}>
                  <IconButton size="small" onClick={() => setQty(l.id, l.qty - 1)} aria-label="-"><RemoveIcon fontSize="small" /></IconButton>
                  <Typography sx={{ minWidth: 20, textAlign: 'center', fontSize: 14 }}>{l.qty}</Typography>
                  <IconButton size="small" onClick={() => setQty(l.id, l.qty + 1)} aria-label="+"><AddIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Box>
        {lines.length > 0 && (
          <Box sx={{ p: 2.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}><Typography>{tr.subtotal}</Typography><Typography>{price(subtotalUsd)}</Typography></Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2, color: 'text.secondary' }}><Typography>{tr.shipping}</Typography><Typography>{tr.free}</Typography></Stack>
            <Button fullWidth size="large" variant="contained" onClick={() => { setCartOpen(false); navigate('/checkout'); }}>{tr.checkout} · {price(subtotalUsd)}</Button>
          </Box>
        )}
      </Stack>
    </Drawer>
  );
};

export const Footer = () => {
  const { tr } = useStore();
  return (
    <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', mt: 10, py: 5, px: 2, bgcolor: '#f3efe7' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ maxWidth: 1200, mx: 'auto', gap: 3, justifyContent: 'space-between' }}>
        <Box>
          <Logo />
          <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 1, maxWidth: 360 }}>{tr.tagline}</Typography>
        </Box>
        <Stack spacing={0.75} sx={{ fontSize: 14 }}>
          <Link component={RouterLink} to="/track" underline="hover" color="inherit">{tr.track}</Link>
          <Link href={ERP_URL} underline="hover" color="inherit">Wavely ERP ↗</Link>
          <Link href="https://xiaozhuangping-cpu.github.io/" underline="hover" color="inherit">by 小庄 Studio ↗</Link>
        </Stack>
      </Stack>
      <Divider sx={{ maxWidth: 1200, mx: 'auto', my: 3 }} />
      <Typography sx={{ maxWidth: 1200, mx: 'auto', fontSize: 12, color: 'text.secondary' }}>
        {tr.demoNote} {tr.aiNote}
      </Typography>
    </Box>
  );
};
