import 'package:flutter/material.dart';
import '../api.dart';
import '../main.dart';
import '../widgets/scan.dart';

class PickPage extends StatefulWidget {
  const PickPage({super.key});
  @override
  State<PickPage> createState() => _PickPageState();
}

class _PickPageState extends State<PickPage> {
  late Future<List<Map<String, dynamic>>> _list = ordersToShip();
  void _reload() => setState(() => _list = ordersToShip());

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('拣货发货'), actions: [IconButton(onPressed: _reload, icon: const Icon(Icons.refresh))]),
        body: FutureBuilder(
          future: _list,
          builder: (context, snap) {
            if (snap.hasError) return Center(child: Text('加载失败：${snap.error}'));
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final rows = snap.data!;
            if (rows.isEmpty) return const Center(child: Text('没有待发货订单'));
            return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: rows.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final o = rows[i];
                  final n = List.from(o['order_items'] ?? []).fold<int>(0, (s, x) => s + (x['qty'] as int));
                  return Card(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: ListTile(
                      title: Text(o['order_no'] ?? '', style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                      subtitle: Text('${o['shops']?['name'] ?? ''} · ${o['customers']?['name'] ?? ''} · ${o['country']}'),
                      trailing: Text('$n 件'),
                      onTap: () async {
                        final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => PickDetail(id: o['id'] as int)));
                        if (changed == true) { _reload(); if (context.mounted) Shell.of(context).changed(); }
                      },
                    ),
                  );
                },
              ),
            );
          },
        ),
      );
}

class PickDetail extends StatefulWidget {
  final int id;
  const PickDetail({super.key, required this.id});
  @override
  State<PickDetail> createState() => _PickDetailState();
}

class _PickDetailState extends State<PickDetail> {
  Map<String, dynamic>? _order;
  final Map<int, int> _picked = {};   // order_item_id → 已拣
  bool _busy = false;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try { final o = await order(widget.id); setState(() => _order = o); } catch (e) { setState(() => _error = '$e'); }
  }

  List<Map<String, dynamic>> get _items => List<Map<String, dynamic>>.from(_order?['order_items'] ?? []);
  bool get _allPicked => _items.isNotEmpty && _items.every((x) => (_picked[x['id']] ?? 0) >= (x['qty'] as int));

  void _snack(String msg, {bool error = false}) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? Colors.red.shade700 : null, duration: const Duration(seconds: 2)));

  void _scan(String code) {
    final it = _items.where((x) => matchesCode(x['skus'], code) && (_picked[x['id']] ?? 0) < (x['qty'] as int)).firstOrNull;
    if (it == null) {
      final exists = _items.any((x) => matchesCode(x['skus'], code));
      return _snack(exists ? '该商品已拣齐' : '「$code」不是这个订单的商品，请核对', error: true);
    }
    setState(() => _picked[it['id'] as int] = (_picked[it['id']] ?? 0) + 1);
    _snack(_allPicked ? '全部拣齐，可以发货' : '已拣 ${it['skus']['sku']}');
  }

  Future<void> _ship() async {
    setState(() => _busy = true);
    try {
      final s = await ship(widget.id);
      if (!mounted) return;
      await showDialog(context: context, builder: (_) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: Colors.green, size: 40),
        title: const Text('已发货'),
        content: Text('${s['carrier']} 运单号\n${s['tracking_no']}\n\n订单在 ERP 中已变为「已发货」，物流轨迹每小时自动推进。', textAlign: TextAlign.center),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('好的'))],
      ));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _snack('$e', error: true);
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(_order?['order_no'] ?? '订单')),
      body: _error != null ? Center(child: Text(_error!)) : _order == null ? const Center(child: CircularProgressIndicator()) : ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('${_order!['shops']?['name']} · ${_order!['customers']?['name']} · ${_order!['country']}', style: t.textTheme.titleMedium),
          const SizedBox(height: 12),
          ScanField(onCode: _scan, hint: '逐件扫描商品条码 / SKU 核对'),
          const SizedBox(height: 12),
          for (final it in _items) Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              color: (_picked[it['id']] ?? 0) >= (it['qty'] as int) ? Colors.green.withValues(alpha: .12) : t.colorScheme.surfaceContainerHighest,
              child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
                SkuThumb(it['skus']?['image_url'] ?? it['skus']?['products']?['image_url']),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(zh(it['skus']?['products']?['name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('${it['skus']?['sku']} · ${zh(it['skus']?['option_value'])}', maxLines: 1, overflow: TextOverflow.ellipsis, style: t.textTheme.bodySmall),
                  if (it['skus']?['barcode'] != null) Text('条码 ${it['skus']['barcode']}', style: t.textTheme.bodySmall),
                ])),
                Text('${_picked[it['id']] ?? 0} / ${it['qty']}', style: t.textTheme.titleMedium),
                const SizedBox(width: 4),
                IconButton.filledTonal(tooltip: '模拟扫码', onPressed: (_picked[it['id']] ?? 0) < (it['qty'] as int) ? () => _scan(it['skus']['sku']) : null, icon: const Icon(Icons.qr_code_2)),
              ])),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
          onPressed: _allPicked && !_busy ? _ship : null,
          icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.local_shipping),
          label: Text(_allPicked ? '确认发货' : '拣齐后才能发货'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        ),
      )),
    );
  }
}
