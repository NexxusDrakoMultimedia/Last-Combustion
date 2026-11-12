# Course Map Implementation Plan

**Goal:** A still map of a course in the Calendar panel, with the overtaking spots and the incidents of a played round placed on it.

**Architecture:** `src/sim/courses/map.ts` loads the saved outlines and finds a distance along the lap on one (`pointAtKm`). `src/db/coursemap.ts` reads a round's course, sectors and incident events (`event_log.km`). `CourseMap` draws the SVG and `CourseMapSection` in the Calendar panel picks the round. No schema change.

**Tech Stack:** TypeScript, SQL.js, Vitest, fast-check, React 19, Zustand.

**Spec:** [docs/M7_PLAN.md](../../M7_PLAN.md) ("Slice 1 in detail", piece 4) and "Course outlines" in [docs/GAME_DESIGN_DOCUMENT.md](../../GAME_DESIGN_DOCUMENT.md).

## Global Constraints

- Branch `m7/ghost-record`, one PR into `feature/0.3.x`. Conventional Commits, signed off.
- No schema change and nothing random. Text in `locales/en.json` through `t()`; no literal text in components.
- New files start with the SPDX headers. No em dashes. Telemetry is not needed (nothing is changed or decided).
- Values: at most 60 marks a map, in lap order; only these incident kinds are marked: crash, spin, mistake, wildlife, mechanical_failure, contact. A stopped field (`drone_stop`), an overtake or a blocked course is not a place on the road.

## Rulings

- **A still map, not a live one.** The race is simulated in one batch, so a moving map or a drone marker has nothing to follow until slice 3 steps the engines. The map shows a round that has been run.
- **In the Calendar panel.** The Registry has no round page and a played round is a one-line notice, so the Calendar panel (which already lists the rounds) is the natural home until slice 3's race screen.
- **Drone events are not built here.** Making wildlife a drone warning with a late-warning roll, or giving a blocked course a restart delay, changes prelim times and so saved results for the same seed, and the design gives no size for the penalty of ignoring a signal.

## Review Focus

- A point outside the lap (negative, past the end) and points at the same distance do not break the map.
- A round that has not been run shows the road and the overtaking spots and no marks, and a round that does not exist shows nothing.
- More than 60 events show 60 spread evenly over the lap, with the first and the last kept (not the 60 lowest km), and events that are not incidents are never marked.
- The kinds are told apart by text too: a key under the map names each kind with its count.
- Every kind of incident that can be marked has text and a name for people who cannot see the colour.

## Tasks

1. Pure outline loader and `pointAtKm` with tests.
2. `courseMap`, `mapRounds` and `defaultMapRound` with tests.
3. `CourseMap`, `CourseMapSection`, the store slice, the Calendar panel and the text, with UI tests.
4. Documents, changelog, review, full suite, pull request.
