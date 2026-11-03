import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, CardActionArea, Stack, Chip } from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import TuneIcon from '@mui/icons-material/Tune';
import { useStore, activeSkus, priceFrom, hasVariants } from '../store';
import { productTitle } from '../i18n';

const ART = {
  'WV-HOM-001': '🧺', 'WV-HOM-002': '🧲', 'WV-HOM-003': '💡', 'WV-HOM-004': '🛏️',
  'WV-OUT-001': '🪑', 'WV-OUT-002': '🔋', 'WV-OUT-003': '🥤',
  'WV-PET-001': '⛲', 'WV-PET-002': '🐈', 'WV-PET-003': '🧹',
  'WV-BEA-001': '💧', 'WV-BEA-002': '🪞',
  'WV-ELE-001': '⚡', 'WV-ELE-002': '🔌', 'WV-ELE-003': '⌨️', 'WV-ELE-004': '🎧',
};
const HUE = { 家居: [32, 18], 户外: [150, 190], 宠物: [12, 340], 美妆: [320, 280], 数码配件: [210, 245] };

// 商品图：优先白底实拍图（跨境主图规范），加载失败时退回插画
export const ProductArt = ({ p, src, size = 'md', sx }) => {
  const [err, setErr] = useState(false);
  const url = src || p?.image_url;
  if (url && !err) {
    return (
      <Box sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff', ...sx }}>
        <Box component="img" src={url} alt={p?.name?.en ?? ''} loading="lazy" onError={() => setErr(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </Box>
    );
  }
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

// 加购：传 skuId 直接加；只传 product 时，单规格直接加、多规格跳到商品页选规格
export const AddButton = ({ product, skuId, fullWidth, size = 'medium', openCart = true }) => {
  const { add, tr, setCartOpen } = useStore();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const needChoose = !skuId && hasVariants(product);
  const target = skuId ?? activeSkus(product)[0]?.id;
  return (
    <Button fullWidth={fullWidth} size={size} variant={done ? 'outlined' : needChoose ? 'outlined' : 'contained'}
      startIcon={needChoose ? <TuneIcon /> : <AddShoppingCartIcon />} disabled={!needChoose && !target}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation();
        if (needChoose) { navigate(`/p/${product.id}`); return; }
        add(target); setDone(true); if (openCart) setCartOpen(true); setTimeout(() => setDone(false), 1500);
      }}>
      {done ? tr.added : needChoose ? tr.chooseOption : tr.addToCart}
    </Button>
  );
};

export const PriceFrom = ({ p, sx }) => {
  const { price, tr } = useStore();
  const ps = activeSkus(p).map((k) => Number(k.price_usd));
  const varies = ps.length > 1 && Math.min(...ps) !== Math.max(...ps);
  return (
    <Typography sx={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'primary.main', ...sx }}>
      {varies && <Box component="span" sx={{ fontSize: '0.6em', fontFamily: 'Inter, sans-serif', color: 'text.secondary', mr: 0.5 }}>{tr.from}</Box>}
      {price(priceFrom(p))}
    </Typography>
  );
};

export const ProductCard = ({ p }) => {
  const { lang, tr } = useStore();
  const n = activeSkus(p).length;
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={RouterLink} to={`/p/${p.id}`} sx={{ p: 1.25, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <ProductArt p={p} />
        <Box sx={{ px: 0.5, pt: 1.5, flex: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', letterSpacing: '.06em', textTransform: 'uppercase' }}>{tr.cats[p.category] ?? p.category}</Typography>
            {n > 1 && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{n} {p.option_name?.[lang] ?? p.option_name?.en ?? ''}</Typography>}
          </Stack>
          <Typography sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35, mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {productTitle(p, lang)}
          </Typography>
          <PriceFrom p={p} sx={{ fontSize: 20, mt: 1 }} />
        </Box>
      </CardActionArea>
      <Box sx={{ p: 1.75, pt: 1.25 }}><AddButton product={p} fullWidth size="small" /></Box>
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
