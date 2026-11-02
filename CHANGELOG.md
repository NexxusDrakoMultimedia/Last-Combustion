# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Milestone M1 world generation: the 2031 field (96 garages, 313 drivers, 313 entries and cars, race numbers, contracts, fans, hometowns and residences, the six-round calendar), deterministic from a master seed and stored in the database (schema version 2).
- Reference data in `/data`: 31 manufacturers and 96 car models, 164 places, name pools for 15 nationalities, courses, flag populations and world-generation balance values.
- Manufacturer lineups that refresh about every five years (`src/sim/lineups.ts`).
- Design: incidents, rivalries and storylines across practice, prelims, races, events and seasons; an auction house and negotiated car purchases with full chassis provenance.
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

- 2031 is the series' first year: nobody starts gold-bordered, race numbers are drawn at random and there is no history. Retired car models only stop being sold new.
- The car roster is now 31 manufacturers and 96 models (hypercar, supercar, sports, JDM, Australian domestic and other), with 2 to 5 models per manufacturer.
- Garage sizes now run from 1 to 8 entries (average about 3.3), fixing a mismatch that did not add up to 313 entries.
- Final consistency pass on the Game Design Document: unified decisions, clearer SQL column names, moved the 2036 points table into the 2036 sections.
- Calendar is six closed loops run clockwise around Australia from South Australia to Healesville: Adelaide Hills, Yallingup/Metricup (WA), Mount Nebo–Mount Glorious, Jamberoo Mountain, Marysville/Black Spur and Healesville–Chum Creek–Toolangi–Dixons Creek. No out-and-back courses; all lap lengths are measured, with longer gaps for cross-country travel.
- Course laps are capped at 80 km and use sealed roads only; no dirt or gravel.
- Mods must carry a GPL-compatible licence.
