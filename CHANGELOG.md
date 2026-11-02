# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Design: personalities and RPG-style traits for drivers (full), cars and garages (light), added to the Game Design Document.
- `AGENTS.md` for AI coding agents (and `CLAUDE.md` pointing to it).
- Milestone M2 prelim simulation: course sectors built from the saved outlines, car ratings and the lap-time model, weather and extra practice days, the 7-day running order, practice and prelim incidents (mistakes, spins, crashes, wildlife, blocked course), classification, points and pole, racing kilometres and wear, and a database layer that plays a round (schema version 3).
- Driver gear: helmets, suits, gloves, boots and trinkets that boost attributes, with tiers, set bonuses and a cap, starting gear for AI drivers, and database tables.
- The commentary team: Jayden Darra, Luke Winters, Kazumi Aikawa and José Antonio Carrera.
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
- Career succession (owner death or retirement, owner-driver retirement, drivers founding garages) and series management by Brian and Joshua Drake.
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
