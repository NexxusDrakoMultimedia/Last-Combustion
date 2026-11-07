# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Milestone M6, depth: the garage as a business, its people and a calendar to run it on. Saves from 0.1.x still load: the game date moves from where the save left it, morale starts at 50, every garage is given its owners and every computer garage its business when the save opens, and years already played are summed into the ledger.

### Added

- **A calendar.** The game has a date. **Continue**, **+1 day**, **+1 week** and **Next event** in the top bar replace the buttons that ran the next prelims or final: Continue runs what is due today or skips to the next day something needs you, and days and weeks stop early at any event. A Calendar panel lists what is coming. The Run next prelims, Run next final, End the season and Start next season buttons appear in place of Continue on the day each is due.
- **Daily life by the day.** Each day that is not a race day, your cars earn delivery pay (about $167 a car), pick up road wear (40 km) and train their drivers on the roads at home, so skipping days and weeks matters. A season comes to about the same as before.
- **Social occasions on real dates.** The season opening on 31 March, the sponsor dinner, press day and paddock party ten days after the finals of rounds 2, 3 and 4, and the closing ceremony from 11 November. Each stays open for a few days, Continue stops at each, and the Social tab says when the next one is.
- **Tiers and a spot market.** Sponsors and suppliers come in five tiers (local, regional, national, continental, global), with three continental title sponsors and a continental supplier for each of electricity, water, race fuel, travel fuel and logistics. A garage can also buy on the spot market.
- **Outages.** A supplier that is not reliable can fail. A power cut idles part of the crew for a round, a fuel shortage halves the practice laps, and late transport costs the cars their first practice day. The Operations panel shows the chance and warns before a round.
- **Facilities.** Build and upgrade seven facilities in the Operations panel, each from level 1 to 5, paid for at once and with a running cost every round: workshop bays, the dyno and data room, the driver simulator, the tyre and parts store, the solar array, water tanks and the transporter fleet.
- **Executives.** They retire (at 60 to 70) and rivals poach them, and a Chief Executive makes your garage's prestige gains count for up to 25% more.
- **Ownership.** Every garage has a cap table, a valuation, a board and a season target. Raise money in funding rounds (a Seed round, then Series A to D), pay dividends, buy shares back, buy stakes in other garages and bid to take a garage over. Over half the votes means control, a quarter blocks the big decisions, and a vote of no confidence is shown after two missed targets (it has no effect yet). The Ownership panel has Mine, Cap table and Investments views.
- **Computer garages are businesses.** Each has executives (as many roles as its prestige allows), facilities, a sponsor and an electricity supplier, shown on its Registry page. A garage with cash to spare pays half of its profit to its holders each year, and your share is paid into your own cash.
- **The ledger.** The Ledger panel keeps a summary of each financial year (closing on 11 November) for every garage, grouped into racing income, commercial income, race running costs, premises, people and assets, with a year picker, the change on the year before, and a Transactions tab that lists every movement of cash and exports it to a CSV file.
- **People.** Mechanics and executives have a morale from 0 to 100 that moves each season with their pay, the garage's results, its facilities and (for mechanics) the workload, changes their work by up to 5%, and may make an unhappy mechanic leave. The Staff panel has a Contacts tab (everyone the garage has dealt with and what they are to you: a friend, an acquaintance, a rival or an enemy), a Social tab (talk to someone you know or meet someone new at each occasion, in a warm, direct, bold or discreet manner) and a Press tab (six journalists and the four commentators write a headline about the garage after every final, in a tone set by how they see you, and a warm view wins fans while a cold one loses them).
- **The Registry.** A Paddock tab groups people by job, an Ex-Paddock tab lists everyone who has left with the years they were active, and every sponsor, manufacturer, parts supplier and utility supplier has a profile (where it is from, how far its reach goes, how it sees your garage and the shares it holds). Every executive, staff member and shareholder has a profile too.
- **Records.** Almanac rankings of the most fans for drivers, cars, garages and nations, and of the most prestigious garages. Attention flags: when a driver's prelim run beats what their car should manage by a wide margin, the ATTN pennant shows in the results and on the driver's and garage's pages, wins fans and grows the series audience.
- **Names.** Many more names and 43 more nations and cultures, 58 in all (Latin America, Europe, East, South-East and South Asia, the Middle East, Africa and the Pacific), with Australia keeping 60% of the weight and a filter for offensive words.
- A work-of-fiction disclaimer in the About screen, the README and the press kit, and the Last Combustion logo as the header of the start page.

### Changed

