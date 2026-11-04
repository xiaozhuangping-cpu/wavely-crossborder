import 'package:flutter/material.dart';
import '../api.dart';
import '../config.dart';
import '../main.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<Counts> _counts = loadCounts();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return RefreshIndicator(
      onRefresh: () async { setState(() => _counts = loadCounts()); await _counts; },
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 20, 16, 24), children: [
        Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: brand, borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.waves, color: Color(0xFFC2E7FF))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Wavely 仓库助手', style: t.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            Text('与 ERP 实时同步 · 演示数据每天 03:00 重置', style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline)),
          ])),
        ]),
        const SizedBox(height: 20),
        FutureBuilder<Counts>(
          future: _counts,
          builder: (context, snap) {
            final c = snap.data;
            Widget tile(String label, int? n, IconData icon, Color color, int tab) => Expanded(
                  child: Card(
                    color: t.colorScheme.surfaceContainerHighest,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => Shell.of(context).go(tab),
                      child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(icon, color: color),
                        const SizedBox(height: 10),
                        Text(n == null ? '–' : '$n', style: t.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700, color: color)),
                        Text(label, style: t.textTheme.bodyMedium),
                      ])),
                    ),
                  ),
                );
            if (snap.hasError) return Text('加载失败：${snap.error}');
            return Column(children: [
              Row(children: [
                tile('待收货采购单', c?.toReceive, Icons.move_to_inbox, brand, 1),
                const SizedBox(width: 12),
                tile('待发货订单', c?.toShip, Icons.local_shipping, Colors.orange.shade700, 2),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                tile('低库存仓位', c?.lowStock, Icons.warning_amber_rounded, Colors.red.shade600, 3),
                const SizedBox(width: 12),
                tile('补货建议', c?.toReplenish, Icons.shopping_cart_checkout, Colors.indigo, 3),
              ]),
            ]);
          },
        ),
        const SizedBox(height: 20),
        Card(
          color: t.colorScheme.primaryContainer.withValues(alpha: .5),
          child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('怎么体验', style: t.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('1. 收货：打开一张采购单，用扫码枪 / 相机扫条码，或点每行的「模拟扫码」，确认后库存立即增加\n'
                '2. 拣货发货：逐件扫码核对，拣齐后确认发货，系统生成运单号，订单在 ERP 里变为已发货\n'
                '3. 库存：按商品名、SKU 或条码查询各仓库存'),
            const SizedBox(height: 8),
            SelectableText('ERP 后台：$erpUrl', style: t.textTheme.bodySmall),
          ])),
        ),
      ]),
    );
  }
}
