"""mix.py — 拟音 + 旁白 + 配乐闪避 → out/mix.wav
乱象的声音"散"（每个通知随机失谐几十音分、随机声像、不同音色）；Wavely 的声音"同一族"（毛毡 + 玻璃，全部落在 D 利底亚、居中）。
python mix.py
"""
import os, sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from scipy.ndimage import uniform_filter1d
LIB = os.environ.get('LIB', os.path.expanduser('~/lemo-opuscar')); sys.path.insert(0, LIB)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, add, compress, limit
D = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(os.path.join(D, 'events.json'))); DUR = J['dur']; EV = J['ev']
META = next(e for e in EV if e['type'] == 'meta'); K = META['K']; VO = META['VO']
rng = np.random.default_rng(2026)
N = int(DUR * SR)
fol = np.zeros((N, 2)); amb = np.zeros((N, 2)); vox = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
LYD = [74, 76, 78, 80, 81, 83, 85, 86, 88, 90, 92, 93]   # D 利底亚（Wavely 的调内音）

def sine(f, d, tau): return np.sin(2 * np.pi * f * t_(d)) * env_exp(d, tau)
def tick(v=1.0): d = .03; return norm(bp(noise(d), 1500, 3200) * env_exp(d, .0025) + sine(2100, d, .004) * .6) * v
def key(v=1.0): d = .07; p = 1 + rng.uniform(-.08, .08); return norm(bp(noise(d), 1400 * p, 5200 * p) * env_exp(d, .004) + sine(180 * p, d, .012) * .45) * v
def glass(f, v=1.0, d=.5, bright=1.0):
    x = sine(f, d, d * .35) + sine(2 * f, d, d * .18) * .35 * bright + sine(2.76 * f, d, d * .1) * .22 * bright + hp(noise(d), 5000) * env_exp(d, .002) * .3
    return norm(x) * v
def felt(v=1.0, f=320): d = .09; return norm(sine(f, d, .018) + lp(noise(d), 1400) * env_exp(d, .006) * .7 + sine(f * 2.01, d, .01) * .3) * v
def whoosh(d=.3, lo=500, hi=4000, v=1.0):
    n = noise(d); o = np.zeros_like(n); L = len(n); st = 480
    for i in range(0, L, st):
        u = i / L; f = lo * (hi / lo) ** u; w = min(st, L - i)
        o[i:i + w] = bp(n[max(0, i - 1500):i + w], f * .75, min(f * 1.3, SR / 2 - 100))[-w:]
    return norm(o * np.sin(np.pi * t_(d) / d) ** 1.5) * v
def pop(f=900, v=1.0): d = .12; tt = t_(d); fr = f * (1 + .6 * np.exp(-tt / .01)); return norm(np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(d, .03)) * v
def plop(v=1.0): d = .08; tt = t_(d); f = 320 * (1 - .5 * tt / d); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .02) + bp(noise(d), 2000, 6000) * env_exp(d, .003) * .4) * v
def thump(v=1.0, f=60, d=.4): tt = t_(d); return norm(np.sin(2 * np.pi * f * tt * (1 - .25 * tt)) * env_exp(d, .09) + lp(noise(d), 260) * env_exp(d, .02) * .6) * v
def doom(v=1.0):   # 按下：毛毡槌 + 55→40 Hz 正弦下滑
    d = 2.4; tt = t_(d); f = 40 + 15 * np.exp(-tt / .35)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .55) + lp(noise(d), 700) * env_exp(d, .012) * .9 + sine(140, d, .05) * .5 + sine(95, d, .12) * .5) * v
def shimmer(d=1.6, v=1.0):
    x = whoosh(d, 3000, 9500) * .7
    for m, a in [(93, .25), (98, .18), (105, .12)]: x += np.sin(2 * np.pi * hz(m) * t_(d)) * np.sin(np.pi * t_(d) / d) ** 2 * a
    return norm(x) * v
def grains(d=1.0, v=1.0):
    o = np.zeros(int(d * SR)); t = 0.0
    while t < d - .01:
        c = bp(noise(.006), 2500, 9000) * env_exp(.006, .001) * rng.uniform(.4, 1); s = int(t * SR); o[s:s + len(c)] += c[:len(o) - s]; t += .045 * (1 - .7 * t / d) + rng.uniform(0, .01)
    return norm(o) * v
def crt_off(v=1.0): d = .45; tt = t_(d); f = 900 * np.exp(-tt / .12) + 120; return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .15) * .5 + whoosh(d, 3000, 300) * .6) * v
def beep(v=1.0): d = .14; return norm(sine(hz(93), d, .06) + sine(hz(105), d, .03) * .3) * v
def glitch(v=1.0):
    d = .14; tt = t_(d); sq = np.sign(np.sin(2 * np.pi * np.cumsum(700 * (1 - .7 * tt / d)) / SR)); return norm(sq * env_exp(d, .04) * .5 + bp(noise(d), 800, 6000) * env_exp(d, .03)) * v

