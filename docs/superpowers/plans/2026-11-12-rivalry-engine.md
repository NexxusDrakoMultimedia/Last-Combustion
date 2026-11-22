# Rivalry Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Driver rivalries that grow from close finishes and title fights, cool each round, lift fan gains, and show on a rivalry board for the player's drivers.

**Architecture:** A pure `src/sim/rivalry.ts` holds the rules (heat, decay, levels, cap). `src/db/rivalries.ts` reads a finished final's results, runs the round update inside the final's transaction beside `writeHeadline`, and exposes a board query. Numbers live in `data/rivalries.json`; the schema change is migration 0054.

**Tech Stack:** TypeScript, SQL.js, Vitest, fast-check, React 19, Zustand.

**Spec:** [docs/M7_PLAN.md](../../M7_PLAN.md) ("Slice 1 in detail", piece 1) and "Rivalries" in [docs/GAME_DESIGN_DOCUMENT.md](../../GAME_DESIGN_DOCUMENT.md).

## Global Constraints

- Branch `feature/0.3.x`; one PR into it. Conventional Commits, signed off (`git commit -s`).
- Determinism: nothing in `src/sim` uses `Math.random()` or the clock. Piece 1 needs no randomness at all.
- Numbers in `data/rivalries.json`, listed in `docs/DATA_FILES.md`; text in `locales/en.json` read with `t()`; no literal text in UI components.
- A new numbered migration (0054); never edit a released migration. A save from 0.2.x must still load and play a final, with no rivalries until finals are played.
- New files start with `SPDX-License-Identifier: GPL-3.0-or-later` and `SPDX-FileCopyrightText: Nexxus Drako Multimedia`.
- No em dashes in docs, text or data (`pnpm docs:style`). No real names. Telemetry carries counts only, through `track()`.
- Values: heat gains close finish +8 (finishing within 3 s of each other) and title fight +10 per round; decay 10% each round; levels Spark 30, Rivalry 60, Feud 90, Legendary (Feud heat plus five seasons of history); a rivalry ends below heat 10, when a party retires; at most 3 live rivalries per driver; fan multipliers x1.1 Spark, x1.25 Rivalry, x1.5 Feud.
- Plan's own calls: heat ceiling 100; Legendary uses the Feud multiplier (x1.5); a pair reaches "live" at heat 30; when a driver is at the cap, a new pair only goes live by displacing that driver's coolest live rivalry if its heat is higher (end reason `displaced`); teammates can rival each other.

## Review Focus

- A driver with no `final_time_ms` (retired in the final) never counts as a close finish.
- Running the round update twice for the same round changes nothing the second time.
- A retired driver's live rivalries end that round with reason `retired`.
- The first round of a season, when no title standings exist yet, applies no title-fight gain and does not crash.
- A 0.2.x save (migrated, empty rivalry tables) plays a final without error.

---

### Task 1: Rivalry data and the pure rules

**Files:**

- Create: `data/rivalries.json`, `src/sim/rivalry.ts`, `tests/sim/rivalry.test.ts`
- Modify: `src/sim/worldgen/data.ts` (export `rivalryBalance` beside the other balance imports), `docs/DATA_FILES.md` (a row for the file)

**Interfaces:**

- Consumes: nothing.
- Produces (all exported from `src/sim/rivalry.ts`):
  - `type RivalryLevel = 'none' | 'spark' | 'rivalry' | 'feud' | 'legendary'`
  - `interface Pair { a: number; b: number }` with `a < b` (driver ids)
  - `levelFor(heat: number, seasonsOfHistory: number): RivalryLevel`
  - `decayHeat(heat: number): number`
  - `fanMultiplier(level: RivalryLevel): number`
  - `closeFinishPairs(finishers: { driverId: number; timeMs: number | null }[]): Pair[]` (input in finishing order)
  - `titleFightPair(top: [number, number] | null, finalists: number[]): Pair | null`
  - `settleCap(liveHeats: number[], candidateHeat: number, cap: number): 'add' | 'displace' | 'refuse'`

