# How to play

This guide covers the Garage owner career, the only mode built so far. It follows the game as it stands for the first release. The rules and numbers behind it are in the [Game Design Document](GAME_DESIGN_DOCUMENT.md).

## The idea

It is 2031 and petrol is the rarest thing in the world. A new championship runs six rounds a season on closed Australian public roads, in ordinary road-legal combustion cars. You own a garage with one car and one driver and $250,000. Win races and the money, the sponsors and the fans follow. Run it badly and the money runs out: a garage that does nothing loses about $47,000 a season, so you have roughly five seasons to turn it around.

## Start a career

On the title screen fill in:

- **Your name** and **how you are described**, and your **date of birth** (you must be 18 to 50).
- **Garage name.**
- **Garage flag.** This is where your garage's main factory, founder, owner or executive office is. It does not say where you work.
- **Garage base.** Every garage in the series is based in an Australian state or territory. Your base decides your licence plates, which suppliers serve you and how far you travel to each round.
- **Two livery colours.**

Press **Start career**. You then choose a **starter car** from three used cars and a **starter driver** from five unknown drivers. Look at each car's wear and each driver's stats. The cars and drivers you pass over go to the market and to the free agents, so you can still sign them later. Press **Confirm choice**.

## The screen

- **The top bar** shows your garage and the year, your balance, the next round and one big button for the next step: **Run next prelims**, **Run next final**, **End the season** or **Start next season**. **Feedback** opens the game's issue form on GitHub in a new tab, for bug reports, feature requests and anything else (it needs a free GitHub account). **Menu** has saving, loading, exporting and the About screen.
- **The garage floor** shows each of your entries: race number (with its borders), licence plate, driver, car and the car's condition.
- **The news strip** reports what has just happened.
- **The rail** on the right opens the panels:

| Panel      | What it is for                                                                             |
| ---------- | ------------------------------------------------------------------------------------------ |
| Season     | The calendar, full results of every round (prelims and final) and every championship table |
| Cars       | The cars you own, their wear and value, full restorations, and your entries                |
| Market     | Used cars, new cars from dealers, the auction house                                        |
| Upgrades   | Fitting and servicing parts, and the road-legality score                                   |
| Drivers    | Free agents to sign, driver training, gear, daily life and moving home                     |
| Staff      | Mechanics and executives                                                                   |
| Operations | The suppliers of electricity, water and fuel, and their contracts                          |
| Sponsors   | Your title sponsor                                                                         |
| Almanac    | Champions and awards for every season, and the record book                                 |
| Registry   | A profile for every driver, car, garage, prelim and race                                   |
| Money      | Your cash, income and spending by category                                                 |

Names, licence plates, race numbers, garages and rounds are links almost everywhere. Click one to open its profile in the Registry.

## Your first season

Before the first prelims, in any order:

1. **Sign a title sponsor** in Sponsors. A sponsor pays a season fee, a sixth of it after each round, and a bigger sponsor wants a more famous garage. You name a fee and a length of one to three years, and they accept, counter or walk away. A sponsor that walks away will not talk again that year.
2. **Hire a mechanic** in Staff. A crew cuts part wear and repair bills.
3. **Check your driver and car** in Drivers and Cars. Better free agents may be worth their salary. You can change your entry until the first round starts.
4. **Look at the Upgrades panel.** Parts add power or grip but each one counts against your road-legality score, and a car that fails scrutineering is disqualified.

Then press **Run next prelims**. The prelims run over seven days: every entry sets one timed lap, and the 15 fastest reach the final. Press **Run next final** to race it. The final is simulated sector by sector; there are no race calls in this version.

Points come from the final for the top 15 and from the prelims for 16th to 31st. Prize money goes to the final's finishers. Pole and overtake bonuses add up through the year and are paid when the season ends. Open **Season**, then **Results** or **Standings**, to see every car and every table.

