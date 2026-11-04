"""score.py — Wavely 宣传片原创配乐（纯 numpy 合成，无采样）→ music/score.wav
100 BPM，D 利底亚（D E F# G# A B C#）。
  0–8.4    乱象：低频正弦脉冲从八分加速到十六分 + 一层逐渐失谐、上行的铺底（不和谐 G#/D# 慢慢挤进来）
  8.4–9.6  数字静音
  9.6–     加法过程：8 个音的木琴音型，每小节多一个音；16.8 起颤音琴和弦铺底 + 低音脉冲
  25.2     上架：全声部同落一个和弦
  47.4–49.2 推近冻结：减到只剩脉冲和一个颤音琴长音
  49.2     审批通过：钢片琴 + 颤音琴和弦
  50.0–50.4 近静音；50.4 甩出：所有声部落在同一个 D 利底亚和弦
  52.8     大数字：只剩低频脉冲；55.2 片尾：和弦延音，木琴音型逐小节减音直到一个音
python music/score.py
"""
import os, sys, json, numpy as np, soundfile as sf
LIB = os.environ.get('LIB', os.path.expanduser('~/lemo-opuscar')); sys.path.insert(0, LIB)
from core.audio.sfx import SR, t_, env_exp, lp, hp, bp, noise, norm, add
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(D)
EV = json.load(open(os.path.join(ROOT, 'events.json')))['ev']
META = next(e for e in EV if e['type'] == 'meta'); K = META['K']
DUR = json.load(open(os.path.join(ROOT, 'events.json')))['dur']
B = 60 / META['BPM']; BAR = 4 * B
N = int(DUR * SR) + SR
out = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
rng = np.random.default_rng(7)

# ─────────── 音色 ───────────
def marimba(m, v=1.0, d=0.9):
    f = hz(m); tt = t_(d)
    x = np.sin(2 * np.pi * f * tt) * env_exp(d, .28) + .35 * np.sin(2 * np.pi * 4 * f * tt) * env_exp(d, .04) + .12 * np.sin(2 * np.pi * 9.9 * f * tt) * env_exp(d, .012)
    x[:96] *= np.linspace(0, 1, 96); return x * v
def vibe(m, v=1.0, d=2.6, trem=5.2):
    f = hz(m); tt = t_(d)
    x = (np.sin(2 * np.pi * f * tt) + .22 * np.sin(2 * np.pi * 4 * f * tt) * env_exp(d, .25)) * env_exp(d, d * .38) * (1 + .22 * np.sin(2 * np.pi * trem * tt))
    x[:240] *= np.linspace(0, 1, 240); return x * v
def bowed(m, v=1.0, d=3.0):     # 弓擦颤音琴：慢起、长持续
    f = hz(m); tt = t_(d); e = np.minimum(1, tt / (d * .35)) * np.minimum(1, (d - tt) / (d * .4))
    return (np.sin(2 * np.pi * f * tt) + .12 * np.sin(2 * np.pi * 2 * f * tt)) * e * v
def celesta(m, v=1.0, d=1.4):
    f = hz(m); tt = t_(d)
    x = np.sin(2 * np.pi * f * tt) * env_exp(d, .5) + .4 * np.sin(2 * np.pi * 2 * f * tt) * env_exp(d, .18) + .18 * np.sin(2 * np.pi * 5.4 * f * tt) * env_exp(d, .05)
    x[:48] *= np.linspace(0, 1, 48); return x * v
def pulse(m, v=1.0, d=.32):     # 低频正弦脉冲（带 2、3 次谐波，小喇叭也听得到）
    f = hz(m); tt = t_(d); e = env_exp(d, .09); e[:120] *= np.linspace(0, 1, 120)
    return (np.sin(2 * np.pi * f * tt) + .35 * np.sin(2 * np.pi * 2 * f * tt) + .15 * np.sin(2 * np.pi * 3 * f * tt)) * e * v
def pad(ms, d, v=1.0, det=0.0, bright=900):
    tt = t_(d); x = np.zeros(len(tt))
    for m in ms:
        for c in (-7, 0, 7):
            f = hz(m) * 2 ** ((c + det) / 1200); x += 2 * ((tt * f) % 1) - 1
    x = lp(x, bright) / (len(ms) * 3)
    e = np.minimum(1, tt / min(.8, d * .3)) * np.minimum(1, (d - tt) / min(1.2, d * .4)); return x * e * v
def shaker(v=1.0):
    d = .06; return hp(noise(d), 6000) * env_exp(d, .012) * v

def put(x, at, g=1.0, pan=0.0):
    if at < 0 or at >= DUR: return
    add(out, x, at, g, pan)
def silent(a, b): out[int(a * SR):int(b * SR)] = 0

