// Wavely 仓库助手：与 Wavely 跨境 ERP 共用 Supabase 后端的移动端（Android / iOS / Web）
// 收货入库、拣货发货、库存查询；数据与 ERP 实时同步，演示数据每天 03:00 重置
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'config.dart';
import 'pages/home.dart';
import 'pages/receive.dart';
import 'pages/pick.dart';
import 'pages/stock.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, publishableKey: supabaseKey);
  runApp(const WarehouseApp());
}

const brand = Color(0xFF0E7490);

class WarehouseApp extends StatelessWidget {
  const WarehouseApp({super.key});
  ThemeData _theme(Brightness b) => ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: brand, brightness: b),
        useMaterial3: true,
        cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
      );
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Wavely 仓库助手',
        debugShowCheckedModeBanner: false,
        theme: _theme(Brightness.light),
        darkTheme: _theme(Brightness.dark),
        // 平板 / 桌面浏览器上所有页面（含详情页）居中限宽，像手机一样操作
        builder: (context, child) => ColoredBox(
          color: Theme.of(context).colorScheme.surface,
          child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 560), child: child)),
        ),
        home: const _Boot(),
      );
}

// 首次进入匿名登录（与 ERP 访客一致，无需注册）
class _Boot extends StatefulWidget {
  const _Boot();
  @override
  State<_Boot> createState() => _BootState();
}

class _BootState extends State<_Boot> {
  late Future<void> _ready = ensureSignedIn();
  @override
  Widget build(BuildContext context) => FutureBuilder(
        future: _ready,
        builder: (context, snap) {
          if (snap.hasError) {
            return Scaffold(body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('连接失败：${snap.error}', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => setState(() => _ready = ensureSignedIn()), child: const Text('重试')),
            ])));
          }
          if (snap.connectionState != ConnectionState.done) return const Scaffold(body: Center(child: CircularProgressIndicator()));
          return const Shell();
        },
      );
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => ShellState();
  static ShellState of(BuildContext context) => context.findAncestorStateOfType<ShellState>()!;
}

class ShellState extends State<Shell> {
  int index = 0;
  int refreshTick = 0;   // 收货 / 发货后让首页计数刷新
  void go(int i) => setState(() => index = i);
  void changed() => setState(() => refreshTick++);

  @override
  Widget build(BuildContext context) {
    final pages = [HomePage(key: ValueKey('home$refreshTick')), const ReceivePage(), const PickPage(), const StockPage()];
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: index, children: pages),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: go,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.space_dashboard_outlined), selectedIcon: Icon(Icons.space_dashboard), label: '首页'),
          NavigationDestination(icon: Icon(Icons.move_to_inbox_outlined), selectedIcon: Icon(Icons.move_to_inbox), label: '收货'),
          NavigationDestination(icon: Icon(Icons.local_shipping_outlined), selectedIcon: Icon(Icons.local_shipping), label: '拣货发货'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: '库存'),
        ],
      ),
    );
  }
}
