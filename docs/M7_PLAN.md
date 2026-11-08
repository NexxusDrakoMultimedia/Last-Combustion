# M7 plan: story and fog of war (0.3.0)

M7 is built on `feature/0.3.x`, made from `main` once 0.2.0 is out. It follows the same rules as [M6](M6_PLAN.md): one slice at a time, each its own pull request into the milestone branch with its tests, the Game Design Document updated in the same pull request and a line under `[Unreleased]` in the changelog, and one beta (`0.3.0-betaN`) for each slice.

## Rules for every slice

- A save from an earlier version must still load: schema changes are new numbered migrations, and a released migration is never edited.
- Numbers go in `data/*.json`, text in `locales/en.json`, randomness from named streams, and each new data file is listed in [Data files](DATA_FILES.md).
- A new action that matters is reported through `track()` (categories, counts and amounts only).
- Every slice ends with the game still playable from the start of a career to the end of a season.

## The slices, in order

| #   | Slice                                   | What it holds                                                                                                                                                                                                                             | Why here                                                                                    |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Story and feedback                      | Rivalries, the storyline engine and event cards, media headlines beyond the garage's own, crash highlights, the ghost record, drone events and the live map ("Story and feedback" in the design document)                                 | The people layer, the press and the calendar it reads from are built in M6                  |
| 2   | Scouting and fog of war                 | Scouts, the Head of Scouting, and descriptions and ranges that tighten into exact values on every screen that shows a rating ("Scouting and fog of war")                                                                                  | It hides ratings on every screen, so it comes after the screens, and the story, exist       |
| 3   | Racing by the day and the final in view | Every prelim day and every final can be watched, raced and managed, not only seen in a tactical view (see "Slice 3 in detail")                                                                                                            | It needs the calendar (built in M6) and the story layer's incidents                         |
| 4   | Mortality and legacies                  | Everyone can die, at random and of old age: drivers, staff, executives, owners, family and investors; the player's owner can retire and die, of old age only; shares and roles pass on; legacies are carried on (see "Slice 4 in detail") | The story layer writes the obituaries and the legacy lines; the people layer is built in M6 |

Slice 1 is planned in detail when M7 starts. Slices 3 and 4 are planned below. Slice 4 can come before slice 3, and its dynasty half moves to M9 if it grows.

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

## Slice 3 in detail: racing by the day and the final in view

Today a round's prelims are one simulation with no decisions between days, and a final is simulated sector by sector with no calls. The aim is that **each day of the prelims and every final can be watched, raced and managed**, not only seen in a tactical view. The result stays deterministic: with no calls from the player, stepping through a day or a race gives exactly what the single run gives now.

1. **A steppable engine.** The prelim and final engines become state machines whose whole state is plain data (`src/sim/prelim`, `src/sim/final`): a day of prelims, or a lap of the final, is one step, drawing from a named stream (`race:<round>:<day or lap>`) so the same seed gives the same step. Property tests: stepping to the end equals the batch result for any seed, and a saved state resumed gives the same result as one that was never saved.
2. **Saves in the middle of a race.** A `race_state` table (migration) holds the state between steps, so a save made on prelim day 3 or lap 7 of a final loads and carries on. The calendar's blocking events become one per prelim day and one for the final, and Continue moves from one to the next.
3. **Watching.** A race screen with a timing tower (position, gap, last sector times, tyre life, weather), a feed of what happens, and speed controls (watch each run or lap, fast forward, skip to the end of the day or the race). The course outline already drives a live map, which comes with the story layer's slice 1.
4. **Managing a prelim day.** Before each of the player's runs: the plan (attack, steady or conserve the car), the tyres and a repair or a retirement after trouble, each with a cost or a risk in the existing wear, tyre and legality rules. The computer garages decide from their profile (`ai_profile`) and the seed.
5. **Managing a final.** Calls during the race (push, hold, defend, save the tyres) from `final.calls` in `data/balance.json`, with pauses for incidents the player can answer. The player can leave a race on automatic, which is today's behaviour.
6. **Polish.** Telemetry (counts only), the browser test for a watched day and a watched final, the Game Design Document's "Weekend format and management interface" brought up to date, and a documentation pass.

**Open questions for the owner.** Whether a day of prelims should stop for the player's decisions every time or only when something happens (recommended: only when something happens, with a setting for every run), how much the player's calls may change a final (a few places, not the result), and whether the spectating view should show other garages' runs live or only the results as they come in.

**Risks.** The engines were written to run in one go, so piece 1 is the largest piece and touches every race test; a state that is too big makes saves slow, so it keeps indexes rather than copies; and calls must never make a final unwinnable for the computer garages, which have none.

## Slice 4 in detail: mortality and legacies

The first version of deaths (0.2.0) rolls a flat chance each year for working drivers, mechanics and executives, and passes a dead driver's or executive's shares to family or back to the garage. The owner asked for the whole picture: **everyone can die, at random and of old age, and what they leave behind is carried on.**

1. **Old age.** A death roll that rises with age (a table in `data/balance.json`, `season.deaths.byAge`), added to the flat chance of dying young. It applies to everyone with a birth date: drivers (retired ones too), mechanics, executives, the series administrators and commentators (who already age and have successors), and the people on the cap tables.
2. **Everyone on the cap table is a person.** Owners, family and investors of computer garages get a person row (a migration adds `person` links to `shareholding`, as the people layer in the design document describes), so they age and can die. When they do, their shares pass to family (a spouse or child where the family tree has them, otherwise the family holder of the garage) or go back to the garage, with the rule the first version already uses.
3. **The player's owner.** The owner ages. They can retire (at a chosen age from the late fifties, or when the player says so) and they can die, **of old age only**, never at random, so a career is never ended by a freak accident. A retired owner stays in the Paddock and on the cap table. A death or a retirement hands the garage on: to an heir if there is one (see below), otherwise the player chooses a successor from the garage's family, executives or the market, who becomes the owner with the same shares. The career carries on, as the Garage owner rules in the design document already say.
4. **Legacies.** What a person leaves is written down and used: a driver's titles and records stay in the Almanac with a mark that they have died; a garage founded by someone carries their name; a driver can have an heir who starts in the series (child of a driver, with a link in the Registry), which is the first piece of family and dynasty.
5. **Obituaries.** The story layer's slice 1 writes the dated prose (the news, the chronicle on the Game screen and the Registry profile) for each death and retirement.
6. **Polish.** Telemetry (counts only, never names), tests (a seeded year of deaths; shares always pass on; the owner never dies before the old-age table allows), the Game Design Document's "Death" and "Careers over time" sections brought up to date, and a documentation pass.

**Open questions for the owner.** Whether the family tree (partners and children) is built here or stays in M9 with the dynasty mode (recommended: here only what heirs need, the rest in M9), the age at which an owner can retire, and whether an owner's death should pause the calendar for the player to name a successor (recommended: yes).

**Risks.** Making investors and family into people touches the cap table and every screen that lists holders; a death roll that is too high empties the paddock over decades, so the tables are tuned against a hundred-season run; and the heir rules must never leave a garage without an owner.
