-- AI 运营助手：只读查询函数、调用配额、多语言 Listing

-- 商品多语言 Listing：{"de": {"title": "...", "bullets": [...], "description": "..."}, ...}
alter table public.products add column if not exists listing jsonb not null default '{}'::jsonb;

-- ========== 调用配额（只允许服务端访问） ==========
create table if not exists public.ai_usage (
  user_id  uuid not null,
  day      date not null default (now() at time zone 'Asia/Shanghai')::date,
  count    int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;   -- 不建策略：前端无法读写

create or replace function public.ai_take_quota(p_user uuid, p_user_limit int default 30, p_global_limit int default 1500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Shanghai')::date;
  v_user int; v_total int;
begin
  select coalesce(sum(count), 0) into v_total from ai_usage where day = v_day;
  if v_total >= p_global_limit then
    return jsonb_build_object('ok', false, 'reason', 'global', 'used', v_total);
  end if;
  insert into ai_usage (user_id, day, count) values (p_user, v_day, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1
  returning count into v_user;
  if v_user > p_user_limit then
    update ai_usage set count = count - 1 where user_id = p_user and day = v_day;
    return jsonb_build_object('ok', false, 'reason', 'user', 'used', v_user - 1, 'limit', p_user_limit);
  end if;
  return jsonb_build_object('ok', true, 'used', v_user, 'limit', p_user_limit);
end $$;
revoke execute on function public.ai_take_quota(uuid, int, int) from public, anon, authenticated;

-- ========== 只读分析函数（security invoker：按调用者身份走 RLS） ==========
create or replace function public.ai_sales_summary(p_start date, p_end date, p_group text default 'platform')
returns table (label text, orders bigint, gmv_usd numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select case p_group
           when 'country'  then o.country
           when 'shop'     then s.name
           when 'day'      then to_char(o.created_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD')
           when 'week'     then to_char(date_trunc('week', o.created_at at time zone 'Asia/Shanghai'), 'YYYY-MM-DD')
           when 'status'   then o.status
           else s.platform end as label,
         count(*)                       as orders,
         round(sum(o.total_usd), 2)     as gmv_usd
  from orders o join shops s on s.id = o.shop_id
  where (o.created_at at time zone 'Asia/Shanghai')::date between p_start and p_end
    and (p_group = 'status' or o.status not in ('cancelled', 'refunded'))
  group by 1
  order by case when p_group in ('day', 'week') then 1 else 0 end, 3 desc, 1;
$$;

create or replace function public.ai_top_products(p_start date, p_end date, p_country text default null,
                                                  p_platform text default null, p_limit int default 5)
returns table (product_id bigint, sku text, name text, category text, qty bigint, gmv_usd numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.sku, p.name->>'zh', p.category, sum(i.qty), round(sum(i.qty * p.price_usd), 2)
  from order_items i
  join orders o   on o.id = i.order_id
  join shops s    on s.id = o.shop_id
  join products p on p.id = i.product_id
  where (o.created_at at time zone 'Asia/Shanghai')::date between p_start and p_end
    and o.status not in ('cancelled', 'refunded')
    and (p_country  is null or o.country = upper(p_country))
    and (p_platform is null or s.platform = lower(p_platform))
  group by 1, 2, 3, 4
  order by 6 desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke execute on function public.ai_sales_summary(date, date, text), public.ai_top_products(date, date, text, text, int) from public, anon;
grant  execute on function public.ai_sales_summary(date, date, text), public.ai_top_products(date, date, text, text, int) to authenticated;
