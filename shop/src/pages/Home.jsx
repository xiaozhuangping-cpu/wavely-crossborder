import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Grid, Stack, Chip, Skeleton } from '@mui/material';
import { useStore, priceFrom } from '../store';
import { productName } from '../i18n';
import { ProductCard, Perks } from '../components/ui';
import { AutoVideo, videoOf } from '../components/ProductVideo';

// 场景短片：点击进入商品页
const Films = ({ skip }) => {
  const { products, tr, lang, price } = useStore();
  const items = (products ?? []).filter((p) => p.video_url && p.id !== skip).slice(0, 4);
  if (!items.length) return null;
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: { xs: 4, md: 6 } }}>
      <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 36 } }}>{tr.filmsTitle}</Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>{tr.filmsSub}</Typography>
      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        {items.map((p) => {
          const v = videoOf(p);
          return (
            <Grid key={p.id} size={{ xs: 12, sm: 6, md: items.length === 3 ? 4 : 6 }}>
              <Box component={RouterLink} to={`/p/${p.id}`} sx={{ display: 'block', position: 'relative', borderRadius: '16px', overflow: 'hidden', textDecoration: 'none', color: '#fff',
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
                <AutoVideo src={v.src} poster={v.poster} />
                <Box sx={{ position: 'absolute', inset: 'auto 0 0 0', p: { xs: 1.75, md: 2.5 }, pt: 6,
                  background: 'linear-gradient(transparent, rgba(0,0,0,.55))', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
                  <Typography sx={{ fontWeight: 500, fontSize: { xs: 16, md: 18 }, lineHeight: 1.3 }}>{productName(p, lang)}</Typography>
                  <Typography sx={{ fontWeight: 500, whiteSpace: 'nowrap', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
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

// 首屏：左文右片的非对称布局；右侧是一支真实的商品场景短片（首页的「亮点」），点进商品页
const HeroFilm = ({ p }) => {
  const { lang, price } = useStore();
  if (!p) return <Skeleton variant="rounded" sx={{ aspectRatio: '16 / 9', height: 'auto', borderRadius: '16px' }} />;
  const v = videoOf(p);
  return (
    <Box component={RouterLink} to={`/p/${p.id}`} sx={{ display: 'block', textDecoration: 'none', color: 'text.primary',
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 4, borderRadius: '16px' } }}>
      <Box sx={{ borderRadius: '16px', overflow: 'hidden' }}><AutoVideo src={v.src} poster={v.poster} /></Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 2, mt: 1.5, px: 0.5 }}>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{productName(p, lang)}</Typography>
        <Typography sx={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{price(priceFrom(p))}</Typography>
      </Stack>
    </Box>
  );
};

export const Home = () => {
  const { products, tr } = useStore();
  const [cat, setCat] = useState('all');
  const list = (products ?? []).filter((p) => cat === 'all' || p.category === cat);
  const lead = products?.find((p) => p.video_url);

  return (
    <Box>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: { xs: 6, md: 10 }, pb: { xs: 6, md: 8 } }}>
        <Grid container spacing={{ xs: 5, md: 6 }} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: 36, sm: 44, md: 52 }, lineHeight: 1.08, whiteSpace: 'pre-line', letterSpacing: '-.02em' }}>{tr.heroTitle}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 18 }, lineHeight: 1.6, maxWidth: 440, mt: 2.5, mb: 4 }}>{tr.heroSub}</Typography>
            <Button size="large" variant="contained" href="#products" sx={{ px: 3, height: 48 }}>{tr.shopNow}</Button>
          </Grid>
          {(lead || !products) && <Grid size={{ xs: 12, md: 7 }}><HeroFilm p={lead} /></Grid>}
        </Grid>
        <Perks sx={{ mt: { xs: 5, md: 8 }, pt: 3, borderTop: 1, borderColor: 'divider' }} />
      </Box>

      <Films skip={lead?.id} />

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
