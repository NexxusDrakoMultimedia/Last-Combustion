#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: Nexxus Drako Multimedia
"""Builds data/manufacturers.json and data/car_models.json from the tables in the GDD.

Real-world counterparts are deliberately left out: they belong only in the optional
mod_mapping.json (see the GDD, "Fictional manufacturers and cars").
Each manufacturer must have 2 to 5 models.
Usage: python3 tools/data/build_cars.py
"""
import json, re

GDD = open('docs/GAME_DESIGN_DOCUMENT.md', encoding='utf-8').read()
TIER_MULT = {'Starter': 0.8, 'Mid': 1.0, 'Premium': 1.8, 'Elite': 3.5, 'Hyper': 8.0}
COUNTRY = {'Italy': 'IT', 'UK': 'GB', 'Germany': 'DE', 'France': 'FR', 'Sweden': 'SE',
           'USA': 'US', 'Japan': 'JP', 'Australia': 'AU', 'South Korea': 'KR'}
TYPE = {'Hypercar': 'hypercar', 'Supercar': 'supercar', 'Sports': 'sports', 'JDM': 'jdm',
        'Domestic': 'domestic', 'Other': 'other'}
# Drivetrain layout per model: FR front-engine rear-drive, MR mid-engine, RR rear-engine, AWD, FF.
LAYOUT = {
    'Cavallo Quaranta': 'MR', 'Cavallo Tre-Cinque': 'MR', 'Cavallo Otto': 'MR',
    'Tauro Cuneo': 'MR', 'Tauro Piccolo': 'AWD', 'Tauro Bravo': 'AWD',
    'Vento Z': 'MR', 'Vento H': 'MR', 'Vento Utopia': 'MR',
    'Halberd F1': 'MR', 'Halberd 570': 'MR', 'Halberd 765': 'MR',
    'Ashford Vantage': 'FR', 'Ashford DB': 'FR', 'Ashford Lance': 'MR',
    'Kessler Heck': 'RR', 'Kessler Rennen': 'MR', 'Kessler Boxer': 'MR',
    'Stern GT Black': 'FR', 'Stern SLR': 'FR', 'Stern 63': 'FR',
    'Rhein R8': 'AWD', 'Rhein Sport Quattro': 'AWD', 'Rhein TT RS': 'AWD',
    'Montclair EB': 'AWD', 'Montclair Veyron': 'AWD', 'Montclair Chiron': 'AWD',
    'Vesper CCR': 'MR', 'Vesper Agera': 'MR', 'Vesper Jesko': 'MR',
    'Dunmore GT': 'MR', 'Dunmore GT-X': 'MR', 'Dunmore Stallion V8': 'FR',
    'Marlowe Vettura': 'FR', 'Marlowe Z': 'FR', 'Marlowe Sprint': 'FR', 'Marlowe Cobalt': 'FF',
    'Homura Corsa 1.8': 'FR', 'Homura Spirit R-7': 'FR', 'Homura Eclipse R-8': 'FR',
    'Tsurugi S2': 'AWD', 'Tsurugi 22': 'AWD', 'Tsurugi Rex': 'FR',
    'Raijin 200S': 'FR', 'Raijin GT-Line': 'AWD', 'Raijin R': 'AWD',
    'Mitaka Sprinter': 'FR', 'Mitaka Arrow': 'FR', 'Mitaka Halo': 'FR',
    'Hanabi Type-R EK': 'FF', 'Hanabi Roadster S': 'FR', 'Hanabi Mid-Tech': 'MR',
    'Kestrel Swift 1.6': 'MR', 'Kestrel Merlin': 'MR', 'Kestrel Harrier': 'MR',
    'Corvina 4C': 'MR', 'Corvina 8C': 'FR', 'Corvina Giulia QV': 'FR',
    'Brandt M1': 'MR', 'Brandt M3 GTS': 'FR', 'Brandt 330': 'FR',
    'Cavallo Fondatore': 'MR',
    'Pennine Mk I': 'FF', 'Pennine Cooper S': 'FF', 'Pennine GP': 'FF',
    'Aurelian Uno T': 'FF', 'Aurelian Lupa 1.4T': 'FF', 'Aurelian Spider 124': 'FR',
    'Ardent 5 Turbo': 'MR', 'Ardent Petite RS': 'FF', 'Ardent Trophy': 'FF',
    'Mizuho Evo IX': 'AWD', 'Mizuho Orion': 'FR', 'Mizuho GTO': 'AWD',
    'Suzuri Cappu': 'FR', 'Suzuri Swift Sport': 'FF', 'Suzuri Works': 'FF',
    'Redback Torana': 'FR', 'Redback Sedan SS': 'FR', 'Redback Ute SS': 'FR', 'Redback GTS-R': 'FR',
    'Wattle GT-HO': 'FR', 'Wattle XR6 Turbo': 'FR', 'Wattle XR8 Ute': 'FR', 'Wattle GT-F': 'FR',
    'Bunyip Charger E49': 'FR', 'Bunyip Charger E55': 'FR', 'Bunyip Pacer': 'FR',
    'Banksia Clubman': 'FR', 'Banksia Nagari': 'FR', 'Banksia MS8': 'FR',
    'Haeju Veloce': 'FF', 'Haeju i-Sprint': 'FF', 'Haeju Coupe 3.8': 'FR',
    'Skald Sonett': 'FF', 'Skald 900 Turbo': 'FF', 'Skald Viggen': 'FF',
}

def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

def table_rows(heading, first_cell):
    start = GDD.index(heading)
    rows = []
    for line in GDD[start:].splitlines()[1:]:
        if line.startswith('|') and not line.startswith('| ---') and not line.startswith(first_cell):
            rows.append([c.strip() for c in line.strip('|').split('|')])
        elif rows and not line.startswith('|'):
            break
    return rows

manufacturers = []
for name, home, mtype, character, _real in table_rows('**Manufacturers**', '| Fictional |'):
    manufacturers.append({'id': slug(name), 'name': name, 'homeCountry': COUNTRY[home],
                          'type': TYPE[mtype], 'character': character})
by_name = {m['name']: m for m in manufacturers}

models = []
for name, tier, kg, tyre, ps, _real in table_rows('**Models** (max tyre', '| Fictional model |'):
    maker = by_name[name.split(' ')[0]]
    kerb = int(kg.replace(',', ''))
    max_tyre = int(tyre.replace(' mm', ''))
    assert round(kerb / 5 + 40) == max_tyre, name
    horsepower = int(ps.replace(',', ''))
    models.append({
        'id': slug(name), 'manufacturerId': maker['id'], 'name': name,
        'tier': 'unique' if tier.startswith('(') else tier.lower(),
        'kerbKg': kerb, 'maxTyreMm': max_tyre, 'ps': horsepower, 'layout': LAYOUT[name],
        'generation': 1, 'introducedYear': 2031, 'retiredYear': None, 'predecessorId': None,
        'priceNew': 0 if tier.startswith('(') else round((15000 + 280 * horsepower) * TIER_MULT[tier] / 100) * 100,
    })

assert len(manufacturers) == 31 and len(models) == 96, (len(manufacturers), len(models))
for m in manufacturers:
    assert 2 <= sum(1 for x in models if x['manufacturerId'] == m['id']) <= 5, m['name']
json.dump(manufacturers, open('data/manufacturers.json', 'w'), indent=2, ensure_ascii=False)
json.dump(models, open('data/car_models.json', 'w'), indent=2, ensure_ascii=False)
print(len(manufacturers), 'manufacturers,', len(models), 'models')
