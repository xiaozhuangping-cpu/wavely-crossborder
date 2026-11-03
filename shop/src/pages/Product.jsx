import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Grid, Stack, Button, Chip, Skeleton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import { useStore } from '../store';
import { productTitle, productName, productDesc, productBullets } from '../i18n';
import { ProductArt, AddButton, ProductCard, Perks } from '../components/ui';

export const Product = () => {
  const { id } = useParams();
  const { products, lang, price, tr } = useStore();
  const p = products?.find((x) => String(x.id) === id);
  if (!products) return <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}><Skeleton variant="rounded" height={480} /></Box>;
  if (!p) return <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}><Typography>404</Typography></Box>;
  const bullets = productBullets(p, lang);
  const related = products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: 3 }}>
      <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2 }}>{tr.back}</Button>
      <Grid container spacing={{ xs: 3, md: 6 }}>
        <Grid size={{ xs: 12, md: 6 }}><ProductArt p={p} size="lg" sx={{ borderRadius: 5 }} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Chip size="small" label={tr.cats[p.category]} sx={{ mb: 2 }} />
          <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2 }}>{productTitle(p, lang)}</Typography>
          {productTitle(p, lang) !== productName(p, lang) && <Typography sx={{ color: 'text.secondary', mt: 1 }}>{productName(p, lang)}</Typography>}
          <Typography sx={{ fontFamily: 'var(--display)', fontSize: 34, fontWeight: 600, color: 'primary.main', my: 2.5 }}>{price(p.price_usd)}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'success.main', mb: 3 }}><CheckIcon fontSize="small" /><Typography sx={{ fontSize: 14 }}>{tr.inStock} · {tr.fastShip}</Typography></Stack>
          <AddButton id={p.id} size="large" />
          {bullets.length > 0 && (
            <Box component="ul" sx={{ pl: 2.5, mt: 4, '& li': { mb: 1, color: 'text.primary', fontSize: 15 } }}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</Box>
          )}
          <Typography sx={{ color: 'text.secondary', mt: bullets.length ? 2 : 4, whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{productDesc(p, lang)}</Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 3, fontSize: 14, color: 'text.secondary' }}>
            <span>{tr.sku}: {p.sku}</span><span>{tr.weight}: {p.weight_g} g</span>
          </Stack>
          <Box sx={{ mt: 4 }}><Perks /></Box>
        </Grid>
      </Grid>
      {related.length > 0 && (
        <Box sx={{ mt: 8 }}>
          <Typography variant="h2" sx={{ fontSize: 26, mb: 2 }}>{tr.cats[p.category]}</Typography>
          <Grid container spacing={2}>{related.map((r) => <Grid key={r.id} size={{ xs: 6, md: 3 }}><ProductCard p={r} /></Grid>)}</Grid>
        </Box>
      )}
    </Box>
  );
};
