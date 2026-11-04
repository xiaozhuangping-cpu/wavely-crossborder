-- 采购闭环：创建 → 下单 → 分批收货入库 → 到货；补货建议与在途联动；状态校验与权限
begin;
do $$ begin
  assert (select count(*) from suppliers) = 5, '演示供应商 5 家';
  assert not exists (select 1 from products where supplier_id is null), '演示商品都关联了供应商';
  assert (select count(*) from purchase_orders) = 4, '演示采购单 4 张';
  assert (select string_agg(status, ',' order by status) from purchase_orders) = 'draft,partial,placed,received', '演示采购单覆盖各状态';
  assert not exists (select 1 from purchase_orders where po_no is null or total_cny <= 0), '单号与金额已生成';
end $$;

set local role authenticated;
do $$
declare v_row record; v_po bigint; v_item bigint; v_before int; v_after int; r jsonb; v_cnt int;
begin
  select * into v_row from v_replenishment order by sku_id, warehouse_id limit 1;
  assert v_row.sku_id is not null, '有补货建议';
  assert v_row.on_hand + v_row.in_transit < v_row.safety_qty, '建议行满足触发条件';
  assert v_row.suggested_qty > 0 and v_row.suggested_qty % coalesce(v_row.moq, 1) = 0, '建议量为正且是起批量的整数倍';
  assert v_row.lead_days = (select lead_days from suppliers where id = v_row.supplier_id) + inbound_days(v_row.warehouse_kind), '补货周期 = 交期 + 头程';

  -- 创建：同一 SKU 合并，默认取 SKU 成本
  v_po := create_purchase_order(jsonb_build_object('supplier_id', v_row.supplier_id, 'warehouse_id', v_row.warehouse_id,
            'items', jsonb_build_array(jsonb_build_object('sku_id', v_row.sku_id, 'qty', 30), jsonb_build_object('sku_id', v_row.sku_id, 'qty', 20))));
  assert (select status from purchase_orders where id = v_po) = 'draft', '新建为草稿';
  assert (select po_no from purchase_orders where id = v_po) ~ '^PO[0-9]{6}[0-9]{4,}$', '采购单号格式';
  assert (select count(*) from purchase_order_items where po_id = v_po) = 1 and (select qty from purchase_order_items where po_id = v_po) = 50, '同一 SKU 合并为 50';
  assert (select total_cny from purchase_orders where id = v_po) = round(50 * v_row.cost_cny, 2), '金额 = 数量 × 成本';
  -- 草稿计入在途：该行在途 +50
  assert coalesce((select in_transit from v_replenishment where sku_id = v_row.sku_id and warehouse_id = v_row.warehouse_id), 999)
         >= v_row.in_transit + 50 or not exists (select 1 from v_replenishment where sku_id = v_row.sku_id and warehouse_id = v_row.warehouse_id),
         '草稿采购单计入在途';

  perform t.throws(format('select receive_purchase_order(%s, ''[]'')', v_po), '%只有已下单%');
  perform place_purchase_order(v_po);
  assert (select status = 'placed' and placed_at is not null and expected_at is not null from purchase_orders where id = v_po), '下单后有下单时间与预计到货日';
  perform t.throws(format('select place_purchase_order(%s)', v_po), '%只有草稿%');

  select id into v_item from purchase_order_items where po_id = v_po;
  select qty into v_before from inventory where sku_id = v_row.sku_id and warehouse_id = v_row.warehouse_id;
  perform t.throws(format('select receive_purchase_order(%s, ''[{"item_id":%s,"qty":51}]'')', v_po, v_item), '%收货数量无效%');
  perform t.throws(format('select receive_purchase_order(%s, ''[{"item_id":%s,"qty":0}]'')', v_po, v_item), '%没有可收货%');

  r := receive_purchase_order(v_po, jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', 20)));
  assert r->>'status' = 'partial' and (r->>'received')::int = 20, '部分到货';
  select qty into v_after from inventory where sku_id = v_row.sku_id and warehouse_id = v_row.warehouse_id;
  assert v_after = v_before + 20, format('库存 +20（%s → %s）', v_before, v_after);
  perform t.throws(format('select cancel_purchase_order(%s)', v_po), '%不能取消%');

  r := receive_purchase_order(v_po, jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', 30)));
  assert r->>'status' = 'received', '收齐后为已到货';
  assert (select received_at is not null from purchase_orders where id = v_po), '到货时间';
  select qty into v_after from inventory where sku_id = v_row.sku_id and warehouse_id = v_row.warehouse_id;
  assert v_after = v_before + 50, '累计入库 50';

  -- 取消：草稿可取消；取消后不再计入在途
  v_po := create_purchase_order(jsonb_build_object('supplier_id', v_row.supplier_id, 'warehouse_id', v_row.warehouse_id,
            'items', jsonb_build_array(jsonb_build_object('sku_id', v_row.sku_id, 'qty', 5))));
  perform cancel_purchase_order(v_po);
  assert (select status from purchase_orders where id = v_po) = 'cancelled', '草稿可取消';

  perform t.throws($q$ select create_purchase_order('{"supplier_id":999999,"warehouse_id":1,"items":[{"sku_id":1,"qty":1}]}') $q$, '%供应商不存在%');
  perform t.throws(format($q$ select create_purchase_order('{"supplier_id":%s,"warehouse_id":1,"items":[]}') $q$, v_row.supplier_id), '%1-50%');
  perform t.throws(format($q$ select create_purchase_order('{"supplier_id":%s,"warehouse_id":1,"items":[{"sku_id":1,"qty":0}]}') $q$, v_row.supplier_id), '%采购明细无效%');
end $$;

-- 1688 导入：按供应商名去重创建供应商并记录起批量
do $$
declare v_pid bigint; v_sup bigint;
begin
  v_pid := import_draft((collect_offer('{"offerId":"111222333","title":"x","supplier":"义乌某某工厂","moq":12,"skus":[{"price":1}]}')->>'id')::bigint,
    '{"name":{"zh":"测试"},"category":"家居","skus":[{"cost_cny":1,"price_usd":3}]}');
  select supplier_id into v_sup from products where id = v_pid;
  assert (select name = '义乌某某工厂' and source = '1688' from suppliers where id = v_sup), '导入时创建 1688 供应商';
  assert (select moq from products where id = v_pid) = 12, '记录起批量';
  v_pid := import_draft((collect_offer('{"offerId":"111222444","title":"y","supplier":"义乌某某工厂","skus":[{"price":1}]}')->>'id')::bigint,
    '{"name":{"zh":"测试2"},"category":"家居","skus":[{"cost_cny":1,"price_usd":3}]}');
  assert (select supplier_id from products where id = v_pid) = v_sup, '同名供应商复用';
end $$;
reset role;

set local role anon;
do $$ begin
  assert (select count(*) from purchase_orders) = 0 and (select count(*) from suppliers) = 0, '采购数据不公开';
  perform t.throws($q$ select create_purchase_order('{}') $q$, '%permission denied%');
  perform t.throws($q$ select receive_purchase_order(1, '[]') $q$, '%permission denied%');
end $$;
reset role;

-- 每日重置后采购演示数据重建
select reset_demo();
do $$ begin
  assert (select count(*) from purchase_orders) = 4 and (select count(*) from suppliers) = 5, '重置后重建采购演示数据';
end $$;
rollback;
