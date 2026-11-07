# M7 plan: story and fog of war (0.3.0)

M7 is built on `feature/0.3.x`, made from `main` once 0.2.0 is out. It follows the same rules as [M6](M6_PLAN.md): one slice at a time, each its own pull request into the milestone branch with its tests, the Game Design Document updated in the same pull request and a line under `[Unreleased]` in the changelog, and one beta (`0.3.0-betaN`) for each slice.

## Rules for every slice

- A save from an earlier version must still load: schema changes are new numbered migrations, and a released migration is never edited.
- Numbers go in `data/*.json`, text in `locales/en.json`, randomness from named streams, and each new data file is listed in [Data files](DATA_FILES.md).
- A new action that matters is reported through `track()` (categories, counts and amounts only).
- Every slice ends with the game still playable from the start of a career to the end of a season.

## The slices, in order

| #   | Slice                   | What it holds                                                                                                                                                                                             | Why here                                                                              |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Story and feedback      | Rivalries, the storyline engine and event cards, media headlines beyond the garage's own, crash highlights, the ghost record, drone events and the live map ("Story and feedback" in the design document) | The people layer, the press and the calendar it reads from are built in M6            |
| 2   | Scouting and fog of war | Scouts, the Head of Scouting, and descriptions and ranges that tighten into exact values on every screen that shows a rating ("Scouting and fog of war")                                                  | It hides ratings on every screen, so it comes after the screens, and the story, exist |

Slice 1 is planned in detail when M7 starts.

## Slice 2 in detail: scouting and fog of war

What the player knows about anything outside their own garage becomes an estimate: a word, then a range, then an exact value. The simulation does not change, only what the screens show. Everything the player owns, and every public fact (results, points, numbers, titles, records), stays exact.

1. **The knowledge engine.** `data/scouting.json` and a pure `src/sim/scouting.ts`: a knowledge score from scouts (up to 50), evidence from scored finals (25), the subject's fame (15), the player's standing (10) and experience (30), the word band, the range half-width (20 down to 2, exact from 95) and where the true value sits in the range, drawn once per player, subject and season from the stream `scout:<subject>:<year>`. Property tests: a range always contains the truth, more knowledge only tightens it, it is the same on reload, and potential reads as knowledge 10 lower.
2. **Scouts and the Head of Scouting.** A Scouts tab in the Staff panel (a scout has a skill, a wage, a focus and can be assigned to a subject), a migration for the scout role and `scout_assignment`, and a ninth executive role that adds up to 25% to every scout.
3. **Fog on drivers.** The Drivers panel, the Registry driver page for drivers the player does not own, and the hint in a driver negotiation, through one shared component that shows the word, the range bar or the exact value, with the knowledge score on hover and a note on what would clear the fog. Sorting and filtering use the range midpoint, never the true value, so the order does not give it away.
4. **Fog on cars.** The used market, the auction and the Registry car page. A paid inspection takes one car to exact for that sale.
5. **Fog on garages and deals.** Registry garage pages, and the other side of a deal in the sponsor, operations and executive panels, where a walk-away value becomes a range that narrows with relationship, scouting and past deals. Computer garages keep deciding from the true values.
6. **Other ways to learn, and polish.** Attention flags add 25 knowledge for the season, watching a driver race adds evidence, then telemetry (counts only) and the documentation pass.

**Open questions for the owner** (to settle before piece 3): whether the starter screen shows the starter drivers and cars exact (recommended), what happens to the ratings in a save from an earlier version the first time it opens (a short note, or left exact), and the scouts' wages and how many a garage may hire (a first guess is about $20,000 to $80,000 a year by skill, and four).

**Risks.** Ratings show in about a dozen files, so piece 3 centralises them or numbers will leak; with no scouts a rookie reads as pure fog, so free-agent choices must stay reasonable (a well-known driver reads at about 40 to 50 knowledge, a useful range); and knowledge is worked out for each subject on screen, so it is cached for each refresh.