# ─────────── 环境底 ───────────
tt = np.arange(N) / SR
def ramp(a, b, fi=.3, fo=.3):
    e = np.zeros(N); s, e2 = int(a * SR), int(min(b, DUR) * SR); e[s:e2] = 1
    k = int(fi * SR); e[s:s + k] *= np.linspace(0, 1, len(e[s:s + k]))
    k = int(fo * SR); e[max(s, e2 - k):e2] *= np.linspace(1, 0, len(e[max(s, e2 - k):e2])); return e
room = lp(brown(DUR), 220) * .010
fan = bp(noise(DUR), 280, 1600) * .03
fanE = np.clip((tt - 6.6) / 1.6, 0, 1) ** 1.5 * (tt < K['freeze'])     # 旁白第一句结束后才升起
coil = np.sin(2 * np.pi * (6800 + 30 * np.sin(2 * np.pi * .7 * tt)) * tt) * .004 * np.clip((tt - 6.6) / 1.8, 0, 1) ** 2 * (tt < K['freeze'])
mono = room * (ramp(0, K['freeze'], .3, .005) + ramp(K['click'], K['hush'], .01, .1) + ramp(K['whip'], DUR, .05, 1.0)) + fan * fanE + coil
amb[:, 0] += mono; amb[:, 1] += np.roll(mono, 37)

# ─────────── 事件 ───────────
for e in EV:
    t, ty = e['t'], e['type']
    if ty.startswith('spawn_'):          # 乱象：散乱、失谐、随机声像
        kind = ty[6:]; det = rng.uniform(-.45, .45); f = hz(rng.choice(LYD[:8]) - 12) * 2 ** (det / 12); pan = e['pan'] * .9
        g = .07 if e['fg'] else .035
        if kind == 'notif': add(fol, pop(f), t, g, pan)
        elif kind == 'chat': add(fol, glass(f * 1.5, 1, .25, .5), t, g * .8, pan)
        elif kind == 'alert': add(fol, glitch(), t, g * 1.4, pan)
        else: add(fol, whoosh(.18, 900, 5000), t - .05, .07, pan * .7); add(fol, key(), t + .03, .05, pan)
    elif ty == 'press': add(fol, doom(), t, .85); add(fol, tick(), t, .35); add(fol, whoosh(.6, 200, 6000), t, .14)
    elif ty == 'retract': add(fol, crt_off(), t, .06 if e['i'] < 9 else .05); add(fol, felt(1, 300 + 30 * (e['i'] % 4)), t, .09)
    elif ty == 'sweep': add(fol, shimmer(1.7), t - .4, .12)           # J 切：光还没到，声音先到
    elif ty == 'popup': add(fol, whoosh(.25, 600, 3000), t - .05, .08); add(fol, felt(1, 360), t + .2, .08)
    elif ty == 'tick': add(fol, tick(), t, .2); add(fol, glass(hz(LYD[[0, 2, 4][e['i']]]), 1, .3, .7), t, .07)
    elif ty == 'click': add(fol, tick(), t, .22); add(fol, felt(1, 420), t, .1)
    elif ty == 'fly': add(fol, whoosh(.36, 600, 5000), t, .06, .4)
    elif ty == 'land': add(fol, plop(), t, .08, .5); add(fol, glass(hz(LYD[[4, 6, 8][e['i']]]), 1, .3, .6), t, .05, .5)
    elif ty == 'dive': add(fol, whoosh(1.2, 200, 7000), t, .12)
    elif ty == 'match': add(fol, felt(1, 300), t, .12)
    elif ty == 'ai': add(fol, glass(hz(98), 1, .9, 1.2), t, .1)
    elif ty == 'stream': add(fol, whoosh(.3, 1500, 6000), t, .05, [-.4, .4, -.2, .2][e['i']]); add(fol, glass(hz(LYD[[5, 7, 9, 11][e['i']]]), 1, .25, .6), t + .28, .06)
    elif ty == 'grains': add(fol, grains(e['d']), t, .06)
    elif ty == 'lock': add(fol, felt(1, 340 + 30 * e['i']), t, .12)
    elif ty == 'collapse': add(fol, crt_off(), t + .3, .14)
    elif ty == 'expand': add(fol, whoosh(.45, 400, 3200), t, .1)
    elif ty == 'tile': add(fol, pop(hz(rng.choice(LYD[4:])), 1), t, .03, e['pan'] * .8)
    elif ty == 'lift': add(fol, whoosh(.6, 300, 4000), t, .08)
    elif ty == 'snap':                    # 11 张瓦片同拍落地：同一族的调内闪烁
        for i in range(11): add(fol, glass(hz(LYD[i % len(LYD)]), 1, .4, .8), t + i * .004, .03, (i / 10 - .5) * 1.2)
        add(fol, thump(1, 70, .35), t, .2); add(fol, tick(), t, .2)
    elif ty == 'lang': add(fol, tick(), t, .12); add(fol, whoosh(.12, 2000, 6000), t, .04)
    elif ty == 'morph': add(fol, whoosh(.5, 3000, 600), t, .08)
    elif ty == 'order': add(fol, glass(hz(LYD[(e['i'] * 3) % len(LYD)]), 1, .35, .7), t, .07 if e['i'] else .12, e['pan'] * .8)
    elif ty == 'scan': add(fol, beep(), t, .16)
    elif ty == 'confirm': add(fol, felt(1, 300), t, .2); add(fol, thump(1, 55, .5), t, .2); add(fol, glass(hz(86), 1, .6), t + .02, .08)
    elif ty == 'roll': add(fol, grains(e['d']), t, .05)
    elif ty == 'low': add(fol, felt(1, 250), t, .1)
    elif ty == 'po_in': add(fol, whoosh(.4, 500, 3500), t, .09, .4)
    elif ty == 'flip': add(fol, whoosh(.2, 2000, 6000), t, .05, .6)
    elif ty == 'push': add(fol, whoosh(1.4, 200, 2500), t, .07)
    elif ty == 'approve': add(fol, doom(.8), t, .6); add(fol, tick(), t, .3)
    elif ty == 'whip': add(fol, whoosh(.55, 7000, 300), t - .05, .16)
    elif ty == 'node': add(fol, felt(1, 380 + 40 * e['i']), t, .1)
    elif ty == 'fold': add(fol, crt_off(), t, .08)
    elif ty == 'num': add(fol, thump(1, 70, .4), t, .25); add(fol, grains(.45), t + .02, .07)
    elif ty == 'mark': add(fol, felt(1, 360), t, .12)
    elif ty == 'chip': add(fol, glass(hz(LYD[e['i'] * 2]), 1, .25, .6), t, .04)
    elif ty == 'off': add(fol, crt_off(), t, .12)