- [ ] **Step 1: Write the failing tests** in `tests/sim/rivalry.test.ts`: `levelFor(29, 0)` is `none`, `(30, 0)` is `spark`, `(60, 0)` `rivalry`, `(90, 4)` `feud`, `(90, 5)` `legendary`; `decayHeat(50)` is 45; `fanMultiplier('feud')` is 1.5 and `'none'` is 1; `closeFinishPairs` returns the pair for adjacent finishers 400 ms apart, none for 600 ms apart, none when either `timeMs` is null, and each pair has `a < b`; `titleFightPair([7, 3], [3, 7, 9])` is `{ a: 3, b: 7 }` and `titleFightPair([7, 3], [3, 9])` is null, and `null` top is null; `settleCap([40, 50, 60], 55, 3)` is `displace`, `settleCap([40, 50, 60], 35, 3)` is `refuse`, `settleCap([40, 50], 35, 3)` is `add`. Add fast-check properties: `decayHeat(h)` is within `[0, h]` for `h` in `[0, 100]`; `levelFor` never gets lower as heat rises (same history).
- [ ] **Step 2: Run** `pnpm test tests/sim/rivalry.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Create `data/rivalries.json`** with the Global Constraints values (`gains.closeFinishMs: 500`, `gains.closeFinish: 8`, `gains.titleFight: 10`, `decay: 0.1`, `ceiling: 100`, `levels` thresholds, `endBelow: 10`, `legendarySeasons: 5`, `cap: 3`, `fanMultipliers`), with a `source` note in the style of `data/press.json`. Implement the signatures above in `src/sim/rivalry.ts`, reading numbers only from `rivalryBalance`.
- [ ] **Step 4: Run** `pnpm test tests/sim/rivalry.test.ts` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: rivalry rules and data`.

### Task 2: Migration 0054

**Files:**

- Create: `src/db/migrations/0054_rivalries.ts`
- Modify: `src/db/migrations/index.ts` (import and append `migration0054`), `tests/db/migrate.test.ts` (latest version expectations, if it pins one)

**Interfaces:**

- Consumes: the `Migration` type from `src/db/migrate.ts`.
- Produces: tables `rivalry (id, driver_a, driver_b, heat REAL, peak REAL, level TEXT, live INTEGER, started_year, started_round_id, ended_year, end_reason)` and `rivalry_meeting (id, rivalry_id, round_id, kind, gain REAL)`. `driver_a < driver_b` is a `CHECK`; `level` is checked against the five levels; `end_reason` is NULL or one of `cooled`, `retired`, `reconciled`, `displaced`; `kind` is `close_finish` or `title_fight`; a unique partial index allows one open row (`ended_year IS NULL`) per pair; `rivalry_meeting` is unique on `(rivalry_id, round_id, kind)`.

