# Releases and milestone branches

This is how Last Combustion is released to players. The [Game Design Document](GAME_DESIGN_DOCUMENT.md) says what each milestone contains ("Scope and build order"); this page says how a milestone becomes a version.

## Versions

Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each milestone from M5 on ends in a release (proposed numbers, to be confirmed at each milestone). **1.0.0 is not tied to any milestone**: the project owner declares it when the game is feature complete, so milestones after M8, or more releases between, are possible.

| Milestone                | Release   | What players get                                                                                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5 First playable season | **0.1.0** | The first release: start a career, buy and upgrade a car, sign a driver, race six rounds, finish the season and begin 2032 with every record kept |
| M6 Depth                 | 0.2.0     | Ownership, the people layer, supply outages, facilities and the rest of the depth work                                                            |
| M7 Junior and expansion  | 0.3.0     | The Junior Series, promotion and the 2036 expansion                                                                                               |
| M8 Modes and release     | 0.4.0     | All career modes, polish, mods, desktop builds, listing on the exchange                                                                           |
| Feature complete         | **1.0.0** | Not a milestone: the project owner declares 1.0.0 when the game is feature complete, whenever that is                                             |

M0 to M4 were built before there were players and have no release. Before 1.0.0 a minor version may change the rules of the game, but a save from an earlier version must still load: schema changes are new numbered migrations and a released migration is never edited.

## Branches

- **`main` is the latest release.** The web build on GitHub Pages deploys from `main`, so players only ever see released work.
- **Every milestone from M6 on runs on its own branch**, `milestone/m6-depth`, `milestone/m7-junior` and so on. It is created from `main` when the milestone starts, and all of the milestone's pull requests target it, not `main`. CI (lint, types, tests, build, browser test, CodeQL, dependency review) runs on every pull request whatever its base, and on pushes to `main` and to `milestone/**`.
- **Feature pull requests** are squash-merged into the milestone branch. The squash title ends with the pull request number, as now. The designated session branch (`claude/...`) stays the working branch; only the pull request's base changes.
- **Finishing a milestone.** When everything in the milestone is built and its game-design-document status is up to date, a release pull request merges the milestone branch into `main` with a merge commit (not a squash, so the milestone's history stays readable), titled `release: 0.2.0 (M6 depth)`. The release steps below run on it. Then `main` is tagged `v0.2.0` and a GitHub Release is published (publishing it also rebuilds the web build).
- **The next milestone** branch is created from the new `main` once the release is out.
- **Fixes to a released version** go on `hotfix/0.1.x` from the tag, are released as a patch (`0.1.1`), and are merged into `main` and into the milestone branch in progress, so nothing is lost.
- Until 0.1.0 is out, M5 finishes on `main` as before.

## Release steps

1. The milestone's definition of done in the design document is met, and the document's "built" notes match the code.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build && pnpm test:e2e`, `pnpm docs:lint`, `pnpm run licenses` and `reuse lint` all pass on the release pull request.
3. Bump `version` in `package.json`, and show the version on the About and menu screen.
4. Write the changelog entry (below).
5. Check the notices: `CREDITS.md` lists every third-party asset, the privacy prompt and telemetry text still match what is collected, and anything the design document marks "to be checked before release" (for example the flag list against the official lists) has been checked. `TRADEMARKS.md` is a draft that needs legal review before the first public release.
6. Merge, tag `vX.Y.Z`, publish the GitHub Release with the changelog entry as its notes, and confirm the Pages deploy.
7. Post the release with the social assets.

## Changelog

`CHANGELOG.md` begins at 0.1.0. Until then it stays empty and pull requests do not edit it.

- **0.1.0** is written as a simple list of the game's features, because nothing came before it.
- **From then on** it follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): each pull request adds a line under `[Unreleased]` (Added, Changed, Fixed, Removed, Security) on the milestone branch, and the release pull request turns `[Unreleased]` into the dated version heading.
- Breaking changes to saves or mods are called out at the top of the entry.

## Branding and social assets for 0.1.0

The logo and name are reserved (see `TRADEMARKS.md`); these assets are made new for the release, are original, and carry the same reservation. They live in `assets/brand/` (sources, as SVG where possible) and `public/` (what the web build serves), and are listed in `CREDITS.md`.

- **Logo.** A mark and a wordmark, in a colour version, a one-colour version and a version for light and dark backgrounds, as SVG. No real brand, person or livery may appear in it, and Pyra Drake is only drawn by Nexxus Drako Multimedia.
- **Favicons and app icons.** A favicon set (SVG, 32 and 180 pixel PNGs, web manifest) for the web build, and a square icon for the desktop builds that come later.
- **Social cards.** A 1200 by 630 pixel Open Graph and Twitter card, with the matching `<meta>` tags in `index.html`, and a 1280 by 640 pixel image for the GitHub repository's social preview.
- **Profile art.** Avatar and banner images for the project's social accounts (square, and 3 by 1).
- **Screenshots.** A set made by a Playwright script from the real game (a season hub, the garage, the results, the Ledger, a driver profile), at 1920 by 1080, so they can be remade every release.
- **Press kit page.** A short `docs/PRESS.md` with the description, the logo files, the screenshots, the licence and the trademark note.

Videos, store capsule art and a trailer are later, with the store listings.
