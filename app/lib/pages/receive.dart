import 'package:flutter/material.dart';
import '../api.dart';
import '../main.dart';
import '../widgets/scan.dart';

const _status = {'placed': '已下单', 'partial': '部分到货'};

class ReceivePage extends StatefulWidget {
  const ReceivePage({super.key});
  @override
  State<ReceivePage> createState() => _ReceivePageState();
}

class _ReceivePageState extends State<ReceivePage> {
  late Future<List<Map<String, dynamic>>> _list = openPurchaseOrders();
  void _reload() => setState(() => _list = openPurchaseOrders());

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('收货入库'), actions: [IconButton(onPressed: _reload, icon: const Icon(Icons.refresh))]),
        body: FutureBuilder(
          future: _list,
          builder: (context, snap) {
            if (snap.hasError) return Center(child: Text('加载失败：${snap.error}'));
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final rows = snap.data!;
            if (rows.isEmpty) return const Center(child: Text('没有待收货的采购单\n可在 ERP「补货建议」里生成并下单', textAlign: TextAlign.center));
            return RefreshIndicator(
              onRefresh: () async => _reload(),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: rows.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final po = rows[i];
                  final items = List<Map<String, dynamic>>.from(po['purchase_order_items'] ?? []);
                  final qty = items.fold<int>(0, (s, x) => s + (x['qty'] as int));
                  final got = items.fold<int>(0, (s, x) => s + (x['received_qty'] as int));
                  return Card(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      title: Text(po['po_no'] ?? '', style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                      subtitle: Text('${po['suppliers']?['name'] ?? ''}\n→ ${po['warehouses']?['name'] ?? ''} · 预计 ${po['expected_at'] ?? '-'}'),
                      isThreeLine: true,
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Chip(label: Text(_status[po['status']] ?? po['status']), visualDensity: VisualDensity.compact),
                        Text('$got / $qty 件'),
                      ]),
                      onTap: () async {
                        final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => ReceiveDetail(id: po['id'] as int)));
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

class ReceiveDetail extends StatefulWidget {
  final int id;
  const ReceiveDetail({super.key, required this.id});
  @override
  State<ReceiveDetail> createState() => _ReceiveDetailState();
}

class _ReceiveDetailState extends State<ReceiveDetail> {
  Map<String, dynamic>? _po;
  final Map<int, int> _qty = {};   // item_id → 本次收货
  bool _busy = false;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try { final po = await purchaseOrder(widget.id); setState(() { _po = po; _qty.clear(); }); }
    catch (e) { setState(() => _error = '$e'); }
  }

  List<Map<String, dynamic>> get _items => List<Map<String, dynamic>>.from(_po?['purchase_order_items'] ?? [])..sort((a, b) => (a['id'] as int).compareTo(b['id'] as int));
  int _remaining(Map<String, dynamic> it) => (it['qty'] as int) - (it['received_qty'] as int) - (_qty[it['id']] ?? 0);

  void _snack(String msg, {bool error = false}) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? Colors.red.shade700 : null, duration: const Duration(seconds: 2)));

  void _scan(String code) {
    final it = _items.where((x) => matchesCode(x['skus'], code)).firstOrNull;
    if (it == null) return _snack('「$code」不在这张采购单里', error: true);
    if (_remaining(it) <= 0) return _snack('${it['skus']['sku']} 已收齐', error: true);
    setState(() => _qty[it['id'] as int] = (_qty[it['id']] ?? 0) + 1);
    _snack('+1 ${it['skus']['sku']}');
  }

  Future<void> _confirm() async {
    setState(() => _busy = true);
    try {
      final r = await receive(widget.id, _qty);
      if (!mounted) return;
      _snack('已入库 ${r['received']} 件 → ${_po?['warehouses']?['name']}${r['status'] == 'received' ? '，采购单已到货' : ''}');
      Navigator.pop(context, true);
    } catch (e) {
      _snack('$e', error: true);
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final total = _qty.values.fold<int>(0, (s, x) => s + x);
    return Scaffold(
      appBar: AppBar(title: Text(_po?['po_no'] ?? '采购单')),
      body: _error != null ? Center(child: Text(_error!)) : _po == null ? const Center(child: CircularProgressIndicator()) : ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('${_po!['suppliers']?['name']} → ${_po!['warehouses']?['name']}', style: t.textTheme.titleMedium),
          const SizedBox(height: 12),
          ScanField(onCode: _scan),
          const SizedBox(height: 12),
          for (final it in _items) Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              color: t.colorScheme.surfaceContainerHighest,
              child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
                SkuThumb(it['skus']?['image_url'] ?? it['skus']?['products']?['image_url']),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(zh(it['skus']?['products']?['name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('${it['skus']?['sku']} · ${zh(it['skus']?['option_value'])}', maxLines: 1, overflow: TextOverflow.ellipsis, style: t.textTheme.bodySmall),
                  Text('采购 ${it['qty']} · 已收 ${it['received_qty']} · 本次 ${_qty[it['id']] ?? 0}', style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.primary)),
                ])),
                Column(children: [
                  IconButton.filledTonal(tooltip: '模拟扫码（+1）', onPressed: _remaining(it) > 0 ? () => _scan(it['skus']['sku']) : null, icon: const Icon(Icons.qr_code_2)),
                  TextButton(onPressed: _remaining(it) > 0 ? () => setState(() => _qty[it['id'] as int] = (_qty[it['id']] ?? 0) + _remaining(it)) : null, child: const Text('收齐')),
                ]),
              ])),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
          onPressed: total == 0 || _busy ? null : _confirm,
          icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check),
          label: Text(total == 0 ? '扫码后确认收货' : '确认收货 $total 件'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        ),
      )),
    );
  }
}
