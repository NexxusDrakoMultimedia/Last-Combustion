# Ghost Record Implementation Plan

**Goal:** A ghost for each of the player's entries, picked before a round's prelims and settled after them.

**Architecture:** A pure `src/sim/ghost.ts` holds the rules (which drivers are on offer, how a run settles against a ghost, the Easy ghost's time). `src/db/ghost.ts` reads last season's results for the options, stores a pick in the new `ghost_choice` table (migration 0058), and settles the picks inside `playPrelims` once the results are written. The Entries panel has a Ghost section.

**Tech Stack:** TypeScript, SQL.js, Vitest, fast-check, React 19, Zustand.

**Spec:** [docs/M7_PLAN.md](../../M7_PLAN.md) ("Slice 1 in detail", piece 4) and "Ghost Record" in [docs/GAME_DESIGN_DOCUMENT.md](../../GAME_DESIGN_DOCUMENT.md).

## Global Constraints

- Branch `m7/ghost-choice`, one PR into `feature/0.3.x`. Conventional Commits, signed off.
- Determinism: nothing random. A save from 0.3.x must still load and play prelims, with no ghost until a pick is made.
- Numbers (`candidates` 5, `easyLeadMs` 2000) in `data/balance.json` under `ghost`; text in `locales/en.json` through `t()`.
- A new numbered migration (0058); never edit a released one.
- New files start with the SPDX headers. No em dashes. No real names. Telemetry carries counts only (`Ghost:Picked`).

## Rulings

- **No ghost in the first season.** The design's six ghosts are five drivers from last year and Pyra Drake's #313 demo run, which is founder content that is not in the game yet, so season 1 has nothing honest to offer. Both modes are refused then.
- **A pick, not a live car.** The prelims run in one batch, so the ghost is chosen before a round and settled after it. The live ghost, and the Easy ghost's hints and assistance (unquantified in the design), wait for slice 3.
- **Easy is never beaten.** It runs 2 seconds ahead of the entry, so there is no contest; the result only says the entry ran against it. Hard is a real comparison with last season's time on the same course.
- **Nothing else changes.** The design gives a ghost no effect on pace, fans, reputation or rivalries, so it has none.
- **The picks are for the next round whose prelims have not been run**, and a new pick replaces the old one.

## Review Focus

- A Hard ghost that is not on offer, an entry that is not the player's, and a season with no ghosts are refused and change nothing.
- A run with no time (a crash) never beats a ghost, and an equal time does not beat it.
- Settling twice changes nothing, and a pick that is replaced after being settled starts again.
- A driver who set no time on the course last season is not on offer, and fewer than five options is fine.
- A 0.3.x save plays prelims with no picks and no error.

## Tasks

1. Pure ghost rules and the `ghost` balance block, with tests.
2. Migration 0058 and the version pins.
3. `ghostOptions`, `setGhost`, `settleGhosts`, `ghostView`, and the hook in `playPrelims`, with tests.
4. Store slice, the Ghost section in the Entries panel, text and UI tests.
5. Documents, changelog, review, full suite, pull request.
