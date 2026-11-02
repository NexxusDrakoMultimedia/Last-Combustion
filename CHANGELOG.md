# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Course lap length capped at 80 km. Round 5 now runs Healesville–Narbethong–Toolangi–Chum Creek, and Round 6 is the shorter Lorne–Kennett River run.
- Calendar redesigned as six closed loops run clockwise around Australia from South Australia to Healesville: Adelaide Hills, Yallingup/Metricup (WA), Mount Nebo–Mount Glorious, Jamberoo Mountain, Marysville/Black Spur and Healesville–Chum Creek–Toolangi–Dixons Creek. No out-and-back courses. All lap lengths are measured.
- Season has six rounds, with longer gaps for cross-country travel.
- Courses use sealed roads only; no dirt or gravel.
- Mods must carry a GPL-compatible licence.

### Added

- Game Design Document with rules, setting, calendar, points, standings, negotiations, modding and licensing.
- Development specification: milestones, architecture, data model, formulas, car roster of 60 models mapped to real cars for modding, world generation, screens and engineering standards.
- Route measuring tool and saved course outlines (`tools/routes/`, `data/courses/outlines.json`).
- Balance prototype script (`tools/balance/prelim_check.py`).
- Trademark and IP policy draft (`TRADEMARKS.md`).
- GNU GPL v3 licence (`LICENSE`), README, contributing guide and this changelog.
