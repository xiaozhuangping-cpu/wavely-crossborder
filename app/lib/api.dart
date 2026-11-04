// 数据访问：与 ERP 共用同一个 Supabase 后端（匿名登录访客，受 RLS 约束）
// 业务规则在数据库函数里：receive_purchase_order（收货入库）、ship_order（发货生成运单）
import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient get db => Supabase.instance.client;

Future<void> ensureSignedIn() async {
  if (db.auth.currentSession == null) await db.auth.signInAnonymously();
}

String zh(dynamic jsonb) => jsonb is Map ? (jsonb['zh'] ?? jsonb['en'] ?? '').toString() : (jsonb ?? '').toString();

class Counts {
  final int toReceive, toShip, lowStock, toReplenish;
  const Counts(this.toReceive, this.toShip, this.lowStock, this.toReplenish);
}

Future<int> _count(PostgrestFilterBuilder q) async => (await q.count(CountOption.exact)).count;

Future<Counts> loadCounts() async {
  final r = await Future.wait([
    _count(db.from('purchase_orders').select('id').inFilter('status', ['placed', 'partial'])),
    _count(db.from('orders').select('id').eq('status', 'paid')),
    _count(db.from('v_inventory').select('id').eq('low_stock', true)),
    _count(db.from('v_replenishment').select('id')),
  ]);
  return Counts(r[0], r[1], r[2], r[3]);
}

// ---------- 采购收货 ----------
Future<List<Map<String, dynamic>>> openPurchaseOrders() async => List<Map<String, dynamic>>.from(await db
    .from('purchase_orders')
    .select('id,po_no,status,total_cny,expected_at,created_at,suppliers(name),warehouses(name,kind),purchase_order_items(qty,received_qty)')
    .inFilter('status', ['placed', 'partial'])
    .order('expected_at'));

Future<Map<String, dynamic>> purchaseOrder(int id) async => Map<String, dynamic>.from(await db
    .from('purchase_orders')
    .select('id,po_no,status,expected_at,suppliers(name),warehouses(name,kind),'
        'purchase_order_items(id,qty,received_qty,skus(id,sku,barcode,option_value,image_url,products(name,image_url)))')
    .eq('id', id)
    .single());

Future<Map<String, dynamic>> receive(int poId, Map<int, int> qtyByItem) async => Map<String, dynamic>.from(await db.rpc(
    'receive_purchase_order',
    params: {
      'p_id': poId,
      'p_items': [for (final e in qtyByItem.entries) if (e.value > 0) {'item_id': e.key, 'qty': e.value}],
    }));

// ---------- 拣货发货 ----------
Future<List<Map<String, dynamic>>> ordersToShip() async => List<Map<String, dynamic>>.from(await db
    .from('orders')
    .select('id,order_no,country,created_at,total_usd,shops(name,platform),customers(name),order_items(qty)')
    .eq('status', 'paid')
    .order('created_at')
    .limit(50));

Future<Map<String, dynamic>> order(int id) async => Map<String, dynamic>.from(await db
    .from('orders')
    .select('id,order_no,status,country,created_at,shops(name),customers(name),'
        'order_items(id,qty,skus(id,sku,barcode,option_value,image_url,products(name,image_url)))')
    .eq('id', id)
    .single());

/// 发货：返回 {carrier, tracking_no}
Future<Map<String, dynamic>> ship(int orderId) async {
  final shipId = await db.rpc('ship_order', params: {'p_order_id': orderId});
  return Map<String, dynamic>.from(await db.from('shipments').select('carrier,tracking_no').eq('id', shipId).single());
}

// ---------- 库存查询 ----------
/// 按商品名 / SKU / 条码查询，按 SKU 分组返回各仓库存
Future<List<Map<String, dynamic>>> searchStock(String q) async {
  final kw = q.trim().replaceAll(RegExp(r'[%,()*]'), ' ');
  var query = db.from('v_inventory').select('id,sku_id,sku,product_name,option_label,warehouse_name,warehouse_kind,qty,safety_qty,low_stock');
  if (kw.isNotEmpty) {
    final byBarcode = await db.from('skus').select('sku').eq('barcode', kw);
    final skus = [for (final r in byBarcode) r['sku'] as String];
    query = skus.isNotEmpty ? query.inFilter('sku', skus) : query.or('sku.ilike.*$kw*,product_name.ilike.*$kw*,option_label.ilike.*$kw*');
  } else {
    query = query.eq('low_stock', true);
  }
  final rows = List<Map<String, dynamic>>.from(await query.order('sku').limit(200));
  final grouped = <String, Map<String, dynamic>>{};
  for (final r in rows) {
    grouped.putIfAbsent(r['sku'] as String, () => {...r, 'warehouses': <Map<String, dynamic>>[]})['warehouses'].add(r);
  }
  return grouped.values.toList();
}
