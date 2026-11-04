-- RBAC 与审批流：角色在数据库层强制；大额采购单需老板审批；采购单表只能经函数写入；操作留痕
begin;
-- 三个访客：老板 A、采购 B、仓库 C
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
set local role authenticated;

-- 切换身份（演示）：默认老板
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
do $$ begin
  assert app_role() = 'owner', '新访客默认老板';
  assert set_demo_role('purchaser') = 'purchaser', '切换为采购';
  perform t.throws($q$ select set_demo_role('admin') $q$, '%未知角色%');
end $$;
-- app_role() 是 stable 函数：新身份从下一条语句起生效（真实请求本来就是分开的）
do $$ begin assert app_role() = 'purchaser', '切换后身份为采购'; end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);
select set_demo_role('warehouse');

-- 采购：创建大额采购单并提交 → 待审批
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
do $$
declare v_sku bigint; v_sup bigint; v_wh bigint; v_po bigint;
begin
  select s.id, p.supplier_id into v_sku, v_sup from skus s join products p on p.id = s.product_id order by s.cost_cny desc limit 1;
  select id into v_wh from warehouses where code = 'CN-SZ';
  v_po := create_purchase_order(jsonb_build_object('supplier_id', v_sup, 'warehouse_id', v_wh,
            'items', jsonb_build_array(jsonb_build_object('sku_id', v_sku, 'qty', 1000))));
  assert (select total_cny from purchase_orders where id = v_po) > po_approval_threshold(), '金额超过审批阈值';
  assert place_purchase_order(v_po) = 'approval', '采购提交大额单 → 待审批';
  perform t.throws(format('select approve_purchase_order(%s, true)', v_po), '%「采购」无权%老板%');
  perform t.throws(format('select receive_purchase_order(%s, ''[]'')', v_po), '%「采购」无权%');
  insert into ctx values ('po', v_po::text), ('sku', v_sku::text), ('sup', v_sup::text), ('wh', v_wh::text);

  -- 直接改表被拦：采购单只能经函数写入
  update purchase_orders set status = 'placed' where id = v_po;
  assert not found, '直接 update 采购单影响 0 行';
  perform t.throws(format('insert into purchase_orders (supplier_id, warehouse_id) values (%s, %s)', v_sup, v_wh), '%row-level security%');
  -- 采购不能发货
  perform t.throws(format('select ship_order(%s)', (select id from orders where status = 'paid' limit 1)), '%「采购」无权%');
end $$;

-- 仓库：不能建单、不能审批
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);
do $$ begin
  perform t.throws(format($q$ select create_purchase_order('{"supplier_id":%s,"warehouse_id":%s,"items":[{"sku_id":%s,"qty":1}]}') $q$,
    (select v from ctx where k = 'sup'), (select v from ctx where k = 'wh'), (select v from ctx where k = 'sku')), '%「仓库」无权%');
  perform t.throws(format('select approve_purchase_order(%s, true)', (select v from ctx where k = 'po')), '%「仓库」无权%');
  perform t.throws($q$ select import_draft(1, '{}') $q$, '%「仓库」无权%');
  perform t.throws($q$ insert into suppliers (name) values ('仓库乱建的供应商') $q$, '%row-level security%');
end $$;

-- 老板：驳回需写原因 → 退回草稿；采购改后再提交；老板通过
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$
declare v_po bigint := (select v from ctx where k = 'po')::bigint;
begin
  perform t.throws(format('select approve_purchase_order(%s, false, '' '')', v_po), '%驳回需要填写原因%');
  assert approve_purchase_order(v_po, false, '数量太大，先采 500') = 'draft', '驳回退回草稿';
  assert (select approval_note from purchase_orders where id = v_po) = '数量太大，先采 500', '记录驳回原因';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
do $$ begin assert place_purchase_order((select v from ctx where k = 'po')::bigint) = 'approval', '再次提交审批'; end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$
declare v_po bigint := (select v from ctx where k = 'po')::bigint; r record;
begin
  assert approve_purchase_order(v_po, true, '同意') = 'placed', '审批通过 → 已下单';
  select * into r from purchase_orders where id = v_po;
  assert r.approved_by = '00000000-0000-0000-0000-00000000000a' and r.approved_at is not null and r.placed_at is not null and r.expected_at is not null, '审批人 / 时间 / 预计到货';
  perform t.throws(format('select approve_purchase_order(%s, true)', v_po), '%只有待审批%');
end $$;

-- 仓库：收货
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);
do $$
declare v_po bigint := (select v from ctx where k = 'po')::bigint;
begin
  assert (receive_purchase_order(v_po, (select jsonb_agg(jsonb_build_object('item_id', id, 'qty', 10)) from purchase_order_items where po_id = v_po))->>'status') = 'partial', '仓库收货';
end $$;

-- 老板下大额单不需要审批（自动记为老板批准）
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$
declare v_po bigint;
begin
  v_po := create_purchase_order(jsonb_build_object('supplier_id', (select v from ctx where k = 'sup')::bigint, 'warehouse_id', (select v from ctx where k = 'wh')::bigint,
            'items', jsonb_build_array(jsonb_build_object('sku_id', (select v from ctx where k = 'sku')::bigint, 'qty', 1000))));
  assert place_purchase_order(v_po) = 'placed', '老板直接下单';
  assert (select approved_by from purchase_orders where id = v_po) = '00000000-0000-0000-0000-00000000000a', '自动记为老板批准';
end $$;

-- 操作日志：每步留痕且记录当时的身份；访客不能写日志
do $$ begin
  assert (select string_agg(action || ':' || role, ',' order by id) from audit_log where entity = 'purchase_orders')
    = 'create_po:purchaser,submit_po:purchaser,reject_po:owner,submit_po:purchaser,approve_po:owner,receive_po:warehouse,create_po:owner,place_po:owner',
    format('日志顺序与身份：%s', (select string_agg(action || ':' || role, ',' order by id) from audit_log where entity = 'purchase_orders'));
  assert (select count(*) from audit_log where action = 'switch_role') = 2, '切换身份留痕';
  perform t.throws($q$ insert into audit_log (role, action, entity, summary) values ('owner', 'x', 'x', 'x') $q$, '%row-level security%');
  perform t.throws($q$ select log_action('x', 'x', null, 'x', null) $q$, '%permission denied%');
end $$;
reset role;

-- 重置清空日志与身份
select reset_demo();
do $$ begin
  assert (select count(*) from audit_log) = 0 and (select count(*) from user_roles) = 0, '重置后日志与身份清空';
  assert (select count(*) from purchase_orders where status = 'approval') = 1, '重置后有一张待审批演示单';
end $$;
rollback;
