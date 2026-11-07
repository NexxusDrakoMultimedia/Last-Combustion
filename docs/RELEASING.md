# Releases and milestone branches

This is how Last Combustion is released to players. The [Game Design Document](GAME_DESIGN_DOCUMENT.md) says what each milestone contains ("Scope and build order"); this page says how a milestone becomes a version.

## Versions

Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each milestone from M5 on ends in a release (the numbers below are confirmed). **1.0.0 is not tied to any milestone**: the project owner declares it when the game is feature complete, so milestones after M9, or more releases between, are possible.

| Milestone                | Release   | What players get                                                                                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5 First playable season | **0.1.0** | The first release: start a career, buy and upgrade a car, sign a driver, race six rounds, finish the season and begin 2032 with every record kept |
| M6 Depth                 | 0.2.0     | Ownership, the people layer, supply outages, facilities and the rest of the depth work                                                            |
| M7 Story and fog of war  | 0.3.0     | Rivalries, the storyline engine and event cards, media headlines, crash highlights and the live map, and scouting and fog of war                  |
| M8 Junior and expansion  | 0.4.0     | The Junior Series, promotion and the 2036 expansion                                                                                               |
| M9 Modes and release     | 0.5.0     | All career modes, polish, mods, desktop builds, listing on the exchange                                                                           |
| Feature complete         | **1.0.0** | Not a milestone: the project owner declares 1.0.0 when the game is feature complete, whenever that is                                             |

M0 to M4 were built before there were players and have no release. Before 1.0.0 a minor version may change the rules of the game, but a save from an earlier version must still load: schema changes are new numbered migrations and a released migration is never edited.

## Scope freeze and the 0.1.x series

**Scope was frozen until 0.1.0 came out (2026-11-06).** That freeze is over: new work for M6 (0.2.0) is built on `feature/0.2.x`, in the order set out in the [M6 plan](M6_PLAN.md). The rules below still bind `main` and `hotfix/0.1.x`, which only take fixes and the release work itself (the version, the changelog, the branding and the notices). Anything new that is not a patch goes to the milestone branch, or is written down and waits.

**After 0.1.0, patch releases keep the first version healthy** while the next milestone is built on its own branch. A patch release (0.1.1, 0.1.2 and so on) is made on `hotfix/0.1.x`, branched from the `v0.1.0` tag, and is merged back into `main` and into the milestone branch in progress. It may contain:

- **Bug fixes**, with a test that fails without the fix.
- **Text and documentation fixes**, including the changelog and credits.
- **Balance and data tweaks** that change only numbers in `data/*.json` and need no new migration, so every 0.1.0 save still loads and plays the same way. A change that alters how a save behaves is called out in the changelog.
- **Small interface fixes** that do not add a feature (readability, spacing, a wrong label).

It may not contain new features, new screens, new rules, schema changes or anything else that belongs to a milestone. Those wait for 0.2.0 (M6) or later. The test is simple: if a player would say "that is new", it is not a patch.

**Where requests go.** Bugs are GitHub issues (the Feedback button opens the form). Ideas and feature requests are issues too, and are sorted into the patch series, M6, M7, M8 or M9 when they are read. What is already decided to wait:

| Waiting for | Item                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M6 (0.2.0)  | Fan and prestige rankings for drivers, cars, garages and nations, and the logo as the start-page header (issues 80 and 85)                                                                                   |
| M6 (0.2.0)  | The financial ledger, ownership and the cap table, facilities and the people layer                                                                                                                           |
| M7 (0.3.0)  | Scouting and fog of war, and the story and feedback layer (rivalries, the storyline engine, event cards, crash highlights and the live map)                                                                  |
| M8 (0.4.0)  | The Junior Series, the 2036 expansion and the 2036 Garage Championship prizes ($15,000,000 Super, $10,000,000 Junior)                                                                                        |
| Later       | The thematic type (Orbitron and Exo 2) for the logo and special screens, the story, press and social layers that use the slab, serif and flexible fonts, and a way to give feedback without a GitHub account |

## Branches

