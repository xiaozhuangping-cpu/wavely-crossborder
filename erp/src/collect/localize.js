// 采集商品多语言：从勾选的规格按维度提取不重复的值 → 经边缘函数 AI 翻译 → 拼回每个 SKU
// 规格字符串形如「白色 / L」，维度名形如「颜色 / 尺码」（与采集插件、独立站规格选择器一致）
import { translateProducts } from '../ai/adapter';

const SEP = ' / ';
const LANGS = ['en', 'de', 'ja', 'es'];
const partsOf = (spec, n) => {
  const p = String(spec).split(SEP);
  return n > 1 && p.length === n ? p : [String(spec)];
};

/** 构造翻译请求的一个商品 */
export const translateItem = ({ id, title, optionName, rows, description }) => {
  const names = (optionName || '规格').split(SEP);
  const on = rows.filter((r) => r.on);
  const dims = names.map((name, i) => ({ name, values: [...new Set(on.map((r) => partsOf(r.spec, names.length)[i]).filter(Boolean))] }));
  return { id: String(id), title, dims, description: description || '' };
};

/** 把翻译结果合并进 import_draft 的请求体（缺失的语言回退为中文） */
export const applyTranslation = (payload, item, t, { keepZhName = false } = {}) => {
  if (!t) return payload;
  const n = item.dims.length;
  const name = { ...payload.name };
  if (!keepZhName && t.name?.zh) name.zh = t.name.zh;
  for (const l of LANGS) if (t.name?.[l] && !name[l]) name[l] = t.name[l];
  const option_name = { ...payload.option_name };
  for (const l of LANGS) {
    const parts = item.dims.map((d, i) => t.dims?.[i]?.name?.[l] || d.name);
    if (parts.some((x, i) => x !== item.dims[i].name)) option_name[l] = parts.join(SEP);
  }
  const skus = payload.skus.map((s) => {
    const parts = partsOf(s.option_value.zh, n);
    const ov = { ...s.option_value };
    for (const l of LANGS) {
      const tr = parts.map((p, i) => t.dims?.[i]?.values?.[item.dims[i]?.values.indexOf(p)]?.[l] || p);
      if (tr.some((x, i) => x !== parts[i])) ov[l] = tr.join(SEP).slice(0, 120);
    }
    return { ...s, option_value: ov };
  });
  const description = { ...payload.description, ...Object.fromEntries(LANGS.filter((l) => t.description?.[l]).map((l) => [l, t.description[l]])) };
  return { ...payload, name, option_name, skus, description };
};

/** 分批翻译：每批 ≤ 5 个商品、≤ 80 个规格值；onBatch(done, total) 汇报进度。返回 {id: 结果}，失败的批次记入 errors */
export async function translateAll(items, onBatch) {
  const batches = [];
  let cur = [], vals = 0;
  for (const it of items) {
    const n = it.dims.reduce((s, d) => s + d.values.length, 0);
    if (cur.length && (cur.length >= 5 || vals + n > 80)) { batches.push(cur); cur = []; vals = 0; }
    cur.push(it); vals += n;
  }
  if (cur.length) batches.push(cur);
  const out = {}, errors = [];
  for (let i = 0; i < batches.length; i++) {
    onBatch?.(i, batches.length);
    try { Object.assign(out, await translateProducts(batches[i])); }
    catch (e) { errors.push(e.message); if (/额度|quota/i.test(e.message)) break; }
  }
  return { results: out, errors };
}
