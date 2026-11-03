-- 采集导入默认直接上架：演示站访客本就可在 ERP 改商品状态，草稿并不能起到保护作用，反而导致独立站 404

-- ERP 调用：把采集箱里的一条转为商品 + SKU（一个事务）；p.status 可选 active（默认，独立站可见）/ draft
-- p = {status, name:{zh,en}, category, option_name:{zh,en}, image_url, description:{zh},
--      skus:[{option_value:{zh}, cost_cny, price_usd, weight_g, image_url}]}
create or replace function public.import_draft(p_draft bigint, p jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  d import_drafts; v_pid bigint; v_spu text; s jsonb; i int := 0; n int; v_status text;
begin
  select * into d from import_drafts where id = p_draft for update;
  if not found then raise exception '采集记录不存在'; end if;
  if d.product_id is not null then raise exception '该商品已导入（商品 ID %）', d.product_id; end if;
  n := coalesce(jsonb_array_length(p->'skus'), 0);
  if n = 0 then raise exception '至少保留一个 SKU'; end if;
  if n > 100 then raise exception 'SKU 过多（最多 100 个）'; end if;
  if coalesce(p->'name'->>'zh', '') = '' then raise exception '请填写中文名'; end if;
  if (p->>'category') not in ('家居','户外','宠物','美妆','数码配件') then raise exception '请选择类目'; end if;

  v_status := coalesce(nullif(p->>'status', ''), 'active');
  if v_status not in ('active', 'draft') then raise exception '无效的商品状态'; end if;

  v_spu := 'WV-1688-' || d.source_id;
  insert into products (sku, name, description, category, image_url, cost_cny, price_usd, weight_g, status, option_name, source_url)
  values (v_spu, p->'name', coalesce(p->'description', '{}'::jsonb), p->>'category', left(p->>'image_url', 500),
          (select min((x->>'cost_cny')::numeric) from jsonb_array_elements(p->'skus') x),
          (select min((x->>'price_usd')::numeric) from jsonb_array_elements(p->'skus') x),
          coalesce((select max((x->>'weight_g')::int) from jsonb_array_elements(p->'skus') x), 500),
          v_status, coalesce(p->'option_name', '{}'::jsonb), d.source_url)
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
