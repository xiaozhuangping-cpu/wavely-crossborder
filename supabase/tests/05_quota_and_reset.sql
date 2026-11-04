-- AI 配额与每日重置
begin;
do $$
declare u uuid := gen_random_uuid(); r jsonb;
begin
  r := public.ai_take_quota(u, 2, 100); assert (r->>'ok')::boolean and (r->>'used')::int = 1, '第 1 次';
  r := public.ai_take_quota(u, 2, 100); assert (r->>'ok')::boolean and (r->>'used')::int = 2, '第 2 次';
  r := public.ai_take_quota(u, 2, 100); assert not (r->>'ok')::boolean and r->>'reason' = 'user', '超过个人额度';
  assert (select count from ai_usage where user_id = u) = 2, '超额不计数';
  r := public.ai_take_quota(gen_random_uuid(), 30, 2); assert not (r->>'ok')::boolean and r->>'reason' = 'global', '超过全站额度';
end $$;

-- 重置：采集箱与导入商品清空、演示视频补回、过期匿名用户删除
insert into auth.users (is_anonymous, created_at) values (true, now() - interval '2 days'), (true, now()), (false, now() - interval '9 days');
set local role authenticated;
select public.import_draft((public.collect_offer('{"offerId":"987654321","title":"x","skus":[{"price":1}]}')->>'id')::bigint,
  '{"name":{"zh":"临时商品"},"category":"家居","skus":[{"cost_cny":1,"price_usd":3}]}');
reset role;
update products set video_url = null;
select public.reset_demo();
do $$ begin
  assert (select count(*) from import_drafts) = 0, '采集箱已清空';
  assert (select count(*) from products) = 16 and not exists (select 1 from products where sku like 'WV-1688-%'), '恢复为 16 个演示商品';
  assert (select count(*) from products where video_url is not null) = 4, '演示视频已补回';
  assert (select count(*) from orders where starred) = 12, '星标订单';
  assert (select count(*) from auth.users) = 2, '只删除 1 天前的匿名用户';
end $$;
rollback;
