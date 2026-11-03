-- 1688 采集：浏览器插件把商品写入「采集箱」，在 ERP 里审核、定价后转为草稿商品
-- 数据随每日 reset_demo 一起清空（products 被 truncate cascade 时，引用它的 import_drafts 一并清空）

alter table public.products add column if not exists source_url text;   -- 货源链接

create table if not exists public.import_drafts (
  id          bigint generated always as identity primary key,
  source      text not null default '1688' check (source in ('1688')),
  source_id   text not null,                      -- 1688 offerId
  source_url  text not null,
  title       text not null,
  image_url   text,
  price_min   numeric(12,2),                      -- 人民币
  price_max   numeric(12,2),
  sku_count   int  not null default 0,
  supplier    text,
  data        jsonb not null,                     -- 插件解析的完整数据（规格、图片、属性…）
  status      text not null default 'new' check (status in ('new','imported','discarded')),
  product_id  bigint references public.products(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists import_drafts_status_idx on public.import_drafts (status, updated_at desc);

alter table public.import_drafts enable row level security;
drop policy if exists "erp_all" on public.import_drafts;
create policy "erp_all" on public.import_drafts for all to authenticated using (true) with check (true);

-- 插件调用：写入或更新采集箱。重复采集同一商品只刷新数据，不改变已导入/已丢弃状态
create or replace function public.collect_offer(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id bigint; v_offer text := p->>'offerId'; v_status text;
begin
  if v_offer is null or v_offer !~ '^\d{6,20}$' then raise exception '无效的 1688 商品 ID'; end if;
  if coalesce(p->>'title', '') = '' then raise exception '缺少商品标题'; end if;
  if pg_column_size(p) > 300000 then raise exception '数据过大'; end if;

  insert into import_drafts (source, source_id, source_url, title, image_url, price_min, price_max, sku_count, supplier, data)
  values ('1688', v_offer, 'https://detail.1688.com/offer/' || v_offer || '.html',
          left(p->>'title', 200), left(p->'images'->>0, 500),
          nullif(p->>'priceMin', '')::numeric, nullif(p->>'priceMax', '')::numeric,
          coalesce(jsonb_array_length(p->'skus'), 0), left(p->>'supplier', 120), p)
  on conflict (source, source_id) do update set
    title = excluded.title, image_url = excluded.image_url, price_min = excluded.price_min, price_max = excluded.price_max,
    sku_count = excluded.sku_count, supplier = excluded.supplier, data = excluded.data, updated_at = now(),
    status = case when import_drafts.status = 'discarded' then 'new' else import_drafts.status end
  returning id, status into v_id, v_status;
  return jsonb_build_object('id', v_id, 'status', v_status);
end $$;
revoke execute on function public.collect_offer(jsonb) from public, anon;
grant execute on function public.collect_offer(jsonb) to authenticated;

-- ERP 调用：把采集箱里的一条转为草稿商品 + SKU（一个事务）
-- p = {name:{zh,en}, category, option_name:{zh,en}, image_url, description:{zh},
--      skus:[{option_value:{zh}, cost_cny, price_usd, weight_g, image_url}]}
create or replace function public.import_draft(p_draft bigint, p jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  d import_drafts; v_pid bigint; v_spu text; s jsonb; i int := 0; n int;
begin
  select * into d from import_drafts where id = p_draft for update;
  if not found then raise exception '采集记录不存在'; end if;
  if d.product_id is not null then raise exception '该商品已导入（商品 ID %）', d.product_id; end if;
  n := coalesce(jsonb_array_length(p->'skus'), 0);
  if n = 0 then raise exception '至少保留一个 SKU'; end if;
  if n > 100 then raise exception 'SKU 过多（最多 100 个）'; end if;
  if coalesce(p->'name'->>'zh', '') = '' then raise exception '请填写中文名'; end if;
  if (p->>'category') not in ('家居','户外','宠物','美妆','数码配件') then raise exception '请选择类目'; end if;

  v_spu := 'WV-1688-' || d.source_id;
  insert into products (sku, name, description, category, image_url, cost_cny, price_usd, weight_g, status, option_name, source_url)
  values (v_spu, p->'name', coalesce(p->'description', '{}'::jsonb), p->>'category', left(p->>'image_url', 500),
          (select min((x->>'cost_cny')::numeric) from jsonb_array_elements(p->'skus') x),
          (select min((x->>'price_usd')::numeric) from jsonb_array_elements(p->'skus') x),
          coalesce((select max((x->>'weight_g')::int) from jsonb_array_elements(p->'skus') x), 500),
          'draft', coalesce(p->'option_name', '{}'::jsonb), d.source_url)
  returning id into v_pid;

  for s in select * from jsonb_array_elements(p->'skus') loop
    i := i + 1;
    if (s->>'price_usd')::numeric <= 0 or (s->>'cost_cny')::numeric < 0 then raise exception '第 % 个 SKU 价格无效', i; end if;
    insert into skus (product_id, sku, option_value, price_usd, cost_cny, weight_g, image_url, status, sort)
    values (v_pid, v_spu || '-' || lpad(i::text, 2, '0'), coalesce(s->'option_value', '{}'::jsonb),
            round((s->>'price_usd')::numeric, 2), round((s->>'cost_cny')::numeric, 2),
            greatest(coalesce((s->>'weight_g')::int, 500), 1), left(s->>'image_url', 500), 'active', i);
  end loop;

  update import_drafts set status = 'imported', product_id = v_pid, updated_at = now() where id = p_draft;
  return v_pid;
end $$;
revoke execute on function public.import_draft(bigint, jsonb) from public, anon;
grant execute on function public.import_draft(bigint, jsonb) to authenticated;
