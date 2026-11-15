# Contributing to Last Combustion

Thank you for helping. This page is the short route from "I want to change something" to a merged pull request. If you are an AI coding agent, read [AGENTS.md](AGENTS.md) first.

## Ways to help

You do not have to write code.

- **Play and report.** Play a few seasons and open an issue for anything that is wrong, unclear or unfair. A career seed and the game version (Menu, then About) make a bug much easier to fix.
- **Check the numbers.** Balance is meant to be tuned from evidence. A suggestion with the seed, what you saw and what you expected is worth more than an opinion.
- **Improve the documents.** Corrections to [How to play](docs/HOW_TO_PLAY.md), the [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) and these pages are welcome, and a small pull request is enough.
- **Review.** Reading an open pull request and saying what you found is a real contribution.
- **Write code.** Start with a small open issue, or the plan for the milestone being built (see below).

## Get it running

You need Node.js 22 and pnpm 10 (`corepack enable` sets pnpm up from `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

A good order to read in is the [README](README.md), then [How to play](docs/HOW_TO_PLAY.md) so you have seen the game, then the [architecture notes](docs/ARCHITECTURE.md) so you know where things live. The [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) is the source of truth for the rules and numbers, and says what is built and what is planned. The plan for the milestone being built is in [docs/M6_PLAN.md](docs/M6_PLAN.md) (and [docs/M7_PLAN.md](docs/M7_PLAN.md) and [docs/M8_PLAN.md](docs/M8_PLAN.md) for the ones after).

## How a change goes in

1. **Pick something.** Look at the open issues, or the current milestone plan for what comes next. For anything big, open an issue first so we can agree the shape.
2. **Branch.** Work on a short-lived branch and open a pull request. `main` is the latest release and only takes release pull requests. Each milestone is built on its own branch (`feature/0.2.x` for M6, `feature/0.3.x` for M7), and a fix to a released version goes on a patch branch (`hotfix/0.1.x`). Your pull request targets the branch of the work it belongs to. Feature pull requests are squash-merged. [Releasing](docs/RELEASING.md) has the whole branch model.
3. **Keep it focused.** One change per pull request. A bug fix does not need a refactor next to it.
4. **Change the design with the code.** If behaviour changes, update the Game Design Document in the same pull request.
5. **Open the pull request** using the template, and wait for the checks to go green. Cloudflare also builds a preview of your branch, which you can use to try the change in a browser.

## What a pull request needs

Before you ask for a review, check that your pull request:

- is focused on one change and targets the right branch (step 2 above);
- passes the checks below, with tests added or updated and fixed seeds in them;
- updates the Game Design Document if behaviour or design changed, and adds a line under `[Unreleased]` in `CHANGELOG.md` for anything a player would notice;
- has no literal player text outside `locales/en.json`, and no real people's names or brands anywhere;
- lists any new dependency or asset in [CREDITS.md](CREDITS.md) with a GPL-compatible licence;
- has signed-off commits with Conventional Commit subjects.

The pull request template carries the same checklist.

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Also run the checks that match what you touched:

| You changed                      | Run                                                       |
| -------------------------------- | --------------------------------------------------------- |
| Anything in `src/ui` or a screen | `pnpm test:e2e` (build first)                             |
| Markdown, `locales/` or `data/`  | `pnpm docs:lint`, `pnpm docs:style` and `pnpm docs:check` |
| Dependencies or assets           | `pnpm run licenses`, and `reuse lint`                     |

A pre-commit hook formats staged files and checks your commit message. CI runs everything above, plus CodeQL and a dependency review.

## Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Add `!` for a breaking change. Keep the subject in lower case and each line of the body to 100 characters or fewer; the pre-commit hook rejects a message that breaks the rules.
- Sign off every commit (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/).
- The project uses [Semantic Versioning](https://semver.org/). Each pull request adds a line under `[Unreleased]` in `CHANGELOG.md` for anything a player would notice ([Keep a Changelog](https://keepachangelog.com/) style: Added, Changed, Fixed, Removed, Security), written in plain words because players read it in the game. Betas never get a section of their own; see [Releasing](docs/RELEASING.md).

## Code rules that catch people out

- **Randomness is named.** Anything random in `src/sim` comes from a named stream (`createRng(seed).stream('name')`), never `Math.random()` or the clock. The same seed must always give the same world.
- **The database is the truth.** Schema changes are new numbered migrations in `src/db/migrations`. Never edit a migration that has been released.
- **Numbers live in data.** Balance values go in `data/balance.json` and reference data in `data/` (see [Data files](docs/DATA_FILES.md)), so mods can change them.
- **Text lives in `locales/en.json`** and is read with `t()`. ESLint rejects literal text in screens.
- **Every change has tests.** Use fixed seeds. Where a rule holds for any seed, add a property test (fast-check).
- **Licences.** Only add GPL-compatible dependencies and assets, and list them in [CREDITS.md](CREDITS.md). New source files start with the SPDX header (see `AGENTS.md`).
- **Telemetry.** Events carry categories, counts and amounts only, never names, free text or save contents. Never commit an analytics key, and never write one in a document, test or log.

## Review

Every pull request is reviewed by a maintainer (the repository's `CODEOWNERS` asks for it). Expect questions and requests for changes: they are about the change, not about you. A draft pull request is a good way to ask for early feedback. Answer review comments in the thread, push your fixes as new commits, and say so when you are ready for another look. Maintainers review as time allows. Never skip or disable a test to get a check green, and do not force-push over a review in progress.

## Your contribution's licence

The project is licensed GPL-3.0-or-later (see [LICENSE](LICENSE)). By opening a pull request you agree that your contribution is licensed under the same terms, and signing off your commits certifies the Developer Certificate of Origin. New source files start with the SPDX header described in [AGENTS.md](AGENTS.md). [CONTRIBUTORS.md](CONTRIBUTORS.md) says how to be listed.

## Writing

Documents and player text are plain, direct and human: short sentences, active voice, specific examples, no filler. No em dashes (use a comma, colon, full stop or brackets), and an en dash only in a number range. `pnpm docs:style` checks it. `pnpm docs:check` checks the facts a machine can check: links, anchors, file paths and commands. Every release gets a full documentation pass first, which [Releasing](docs/RELEASING.md) describes.

## Characters and names

The game's names, places and cars are fictional or original. Do not add real people's surnames or personal details, or real brands. The name, the logo, Pyra Drake, the two series administrators, the four commentators and the dragon-blooded driver characters belong to Nexxus Drako Multimedia and are reserved, so mods and forks may not use them (see [TRADEMARKS.md](TRADEMARKS.md)).

## Getting help

If you are stuck, open an issue or a draft pull request and ask. Say what you tried and what happened, with the command and its output. The [architecture notes](docs/ARCHITECTURE.md) and [Data files](docs/DATA_FILES.md) answer most "where does this live" questions, and the Game Design Document answers "what should it do".

## Reporting problems and ideas

- A bug or an idea: open an issue with the template (or press Feedback in the game, which opens the same form). For a bug, say what you expected and what happened, and include the game version (Menu, then About) and the career seed if you have it.
- A security problem: do not open a public issue. Follow [SECURITY.md](SECURITY.md).
- Behaviour that is not welcome: see the [code of conduct](CODE_OF_CONDUCT.md). It covers every space where the project is discussed, and says how to report a problem in private.
