// 扫码输入：一个文本框兼容 PDA / 扫码枪（键盘输入 + 回车），旁边的相机按钮用 mobile_scanner 扫条码
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class ScanField extends StatefulWidget {
  final ValueChanged<String> onCode;
  final String hint;
  const ScanField({super.key, required this.onCode, this.hint = '扫描或输入条码 / SKU，回车确认'});
  @override
  State<ScanField> createState() => _ScanFieldState();
}

class _ScanFieldState extends State<ScanField> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();

  void _submit(String v) {
    final code = v.trim();
    if (code.isEmpty) return;
    widget.onCode(code);
    _ctrl.clear();
    _focus.requestFocus();   // 连续扫码
  }

  Future<void> _camera() async {
    final code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      builder: (_) => const _CameraSheet(),
    );
    if (code != null) _submit(code);
  }

  @override
  void dispose() { _ctrl.dispose(); _focus.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _ctrl,
        focusNode: _focus,
        textInputAction: TextInputAction.done,
        onSubmitted: _submit,
        decoration: InputDecoration(
          hintText: widget.hint,
          prefixIcon: const Icon(Icons.qr_code_scanner),
          suffixIcon: IconButton(tooltip: '用相机扫码', icon: const Icon(Icons.photo_camera_outlined), onPressed: _camera),
          filled: true,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        ),
      );
}

class _CameraSheet extends StatefulWidget {
  const _CameraSheet();
  @override
  State<_CameraSheet> createState() => _CameraSheetState();
}

class _CameraSheetState extends State<_CameraSheet> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.ean13, BarcodeFormat.code128, BarcodeFormat.qrCode]);
  bool _done = false;

  @override
  void dispose() { _controller.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Stack(children: [
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              final code = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
              if (code == null || _done) return;
              _done = true;
              Navigator.of(context).pop(code);
            },
            errorBuilder: (context, error) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('无法打开相机：${error.errorCode.name}\n可以直接在输入框里输入条码', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
              ),
            ),
          ),
          Center(child: Container(width: 260, height: 160, decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 2), borderRadius: BorderRadius.circular(16)))),
          Positioned(top: 8, right: 8, child: IconButton(color: Colors.white, icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop())),
          const Positioned(left: 0, right: 0, bottom: 24, child: Text('把条码放进框内', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70))),
        ]),
      );
}

/// SKU 缩略图（无边框，与 ERP / 独立站一致）
class SkuThumb extends StatelessWidget {
  final String? url;
  final double size;
  const SkuThumb(this.url, {super.key, this.size = 48});
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: size, height: size, color: Colors.white,
          child: url == null || url!.isEmpty
              ? const Icon(Icons.inventory_2_outlined, color: Colors.black26)
              : Image.network(url!, fit: BoxFit.contain, errorBuilder: (_, _, _) => const Icon(Icons.inventory_2_outlined, color: Colors.black26)),
        ),
      );
}

/// 匹配扫码结果：条码或 SKU 编码（不区分大小写）
bool matchesCode(Map<String, dynamic>? sku, String code) {
  if (sku == null) return false;
  final c = code.trim().toUpperCase();
  return (sku['barcode'] ?? '').toString().toUpperCase() == c || (sku['sku'] ?? '').toString().toUpperCase() == c;
}