- **Ties in a championship** are broken by countback on final places (most wins, then most 2nds, through to most 15th places), then the better average prelim finishing position, then prestige, then valuation, then a draw from the career's seed. This applies to every table.
- **Dividends are paid by themselves.** When the season closes your garage pays the year's dividend (half of the operating profit, within its cash, and nothing after a loss). The Pay button is gone.
- **Missed conversations happen anyway.** When a social occasion ends with talks unspent, they are held at random (a random manner with a random contact, now and then someone new), and the Social tab says you missed them.
- **The press moves your fans whatever it thinks of you.** A journalist who does not know the garage still reports the result: a win wins 60 fans, a podium 30, points 10, and a day with none loses 20.
- **Drake Motorsports, Pyra Drake and her car are not in a new career.** They return with the Founder's career, and as Legends in the Hall of Fame later. A new career still has 96 garages and 313 drivers. Saves made before keep what they have.
- **A garage named for a place is from that place:** its flag and headquarters are there (it still races from an Australian base). A garage with a family name in its name belongs to someone with that name (or, with two, one of them or both, chosen by the seed).
- **People can die outside racing** (a road accident, an illness, a fall, a fire, an accident in the water): drivers, mechanics and executives roll once a year, and each death is in the news. Your own owner is exempt until succession is built.
- **The almanac and results screens** are tidier: the used car market is out of every ranking, titles read "Drivers with the most fans" and "Most prestigious garages", results rows have two lines (entry over garage, car over plate) with the weather and dates of the round, and the Registry no longer repeats prelims and races, which live on the Season panel. The number in a black box is centred.
- **The paddock is more alive.** Every executive, mechanic and shareholder has a flag, a hometown and a residence, and every manufacturer, sponsor and parts supplier a headquarters (82 places in 41 more nations are in the game for them). A shareholder is listed once, with the garage where their stake is worth most (an owner, the garage they own). Computer garages keep a crew of mechanics, one for each car they enter, paid for by their sponsor.
- **A job market.** Mechanics and executives who are let go, quit or whose contract ends go back on the market and stay in the Paddock (listed as looking for work) until they retire: after two full seasons out of work, at retirement age, or by dying. You can hire them again as the same person, and so can the computer garages. Someone poached by a rival has a job, so they are not on the market.
- **Drivers invest.** Drivers who are still racing put half of what they have won into shares of a computer garage. They join the Paddock when they retire, with a profile for their holdings that links back to their racing career.
- The game is fully fictional, with no mapping to real cars or makers. The starting roster is unchanged, at 31 manufacturers and 96 models.
- Generated names are checked for offensive words and infamous people, not against real drivers: a random name may match a real driver's name by chance.
- The Money panel is now the Ledger panel.
- **Better Stack** can now collect usage and errors from the web build, under the same privacy prompt as the other tools (nothing loads until you accept, and the script is never in the page itself), and the Worker's traces and logs go to Better Stack too. The privacy text names it.
- The release site is served by Cloudflare (Workers & Pages) from `main` instead of GitHub Pages, and builds on Cloudflare drop the telemetry keys unless the branch is `main`, so a preview collects nothing.
- Scouting and fog of war, and the story and feedback layer, are planned for 0.3.0, and the 2036 expansion and the career modes move back one milestone each (0.4.0 and 0.5.0). Ratings stay exact until 0.3.0.

### Removed

- The GitHub Pages deploy workflow and its domain file.

## [0.1.2] - 2026-11-06

### Changed

- About a third of new garages (31%) now fly a foreign flag, up from about one in eight, because the share now counts every garage that is not Australian. One foreign garage in ten flies a flag drawn from every flag in the game, not only from the nations we have name lists for. Saves you already have keep the garages they have.
- The logo and brand art are licensed CC BY-SA 4.0 (see the Credits tab); the name and logo stay trademarks.

## [0.1.1] - 2026-11-06

### Changed

- Points always show one decimal place (145.0, not 145), and the Points, Wins and Prize columns are right-aligned in the standings and on the race results screens.
- Race numbers with a gold or silver border now have a thin black outline outside it, and the champion's black box has black digits inside the gold ring.

## [0.1.0] - 2026-11-06

The first release: a playable first season of The Last Combustion of the Petrol Engine, in your browser.

- Start a Garage owner career. Choose your name, your garage's name, flag, Australian base state and colours, then pick a brand-new starter car and one of five unknown driver prospects.
- A world of 96 garages and 313 drivers racing six rounds a season on closed Australian roads: seven days of prelims, then a final, simulated sector by sector. Finish the season and start the next, for as many seasons as you like. Drivers grow and retire, garages open and fold, and contracts and race numbers roll over.
- Cars: buy new from dealers, from the used market and at the auction house, with proxy bidding. Fit upgrade parts under the road-legality score and the tyre-width Equalizer, service them, and fully restore a worn chassis (each restoration costs more and leaves a higher minimum wear). Cars that grow too old without scoring, or are worn out by restorations, retire.
- People: sign, train and develop drivers, hire mechanics and executives, and negotiate with a title sponsor, part makers, car manufacturers and the suppliers of electricity, water, fuel and freight.
- Money: prize money, sponsor fees, merchandise, delivery driving between rounds and running costs, with a ledger of where it went. The Drivers' and Garage Championships each pay $10,000,000.
- Results: full results for every prelim and race, all five championship tables, and season awards.
- The Registry: a profile for every driver, car, garage, prelim and race, with flags, years active, race numbers with gold and silver borders, trophies and shields. Each list is split into champions, race winners, active, retired and obscure entries. Names, plates, numbers and rounds link to each other. Trophies and shields also show in the driver and car headers, and garages show a star for each Garage Championship.
- The Almanac: the champions and awards of every season, and record leaderboards.
- Australian licence plates in each state's own format, and flags beside every driver and garage.
- Save to a browser slot, load it back and export your career as a file.
- An About screen with the credits and this changelog, a Feedback button that opens the issue form on GitHub, and the Roboto typefaces bundled in the game.
- Made for a computer: on a phone or tablet the game says so once, and lets you carry on anyway. The panels are wide enough to read on a tall 1080 by 1920 screen.
- Runs in the browser with no account. Anonymous usage data is collected only if you accept the privacy prompt.

Not in this release: the Junior Series, ownership and the cap table, facilities and outages, scouting, the story and press layers, race calls and the other career modes. See the [Game Design Document](https://github.com/NexxusDrakoMultimedia/Last-Combustion/blob/main/docs/GAME_DESIGN_DOCUMENT.md) for what is built and what is planned.