LYD = [62, 64, 66, 68, 69, 71, 73]       # D 利底亚
PAT = [74, 81, 78, 85, 76, 81, 80, 88]   # 8 音音型（D A F# C# E A G# E），八分音符
ADD_ORDER = [0, 4, 2, 6, 1, 5, 3, 7]     # 加法：每小节多放出一个位置
CH = [[50, 62, 66, 69, 73, 80], [47, 59, 62, 66, 69, 73], [43, 55, 59, 62, 66, 71], [45, 57, 61, 64, 68, 71]]   # Dmaj7#11 / Bm9 / Gmaj9 / A6

# ─────────── 0–8.4 乱象 ───────────
fz = K['freeze']
t = 0.0
while t < fz - 1e-6:
    step = B / 2 if t < 4.8 else B / 4 if t < 7.2 else B / 8
    put(pulse(38, 1, .26), t, .5 + .3 * t / fz)
    t += step
put(pad([50, 57, 62], fz, 1, 0, 700), 0, .35)
put(pad([63, 68], fz - 2.4, 1, 18, 1400), 2.4, .22)            # 失谐的 D#/G# 挤进来
put(pad([75, 80], fz - 5.0, 1, -26, 2400), 5.0, .14)
silent(fz, K['click'])

# ─────────── 9.6 起：加法过程 ───────────
c0 = K['click']; end_add = K['hush']
nb = int((end_add - c0) / BAR) + 1
for b in range(nb):
    on = set(ADD_ORDER[:min(8, b + 1)])
    for s in range(8):
        tt0 = c0 + b * BAR + s * B / 2
        if tt0 >= end_add: break
        if K['push'] <= tt0 < K['approve']: continue          # 推近冻结：木琴退出
        if s in on: put(marimba(PAT[s], 1, .9), tt0, .30, (s % 2 - .5) * .3)
put(vibe(74, 1, 3.0), c0, .5); put(vibe(81, 1, 3.0), c0, .35)       # 按下后的第一个和弦（与 press 同一刻）
# 16.8 起：颤音琴和弦 + 低音脉冲 + 沙锤
t = K['loc']; k = 0
while t < end_add - .1:
    ch = CH[k % 4]; d = min(2 * BAR, end_add - t)
    if not (K['push'] <= t < K['approve']):
        for m in ch[2:]: put(vibe(m, 1, d), t, .11)
        put(pad(ch[:3], d, 1, 0, 600), t, .22)
    t += 2 * BAR; k += 1
t = K['loc']
while t < end_add - .05:
    if not (K['push'] <= t < K['approve']) or abs((t - K['push']) % B) < 1e-6:
        put(pulse(38 if int((t - K['loc']) / (2 * BAR)) % 4 != 3 else 45, 1, .3), t, .5)
    if K['store'] <= t < K['push']: put(shaker(1), t + B / 2, .05, .2)
    t += B
put(bowed(81, 1, K['approve'] - K['push'] + .3), K['push'], .22)  # 冻结时的长音
# 上架：全声部同一和弦
for m in [50, 62, 69, 74, 78, 81, 85, 88]: put(vibe(m, 1, 3.2), K['snap'], .12)
for m in [74, 81, 88]: put(celesta(m, 1, 1.6), K['snap'], .16)
# 审批通过
for m in [62, 69, 74, 78, 85]: put(vibe(m, 1, 2.4), K['approve'], .13)
for m in [86, 93]: put(celesta(m, 1, 1.4), K['approve'], .18)

# ─────────── 50.4 甩出：一个和弦 → 闭环 → 大数字 ───────────
w = K['whip']
for m in [38, 50, 57, 62, 66, 69, 73, 76, 80]: put(bowed(m, 1, 3.6) if m < 60 else vibe(m, 1, 3.6), w, .16 if m >= 60 else .3)
for i, m in enumerate([74, 78, 81, 85]): put(celesta(m, 1, 1.2), K['loop'] + i * .3, .2)
t = K['num']
while t < K['end']: put(pulse(38, 1, .3), t, .55); t += B
put(pulse(26 + 12, 1, .9), K['num'] + .45, .5)

# ─────────── 片尾：和弦延音 + 减法 ───────────
e = K['end']
put(pad([50, 57, 62, 69], DUR - e, 1, 0, 800), e, .3)
for m in [62, 69, 73, 76, 80]: put(vibe(m, 1, 4.0), e, .1)
nb = int((K['off'] - e) / BAR) + 1
for b in range(nb):
    keep = [s for s in ADD_ORDER[:max(1, 8 - 2 * b)]]
    for s in range(8):
        tt0 = e + B * 2 + b * BAR + s * B / 2
        if tt0 >= K['off']: break
        if s in keep: put(marimba(PAT[s], 1, .9), tt0, .24, (s % 2 - .5) * .3)
put(celesta(86, 1, 2.0), K['off'], .2)

silent(K['hush'], K['whip'])
silent(fz, K['click'])
out = out[:int(DUR * SR)]
out = out / (np.abs(out).max() + 1e-9) * .8
sf.write(os.path.join(D, 'score.wav'), out.astype(np.float32), SR)
print('score.wav', round(DUR, 2), 's')
