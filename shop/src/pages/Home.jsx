import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Grid, Stack, Chip, Skeleton } from '@mui/material';
import { useStore, priceFrom } from '../store';
import { productName } from '../i18n';
import { ProductCard, Perks } from '../components/ui';
import { AutoVideo, videoOf, FILM_SKUS } from '../components/ProductVideo';

// 场景短片：点击进入商品页
const Films = () => {
  const { products, tr, lang, price } = useStore();
  const items = FILM_SKUS.map((sku) => products?.find((p) => p.sku === sku)).filter(Boolean);
  if (!items.length) return null;
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: { xs: 5, md: 7 } }}>
      <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 36 } }}>{tr.filmsTitle}</Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>{tr.filmsSub}</Typography>
      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        {items.map((p) => {
          const v = videoOf(p);
          return (
            <Grid key={p.id} size={{ xs: 12, sm: 6 }}>
              <Box component={RouterLink} to={`/p/${p.id}`} sx={{ display: 'block', position: 'relative', borderRadius: 4, overflow: 'hidden', textDecoration: 'none', color: '#fff',
                '&:hover video': { transform: 'scale(1.03)' }, '& video': { transition: 'transform .6s ease' } }}>
                <AutoVideo src={v.src} poster={v.poster} />
                <Box sx={{ position: 'absolute', inset: 'auto 0 0 0', p: { xs: 1.75, md: 2.5 }, pt: 6,
                  background: 'linear-gradient(transparent, rgba(0,0,0,.62))', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: { xs: 16, md: 19 }, lineHeight: 1.25, textShadow: '0 1px 8px rgba(0,0,0,.3)' }}>{productName(p, lang)}</Typography>
                  <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', bgcolor: 'rgba(255,255,255,.92)', color: 'primary.main', borderRadius: 99, px: 1.5, py: 0.5, fontSize: 14 }}>
                    {price(priceFrom(p))}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

const CATS = ['家居', '户外', '宠物', '美妆', '数码配件'];

export const Home = () => {
  const { products, tr } = useStore();
  const [cat, setCat] = useState('all');
  const list = (products ?? []).filter((p) => cat === 'all' || p.category === cat);

  return (
    <Box>
      <Box sx={{ position: 'relative', overflow: 'hidden', px: 2, pt: { xs: 7, md: 11 }, pb: { xs: 7, md: 10 },
        background: 'radial-gradient(800px 400px at 85% 10%, #c2f0f7 0%, transparent 60%), radial-gradient(700px 380px at 5% 90%, #ffe0d6 0%, transparent 60%)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', textAlign: 'center' }}>
          <Typography sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: '.18em', fontSize: 13, textTransform: 'uppercase' }}>{tr.tagline}</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 40, sm: 56, md: 72 }, lineHeight: 1.05, my: 2.5, whiteSpace: 'pre-line', letterSpacing: '-.02em' }}>{tr.heroTitle}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 18 }, maxWidth: 560, mx: 'auto', mb: 4 }}>{tr.heroSub}</Typography>
          <Button size="large" variant="contained" href="#products" sx={{ px: 4, py: 1.4 }}>{tr.shopNow}</Button>
          <Box sx={{ mt: 5 }}><Perks /></Box>
        </Box>
      </Box>

      <Films />

      <Box id="products" sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: 6, scrollMarginTop: 100 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
          <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 36 } }}>{tr.products}</Typography>
          <Stack direction="row" sx={{ gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
            {['all', ...CATS].map((c) => (
              <Chip key={c} label={c === 'all' ? tr.all : tr.cats[c]} onClick={() => setCat(c)}
                color={cat === c ? 'primary' : 'default'} variant={cat === c ? 'filled' : 'outlined'} sx={{ flexShrink: 0 }} />
            ))}
          </Stack>
        </Stack>
        <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
          {(products ? list : [...Array(8)]).map((p, i) => (
            <Grid key={p?.id ?? i} size={{ xs: 6, md: 4, lg: 3 }}>
              {p ? <ProductCard p={p} /> : <Skeleton variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />}
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};
