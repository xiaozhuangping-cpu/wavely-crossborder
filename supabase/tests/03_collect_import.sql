-- 1688 采集箱：去重写入、导入为 SPU + SKU、状态流转与校验
begin;
set local role authenticated;
do $$
declare r jsonb; v_id bigint; v_pid bigint; p record;
  payload jsonb := '{"offerId":"755330008177","title":"牛奶丝布","images":["https://cbu01.alicdn.com/a.jpg"],"priceMin":4.5,"priceMax":5,"supplier":"某纺织厂",
                     "skus":[{"specText":"纯白","price":4.5},{"specText":"本白","price":5}]}';
begin
  r := public.collect_offer(payload);
  v_id := (r->>'id')::bigint;
  assert r->>'status' = 'new', '新采集为 new';
  assert (public.collect_offer(payload)->>'id')::bigint = v_id, '重复采集同一 offerId 不新增';
  assert (select count(*) from import_drafts where source_id = '755330008177') = 1, '只有一条';
  assert (select sku_count from import_drafts where id = v_id) = 2 and (select price_max from import_drafts where id = v_id) = 5, '摘要字段';

  perform t.throws($q$ select public.collect_offer('{"offerId":"abc","title":"x"}') $q$, '%无效的 1688 商品 ID%');
  perform t.throws($q$ select public.collect_offer('{"offerId":"123456789"}') $q$, '%缺少商品标题%');
  perform t.throws(format($q$ select public.import_draft(%s, '{"name":{"zh":"x"},"category":"服装","skus":[{"cost_cny":1,"price_usd":2}]}') $q$, v_id), '%请选择类目%');
  perform t.throws(format($q$ select public.import_draft(%s, '{"name":{"zh":"x"},"category":"家居","skus":[]}') $q$, v_id), '%至少保留一个%');
  perform t.throws(format($q$ select public.import_draft(%s, '{"name":{"zh":"x"},"category":"家居","status":"archived","skus":[{"cost_cny":1,"price_usd":2}]}') $q$, v_id), '%无效的商品状态%');
  perform t.throws(format($q$ select public.import_draft(%s, '{"name":{"zh":"x"},"category":"家居","skus":[{"cost_cny":1,"price_usd":0}]}') $q$, v_id), '%价格无效%');

  v_pid := public.import_draft(v_id, '{"name":{"zh":"牛奶丝背景布","en":"Milk Silk Fabric"},"category":"家居","option_name":{"zh":"颜色","en":"Color"},
    "skus":[{"option_value":{"zh":"纯白","en":"Pure White"},"cost_cny":4.5,"price_usd":10.99,"weight_g":200},
            {"option_value":{"zh":"本白"},"cost_cny":5,"price_usd":9.99,"weight_g":220}]}');
  select * into p from products where id = v_pid;
  assert p.sku = 'WV-1688-755330008177' and p.status = 'active', '默认直接上架，SPU 编码';
  assert p.source_url = 'https://detail.1688.com/offer/755330008177.html', '货源链接';
  assert p.price_usd = 9.99 and p.weight_g = 220, 'SPU 价格取 SKU 最低价、重量取最大';
  assert p.name->>'en' = 'Milk Silk Fabric' and p.option_name->>'en' = 'Color', '多语言字段原样保存';
  assert (select string_agg(sku, ',' order by sort) from skus where product_id = v_pid)
         = 'WV-1688-755330008177-01,WV-1688-755330008177-02', 'SKU 编码与顺序';
  assert (select status from import_drafts where id = v_id) = 'imported', '采集记录标记为已导入';
  perform t.throws(format($q$ select public.import_draft(%s, '{"name":{"zh":"x"},"category":"家居","skus":[{"cost_cny":1,"price_usd":2}]}') $q$, v_id), '%已导入%');
  assert public.collect_offer(payload)->>'status' = 'imported', '重新采集不改变已导入状态';

  update import_drafts set status = 'discarded' where id = v_id;
  assert public.collect_offer(payload)->>'status' = 'new', '丢弃后重新采集恢复为待处理';
end $$;
reset role;

set local role anon;
do $$ begin
  perform t.throws($q$ select public.collect_offer('{"offerId":"123456789","title":"x"}') $q$, '%permission denied%');
  perform t.throws($q$ select public.import_draft(1, '{}') $q$, '%permission denied%');
end $$;
rollback;
