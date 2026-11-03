import polyglotI18nProvider from 'ra-i18n-polyglot';
import englishMessages from 'ra-language-english';
import chinese from '@haxqer/ra-language-chinese';
import { mergeTranslations } from 'react-admin';

const zh = chinese.default ?? chinese;

const custom = {
  // 中文包的复数写法让 polyglot 总取第一种形式，这里改成单一形式
  ra: { action: { bulk_actions: '已选 %{smart_count} 项' } },
  resources: {
    orders: { name: '订单 |||| 订单', fields: { order_no: '订单号', shop_id: '店铺', customer_id: '客户', currency: '币种', total_amount: '订单金额', total_usd: '折合美元', country: '国家', status: '状态', source: '来源', created_at: '下单时间' } },
    products: { name: '商品 |||| 商品', fields: { sku: 'SKU', category: '类目', cost_cny: '采购成本 (¥)', price_usd: '售价 ($)', weight_g: '重量 (g)', status: '状态', image_url: '图片地址' } },
    v_skus: { name: 'SKU |||| SKU', fields: { sku: 'SKU', product_name: '商品名', barcode: '条码', category: '类目', status: '状态', low_stock: '低库存' } },
    skus: { name: 'SKU |||| SKU' },
    v_inventory: { name: '库存 |||| 库存', fields: { sku: 'SKU', product_name: '商品', warehouse_name: '仓库', warehouse_kind: '仓库类型', qty: '可用库存', safety_qty: '安全库存', low_stock: '低库存' } },
    inventory: { name: '库存 |||| 库存', fields: { qty: '可用库存', safety_qty: '安全库存' } },
    shops: { name: '店铺 |||| 店铺', fields: { platform: '平台', name: '店铺名', country: '站点', currency: '结算币种', created_at: '开通时间' } },
    customers: { name: '客户 |||| 客户', fields: { name: '姓名', email: '邮箱', country: '国家', created_at: '注册时间' } },
    shipments: { name: '物流 |||| 物流', fields: { order_id: '订单', carrier: '承运商', tracking_no: '运单号', status: '物流状态', updated_at: '最近更新' } },
    exchange_rates: { name: '汇率 |||| 汇率', fields: { currency: '币种', rate_to_usd: '1 单位 = ? USD', updated_at: '更新时间' } },
    warehouses: { name: '仓库 |||| 仓库' },
  },
};

const messages = mergeTranslations(englishMessages, zh, custom);

export const i18nProvider = polyglotI18nProvider(() => messages, 'zh', [{ locale: 'zh', name: '中文' }], { allowMissing: true });
