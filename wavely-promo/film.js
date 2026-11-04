// film.js — Wavely 宣传片：一张货源卡走完整条跨境链路（暗色科技发布风格）
// 画面 = render(t) 的纯函数；所有时间点来自下方 K（与配乐、混音、字幕共用 timeline.json）
import * as E from './engine.js';
const { W, H, PAL, clamp, lerp, seg, ss, eo, ei, eio, back, mulberry, hash, TAU, font, rr, panel, rgba } = E;
E.setAccent('#34E0C4');

// ───────────────────────── 时间线（100 BPM，1 拍 0.6 s）─────────────────────────
export const BPM = 100, B = 0.6, S16 = 0.15;
export const K = {
  freeze: 8.4, click: 9.6, retract: [9.6, 9.9, 10.2, 10.5], src: 10.5, ticks: [12.0, 12.6, 13.2], popup: 11.7,
  collect: 14.4, dive: 15.6, loc: 16.8, ai: 17.4, rows: [18.0, 18.6, 19.2, 19.8], price: 21.0, toStore: 22.6,
  store: 23.4, tiles: 24.0, snap: 25.2, langs: [25.8, 26.1, 26.4], expand: 27.0, film: 27.4, buy: 30.6,
  orders: 31.2, ship: 36.0, scans: [37.2, 38.4], confirm: 39.6, drain: 40.8, repl: 43.2, sugLock: 44.4,
  genPO: 45.0, submit: 45.6, role: 46.8, push: 47.4, approve: 49.2, hush: 50.0, whip: 50.4, loop: 51.0,
  fold: 52.8, num: 53.4, end: 55.8, cards: 56.6, putAway: 62.0, off: 62.5,
};
export const DUR = 63.0;
export const VO = { l1: 1.2, l2: 10.2, l3: 17.4, l4: 25.8, l5: 31.8, l6: 36.6, l7: 43.8, l8: 56.2 };
let LINES = [];
export function setVoice(lines, dur) {
  LINES = lines.map(l => { const t0 = VO[l.id], d = dur[l.id] || 3; return { id: l.id, text: l.text, t0, t1: Math.max(t0 + 1.8, t0 + d + 0.6) }; });
}
export const subs = () => LINES.map(l => ({ t0: l.t0, t1: l.t1, text: l.text }));

// ───────────────────────── 素材 ─────────────────────────
const IMG = {}, FILM = [];
const SKUS = ['ELE-001', 'ELE-001-BLK', 'ELE-002', 'ELE-003', 'ELE-004', 'HOM-001', 'HOM-002', 'HOM-003', 'HOM-004', 'OUT-001', 'OUT-002', 'OUT-003', 'PET-001', 'PET-002', 'PET-003', 'BEA-001', 'BEA-002'];
const load = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
export async function loadAssets() {
  await Promise.all(SKUS.map(async s => { IMG[s] = await load(`assets/products/WV-${s}.jpg`); }));
  const fr = await Promise.all(Array.from({ length: 110 }, (_, i) => load(`assets/film/f_${String(i).padStart(3, '0')}.jpg`)));
  FILM.push(...fr.filter(Boolean));
}
const P = {   // 商品：名称（中 / 英 / 日 / 西）、成本、售价
  'ELE-001': ['三合一磁吸无线充', '3-in-1 Magnetic Wireless Charger', '3in1 マグネットワイヤレス充電器', 'Cargador magnético 3 en 1', 58, 39.99],
  'HOM-003': ['感应夜灯（3 只装）', 'Motion Sensor Night Light', '人感センサーライト 3個', 'Luz nocturna con sensor', 32, 27.99],
  'OUT-001': ['超轻户外折叠椅', 'Ultralight Camping Chair', '超軽量キャンプチェア', 'Silla de camping ultraligera', 68, 49.99],
  'ELE-002': ['氮化镓快充 65W', '65W GaN Charger', '65W GaN 充電器', 'Cargador GaN 65W', 48, 32.99],
  'PET-001': ['智能宠物饮水机', 'Smart Pet Water Fountain', 'ペット自動給水器', 'Fuente para mascotas', 85, 45.99],
  'BEA-001': ['便携补水喷雾仪', 'Nano Facial Mister', 'ナノミスト美顔器', 'Nebulizador facial', 24, 19.99],
  'ELE-004': ['降噪蓝牙耳机', 'ANC Wireless Earbuds', 'ノイキャンイヤホン', 'Auriculares ANC', 95, 59.99],
  'HOM-002': ['磁吸厨房置物架', 'Magnetic Kitchen Rack', 'マグネットキッチンラック', 'Estante magnético', 26, 22.99],
  'OUT-003': ['保温随行杯 600ml', 'Insulated Tumbler 600ml', '真空断熱タンブラー', 'Vaso térmico 600ml', 22, 24.99],
  'PET-002': ['猫抓板沙发', 'Cat Scratcher Lounge', '爪とぎソファ', 'Rascador sofá', 28, 29.99],
  'BEA-002': ['LED 化妆镜', 'LED Makeup Mirror', 'LED女優ミラー', 'Espejo LED', 45, 34.99],
  'OUT-002': ['便携太阳能充电宝', 'Solar Power Bank', 'ソーラーバッテリー', 'Batería solar', 75, 39.99],
  'HOM-001': ['折叠硅胶收纳篮', 'Collapsible Silicone Basket', '折りたたみシリコンバスケット', 'Cesta plegable de silicona', 18.5, 15.99],
  'ELE-003': ['机械键盘手托', 'Wooden Wrist Rest', '木製パームレスト', 'Reposamuñecas', 30, 25.99],
};

// ───────────────────────── 小工具 ─────────────────────────
let COLLECT = false, TX = [];
/** 文字；o.id 时登记到 TEXTS（readcheck 用，按当前变换算屏幕框） */
function T(g, s, x, y, o = {}) {
  const { px = 20, wt = 500, fam = 'ui', col = PAL.text, align = 'left', base = 'alphabetic', alpha = 1, ls = 0, id = null } = o;
  if (alpha <= 0.001) return 0;
  g.save(); g.globalAlpha *= alpha; g.font = font(px, wt, fam); g.fillStyle = col; g.textAlign = align; g.textBaseline = base;
  if (ls) g.letterSpacing = `${ls}px`;
  g.fillText(s, x, y); const w = g.measureText(s).width;
  if (COLLECT && id && g.globalAlpha > 0.5) {
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y0 = base === 'middle' ? y - px * 0.6 : base === 'top' ? y : y - px;
    const m = g.getTransform(), pt = (a, b) => [m.a * a + m.c * b + m.e, m.b * a + m.d * b + m.f];
    const [ax, ay] = pt(x0, y0), [bx, by] = pt(x0 + w, y0 + px * 1.2);
    TX.push({ id, text: s, x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) });
  }
  g.restore(); return w;
}
function pic(g, im, x, y, w, h, r = 12, alpha = 1) {
  g.save(); g.globalAlpha *= alpha; rr(g, x, y, w, h, r); g.clip();
  if (im) { const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s; g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
  else { g.fillStyle = PAL.surf3; g.fillRect(x, y, w, h); }
  g.restore();
}
const lr = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));     // 矩形插值
function crtOff(g, rect, p, draw) {   // 收起：先压成一条线，再缩成一点
  if (p >= 1) return; if (p <= 0) { draw(); return; }
  const [x, y, w, h] = rect, cx = x + w / 2, cy = y + h / 2;
  const sy = p < 0.6 ? lerp(1, 0.015, ei(p / 0.6)) : 0.015, sx = p < 0.6 ? 1 : lerp(1, 0, ei((p - 0.6) / 0.4));
  g.save(); g.translate(cx, cy); g.scale(sx, sy); g.translate(-cx, -cy);
  if (p > 0.45) { g.globalAlpha *= 1 - seg(p, 0.85, 1); } draw();
  if (p > 0.3) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * seg(p, 0.3, 0.6); g.fillStyle = '#C9D3E6'; g.fillRect(x, y, w, h); }
  g.restore();
}
function popIn(g, cx, cy, p, draw, s0 = 0.6) {   // 弹出：缩放回弹
  if (p <= 0) return; const s = lerp(s0, 1, back(p, 2.2));
  g.save(); g.globalAlpha *= clamp(p * 3); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); draw(); g.restore();
}
function windowFrame(g, x, y, w, h, title, o = {}) {
  const { bar = 44, alpha = 1, mono = null } = o;
  g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, w, h, { r: 16, fill: PAL.surf, shadow: 1 });
  g.fillStyle = 'rgba(255,255,255,.025)'; rr(g, x + 1, y + 1, w - 2, bar, 16); g.fill();
  g.fillStyle = PAL.line; g.fillRect(x, y + bar, w, 1);
  waveMark(g, x + 24, y + bar / 2, 22, { neutral: true });
  T(g, title, x + 46, y + bar / 2 + 1, { px: 15, wt: 500, col: PAL.dim, base: 'middle' });
  if (mono) T(g, mono, x + w - 18, y + bar / 2 + 1, { px: 13, fam: 'mono', col: PAL.mute, base: 'middle', align: 'right' });
  g.restore();
  return [x, y + bar + 1, w, h - bar - 1];
}
/** Wavely 标志：圆角方块 + 一道波浪（neutral 时用文字色，只有片尾用强调色） */
function waveMark(g, x, y, s, o = {}) {
  const { neutral = false, ph = 0, alpha = 1, amp = 1 } = o;
  g.save(); g.globalAlpha *= alpha;
  panel(g, x - s / 2, y - s / 2, s, s, { r: s * 0.28, fill: PAL.surf3, shadow: neutral ? 0 : 0.6, hi: neutral ? 0 : 1 });
  const c = neutral ? PAL.dim : PAL.accent;
  g.strokeStyle = c; g.lineWidth = Math.max(1.5, s * 0.09); g.lineCap = 'round';
  if (!neutral) { g.shadowColor = rgba(PAL.accent, 0.8); g.shadowBlur = s * 0.2; }
  g.beginPath();
  for (let i = 0; i <= 40; i++) { const u = i / 40, X = x - s * 0.28 + u * s * 0.56, Y = y + Math.sin(u * TAU * 1.25 + ph) * s * 0.11 * amp; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  g.stroke(); g.restore();
}
const ARROW = [[0, 0], [0, 27], [6.5, 21], [11, 31.5], [15.5, 29.6], [11, 19.8], [19.5, 19.8]];
/** 光标（用户 = 强调色）：tip 在 (x,y)；k 为按压缩放 */
function cursor(g, x, y, o = {}) {
  const { s = 1.6, k = 1, alpha = 1 } = o; if (alpha <= 0.01) return;
  const p = new Path2D(); ARROW.forEach(([a, b], i) => { const X = x + a * s * k, Y = y + b * s * k; i ? p.lineTo(X, Y) : p.moveTo(X, Y); }); p.closePath();
  E.litShape(g, p, { accent: true, glowR: 16, alpha, bbox: [x, y, 20 * s, 32 * s] });
}
/** 按压曲线：≥ 8 帧预备（放大）→ 2 帧接触（压扁）→ 弹簧回位 */
function press(t, tp) {
  if (t < tp - 0.36 || t > tp + 0.9) return 1;
  if (t < tp) return 1 + 0.14 * ei(seg(t, tp - 0.36, tp));
  if (t < tp + 2 / 24) return 0.76;
  const d = t - tp - 2 / 24; return 1 - 0.24 * Math.exp(-d * 8) * Math.cos(d * 26);
}
function ring(g, x, y, d, o = {}) {   // 点击涟漪
  const { r0 = 6, r1 = 46, dur = 0.45, color = PAL.accent } = o; if (d < 0 || d > dur) return;
  const p = d / dur; g.save(); g.strokeStyle = rgba(color, 0.7 * (1 - p)); g.lineWidth = 2.5 * (1 - p) + 0.5;
  g.beginPath(); g.arc(x, y, lerp(r0, r1, eo(p)), 0, TAU); g.stroke(); g.restore();
}
function pill(g, x, y, text, o = {}) {   // 状态胶囊（左上锚点）
  const { px = 14, col = PAL.dim, fill = 'rgba(255,255,255,.06)', stroke = PAL.line, alpha = 1, fam = 'ui', wt = 600, id = null } = o;
  g.save(); g.globalAlpha *= alpha; g.font = font(px, wt, fam);
  const w = g.measureText(text).width + px * 1.4, h = px * 1.9;
  g.fillStyle = fill; rr(g, x, y, w, h, h / 2); g.fill(); g.strokeStyle = stroke; g.lineWidth = 1; rr(g, x + 0.5, y + 0.5, w - 1, h - 1, h / 2); g.stroke();
  T(g, text, x + w / 2, y + h / 2 + 1, { px, wt, col, align: 'center', base: 'middle', fam, id });
  g.restore(); return w;
}
function button(g, x, y, w, h, text, o = {}) {
  const { lit = 0, px = 18, dis = false, alpha = 1, id = null, sub = null } = o;
  g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, w, h, { r: 12, fill: dis ? '#161A22' : PAL.surf3, shadow: 0.5 });
  if (lit > 0) { const p = new Path2D(); p.roundRect(x, y, w, h, 12); E.litShape(g, p, { accent: true, glowR: 24, alpha: lit, bbox: [x, y, w, h] }); }
  T(g, text, x + w / 2, y + h / 2 + 1, { px, wt: 600, col: lit > 0.5 ? '#06231E' : dis ? PAL.mute : PAL.text, align: 'center', base: 'middle', id });
  if (sub) T(g, sub, x + w / 2, y + h + 22, { px: 13, fam: 'mono', col: PAL.mute, align: 'center' });
  g.restore();
}
function check(g, x, y, s, col = '#0B0D12') {
  g.save(); g.strokeStyle = col; g.lineWidth = s * 0.14; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - s * 0.28, y); g.lineTo(x - s * 0.06, y + s * 0.22); g.lineTo(x + s * 0.3, y - s * 0.2); g.stroke(); g.restore();
}
/** 文字乱码锁定：每个字在 [t0,t1] 内从左到右按 1/24 s 量化锁定；未锁定显示同类随机字形 */
const LAT = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz0123456789#%&*+=<>?';
function scrambleText(g, text, x, y, t, t0, t1, o = {}) {
  const { px = 26, wt = 500, fam = 'ui', col = PAL.text, noise = PAL.dim, id = null } = o;
  if (t < t0) return;
  const chars = [...text], n = chars.length, pool = chars.filter(c => c !== ' ');
  g.save(); g.font = font(px, wt, fam); g.textBaseline = 'alphabetic';
  let cx = x; const f = Math.floor(t * 24);
  chars.forEach((ch, i) => {
    const w = g.measureText(ch).width, lk = Math.round((t0 + (t1 - t0) * (i + 1) / n) * 24) / 24;
    if (t >= lk) { const d = t - lk, dy = d < 0.25 ? -px * 0.14 * Math.exp(-d * 16) * Math.cos(d * 38) : 0; g.fillStyle = col; g.fillText(ch, cx, y + dy); }
    else if (ch !== ' ') {
      const cjk = /[　-鿿]/.test(ch), src = cjk ? pool : LAT, gch = src[Math.floor(hash(f * 7.3 + i * 13.1) * src.length)];
      g.fillStyle = noise; g.globalAlpha = 0.75; g.fillText(gch, cx + (w - g.measureText(gch).width) / 2, y); g.globalAlpha = 1;
    }
    cx += w;
  });
  g.restore();
  if (COLLECT && id && t >= t1) T(g, text, x, y, { px, wt, fam, alpha: 0, id });   // 只为登记（alpha 0 不画）
}
function bez(a, c, b, u) { const v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }
function flight(g, a, c, b, p, color, w = 6) {   // 沿弧线飞行的光迹
  if (p <= 0 || p >= 1.25) return;
  const pts = []; for (let i = 0; i <= 12; i++) { const u = clamp(p - 0.35 + 0.35 * i / 12); pts.push(bez(a, c, b, eo(u))); }
  E.trail(g, pts, { color, width: w, alpha: 1 - seg(p, 1, 1.25) });
}

