import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, CardActionArea, Stack } from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import TuneIcon from '@mui/icons-material/Tune';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useStore, activeSkus, priceFrom, hasVariants } from '../store';
import { productTitle } from '../i18n';

// 商品图：优先白底实拍图（跨境主图规范），加载失败时退回中性底 + 货箱线条图标与 SKU 编号
export const ProductArt = ({ p, src, size = 'md', sx }) => {
  const [err, setErr] = useState(false);
  const url = src || p?.image_url;
  if (url && !err) {
    return (
      <Box sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: '8px', overflow: 'hidden', bgcolor: '#fff', ...sx }}>
        <Box component="img" src={url} alt={p?.name?.en ?? ''} loading="lazy" onError={() => setErr(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </Box>
    );
  }
  return (
    <Box sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: '8px', overflow: 'hidden', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1,
      bgcolor: '#f3f1ec', color: 'text.secondary', ...sx }}>
      <Inventory2OutlinedIcon sx={{ fontSize: size === 'lg' ? 64 : 40 }} aria-hidden />
      {p?.sku && <Typography component="span" sx={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'text.secondary' }}>{p.sku}</Typography>}
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
    <Typography sx={{ fontFamily: 'var(--display)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', ...sx }}>
      {varies && <Box component="span" sx={{ fontSize: '0.65em', fontFamily: 'Inter, sans-serif', color: 'text.secondary', mr: 0.5 }}>{tr.from}</Box>}
      {price(priceFrom(p))}
    </Typography>
  );
};

export const ProductCard = ({ p }) => {
  const { lang, tr } = useStore();
  const n = activeSkus(p).length;
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={RouterLink} to={`/p/${p.id}`} sx={{ p: 1.5, pb: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <ProductArt p={p} />
        <Box sx={{ px: 0.5, pt: 1.5, flex: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{tr.cats[p.category] ?? p.category}</Typography>
            {n > 1 && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{n} {p.option_name?.[lang] ?? p.option_name?.en ?? ''}</Typography>}
          </Stack>
          <Typography sx={{ fontWeight: 500, fontSize: 15, lineHeight: 1.35, mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {productTitle(p, lang)}
          </Typography>
          <PriceFrom p={p} sx={{ fontSize: 20, mt: 1 }} />
        </Box>
      </CardActionArea>
      <Box sx={{ p: 1.5, pt: 1.5 }}><AddButton product={p} fullWidth size="small" /></Box>
    </Card>
  );
};

// 服务承诺：一行安静的文字 + 线条图标，不做胶囊
export const Perks = ({ sx }) => {
  const { tr } = useStore();
  const items = [[LocalShippingOutlinedIcon, tr.freeShip], [AssignmentReturnOutlinedIcon, tr.returns], [ScheduleOutlinedIcon, tr.fastShip]];
  return (
    <Stack direction="row" sx={{ columnGap: 3, rowGap: 1, flexWrap: 'wrap', color: 'text.secondary', fontSize: 14, ...sx }}>
      {items.map(([Icon, label]) => (
        <Stack key={label} direction="row" sx={{ alignItems: 'center', gap: 1 }}><Icon sx={{ fontSize: 18 }} aria-hidden />{label}</Stack>
      ))}
    </Stack>
  );
};
