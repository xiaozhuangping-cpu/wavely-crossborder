export const LANGS = { en: 'English', de: 'Deutsch', zh: '中文', ja: '日本語', es: 'Español' };

const dict = {
  en: {
    zoomHint: 'Roll over image to zoom in', tapZoom: 'Tap image to view full size', dblZoom: 'Double-tap to zoom in / out',
    chooseOption: 'Choose option', from: 'From',
    tagline: 'Thoughtful things for home, pets & the outdoors', heroTitle: 'Small upgrades,\nbig everyday joy', heroSub: 'Designed in Shenzhen, shipped worldwide from our local warehouses.',
    shopNow: 'Shop now', all: 'All', freeShip: 'Free worldwide shipping', returns: '30-day returns', fastShip: 'Ships in 24h from local warehouses',
    addToCart: 'Add to cart', added: 'Added', cart: 'Cart', emptyCart: 'Your cart is empty', subtotal: 'Subtotal', shipping: 'Shipping', free: 'Free', total: 'Total',
    checkout: 'Checkout', continueShopping: 'Continue shopping', qty: 'Qty', remove: 'Remove', track: 'Track order', products: 'Products',
    name: 'Full name', email: 'Email', country: 'Country', address: 'Address', placeOrder: 'Place order', placing: 'Placing…',
    demoNote: 'Demo store — no real payment is taken. Please do not enter real personal information.',
    thanks: 'Thank you for your order!', orderNo: 'Order number', orderSynced: 'This order has just appeared in the Wavely ERP back office. It will be shipped automatically within about an hour.',
    viewInErp: 'See it in the ERP', trackHint: 'Enter your order number', trackBtn: 'Track', notFound: 'Order not found', myOrders: 'My recent orders',
    status: { pending: 'Pending', paid: 'Paid · preparing', shipped: 'Shipped', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' },
    notShipped: 'Not shipped yet', details: 'Details', back: 'Back', weight: 'Weight', category: 'Category', sku: 'SKU', inStock: 'In stock',
    chatTitle: 'Wavely Assistant', chatHello: 'Hi! How can I help?', chatSub: 'Ask me about products, shipping, returns or your order.',
    chatPlaceholder: 'Type a message…', chatNote: 'AI assistant powered by DeepSeek · may make mistakes',
    sugg: ['Gift ideas under $30 for a cat owner', 'How long does shipping to Germany take?', 'What is your return policy?', 'Where is my order?'],
    cats: { 家居: 'Home', 户外: 'Outdoor', 宠物: 'Pets', 美妆: 'Beauty', 数码配件: 'Tech' }, aiNote: 'This demo store was built with AI assistance.',
  },
  de: {
    zoomHint: 'Zum Vergrößern mit der Maus über das Bild fahren', tapZoom: 'Zum Vergrößern auf das Bild tippen', dblZoom: 'Doppeltippen zum Vergrößern / Verkleinern',
    chooseOption: 'Option wählen', from: 'Ab',
    tagline: 'Durchdachte Dinge für Zuhause, Haustiere & draußen', heroTitle: 'Kleine Upgrades,\ngroße Alltagsfreude', heroSub: 'Entworfen in Shenzhen, versendet aus lokalen Lagern weltweit.',
    shopNow: 'Jetzt shoppen', all: 'Alle', freeShip: 'Kostenloser Versand weltweit', returns: '30 Tage Rückgaberecht', fastShip: 'Versand in 24 h aus lokalem Lager',
    addToCart: 'In den Warenkorb', added: 'Hinzugefügt', cart: 'Warenkorb', emptyCart: 'Dein Warenkorb ist leer', subtotal: 'Zwischensumme', shipping: 'Versand', free: 'Kostenlos', total: 'Gesamt',
    checkout: 'Zur Kasse', continueShopping: 'Weiter einkaufen', qty: 'Menge', remove: 'Entfernen', track: 'Sendungsverfolgung', products: 'Produkte',
    name: 'Vollständiger Name', email: 'E-Mail', country: 'Land', address: 'Adresse', placeOrder: 'Bestellung aufgeben', placing: 'Wird gesendet…',
    demoNote: 'Demo-Shop – es wird keine echte Zahlung ausgeführt. Bitte keine echten persönlichen Daten eingeben.',
    thanks: 'Vielen Dank für deine Bestellung!', orderNo: 'Bestellnummer', orderSynced: 'Diese Bestellung erscheint jetzt im Wavely-ERP und wird in etwa einer Stunde automatisch versendet.',
    viewInErp: 'Im ERP ansehen', trackHint: 'Bestellnummer eingeben', trackBtn: 'Suchen', notFound: 'Bestellung nicht gefunden', myOrders: 'Meine letzten Bestellungen',
    status: { pending: 'Ausstehend', paid: 'Bezahlt · in Vorbereitung', shipped: 'Versendet', in_transit: 'Unterwegs', delivered: 'Zugestellt', cancelled: 'Storniert', refunded: 'Erstattet' },
    notShipped: 'Noch nicht versendet', details: 'Details', back: 'Zurück', weight: 'Gewicht', category: 'Kategorie', sku: 'SKU', inStock: 'Auf Lager',
    chatTitle: 'Wavely Assistent', chatHello: 'Hallo! Wie kann ich helfen?', chatSub: 'Frag mich zu Produkten, Versand, Rückgabe oder deiner Bestellung.',
    chatPlaceholder: 'Nachricht eingeben…', chatNote: 'KI-Assistent mit DeepSeek · kann Fehler machen',
    sugg: ['Geschenkideen unter 30 $ für Katzenfreunde', 'Wie lange dauert der Versand nach Deutschland?', 'Wie funktioniert die Rückgabe?', 'Wo ist meine Bestellung?'],
    cats: { 家居: 'Zuhause', 户外: 'Outdoor', 宠物: 'Haustiere', 美妆: 'Beauty', 数码配件: 'Technik' }, aiNote: 'Dieser Demo-Shop wurde mit KI-Unterstützung erstellt.',
  },
  zh: {
    zoomHint: '将鼠标悬停在图片上即可放大', tapZoom: '点击查看大图', dblZoom: '双击放大 / 缩小',
    chooseOption: '选择规格', from: '起',
    tagline: '为家居、宠物与户外生活精选好物', heroTitle: '小小升级，\n日常大大满足', heroSub: '深圳设计，海外仓本地发货，送达全球。',
    shopNow: '立即选购', all: '全部', freeShip: '全球包邮', returns: '30 天无忧退货', fastShip: '海外仓 24 小时内发货',
    addToCart: '加入购物车', added: '已加入', cart: '购物车', emptyCart: '购物车是空的', subtotal: '小计', shipping: '运费', free: '免费', total: '合计',
    checkout: '去结账', continueShopping: '继续逛逛', qty: '数量', remove: '移除', track: '订单追踪', products: '商品',
    name: '姓名', email: '邮箱', country: '国家/地区', address: '地址', placeOrder: '提交订单', placing: '提交中…',
    demoNote: '演示站，不会真实扣款，请勿填写真实个人信息。',
    thanks: '感谢下单！', orderNo: '订单号', orderSynced: '这笔订单已同步到 Wavely ERP 后台，约 1 小时后会自动发货。',
    viewInErp: '去 ERP 里看看', trackHint: '输入订单号', trackBtn: '查询', notFound: '没有找到这笔订单', myOrders: '我最近的订单',
    status: { pending: '待付款', paid: '已付款 · 备货中', shipped: '已发货', in_transit: '运输中', delivered: '已签收', cancelled: '已取消', refunded: '已退款' },
    notShipped: '尚未发货', details: '详情', back: '返回', weight: '重量', category: '类目', sku: 'SKU', inStock: '有现货',
    chatTitle: 'Wavely 客服助手', chatHello: '你好！有什么可以帮你？', chatSub: '可以问我商品推荐、运费时效、退换货或订单物流。',
    chatPlaceholder: '输入消息…', chatNote: 'AI 客服由 DeepSeek 驱动 · 可能出错',
    sugg: ['30 美元以内送养猫朋友的礼物', '寄到德国要多久？', '退货政策是怎样的？', '我的订单到哪了？'],
    cats: { 家居: '家居', 户外: '户外', 宠物: '宠物', 美妆: '美妆', 数码配件: '数码配件' }, aiNote: '本演示站由 AI 辅助生成。',
  },
  ja: {
    zoomHint: '画像にマウスを合わせると拡大されます', tapZoom: 'タップして拡大表示', dblZoom: 'ダブルタップで拡大 / 縮小',
    chooseOption: 'オプションを選ぶ', from: '〜',
    tagline: '暮らし・ペット・アウトドアのための小さな名品', heroTitle: '小さな工夫で、\n毎日をもっと快適に', heroSub: '深圳でデザイン、現地倉庫から世界へお届け。',
    shopNow: '今すぐ見る', all: 'すべて', freeShip: '全世界送料無料', returns: '30日間返品OK', fastShip: '現地倉庫から24時間以内に発送',
    addToCart: 'カートに入れる', added: '追加済み', cart: 'カート', emptyCart: 'カートは空です', subtotal: '小計', shipping: '送料', free: '無料', total: '合計',
    checkout: 'レジに進む', continueShopping: '買い物を続ける', qty: '数量', remove: '削除', track: '注文追跡', products: '商品',
    name: 'お名前', email: 'メール', country: '国・地域', address: '住所', placeOrder: '注文する', placing: '送信中…',
    demoNote: 'デモストアのため実際の決済は行われません。実在の個人情報は入力しないでください。',
    thanks: 'ご注文ありがとうございます！', orderNo: '注文番号', orderSynced: 'この注文は Wavely ERP に同期されました。約1時間後に自動で発送されます。',
    viewInErp: 'ERP で確認する', trackHint: '注文番号を入力', trackBtn: '検索', notFound: '注文が見つかりません', myOrders: '最近の注文',
    status: { pending: '支払い待ち', paid: '支払い済み・準備中', shipped: '発送済み', in_transit: '輸送中', delivered: 'お届け済み', cancelled: 'キャンセル', refunded: '返金済み' },
    notShipped: '未発送', details: '詳細', back: '戻る', weight: '重量', category: 'カテゴリ', sku: 'SKU', inStock: '在庫あり',
    chatTitle: 'Wavely アシスタント', chatHello: 'こんにちは！何かお手伝いしましょうか？', chatSub: '商品選び、配送、返品、注文状況などお気軽にどうぞ。',
    chatPlaceholder: 'メッセージを入力…', chatNote: 'AI アシスタント（DeepSeek）· 誤りを含む場合があります',
    sugg: ['猫好きへの30ドル以内のギフト', 'ドイツまで何日かかりますか？', '返品ポリシーは？', '注文はどこにありますか？'],
    cats: { 家居: 'ホーム', 户外: 'アウトドア', 宠物: 'ペット', 美妆: 'ビューティー', 数码配件: 'ガジェット' }, aiNote: 'このデモストアは AI の支援を受けて作成されました。',
  },
  es: {
    zoomHint: 'Pasa el ratón por la imagen para ampliarla', tapZoom: 'Toca la imagen para verla a tamaño completo', dblZoom: 'Toca dos veces para ampliar / reducir',
    chooseOption: 'Elegir opción', from: 'Desde',
    tagline: 'Cosas bien pensadas para el hogar, mascotas y aire libre', heroTitle: 'Pequeñas mejoras,\ngran alegría diaria', heroSub: 'Diseñado en Shenzhen, enviado desde almacenes locales.',
    shopNow: 'Comprar', all: 'Todo', freeShip: 'Envío gratis a todo el mundo', returns: 'Devolución en 30 días', fastShip: 'Envío en 24h desde almacén local',
    addToCart: 'Añadir al carrito', added: 'Añadido', cart: 'Carrito', emptyCart: 'Tu carrito está vacío', subtotal: 'Subtotal', shipping: 'Envío', free: 'Gratis', total: 'Total',
    checkout: 'Pagar', continueShopping: 'Seguir comprando', qty: 'Cant.', remove: 'Quitar', track: 'Seguir pedido', products: 'Productos',
    name: 'Nombre completo', email: 'Correo', country: 'País', address: 'Dirección', placeOrder: 'Realizar pedido', placing: 'Enviando…',
    demoNote: 'Tienda de demostración: no se realiza ningún cobro. No introduzcas datos personales reales.',
    thanks: '¡Gracias por tu pedido!', orderNo: 'Número de pedido', orderSynced: 'Este pedido ya aparece en el ERP de Wavely y se enviará automáticamente en aproximadamente una hora.',
    viewInErp: 'Verlo en el ERP', trackHint: 'Introduce tu número de pedido', trackBtn: 'Buscar', notFound: 'Pedido no encontrado', myOrders: 'Mis pedidos recientes',
    status: { pending: 'Pendiente', paid: 'Pagado · preparando', shipped: 'Enviado', in_transit: 'En tránsito', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado' },
    notShipped: 'Aún no enviado', details: 'Detalles', back: 'Volver', weight: 'Peso', category: 'Categoría', sku: 'SKU', inStock: 'En stock',
    chatTitle: 'Asistente Wavely', chatHello: '¡Hola! ¿En qué te ayudo?', chatSub: 'Pregúntame por productos, envíos, devoluciones o tu pedido.',
    chatPlaceholder: 'Escribe un mensaje…', chatNote: 'Asistente con IA (DeepSeek) · puede cometer errores',
    sugg: ['Regalos de menos de $30 para amantes de los gatos', '¿Cuánto tarda el envío a Alemania?', '¿Cuál es la política de devoluciones?', '¿Dónde está mi pedido?'],
    cats: { 家居: 'Hogar', 户外: 'Exterior', 宠物: 'Mascotas', 美妆: 'Belleza', 数码配件: 'Tecnología' }, aiNote: 'Esta tienda de demostración se creó con ayuda de IA.',
  },
};

export const t = (lang) => dict[lang] ?? dict.en;

export const detectLang = () => {
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('zh') ? 'zh' : n.startsWith('ja') ? 'ja' : n.startsWith('es') ? 'es' : n.startsWith('de') ? 'de' : 'en';
};

// 商品名/描述按语言取值：优先 AI 生成的 Listing，其次多语言字段，最后英文
export const productTitle = (p, lang) => p?.listing?.[lang]?.title || p?.name?.[lang] || p?.name?.en || p?.name?.zh || '';
export const productName = (p, lang) => p?.name?.[lang] || p?.name?.en || p?.name?.zh || '';
export const productDesc = (p, lang) => p?.listing?.[lang]?.description || p?.description?.[lang] || p?.description?.en || p?.description?.zh || '';
export const productBullets = (p, lang) => p?.listing?.[lang]?.bullets ?? [];
