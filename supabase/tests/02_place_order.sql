-- 独立站下单：匿名访客可下单，金额 / 币种 / 库存正确；各种非法输入被拒绝
begin;
do $$
declare v_sku bigint; v_qty int;
begin
  select s.id into v_sku from skus s join products p on p.id = s.product_id
  where s.status = 'active' and p.status = 'active' order by s.id limit 1;
  select i.qty into v_qty from inventory i join warehouses w on w.id = i.warehouse_id
  where i.sku_id = v_sku and w.kind = 'overseas' order by w.id limit 1;
  perform set_config('test.sku', v_sku::text, true);
  perform set_config('test.qty_before', coalesce(v_qty, -1)::text, true);
end $$;

set local role anon;
do $$
declare v_no text;
begin
  v_no := public.place_order(jsonb_build_array(jsonb_build_object('sku_id', current_setting('test.sku')::bigint, 'qty', 2)),
                             '{"name":"Test Buyer","email":"buyer@example.com","country":"DE"}', 'eur');
  assert v_no ~ '^WV[0-9]{12}$', '订单号格式: ' || v_no;
  perform set_config('test.order_no', v_no, true);

  perform t.throws($q$ select public.place_order('[]', '{"name":"A","email":"a@b.co","country":"US"}') $q$, '%1-10%');
  perform t.throws(format($q$ select public.place_order('[{"sku_id":%s,"qty":11}]', '{"name":"A","email":"a@b.co","country":"US"}') $q$, current_setting('test.sku')), '%1-10%');
  perform t.throws(format($q$ select public.place_order('[{"sku_id":%s,"qty":1}]', '{"name":"A","email":"bad","country":"US"}') $q$, current_setting('test.sku')), '%收货人信息%');
  perform t.throws(format($q$ select public.place_order('[{"sku_id":%s,"qty":1}]', '{"name":"A","email":"a@b.co","country":"US"}', 'XXX') $q$, current_setting('test.sku')), '%不支持的币种%');
  perform t.throws($q$ select public.place_order('[{"sku_id":999999,"qty":1}]', '{"name":"A","email":"a@b.co","country":"US"}') $q$, '%不存在或已下架%');
  -- 访客看不到订单表（RLS）
  assert (select count(*) from orders) = 0, '匿名访客不应读到订单';
end $$;
reset role;

do $$
declare o record; v_price numeric; v_rate numeric; v_qty int;
begin
  select * into o from orders where order_no = current_setting('test.order_no');
  select price_usd into v_price from skus where id = current_setting('test.sku')::bigint;
  select rate_to_usd into v_rate from exchange_rates where currency = 'EUR';
  assert o.status = 'paid' and o.source = 'site' and o.currency = 'EUR' and o.country = 'DE', '订单状态 / 来源 / 币种';
  assert o.total_usd = round(v_price * 2, 2), format('total_usd %s <> %s', o.total_usd, round(v_price * 2, 2));
  assert o.total_amount = round(v_price * 2 / v_rate, 2), format('total_amount %s', o.total_amount);
  assert (select count(*) from order_items where order_id = o.id) = 1, '1 条订单明细';
  assert public.track_order(o.order_no)->>'status' = 'paid', 'track_order 可查到';
  assert public.track_order('WV000000000000') is null, '不存在的订单号返回 null';
  if current_setting('test.qty_before')::int >= 2 then
    select i.qty into v_qty from inventory i join warehouses w on w.id = i.warehouse_id
    where i.sku_id = current_setting('test.sku')::bigint and w.kind = 'overseas' order by w.id limit 1;
    assert v_qty = current_setting('test.qty_before')::int - 2, '海外仓库存扣减 2';
  end if;
end $$;
rollback;