// ───────────────────────── 镜头 ─────────────────────────
const logz = (a, b, p) => Math.exp(lerp(Math.log(a), Math.log(b), p));
let LIFT = 0;
function cam(x, y, zoom, rot = 0, sx = 0, sy = 0) { return E.camera({ x, y, zoom, rot, sx, sy: sy + LIFT }); }
function stage(g, c, o = {}) {
  E.bg(g, o); const p0 = c.proj(0, 0);
  E.grid(g, { ox: p0.x, oy: p0.y, scale: p0.s, alpha: o.gridA ?? 1 });
}

// ═════════════════════════ 1 乱象（0–10.8）═════════════════════════
const NOTIFS = [['Amazon 卖家后台', '新订单 · 待处理', '37'], ['Shopee 卖家中心', '待发货订单', '12'], ['TikTok Shop', '买家消息未读', '9'], ['独立站后台', '退款申请 · 待审核', '3'],
  ['Amazon 卖家后台', 'Listing 被下架', '1'], ['Shopee 卖家中心', '库存同步失败', '5'], ['物流跟踪', '包裹异常', '14'], ['TikTok Shop', '达人样品待寄出', '4']];
const CHATS = ['德语描述谁来写？', '日文标题翻好了吗', '西班牙站价格换算错了', '这款还有货吗？', '美西仓到底还剩多少', '供应商说要涨价', '补货单谁来批？'];
const SHEETS = ['库存总表_最终版(3).xlsx', '订单汇总_1104.xlsx', '采购记录_新.xlsx', '汇率换算.xlsx'];
const ALERTS = ['美西仓缺货 6 个 SKU', '汇率已变动', '差评 +2', '广告超预算', '运单号缺失 14'];
const STORM = (() => {
  const R = mulberry(20261104), out = [], times = [];
  for (let k = 0; k < 4; k++) times.push(k * B);
  for (let k = 0; k < 8; k++) times.push(2.4 + k * B / 2);
  for (let k = 0; k < 16; k++) times.push(4.8 + k * S16);
  for (let k = 0; k < 16; k++) { times.push(7.2 + k * S16 / 2); times.push(7.2 + k * S16 / 2 + 1 / 48); }
  const order = ['notif', 'chat', 'sheet', 'alert', 'notif', 'browser', 'chat', 'notif', 'alert', 'sheet'];
  times.forEach((t0, i) => {
    const kind = i < 3 ? ['notif', 'chat', 'sheet'][i] : order[Math.floor(R() * order.length)];
    const sz = { notif: [380, 78], chat: [330, 62], sheet: [470, 300], browser: [500, 320], alert: [0, 40] }[kind];
    let w = sz[0], h = sz[1]; if (kind === 'alert') w = 300;
    const z = kind === 'sheet' || kind === 'browser' ? -0.28 + R() * 0.2 : -0.05 + R() * 0.24;
    const x = 40 + R() * (W - 80 - w), y = 40 + R() * (H - 120 - h);
    out.push({ i, t0, kind, x, y, w, h, z, k: Math.floor(R() * 100), pan: (x + w / 2) / W * 2 - 1 });
  });
  if (out[0]) Object.assign(out[0], { x: 760, y: 470, z: 0.02 });   // 第一个弹出的角标在画面中心附近
  return out.sort((a, b) => a.z - b.z);
})();
const GROUP = { alert: 0, chat: 1, notif: 2, sheet: 3, browser: 3 };
function stormItem(g, e, tf, t) {
  const p = seg(tf, e.t0, e.t0 + (e.kind === 'notif' ? 0.24 : 0.22)); if (p <= 0) return;
  const tr = seg(tf, 7.4, K.freeze) * 2.4, jx = tr * (hash(e.i * 3.1 + Math.floor(tf * 24)) - 0.5) * 2, jy = tr * (hash(e.i * 5.7 + Math.floor(tf * 24)) - 0.5) * 2;
  const rp = seg(t, K.retract[GROUP[e.kind]] + Math.hypot(e.x + e.w / 2 - 960, e.y + e.h / 2 - 540) / 2600, K.retract[GROUP[e.kind]] + Math.hypot(e.x + e.w / 2 - 960, e.y + e.h / 2 - 540) / 2600 + 0.22);
  const x = e.x + jx + (e.kind === 'notif' ? (1 - eo(p)) * 90 : 0), y = e.y + jy + (e.kind === 'chat' ? -(1 - back(p, 2)) * 30 : 0);
  const draw = () => {
    if (e.kind === 'notif') { const n = NOTIFS[e.k % NOTIFS.length]; E.notif(g, x, y, e.w, e.h, { app: e.k, title: n[0], body: n[1], time: '刚刚', badge: n[2], alpha: clamp(p * 2) }); }
    else if (e.kind === 'chat') {
      g.save(); g.globalAlpha *= clamp(p * 2); panel(g, x, y, e.w, e.h, { r: 22, fill: '#1C2130', cheap: true });
      E.appIcon(g, x + 14, y + 15, 32, e.k + 2); T(g, CHATS[e.k % CHATS.length], x + 58, y + e.h / 2 + 1, { px: 19, wt: 500, base: 'middle' }); g.restore();
    } else if (e.kind === 'alert') {
      g.save(); const s = lerp(0.5, 1, back(p, 2.4)); g.globalAlpha *= clamp(p * 3); g.translate(x + e.w / 2, y + e.h / 2); g.scale(s, s); g.translate(-x - e.w / 2, -y - e.h / 2);
      g.font = font(18, 600); const tw = g.measureText(ALERTS[e.k % ALERTS.length]).width; e.w = tw + 56;
      g.fillStyle = 'rgba(255,90,95,.16)'; rr(g, x, y, e.w, e.h, 20); g.fill(); g.strokeStyle = rgba(PAL.red, 0.7); g.lineWidth = 1.5; rr(g, x + 0.5, y + 0.5, e.w - 1, e.h - 1, 20); g.stroke();
      g.fillStyle = PAL.red; g.beginPath(); g.arc(x + 22, y + e.h / 2, 6, 0, TAU); g.fill();
      T(g, ALERTS[e.k % ALERTS.length], x + 38, y + e.h / 2 + 1, { px: 18, wt: 600, col: '#FFB3B5', base: 'middle' }); g.restore();
    } else {
      const s = 0.94 + 0.06 * back(p, 1.6); g.save(); g.globalAlpha *= clamp(p * 3); g.translate(x + e.w / 2, y + e.h / 2); g.scale(s, s); g.translate(-x - e.w / 2, -y - e.h / 2);
      const r = E.windowBox(g, x, y, e.w, e.h, { title: e.kind === 'sheet' ? SHEETS[e.k % SHEETS.length] : ['Amazon 后台', 'Shopee 后台', 'TikTok Shop 后台', '独立站后台'][e.k % 4], app: e.k, cheap: true });
      E.windowContent(g, r, e.kind, { seed: e.k, tabs: 4 + Math.floor(tf * 2) });
      if (e.kind === 'sheet') E.badge(g, x + e.w - 20, y + 20, String(3 + e.k % 9));
      g.restore();
    }
  };
  if (rp > 0) crtOff(g, [x, y, e.w, e.h], rp, draw); else draw();
}
function stormCam(t) {
  const tf = Math.min(t, K.freeze);
  const zk = [[0, 1.5], [2.4, 1.3], [4.8, 1.12], [7.2, 0.98], [8.4, 0.93]];
  let z = 1.5; for (let i = 1; i < zk.length; i++) if (tf <= zk[i][0] || i === zk.length - 1) { z = logz(zk[i - 1][1], zk[i][1], eio(seg(tf, zk[i - 1][0], zk[i][0]))); if (tf <= zk[i][0]) break; }
  let rot = 0.022 * ss(seg(tf, 4.8, 8.4)), sx = 0, sy = 0;
  const wob = seg(tf, 6.4, 8.4); sx = wob * 7 * Math.sin(tf * 11.3) * Math.sin(tf * 3.7); sy = wob * 5 * Math.sin(tf * 9.1 + 1);
  let x = 960, y = 540;
  if (t > K.freeze) { const p = eio(seg(t, K.freeze, K.click)); z = logz(z, z * 1.5, p); x = lerp(960, 968, p); y = lerp(540, 532, p); }
  if (t > K.click) { const p = eo(seg(t, K.click, K.click + 0.5)); z = logz(0.93 * 1.5, 1, p); rot = lerp(rot, 0, p); sx = lerp(sx, 0, p); sy = lerp(sy, 0, p); x = lerp(968, 960, p); y = lerp(532, 540, p); }
  return cam(x, y, z, rot, sx, sy);
}