After six rounds, press **End the season**. The champion's prize is paid, the season awards are given out and everything is recorded. Then press **Start next season**: some drivers retire and rookies take their seats, contracts roll over, a few new garages open and a few fold, and the calendar starts again.

## Money

**Coming in:** prize money (the final's top finishers), your title sponsor, merchandise from your fans, delivery driving between rounds (each of your cars earns about $250 a day, more in a busy state), and the champion's prize.

**Going out:** each round, an entry fee, tyres, servicing, travel to the venue, electricity, water and race fuel; wages for mechanics; salaries for executives; driver training; crash repairs. Buying and fitting cars and parts is spending too.

The Money panel breaks it down by category. Suppliers charge the market rate unless you sign a contract in Operations, which fixes the price for one to three years at a discount the supplier agrees to.

## Looking after the car

Every chassis and every part wears. Racing wears a car ten times as fast as road driving, and a worn chassis is slower and breaks down more. In Upgrades you can service parts (cheap, resets part wear). The chassis can only be fixed by a **full restoration** in Cars. It costs as much as a new car, a quarter more each time, removes most of the wear, and leaves a minimum wear that rises with each restoration. Click it twice, because it spends real money. The car keeps its whole history.

## Looking after the driver

- **Training.** Set a level for each driver in Drivers. It is paid at the end of the season and helps them improve and keep their peak longer.
- **Gear.** Suits, helmets and the like boost a driver's stats and wear out. You can have a maker refurbish an item for half its price in proportion to its wear.
- **Daily life.** Between rounds each of your drivers drives their car on everyday and delivery roads, which earns money and slowly trains them on the kind of road around their home. In the off-season you can move a driver's home for $5,000, from the next season.

## Saving

Open **Menu** and press **Save to slot 1**. The save is kept in your browser. **Load slot 1** brings it back. **Export .lcsave file** downloads a save as a file you can keep. A save from an older version of the game loads and is upgraded; a save from a newer version will not load.

## Troubleshooting

- **My save has gone.** Browser saves live in the browser's own storage, so clearing site data deletes them. Export a file now and then.
- **The game is slow to run a round.** Each prelim simulates 313 cars, so give it a moment.
- **A button is greyed out.** Entries and some deals are locked once a season has started, and money-spending buttons are off when you cannot afford them. The tooltip or the panel text says why.
- **A privacy prompt appeared.** The web build asks before it collects anonymous usage data (see the README). Saying no sends nothing.

## What the first release does not have

Only the Garage owner mode, with one save slot and no race calls. There is no Junior Series yet, no ownership or cap table, no facilities, no outages, no story or press layer, and computer garages do not shop around for suppliers. The Game Design Document lists all of it, built and planned.

## Words you will see

- **Almanac:** the book of every season's champions, awards and records.
- **Base:** the Australian place your garage works from. Not the same as its flag.
- **Black box:** the reigning champion's race number sits in a black box.
- **Entry:** one car plus one driver. A garage can have up to eight.
- **Equalizer:** the one technical rule: a car's widest allowed tyre is set by its weight.
- **Final:** the race that ends a round. The 15 fastest of the prelims start it.
- **Gold border:** shown on the number of any driver who has reached a final. **Silver border:** will mark Junior Series points scorers.
- **Headquarters:** where your garage's flag comes from (its factory, founder, owner or executive office).
- **Plate:** every car is identified by its Australian licence plate and the state that issued it.
- **Prelims:** seven days of timed laps before each final. Every entry runs one lap; the fastest start the final.
- **Prestige:** a garage's standing, from its entries, its gold-bordered drivers and its titles. It decides which sponsors, suppliers and executives will deal with you.
- **Registry:** the profiles of everything and everyone in the game, with a tab each for drivers, cars, garages and rounds.
- **Road affinity:** how good a driver is on forest, coast, mountain and night roads.
- **Wear:** from 0 (new) to 100 (worn out), for the chassis and for each part.
