#!/bin/sh
# 素材准备：OFL 字体、商品图缩略、主角商品短片逐帧（可重复执行）
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd); REPO=$(cd "$HERE/.." && pwd)
mkdir -p "$HERE/fonts" "$HERE/assets/products" "$HERE/assets/film"
GF=https://raw.githubusercontent.com/google/fonts/main/ofl
get() { [ -s "$HERE/fonts/$2" ] || curl -fsSL "$GF/$1" -o "$HERE/fonts/$2"; }
get 'inter/Inter%5Bopsz%2Cwght%5D.ttf' Inter.ttf
get 'intertight/InterTight%5Bwght%5D.ttf' InterTight.ttf
get 'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf' JBMono.ttf
get 'inter/OFL.txt' OFL-inter.txt
get 'jetbrainsmono/OFL.txt' OFL-jetbrainsmono.txt
# 中文：只取片中用到的字（film.js + lines.json），Google Fonts 子集
python3 "$HERE/tools/cjk.py" "$HERE"
# 商品图 → 480px
for f in "$REPO"/shop/public/products/WV-*.jpg; do
  b=$(basename "$f"); [ -s "$HERE/assets/products/$b" ] || ffmpeg -v error -y -i "$f" -vf scale=480:-2 -q:v 3 "$HERE/assets/products/$b"
done
# 主角商品场景短片（Veo 生成，项目自有素材）→ 24 fps 逐帧 960 宽
[ -s "$HERE/assets/film/f_090.jpg" ] || ffmpeg -v error -y -ss 0.5 -t 4.6 -i "$REPO/shop/public/videos/WV-ELE-001.mp4" -vf fps=24,scale=960:-2 -q:v 3 -start_number 0 "$HERE/assets/film/f_%03d.jpg"
ls "$HERE/fonts" "$HERE/assets/film" | wc -l
