-- 演示数据完整性：每个在售 SPU 都有在售 SKU，条码校验位正确，SPU 价格 = 在售 SKU 最低价
begin;
do $$
declare n int;
begin
  assert (select count(*) from products) = 16, 'seed: 16 个 SPU';
  select count(*) into n from products p where p.status = 'active'
    and not exists (select 1 from skus s where s.product_id = p.id and s.status = 'active');
  assert n = 0, format('有 %s 个在售 SPU 没有在售 SKU', n);

  assert public.ean13('400638133393') = '4006381333931', 'ean13 校验位';
  select count(*) into n from skus where barcode is not null and barcode <> public.ean13(left(barcode, 12));
  assert n = 0, format('有 %s 个 SKU 条码校验位错误', n);

  select count(*) into n from products p
  where p.price_usd <> (select min(price_usd) from skus s where s.product_id = p.id and s.status = 'active');
  assert n = 0, format('有 %s 个 SPU 售价不等于在售 SKU 最低价', n);

  assert (select count(*) from products where video_url is not null) = 4, '4 条演示视频';
  assert (select count(*) from orders) > 100, '演示订单已生成';
end $$;
rollback;
