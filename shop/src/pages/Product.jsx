import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Grid, Stack, Button, Chip, Skeleton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import { useStore, activeSkus, optionLabel } from '../store';
import { productTitle, productName, productDesc, productBullets } from '../i18n';
import { ProductArt, AddButton, ProductCard, Perks } from '../components/ui';

export const Product = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { products, lang, price, tr } = useStore();
  const p = products?.find((x) => String(x.id) === id);
  const skus = activeSkus(p);
  // ?sku= 预选规格（ERP 里点「在独立站查看」会带上）
  const [skuId, setSkuId] = useState(null);
  useEffect(() => {
    if (!skus.length) return;
    const fromUrl = Number(params.get('sku'));
    setSkuId(skus.some((k) => k.id === fromUrl) ? fromUrl : skus[0].id);
  }, [p?.id, skus.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!products) return <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}><Skeleton variant="rounded" height={480} /></Box>;
  if (!p) return <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}><Typography>404</Typography></Box>;
  const sku = skus.find((k) => k.id === skuId) ?? skus[0];
  const bullets = productBullets(p, lang);
  const related = products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  const pick = (k) => { setSkuId(k.id); setParams({ sku: String(k.id) }, { replace: true }); };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: 3 }}>
      <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2 }}>{tr.back}</Button>
      <Grid container spacing={{ xs: 3, md: 6 }}>
        <Grid size={{ xs: 12, md: 6 }}><ProductArt p={p} src={sku?.image_url} size="lg" sx={{ borderRadius: 5 }} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Chip size="small" label={tr.cats[p.category]} sx={{ mb: 2 }} />
          <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2 }}>{productTitle(p, lang)}</Typography>
          {productTitle(p, lang) !== productName(p, lang) && <Typography sx={{ color: 'text.secondary', mt: 1 }}>{productName(p, lang)}</Typography>}
          <Typography sx={{ fontFamily: 'var(--display)', fontSize: 34, fontWeight: 600, color: 'primary.main', my: 2.5 }}>{price(sku?.price_usd ?? p.price_usd)}</Typography>

          {skus.length > 1 && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: 14, mb: 1 }}>
                {optionLabel(p.option_name, lang)}: <b>{optionLabel(sku?.option_value, lang)}</b>
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {skus.map((k) => (
                  <Chip key={k.id} label={optionLabel(k.option_value, lang)} onClick={() => pick(k)} clickable
                    color={k.id === sku?.id ? 'primary' : 'default'} variant={k.id === sku?.id ? 'filled' : 'outlined'}
                    sx={{ height: 38, px: 0.5, fontSize: 14, borderRadius: 2 }} />
                ))}
              </Stack>
            </Box>
          )}

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'success.main', mb: 3 }}><CheckIcon fontSize="small" /><Typography sx={{ fontSize: 14 }}>{tr.inStock} · {tr.fastShip}</Typography></Stack>
          <AddButton product={p} skuId={sku?.id} size="large" />
          {bullets.length > 0 && (
            <Box component="ul" sx={{ pl: 2.5, mt: 4, '& li': { mb: 1, color: 'text.primary', fontSize: 15 } }}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</Box>
          )}
          <Typography sx={{ color: 'text.secondary', mt: bullets.length ? 2 : 4, whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{productDesc(p, lang)}</Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 3, fontSize: 14, color: 'text.secondary', flexWrap: 'wrap' }}>
            <span>{tr.sku}: {sku?.sku ?? p.sku}</span><span>{tr.weight}: {p.weight_g} g</span>
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
