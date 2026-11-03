// 把 ../extension 打包成 zip 放进 public/，供 ERP「1688 采集」页下载（零依赖的 zip 写入）
import { readdirSync, readFileSync, statSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../extension');
const pub = join(here, '../public');
mkdirSync(pub, { recursive: true });

// 版本号必须与 ERP 里的 EXTENSION_LATEST 一致，否则「有新版本」提示会出错
const manifestVersion = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8')).version;
const latest = (readFileSync(join(here, '../src/collect/extension.js'), 'utf8').match(/EXTENSION_LATEST = '([^']+)'/) || [])[1];
if (manifestVersion !== latest) { console.error(`extension version mismatch: manifest ${manifestVersion} vs EXTENSION_LATEST ${latest}`); process.exit(1); }

const files = [];
const walk = (dir) => readdirSync(dir).sort().forEach((n) => {
  if (n.startsWith('.')) return;
  const p = join(dir, n);
  statSync(p).isDirectory() ? walk(p) : files.push(p);
});
walk(src);

// 固定时间戳，内容不变时产物不变
const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
const locals = [], centrals = [];
let offset = 0;
for (const p of files) {
  const name = Buffer.from(`wavely-1688-collector/${relative(src, p).split('\\').join('/')}`);
  const raw = readFileSync(p);
  const data = deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10); central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  locals.push(local, name, data); centrals.push(central, name);
  offset += 30 + name.length + data.length;
}
const cd = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
writeFileSync(join(pub, 'wavely-1688-collector.zip'), Buffer.concat([...locals, cd, end]));
copyFileSync(join(src, 'icons/icon128.png'), join(pub, 'collector-icon.png'));
console.log(`extension packed: ${files.length} files`);