- **`main` is the latest release.** The web build on GitHub Pages deploys from `main`, so players only ever see released work.
- **Every milestone from M6 on runs on its own branch named for its release series**: `feature/0.2.x` for M6, `feature/0.3.x` for M7, `feature/0.4.x` for M8 and `feature/0.5.x` for M9. It is created from `main` when the milestone starts, and all of the milestone's pull requests target it, not `main`. CI (lint, types, tests, build, browser test, CodeQL, dependency review) runs on every pull request whatever its base, and on pushes to `main`, `feature/**` and `hotfix/**`.
- **Feature pull requests** are squash-merged into the milestone branch. The squash title ends with the pull request number, as now. The designated session branch (`claude/...`) stays the working branch; only the pull request's base changes.
- **Finishing a milestone.** When everything in the milestone is built and its game-design-document status is up to date, a release pull request merges the milestone branch into `main` with a merge commit (not a squash, so the milestone's history stays readable), titled `release: 0.2.0 (M6 depth)`. The release steps below run on it. Then `main` is tagged `v0.2.0` and a GitHub Release is published (publishing it also rebuilds the web build).
- **The next milestone** branch is created from the new `main` once the release is out.
- **Fixes to a released version** go on `hotfix/0.1.x` from the tag, are released as a patch (`0.1.1`), and are merged into `main` and into the milestone branch in progress, so nothing is lost. What a patch may and may not contain is in "Scope freeze and the 0.1.x series" above.
- 0.1.0 came out of `main`, as M5 finished there. From M6 on, milestones run on their own branches.

## Release steps

1. The milestone's definition of done in the design document is met, and the document's "built" notes match the code.
2. **The documentation pass** (below) is done, as its own commits on the release pull request.
3. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`, `pnpm docs:lint`, `pnpm docs:style`, `pnpm run licenses` and `reuse lint` all pass on the release pull request.
4. Bump `version` in `package.json`, and show the version on the About and menu screen.
5. Write the changelog entry (below).
6. Check the notices: `CREDITS.md` lists every third-party asset, the privacy prompt and telemetry text still match what is collected, and anything the design document marks "to be checked before release" (for example the flag list against the official lists) has been checked. `TRADEMARKS.md` is a draft that needs legal review before the first public release.
7. Merge, tag `vX.Y.Z`, publish the GitHub Release with the changelog entry as its notes, and confirm the Pages deploy.
8. Post the release with the social assets.

## Beta releases

From M6 on, each slice of a milestone ends in a beta, so there is something to play and test before the milestone is released. The beta for M6 is `0.2.0-beta1` after slice 1, `0.2.0-beta2` after slice 2, and so on; the final `0.2.0` follows the last slice and the documentation pass.

1. Bump `version` in `package.json` and `APP_VERSION` in `src/db/session.ts` to the beta (for example `0.2.0-beta1`), and add a `[0.2.0-beta1]` section to `CHANGELOG.md` from what is under `[Unreleased]`. This is a pull request into the milestone branch.
2. Tag the merge commit `v0.2.0-beta1`. A tag with a hyphen is published as a GitHub pre-release by the release workflow, with the web build zipped and checksummed.
3. Players try the beta by downloading the web build from the pre-release's assets and serving it locally, or by playing from source. There is no hosted beta site.

The release site (`lc.nexxusdrako.au`, GitHub Pages) deploys from `main` only, so players there never see a beta. A beta may change rules and add features, but a save from the last release still has to load.

## Hosting

- **The release site** (`lc.nexxusdrako.au`) is served by GitHub Pages and deploys from `main` through `.github/workflows/pages.yml`. Its telemetry keys are the `GTAG_ID`, `GA_GAME_KEY` and `GA_SECRET_KEY` secrets there.
- **A beta** is a GitHub pre-release with the web build attached. There is no separate beta site; to try one in a browser, use the branch's preview on Cloudflare (below).
- **Previews** of branches and pull requests are built by Cloudflare Workers & Pages (the Worker `last-combustion`, configured by `wrangler.jsonc`). That is the owner's own setup for looking at work in progress. It sets no telemetry keys, so a preview collects nothing, and it is not a release: nothing there is published to players.
- **Moving the release site to Cloudflare (planned for the 0.2.0 release).** The Worker `last-combustion` will serve the release site as well as the previews, from the same `wrangler.jsonc`: its top-level settings are the production site, and the `previews` block keeps the previews as they are. GitHub Pages stays live until the move is complete. The order:
  1. In the Cloudflare dashboard, set the production branch (`main`) deploy command to `npx wrangler deploy`. The other branches keep `npx wrangler preview`.
  2. Make sure the telemetry keys (`VITE_GTAG_ID`, `VITE_GA_GAME_KEY`, `VITE_GA_SECRET_KEY`) reach production builds and not previews. Cloudflare may share build variables between the two, so check this first: if it does, the build has to drop the keys when the branch is not `main`. Never write the keys in a file or an issue.
  3. Deploy `main` to the Worker and check the result on its `workers.dev` address, including the privacy prompt.
  4. Add the custom domain `lc.nexxusdrako.au` to `wrangler.jsonc` (a `routes` entry with `custom_domain`), and change the DNS for the domain from GitHub Pages to Cloudflare. Do not add the route before this step: deploying it claims the domain. Wait for the HTTPS certificate.
  5. Only when the Cloudflare site is serving, remove `.github/workflows/pages.yml` and `public/CNAME`, turn off GitHub Pages in the repository settings, and update this page and the Security section of `AGENTS.md` (which name GitHub Pages and the GitHub secrets).

  The checks and the release workflow (zip, checksums, GitHub Release) stay on GitHub.

- **The checks** (lint, types, tests, browser tests, documentation checks, REUSE, CodeQL and the dependency review) all run on GitHub, on every pull request.

## The documentation pass

Before every release, all of the documentation gets a thorough pass. It is slow on purpose: take no shortcuts and check every claim against the code. It is done on the release pull request, in commits of its own that change words and structure only, never a game rule. If the pass finds a place where the code and the document disagree and it is not clear which is right, stop and ask the project owner.

**What is covered.** Every Markdown file (`README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `TRADEMARKS.md`, `CREDITS.md`, `CHANGELOG.md`, everything in `docs/` and `docs/adr/`, and the issue and pull request templates), the player-facing text in `locales/en.json`, the `source` notes in the data files, and the comments that describe a rule.

