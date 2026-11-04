import 'package:flutter/material.dart';
import '../api.dart';
import '../widgets/scan.dart';

const _kind = {'domestic': '国内仓', 'overseas': '海外仓', 'fba': 'FBA'};

class StockPage extends StatefulWidget {
  const StockPage({super.key});
  @override
  State<StockPage> createState() => _StockPageState();
}

class _StockPageState extends State<StockPage> {
  String _q = '';
  late Future<List<Map<String, dynamic>>> _rows = searchStock('');
  void _search(String q) => setState(() { _q = q; _rows = searchStock(q); });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('库存查询')),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 8), child: ScanField(onCode: _search, hint: '商品名 / SKU / 条码，回车查询')),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            Text(_q.isEmpty ? '当前显示：低于安全库存的仓位' : '查询：$_q', style: t.textTheme.bodySmall),
            const Spacer(),
            if (_q.isNotEmpty) TextButton(onPressed: () => _search(''), child: const Text('看低库存')),
          ]),
        ),
        Expanded(child: FutureBuilder(
          future: _rows,
          builder: (context, snap) {
            if (snap.hasError) return Center(child: Text('查询失败：${snap.error}'));
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final rows = snap.data!;
            if (rows.isEmpty) return const Center(child: Text('没有找到'));
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              itemCount: rows.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final r = rows[i];
                final whs = List<Map<String, dynamic>>.from(r['warehouses']);
                return Card(
                  color: t.colorScheme.surfaceContainerHighest,
                  child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r['product_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text('${r['sku']} · ${r['option_label'] ?? ''}', style: t.textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Wrap(spacing: 6, runSpacing: 6, children: [
                      for (final w in whs) Chip(
                        visualDensity: VisualDensity.compact,
                        backgroundColor: w['low_stock'] == true ? Colors.red.withValues(alpha: .12) : null,
                        label: Text('${w['warehouse_name']}（${_kind[w['warehouse_kind']] ?? ''}）${w['qty']}${w['low_stock'] == true ? ' / ${w['safety_qty']}' : ''}'),
                      ),
                    ]),
                  ])),
                );
              },
            );
          },
        )),
      ]),
    );
  }
}
