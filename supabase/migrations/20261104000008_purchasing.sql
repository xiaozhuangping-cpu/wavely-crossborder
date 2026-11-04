-- 采购闭环：供应商 → 采购单（草稿 → 已下单 → 部分到货 → 已到货 / 取消）→ 收货入库；按仓库的补货建议
-- 设计参考：ittim-erp（采购单主表 + 明细、"在库 + 在途 < 需求"补货预警）、InvenTree（采购单状态、按明细分批收货）

-- ========== 结构 ==========
create table if not exists public.suppliers (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  source     text not null default 'manual' check (source in ('manual', '1688')),
  contact    text,
  phone      text,
  url        text,
  lead_days  int  not null default 7 check (lead_days between 0 and 180),   -- 下单到工厂发货的天数
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists supplier_id bigint references public.suppliers(id) on delete set null;
alter table public.products add column if not exists moq int check (moq is null or moq > 0);   -- 起批量

create table if not exists public.purchase_orders (
  id           bigint generated always as identity primary key,
  po_no        text unique,
  supplier_id  bigint not null references public.suppliers(id),
  warehouse_id bigint not null references public.warehouses(id),      -- 收货仓
  status       text not null default 'draft' check (status in ('draft', 'placed', 'partial', 'received', 'cancelled')),
  total_cny    numeric(12,2) not null default 0,
  expected_at  date,
  placed_at    timestamptz,
  received_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists purchase_orders_status_idx on public.purchase_orders (status, created_at desc);

create table if not exists public.purchase_order_items (
  id            bigint generated always as identity primary key,
  po_id         bigint not null references public.purchase_orders(id) on delete cascade,
  sku_id        bigint not null references public.skus(id),
  qty           int not null check (qty between 1 and 100000),
  received_qty  int not null default 0 check (received_qty >= 0 and received_qty <= qty),
  unit_cost_cny numeric(12,2) not null check (unit_cost_cny >= 0)
);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items (po_id);
create index if not exists purchase_order_items_sku_idx on public.purchase_order_items (sku_id);

do $$
declare t text;
begin
  foreach t in array array['suppliers', 'purchase_orders', 'purchase_order_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "erp_all" on public.%I', t);
    execute format('create policy "erp_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 头程天数：国内仓 0、海外仓 25、FBA 30（简化的运输时效）
create or replace function public.inbound_days(p_kind text) returns int language sql immutable as $$
  select case p_kind when 'domestic' then 0 when 'overseas' then 25 else 30 end
$$;

-- ========== 采购单 ==========
-- p = {supplier_id, warehouse_id, items:[{sku_id, qty, unit_cost_cny?}], expected_at?, notes?}；同一 SKU 合并
create or replace function public.create_purchase_order(p jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare v_id bigint; n int;
begin
  if not exists (select 1 from suppliers where id = (p->>'supplier_id')::bigint) then raise exception '供应商不存在'; end if;
  if not exists (select 1 from warehouses where id = (p->>'warehouse_id')::bigint) then raise exception '收货仓不存在'; end if;
  n := coalesce(jsonb_array_length(p->'items'), 0);
  if n not between 1 and 50 then raise exception '采购明细需在 1-50 行之间'; end if;
  if exists (select 1 from jsonb_array_elements(p->'items') x
             where coalesce((x->>'qty')::int, 0) not between 1 and 100000
                or not exists (select 1 from skus s where s.id = (x->>'sku_id')::bigint)) then
    raise exception '采购明细无效（SKU 不存在或数量不在 1-100000 之间）';
  end if;

  insert into purchase_orders (supplier_id, warehouse_id, expected_at, notes)
  values ((p->>'supplier_id')::bigint, (p->>'warehouse_id')::bigint, nullif(p->>'expected_at', '')::date, left(p->>'notes', 500))
  returning id into v_id;
  update purchase_orders set po_no = 'PO' || to_char(now() at time zone 'Asia/Shanghai', 'YYMMDD') || lpad(v_id::text, 4, '0') where id = v_id;

  insert into purchase_order_items (po_id, sku_id, qty, unit_cost_cny)
  select v_id, x.sku_id, sum(x.qty), coalesce(max(x.cost), (select cost_cny from skus where id = x.sku_id))
  from (select (e->>'sku_id')::bigint sku_id, (e->>'qty')::int qty, nullif(e->>'unit_cost_cny', '')::numeric cost
        from jsonb_array_elements(p->'items') e) x
  group by x.sku_id;

  update purchase_orders set total_cny = (select round(sum(qty * unit_cost_cny), 2) from purchase_order_items where po_id = v_id) where id = v_id;
  return v_id;
end $$;

-- 下单：草稿 → 已下单；未填预计到货日时按 供应商交期 + 头程天数 推算
create or replace function public.place_purchase_order(p_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare po purchase_orders;
begin
  select * into po from purchase_orders where id = p_id for update;
  if not found then raise exception '采购单不存在'; end if;
  if po.status <> 'draft' then raise exception '只有草稿状态的采购单可以下单（当前：%）', po.status; end if;
  update purchase_orders set status = 'placed', placed_at = now(),
    expected_at = coalesce(po.expected_at, (now() at time zone 'Asia/Shanghai')::date
      + (select s.lead_days from suppliers s where s.id = po.supplier_id)
      + (select inbound_days(w.kind) from warehouses w where w.id = po.warehouse_id))
  where id = p_id;
end $$;

-- 收货：p_items = [{item_id, qty}]，累加已收数量并在同一事务内加库存；全部收齐即「已到货」
create or replace function public.receive_purchase_order(p_id bigint, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare po purchase_orders; e jsonb; it purchase_order_items; v_qty int; v_total int := 0; v_status text;
begin
  select * into po from purchase_orders where id = p_id for update;
  if not found then raise exception '采购单不存在'; end if;
  if po.status not in ('placed', 'partial') then raise exception '只有已下单 / 部分到货的采购单可以收货（当前：%）', po.status; end if;

  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_qty := coalesce((e->>'qty')::int, 0);
    continue when v_qty = 0;
    select * into it from purchase_order_items where id = (e->>'item_id')::bigint and po_id = p_id for update;
    if not found then raise exception '明细不属于该采购单'; end if;
    if v_qty < 0 or v_qty > it.qty - it.received_qty then
      raise exception '收货数量无效（SKU %，剩余 %）', it.sku_id, it.qty - it.received_qty;
    end if;
    update purchase_order_items set received_qty = received_qty + v_qty where id = it.id;
    insert into inventory (product_id, sku_id, warehouse_id, qty, safety_qty)
    select s.product_id, s.id, po.warehouse_id, v_qty, case w.kind when 'domestic' then 100 else 30 end
    from skus s, warehouses w where s.id = it.sku_id and w.id = po.warehouse_id
    on conflict (sku_id, warehouse_id) do update set qty = inventory.qty + excluded.qty;
    v_total := v_total + v_qty;
  end loop;
  if v_total = 0 then raise exception '没有可收货的数量'; end if;

  v_status := case when exists (select 1 from purchase_order_items where po_id = p_id and received_qty < qty) then 'partial' else 'received' end;
  update purchase_orders set status = v_status, received_at = case when v_status = 'received' then now() end where id = p_id;
  return jsonb_build_object('status', v_status, 'received', v_total);
end $$;

-- 取消：已有到货的采购单不能取消
create or replace function public.cancel_purchase_order(p_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare po purchase_orders;
begin
  select * into po from purchase_orders where id = p_id for update;
  if not found then raise exception '采购单不存在'; end if;
  if po.status not in ('draft', 'placed') then raise exception '已到货或已取消的采购单不能取消（当前：%）', po.status; end if;
  if exists (select 1 from purchase_order_items where po_id = p_id and received_qty > 0) then raise exception '已有到货，不能取消'; end if;
  update purchase_orders set status = 'cancelled' where id = p_id;
end $$;

revoke execute on function public.create_purchase_order(jsonb), public.place_purchase_order(bigint),
  public.receive_purchase_order(bigint, jsonb), public.cancel_purchase_order(bigint) from public, anon;
grant execute on function public.create_purchase_order(jsonb), public.place_purchase_order(bigint),
  public.receive_purchase_order(bigint, jsonb), public.cancel_purchase_order(bigint) to authenticated;

-- ========== 补货建议（按 SKU × 仓库） ==========
-- 触发：在库 + 在途 < 安全库存；建议量 = 安全库存×2 + 日均销量×(供应商交期+头程) − 在库 − 在途，按起批量向上取整
-- 在途包含草稿采购单（已计划），避免重复建议；日均销量为该 SKU 近 30 天全渠道销量（简化，未按仓库拆分）
create or replace view public.v_replenishment with (security_invoker = true) as
with sales as (
  select oi.sku_id, sum(oi.qty)::numeric q30
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.created_at > now() - interval '30 days' and o.status not in ('cancelled', 'refunded')
  group by oi.sku_id
), transit as (
  select i.sku_id, po.warehouse_id, sum(i.qty - i.received_qty)::int qty
  from public.purchase_order_items i join public.purchase_orders po on po.id = i.po_id
  where po.status in ('draft', 'placed', 'partial')
  group by i.sku_id, po.warehouse_id
), base as (
  select inv.id, inv.sku_id, s.product_id, s.sku, p.name->>'zh' as product_name, s.option_value->>'zh' as option_label,
         coalesce(s.image_url, p.image_url) as image_url, s.cost_cny, p.moq,
         w.id as warehouse_id, w.code as warehouse_code, w.name as warehouse_name, w.kind as warehouse_kind,
         inv.qty as on_hand, inv.safety_qty, coalesce(t.qty, 0) as in_transit,
         coalesce(sa.q30, 0)::int as sales_30d, round(coalesce(sa.q30, 0) / 30.0, 2) as daily_sales,
         sup.id as supplier_id, sup.name as supplier_name,
         coalesce(sup.lead_days, 7) + public.inbound_days(w.kind) as lead_days
  from public.inventory inv
  join public.skus s on s.id = inv.sku_id
  join public.products p on p.id = s.product_id
  join public.warehouses w on w.id = inv.warehouse_id
  left join public.suppliers sup on sup.id = p.supplier_id
  left join sales sa on sa.sku_id = inv.sku_id
  left join transit t on t.sku_id = inv.sku_id and t.warehouse_id = inv.warehouse_id
  where s.status = 'active' and p.status = 'active'
)
select b.*,
       (ceil(greatest(b.safety_qty * 2 + b.daily_sales * b.lead_days - b.on_hand - b.in_transit, 1)
             / coalesce(b.moq, 1)) * coalesce(b.moq, 1))::int as suggested_qty
from base b
where b.on_hand + b.in_transit < b.safety_qty;

grant select on public.v_replenishment to authenticated;

-- ========== 1688 导入时关联供应商与起批量 ==========
create or replace function public.import_draft(p_draft bigint, p jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  d import_drafts; v_pid bigint; v_spu text; s jsonb; i int := 0; n int; v_status text; v_sup bigint;
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

  if coalesce(d.supplier, '') <> '' then
    insert into suppliers (name, source, url) values (left(d.supplier, 120), '1688', d.source_url)
    on conflict (name) do nothing;
    select id into v_sup from suppliers where name = left(d.supplier, 120);
  end if;

  v_spu := 'WV-1688-' || d.source_id;
  insert into products (sku, name, description, category, image_url, cost_cny, price_usd, weight_g, status, option_name, source_url, supplier_id, moq)
  values (v_spu, p->'name', coalesce(p->'description', '{}'::jsonb), p->>'category', left(p->>'image_url', 500),
          (select min((x->>'cost_cny')::numeric) from jsonb_array_elements(p->'skus') x),
          (select min((x->>'price_usd')::numeric) from jsonb_array_elements(p->'skus') x),
          coalesce((select max((x->>'weight_g')::int) from jsonb_array_elements(p->'skus') x), 500),
          v_status, coalesce(p->'option_name', '{}'::jsonb), d.source_url, v_sup,
          nullif(d.data->>'moq', '')::numeric::int)
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


-- ========== 演示数据：供应商 + 不同状态的采购单（每日重置后重建） ==========
create or replace function public.seed_purchasing()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_po bigint; r record; i int := 0;
begin
  delete from suppliers;   -- 采购单已随 skus / warehouses 的 truncate cascade 清空
  insert into suppliers (name, source, contact, phone, lead_days) values
    ('深圳海纳家居用品有限公司', 'manual', '陈经理', '0755-2860 1188', 5),
    ('宁波山野户外用品厂',       'manual', '王厂长', '0574-8712 6603', 10),
    ('杭州萌宠智能科技有限公司', 'manual', '李小姐', '0571-8690 2271', 7),
    ('广州美妍电子科技有限公司', 'manual', '赵经理', '020-3922 5170',  6),
    ('东莞迅充电子有限公司',     'manual', '刘工',   '0769-2268 9035', 8);
  update products p set supplier_id = s.id, moq = case p.category when '数码配件' then 50 else 20 end
  from suppliers s
  where s.name = case p.category when '家居' then '深圳海纳家居用品有限公司' when '户外' then '宁波山野户外用品厂'
                   when '宠物' then '杭州萌宠智能科技有限公司' when '美妆' then '广州美妍电子科技有限公司' else '东莞迅充电子有限公司' end;

  -- 两张在途单（补货建议里能看到「在途」）、一张已到货的历史单、一张草稿
  -- 只补一半缺口，补货建议里仍能看到这两行及其在途数量
  for r in select v.sku_id, v.warehouse_id, v.supplier_id, greatest((v.safety_qty - v.on_hand) / 2, 1) as half from v_replenishment v
           where v.supplier_id is not null order by v.safety_qty - v.on_hand desc, v.sku_id limit 2 loop
    i := i + 1;
    insert into purchase_orders (supplier_id, warehouse_id, status, placed_at, expected_at, created_at, notes)
    values (r.supplier_id, r.warehouse_id, case i when 1 then 'placed' else 'partial' end, now() - interval '6 days',
            current_date + 20, now() - interval '6 days', '演示：补货在途') returning id into v_po;
    insert into purchase_order_items (po_id, sku_id, qty, received_qty, unit_cost_cny)
    select v_po, r.sku_id, case i when 1 then r.half else r.half * 2 end, case i when 1 then 0 else r.half end, s.cost_cny
    from skus s where s.id = r.sku_id;
  end loop;

  insert into purchase_orders (supplier_id, warehouse_id, status, placed_at, received_at, expected_at, created_at, notes)
  select p.supplier_id, (select id from warehouses where code = 'CN-SZ'), 'received', now() - interval '32 days', now() - interval '25 days',
         current_date - 25, now() - interval '33 days', '演示：已到货'
  from products p where p.sku = 'WV-PET-001' returning id into v_po;
  insert into purchase_order_items (po_id, sku_id, qty, received_qty, unit_cost_cny)
  select v_po, s.id, 200, 200, s.cost_cny from skus s join products p on p.id = s.product_id where p.sku = 'WV-PET-001';

  insert into purchase_orders (supplier_id, warehouse_id, status, created_at, notes)
  select p.supplier_id, (select id from warehouses where code = 'US-LAX'), 'draft', now() - interval '1 day', '演示：待确认的草稿'
  from products p where p.sku = 'WV-ELE-002' returning id into v_po;
  insert into purchase_order_items (po_id, sku_id, qty, unit_cost_cny)
  select v_po, s.id, 100, s.cost_cny from skus s join products p on p.id = s.product_id where p.sku = 'WV-ELE-002';

  update purchase_orders po set
    po_no = 'PO' || to_char(po.created_at at time zone 'Asia/Shanghai', 'YYMMDD') || lpad(po.id::text, 4, '0'),
    total_cny = (select round(sum(qty * unit_cost_cny), 2) from purchase_order_items where po_id = po.id)
  where po.po_no is null;
end $$;
revoke execute on function public.seed_purchasing() from public, anon, authenticated;

create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_demo();
  perform public.seed_product_videos();
  perform public.seed_purchasing();
  update public.orders set starred = true where id in (select id from public.orders order by random() limit 12);
  delete from auth.users where is_anonymous and created_at < now() - interval '1 day';
end $$;
revoke execute on function public.reset_demo() from public, anon, authenticated;

select public.seed_purchasing();
