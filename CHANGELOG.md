# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Course lap length capped at 80 km. Round 5 now runs Healesville–Narbethong–Toolangi–Chum Creek, and Round 6 is the shorter Lorne–Kennett River run.
- Round 1 is now the Mount Nebo–Mount Glorious Loop, Round 2 turns 39 km from Mount Seaview, Round 3 is an out-and-back run through the Royal National Park (no motorway), Round 5 is a 75.8 km loop and Round 7 is an out-and-back run. All lap lengths are measured.
- Courses use sealed roads only; no dirt or gravel.
- Mods must carry a GPL-compatible licence.

### Added

- Game Design Document with rules, setting, calendar, points, standings, negotiations, modding and licensing.
- Development specification: milestones, architecture, data model, formulas, car roster of 60 models mapped to real cars for modding, world generation, screens and engineering standards.
- Route measuring tool and saved course outlines (`tools/routes/`, `data/courses/outlines.json`).
- Balance prototype script (`tools/balance/prelim_check.py`).
- Trademark and IP policy draft (`TRADEMARKS.md`).
- GNU GPL v3 licence (`LICENSE`), README, contributing guide and this changelog.
