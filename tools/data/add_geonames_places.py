#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: Nexxus Drako Multimedia
"""Adds towns and cities from the GeoNames cities dataset to data/places.json.

GeoNames data is licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), credited in
CREDITS.md. Download `cities5000.zip` and `AU.zip` (unzip them) and `admin1CodesASCII.txt` from
https://download.geonames.org/export/dump/ into a folder of their own, then run

    python3 -I tools/data/add_geonames_places.py <folder>

It never removes or renames a place that is already listed (other data refers to them by id), tops each
country up to a total, and adds every Australian town (so it can be run again safely), and it
skips a name that is also a word the name generators use for garages, so a garage called after a
word does not suddenly belong to a town. Run it again and nothing changes.
"""
import json, re, sys, unicodedata
from pathlib import Path

AU_STATES = {"01": "ACT", "02": "NSW", "03": "NT", "04": "Qld", "05": "SA", "06": "Tas", "07": "Vic", "08": "WA"}
# Every Australian town or locality of 100 people or more is added (not the GeoNames "sections" of a
# populated place, which are suburbs), except anything within this many km of a capital city's centre:
# the metropolitan area is a city, and its suburbs are not towns.
AU_MIN_POPULATION = 100
AU_FEATURES = {"PPL", "PPLA", "PPLA2", "PPLC", "PPLL", "PPLF", "PPLS", "STLMT"}
CAPITALS = {
    "Sydney": (-33.87, 151.21, 55), "Melbourne": (-37.81, 144.96, 50), "Brisbane": (-27.47, 153.03, 45),
    "Perth": (-31.95, 115.86, 40), "Adelaide": (-34.93, 138.60, 30), "Hobart": (-42.88, 147.33, 18),
    "Darwin": (-12.46, 130.84, 12), "Canberra": (-35.28, 149.13, 14),
}
# How many places every other country that is already listed should have in all (from cities of 5000 or more).
OTHER_QUOTA = 22
# Towns the calendar's courses run through, too small for the dataset: (name, region, lat, lon).
COURSE_TOWNS = [
    ("Margate", "Tas", -43.02, 147.26), ("Kettering", "Tas", -43.15, 147.24),
    ("Cygnet", "Tas", -43.16, 147.08), ("Huonville", "Tas", -43.03, 147.05),
    ("Yungaburra", "Qld", -17.27, 145.58), ("Malanda", "Qld", -17.35, 145.59),
    ("Atherton", "Qld", -17.27, 145.48),
]

def slug(text):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")

def km_from(lat, lon, lat0, lon0):
    import math
    dy = (lat - lat0) * 110.54
    dx = (lon - lon0) * 111.32 * math.cos(math.radians(lat0))
    return math.hypot(dx, dy)

def in_capital(lat, lon):
    return any(km_from(lat, lon, la, lo) < r for la, lo, r in CAPITALS.values())

def main(folder):
    folder = Path(folder)
    root = Path(__file__).resolve().parents[2]
    places = json.loads((root / "data/places.json").read_text(encoding="utf-8"))
    have_ids = {p["id"] for p in places}
    have_names = {(p["country"], p["name"].lower()) for p in places}
    countries = {p["country"] for p in places}
    garages = json.loads((root / "data/names/garages.json").read_text(encoding="utf-8"))
    words = set()
    def walk(node):
        if isinstance(node, str):
            words.add(node.lower())
        elif isinstance(node, list):
            for x in node: walk(x)
        elif isinstance(node, dict):
            for x in node.values(): walk(x)
    for theme in garages["themes"].values():
        walk(theme.get("words", {}))
    admin = {}
    for line in (folder / "admin1CodesASCII.txt").read_text(encoding="utf-8").splitlines():
        code, name, *_ = line.split("\t")
        admin[code] = name
    def read(name):
        out = []
        for line in (folder / name).read_text(encoding="utf-8").splitlines():
            c = line.split("	")
            if c[6] == "P":
                out.append({"name": c[1], "lat": float(c[4]), "lon": float(c[5]), "feature": c[7],
                            "country": c[8], "admin1": c[10], "population": int(c[14] or 0)})
        return out
    rows = [r for r in read("cities5000.txt") if r["country"] != "AU"]
    rows += [r for r in read("AU.txt") if r["feature"] in AU_FEATURES and r["population"] >= AU_MIN_POPULATION]
    rows.sort(key=lambda r: -r["population"])
    added = []
    # Places already listed count towards each total, so running the script again adds nothing.
    taken = {}
    for p in places:
        key = p["region"] if p["country"] == "AU" else p["country"]
        taken[key] = taken.get(key, 0) + 1
    def add(name, region, country, lat, lon):
        pid = f"{country.lower()}-{slug(name)}"
        if not slug(name) or pid in have_ids or (country, name.lower()) in have_names:
            return False
        if name.lower() in words or re.search(r"Business District|^City of |Municipality|Shire|Region", name):
            return False
        have_ids.add(pid); have_names.add((country, name.lower()))
        added.append({"id": pid, "name": name, "region": region, "country": country,
                      "lat": round(lat, 2), "lon": round(lon, 2)})
        return True
    for name, region, lat, lon in COURSE_TOWNS:
        if add(name, region, "AU", lat, lon):
            taken[region] = taken.get(region, 0) + 1
    for r in rows:
        if r["country"] == "AU":
            region = AU_STATES.get(r["admin1"])
            if not region or in_capital(r["lat"], r["lon"]):
                continue
            add(r["name"], region, "AU", r["lat"], r["lon"])
        elif r["country"] in countries:
            region = admin.get(f"{r['country']}.{r['admin1']}") or r["name"]
            key = r["country"]
            if taken.get(key, 0) >= OTHER_QUOTA:
                continue
            if add(r["name"], region, r["country"], r["lat"], r["lon"]):
                taken[key] = taken.get(key, 0) + 1
    out = places + added
    (root / "data/places.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"added {len(added)} places, {len(out)} in all")

if __name__ == "__main__":
    main(sys.argv[1])
