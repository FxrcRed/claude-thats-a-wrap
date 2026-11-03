"""Synthesize the plugin's one sound, thats-a-wrap/sounds/sent.wav (original, no samples).

Played once when the credits roll: a soft "sent" swoosh -- band-passed noise sweeping up,
swelling and fading -- that lands on a gentle pop. Low level, soft attack, nothing sharp.
Run: python tools/make_sounds.py
"""
import math
import random
import struct
import wave
from pathlib import Path

SR = 44100
OUT = Path(__file__).resolve().parent.parent / 'thats-a-wrap' / 'sounds'
random.seed(3)


def whoosh(dur, f0, f1, q, peak_at, tail):
    out = []
    x1 = x2 = y1 = y2 = 0.0
    for i in range(int(SR * dur)):
        p = i / SR / dur
        fc = f0 * (f1 / f0) ** p  # exponential sweep of the band centre
        w = 2 * math.pi * fc / SR
        a = math.sin(w) / (2 * q)
        a0, a1, a2 = 1 + a, -2 * math.cos(w), 1 - a
        x = random.uniform(-1, 1)
        y = (a * x - a * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x, y1, y
        env = (p / peak_at) ** 2 if p < peak_at else math.exp(-(p - peak_at) * tail)
        out.append(y * env)
    return out


def pop(freq, dur):
    return [min(1.0, t / 0.003) * math.exp(-t * 40) * math.sin(2 * math.pi * freq * t)
            for t in (i / SR for i in range(int(SR * dur)))]


sig = whoosh(0.45, 400, 3500, 1.2, 0.4, 7)
landing = pop(1320, 0.18)
at = int(SR * 0.38)
sig += [0.0] * (at + len(landing) - len(sig))
for i, x in enumerate(landing):
    sig[at + i] += x * 0.25

OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.wav'):
    old.unlink()
peak = max(abs(x) for x in sig)
with wave.open(str(OUT / 'sent.wav'), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(x / peak * 0.3 * 32767)) for x in sig))
print('wrote', OUT / 'sent.wav')
