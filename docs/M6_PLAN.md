# M6 plan: depth (0.2.0)

M6 was built on `feature/0.2.x`, one slice at a time. Each slice was its own pull request into that branch, with its tests, the Game Design Document updated in the same pull request, and a line under `[Unreleased]` in the changelog, and each ended in a beta. All six slices are built, and the release steps in [Releasing](RELEASING.md) (the documentation pass, the release pull request and the tag `v0.2.0`) close the milestone. The slices followed the build orders written in the [Game Design Document](GAME_DESIGN_DOCUMENT.md) (see "Scope and build order").

## Rules for every slice

- A save from 0.1.x must still load: schema changes are new numbered migrations (the next number after the last one in `src/db/migrations`), and a released migration is never edited.
- Numbers go in `data/*.json`, text in `locales/en.json`, randomness from named streams, and each new data file is listed in [Data files](DATA_FILES.md).
- A new action that matters is reported through `track()` (categories, counts and amounts only).
- Every slice ends with the game still playable from the start of a career to the end of a season.

## The slices

| #   | Slice                          | What it holds                                                                                                                                                                                                                                                                 | Built in    |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Records and first impressions  | Fan and prestige rankings for drivers, cars, garages and nations (issue 80), the logo as the start-page header (issue 85) and attention flags                                                                                                                                 | 0.2.0-beta1 |
| 2   | Garage operations              | The five-tier ladder for sponsors and suppliers (local, regional, national, continental, global), the spot market, outages, then facilities, then the rest of the executive design                                                                                            | 0.2.0-beta2 |
| 3   | The financial ledger, part one | Yearly summaries per category, the year picker, the transactions list with CSV export                                                                                                                                                                                         | 0.2.0-beta3 |
| 4   | Ownership and the cap table    | The cap table and valuation for every garage, then rounds and dividends, then control and the board, then holdings and takeovers; computer garages as full businesses (executives, sponsors, suppliers and facilities)                                                        | 0.2.0-beta4 |
| 5   | People and relationships       | Relationship kinds and morale, then contacts, social events and the press, with the Paddock and company profiles in the Registry                                                                                                                                              | 0.2.0-beta5 |
| 6   | The calendar and time controls | A game date that advances a day at a time, a calendar of events, and Continue, Next event, Day and Week controls in place of the Run prelims and Run final buttons (like the time controls of Football Manager); social occasions and other dated things move onto real dates | 0.2.0-beta6 |

The order could change when a slice turned out larger than expected, and each slice could be split. Anything in the Game Design Document marked M7, M8 or M9 stays out of M6. That includes the story and feedback layer and scouting and fog of war, which are M7 (see [the M7 plan](M7_PLAN.md)).

## Beta 7: the owner's final-check list

Before 0.2.0 the owner's own list of changes was built as one more beta (`0.2.0-beta7`): the almanac and results screens, the championship tiebreakers, automatic dividends and talks, press fans, no founder in a new world, place-named and family-named garages, deaths outside racing, shareholder bylines, origins for the paddock, mechanics for computer garages, the job market, drivers who invest, more sponsors and suppliers with three on offer, companies that come and go, and Better Stack. What was asked for and is **not** in it, and why. The owner moved all four of these to later milestones (the first three are slice 1 of [the M8 plan](M8_PLAN.md), racing by the day is slice 3 of [the M7 plan](M7_PLAN.md)):

- **Manufacturers and car models named at random from the seed, and coming and going** (like garages and drivers, never for good). The names are in the data files, the lineup refresh and the Game Design Document's tables, and a rename touches the data build, the world generator and the documentation. It is its own piece of work, with the same coming and going as the sponsors and suppliers.
- **More part suppliers and parts, three on offer.** Each of the 30 parts has one maker today, so more suppliers means a part for each supplier and category, which changes what a fitted part points at in saves.
- **Executives on the job market offered to the player.** Only computer garages take them on for now, because a negotiation creates its own candidate.
- **Racing by the day and the final in view,** which is planned in [the M7 plan](M7_PLAN.md).

## Left over for later

Each item below is written in the Game Design Document as not built, and is picked up with the work it depends on.

**From slice 1 (records).** The ghost record, which projects a ghost car in each prelim (it belongs to the story and feedback layer, M7).

**From slice 2 (garage operations).** The hospitality suite (needs more of the people layer), the medical room (needs driver injuries), the fuel store (needs fuel licences), executive personality and traits, a bonus on results in executive contracts, equity options, outages of water and travel fuel, and event cards for outages (M7).

**From slice 3 (the ledger).** The Balance sheet tab (assets held, liabilities and net worth), the chart of income, spending and net worth over the seasons, and the finance group's lines (interest, loans, dividends and share issues). Ownership now supplies the holdings, the dividends and the valuation they read, so the tab can be built next.

**From slice 4 (ownership).** The option pool and the right of first refusal, stakes in manufacturers and suppliers, takeover as a negotiation, the vote of no confidence having a consequence (it needs an employed-manager career), the board approving budgets and executives, relationship effects of dividends, mechanics crews, supply contracts and outages for computer garages, their executives' and facilities' effects, computer garages raising money and trading shares, and manufacturers, suppliers and sponsors as businesses with their own shareholders, start-ups and wind-downs.

**From slice 5 (people).** Interviews with the press, relationship kinds beyond friend, acquaintance, rival and enemy (mentor, partner, family), kinds formed from shared moments and personality, tips and introductions from friends, the Healesville festival, morale from how the player treats people and for drivers, headlines about other garages and drivers, and companies (manufacturers, suppliers and sponsors) as businesses with shareholders, start-ups and wind-downs.

**From slice 6 (the calendar).** Contract and negotiation dates as events on the calendar (contracts end at the season rollover and offers do not expire by date yet), other work done for each day that passes (supply deliveries, outages and executive and mechanic changes by date), prelims run a day at a time (a prelim is one simulation, so it needs a decision between days to be worth splitting), and watching an event.

## Release work

- **Hosting.** The release site moved from GitHub Pages to Cloudflare Workers & Pages ahead of the release (done on 2026-11-07): the Worker `last-combustion` serves `lc.nexxusdrako.au`, built from `main`, and the previews stay on the same Worker. What is left for the release itself is that `main` gets this branch's code, including the guard that keeps the telemetry keys out of previews. The setup is in the Hosting section of [Releasing](RELEASING.md).
- **The documentation pass,** the version bump and the changelog entry, then the release pull request.

## Definition of done for M6

- Every slice above is built, tested and described in the Game Design Document as built, and the "to come" notes for M6 are gone, apart from the left-overs above.
- The documentation pass in [Releasing](RELEASING.md) is done.
- Players can carry a 0.1.x save into 0.2.0.
- The release site is served from Cloudflare and the docs say so (done).
- `CHANGELOG.md` has a `[0.2.0]` entry, and the release pull request is merged with a merge commit.