// ═════════════════════════ 2 采集（10.5–16.8）═════════════════════════
const SRC = [150, 150, 1000, 700], OFFERS = ['ELE-001', 'HOM-003', 'OUT-001', 'ELE-002', 'PET-001', 'BEA-001'];
const CARD = i => [174 + (i % 3) * 326, 262 + Math.floor(i / 3) * 284, 300, 258];
const POP = [1220, 250, 460, 330], BOX = [1210, 150, 560, 700];
const ROW = i => [BOX[0] + 22, BOX[1] + 66 + i * 104, BOX[2] - 44, 88];
function sourceUI(g, t) {
  const r = windowFrame(g, ...SRC, '货源页 · 批发市场', { mono: 'detail.1688.com' });
  rr(g, r[0] + 24, r[1] + 16, r[2] - 48, 40, 20); g.fillStyle = 'rgba(255,255,255,.04)'; g.fill();
  T(g, '数码配件 · 家居 · 户外 · 宠物 · 美妆      一件代发 · 支持采集', r[0] + 46, r[1] + 42, { px: 15, col: PAL.mute });
  OFFERS.forEach((s, i) => {
    const [x, y, w, h] = CARD(i);
    panel(g, x, y, w, h, { r: 14, fill: PAL.surf2, shadow: 0.6 });
    pic(g, IMG[s], x, y, w, 170, 14);
    T(g, P[s][0], x + 16, y + 200, { px: 18, wt: 600, id: i === 0 ? 'offer0' : null });
    T(g, `¥${P[s][4].toFixed(2)}`, x + 16, y + 236, { px: 20, wt: 600, fam: 'mono' });
    T(g, '起批 2 件', x + w - 16, y + 236, { px: 14, col: PAL.mute, align: 'right' });
    const tp = i < 3 ? K.ticks[i] : 1e9, on = seg(t, tp, tp + 0.12);
    const bx = x + 14, by = y + 14, cs = 30 * (on > 0 ? lerp(0.7, 1, back(on, 2.6)) : 1);
    g.save(); g.fillStyle = on > 0 ? PAL.text : 'rgba(10,11,15,.55)'; g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5;
    rr(g, bx + 15 - cs / 2, by + 15 - cs / 2, cs, cs, 8); g.fill(); if (on <= 0) g.stroke(); g.restore();
    if (on > 0) check(g, bx + 15, by + 15, 26);
  });
}
function popupUI(g, t) {
  const sp = seg(t, K.popup, K.popup + 0.26); if (sp <= 0) return;
  const mp = seg(t, K.collect + 0.05, K.collect + 0.4), rect = lr(POP, BOX, eo(mp));
  g.save(); g.globalAlpha *= clamp(sp * 3); g.translate(0, -(1 - eo(sp)) * 40);
  if (mp <= 0) {
    const [x, y, w, h] = POP; panel(g, x, y, w, h, { r: 18, fill: PAL.surf2 });
    waveMark(g, x + 36, y + 38, 30, { neutral: true });
    T(g, 'Wavely 采集', x + 62, y + 45, { px: 20, wt: 600 });
    T(g, 'v0.1.1', x + w - 22, y + 45, { px: 13, fam: 'mono', col: PAL.mute, align: 'right' });
    const n = K.ticks.filter(k => t >= k).length;
    T(g, '已勾选', x + 24, y + 112, { px: 16, col: PAL.dim });
    T(g, `${n} 件`, x + w - 24, y + 112, { px: 24, wt: 600, fam: 'mono', align: 'right' });
    g.fillStyle = PAL.line; g.fillRect(x + 24, y + 134, w - 48, 1);
    T(g, '采集间隔', x + 24, y + 172, { px: 16, col: PAL.dim }); T(g, '1 s', x + w - 24, y + 172, { px: 18, fam: 'mono', align: 'right' });
    T(g, '目标', x + 24, y + 212, { px: 16, col: PAL.dim }); T(g, 'ERP · 采集箱', x + w - 24, y + 212, { px: 16, align: 'right' });
    button(g, x + 24, y + 248, w - 48, 58, '采集到 ERP', { lit: (seg(t, K.collect, K.collect + 0.04) - seg(t, K.collect + 0.1, K.collect + 0.3)) });
  } else {
    const [x, y, w, h] = rect; panel(g, x, y, w, h, { r: 16, fill: PAL.surf });
    if (mp >= 1) {
      windowFrame(g, ...BOX, 'ERP · 采集箱', { mono: '3 件待导入' });
      [0, 1, 2].forEach(i => {
        const land = K.collect + 0.3 + i * S16 + 0.36, a = seg(t, land - 0.05, land + 0.1);
        const [rx, ry, rw, rh] = ROW(i);
        panel(g, rx, ry, rw, rh, { r: 12, fill: PAL.surf2, shadow: 0.3, alpha: a });
        if (t >= land) pic(g, IMG[OFFERS[i]], rx + 10, ry + 10, 68, 68, 10);
        T(g, P[OFFERS[i]][0], rx + 96, ry + 38, { px: 18, wt: 600, alpha: a });
        T(g, `¥${P[OFFERS[i]][4].toFixed(2)} · ${[3, 2, 2][i]} 规格 · 1688`, rx + 96, ry + 66, { px: 14, fam: 'mono', col: PAL.mute, alpha: a });
        pill(g, rx + rw - 96, ry + 28, '待导入', { alpha: a });
      });
    }
  }
  g.restore();
}
function collectFlights(g, t) {
  [0, 1, 2].forEach(i => {
    const t0 = K.collect + 0.3 + i * S16, p = (t - t0) / 0.36; if (p <= 0 || p > 1.3) return;
    const [cx, cy, cw] = CARD(i), a = [cx + cw / 2, cy + 85], [rx, ry] = ROW(i), b = [rx + 44, ry + 44], c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 220 + i * 40];
    flight(g, a, c, b, p, '#C9D3E6', 5);
    if (p < 1) { const q = bez(a, c, b, eo(clamp(p))), s = lerp(1, 0.4, eo(clamp(p))); pic(g, IMG[OFFERS[i]], q[0] - 85 * s, q[1] - 60 * s, 170 * s, 120 * s, 12); }
  });
}
const curKeys2 = [[K.click, [952, 520]], [11.3, [640, 430]], [11.95, [190, 278]], [12.3, [300, 330]], [12.55, [516, 278]], [12.9, [640, 330]], [13.15, [842, 278]], [13.9, [1380, 560]], [14.35, [1450, 524]], [15.2, [1360, 640]]];
function trackPos(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]; const L = keys[keys.length - 1]; if (t >= L[0]) return L[1];
  let i = 0; while (keys[i + 1][0] < t) i++;
  const [ta, a] = keys[i], [tb, b] = keys[i + 1], p = eio((t - ta) / (tb - ta)); return [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
}

