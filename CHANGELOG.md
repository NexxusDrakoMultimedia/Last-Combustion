# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Game Design Document with rules, setting, calendar, points, standings, negotiations, fans, modding and licensing.
- Development specification: milestones, architecture, data model, formulas, a car roster of 60 models mapped to real cars for modding, world generation, screens and engineering standards.
- Fan counts for drivers, cars, garages, flags and the series, and driver hometown and residence (Pyra Drake: Healesville and Brisbane).
- Career succession (owner death or retirement, owner-driver retirement, drivers founding garages) and series management by Brian and Joshua Drake.
- Route measuring tool and saved course outlines (`tools/routes/`, `data/courses/outlines.json`).
- Balance prototype script (`tools/balance/prelim_check.py`).
- Trademark and IP policy draft (`TRADEMARKS.md`), `CREDITS.md`, GNU GPL v3 licence (`LICENSE`), README, contributing guide and this changelog.

### Changed

- Calendar is six closed loops run clockwise around Australia from South Australia to Healesville: Adelaide Hills, Yallingup/Metricup (WA), Mount Nebo–Mount Glorious, Jamberoo Mountain, Marysville/Black Spur and Healesville–Chum Creek–Toolangi–Dixons Creek. No out-and-back courses; all lap lengths are measured, with longer gaps for cross-country travel.
- Course laps are capped at 80 km and use sealed roads only; no dirt or gravel.
- Mods must carry a GPL-compatible licence.
