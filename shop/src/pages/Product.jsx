import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Grid, Stack, Button, Chip, Skeleton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import { useStore, activeSkus, optionLabel } from '../store';
import { productTitle, productName, productDesc, productBullets } from '../i18n';
import { ProductArt, AddButton, ProductCard, Perks } from '../components/ui';
import { ImageZoom, Thumbs } from '../components/ImageZoom';
import { AutoVideo, videoOf } from '../components/ProductVideo';
import { applySeo, productMeta } from '../seo';

// ---------- 规格选择 ----------
const SEP = ' / ';
const COLLAPSE_AT = 12;
const chipSx = { height: 'auto', minHeight: 38, maxWidth: '100%', px: 0.5, fontSize: 14, borderRadius: '8px',
  '& .MuiChip-label': { whiteSpace: 'normal', py: 0.75, lineHeight: 1.35 } };

const OptionChips = ({ values, selected, onSelect, isAvailable = () => true }) => {
  const { tr } = useStore();
  const [all, setAll] = useState(false);
  const idx = values.indexOf(selected);
  const shown = all || values.length <= COLLAPSE_AT || idx >= COLLAPSE_AT ? values : values.slice(0, COLLAPSE_AT);
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
      {shown.map((v) => (
        <Chip key={v} label={v} onClick={() => onSelect(v)} clickable
          color={v === selected ? 'primary' : 'default'} variant={v === selected ? 'filled' : 'outlined'}
          sx={{ ...chipSx, opacity: v === selected || isAvailable(v) ? 1 : 0.45 }} />
      ))}
      {values.length > COLLAPSE_AT && idx < COLLAPSE_AT && (
        <Button size="small" onClick={() => setAll((x) => !x)} sx={{ borderRadius: '8px', minHeight: 38 }}>
          {all ? tr.showLess : `+${values.length - COLLAPSE_AT}`}
        </Button>
      )}
    </Stack>
  );
};

// 多维规格（option_name 形如「颜色 / 尺码」）按维度分组选择；否则平铺，超过 12 个折叠
const VariantPicker = ({ p, skus, sku, lang, onPick }) => {
  const dims = optionLabel(p.option_name, lang).split(SEP);
  const partsOf = (k) => optionLabel(k.option_value, lang).split(SEP);
  const multi = dims.length > 1 && skus.every((k) => partsOf(k).length === dims.length);
  const cur = sku ? partsOf(sku) : [];

  if (!multi) {
    const label = (k) => optionLabel(k.option_value, lang);
    return (
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 14, mb: 1 }}>{optionLabel(p.option_name, lang)}: <b>{sku && label(sku)}</b></Typography>
        <OptionChips values={skus.map(label)} selected={sku && label(sku)} onSelect={(v) => onPick(skus.find((k) => label(k) === v))} />
      </Box>
    );
  }
  // 选某一维的值：优先保持其它维度不变；没有这个组合时取该值的第一个规格
  const choose = (i, v) => {
    const want = cur.map((x, j) => (j === i ? v : x));
    onPick(skus.find((k) => partsOf(k).every((x, j) => x === want[j])) ?? skus.find((k) => partsOf(k)[i] === v));
  };
  const available = (i, v) => skus.some((k) => partsOf(k).every((x, j) => (j === i ? x === v : x === cur[j])));
  return (
    <Box sx={{ mb: 3, display: 'grid', gap: 2 }}>
      {dims.map((d, i) => {
        const values = [...new Set(skus.map((k) => partsOf(k)[i]))];
        return (
          <Box key={d}>
            <Typography sx={{ fontSize: 14, mb: 1 }}>{d}: <b>{cur[i]}</b></Typography>
            <OptionChips values={values} selected={cur[i]} onSelect={(v) => choose(i, v)} isAvailable={(v) => available(i, v)} />
          </Box>
        );
      })}
    </Box>
  );
};

