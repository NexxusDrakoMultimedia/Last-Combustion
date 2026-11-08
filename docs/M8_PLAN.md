# M8 plan: the living world and the 2036 expansion (0.4.0)

M8 is built on `feature/0.4.x`, made from `main` once 0.3.0 is out. It follows the same rules as [M6](M6_PLAN.md) and [M7](M7_PLAN.md): one slice at a time, each its own pull request into the milestone branch with its tests, the Game Design Document updated in the same pull request and a line under `[Unreleased]` in the changelog, and one beta (`0.4.0-betaN`) for each slice.

M8 holds work that was spread thinly across the milestones before it. The car industry and mortality slices were first planned for M7 and moved here so that M7 keeps the story, scouting and racing layers, and M9 keeps the career modes and the release polish. The mod loader, achievements and cloud saves were moved here from M9 for the same reason.

## Rules for every slice

- A save from an earlier version must still load: schema changes are new numbered migrations, and a released migration is never edited.
- Numbers go in `data/*.json`, text in `locales/en.json`, randomness from named streams, and each new data file is listed in [Data files](DATA_FILES.md).
- A new action that matters is reported through `track()` (categories, counts and amounts only).
- Every slice ends with the game still playable from the start of a career to the end of a season.

## The slices, in order

| #   | Slice                               | What it holds                                                                                                                                                                   | Why here                                                                                         |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | The car industry and the job market | Manufacturers and car models named at random from the seed, and coming and going; more part suppliers and parts, three on offer; executives on the market offered to the player | The companies layer (sponsors and suppliers that come and go) and the job market are built in M6 |
| 2   | Mortality and legacies              | Everyone can die, at random and of old age; the player's owner can retire and die, of old age only; shares and roles pass on; legacies and heirs                                | M7's story layer writes the obituaries and the legacy lines                                      |
| 3   | The 2036 expansion                  | The Super Series rebrand, the 20-car final, the Junior Series, mandatory promotion and the 2036 Garage Championship prizes ($15,000,000 Super, $10,000,000 Junior)              | It changes the size of the field and the final, so it comes after the engines are steppable (M7) |
| 4   | Mods, achievements and cloud saves  | The mod loader and mod browser (data-only mods, SVG sanitised), achievements, and cloud-save export and sync                                                                    | Mods read the same data files the earlier slices have settled, so they come after them           |

Slices 1 and 2 are planned below. Slices 3 and 4 are planned in detail when M8 starts, from the Game Design Document's sections on the 2036 expansion and on mods.

## Slice 1 in detail: the car industry and the job market

Three things were left out of 0.2.0 and moved here by the owner. They share one idea: the companies and people around the garage are drawn from the seed and move in and out of the series, never for good.

1. **Manufacturers and car models named at random.** Every manufacturer and model gets a name drawn from the career seed (a named stream per manufacturer and per model, with the deny list in `data/names/cars.json` keeping names clear of real ones), instead of the names in the data files. They come and go like garages and drivers: a manufacturer or a model leaves the series for one to three years and returns, never for good, as the sponsors and suppliers already do (`company_break`, schema 53). The lineup refresh, the data build in `tools/data`, the world generator, the tests that name cars and the Game Design Document's tables all change with it, so this is the largest piece. Saves from before keep the names they have.
2. **More part suppliers and parts, three on offer.** Each of the 30 parts has one maker today. This adds makers so that every category has several, each with its own part (its own effects and price), and a garage is offered three makers for a part by the weighted draw the sponsors use (tier, prestige and relationship), listed by tier then name. A fitted part points at its maker in saves, so a migration maps each existing fitted part to its current maker and nothing already fitted changes.
3. **Executives on the market offered to the player.** Executives let go or whose contract has ended already stay on the job market for two seasons (see the design document's "Job market"). Today only computer garages take them on. The player is offered them too, through the same negotiation as any executive hire, with the three-on-offer draw and the same coming and going.
4. **Polish.** Telemetry (counts only), tests (the same seed always gives the same names and the same offers; no company is ever gone for good), the Game Design Document brought up to date and a documentation pass.

**Decided by the owner.** When a manufacturer leaves, its cars stay on the road and the model simply stops being made until it returns. Each part category has three to five makers.

**Risks.** Renaming touches data that mods also use, so the file schemas stay stable and only the names move; the part-maker migration must keep every fitted part valid; and a manufacturer leaving mid-season must not strand a garage with no car to enter.

## Slice 2 in detail: mortality and legacies

The first version of deaths (0.2.0) rolls a flat chance each year for working drivers, mechanics and executives, and passes a dead driver's or executive's shares to family or back to the garage. The owner asked for the whole picture: **everyone can die, at random and of old age, and what they leave behind is carried on.**

1. **Old age.** A death roll that rises with age (a table in `data/balance.json`, `season.deaths.byAge`), added to the flat chance of dying young. It applies to everyone with a birth date: drivers (retired ones too), mechanics, executives, the series administrators and commentators (who already age and have successors), and the people on the cap tables.
2. **Everyone on the cap table is a person.** Owners, family and investors of computer garages get a person row (a migration adds `person` links to `shareholding`, as the people layer in the design document describes), so they age and can die. When they do, their shares pass to family (a spouse or child where the family tree has them, otherwise the family holder of the garage) or go back to the garage, with the rule the first version already uses.
3. **The player's owner.** The owner ages. They can retire (at a chosen age from the late fifties, or when the player says so) and they can die, **of old age only**, never at random, so a career is never ended by a freak accident. A retired owner stays in the Paddock and on the cap table. A death or a retirement hands the garage on: to an heir if there is one (see below), otherwise the player chooses a successor from the garage's family, executives or the market, who becomes the owner with the same shares. The career carries on, as the Garage owner rules in the design document already say.
4. **Legacies.** What a person leaves is written down and used: a driver's titles and records stay in the Almanac with a mark that they have died; a garage founded by someone carries their name; a driver can have an heir who starts in the series (child of a driver, with a link in the Registry), which is the first piece of family and dynasty.
5. **Obituaries.** M7's story layer writes the dated prose (the news, the chronicle on the Game screen and the Registry profile) for each death and retirement.
6. **Polish.** Telemetry (counts only, never names), tests (a seeded year of deaths; shares always pass on; the owner never dies before the old-age table allows), the Game Design Document's "Death" and "Careers over time" sections brought up to date, and a documentation pass.

**Open questions for the owner.** Whether the family tree (partners and children) is built here or stays in M9 with the dynasty mode (recommended: here only what heirs need, the rest in M9), the age at which an owner can retire, and whether an owner's death should pause the calendar for the player to name a successor (recommended: yes).

**Risks.** Making investors and family into people touches the cap table and every screen that lists holders; a death roll that is too high empties the paddock over decades, so the tables are tuned against a hundred-season run; and the heir rules must never leave a garage without an owner.
