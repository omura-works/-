# サウンドトラック: 全サンプルを数式から合成する (外部音源なし)
#   100 BPM / 25 小節 = 60 秒。映像の章立て (3+4+4+4+4+6 小節) と同期
import numpy as np, wave, sys

SR, BPM, BARS = 48000, 100, 25
BEAT = 60 / BPM; BAR = 4 * BEAT; N = int(SR * BAR * BARS)
rs = np.random.RandomState(7)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

CH = [(45, [57, 60, 64, 67, 71]), (41, [57, 60, 64, 65, 72]), (36, [55, 59, 60, 64, 67]), (43, [55, 59, 62, 64, 69])]  # Am9 Fmaj7 Cmaj7 G6/9
#       0  1  2 | 3  4  5  6 | 7  8  9 10 |11 12 13 14 |15 16 17 18 |19 20 21 22 23 24
KICK = [0, 0, 0,  1, 1, 1, 1,  1, 1, 1, 1,  2, 2, 2, 2,  0, 0, 1, 2,  2, 2, 2, 2, 0, 0]   # 1=1,3拍 2=4つ打ち
HAT  = [0, 0, 0,  0, 0, 1, 1,  1, 1, 2, 2,  2, 2, 2, 2,  0, 1, 2, 2,  2, 2, 2, 2, 0, 0]   # 1=裏8分 2=16分
ARP  = [0, 1, 1,  1, 1, 1, 1,  2, 2, 2, 2,  2, 2, 2, 2,  1, 1, 2, 2,  2, 2, 2, 1, 1, 0]   # 1=8分 2=16分
BASS = [0, 0, 0,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1,  1, 1, 1, 1, 1, 1]
CLAP = [0, 0, 0,  0, 0, 0, 0,  0, 0, 1, 1,  1, 1, 1, 1,  0, 0, 0, 1,  1, 1, 1, 1, 0, 0]
SCENE_BARS = [3, 7, 11, 15, 19]            # 章の切り替わり

def add(buf, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[:N - i]
    buf[0, i:i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2)
    buf[1, i:i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2)

def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2; e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

def fftfilt(x, fn):                        # 周波数領域での静的フィルタ
    X = np.fft.rfft(x); return np.fft.irfft(X * fn(np.fft.rfftfreq(len(x), 1 / SR)), len(x))

def pad_note(f, dur):                      # 少しずつ離調した倍音加算パッド
    t = np.arange(int(dur * SR)) / SR; out = np.zeros((2, len(t)))
    for det, pan in [(-0.006, -0.7), (0.0, 0.0), (0.007, 0.7)]:
        v = sum(np.sin(2 * np.pi * f * (1 + det) * h * t + rs.rand() * 6.28) / h ** 1.7 for h in range(1, 9) if f * h < 9000)
        v *= 1 + 0.25 * np.sin(2 * np.pi * 0.23 * t + rs.rand() * 6.28)
        out[0] += v * np.sqrt((1 - pan) / 2); out[1] += v * np.sqrt((1 + pan) / 2)
    return out * env(len(t), 0.5, 0.9)

def pluck(f, dur=0.9, bright=1.0):
    t = np.arange(int(dur * SR)) / SR
    v = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (5 + 3.5 * h)) / h ** (1.25 / bright) for h in range(1, 9))
    return v * np.minimum(1, t / 0.003)

def kick():
    t = np.arange(int(0.45 * SR)) / SR
    ph = 2 * np.pi * np.cumsum(46 + 110 * np.exp(-t * 32)) / SR
    return np.tanh(np.sin(ph) * np.exp(-t * 8.5) * 1.6) + 0.25 * rs.randn(len(t)) * np.exp(-t * 400)

NOISE = fftfilt(rs.randn(SR), lambda f: (f / (f + 7000.0)) ** 3)
def hat(d=45): n = int(0.12 * SR); o = rs.randint(0, SR - n); return NOISE[o:o + n] * np.exp(-np.arange(n) / SR * d)
CL = fftfilt(rs.randn(SR), lambda f: np.exp(-((np.log2(np.maximum(f, 1) / 1700.0)) ** 2) * 1.6))
def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR; e = sum(np.exp(-np.maximum(t - d, 0) * 38) * (t >= d) for d in (0, 0.011, 0.023)) / 2
    return CL[:n] * e