export const Product = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { products, lang, price, tr } = useStore();
  const p = products?.find((x) => String(x.id) === id);
  useEffect(() => { if (p) applySeo(productMeta(p, lang)); }, [p, lang]);
  const skus = activeSkus(p);
  // ?sku= 预选规格（ERP 里点「在独立站查看」会带上）
  const [skuId, setSkuId] = useState(null);
  const [hoverSrc, setHoverSrc] = useState(null);   // 悬停缩略图时临时预览
  const [playing, setPlaying] = useState(false);    // 主图位置播放场景短片
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
  const pick = (k) => { setPlaying(false); setSkuId(k.id); setParams({ sku: String(k.id) }, { replace: true }); };
  const film = videoOf(p);
  // 图集：各 SKU 的不同图片（颜色规格有独立图），没有则只有商品主图
  const mainSrc = sku?.image_url || p.image_url;
  const gallery = [];
  for (const k of skus) {
    const src = k.image_url || p.image_url;
    if (src && !gallery.some((g) => g.src === src)) gallery.push({ src, sku: k, label: optionLabel(k.option_value, lang) });
  }
  // 场景短片排在图集第二位（主图之后）
  if (film) gallery.splice(1, 0, { src: film.poster, video: true, label: tr.watchVideo });

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2, pt: 3 }}>
      <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2 }}>{tr.back}</Button>
      <Grid container spacing={{ xs: 3, md: 6 }}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ position: 'relative', zIndex: 5 }}>
          {mainSrc ? (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', md: 'row' }, gap: 1.5, alignItems: 'flex-start' }} onMouseLeave={() => setHoverSrc(null)}>
              {gallery.length > 1 && (
                <Thumbs items={gallery} activeSrc={hoverSrc ?? (playing ? film?.poster : mainSrc)} onHover={(it) => setHoverSrc(it.src)}
                  onPick={(it) => { setHoverSrc(null); if (it.video) setPlaying(true); else if (it.sku) pick(it.sku); else setPlaying(false); }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                {playing && !hoverSrc && film
                  ? <Box sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: '16px', overflow: 'hidden', display: 'grid', alignItems: 'center', bgcolor: '#111' }}>
                      {/* 16:9 短片放进方形主图位：用封面模糊放大做背景，避免黑边 */}
                      <Box component="img" src={film.poster} alt="" aria-hidden
                        sx={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: 'blur(28px) brightness(.85)' }} />
                      <AutoVideo src={film.src} poster={film.poster} controls sx={{ position: 'relative', bgcolor: 'transparent', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }} />
                    </Box>
                  : <ImageZoom src={hoverSrc ?? mainSrc} alt={productName(p, lang)} />}
              </Box>
            </Box>
          ) : <ProductArt p={p} size="lg" sx={{ borderRadius: '16px' }} />}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>{tr.cats[p.category]}</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 38 }, lineHeight: 1.2 }}>{productTitle(p, lang)}</Typography>
          {productTitle(p, lang) !== productName(p, lang) && <Typography sx={{ color: 'text.secondary', mt: 1 }}>{productName(p, lang)}</Typography>}
          <Typography sx={{ fontFamily: 'var(--display)', fontSize: 32, fontWeight: 500, fontVariantNumeric: 'tabular-nums', my: 2.5 }}>{price(sku?.price_usd ?? p.price_usd)}</Typography>

          {skus.length > 1 && <VariantPicker p={p} skus={skus} sku={sku} lang={lang} tr={tr} onPick={pick} />}

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'success.main', mb: 3 }}><CheckIcon fontSize="small" /><Typography sx={{ fontSize: 14 }}>{tr.inStock} · {tr.fastShip}</Typography></Stack>
          <AddButton product={p} skuId={sku?.id} size="large" />
          {bullets.length > 0 && (
            <Box component="ul" sx={{ pl: 2.5, mt: 4, '& li': { mb: 1, color: 'text.primary', fontSize: 15 } }}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</Box>
          )}
          <Typography sx={{ color: 'text.secondary', mt: bullets.length ? 2 : 4, whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{productDesc(p, lang)}</Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 3, fontSize: 14, color: 'text.secondary', flexWrap: 'wrap' }}>
            <span>{tr.sku}: <Box component="span" sx={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{sku?.sku ?? p.sku}</Box></span><span>{tr.weight}: {p.weight_g} g</span>
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