// ═════════════════════════ 3 AI 本地化（16.8–23.4）═════════════════════════
const EDIT = [140, 120, 1640, 780], HERO_IMG = [190, 196, 560, 560];
const LANGS = [['ZH', '三合一磁吸无线充', PAL.dim], ['EN', '3-in-1 Magnetic Wireless Charger', '#8FA8D8'], ['DE', '3-in-1 Magnetische Ladestation', '#D8C08F'], ['JA', '3in1 マグネットワイヤレス充電器', '#D89FB4'], ['ES', 'Cargador magnético 3 en 1', '#A3D08F']];
const AIBTN = [800, 318, 330, 54];
function editorUI(g, t, o = {}) {
  const { out = 0 } = o;     // out 0..1：收起进度（逐件）
  const k = i => seg(out, i * 0.1, i * 0.1 + 0.35);
  const ai = (pp, d) => (pp >= 1 ? null : d());
  ai(k(6), () => { const r = windowFrame(g, ...EDIT, '商品编辑 · AI 本地化', { mono: 'WV-ELE-001', alpha: 1 - k(6) }); });
  const X = 800;
  g.save(); g.globalAlpha *= 1 - k(5);
  T(g, '三合一磁吸无线充', X, 244, { px: 42, wt: 600, id: 'title' });
  T(g, 'WV-ELE-001 · 数码配件 · 3 规格 · 成本 ¥58.00', X, 286, { px: 16, fam: 'mono', col: PAL.mute, id: 'meta' });
  g.restore();
  g.save(); g.globalAlpha *= 1 - k(4);
  const lit = seg(t, K.ai, K.ai + 0.05) * (1 - seg(t, K.ai + 0.6, K.ai + 1.2));
  button(g, ...AIBTN, '', { lit });
  g.save(); E.litShape(g, E.sparklePath(AIBTN[0] + 34, AIBTN[1] + 27, 13 + 3 * Math.sin(t * 6) * seg(t, K.ai, K.ai + 0.3) * (1 - seg(t, 20.4, 21)), 0.2, t * 1.5 * seg(t, K.ai, 21)), { accent: lit < 0.5, color: lit >= 0.5 ? '#06231E' : null, glowR: lit < 0.5 ? 18 : 0, bbox: [AIBTN[0] + 18, AIBTN[1] + 11, 32, 32], stroke: false }); g.restore();
  T(g, 'AI 本地化 · 5 种语言', AIBTN[0] + 58, AIBTN[1] + 28, { px: 18, wt: 600, base: 'middle', col: lit > 0.5 ? '#06231E' : PAL.text, id: 'aibtn' });
  g.restore();
  LANGS.forEach(([tag, text, col], i) => {
    const y = 412 + i * 66, t0 = i === 0 ? -1 : K.rows[i - 1];
    const a = (i === 0 ? 1 : seg(t, t0 + 0.24, t0 + 0.32)) * (1 - k(3 - (i > 2 ? 1 : 0)));
    if (a <= 0) return;
    g.save(); g.globalAlpha *= a;
    g.fillStyle = 'rgba(255,255,255,.03)'; rr(g, X - 12, y - 40, 900, 58, 12); g.fill();
    g.strokeStyle = rgba(col, 0.8); g.lineWidth = 1.2; rr(g, X, y - 28, 50, 30, 8); g.stroke();
    T(g, tag, X + 25, y - 12, { px: 14, wt: 600, fam: 'mono', col, align: 'center', base: 'middle' });
    g.restore();
    if (i === 0) T(g, text, X + 70, y - 3, { px: 26, alpha: 1 - k(3), id: 'zh' });
    else { g.save(); g.globalAlpha *= 1 - k(i > 2 ? 2 : 3); scrambleText(g, text, X + 70, y - 3, t, t0 + 0.26, t0 + 0.86, { px: 26, noise: col, id: 'lang' + tag }); g.restore(); }
  });
  // 售价
  g.save(); g.globalAlpha *= (1 - k(1)) * seg(t, K.price - 0.3, K.price);
  T(g, '售价', X, 790, { px: 16, col: PAL.dim });
  T(g, `成本 ¥58.00 → 实时汇率 · 6 种币种`, X + 60, 790, { px: 15, fam: 'mono', col: PAL.mute });
  E.scramble(g, '$39.99', X, 860, t, [K.price + 0.6, K.price + 0.6, K.price + 0.45, K.price + 0.6, K.price + 0.3, K.price + 0.15], { px: 64, color: PAL.text, start: K.price - 0.3 });
  g.restore();
  if (COLLECT && t > K.price + 0.6 && out < 0.2) T(g, '$39.99', X, 860, { px: 64, fam: 'disp', alpha: 0, id: 'price' });
}
function localizeFlights(g, t) {
  K.rows.forEach((t0, i) => {
    const p = (t - t0) / 0.28, col = LANGS[i + 1][2]; if (p <= 0 || p > 1.3) return;
    const a = [AIBTN[0] + 34, AIBTN[1] + 27], b = [818, 412 + (i + 1) * 66 - 13], c = [a[0] - 160 - i * 30, (a[1] + b[1]) / 2];
    flight(g, a, c, b, p, col, 5);
  });
}

