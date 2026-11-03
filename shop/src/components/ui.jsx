import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Card, CardActionArea, Stack, Chip } from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { useState } from 'react';
import { useStore } from '../store';
import { productTitle } from '../i18n';

const ART = {
  'WV-HOM-001': '🧺', 'WV-HOM-002': '🧲', 'WV-HOM-003': '💡', 'WV-HOM-004': '🛏️',
  'WV-OUT-001': '🪑', 'WV-OUT-002': '🔋', 'WV-OUT-003': '🥤',
  'WV-PET-001': '⛲', 'WV-PET-002': '🐈', 'WV-PET-003': '🧹',
  'WV-BEA-001': '💧', 'WV-BEA-002': '🪞',
  'WV-ELE-001': '⚡', 'WV-ELE-002': '🔌', 'WV-ELE-003': '⌨️', 'WV-ELE-004': '🎧',
};
const HUE = { 家居: [32, 18], 户外: [150, 190], 宠物: [12, 340], 美妆: [320, 280], 数码配件: [210, 245] };

export const ProductArt = ({ p, size = 'md', sx }) => {
  const [a, b] = HUE[p?.category] ?? [200, 230];
  return (
    <Box sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 3, overflow: 'hidden', display: 'grid', placeItems: 'center',
      background: `radial-gradient(circle at 30% 25%, hsl(${a} 90% 92%), transparent 60%), linear-gradient(140deg, hsl(${a} 70% 86%), hsl(${b} 55% 80%))`, ...sx }}>
      <Box sx={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: 'rgba(255,255,255,.45)', filter: 'blur(2px)' }} />
      <Box component="span" sx={{ position: 'relative', fontSize: size === 'lg' ? 'clamp(96px, 18vw, 160px)' : 'clamp(56px, 9vw, 84px)', filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.18))' }} aria-hidden>
        {ART[p?.sku] ?? '📦'}
      </Box>
    </Box>
  );
};

export const AddButton = ({ id, fullWidth, size = 'medium', openCart = true }) => {
  const { add, tr, setCartOpen } = useStore();
  const [done, setDone] = useState(false);
  return (
    <Button fullWidth={fullWidth} size={size} variant={done ? 'outlined' : 'contained'} startIcon={<AddShoppingCartIcon />}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); add(id); setDone(true); if (openCart) setCartOpen(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? tr.added : tr.addToCart}
    </Button>
  );
};

export const ProductCard = ({ p }) => {
  const { lang, price, tr } = useStore();
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={RouterLink} to={`/p/${p.id}`} sx={{ p: 1.25, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <ProductArt p={p} />
        <Box sx={{ px: 0.5, pt: 1.5, flex: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', letterSpacing: '.06em', textTransform: 'uppercase' }}>{tr.cats[p.category] ?? p.category}</Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35, mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {productTitle(p, lang)}
          </Typography>
          <Typography sx={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 600, mt: 1, color: 'primary.main' }}>{price(p.price_usd)}</Typography>
        </Box>
      </CardActionArea>
      <Box sx={{ p: 1.75, pt: 1.25 }}><AddButton id={p.id} fullWidth size="small" /></Box>
    </Card>
  );
};

export const Perks = () => {
  const { tr } = useStore();
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
      {[`🚚 ${tr.freeShip}`, `↩️ ${tr.returns}`, `⚡ ${tr.fastShip}`].map((x) => <Chip key={x} label={x} variant="outlined" sx={{ bgcolor: 'background.paper' }} />)}
    </Stack>
  );
};
