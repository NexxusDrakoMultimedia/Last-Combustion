#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: Nexxus Drako Multimedia
"""Balance check for the GDD formulas (prototype; reimplement in TypeScript at M2).

Checks that driver skill matters at least as much as car quality (design pillar
"Driver over horsepower") and that the supercar premium is real but not decisive.
Run: python3 tools/balance/prelim_check.py
"""
import random, statistics as st

random.seed(2031)
N = 313
SECTORS = 12
K_C, K_D = 0.12, 0.09          # car and driver weights (docs: Formulas)
SC_MEAN, SC_SD = 0.52, 0.12     # supercar sector-fit distribution (docs: World generation)
OTH_MEAN, OTH_SD = 0.46, 0.10   # JDM and sports cars

def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))

def make_field(supercar_share=0.5):
    field = []
    for _ in range(N):
        # driver pace ~ N(45,12) clamped 20..85, scaled to 0..1
        pace = clamp(random.gauss(45, 12), 20, 85)
        d = (pace - 20) / 65
        tier = random.random() < supercar_share
        # car fit 0..1: supercars centred high, others lower, both noisy
        c = clamp(random.gauss(SC_MEAN if tier else OTH_MEAN, SC_SD if tier else OTH_SD))
        cons = clamp(random.gauss(50, 14), 10, 90)
        field.append((d, c, cons, tier))
    return field

def run(entry):
    d, c, cons, _ = entry
    total = 0.0
    sigma = 0.006 * (1 - cons / 150)
    for _ in range(SECTORS):
        fit = clamp(c + random.gauss(0, 0.05))
        t = 1 * (1 - K_C * (fit - 0.5)) * (1 - K_D * (d - 0.5))
        t *= 1 + random.gauss(0, sigma)
        total += t
    return total

def season_stats(share):
    field = make_field(share)
    times = [run(e) for e in field]
    order = sorted(range(N), key=lambda i: times[i])
    top15 = order[:15]
    sc_in_top = sum(field[i][3] for i in top15)
    rd = st.correlation([e[0] for e in field], [-t for t in times])
    rc = st.correlation([e[1] for e in field], [-t for t in times])
    return rd, rc, sc_in_top

for share in (0.5,):
    rds, rcs, scs = [], [], []
    for _ in range(300):
        rd, rc, sc = season_stats(share)
        rds.append(rd); rcs.append(rc); scs.append(sc)
    print(f"supercar share {share:.0%}: corr(driver,pace)={st.mean(rds):.2f}  corr(car,pace)={st.mean(rcs):.2f}  supercars in top 15 = {st.mean(scs):.1f}/15")

# head-to-head: best-decile driver in median non-supercar vs median driver in median supercar
def h2h(trials=20000):
    wins = 0
    for _ in range(trials):
        a = (clamp(random.gauss(0.80, 0.05)), clamp(random.gauss(OTH_MEAN, 0.05)), 70, False)
        b = (clamp(random.gauss(0.38, 0.05)), clamp(random.gauss(SC_MEAN, 0.05)), 50, True)
        wins += run(a) < run(b)
    return wins / trials
print(f"elite driver in mid car beats average driver in supercar: {h2h():.0%}")
