-- RLS：匿名访客只能读在售商品 / 店铺 / 汇率；不能写 ERP 数据、不能读采集箱与订单
begin;
update products set status = 'draft' where id = (select min(id) from products);
set local role anon;
do $$ begin
  assert (select count(*) from products where status <> 'active') = 0, '匿名访客看不到草稿商品';
  assert (select count(*) from products) = 15, '匿名访客能看到 15 个在售商品';
  assert (select count(*) from shops) > 0 and (select count(*) from exchange_rates) > 0, '店铺与汇率公开';
  assert (select count(*) from orders) = 0 and (select count(*) from customers) = 0, '订单与客户不公开';
  assert (select count(*) from import_drafts) = 0, '采集箱不公开';
  update products set price_usd = 0.01;     -- RLS 无更新策略：静默更新 0 行
  assert not found, '匿名访客的更新应影响 0 行';
  perform t.throws($q$ insert into products (sku, name, category, cost_cny, price_usd) values ('X', '{}', '家居', 1, 1) $q$, '%row-level security%');
  perform t.throws($q$ select public.reset_demo() $q$, '%permission denied%');
  perform t.throws($q$ select public.ai_take_quota(gen_random_uuid()) $q$, '%permission denied%');
end $$;
reset role;

set local role authenticated;
do $$ begin
  assert (select count(*) from products) = 16, '登录访客可读全部商品（含草稿）';
  assert (select count(*) from orders) > 0, '登录访客可读订单';
  perform t.throws($q$ select public.reset_demo() $q$, '%permission denied%');
end $$;
rollback;
