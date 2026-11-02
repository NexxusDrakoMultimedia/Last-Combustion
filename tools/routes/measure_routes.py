#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: Nexxus Drako Multimedia
"""Measure proposed course routes with OpenStreetMap data.

Routes each course through its waypoints with the public OSRM server, prints the
lap length, the lap count for a 300 km final, and the roads used, then asks the
Overpass API whether any unpaved road lies on the route.

It also saves each route's outline to data/courses/outlines.json (a simplified,
projected path with cumulative distance) for the track map and timing view. The
outline is a map-style "produced work" and credits OpenStreetMap contributors
(ODbL 1.0); raw OSM geometry is not stored in the repository.

Usage: python3 -u tools/routes/measure_routes.py [--no-unpaved] [round ...]
Needs network access to router.project-osrm.org and overpass-api.de.
Be polite to the public servers: this script waits between requests.
"""
import json, math, re, sys, time, urllib.parse, urllib.request

UA = "last-combustion-design/1.0 (Nexxus Drako Multimedia)"
OSRM = "https://router.project-osrm.org/route/v1/driving/"
OVERPASS = "https://overpass-api.de/api/interpreter"

def get(url, data=None, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            return json.load(urllib.request.urlopen(req, timeout=90))
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(5 * 2 ** i)

def route(points):
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    d = get(f"{OSRM}{coords}?overview=full&geometries=geojson&steps=true")
    r = d["routes"][0]
    roads = []
    for leg in r["legs"]:
        for st in leg["steps"]:
            n = st.get("name") or st.get("ref") or "(unnamed)"
            if roads and roads[-1][0] == n:
                roads[-1][1] += st["distance"]
            else:
                roads.append([n, st["distance"]])
    return r["distance"] / 1000, r["geometry"]["coordinates"], roads

def quality(geom, roads):
    """Return (overlap_pct, motorway_km): share of the route driven twice, and motorway length."""
    seen, twice, total = set(), 0, 0
    for lo, la in geom[::3]:
        cell = (round(la / 0.0004), round(lo / 0.0004))
        total += 1
        if cell in seen:
            twice += 1
        seen.add(cell)
    mw = sum(d for n, d in roads if any(w in n for w in ("Freeway", "Motorway", "Expressway")) or re.match(r"^M\d", n)) / 1000
    return 100 * twice / max(total, 1), mw

def unpaved_near(geom, dist_m=20):
    lons = [c[0] for c in geom]; lats = [c[1] for c in geom]
    bbox = f"{min(lats)-0.002},{min(lons)-0.002},{max(lats)+0.002},{max(lons)+0.002}"
    q = ('[out:json][timeout:60];way["highway"]["surface"~"^(unpaved|gravel|dirt|ground|earth|compacted|fine_gravel|sand|grass|mud)$"]'
         f'({bbox});out geom;')
    d = get(OVERPASS, data=urllib.parse.urlencode({"data": q}).encode())
    def near(lat, lon):
        for lo, la in geom:
            dx = (lon - lo) * 111320 * math.cos(math.radians(la))
            dy = (lat - la) * 110540
            if dx * dx + dy * dy < dist_m ** 2:
                return True
        return False
    hits = {}
    for w in d.get("elements", []):
        pts = w.get("geometry", [])
        if any(near(p["lat"], p["lon"]) for p in pts[::2]):
            hits[w["tags"].get("name", f"way {w['id']}")] = w["tags"].get("surface")
    return hits

def outline(geom, tol_m=8, max_points=300):
    """Project to a flat plane (metres), simplify, attach cumulative km, scale to 0-1000."""
    lat0 = sum(c[1] for c in geom) / len(geom)
    k = math.cos(math.radians(lat0))
    pts = [((lo) * 111320 * k, la * 110540) for lo, la in geom]
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.dist(a, b))
    def dp(lo, hi, tol, keep):
        if hi <= lo + 1:
            return
        (x1, y1), (x2, y2) = pts[lo], pts[hi]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy) or 1e-9
        idx, dmax = lo, 0.0
        for i in range(lo + 1, hi):
            d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / n
            if d > dmax:
                idx, dmax = i, d
        if dmax > tol:
            keep.add(idx)
            dp(lo, idx, tol, keep)
            dp(idx, hi, tol, keep)
    tol = tol_m
    while True:
        far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
        keep = {0, far, len(pts) - 1}
        dp(0, far, tol, keep)
        dp(far, len(pts) - 1, tol, keep)
        if len(keep) <= max_points:
            break
        tol *= 1.3
    idx = sorted(keep)
    xs = [pts[i][0] for i in idx]; ys = [pts[i][1] for i in idx]
    x0, y0 = min(xs), min(ys)
    scale = 1000 / max(max(xs) - x0, max(ys) - y0)
    out = [[round((pts[i][0] - x0) * scale, 1), round((max(ys) - pts[i][1]) * scale, 1), round(cum[i] / 1000, 3)] for i in idx]
    w = max(p[0] for p in out); h = max(p[1] for p in out)
    path = "M" + " L".join(f"{x} {y}" for x, y, _ in out)
    return {"viewBox": [0, 0, round(w, 1), round(h, 1)], "path": path, "points": out}

if __name__ == "__main__":
    spec = json.load(open("tools/routes/routes.json"))
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check_unpaved = "--no-unpaved" not in sys.argv
    want = set(args)
    outlines = {}
    try:
        outlines = json.load(open("data/courses/outlines.json"))
    except Exception:
        pass
    for r in spec:
        if want and str(r["round"]) not in want:
            continue
        km, geom, roads = route([tuple(p) for p in r["waypoints"]])
        lap = km * 2 if r["shape"] == "out_and_back" else km
        laps = math.ceil(300 / lap)
        print(f"Rd {r['round']} {r['name']} [{r['shape']}]: one pass {km:.1f} km, lap {lap:.1f} km, final {laps} laps = {laps*lap:.0f} km")
        for n, m in roads:
            if m >= 1500:
                print(f"    {n}: {m/1000:.1f} km")
        ov, mw = quality(geom, roads)
        print(f"    overlap {ov:.0f}% of the route is driven twice; motorway {mw:.1f} km")
        o = outline(geom)
        o.update({"round": r["round"], "name": r["name"], "shape": r["shape"],
                  "pass_km": round(km, 2), "lap_km": round(lap, 2), "final_laps": laps,
                  "attribution": "Route geometry (c) OpenStreetMap contributors, ODbL 1.0"})
        outlines[str(r["round"])] = o
        import os
        os.makedirs("data/courses", exist_ok=True)
        json.dump(outlines, open("data/courses/outlines.json", "w"), indent=1)
        if not check_unpaved:
            continue
        time.sleep(2)
        try:
            bad = unpaved_near(geom)
            print("    unpaved on route:", bad if bad else "none found")
        except Exception as e:
            print("    unpaved check failed:", e)
        time.sleep(3)