1. **Fix.** Check every statement of fact against the code and the data: numbers against `data/*.json`, commands against `package.json`, file and function names against the source, "built" and "to come" labels against what the game does today, version and milestone status against this page. Follow every link and cross-reference. Correct what is stale, wrong or missing, and update the date or version of anything that names one.
2. **Unify.** One name for each thing, used everywhere: the same words for the series, rounds, prelims, finals, entries, garages and the Registry, written the same way each time. One shape for headings, tables, lists, and "built so far" notes. One voice, tense and level of detail within a section.
3. **Deduplicate.** Every rule is stated once, in the section that owns it, and everywhere else links to it. Where the design document repeats itself across its "built so far" notes, merge the notes into the section they belong to. Keep a short summary only where a reader would otherwise have to jump around, and make sure the summary and the source agree.
4. **Polish.** Add what a reader needs and does not yet have: how to play (with screenshots from the release), the glossary, how saves, versions and migrations work, what the data files contain, how modding works, troubleshooting, known limits, and what is planned next. Make the README work for a first-time visitor in a minute, and make contributing easy to start.
5. **Humanize.** Write the way a person who loves the game would explain it: plain words, short sentences, active voice, specific examples. Cut filler, hype, stock phrases and anything that reads as machine-written. **No em dashes** anywhere (use a comma, a colon, a full stop or brackets), and an en dash only in a number range; `pnpm docs:style` enforces both. Keep player-facing text consistent in tone with the game's world.
6. **Check.** `pnpm docs:lint`, `pnpm docs:style`, a link check, `reuse lint`, and a read-through of the finished pages in order, as a new player and as a new contributor. List what changed in the pull request description.

## Changelog

`CHANGELOG.md` begins at 0.1.0 (released 2026-11-06).

- **0.1.0** is written as a simple list of the game's features, because nothing came before it.
- **From then on** it follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): each pull request adds a line under `[Unreleased]` (Added, Changed, Fixed, Removed, Security) on the milestone branch, and the release pull request turns `[Unreleased]` into the dated version heading.
- Breaking changes to saves or mods are called out at the top of the entry.
- Players read it: the About screen's Changelog tab shows `CHANGELOG.md` as it is, and its Credits tab shows `CREDITS.md`, so write both for players, in plain words.

## Branding and social assets for 0.1.0

The logo and name are reserved (see `TRADEMARKS.md`); these assets are made new for the release, are original, and carry the same reservation. They live in `assets/brand/` (sources, as SVG where possible) and `public/` (what the web build serves), and are listed in `CREDITS.md`.

- **Logo.** A mark and a wordmark, in a colour version, a one-colour version and a version for light and dark backgrounds, as SVG. No real brand, person or livery may appear in it, and Pyra Drake is only drawn by Nexxus Drako Multimedia.
- **Favicons and app icons.** A favicon set (SVG, 32 and 180 pixel PNGs, web manifest) for the web build, and a square icon for the desktop builds that come later.
- **Social cards.** A 1200 by 630 pixel Open Graph and Twitter card, with the matching `<meta>` tags in `index.html`, and a 1280 by 640 pixel image for the GitHub repository's social preview.
- **Profile art.** Avatar and banner images for the project's social accounts (square, and 3 by 1).
- **Screenshots.** A set made by a Playwright script from the real game (a season hub, the garage, the results, the Registry, a driver profile), at 1920 by 1080, so they can be remade every release.
- **Press kit page.** A short `docs/PRESS.md` with the description, the logo files, the screenshots, the licence and the trademark note.

Videos, store capsule art and a trailer are later, with the store listings.
