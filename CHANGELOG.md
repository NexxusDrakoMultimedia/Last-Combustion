# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Milestone M4, sixth part (sponsors): twelve fictional sponsors in four tiers, negotiating a title-sponsor deal (the sponsor pays no more than its walk-away fee, counters lower or walks away), and sponsors paying a sixth of the season fee each round (schema version 11).
- Junior Series eligibility rules: drivers must be 25 or younger on 1 March, must never have reached a main-series final, and cannot move back to Junior once promoted, and a Super Series driver can drop down only if they never scored a point (`juniorEligibility`).
- A driver's preferred number is recorded (their own number stays part of their legacy and their number fame when a ranked number has to be taken); schema version 10.
- Race numbers 1 to 40 are now mandatory for last season's top 40 (they cannot be turned down), with `rankingNumbers` filling the numbers of drivers who are not racing from the next best-ranked drivers.
- Milestone M4, fifth part (negotiation): the negotiation rules (hidden walk-away values, patience, counters, relationships) and driver contracts: open a negotiation, make offers, get counters or a walk-out, sign the driver and pay the release fee (schema version 9).
- The two series administrators are now Declan Marsh (technical) and Odette Brandt (interpersonal), unrelated to Pyra, and the driving analyst and lead commentator are now Reece Calloway and Alistair Thorne (all four names are placeholders).
- Milestone M4, fourth part (auction house): weekly and festival auctions of used cars with reserves, proxy bidding, a 2% minimum raise, a 10% buyer premium and a 5% seller fee, consigning your own cars, and computer garages that bid at 0.8 to 1.2 times a car's value (schema version 8).
- The four commentators are recorded as trademarks and intellectual property of Nexxus Drako Multimedia (`TRADEMARKS.md`), with their inspirations noted in the design (first names only).
- Milestone M4, third part (upgrades and legality): 30 aftermarket parts in ten categories and three grades from six suppliers, buying and fitting them (one per category, priced by tier), their effect on power, weight, grip, handling and traction in the prelims and finals, the Equalizer kept true when weight changes, a road-legality budget, and scrutineering that disqualifies illegal cars from the prelims (schema version 7).
- Milestone M4, second part (used market): selling a car to a dealer (80% of its value, listed at 110%), buying used cars from a market of 12 ordinary used cars, and a hidden market garage that owns cars while they are for sale (schema version 6).
- The Google tag on the web build hosted on GitHub Pages, loaded only after the visitor accepts a cookie prompt (other builds carry none).
- Milestone M4, first part (economy core): buying new cars from dealers (one-off cars are never for sale), car value from age, wear and provenance, round running costs (entry fees, tyres, servicing, travel) charged to every garage after each round, a garage finance summary, and a `car_ownership` history (schema version 5).
- GitHub Pages deploys the web build automatically on every merge to `main`, to `lc.nexxusdrako.au` (built for the root path).
- Milestone M3 final race: the sector-by-sector final engine with traffic and overtaking, contact, drone stops, player calls and team orders, tyre life, mechanical trouble and mid-race rain, plus a database layer that plays the final, pays prize and overtake money and records timing (schema version 4). A temporary "run the final" button in the foundations check screen.
- Prelim weather: after 14 blocked days the weather is capped at overcast, and sun is guaranteed after 28.
- Design: themable interface with Light, Dark and NDM (Nexxus Drako Multimedia brand) themes.
- Design: the United Kingdom can shrink over a career (Northern Ireland joining Ireland, Scotland leaving, never Wales before them), with the long name changing to match.
- Design: the Basque Country, Catalonia, Galicia and the Canary Islands can each become independent from Spain at a random future point.
- Design and data: a very rare easter egg (1 in 31,031,996 per career) renames Australia the Commonwealth of Vyktory in 2032, with its own flag, a fourth-wall-breaking commentary line blaming divine intervention, a bit flip or similar, and a secret achievement.
- Design: hidden heritage (dual nationality) for people from regions that can change flag, so their stats count for both their current and future nations.
- Every flag has a short name and a long name (for example Australia and Commonwealth of Australia).
- Flags are limited to nations and territories recognised by the FIA, IOC or FIFA. Excluded flags (Antarctica, Arab League, ASEAN, CEFTA, East African Community, United Nations) in `data/flags.json`, with a test that no world uses them.
- Design: the two series administrators and the four commentators age normally, and a child or an unrelated person in a similar role takes over on retirement or death.
- Design: personalities and RPG-style traits for drivers (full), cars and garages (light), added to the Game Design Document.
- `AGENTS.md` for AI coding agents (and `CLAUDE.md` pointing to it).
- Milestone M2 prelim simulation: course sectors built from the saved outlines, car ratings and the lap-time model, weather and extra practice days, the 7-day running order, practice and prelim incidents (mistakes, spins, crashes, wildlife, blocked course), classification, points and pole, racing kilometres and wear, and a database layer that plays a round (schema version 3).
- Driver gear: helmets, suits, gloves, boots and trinkets that boost attributes, with tiers, set bonuses and a cap, starting gear for AI drivers, and database tables.
- The commentary team: Reece Calloway, Alistair Thorne, Kazumi Aikawa and José Antonio Carrera.
- Milestone M1 world generation: the 2031 field (96 garages, 313 drivers, 313 entries and cars, race numbers, contracts, fans, hometowns and residences, the six-round calendar), deterministic from a master seed and stored in the database (schema version 2).
- Reference data in `/data`: 31 manufacturers and 96 car models, 164 places, name pools for 15 nationalities, courses, flag populations and world-generation balance values.
- Manufacturer lineups that refresh about every five years (`src/sim/lineups.ts`).
- Design: incidents, rivalries and storylines across practice, prelims, races, events and seasons; an auction house and negotiated car purchases with full chassis provenance.
- Design: "arc numbers" and the small group of achievements built on them.
- Every chassis has its own model year, road km, race km and wear; racing km wear a car ten times as much as road km (`src/sim/wear.ts`).
- Milestone M0 foundations: Vite, React, TypeScript, Tailwind and Zustand scaffold; SQL.js database with numbered migrations; `.lcsave` save files with checksums, three slots plus autosave in IndexedDB; seeded named random streams; externalised English text with ICU messages; platform-services interface; foundations check screen.
- Engineering setup: ESLint (including a ban on hard-coded UI text), Prettier, EditorConfig, Husky, commitlint, Vitest, fast-check, Playwright, licence check, REUSE compliance, GitHub Actions (CI, end-to-end, CodeQL, dependency review, docs, release, Pages), Dependabot, issue and pull request templates, `SECURITY.md`, `CODE_OF_CONDUCT.md`, architecture notes and decision records.
- Game Design Document with rules, setting, calendar, points, standings, negotiations, fans, modding and licensing.
- Development specification: milestones, architecture, data model, formulas, a car roster of 60 models mapped to real cars for modding, world generation, screens and engineering standards.
- Fan counts for drivers, cars, garages, flags and the series, and driver hometown and residence (Pyra Drake: Healesville and Brisbane).
- Career succession (owner death or retirement, owner-driver retirement, drivers founding garages) and series management by two administrators.
- Route measuring tool and saved course outlines (`tools/routes/`, `data/courses/outlines.json`).
- Balance prototype script (`tools/balance/prelim_check.py`).
- Trademark and IP policy draft (`TRADEMARKS.md`), `CREDITS.md`, GNU GPL v3 licence (`LICENSE`), README, contributing guide and this changelog.