// ═════════════════════════ 4 上架独立站（23.4–31.2）═════════════════════════
const STORE = [130, 96, 1660, 830];
const GRID_SKU = ['HOM-001', 'ELE-002', 'ELE-001', 'PET-001', 'OUT-001', 'BEA-002', 'ELE-004', 'HOM-003', 'OUT-003', 'PET-002', 'HOM-002', 'BEA-001'];
const HERO_I = 2, TW = 238, TG = 22;
const SLOT = i => [191 + (i % 6) * (TW + TG), 226 + Math.floor(i / 6) * 330, TW, 306];
const SCAT = (() => GRID_SKU.map((s, i) => { const R = mulberry(i * 977 + 5); return { x: 100 + R() * 1500, y: 140 + R() * 640, rot: (R() - 0.5) * 0.7, s: 0.62 + R() * 0.25, t0: K.tiles + Math.floor(R() * 8) * S16 / 2 * 1.0 + (i % 4) * 0.02 }; }))();
const PAGE_V = [176, 214, 880, 495];
function langIdx(t) { return t < K.langs[0] ? 0 : t < K.langs[1] ? 2 : t < K.langs[2] ? 3 : 1; }   // 中 → 日 → 西 → 英
function tile(g, s, x, y, w, h, li, o = {}) {
  const { hero = false, rimA = 0 } = o;
  panel(g, x, y, w, h, { r: 14, fill: PAL.surf2, shadow: 0.7, cheap: !hero });
  pic(g, IMG[s], x, y, w, w, 14);
  const nm = P[s][li], px = 16; g.save(); g.font = font(px, 600); let name = nm;
  while (g.measureText(name).width > w - 28 && name.length > 3) name = name.slice(0, -1); if (name !== nm) name = name.trimEnd() + '…'; g.restore();
  T(g, name, x + 14, y + w + 30, { px, wt: 600 });
  T(g, `$${P[s][5].toFixed(2)}`, x + 14, y + w + 56, { px: 16, fam: 'mono', col: PAL.dim });
  if (rimA > 0) { g.save(); g.globalAlpha *= rimA; g.strokeStyle = PAL.accent; g.lineWidth = 2; g.shadowColor = rgba(PAL.accent, 0.8); g.shadowBlur = 18; rr(g, x - 1, y - 1, w + 2, h + 2, 15); g.stroke(); g.restore(); }
}
function storeChrome(g, t, rect, a) {
  const [x, y, w, h] = rect; if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  windowFrame(g, x, y, w, h, 'Wavely Store · 独立站', { mono: 'wavely-crossborder/shop' });
  const hy = y + 72;
  T(g, 'Wavely', x + 60, hy + 8, { px: 26, wt: 700, fam: 'disp' });
  T(g, '新品      场景短片      家居      户外      宠物', x + 230, hy + 6, { px: 16, col: PAL.dim });
  const li = langIdx(t), L = ['中', 'EN', 'DE', 'JA', 'ES'], map = [0, 1, 3, 4];   // langIdx → pill
  L.forEach((l, i) => {
    const px = x + w - 470 + i * 64, on = map[li] === i;
    g.fillStyle = on ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.03)'; rr(g, px, hy - 16, 54, 32, 16); g.fill();
    T(g, l, px + 27, hy + 1, { px: 14, wt: 600, col: on ? PAL.text : PAL.mute, align: 'center', base: 'middle' });
  });
  T(g, 'USD $', x + w - 80, hy + 6, { px: 15, fam: 'mono', col: PAL.dim });
  g.restore();
}
function storeUI(g, t) {
  const ex = eo(seg(t, K.store, K.store + 0.5));
  const rect = lr(SLOT(HERO_I), STORE, ex);
  if (t < K.expand + 0.6) { panel(g, ...rect, { r: 16, fill: PAL.surf, alpha: ex }); storeChrome(g, t, rect, seg(ex, 0.6, 1)); }
  const li = langIdx(t), out = seg(t, K.expand, K.expand + 0.5);
  // 其他 11 张瓦片：先在四处冒出，提前一拍起飞，重拍落进网格
  GRID_SKU.forEach((s, i) => {
    if (i === HERO_I) return;
    const sc = SCAT[i], sp = seg(t, sc.t0, sc.t0 + 0.22); if (sp <= 0) return;
    const [sx, sy, sw, sh] = SLOT(i), fp = seg(t, K.snap - B, K.snap);
    const pose = fp > 0 ? E.flyPose({ x: sc.x, y: sc.y, rot: sc.rot, s: sc.s }, { x: sx + sw / 2, y: sy + sh / 2, rot: 0, s: 1 }, fp) : { x: sc.x, y: sc.y, rot: sc.rot, s: sc.s * lerp(0.5, 1, back(sp, 2)) };
    const rp = seg(t, K.expand + (i % 6) * S16 / 3, K.expand + (i % 6) * S16 / 3 + 0.24);
    if (rp >= 1) return;
    if (fp > 0.05 && fp < 1) { const a = [sc.x, sc.y], b = [sx + sw / 2, sy + sh / 2]; flight(g, a, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 120], b, fp, '#C9D3E6', 3); }
    g.save(); g.globalAlpha *= clamp(sp * 3); g.translate(pose.x, pose.y); g.rotate(pose.rot); g.scale(pose.s * (1 - eo(rp)), pose.s * (1 - eo(rp))); g.translate(-sw / 2, -sh / 2);
    tile(g, s, 0, 0, sw, sh, li); g.restore();
  });
  // 主角瓦片：从商品编辑缩下来，展开成商品页
  const [hx, hy, hw, hh] = SLOT(HERO_I);
  if (out <= 0) tile(g, 'ELE-001', hx, hy, hw, hh, li, { hero: true, rimA: seg(t, K.snap, K.snap + 0.1) });
}
function productPage(g, t) {
  const ep = eo(seg(t, K.expand, K.expand + 0.5)); if (ep <= 0) return;
  const out = seg(t, K.buy + 0.25, K.buy + 0.55);
  const draw = () => {
    storeChrome(g, t, STORE, 1);
    const v = lr([SLOT(HERO_I)[0], SLOT(HERO_I)[1], TW, TW], PAGE_V, ep);
    const fi = clamp(Math.floor((t - K.film) * 24), 0, FILM.length - 1);
    pic(g, t >= K.film && FILM.length ? FILM[fi] : IMG['ELE-001'], ...v, 14);
    const a = seg(t, K.expand + 0.35, K.expand + 0.7); if (a <= 0) return;
    g.save(); g.globalAlpha *= a;
    pill(g, PAGE_V[0] + 18, PAGE_V[1] + 18, 'AI 场景短片 · Veo', { px: 13, fam: 'mono', wt: 500, col: PAL.text, fill: 'rgba(10,11,15,.6)' });
    const X = 1110;
    T(g, '3-in-1 Magnetic', X, 280, { px: 38, wt: 600, fam: 'disp', id: 'pt1' });
    T(g, 'Wireless Charger', X, 326, { px: 38, wt: 600, fam: 'disp', id: 'pt2' });
    T(g, '★★★★★  4.8 · 126 reviews', X, 368, { px: 16, col: PAL.dim });
    T(g, '$39.99', X, 448, { px: 48, wt: 600, fam: 'disp', id: 'pp' });
    T(g, 'Color', X, 504, { px: 14, fam: 'mono', col: PAL.mute });
    ['Black', 'White'].forEach((c, i) => { g.fillStyle = i === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.03)'; rr(g, X + i * 110, 518, 98, 38, 19); g.fill(); g.strokeStyle = i === 0 ? 'rgba(255,255,255,.4)' : PAL.line; g.lineWidth = 1; rr(g, X + i * 110 + 0.5, 518.5, 97, 37, 19); g.stroke(); T(g, c, X + i * 110 + 49, 538, { px: 15, wt: 600, align: 'center', base: 'middle' }); });
    T(g, 'Charges phone, earbuds and watch at once.', X, 600, { px: 17, col: PAL.dim });
    if (t < K.buy + 0.05) button(g, X, 640, 560, 64, 'Add to cart', { px: 20, lit: seg(t, K.buy, K.buy + 0.04) });
    T(g, 'Free shipping · 7–12 days · 30-day returns', X, 744, { px: 14, fam: 'mono', col: PAL.mute });
    g.restore();
  };
  if (out > 0) crtOff(g, STORE, out, draw); else draw();
}
/** 下单按钮 → 订单通知 → 收件箱第一行 */
const ORDER_N = [1110, 640, 560, 64];
function orderMorph(g, t) {
  const p = seg(t, K.buy + 0.05, K.orders + 0.3); if (p <= 0 || p >= 1) return;
  const r = lr(ORDER_N, INROW(0), eio(p));
  g.save(); panel(g, ...r, { r: 12, fill: PAL.surf2, shadow: 1 });
  const p2 = new Path2D(); p2.roundRect(r[0], r[1], 5, r[3], 3); E.litShape(g, p2, { accent: true, glowR: 10, bbox: [r[0], r[1], 5, r[3]] });
  T(g, '新订单 #WV-10421 · 德国 · $39.99', r[0] + 24, r[1] + r[3] / 2 + 1, { px: 17, wt: 600, base: 'middle' });
  g.restore();
}

// ═════════════════════════ 5 订单收件箱（31.2–36）═════════════════════════
const INBOX = [300, 128, 1320, 760];
const INROW = i => [INBOX[0] + 20, INBOX[1] + 102 + i * 60, INBOX[2] - 40, 52];
const CH = { '独立站': '#8FC9B6', 'Amazon': '#C9A86B', 'Shopee': '#C98B6B', 'TikTok': '#8FA3C9' };
const ORDERS = [
  ['独立站', '#WV-10421', '三合一磁吸无线充', '德国', '$39.99'], ['Amazon', '#AMZ-7731', '降噪蓝牙耳机', '美国', '$59.99'], ['Shopee', '#SHP-2208', '保温随行杯 600ml', '新加坡', 'S$32.90'],
  ['TikTok', '#TT-9052', 'LED 化妆镜', '英国', '£27.99'], ['Amazon', '#AMZ-7734', '氮化镓快充 65W', '日本', '¥4,980'], ['独立站', '#WV-10422', '智能宠物饮水机', '西班牙', '€42.99'],
  ['Shopee', '#SHP-2211', '感应夜灯（3 只装）', '马来西亚', 'RM98.00'], ['TikTok', '#TT-9057', '猫抓板沙发', '美国', '$29.99'], ['Amazon', '#AMZ-7740', '超轻户外折叠椅', '德国', '€46.99'], ['独立站', '#WV-10423', '便携补水喷雾仪', '法国', '€18.99'],
];
const ORD_T = i => i === 0 ? K.orders + 0.3 : K.orders + 0.6 + (i - 1) * 0.3;
const COLS = [0, 150, 330, 640, 790, 960];
function inboxRow(g, i, x, y, w, h, o = {}) {
  const [ch, no, name, cty, amt] = ORDERS[i];
  panel(g, x, y, w, h, { r: 10, fill: i === 0 ? '#1C2230' : PAL.surf2, shadow: 0.25, cheap: true });
  if (i === 0) { const p = new Path2D(); p.roundRect(x, y, 5, h, 3); E.litShape(g, p, { accent: true, glowR: 10, bbox: [x, y, 5, h] }); }
  g.save(); g.fillStyle = rgba(CH[ch], 0.16); rr(g, x + 18, y + 13, 112, 26, 13); g.fill(); g.restore();
  T(g, ch, x + 74, y + h / 2 + 1, { px: 14, wt: 600, col: CH[ch], align: 'center', base: 'middle' });
  T(g, no, x + 18 + COLS[1], y + h / 2 + 1, { px: 15, fam: 'mono', col: PAL.dim, base: 'middle' });
  T(g, name, x + 18 + COLS[2], y + h / 2 + 1, { px: 17, wt: 500, base: 'middle', id: i === 0 ? 'ord0' : null });
  T(g, cty, x + 18 + COLS[3], y + h / 2 + 1, { px: 16, col: PAL.dim, base: 'middle' });
  T(g, amt, x + 18 + COLS[4], y + h / 2 + 1, { px: 16, fam: 'mono', base: 'middle' });
  pill(g, x + 18 + COLS[5], y + 10, '待拣货', { px: 13 });
}
function inboxUI(g, t) {
  const ex = eo(seg(t, K.orders, K.orders + 0.35)), out = seg(t, K.ship - 0.6, K.ship - 0.25);
  const rect = lr([INBOX[0] + 300, INBOX[1] + 200, INBOX[2] - 600, INBOX[3] - 400], INBOX, ex);
  g.save();
  if (out < 1) {
    g.globalAlpha *= 1 - out;
    if (ex < 1) panel(g, ...rect, { r: 16, fill: PAL.surf, alpha: ex }); else windowFrame(g, ...INBOX, 'ERP · 订单收件箱', { mono: '4 个渠道 · 统一处理' });
    if (ex >= 1) ['渠道', '订单号', '商品', '国家 / 地区', '金额', '状态'].forEach((c, i) => T(g, c, INBOX[0] + 38 + COLS[i], INBOX[1] + 82, { px: 14, fam: 'mono', col: PAL.mute }));
  }
  g.restore();
  ORDERS.forEach((o, i) => {
    const tl = ORD_T(i); if (t < tl || (i === 0 && t < K.orders + 0.3)) return;
    const [x, y, w, h] = INROW(i), rp = i === 0 ? (t >= K.ship - 0.6 ? 1 : 0) : seg(t, K.ship - 0.6 + i * 0.02, K.ship - 0.38 + i * 0.02);
    const land = seg(t, tl, tl + 0.12), dy = (1 - back(land, 2)) * 8;
    if (rp >= 1) return;
    g.save(); g.globalAlpha *= 1 - rp; g.translate(0, dy * (i > 0)); inboxRow(g, i, x, y, w, h); g.restore();
  });
  ORDERS.forEach((o, i) => {   // 渠道颜色的光迹从四个方向汇入
    if (i === 0) return; const tl = ORD_T(i), p = (t - tl + 0.4) / 0.4; if (p <= 0 || p > 1.3) return;
    const [x, y, w, h] = INROW(i), b = [x + 74, y + h / 2];
    const from = { Amazon: [-200, y + 60], Shopee: [2120, y - 80], TikTok: [x + 400, 1260], '独立站': [x + 700, -160] }[o[0]];
    flight(g, from, [(from[0] + b[0]) / 2, (from[1] + b[1]) / 2 - 140], b, p, CH[o[0]], 5);
  });
}

// ═════════════════════════ 6 扫码发货（36–43.2）═════════════════════════
const PHONE = [500, 76, 400, 808], STOCK = [1000, 236, 700, 440];
function stockVal(t) {
  if (t < K.confirm + 0.05) return 52; if (t < K.drain) return 51;
  return Math.round(lerp(51, 9, ei(seg(t, K.drain, 42.2)) * 0.4 + ss(seg(t, K.drain, 42.2)) * 0.6));
}
function phoneUI(g, t) {
  const [x, y, w, h] = PHONE;
  panel(g, x, y, w, h, { r: 54, fill: '#0E1117', shadow: 1 });
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; rr(g, x + 6, y + 6, w - 12, h - 12, 48); g.stroke();
  const sx = x + 24, sw = w - 48;
  g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, x + w / 2 - 50, y + 20, 100, 8, 4); g.fill();
  T(g, 'Wavely 仓库', sx, y + 76, { px: 22, wt: 700 }); T(g, '拣货发货', sx + sw, y + 76, { px: 15, col: PAL.dim, align: 'right' });
  panel(g, sx, y + 98, sw, 70, { r: 14, fill: PAL.surf2, shadow: 0 });
  T(g, '#WV-10421', sx + 18, y + 128, { px: 18, wt: 600, fam: 'mono', id: 'pord' }); T(g, '独立站 · 德国 · 2 件', sx + 18, y + 154, { px: 14, col: PAL.dim });
  // 取景框 + 扫描线
  const vx = sx, vy = y + 186, vw = sw, vh = 210;
  g.fillStyle = '#07090D'; rr(g, vx, vy, vw, vh, 16); g.fill();
  g.save(); rr(g, vx, vy, vw, vh, 16); g.clip();
  for (let i = 0; i < 46; i++) { const bw = hash(i * 3.3) < 0.5 ? 2 : 5; g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(vx + 60 + i * 5.6, vy + 70, bw, 70); }
  const done = K.scans.filter(s => t >= s).length;
  if (t < K.confirm) {
    const sy = vy + 20 + (0.5 + 0.5 * Math.sin(t * 4.2)) * (vh - 40);
    g.fillStyle = rgba(PAL.accent, 0.9); g.shadowColor = rgba(PAL.accent, 0.9); g.shadowBlur = 16; g.fillRect(vx + 24, sy, vw - 48, 2); g.shadowColor = 'transparent';
  }
  K.scans.forEach(s => { const f = seg(t, s, s + 0.25); if (f > 0 && f < 1) { g.fillStyle = `rgba(230,240,255,${0.35 * (1 - f)})`; g.fillRect(vx, vy, vw, vh); } });
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.lineCap = 'round';
  [[vx + 18, vy + 18, 1, 1], [vx + vw - 18, vy + 18, -1, 1], [vx + 18, vy + vh - 18, 1, -1], [vx + vw - 18, vy + vh - 18, -1, -1]].forEach(([a, b, dx, dy]) => { g.beginPath(); g.moveTo(a, b + dy * 26); g.lineTo(a, b); g.lineTo(a + dx * 26, b); g.stroke(); });
  if (done) T(g, ['6970000010421', '6970000010433'][done - 1], vx + vw / 2, vy + vh - 26, { px: 14, fam: 'mono', col: PAL.dim, align: 'center' });
  // 拣货清单
  const items = [['ELE-001-BLK', '三合一磁吸无线充 · 黑'], ['HOM-003', '感应夜灯（3 只装）']];
  items.forEach(([s, name], i) => {
    const iy = y + 416 + i * 86, ok = seg(t, K.scans[i], K.scans[i] + 0.14);
    panel(g, sx, iy, sw, 74, { r: 14, fill: PAL.surf2, shadow: 0 });
    pic(g, IMG[s] || IMG['ELE-001'], sx + 10, iy + 10, 54, 54, 10);
    T(g, name, sx + 78, iy + 33, { px: 16, wt: 600 }); T(g, '×1 · A-03-2', sx + 78, iy + 57, { px: 13, fam: 'mono', col: PAL.mute });
    const cx = sx + sw - 30, cy = iy + 37;
    g.save(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 13, 0, TAU); g.stroke();
    if (ok > 0) { const r = 13 * lerp(0.5, 1, back(ok, 2.6)); g.fillStyle = PAL.text; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); check(g, cx, cy, 20); }
    g.restore();
  });
  T(g, `已拣 ${done}/2`, sx, y + 618, { px: 18, wt: 600, fam: 'mono', id: 'picked' });
  const shipped = t >= K.confirm;
  button(g, sx, y + 640, sw, 62, shipped ? '已发货' : '确认发货', { px: 20, lit: shipped ? 1 : 0, dis: done < 2 });
  if (shipped) check(g, sx + sw / 2 - 52, y + 671, 22, '#06231E');
  ring(g, sx + sw / 2 + 40, y + 671, t - K.confirm, { color: '#FFFFFF', r1: 60 });
  if (shipped) T(g, '库存已扣减 · 运单号已回传', sx + sw / 2, y + 742, { px: 14, col: PAL.dim, align: 'center', alpha: seg(t, K.confirm + 0.3, K.confirm + 0.5) });
}
function stockUI(g, t, o = {}) {
  const sp = seg(t, 36.7, 36.95); if (sp <= 0) return;
  const [x, y, w, h] = STOCK;
  g.save(); g.globalAlpha *= clamp(sp * 3); g.translate((1 - eo(sp)) * 60, 0);
  panel(g, x, y, w, h, { r: 18, fill: PAL.surf });
  T(g, '库存 · 美西仓', x + 32, y + 52, { px: 20, wt: 600 }); T(g, 'WV-ELE-001 · 黑', x + w - 32, y + 52, { px: 14, fam: 'mono', col: PAL.mute, align: 'right' });
  pic(g, IMG['ELE-001-BLK'] || IMG['ELE-001'], x + 32, y + 84, 84, 84, 12);
  T(g, '三合一磁吸无线充', x + 136, y + 120, { px: 20, wt: 600 }); T(g, '日均销量 12 · 采购周期 14 天', x + 136, y + 152, { px: 14, fam: 'mono', col: PAL.mute });
  const v = stockVal(t), bump = t > K.confirm && t < K.confirm + 0.3 ? -10 * Math.exp(-(t - K.confirm) * 14) * Math.cos((t - K.confirm) * 40) : 0;
  T(g, String(v), x + 32, y + 300 + bump, { px: 110, wt: 600, fam: 'disp', id: 'stock' });
  T(g, '件可用', x + 32 + (v >= 10 ? 130 : 70), y + 300, { px: 20, col: PAL.dim });
  const bx = x + 32, by = y + 352, bw = w - 64, bh = 14, max = 60;
  g.fillStyle = 'rgba(255,255,255,.06)'; rr(g, bx, by, bw, bh, 7); g.fill();
  g.fillStyle = '#C9D3E6'; rr(g, bx, by, bw * v / max, bh, 7); g.fill();
  const sx = bx + bw * 30 / max; g.save(); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, by - 14); g.lineTo(sx, by + bh + 14); g.stroke(); g.restore();
  T(g, '安全库存 30', sx, by + bh + 40, { px: 14, fam: 'mono', col: PAL.dim, align: 'center' });
  const low = seg(t, 41.6, 41.75);
  if (low > 0) { g.save(); g.globalAlpha *= low; g.strokeStyle = PAL.text; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + w - 214, y + 268); g.lineTo(x + w - 202, y + 246); g.lineTo(x + w - 190, y + 268); g.closePath(); g.stroke(); g.restore(); T(g, '低于安全库存', x + w - 32, y + 266, { px: 18, wt: 600, align: 'right', alpha: low, id: 'low' }); }
  g.restore();
}