dry, wet, duck = np.zeros((2, N)), np.zeros((2, N)), np.ones(N)
drums = np.zeros((2, N))
for b in range(BARS):
    t0 = b * BAR; root, notes = CH[b % 4]
    last = b == BARS - 1
    # パッド (最終小節は鳴らさず余韻のみ)
    if not last:
        g = 0.034 * (0.7 if b < 3 else 1.0) * (1.25 if b >= 23 else 1.0)
        for m in notes:
            pn = pad_note(hz(m), BAR + 0.9 + (3.0 if b == 23 else 0)); i = int(t0 * SR); L = min(pn.shape[1], N - i); wet[:, i:i + L] += pn[:, :L] * g
    if BASS[b] and not last:
        n = int((BAR * (2 if b == 23 else 1)) * SR); t = np.arange(n) / SR; f = hz(root - 12 if root > 40 else root)
        pat = np.zeros(n)
        for q in ([0, 1.5, 2.5, 3.5] if KICK[b] == 2 else [0, 2.5]) if b < 23 else [0]:
            s = int(q * BEAT * SR); tt = np.arange(n - s) / SR; pat[s:] = np.exp(-tt * (0.8 if b == 23 else 2.2)) * np.minimum(1, tt / 0.008)
        add(dry, t0, np.tanh((np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * pat * 1.5), 0.2)
    if ARP[b]:
        seq = [notes[k] + 12 for k in (0, 2, 4, 1, 3, 2, 4, 3)]; step = BEAT / 2 if ARP[b] == 1 else BEAT / 4
        for k in range(int(round(BAR / step))):
            m = seq[k % 8] + (12 if (k // 8) % 2 else 0); acc = 1.0 if k % 4 == 0 else 0.62
            p = pluck(hz(m), bright=1.0 + 0.5 * (b >= 11)) * acc * (0.6 if b < 3 else 1)
            pan = 0.55 * np.sin(k * 1.9 + b)
            add(dry, t0 + k * step, p, 0.12, pan); add(wet, t0 + k * step, p, 0.06, -pan)
            add(wet, t0 + k * step + BEAT * 0.75, p, 0.035, -pan); add(wet, t0 + k * step + BEAT * 1.5, p, 0.018, pan)   # 付点8分ディレイ
    for q in ({1: [0, 2], 2: [0, 1, 2, 3]}.get(KICK[b], [])):
        tk = t0 + q * BEAT; add(drums, tk, kick(), 0.62)
        i = int(tk * SR); n = int(0.28 * SR); duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / SR * 11))
    if HAT[b]:
        for k in range(16):
            if HAT[b] == 1 and k % 4 != 2: continue
            add(drums, t0 + k * BEAT / 4, hat(40 if k % 4 == 2 else 80), (0.34 if k % 4 == 2 else 0.15) * (0.8 + 0.4 * rs.rand()), 0.3 * (-1) ** k)
    if CLAP[b]:
        for q in (1, 3): add(drums, t0 + q * BEAT, clap(), 0.3); add(wet, t0 + q * BEAT, clap(), 0.06)

# 章の変わり目: ノイズのライザー + 低いインパクト
for sb in SCENE_BARS:
    ts = sb * BAR; n = int(1.8 * SR); t = np.arange(n) / SR
    rise = fftfilt(rs.randn(n), lambda f: (f / (f + 2500.0)) ** 2) * (t / 1.8) ** 3
    add(wet, ts - 1.8, rise, 0.11, -0.2)
    n = int(1.6 * SR); t = np.arange(n) / SR
    add(dry, ts, np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 9)) / SR) * np.exp(-t * 3.2), 0.3)
    add(wet, ts, fftfilt(rs.randn(n), lambda f: (f / (f + 5000.0)) ** 2) * np.exp(-t * 4.5), 0.09)

# リバーブ: 指数減衰ノイズとの畳み込み
def reverb(x, secs=2.8):
    n = int(secs * SR); t = np.arange(n) / SR; out = np.zeros_like(x); M = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    for c in range(2):
        ir = fftfilt(rs.randn(n), lambda f: 1 / (1 + (f / 5200.0) ** 2)) * np.exp(-t * 2.6); ir[: int(0.012 * SR)] = 0
        out[c] = np.fft.irfft(np.fft.rfft(x[c], M) * np.fft.rfft(ir, M), M)[: x.shape[1]]
    return out / 26
mix = (dry + wet * 0.75 + reverb(wet + dry * 0.25) * 0.85) * (0.45 + 0.55 * duck) + drums
mix[:, : int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR)) ** 1.5
fo = int(3.0 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.6
mix = np.tanh(mix * 0.95 / np.percentile(np.abs(mix), 99.9))
mix *= 0.89 / np.abs(mix).max()
out = sys.argv[1] if len(sys.argv) > 1 else 'out/audio.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype('<i2').tobytes())
print(f'{out}: {N / SR:.1f}s, {N * 2:,} samples, peak {np.abs(mix).max():.2f}, rms {np.sqrt((mix ** 2).mean()):.3f}')