- [ ] **Step 1: Write the failing test** in `tests/db/rivalries.test.ts` (new file, shared with Task 3): a fresh `createNewDatabase` has both tables; inserting `driver_a = 5, driver_b = 3` throws; inserting a second open row for the same pair throws.
- [ ] **Step 2: Run** `pnpm test tests/db/rivalries.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration** following `0053_company_breaks.ts` (version 54, name `rivalries`), and register it.
- [ ] **Step 4: Run** `pnpm test tests/db`. Expected: PASS, including the existing migration tests.
- [ ] **Step 5: Commit** `feat: rivalry tables (migration 0054)`.

### Task 3: The round update

**Files:**

- Create: `src/db/rivalries.ts`
- Modify: `src/db/final.ts` (call it after `writeHeadline(db, roundId)`, inside the transaction), `tests/db/rivalries.test.ts`

**Interfaces:**

- Consumes: Task 1 functions; `all` from `./entries`; tables `result`, `entry`, `round`, `season`, `driver`.
- Produces: `updateRivalries(db: Database, roundId: number): void`.

- [ ] **Step 1: Write the failing tests** using the `fans.test.ts` setup (`createCareer`, `persistWorld(generateWorld(seed))`, `playPrelims`, `playFinal`): after one played final, `rivalry_meeting` has a row for every adjacent finisher pair within 500 ms and none for others; calling `updateRivalries(db, roundId)` a second time leaves both tables unchanged; a driver set `retired_year` before the update has no open rivalry afterwards and any he had ended with reason `retired`; the invariant that no driver is in more than 3 rows with `live = 1 AND ended_year IS NULL` holds after playing three rounds; two databases built from the same seed hold identical rivalry rows (determinism).
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement `updateRivalries`.** In one pass per round: decay every open rivalry (and building pair) by `decayHeat`; add gains from `closeFinishPairs` over the round's classified finishers (ordered by `final_pos`, `timeMs = final_time_ms`) and from `titleFightPair` (the two drivers with the most `result.points` summed over the round's season up to this round, only when both are in this final and the season has had at least one earlier scored round); record each as a `rivalry_meeting` (the unique index makes a repeat a no-op, so skip a gain whose meeting row already exists); clamp heat to the ceiling; set `peak`; set `level` with `levelFor(heat, years since started_year)`; go live at 30 using `settleCap` against the driver's other live rivalries; end rivalries with `cooled` below 10 and `retired` when either driver has `retired_year` set. Pairs are stored `a < b`.
- [ ] **Step 4: Hook it in** `src/db/final.ts` and run `pnpm test tests/db tests/sim`. Expected: PASS (existing final tests unchanged).
- [ ] **Step 5: Commit** `feat: rivalries update after each final`.

### Task 4: Fan multipliers

**Files:**

- Modify: `src/db/fans.ts` (`awardRoundFans`), `tests/db/fans.test.ts`

**Interfaces:**

- Consumes: `fanMultiplier` (Task 1), the `rivalry` table (live rows as they stand before this round's update).
- Produces: `driverRivalryMultiplier(db: Database, driverId: number, finalists: Set<number>): number` exported from `src/db/rivalries.ts`; the highest multiplier among the driver's live rivalries whose other driver is in this final, 1 if none.

- [ ] **Step 1: Write the failing test** in `tests/db/rivalries.test.ts`: with a live `rivalry`-level row inserted between two finalists, `driverRivalryMultiplier` is 1.25 for each; with the rival absent from the finalists it is 1; with two live rivalries (`spark` and `feud`) it is 1.5.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** the function and apply it to each driver's fan gain in `awardRoundFans` (driver gain only, rounded after the multiply; `awardRoundFans` runs before `updateRivalries`, so it reads last round's levels).
- [ ] **Step 4: Run** `pnpm test tests/db/fans.test.ts tests/db/rivalries.test.ts`. Expected: PASS; the existing fans test uses a fresh world with no rivalries, so its numbers do not move.
- [ ] **Step 5: Commit** `feat: rivals draw extra fans`.

### Task 5: The rivalry board

**Files:**

- Create: `src/db/rivalryboard.ts` (read model query) and a board component beside the Drivers panel in `src/ui/shell` (find it with `grep -rn "drivers" src/ui/shell`)
- Modify: `locales/en.json` (a `rivalry` group), the career store in `src/state/career.store.ts` (load the board with the other read-models), `tests/db/rivalries.test.ts`, a UI test beside the existing panel tests in `tests/ui`

**Interfaces:**

- Consumes: the `rivalry` and `rivalry_meeting` tables, the store's player garage.
- Produces: `rivalryBoard(db: Database): RivalryBoardRow[]` with `{ driverId, rivalId, rivalName, level: RivalryLevel, heat: number, startedYear: number, meetings: { round: number; year: number; kind: 'close_finish' | 'title_fight' }[] }`, for open live rivalries involving a player driver, highest heat first.

- [ ] **Step 1: Write the failing tests:** `rivalryBoard` returns only rows involving the player's drivers and is sorted by heat; the panel renders a level word, the rival's name and the meeting history for a row, and an empty state when there are none (text read from `locales/en.json` keys, no literals).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the query, the store slot and the component; add the locale keys (level names, empty state, meeting kinds); add a short "Rivalries" paragraph to `docs/HOW_TO_PLAY.md`.
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: rivalry board in the Drivers panel`.

### Task 6: Telemetry, docs and a save check

**Files:**

- Modify: `src/state/career.store.ts` or the place `track()` is called after a final (read `src/platform/telemetry.ts` for the event shape), `docs/GAME_DESIGN_DOCUMENT.md` (Rivalries section: say what is built and what waits), `docs/M7_PLAN.md` (mark piece 1 built), `CHANGELOG.md` (a line under `[Unreleased]`), `tests/db/rivalries.test.ts`

**Interfaces:**

- Consumes: `track()` from `src/platform/telemetry.ts`.
- Produces: one design event per rivalry that goes live (level and count only, no names).

- [ ] **Step 1: Write the failing tests:** a migrated database from the previous schema version (use the helper `tests/db/migrate.test.ts` uses to open at an earlier version) opens, plays a final and ends with rival rows; a telemetry test beside `tests/telemetryGuard.test.ts` shows the event carries no names or free text.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the event and write the docs. In the GDD, state that piece 1 uses close finishes and title fights, and that contact, overtakes, press jabs, moving to a rival garage and taking a rival's race number join when the incident, press-choice and transfer signals exist.
- [ ] **Step 4: Run** the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm docs:lint && pnpm docs:style`. Expected: all PASS.
- [ ] **Step 5: Commit** `docs: rivalries in the design document and changelog`.
