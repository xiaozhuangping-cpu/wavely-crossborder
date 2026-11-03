-- 颜色规格图：颜色类 SKU 使用各自的白底图（文件名 = SKU 编码），其余规格沿用商品主图
create or replace function public.seed_skus() returns void
language plpgsql security definer set search_path = public as $$
declare base text := 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/products/';
begin
  insert into skus (product_id, sku, option_value, barcode, price_usd, cost_cny, weight_g, sort)
  select p.id, p.sku || '-' || v.code,
         jsonb_build_object('zh', v.v_zh, 'en', v.v_en, 'de', v.v_de),
         ean13('69' || lpad(p.id::text, 4, '0') || lpad((row_number() over (order by p.id, v.sort))::text, 6, '0')),
         p.price_usd + v.delta, round(p.cost_cny + v.delta * 0.35 * 7.2, 2), p.weight_g + (v.delta * 15)::int, v.sort
  from products p join demo_variants v on v.spu = p.sku;
  update products p set option_name = dim_name((select dim from demo_variants v where v.spu = p.sku limit 1)),
                        image_url = base || p.sku || '.jpg';
  update skus s set image_url = base || s.sku || '.jpg'
  from products p, demo_variants v
  where p.id = s.product_id and v.spu = p.sku and s.sku = p.sku || '-' || v.code and v.dim = 'color';
end $$;
revoke execute on function public.seed_skus() from public, anon;

-- 立即应用到当前数据
update public.skus s set image_url = 'https://xiaozhuangping-cpu.github.io/wavely-crossborder/shop/products/' || s.sku || '.jpg'
from public.products p, public.demo_variants v
where p.id = s.product_id and v.spu = p.sku and s.sku = p.sku || '-' || v.code and v.dim = 'color';