// ═════════════════════════ 7 补货与审批（43.2–50.4）═════════════════════════
const SUG = [170, 150, 760, 720], PO = [990, 150, 760, 720], ROLE = [PO[0] + 32, 676, 270, 50];
const SUBMIT = [PO[0] + 32, 762, PO[2] - 64, 60], REJ = [PO[0] + 32, 762, 300, 60], APR = [PO[0] + 352, 762, PO[2] - 384, 60];
function role(t) { return t < K.role + 0.1 ? '采购' : '老板'; }
function roleChip(g, t) {
  const a = seg(t, K.genPO + 0.5, K.genPO + 0.7); if (a <= 0) return;
  const [x, y, w, h] = ROLE, f = seg(t, K.role, K.role + 0.22), sy = f > 0 && f < 1 ? Math.abs(Math.cos(f * Math.PI)) : 1;
  g.save(); g.globalAlpha *= a; g.translate(x + w / 2, y + h / 2); g.scale(1, Math.max(0.04, sy)); g.translate(-x - w / 2, -y - h / 2);
  panel(g, x, y, w, h, { r: h / 2, fill: PAL.surf2, shadow: 0.5 });
  T(g, '身份', x + 26, y + h / 2 + 1, { px: 15, col: PAL.mute, base: 'middle' });
  T(g, role(t), x + 74, y + h / 2 + 1, { px: 18, wt: 600, base: 'middle', id: 'role' + role(t) });
  T(g, '切换 ▾', x + w - 24, y + h / 2 + 1, { px: 14, col: PAL.dim, base: 'middle', align: 'right' });
  g.restore();
}
function sugUI(g, t) {
  const ex = eo(seg(t, K.repl, K.repl + 0.45)); if (ex <= 0) return;
  const r = lr(STOCK, SUG, ex);
  panel(g, ...r, { r: 18, fill: PAL.surf });
  const a = seg(t, K.repl + 0.4, K.repl + 0.6); if (a <= 0) return;
  const [x, y, w] = SUG;
  g.save(); g.globalAlpha *= a;
  T(g, '补货建议 · 美西仓', x + 32, y + 54, { px: 22, wt: 600, id: 'sugT' });
  pic(g, IMG['ELE-001-BLK'] || IMG['ELE-001'], x + 32, y + 84, 72, 72, 12);
  T(g, '三合一磁吸无线充 · 黑', x + 124, y + 116, { px: 19, wt: 600 }); T(g, '供应商 深圳磁吸科技 · 起订量 20', x + 124, y + 144, { px: 14, fam: 'mono', col: PAL.mute });
  const M = [['可用库存', '9'], ['在途', '0'], ['安全库存', '30'], ['日均销量', '12'], ['采购周期', '14 天'], ['起订量', '20']];
  M.forEach(([k, v], i) => {
    const mx = x + 32 + (i % 3) * 236, my = y + 186 + Math.floor(i / 3) * 100, ma = seg(t, 43.8 + i * S16 / 2, 43.9 + i * S16 / 2);
    g.save(); g.globalAlpha *= ma; panel(g, mx, my, 220, 86, { r: 12, fill: PAL.surf2, shadow: 0 });
    T(g, k, mx + 18, my + 32, { px: 14, col: PAL.mute }); T(g, v, mx + 18, my + 68, { px: 26, wt: 600, fam: 'disp' }); g.restore();
  });
  T(g, '30×2 + 12×14 − 9 = 219 → 220', x + 32, y + 432, { px: 16, fam: 'mono', col: PAL.dim, alpha: seg(t, 43.9, 44.1), id: 'formula' });
  T(g, '建议补货', x + 32, y + 488, { px: 16, col: PAL.dim });
  E.scramble(g, '220', x + 32, y + 590, t, [K.sugLock + 0.45, K.sugLock + 0.3, K.sugLock + 0.15], { px: 96, start: K.sugLock - 0.3 });
  if (t > K.sugLock + 0.45) T(g, '件', x + 230, y + 588, { px: 24, col: PAL.dim });
  if (COLLECT && t > K.sugLock + 0.5) T(g, '220', x + 32, y + 590, { px: 96, fam: 'disp', alpha: 0, id: 'n220' });
  button(g, x + 32, y + 612, w - 64, 60, '生成采购单', { lit: seg(t, K.genPO, K.genPO + 0.04) - seg(t, K.genPO + 0.12, K.genPO + 0.3) });
  g.restore();
}
function poUI(g, t) {
  const ap = eo(seg(t, K.genPO + 0.05, K.genPO + 0.45)); if (ap <= 0) return;
  const r = lr([SUG[0] + 32, SUG[1] + 612, SUG[2] - 64, 60], PO, ap);
  panel(g, ...r, { r: 18, fill: PAL.surf });
  const a = seg(t, K.genPO + 0.4, K.genPO + 0.6); if (a <= 0) return;
  const [x, y, w] = PO;
  g.save(); g.globalAlpha *= a;
  T(g, '采购单', x + 32, y + 54, { px: 22, wt: 600 }); T(g, 'PO2611040012', x + 112, y + 54, { px: 18, fam: 'mono', col: PAL.dim, id: 'po' });
  const st = t < K.submit ? '草稿' : t < K.approve ? '待审批' : '已下单';
  if (st === '已下单') {
    const p = seg(t, K.approve, K.approve + 0.14), s = lerp(0.6, 1, back(p, 2.6)); g.save(); g.translate(x + w - 96, y + 46); g.scale(s, s); g.translate(-x - w + 96, -y - 46);
    const pp = new Path2D(); pp.roundRect(x + w - 156, y + 28, 124, 38, 19); E.litShape(g, pp, { accent: true, glowR: 22, bbox: [x + w - 156, y + 28, 124, 38] });
    check(g, x + w - 132, y + 47, 18, '#06231E'); T(g, '已下单', x + w - 84, y + 48, { px: 16, wt: 700, col: '#06231E', align: 'center', base: 'middle', id: 'stOK' }); g.restore();
  } else if (st !== '草稿') pill(g, x + w - 120, y + 30, st, { px: 15, col: PAL.text, id: 'st' + st });
  T(g, '供应商  深圳磁吸科技', x + 32, y + 104, { px: 16, col: PAL.dim });
  panel(g, x + 32, y + 128, w - 64, 92, { r: 12, fill: PAL.surf2, shadow: 0 });
  pic(g, IMG['ELE-001-BLK'] || IMG['ELE-001'], x + 46, y + 142, 64, 64, 10);
  T(g, '三合一磁吸无线充 · 黑', x + 128, y + 168, { px: 18, wt: 600 }); T(g, '220 件 × ¥58.00 · 入库 美西仓', x + 128, y + 196, { px: 14, fam: 'mono', col: PAL.mute });
  T(g, '合计', x + 32, y + 278, { px: 16, col: PAL.dim });
  T(g, '¥12,760', x + 32, y + 352, { px: 66, wt: 600, fam: 'disp', id: 'total' });
  pill(g, x + 300, y + 312, '超过 ¥5,000 · 需老板审批', { px: 15, col: PAL.text, id: 'thr' });
  g.fillStyle = PAL.line; g.fillRect(x + 32, y + 400, w - 64, 1);
  const log = [];
  if (t >= K.submit) log.push(['采购', '提交审批', '11-04 09:41']);
  if (t >= K.approve) log.push(['老板', '审批通过', '11-04 09:42']);
  log.forEach(([who, what, when], i) => {
    const ly = y + 446 + i * 46, la = seg(t, [K.submit, K.approve][i], [K.submit, K.approve][i] + 0.2);
    g.save(); g.globalAlpha *= la; g.fillStyle = i === 1 ? PAL.accent : PAL.dim; g.beginPath(); g.arc(x + 42, ly - 6, 5, 0, TAU); g.fill(); g.restore();
    T(g, `${who} · ${what}`, x + 62, ly, { px: 17, wt: 500, alpha: la, id: 'log' + i }); T(g, when, x + w - 32, ly, { px: 14, fam: 'mono', col: PAL.mute, align: 'right', alpha: la });
  });
  if (t < K.submit + 0.05) button(g, ...SUBMIT, '提交审批', { lit: seg(t, K.submit, K.submit + 0.04) });
  else if (t < K.approve + 0.6) {
    const boss = role(t) === '老板';
    button(g, ...REJ, '驳回', { dis: !boss });
    button(g, ...APR, '通过', { dis: !boss, lit: seg(t, K.approve, K.approve + 0.04) * (1 - seg(t, K.approve + 0.2, K.approve + 0.5)) });
    if (!boss) T(g, '当前身份无权审批', x + 332, 703, { px: 14, col: PAL.mute });
  }
  g.restore();
}
const curKeys7 = [[K.repl, [1500, 980]], [44.6, [560, 760]], [44.95, [520, 790]], [45.3, [1200, 760]], [45.55, [1360, 792]], [46.3, [1180, 690]], [46.75, [1150, 702]], [47.3, [1520, 790]], [48.9, [1520, 794]]];

