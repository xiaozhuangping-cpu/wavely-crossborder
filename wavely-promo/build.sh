#!/bin/sh
# 一键重建 Wavely 宣传片：sh build.sh（需要 Lemo-Opuscar 库，默认 ~/lemo-opuscar）
set -e
LIB=${LIB:-$HOME/lemo-opuscar}
export LIB
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the Lemo-Opuscar library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
sh "$HERE/tools/prep.sh"                                                         # 1. 字体（含中文子集）、商品图、短片逐帧
cd "$LIB"
[ -s "$HERE/voices/dur.json" ] || $PY core/tts/tts_zh.py "$HERE/lines.json" "$HERE/voices" --voice zh-CN-YunxiNeural --rate +6%   # 2. 旁白
$PY core/tts/asr_check.py "$HERE/lines.json" "$HERE/voices" --lang zh            # 3. 逐句语音识别校对
node core/render/events.mjs "$HERE"                                              # 4. 画面事件 + 时间线 → events.json
$PY "$HERE/music/score.py"                                                       # 5. 原创配乐
$PY "$HERE/mix.py"                                                               # 6. 拟音 + 旁白 + 闪避 → out/mix.wav
$PY -c "import json,sys;e=json.load(open(sys.argv[1]))['ev'];json.dump(next(x for x in e if x['type']=='meta')['subs'],open(sys.argv[2],'w'),ensure_ascii=False)" "$HERE/events.json" "$HERE/out/srt.json"
$PY core/render/srt.py "$HERE/out/srt.json" "$HERE/wavely-promo.srt"             # 7. 字幕
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"   # 8. 逐帧渲染
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/wavely-promo.mp4" 24 0   # 9. 合成，−14 LUFS，无颗粒
node core/render/still.mjs "$HERE" 26.6 --q nosub=1 --out "$HERE/out/still" --prefix po_ && cp "$HERE/out/still/po_26.6.jpg" "$HERE/poster.jpg"
