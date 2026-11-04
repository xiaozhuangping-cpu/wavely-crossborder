-- 权限角色（RBAC）+ 采购审批流 + 操作日志
-- 角色在数据库层强制：关键操作的函数开头 require_role(...)，采购单表只读、写入只能经过函数
--   owner 老板：全部，审批大额采购单 · purchaser 采购：供应商、采集导入、采购单创建/提交/取消 · warehouse 仓库：收货入库、发货
-- 演示站：访客默认「老板」，可在 ERP 顶栏自行切换身份体验权限差异（真实系统由管理员分配）

-- ========== 角色 ==========
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'purchaser', 'warehouse')),
  updated_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
drop policy if exists "own_role" on public.user_roles;
create policy "own_role" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.role_label(p_role text) returns text language sql immutable as $$
  select case p_role when 'owner' then '老板' when 'purchaser' then '采购' when 'warehouse' then '仓库' else p_role end
$$;

-- 当前身份；没有记录（新访客、服务端任务）视为老板
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from user_roles where user_id = auth.uid()), 'owner')
$$;

create or replace function public.require_role(variadic p_roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_role() = any (p_roles)) then
    raise exception '当前身份「%」无权执行此操作，需要：%', role_label(app_role()),
      array_to_string(array(select role_label(r) from unnest(p_roles) r), ' / ') using errcode = '42501';
  end if;
end $$;

-- ========== 操作日志 ==========
create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     uuid,
  role      text not null,
  action    text not null,
  entity    text not null,
  entity_id bigint,
  summary   text not null,
  detail    jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
drop policy if exists "erp_read" on public.audit_log;
create policy "erp_read" on public.audit_log for select to authenticated using (true);   -- 只读；写入只能经 log_action

create or replace function public.log_action(p_action text, p_entity text, p_id bigint, p_summary text, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, role, action, entity, entity_id, summary, detail)
  values (auth.uid(), app_role(), p_action, p_entity, p_id, left(p_summary, 300), p_detail);
$$;
revoke execute on function public.log_action(text, text, bigint, text, jsonb) from public, anon, authenticated;

