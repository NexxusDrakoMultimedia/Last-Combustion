# Press and Crash Highlights Implementation Plan

**Goal:** Headlines beyond the player garage's own (the world's winners, rivalries and storylines) and crash highlights that raise a driver's notoriety and cost reputation.

**Architecture:** A pure `src/sim/news.ts` holds the rules (what is a highlight, which are kept, which journalist writes). `src/db/news.ts` runs once per round inside the final's transaction after `updateStorylines`: it applies the round's crash highlights, then writes the round's news items. A new `news` table holds the world's headlines; the existing `headline` table (the player garage's own result headline) is untouched. The Press panel shows the news feed.

**Tech Stack:** TypeScript, SQL.js, Vitest, fast-check, React 19, Zustand.

**Spec:** [docs/M7_PLAN.md](../../M7_PLAN.md) ("Slice 1 in detail", piece 3), "Attention flags" and "Fans" in [docs/GAME_DESIGN_DOCUMENT.md](../../GAME_DESIGN_DOCUMENT.md).

## Global Constraints

- Branch `m7/press-highlights`, one PR into `feature/0.3.x`. Conventional Commits, signed off.
- Determinism: journalists come from the stream `news:<roundId>`; every query is ordered. A save from 0.3.x must still load and play a final, with no news until a final is played.
- Numbers in `data/press.json` (`news` block), text in `locales/en.json` through `t()`.
- A new numbered migration (0057); never edit a released one.
- New files start with the SPDX headers. No em dashes. No real names. Telemetry carries counts only, through `track()`.
- Values: a crash is a highlight when it happens in a final, or in the prelims with a repair bill of at least 15,000 (3% of a car's new price, so a car of 500,000 or more, about the top fifth); at most 2 highlights a round, the dearest first. A highlight gives the driver 0.15% of the series audience in fans (through `addFans`, so fame, the cap and the season tallies follow) and costs 2 reputation points. At most 1 winner item, 2 crash, 2 rivalry and 2 story items a round.

## Rulings

- **Notoriety is fame.** The design document says a highlight raises a driver's fame "as notoriety", and fame is derived from fans, so the highlight gives fans and no new column is added (a stored fame value would be overwritten by the next fan change).
- **A new `news` table, not a rebuilt `headline`.** `headline` has a CHECK on its kind that SQLite cannot alter, is unique per garage and round, and carries fans and tone tied to the player garage's relationship with a journalist. World news is informational, so it gets its own table and the player's headline stays as it is.
- **The reckless-crash loss (-0.05%) is not built.** It needs a penalty or blame rule that does not exist yet.
- **Garage, car and flag shares of the highlight fans are not applied**, only the driver's.
- **Practice crashes and mechanical failures are not highlights**: they cost no repair bill and carry no drama.
- Reputation has no decay in the game today, so a highlight's cost is lasting, as story card costs are.

## Review Focus

- Running the round twice changes nothing the second time (no double fans, reputation or news).
- A crash by a driver whose car has no price (0) is a highlight only in a final.
- A driver at the fan cap gains no fans from a highlight but still loses reputation, and reputation never goes below 0.
- More than two crashes in a round keep only the two dearest, ties broken by entry id.
- A round with no winner, rivalry or storyline writes only what exists, and a 0.3.x save plays a final.

## Tasks

1. `news` data in `data/press.json`; pure `src/sim/news.ts` and tests.
2. Migration 0057 (`news`) and the version pins; `adjustReputation` extracted from `answerCard`.
3. `src/db/news.ts`: `applyCrashHighlights`, `writeNews`, `newsFeed`; the hook in `src/db/final.ts`.
4. Store (`news`), the News list in the Press panel, locale text, UI test.
5. Telemetry, documents, changelog, review, full suite, pull request.