### Fixed

- Removed compiled Python bytecode that had been committed by mistake.

### Changed

- The Junior Series power cap is 313 kW (about 426 PS) instead of 300 PS.
- Starting fan counts are small to match a brand-new series: the series starts at 200,000 fans, drivers at 10–400 and garages at 5.
- 2031 is the series' first year: nobody starts gold-bordered, race numbers are drawn at random and there is no history. Retired car models only stop being sold new.
- The car roster is now 31 manufacturers and 96 models (hypercar, supercar, sports, JDM, Australian domestic and other), with 2 to 5 models per manufacturer.
- Garage sizes now run from 1 to 8 entries (average about 3.3), fixing a mismatch that did not add up to 313 entries.
- Final consistency pass on the Game Design Document: unified decisions, clearer SQL column names, moved the 2036 points table into the 2036 sections.
- Calendar is six closed loops run clockwise around Australia from South Australia to Healesville: Adelaide Hills, Yallingup/Metricup (WA), Mount Nebo–Mount Glorious, Jamberoo Mountain, Marysville/Black Spur and Healesville–Chum Creek–Toolangi–Dixons Creek. No out-and-back courses; all lap lengths are measured, with longer gaps for cross-country travel.
- Course laps are capped at 80 km and use sealed roads only; no dirt or gravel.
- Mods must carry a GPL-compatible licence.
