# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0-beta4] - 2026-11-07

A beta of the 0.2.0 release (M6, depth): the fourth slice, ownership and the cap table. Saves from 0.1.x still load; every garage is given its owners, and every computer garage its business, when the save opens.

### Added

- Computer garages are businesses: each has executives (for as many roles as its prestige allows), facilities, a sponsor and an electricity supplier, shown on its Registry page with its executives in the Paddock. Its sponsor covers what they cost, so the economy is unchanged. A garage with cash to spare pays half of its profit to its holders each year, and your share is paid into your own cash.
- Investments: the Ownership panel's new Investments tab shows your own wealth (your own cash from dividends, and the shares you hold in other garages), lets you buy a stake in any other garage from a holder at the price they ask, sell it back, and bid to take a whole garage over between seasons. A bid that wins more than half the votes buys everyone else out at the same price; the garage's cars, running driver contracts, fans and cash become yours and it closes. Saves from earlier versions load with no stakes.
- Control and a board: the Ownership panel says whether you control your garage (over half the votes), who can block the big decisions (a quarter of the votes), and who sits on the board (you, any investor with a tenth of the shares, and an independent chair). Some investors insist on voting shares, which cost you votes, and an investor with a quarter of the votes can refuse new shares. Each season the board sets a target finish in the Garage table; miss it twice running without a majority of the votes and it calls a vote of no confidence (shown, but with no effect yet).
- You can raise money by selling new preferred shares to an investor (a Seed round, then Series A to D, one a year, giving away at most 30% at once), pay a dividend to the holders of your shares (the owner's part goes to your own cash), and buy an outside holder's shares back, either with the garage's cash (the shares are cancelled) or with your own. All of it is in the Ownership panel and the Ledger.
- Ownership: every garage now has a cap table. You own all of your garage's shares from the day you found it; computer garages belong to their founder and family, or have an outside investor, or are partly held by a sponsor or a manufacturer. The new Ownership panel shows who holds what, the garage's valuation (cash, cars, profit, fans, prestige and titles), the price of a share and how the valuation has moved over the seasons. Saves from earlier versions are given their owners when they load.
- The Registry has a Paddock tab with a profile for every executive, staff member and shareholder, linked from the Ownership, Staff and Executives panels.

## [0.2.0-beta3] - 2026-11-07

A beta of the 0.2.0 release (M6, depth): the third slice, the financial ledger (part one). Saves from 0.1.x still load; years already played are summed into the ledger when the save loads.

### Added

- The ledger keeps a summary of each financial year (closing on 11 November, with the season) for every garage, grouped into racing income, commercial income, race running costs, premises, people and assets, with the year's operating result and net cash movement. Years played in earlier versions are summed from the ledger when the save loads. The Money panel is now the Ledger panel, with a year picker and a table of each group and category showing income, spending, net, the change on the year before and its share of the group. Its Transactions tab lists every movement of cash with the cash after it, filters by year, category, round, date and note, and exports the lines to a CSV file.

## [0.2.0-beta2] - 2026-11-07

A beta of the 0.2.0 release (M6, depth): the second slice, garage operations. Saves from 0.1.x still load, and saves from beta1 gain the new sponsors and start with no facilities.

### Added

- Executives now retire (at 60 to 70) and rivals poach them: the better the executive, and the further below the market their pay, the likelier they go each year. The Executives tab says who left and why. A Chief Executive also makes your garage's prestige gains count for up to 25% more.
- Facilities: in the Operations panel you can build and upgrade seven facilities, each from level 1 to 5, paid for at once and with a running cost every round. Workshop bays lift the crew's cover, the data room makes practice breakthroughs likelier, the driver simulator (which needs the data room) boosts training, the parts store cuts part prices, the solar array and water tanks cut those bills (the solar array also keeps the crew working through a power cut), and the transporter fleet cuts the logistics bill and late transport. Saves from earlier versions load with none built.
- Supply outages: a supplier that is not reliable can fail. A power cut idles part of the crew for a round (20% less cover), a fuel shortage halves the practice laps, and late transport costs the cars their first practice day. A garage buying on the spot market (or from a local firm) is hit about one round in ten per supply; a reliable global supplier almost never. The Operations panel shows the chance and warns before a round, and an Operations Director makes outages less likely to run on into a second round.
- A continental tier of sponsors and suppliers, between national and global: three continental title sponsors (prestige 58 to 62) and a continental supplier for each of electricity, water, race fuel, travel fuel and logistics (prestige 40). Careers started in earlier versions gain the new sponsors when they load.

## [0.2.0-beta1] - 2026-11-07

A beta of the 0.2.0 release (M6, depth): the first slice, records and first impressions. Saves from 0.1.x still load.

### Added

- Attention flags: when a driver's prelim run beats what their car should manage by a wide margin (about one or two runs a round), the series' computer flags it with the ATTN pennant, which shows in the prelim results and on the driver's and garage's Registry pages. A flag wins the driver 0.6% of the series audience in fans, and the series audience grows by 0.5% for each flag over the season. The Almanac ranks drivers and garages by attention flags.
- Almanac rankings of the most fans for drivers, cars, garages and nations, and of the highest prestige for garages, as they stand now.
- The Last Combustion logo is the header of the start page.

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
