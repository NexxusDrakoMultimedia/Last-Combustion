# Contributing to Last Combustion

Thank you for helping. This page is the short route from "I want to change something" to a merged pull request. If you are an AI coding agent, read [AGENTS.md](AGENTS.md) first.

## Get it running

You need Node.js 22 and pnpm 10 (`corepack enable` sets pnpm up from `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

A good order to read in is the [README](README.md), then [How to play](docs/HOW_TO_PLAY.md) so you have seen the game, then the [architecture notes](docs/ARCHITECTURE.md) so you know where things live. The [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) is the source of truth for the rules and numbers, and says what is built and what is planned. The plan for the milestone being built is in [docs/M6_PLAN.md](docs/M6_PLAN.md) (and [docs/M7_PLAN.md](docs/M7_PLAN.md) for the one after).

## How a change goes in

1. **Pick something.** Look at the open issues, or the current milestone plan for what comes next. For anything big, open an issue first so we can agree the shape.
2. **Branch.** Work on a short-lived branch and open a pull request. `main` is the latest release and only takes release pull requests. Each milestone is built on its own branch (`feature/0.2.x` for M6, `feature/0.3.x` for M7), and a fix to a released version goes on a patch branch (`hotfix/0.1.x`). Your pull request targets the branch of the work it belongs to. Feature pull requests are squash-merged. [Releasing](docs/RELEASING.md) has the whole branch model.
3. **Keep it focused.** One change per pull request. A bug fix does not need a refactor next to it.
4. **Change the design with the code.** If behaviour changes, update the Game Design Document in the same pull request.
5. **Open the pull request** using the template, and wait for the checks to go green. Cloudflare also builds a preview of your branch, which you can use to try the change in a browser.

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

## Writing

Documents and player text are plain, direct and human: short sentences, active voice, specific examples, no filler. No em dashes (use a comma, colon, full stop or brackets), and an en dash only in a number range. `pnpm docs:style` checks it. `pnpm docs:check` checks the facts a machine can check: links, anchors, file paths and commands. Every release gets a full documentation pass first, which [Releasing](docs/RELEASING.md) describes.

## Characters and names

The game's names, places and cars are fictional or original. Do not add real people's surnames or personal details, or real brands. The name, the logo, Pyra Drake, the two series administrators, the four commentators and the dragon-blooded driver characters belong to Nexxus Drako Multimedia and are reserved, so mods and forks may not use them (see [TRADEMARKS.md](TRADEMARKS.md)).

## Reporting problems and ideas

- A bug or an idea: open an issue with the template (or press Feedback in the game, which opens the same form). For a bug, say what you expected and what happened, and include the game version (Menu, then About) and the career seed if you have it.
- A security problem: do not open a public issue. Follow [SECURITY.md](SECURITY.md).
- Behaviour that is not welcome: see the [code of conduct](CODE_OF_CONDUCT.md).