# ─────────── 旁白 ───────────
lines = json.load(open(os.path.join(D, 'lines.json'), encoding='utf-8'))
vo_int = []
for L in lines:
    t0 = VO[L['id']]; y, sr = sf.read(os.path.join(D, 'voices', L['id'] + '.wav'))
    if y.ndim > 1: y = y.mean(1)
    y = resample_poly(y, SR, sr); y = compress(y / (np.abs(y).max() + 1e-9) * .9, .3, 3.0)
    add(vox, y, t0, .8); vo_int.append((t0, t0 + len(y) / SR))

# ─────────── 配乐 + 闪避 ───────────
mus = np.zeros((N, 2)); m, msr = sf.read(os.path.join(D, 'music', 'score.wav'), always_2d=True)
if msr != SR: m = resample_poly(m, SR, msr, axis=0)
mus[:min(N, len(m))] = m[:N]
duck = np.ones(N); duckF = np.ones(N)
for a, b in vo_int:
    s, e2 = int((a - .08) * SR), int((b + .12) * SR); duck[s:e2] = 10 ** (-8 / 20); duckF[s:e2] = 10 ** (-4 / 20)
duck = uniform_filter1d(duck, int(.12 * SR)); duckF = uniform_filter1d(duckF, int(.12 * SR))
# 第一句压在乱象最密的地方：音乐与拟音再让 3 dB
s1, e1 = int((VO['l1'] - .1) * SR), int((VO['l1'] + 5.0) * SR); duck[s1:e1] *= 10 ** (-3 / 20); duckF[s1:e1] *= 10 ** (-3 / 20)
mix = mus * .40 * duck[:, None] + fol * duckF[:, None] + amb + vox
# 两处静音：定格 8.4–9.6 全轨数字零；50.0–50.4 只留 −60 dB 房间底噪
a, b = int(K['freeze'] * SR), int(K['click'] * SR); mix[a:b] = 0
a, b = int(K['hush'] * SR), int(K['whip'] * SR); mix[a:b] = 0; mix[a:b, 0] += room[a:b] * .1; mix[a:b, 1] += room[a:b] * .1
f = int(.4 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None]
for c in range(2): mix[:, c] = limit(mix[:, c], .95)
a, b = int(K['freeze'] * SR), int(K['click'] * SR); mix[a:b] = 0
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
sf.write(os.path.join(D, 'out', 'mix.wav'), mix.astype(np.float32), SR)
if '--stems' in sys.argv:
    for nm, x in [("music", mus * .40 * duck[:, None]), ('foley', fol * duckF[:, None]), ('amb', amb), ('vox', vox)]: sf.write(os.path.join(D, 'out', f'stem_{nm}.wav'), x.astype(np.float32), SR)
print('mix.wav', mix.shape, 'peak %.3f' % np.abs(mix).max(), 'vo', [(round(a, 2), round(b, 2)) for a, b in vo_int])
