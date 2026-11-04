"""收集 film.js / lines.json 里的 CJK 字符，向 Google Fonts 请求 Noto Sans SC 子集（OFL），存为 fonts/NotoSC.woff2"""
import sys, re, json, os, urllib.request, urllib.parse
D = sys.argv[1]
src = open(os.path.join(D, 'film.js'), encoding='utf-8').read() if os.path.exists(os.path.join(D, 'film.js')) else ''
src += json.dumps(json.load(open(os.path.join(D, 'lines.json'), encoding='utf-8')), ensure_ascii=False)
chars = sorted(set(c for c in src if ord(c) > 0x2000))   # 所有非西文字符（中日文、符号），Inter 没有的由 Noto Sans SC 兜底
text = ''.join(chars) + '0123456789'
stamp = os.path.join(D, 'fonts', 'NotoSC.chars'); cssf = os.path.join(D, 'fonts', 'cjk.css')
if os.path.exists(cssf) and os.path.exists(stamp) and open(stamp, encoding='utf-8').read() == text:
    print('NotoSC up to date', len(chars)); sys.exit()
url = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400..700&text=' + urllib.parse.quote(text)
css = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36'})).read().decode()
blocks = re.findall(r'@font-face\s*{[^}]+}', css); assert blocks, css[:300]
for f in os.listdir(os.path.join(D, 'fonts')):
    if f.startswith('NotoSC') and f.endswith('.woff2'): os.remove(os.path.join(D, 'fonts', f))
out = []
for i, b in enumerate(blocks):
    u = re.search(r'url\((https://[^)]+)\)', b).group(1)
    open(os.path.join(D, 'fonts', f'NotoSC-{i}.woff2'), 'wb').write(urllib.request.urlopen(u).read())
    wt = re.search(r'font-weight:\s*(\d+)', b).group(1)
    ur = re.search(r'unicode-range:\s*([^;]+);', b)
    out.append("@font-face{font-family:NotoSC;src:url(NotoSC-%d.woff2) format('woff2');font-weight:%s;font-display:block;%s}" % (i, wt, f'unicode-range:{ur.group(1)};' if ur else ''))
open(cssf, 'w').write('\n'.join(out) + '\n')
open(stamp, 'w', encoding='utf-8').write(text)
print('NotoSC', len(chars), 'chars', len(blocks), 'files')
