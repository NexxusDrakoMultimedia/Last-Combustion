# M6 plan: depth (0.2.0)

M6 is built on `feature/0.2.x`, one slice at a time. Each slice is its own pull request into that branch, with its tests, the Game Design Document updated in the same pull request, and a line under `[Unreleased]` in the changelog. The slices follow the build orders written in the [Game Design Document](GAME_DESIGN_DOCUMENT.md) (see "Scope and build order"). When every slice is done, a documentation pass and a release pull request merge the branch into `main`, which is tagged `v0.2.0` (see [Releasing](RELEASING.md)).

## Rules for every slice

- A save from 0.1.x must still load: schema changes are new numbered migrations (the next number after the last one in `src/db/migrations`), and a released migration is never edited.
- Numbers go in `data/*.json`, text in `locales/en.json`, randomness from named streams, and each new data file is listed in [Data files](DATA_FILES.md).
- A new action that matters is reported through `track()` (categories, counts and amounts only).
- Every slice ends with the game still playable from the start of a career to the end of a season.

## The slices, in order

| #   | Slice                          | What it holds                                                                                                                                                                       | Why here                                                           |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Records and first impressions  | Fan and prestige rankings for drivers, cars, garages and nations (issue 80), the logo as the start-page header (issue 85), attention flags, the ghost record                        | Small, visible, and no new systems                                 |
| 2   | Garage operations              | The five-tier ladder for sponsors and suppliers (local, regional, national, continental, global), the spot market, outages, then facilities, then the rest of the executive design  | The build order in "Garage operations" is outages, then facilities |
| 3   | The financial ledger, part one | Yearly summaries per category, the year picker, the transactions list with CSV export                                                                                               | Ownership's valuation needs three years of profit                  |
| 4   | Ownership and the cap table    | The cap table and valuation for every garage, then rounds and dividends, then control and the board, then holdings and takeovers; then the balance sheet, assets held and net worth | Follows the ledger and garage operations                           |
| 5   | People and relationships       | Relationship kinds and morale, then contacts, social events and the press                                                                                                           | The press and the story engine read from it                        |
| 6   | Scouting and fog of war        | Scouts, the Head of Scouting, descriptions and ranges that tighten into exact values                                                                                                | Hides ratings on every screen, so it comes after the screens exist |
| 7   | Story and feedback             | Rivalries, the storyline engine and event cards, media headlines, crash highlights, drone events, the live map                                                                      | Needs the people layer and the press                               |

**Left over from slice 2.** The hospitality suite (needs the people layer, slice 5), the medical room (needs driver injuries), the fuel store (needs fuel licences), executive personality and traits (slice 5), a bonus on results in executive contracts, equity options (slice 4, the cap table), outages of water and travel fuel, event cards for outages (slice 7) and facilities for computer garages. Each is written in the Game Design Document as not built, and is picked up with the slice it depends on.

The order can change when a slice turns out larger than expected, and each slice can be split. Anything in the Game Design Document marked M7 or M8 stays out of M6.

## Release task: move the release site to Cloudflare

The release site moves from GitHub Pages to Cloudflare Workers & Pages as part of the 0.2.0 release itself, not before. Previews stay on the same Worker, and production is added to the same `wrangler.jsonc`. GitHub Pages stays live until the move is complete. The ordered steps, and what to check on the way (above all, that the telemetry keys reach production builds and not previews), are in the Hosting section of [Releasing](RELEASING.md).

## Definition of done for M6

- Every slice above is built, tested and described in the Game Design Document as built, and the "to come" notes for M6 are gone.
- The documentation pass in [Releasing](RELEASING.md) is done.
- Players can carry a 0.1.x save into 0.2.0.
- The release site is served from Cloudflare, GitHub Pages is switched off, and the docs say so.
- `CHANGELOG.md` has a `[0.2.0]` entry, and the release pull request is merged with a merge commit.