// ═════════════════════════ 8 四端闭环 + 大数字（50.4–55.2）═════════════════════════
const MS = 0.36, MINI = { plugin: [520, 300], erp: [1400, 300], store: [1400, 790], app: [520, 790] };
const MLAB = { plugin: ['采集插件', 'CHROME · EDGE'], erp: ['ERP 后台', 'RBAC · 审批流'], store: ['独立站', '5 种语言 · AI 客服'], app: ['仓库 App', 'FLUTTER · 扫码'] };
const MBOX = { plugin: [150, 150, 1620, 700], erp: [170, 70, 1580, 800], store: [130, 96, 1660, 830], app: [500, 76, 1200, 808] };
function mini(g, key, t, draw) {
  const [cx, cy] = MINI[key];
  g.save(); g.translate(cx, cy); g.scale(MS, MS); g.translate(-960, -540); draw(); g.restore();
}
function loopUI(g, t, fold) {
  const order = ['plugin', 'erp', 'store', 'app'];
  // 闭环路径（圆角矩形经过四个中心）
  const pts = []; const C = order.map(k => MINI[k]);
  for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4]; for (let s = 0; s < 30; s++) pts.push([lerp(a[0], b[0], s / 30), lerp(a[1], b[1], s / 30)]); }
  const lp = seg(t, K.loop, K.fold), head = Math.floor(lp * pts.length);
  if (fold <= 0) {
    g.save(); g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 2; g.setLineDash([2, 10]); g.beginPath(); C.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke(); g.restore();
    ['采集', '上架', '下单', '补货'].forEach((w, i) => { const a = C[i], b = C[(i + 1) % 4], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; pill(g, m[0] - 34, m[1] - 15, w, { px: 15, fam: 'mono', col: PAL.text, fill: '#141821', alpha: seg(t, K.whip + 0.3 + i * S16 / 2, K.whip + 0.45 + i * S16 / 2), id: 'arc' + i }); });
  }
  order.forEach((k, i) => {
    const fp = seg(t, K.fold + i * S16, K.fold + i * S16 + 0.24);
    const [cx, cy] = MINI[k], [bx, by, bw, bh] = MBOX[k], fr = [cx + (bx - 960) * MS - 14, cy + (by - 540) * MS - 14, bw * MS + 28, bh * MS + 28];
    const draw = () => {
      g.save(); g.fillStyle = 'rgba(255,255,255,.02)'; rr(g, ...fr, 18); g.fill(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; rr(g, fr[0] + 0.5, fr[1] + 0.5, fr[2] - 1, fr[3] - 1, 18); g.stroke(); g.restore();
      mini(g, k, t, () => MDRAW[k](g));
      T(g, MLAB[k][0], fr[0] + 6, fr[1] + fr[3] + 30, { px: 18, wt: 600, id: 'm' + k });
      T(g, MLAB[k][1], fr[0] + fr[2] - 6, fr[1] + fr[3] + 30, { px: 13, fam: 'mono', col: PAL.mute, align: 'right' });
    };
    if (fp > 0) { g.save(); const p = eo(fp); g.translate(lerp(0, 960 - cx, p), lerp(0, 540 - cy, p)); crtOff(g, fr, fp, draw); g.restore(); } else draw();
  });
  if (lp > 0 && fold <= 0) {
    const tr = []; for (let j = Math.max(0, head - 40); j <= Math.min(head, pts.length - 1); j++) tr.push(pts[j]);
    E.trail(g, tr, { width: 7 });
    const hp = pts[Math.min(head, pts.length - 1)]; E.glow(g, hp[0], hp[1], 46, PAL.accent, 0.5);
    g.save(); g.fillStyle = PAL.accent; g.shadowColor = rgba(PAL.accent, 1); g.shadowBlur = 20; g.beginPath(); g.arc(hp[0], hp[1], 9, 0, TAU); g.fill(); g.restore();
  }
}
const MDRAW = {
  plugin: g => { sourceUI(g, 13.4); popupUI(g, 15.3); },
  erp: g => { sugUI(g, 50.0); poUI(g, 50.0); roleChip(g, 50.0); },
  store: g => { storeUI(g, 26.6); },
  app: g => { phoneUI(g, 40.4); stockUI(g, 40.4); },
};
function bigNumber(g, t) {
  if (t < K.num) return;
  const out = seg(t, K.end, K.end + 0.3);
  const draw = () => {
    E.glow(g, 960, 520, 520, PAL.accent, 0.06);
    E.scramble(g, '4', 900, 700, t, [K.num + 0.45], { px: 520, color: PAL.accent, align: 'center', tracking: -0.045, start: K.num });
    T(g, '个端', 1118, 700, { px: 56, wt: 500, col: PAL.dim, alpha: seg(t, K.num + 0.45, K.num + 0.6), id: 'numlab' });
    if (COLLECT && t > K.num + 0.5) T(g, '4', 900, 700, { px: 520, fam: 'disp', align: 'center', alpha: 0, id: 'num' });
  };
  if (out > 0) crtOff(g, [760, 260, 400, 460], out, draw); else draw();
}

// ═════════════════════════ 9 片尾（55.2–62.4）═════════════════════════
function endCard(g, t) {
  if (t < K.end + 0.1) return;
  const pa = (i) => seg(t, K.putAway + i * S16, K.putAway + i * S16 + 0.22);
  const mp = seg(t, K.end + 0.1, K.end + 0.4);
  const mOff = seg(t, K.off, K.off + 0.24);
  if (mOff < 1) crtOff(g, [900, 270, 120, 120], mOff, () => popIn(g, 960, 330, mp, () => waveMark(g, 960, 330, 120, { ph: t * 2.2, amp: 1 })));
  // 字标：光扫显影
  const [c, cg] = E.buf('word', 760, 180);
  cg.clearRect(0, 0, 760, 180); cg.font = font(120, 700, 'disp'); cg.fillStyle = PAL.text; cg.textAlign = 'center'; cg.textBaseline = 'alphabetic'; cg.letterSpacing = '-4px'; cg.fillText('Wavely', 380, 138);
  const rp = seg(t, K.end + 0.35, K.end + 1.65);
  if (rp > 0 && pa(0) < 1) crtOff(g, [580, 410, 760, 180], pa(0), () => E.lightReveal(g, c, 580, 410, 760, 180, rp, { base: 0.06, glint: 0.2, soft: 280 }));
  if (COLLECT && rp > 0.6 && pa(0) <= 0) T(g, 'Wavely', 960, 548, { px: 120, fam: 'disp', align: 'center', alpha: 0, id: 'word' });
  const la = seg(t, K.end + 0.8, K.end + 1.0);
  if (pa(1) < 1) crtOff(g, [600, 590, 720, 50], pa(1), () => T(g, '跨境电商全链路 · MIT 协议开源', 960, 628, { px: 34, wt: 500, col: PAL.dim, align: 'center', alpha: la, id: 'tag' }));
  const chips = ['1688 采集插件', 'ERP 后台', '五语言独立站', '仓库 App', 'AI 助手'];
  g.save(); g.font = font(17, 600); const ws = chips.map(s => g.measureText(s).width + 34); g.restore();
  let cx = 960 - (ws.reduce((a, b) => a + b, 0) + 14 * 4) / 2;
  chips.forEach((s, i) => { const a = seg(t, K.cards - 0.3 + i * S16 / 2, K.cards - 0.1 + i * S16 / 2); if (pa(2) < 1) crtOff(g, [cx, 676, ws[i], 34], pa(2), () => popIn(g, cx + ws[i] / 2, 693, a, () => pill(g, cx, 676, s, { px: 17, col: PAL.text }))); cx += ws[i] + 14; });
  const ua = seg(t, K.cards, K.cards + 0.2);
  [['在线体验', 'xiaozhuangping-cpu.github.io/wavely-crossborder', 'u1'], ['源码', 'github.com/xiaozhuangping-cpu/wavely-crossborder', 'u2']].forEach(([k, u, id], i) => {
    if (pa(3 + i) >= 1) return;
    crtOff(g, [520, 760 + i * 50, 880, 40], pa(3 + i), () => { T(g, k, 900, 790 + i * 50, { px: 18, col: PAL.mute, align: 'right', alpha: ua }); T(g, u, 924, 790 + i * 50, { px: 20, fam: 'mono', col: PAL.text, alpha: ua, id }); });
  });
}

// ═════════════════════════ 字幕 ═════════════════════════
function subAt(t) {
  for (const l of LINES) if (t >= l.t0 - 0.02 && t < l.t1) return { l, a: Math.min(seg(t, l.t0, l.t0 + 0.16), 1 - seg(t, l.t1 - 0.16, l.t1)) };
  return null;
}

