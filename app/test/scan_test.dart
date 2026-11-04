import 'package:flutter_test/flutter_test.dart';
import 'package:wavely_warehouse/api.dart';
import 'package:wavely_warehouse/widgets/scan.dart';

void main() {
  test('扫码匹配条码或 SKU，不区分大小写与首尾空格', () {
    final sku = {'sku': 'WV-PET-001-2L', 'barcode': '6970000000017'};
    expect(matchesCode(sku, '6970000000017'), isTrue);
    expect(matchesCode(sku, ' wv-pet-001-2l '), isTrue);
    expect(matchesCode(sku, 'WV-PET-001'), isFalse);
    expect(matchesCode(null, 'x'), isFalse);
    expect(matchesCode({'sku': 'A', 'barcode': null}, 'A'), isTrue);
  });

  test('多语言字段取中文，缺失时回退英文', () {
    expect(zh({'zh': '猫抓板', 'en': 'Cat'}), '猫抓板');
    expect(zh({'en': 'Cat'}), 'Cat');
    expect(zh(null), '');
  });
}
