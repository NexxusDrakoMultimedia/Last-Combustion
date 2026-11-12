# Storyline Engine and Event Cards Implementation Plan

**Goal:** Storylines that run across rounds from data templates, starting with _Rivalry feud_, and event cards that give the player a choice on a story beat.

**Architecture:** A pure `src/sim/storyline.ts` holds the template rules (which beat comes next, the cap of highlighted storylines, the effects of a choice). `src/db/storylines.ts` runs once per round inside the final's transaction after `updateRivalries`, starts and advances storylines, writes history rows and creates cards; a card is answered in its own transaction. Choices apply fans, driver reputation and driver relationships. The Drivers panel shows the live storylines and the pending cards.

**Tech Stack:** TypeScript, SQL.js, Vitest, fast-check, React 19, Zustand.

**Spec:** [docs/M7_PLAN.md](../../M7_PLAN.md) ("Slice 1 in detail", piece 2) and "Storylines" in [docs/GAME_DESIGN_DOCUMENT.md](../../GAME_DESIGN_DOCUMENT.md).

## Global Constraints

- Branch `m7/storyline-engine`, one PR into `feature/0.3.x`. Conventional Commits, signed off.
- Determinism: nothing random in this piece; every query is ordered. A save from 0.3.x must still load and play a final, with no storylines until a rivalry reaches Feud.
- Numbers and effects in `data/storylines.json`, listed in `docs/DATA_FILES.md`; text in `locales/en.json` through `t()`.
- A new numbered migration (0056); never edit a released one.
- New files start with the SPDX headers. No em dashes. No real names. Telemetry carries counts only, through `track()`.
- Values: a Feud (or Legendary) rivalry starts the storyline; at most 3 storylines are highlighted (given cards) for the player at a time; an unanswered card expires when the next round is run.

## Rulings

- Cards do not block time. A blocking calendar event would halt Continue and the season rollover until answered and needs a new event kind everywhere the calendar lists them.
- Effects are fans (through a helper extracted from `awardRoundFans`, so the cap, fame and season tallies stay correct), `driver.reputation` (a new setter, clamped 0 to 100) and the driver-to-driver relationship (`adjustRelationship`). Prestige, morale and sponsor interest are left out: each is recomputed from other state and would overwrite a card's change.
- History uses `event_log` rows (scope `event`, type `story`); headlines wait for piece 3, which reworks the press.
- _Rookie on the rise_ and _Underdog garage_ follow in a later PR; this one proves the engine on _Rivalry feud_.

## Review Focus

- Running the round update twice for a round changes nothing the second time.
- A rivalry that cools or ends before the showdown ends the storyline and leaves no pending card.
- Answering a card twice, or one that has expired, is refused and changes nothing.
- A driver at the fan cap gains no more fans from a card.
- A storyline between two computer garages' drivers runs its beats with no card.

## Tasks

1. Migration 0056 (`storyline`, `storyline_beat`, `event_card`) and the version pins in the migration tests.
2. `data/storylines.json`, `storylineBalance` in `src/sim/worldgen/data.ts`, pure `src/sim/storyline.ts` and its tests.
3. `addDriverFans` extracted in `src/db/fans.ts` (behaviour unchanged).
4. `src/db/storylines.ts`: `updateStorylines`, `answerCard`, `storyBoard`; the hook in `src/db/final.ts`.
5. Store slice, `StorylineSection` in the Drivers panel, locale text, UI test.
6. Telemetry, documents, changelog, review, full suite, pull request.