// ═════════════════════════ 主渲染 ═════════════════════════
export function renderFilm(g, t, o = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const sa = subAt(t); LIFT = -24 * ss(sa ? sa.a : 0) * (t > K.click && t < K.num ? 1 : 0);
  let c;
  if (t < K.loc) {
    // 1–2：乱象 → 采集
    c = stormCam(t);
    if (t > K.dive) { const p = eio(seg(t, K.dive, K.loc)); const [rx, ry] = ROW(0); c = cam(lerp(960, rx + 44, p), lerp(540, ry + 44, p), logz(1, 7.6, p)); }
    stage(g, c, { cool: 1, dark: t < K.click ? 0.08 * seg(t, 0, K.freeze) : 0 });
    if (t < 10.9) for (const e of STORM) { c.apply(g, e.z); stormItem(g, e, Math.min(t, K.freeze), t); }
    c.apply(g, 0);
    if (t > K.src) {
      const rp = seg(t, K.src, K.src + 1.3);
      if (rp < 1) { const [sc, sg] = E.buf('src', W, H); sg.clearRect(0, 0, W, H); sourceUI(sg, t); E.lightReveal(g, sc, 0, 0, W, H, rp, { glint: 0.2, base: 0.05 }); }
      else sourceUI(g, t);
      popupUI(g, t); collectFlights(g, t);
    }
    if (t >= K.freeze) {
      const [x, y] = trackPos(curKeys2, t), k = press(t, K.click) * Math.min(...K.ticks.map(tp => press(t, tp))) * press(t, K.collect);
      const ap = t < K.click ? eo(seg(t, K.freeze, K.freeze + 0.18)) : 1;
      [K.click, ...K.ticks, K.collect].forEach(tp => { const q = trackPos(curKeys2, tp); ring(g, q[0], q[1], t - tp, { r1: tp === K.click ? 120 : 44, dur: tp === K.click ? 0.7 : 0.45 }); });
      cursor(g, x, y, { k: k * ap, alpha: (1 - seg(t, K.dive - 0.3, K.dive)) });
    }
  } else if (t < K.store) {
    // 3：AI 本地化（从采集箱缩略图匹配剪入）
    const p = eio(seg(t, K.loc, K.loc + 0.8)), hc = [HERO_IMG[0] + 280, HERO_IMG[1] + 280];
    let cx = lerp(hc[0], 960, p) + 50 * ss(seg(t, 17.6, 22.6)), cy = lerp(hc[1], 540, p), z = logz(540 / 560 * 1.0, 1, p) * (1 + 0.04 * ss(seg(t, 17.6, 22.6)));
    c = cam(cx, cy, z); stage(g, c); c.apply(g, 0);
    const out = seg(t, K.toStore, K.store - 0.15);
    editorUI(g, t, { out }); localizeFlights(g, t);
    const ip = eio(seg(t, K.toStore + 0.25, K.store));
    pic(g, IMG['ELE-001'], ...lr(HERO_IMG, [SLOT(HERO_I)[0], SLOT(HERO_I)[1], TW, TW], ip), 14);
    const [x, y] = trackPos([[K.loc, [1150, 820]], [17.3, [960, 344]], [18.3, [1150, 470]], [21.0, [1300, 760]], [22.4, [1420, 860]]], t);
    ring(g, 960, 344, t - K.ai);
    cursor(g, x, y, { k: press(t, K.ai), alpha: seg(t, K.loc + 0.2, K.loc + 0.4) * (1 - seg(t, 22.2, 22.6)) });
  } else if (t < K.orders) {
    // 4：上架 → 商品页 → 下单
    const z = 1 + 0.035 * ss(seg(t, K.snap, K.expand)) - 0.035 * ss(seg(t, K.expand, K.expand + 0.6));
    c = cam(960, 520 - 10 * ss(seg(t, K.store, K.snap)), z); stage(g, c); c.apply(g, 0);
    if (t < K.expand + 0.6) storeUI(g, t);
    productPage(g, t); orderMorph(g, t);
    const [x, y] = trackPos([[29.2, [1500, 980]], [30.4, [1420, 668]], [31.2, [1440, 690]]], t);
    ring(g, 1420, 668, t - K.buy);
    cursor(g, x, y, { k: press(t, K.buy), alpha: seg(t, 29.2, 29.5) * (1 - seg(t, K.buy + 0.3, K.buy + 0.5)) });
  } else if (t < K.ship) {
    // 5：订单收件箱（缓慢横移）
    c = cam(lerp(930, 990, ss(seg(t, K.orders, K.ship))), 520, 1); stage(g, c); c.apply(g, 0);
    orderMorph(g, t); inboxUI(g, t);
    const hp = seg(t, K.ship - 0.6, K.ship);
    if (hp > 0) { const r = lr(INROW(0), PHONE, eio(hp)); panel(g, ...r, { r: lerp(10, 54, eio(hp)), fill: lerp(0, 1, hp) > 0.5 ? '#0E1117' : '#1C2230', shadow: 1 }); }
  } else if (t < K.repl) {
    // 6：扫码发货（几乎锁定，光扫显影）
    c = cam(1000, 480, lerp(1, 1.05, ss(seg(t, K.ship, K.repl)))); stage(g, c); c.apply(g, 0);
    const rp = seg(t, K.ship, K.ship + 1.3);
    if (rp < 1) { const [pc, pg] = E.buf('phone', W, H); pg.clearRect(0, 0, W, H); phoneUI(pg, t); E.lightReveal(g, pc, 0, 0, W, H, rp, { glint: 0.2, base: 0.12, soft: 220 }); }
    else phoneUI(g, t);
    stockUI(g, t);
  } else if (t < K.whip) {
    // 7：补货与审批（审批前推近冻结帧）
    const pp = eio(seg(t, K.push, 48.6)) * (1 - eio(seg(t, K.approve + 0.25, K.hush)));
    c = cam(lerp(960, 1450, pp), lerp(520, 730, pp), logz(1, 1.4, pp)); stage(g, c); c.apply(g, 0);
    const sp = seg(t, K.repl, K.repl + 0.45);
    if (sp < 1) { const [x, y, w, h] = PHONE; g.save(); g.globalAlpha *= 1 - sp; g.translate(x + w / 2, y + h / 2); g.scale(1, 1 - ei(sp)); g.translate(-x - w / 2, -y - h / 2); phoneUI(g, t); g.restore(); }
    sugUI(g, t); poUI(g, t); roleChip(g, t);
    const [x, y] = trackPos(curKeys7, t), k = press(t, K.genPO) * press(t, K.submit) * press(t, K.role) * press(t, K.approve);
    [K.genPO, K.submit, K.role].forEach(tp => { const q = trackPos(curKeys7, tp); ring(g, q[0], q[1], t - tp); });
    ring(g, APR[0] + APR[2] / 2, APR[1] + 30, t - K.approve, { r0: 30, r1: 260, dur: 0.8 });
    cursor(g, x, y, { k, alpha: seg(t, 44.0, 44.3) * (1 - seg(t, K.approve + 0.5, K.approve + 0.8)) });
  } else {
    // 8–9：甩出拉远 → 四端闭环 → 大数字 → 片尾
    const [ex, ey] = MINI.erp, wp = eo(seg(t, K.whip, K.whip + B));
    c = cam(lerp(ex, 960, wp), lerp(ey, 545, wp), logz(1 / MS, 0.93, wp)); stage(g, c); c.apply(g, 0);
    const fold = seg(t, K.fold, K.num);
    if (t < K.num + 0.1) loopUI(g, t, fold);
    g.setTransform(1, 0, 0, 1, 0, 0);
    bigNumber(g, t); endCard(g, t);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  E.vignette(g, 0.52);
  if (!o.nosub && sa) E.toast(g, sa.l.text, sa.a, { dense: t < K.click ? 1 : 0 });
}

/** 每帧可见文字（readcheck 用；字幕由 .srt 检查，不在这里） */
export function TEXTS(t) {
  const [c, cg] = E.buf('tx', W, H); COLLECT = true; TX = [];
  try { renderFilm(cg, t, { nosub: true }); } finally { COLLECT = false; }
  return TX.filter(e => e.x1 > 0 && e.y1 > 0 && e.x0 < W && e.y0 < H);
}

// ═════════════════════════ 声音事件（mix.py 读取）═════════════════════════
export function buildEvents() {
  const ev = [], add = (t, type, x = {}) => ev.push({ t: +t.toFixed(4), type, ...x });
  STORM.forEach(e => add(e.t0, 'spawn_' + e.kind, { pan: +e.pan.toFixed(2), fg: e.z > 0.05 ? 1 : 0 }));
  add(K.freeze, 'freeze');
  add(K.click, 'press');
  K.retract.forEach((t, i) => add(t, 'retract', { i }));
  add(K.src, 'sweep');
  add(K.popup, 'popup');
  K.ticks.forEach((t, i) => add(t, 'tick', { i }));
  add(K.collect, 'click');
  [0, 1, 2].forEach(i => { add(K.collect + 0.3 + i * S16, 'fly', { i }); add(K.collect + 0.66 + i * S16, 'land', { i }); });
  add(K.dive, 'dive'); add(K.loc, 'match');
  add(K.ai, 'click'); add(K.ai + 0.05, 'ai');
  K.rows.forEach((t, i) => { add(t, 'stream', { i }); add(t + 0.26, 'grains', { d: 0.6 }); });
  [0.15, 0.3, 0.45, 0.6].forEach((d, i) => add(K.price + d, 'lock', { i }));
  add(K.toStore, 'collapse'); add(K.store, 'expand');
  SCAT.forEach((s, i) => { if (i !== HERO_I) add(s.t0, 'tile', { pan: +((s.x / W) * 2 - 1).toFixed(2) }); });
  add(K.snap - B, 'lift'); add(K.snap, 'snap');
  K.langs.forEach((t, i) => add(t, 'lang', { i }));
  add(K.expand, 'expand'); add(K.film, 'film');
  add(K.buy, 'click'); add(K.buy + 0.05, 'morph');
  ORDERS.forEach((o, i) => add(ORD_T(i), 'order', { i, pan: i === 0 ? 0 : ({ Amazon: -0.6, Shopee: 0.6, TikTok: -0.2, '独立站': 0.2 })[o[0]] }));
  add(K.ship - 0.6, 'expand');
  add(K.ship, 'sweep');
  K.scans.forEach((t, i) => add(t, 'scan', { i }));
  add(K.confirm, 'confirm');
  add(K.drain, 'roll', { d: 1.4 });
  add(41.6, 'low');
  add(K.repl, 'expand');
  add(K.sugLock, 'grains', { d: 0.45 }); [0.15, 0.3, 0.45].forEach((d, i) => add(K.sugLock + d, 'lock', { i }));
  add(K.genPO, 'click'); add(K.genPO + 0.05, 'po_in');
  add(K.submit, 'click'); add(K.role, 'click'); add(K.role, 'flip');
  add(K.push, 'push');
  add(K.approve, 'approve');
  add(K.whip, 'whip');
  [0, 1, 2, 3].forEach(i => add(K.loop + i * 0.3, 'node', { i }));
  [0, 1, 2, 3].forEach(i => add(K.fold + i * S16, 'fold', { i }));
  add(K.num, 'num'); add(K.num + 0.45, 'lock', { i: 3 });
  add(K.end, 'fold', { i: 4 }); add(K.end + 0.1, 'mark'); add(K.end + 0.35, 'sweep');
  [0, 1, 2, 3, 4].forEach(i => add(K.cards - 0.3 + i * S16 / 2, 'chip', { i }));
  [0, 1, 2, 3, 4].forEach(i => add(K.putAway + i * S16, 'retract', { i: 9 }));
  add(K.off, 'off');
  ev.push({ t: 0, type: 'meta', K, VO, BPM, subs: subs() });
  return ev.sort((a, b) => a.t - b.t);
}