-- 演示用：切换自己的身份
create or replace function public.set_demo_role(p_role text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if p_role not in ('owner', 'purchaser', 'warehouse') then raise exception '未知角色 %', p_role; end if;
  insert into user_roles (user_id, role) values (auth.uid(), p_role)
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
  perform log_action('switch_role', 'user_roles', null, '切换身份为「' || role_label(p_role) || '」', null);
  return p_role;
end $$;

revoke execute on function public.require_role(text[]) from public, anon;
grant execute on function public.app_role(), public.set_demo_role(text), public.role_label(text) to authenticated;
revoke execute on function public.app_role(), public.set_demo_role(text) from public, anon;

-- ========== 采购单：审批状态 + 只读表 ==========
alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
alter table public.purchase_orders add constraint purchase_orders_status_check
  check (status in ('draft', 'approval', 'placed', 'partial', 'received', 'cancelled'));
alter table public.purchase_orders add column if not exists approved_by uuid;
alter table public.purchase_orders add column if not exists approved_at timestamptz;
alter table public.purchase_orders add column if not exists approval_note text;

-- 写入只能经过下面的 security definer 函数（各自检查角色），直接调接口改不了
drop policy if exists "erp_all" on public.purchase_orders;
drop policy if exists "erp_all" on public.purchase_order_items;
drop policy if exists "erp_read" on public.purchase_orders;
drop policy if exists "erp_read" on public.purchase_order_items;
create policy "erp_read" on public.purchase_orders for select to authenticated using (true);
create policy "erp_read" on public.purchase_order_items for select to authenticated using (true);

-- 供应商：所有人可读，老板 / 采购可写
drop policy if exists "erp_all" on public.suppliers;
drop policy if exists "erp_read" on public.suppliers;
drop policy if exists "buyer_write" on public.suppliers;
create policy "erp_read" on public.suppliers for select to authenticated using (true);
create policy "buyer_write" on public.suppliers for all to authenticated
  using (app_role() in ('owner', 'purchaser')) with check (app_role() in ('owner', 'purchaser'));

create or replace function public.po_approval_threshold() returns numeric language sql immutable as $$ select 5000::numeric $$;

create or replace function public.create_purchase_order(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint; n int;
begin
  perform require_role('owner', 'purchaser');
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
  perform log_action('create_po', 'purchase_orders', v_id,
    (select '创建采购单 ' || po_no || ' · ¥' || total_cny from purchase_orders where id = v_id), p);
  return v_id;
end $$;

-- 提交：草稿 → 已下单；金额超过阈值且提交人不是老板 → 待审批
drop function if exists public.place_purchase_order(bigint);
create function public.place_purchase_order(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare po purchase_orders; v_role text := app_role();
begin
  perform require_role('owner', 'purchaser');
  select * into po from purchase_orders where id = p_id for update;
  if not found then raise exception '采购单不存在'; end if;
  if po.status <> 'draft' then raise exception '只有草稿状态的采购单可以提交（当前：%）', po.status; end if;
  if po.total_cny > po_approval_threshold() and v_role <> 'owner' then
    update purchase_orders set status = 'approval', approval_note = null where id = p_id;
    perform log_action('submit_po', 'purchase_orders', p_id, '提交审批 ' || po.po_no || ' · ¥' || po.total_cny, null);
    return 'approval';
  end if;
  update purchase_orders set status = 'placed', placed_at = now(),
    approved_by = case when po.total_cny > po_approval_threshold() then auth.uid() end,
    approved_at = case when po.total_cny > po_approval_threshold() then now() end,
    expected_at = coalesce(po.expected_at, (now() at time zone 'Asia/Shanghai')::date
      + (select s.lead_days from suppliers s where s.id = po.supplier_id)
      + (select inbound_days(w.kind) from warehouses w where w.id = po.warehouse_id))
  where id = p_id;
  perform log_action('place_po', 'purchase_orders', p_id, '下单 ' || po.po_no || ' · ¥' || po.total_cny, null);
  return 'placed';
end $$;

-- 审批：仅老板；通过 → 已下单，驳回 → 退回草稿并写明原因
create or replace function public.approve_purchase_order(p_id bigint, p_approve boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare po purchase_orders;
begin
  perform require_role('owner');
  select * into po from purchase_orders where id = p_id for update;
  if not found then raise exception '采购单不存在'; end if;
  if po.status <> 'approval' then raise exception '只有待审批的采购单可以审批（当前：%）', po.status; end if;
  if p_approve then
    update purchase_orders set status = 'placed', placed_at = now(), approved_by = auth.uid(), approved_at = now(),
      approval_note = nullif(trim(coalesce(p_note, '')), ''),
      expected_at = coalesce(po.expected_at, (now() at time zone 'Asia/Shanghai')::date
        + (select s.lead_days from suppliers s where s.id = po.supplier_id)
        + (select inbound_days(w.kind) from warehouses w where w.id = po.warehouse_id))
    where id = p_id;
    perform log_action('approve_po', 'purchase_orders', p_id, '审批通过 ' || po.po_no, jsonb_build_object('note', p_note));
    return 'placed';
  end if;
  if coalesce(trim(p_note), '') = '' then raise exception '驳回需要填写原因'; end if;
  update purchase_orders set status = 'draft', approval_note = left(trim(p_note), 300) where id = p_id;
  perform log_action('reject_po', 'purchase_orders', p_id, '驳回 ' || po.po_no || '：' || trim(p_note), null);
  return 'draft';
end $$;

create or replace function public.receive_purchase_order(p_id bigint, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare po purchase_orders; e jsonb; it purchase_order_items; v_qty int; v_total int := 0; v_status text;
begin
  perform require_role('owner', 'warehouse');
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
  perform log_action('receive_po', 'purchase_orders', p_id, '收货 ' || po.po_no || ' · ' || v_total || ' 件', p_items);
  return jsonb_build_object('status', v_status, 'received', v_total);
end $$;

create or replace function public.cancel_purchase_order(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare po purchase_orders;
begin
  perform require_role('owner', 'purchaser');
  select * into po from purchase_orders where id = p_id for update;
  if not found then raise exception '采购单不存在'; end if;
  if po.status not in ('draft', 'approval', 'placed') then raise exception '已到货或已取消的采购单不能取消（当前：%）', po.status; end if;
  if exists (select 1 from purchase_order_items where po_id = p_id and received_qty > 0) then raise exception '已有到货，不能取消'; end if;
  update purchase_orders set status = 'cancelled' where id = p_id;
  perform log_action('cancel_po', 'purchase_orders', p_id, '取消 ' || po.po_no, null);
end $$;

revoke execute on function public.create_purchase_order(jsonb), public.place_purchase_order(bigint),
  public.approve_purchase_order(bigint, boolean, text), public.receive_purchase_order(bigint, jsonb), public.cancel_purchase_order(bigint) from public, anon;
grant execute on function public.create_purchase_order(jsonb), public.place_purchase_order(bigint),
  public.approve_purchase_order(bigint, boolean, text), public.receive_purchase_order(bigint, jsonb), public.cancel_purchase_order(bigint) to authenticated;

-- ========== 补货建议：待审批单也计入在途 ==========
create or replace view public.v_replenishment with (security_invoker = true) as
with sales as (
  select oi.sku_id, sum(oi.qty)::numeric q30
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.created_at > now() - interval '30 days' and o.status not in ('cancelled', 'refunded')
  group by oi.sku_id
), transit as (
  select i.sku_id, po.warehouse_id, sum(i.qty - i.received_qty)::int qty
  from public.purchase_order_items i join public.purchase_orders po on po.id = i.po_id
  where po.status in ('draft', 'approval', 'placed', 'partial')
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

-- ========== 发货：仅老板 / 仓库 ==========
create or replace function public.ship_order(p_order_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_ship bigint; v_country text; v_carrier text; ev record;
begin
  perform require_role('owner', 'warehouse');
  select country into v_country from orders where id = p_order_id and status in ('pending','paid');
  if v_country is null then raise exception '订单不存在或当前状态不能发货'; end if;
  v_carrier := case v_country when 'US' then 'UPS' when 'DE' then 'DHL' when 'GB' then 'Royal Mail'
                 when 'JP' then 'Yamato' when 'SG' then 'Ninja Van' when 'MY' then 'J&T Express' else 'YunExpress' end;
  insert into shipments (order_id, carrier, tracking_no)
  values (p_order_id, v_carrier, 'YT' || lpad((floor(random() * 1e10))::bigint::text, 10, '0'))
  returning id into v_ship;
  select * into ev from _ship_event('label_created', v_country);
  insert into tracking_events (shipment_id, status, location, description) values (v_ship, 'label_created', ev.location, ev.description);
  update orders set status = 'shipped' where id = p_order_id;
  perform log_action('ship_order', 'orders', p_order_id,
    (select '发货 ' || order_no || ' · ' || v_carrier from orders where id = p_order_id), null);
  return v_ship;
end $$;
revoke execute on function public.ship_order(bigint) from public, anon;
grant execute on function public.ship_order(bigint) to authenticated;

-- ========== 采集导入：仅老板 / 采购 ==========
create or replace function public.import_draft(p_draft bigint, p jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  d import_drafts; v_pid bigint; v_spu text; s jsonb; i int := 0; n int; v_status text; v_sup bigint;
begin
  perform require_role('owner', 'purchaser');
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

-- ========== 演示数据：加一张待审批单；重置时清空日志与身份 ==========
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

  -- 一张超过审批阈值、由采购提交的待审批单（老板身份可在采购单详情里审批）
  insert into purchase_orders (supplier_id, warehouse_id, status, created_at, notes)
  select p.supplier_id, (select id from warehouses where code = 'DE-FRA'), 'approval', now() - interval '3 hours', '演示：超过 ¥5,000，待老板审批'
  from products p where p.sku = 'WV-OUT-001' returning id into v_po;
  insert into purchase_order_items (po_id, sku_id, qty, unit_cost_cny)
  select v_po, s.id, 80, s.cost_cny from skus s join products p on p.id = s.product_id where p.sku = 'WV-OUT-001';

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
  truncate public.audit_log restart identity;
  delete from public.user_roles;
  update public.orders set starred = true where id in (select id from public.orders order by random() limit 12);
  delete from auth.users where is_anonymous and created_at < now() - interval '1 day';
end $$;
revoke execute on function public.reset_demo() from public, anon, authenticated;

-- 线上已有采购单引用供应商，不重跑整套种子；只补一张待审批演示单
do $$
declare v_po bigint;
begin
  if not exists (select 1 from purchase_orders where status = 'approval') then
    insert into purchase_orders (supplier_id, warehouse_id, status, created_at, notes)
    select p.supplier_id, (select id from warehouses where code = 'DE-FRA'), 'approval', now() - interval '3 hours', '演示：超过 ¥5,000，待老板审批'
    from products p where p.sku = 'WV-OUT-001' and p.supplier_id is not null returning id into v_po;
    if v_po is not null then
      insert into purchase_order_items (po_id, sku_id, qty, unit_cost_cny)
      select v_po, s.id, 80, s.cost_cny from skus s join products p on p.id = s.product_id where p.sku = 'WV-OUT-001';
      update purchase_orders set po_no = 'PO' || to_char(created_at at time zone 'Asia/Shanghai', 'YYMMDD') || lpad(id::text, 4, '0'),
        total_cny = (select round(sum(qty * unit_cost_cny), 2) from purchase_order_items where po_id = v_po) where id = v_po;
    end if;
  end if;
end $$;
