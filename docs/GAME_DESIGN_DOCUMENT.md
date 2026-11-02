# Last Combustion — Game Design Document

Nov 2, 2026 · @Pyra Drake

## Overview

**Last Combustion** is a racing driver management and car upgrading game about a 2031 racing series for road-legal combustion cars, run on closed Australian public roads. It is loosely inspired by the anime/manga *MF Ghost*; all names and branding are original.

The series' full name is **The Last Combustion of the Petrol Engine World Motorsports Championship**, shortened to *Last Combustion* in everyday use.

The player runs a garage: buying and tuning cars, signing drivers, chasing sponsors, and fighting through a 300+ driver preliminary field to reach the final.

**Design pillars**

- **Driver over horsepower.** The tyre-width Equalizer means smart setup and driver skill beat raw power.
- **Rise from nobody.** Every driver starts in a huge field; a gold border is earned, never bought.
- **Every upgrade is a trade-off.** Parts and weight change your tyre-width limit, your costs and your door sponsors.
- **The car tells the story.** Trophy decals, garage names and supplier logos make a car's history readable at a glance.

## Technical Stack & Architecture

- **Core Technologies:** Coded in TypeScript, Tailwind CSS, React, and Zustand.
- **Database Storage:** Web application using SQLite (via WASM/SQL.js in-browser with persistent local database save states).
- **Desktop/Steam Deployment:** Designed for web execution first, structured for an eventual Steam release using an Electron / Steamworks wrapper.
- **Development Model:** Fully single-player management game.

## Game modes

The game has three career modes, all endless and all starting as an underdog with one cheap road car, a small budget and no prestige.

| Mode | The player is | Controls |
| --- | --- | --- |
| Garage owner | The owner and manager of a garage | Cars, drivers, sponsors, suppliers and race calls for every entry |
| Owner-driver | A garage owner who also races one of its cars | Everything above, plus their own driver's development and career |
| Driver manager | A single driver managing their own career | Their car, contracts with garages, sponsors and their own race calls |

- **Endless play.** Seasons continue past 2036, with drivers ageing and retiring and new generations arriving.
- **Fictional brands.** All cars and manufacturers are fictional, so no licensing is needed.

## Setting

The year is 2031. Combustion cars are still legal and everyday on Australian roads, and every car in the series is a road-legal car its owner actually drives.

- **Road cars, not race cars.** Entries must be registered, road-legal combustion cars. Most are their drivers' daily transport, and some even do delivery driving in them between rounds.
- **Closed public roads.** Rounds run on real Australian roads closed for the event: mountain passes, coastal highways and forest roads.
- **Drone broadcast.** No roadside spectators are permitted, to reduce the risk of spectator casualties. Instead, drones follow the cars around the course, and every run and race is streamed live worldwide over the internet. Overtakes, near misses and comebacks build each driver's fame.

## Safety drones

The same drones that film the series also act as its marshals, warning drivers and calling in rescues.

- **Faster car approaching.** A drone moves into the driver's view and flashes a yellow signal when a faster car is catching them.
- **Course blocked.** If an accident obstructs the course, a drone stops and shows a stop signal to the following car.
- **Rescue.** The drone sends an image of the crashed driver to the operations centre, which dispatches a rescue team.
- **Capability.** The drones are high-performance and fully autonomous, with a top speed of 180 km/h (about 112 mph).
- **Penalties.** Disobeying a drone's signal is penalised.

## Season calendar & Timeline

The season runs annually from **March to October**. It consists of seven rounds on Australian roads, starting in Queensland and moving south to a finale in Tasmania. Every course must be a mountain or road course of at least 10 km; urban street circuits are not allowed.

- **Pyra Drake's Birthday & Season Start:** Pyra was born in 1996, celebrating her 35th birthday in Season 1 (2031) and her 40th birthday in Season 6 (2036). The first day of Round 1 practice and the opening ceremony always takes place on her birthday, **March 31st**.
- **Season Wrap:** The racing season concludes in **mid-October** after Round 7.
- **Closing Ceremony & Festival:** The Closing Ceremony, Awards Gala, and opening day of the week-long **Drake Motorsports International Motoring Festival** in **Healesville, Victoria** (HQ town of Last Combustion and Pyra's hometown) always take place on **November 11th**.

| Rd | Course | State | Character |
| --- | --- | --- | --- |
| 1 | Mount Glorious / Mount Nebo | Qld | Season opener: narrow, bumpy climbs and descents; suits light cars |
| 2 | Oxley Highway, Wauchope–Walcha | NSW | Long, relentless corners; endurance test for drivers and tyres |
| 3 | Royal National Park, Sydney | NSW | Forest and coastal roads just south of the city; run at night |
| 4 | Great Alpine Road, Mount Hotham | Vic | High altitude cuts engine power, so light cars close the gap |
| 5 | Black Spur, Healesville–Narbethong | Vic | Tight, damp forest sweepers; a rhythm test |
| 6 | Great Ocean Road, Lorne–Apollo Bay | Vic | Coastal cliffs, sea spray, changeable weather; tyre management |
| 7 | North-west Tasmania mountain roads, Cethana / Hellyer Gorge | Tas | The finale: technical mountain roads, cold tarmac, big elevation changes |

**Proposed routes**

Each round runs on a loop or an out-and-back course. A preliminary run is **strictly one lap** of the course, and the lap count takes the final past 300 km. Lap lengths are rough estimates that still need measuring on a map.

| Rd | Route | Shape | Lap (approx.) | Final laps |
| --- | --- | --- | --- | --- |
| 1 | Mount Nebo–Goat Track Loop: The Gap, Mt Nebo Road to Mt Nebo, the Goat Track down to Samford Valley, Samford Road back to The Gap | Loop | ~45 km | 7 |
| 2 | Mount Seaview Climb: up the Oxley Highway toward Walcha and back, turning at a closed hairpin | Out-and-back | ~50 km | 6 |
| 3 | Royal National Park Loop: Waterfall, McKell Avenue, Sir Bertram Stevens and Lady Wakehurst Drives to Otford, Princes Highway back to Waterfall | Loop | ~35 km | 9 |
| 4 | Hotham Ascent: Harrietville up the Great Alpine Road to Hotham village and back | Out-and-back | ~60 km | 5 |
| 5 | Black Spur–Reefton Loop: Healesville over the Black Spur to Marysville, the Reefton Spur to Warburton, back to Healesville | Loop | ~130 km | 3 |
| 6 | Otway Loop: Lorne along the Great Ocean Road to Apollo Bay, inland via Skenes Creek, Forrest and Deans Marsh, back to Lorne | Loop | ~110 km | 3 |
| 7 | Cethana Loop: the mountain roads near Sheffield and the Cethana dam; connecting roads to be chosen | Loop | ~40 km | 8 |

## Weekend format & Management Interface

Each round is a 7-day practice week, then 7 days of preliminaries for a field of at least 300 entries, then a final race of at least 300 km for the top 15.

1. **Practice (7 days).** The course opens for practice a week before the prelims, with as many tyre sets as each entry needs. Round 1 Practice Day 1 always opens on **March 31st**.
2. **Preliminaries (7 days).** A prologue-style time attack: each entry gets **exactly one lap**, and that time sets its placing. Entries start one at a time, at set intervals, in a published running order. The order is seeded: drivers with championship points are spread evenly through the order across all seven days, and everyone else is placed by random draw. Seeding uses the current championship standings; Round 1 uses last season's.
3. **Dry and clear only.** Prelim runs are only held in completely dry, non-overcast conditions. A rainy or overcast day becomes an extra practice day and pushes the prelims back a day, so every round gets seven full prelim days. On these gap days, entries may practise on non-racing tyres to save their racing set.
4. **One racing set.** Once the prelims start, each entry gets one racing set for its single prelim lap. A wet day pauses the running order, which resumes on the next dry, clear day.
5. **Prelim classification.** Positions 16–31 score points from their prelim placing. Everyone below 31st scores nothing.
6. **Final race.** The top 15 start the final on a fresh set of race tyres, gridded in prelim order, over a minimum of 300 km, with no pit stops or tyre changes. The final result sets positions 1–15.

**Implementation note:** AI prelim times come from a formula (driver skill, car power and weight, course fit, track temperature roll, random variance). Only the 15-car final is simulated in full.

**Race UI & Simulation View:** Races are presented as a **pure management interface** complete with real-time timing screens (sector splits, delta speeds, tyre life) and an interactive **live map** tracking car locations and drone markers.

**Round timeline (proposed).** A round takes at least 15 days: 7 practice days, 7 prelim days (longer if wet days push them back) and the final race the day after the prelims. With about a week between rounds for repairs and travel, a 7-round season runs roughly 5 months, followed by an off-season for contracts, numbers and car building.

**Round timeline from 2036 (proposed).** The Junior round follows the Super Series final at the same venue: Junior practice day 1 is the day after the Super final, then 3 practice days, 5 prelim days and the Junior final the day after, a 9-day block. A round slot becomes 15 + 9 = 24 days. Seven slots (168 days) plus about 5 days between rounds finish in mid-October, so the season still ends on schedule. Garages with entries in both series keep their crews, trucks and tyre stores at the venue between the two events.

## Points system (Original Era)

The top 31 score each round, from 10 for the win to 0.1 for 31st. The Vanguard (the 15 finalists) takes 90.5 of the 104.5 points available, about 87%. Decimal points are allowed.

**Points by position** (1–15 from the final, 16–31 from the prelims)

| Pos | Pts | Pos | Pts | Pos | Pts | Pos | Pts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | 9 | 5.5 | 17 | 1.5 | 25 | 0.7 |
| 2 | 9 | 10 | 5 | 18 | 1.4 | 26 | 0.6 |
| 3 | 8.5 | 11 | 4.5 | 19 | 1.3 | 27 | 0.5 |
| 4 | 8 | 12 | 4 | 20 | 1.2 | 28 | 0.4 |
| 5 | 7.5 | 13 | 3.5 | 21 | 1.1 | 29 | 0.3 |
| 6 | 7 | 14 | 3 | 22 | 1.0 | 30 | 0.2 |
| 7 | 6.5 | 15 | 2.5 | 23 | 0.9 | 31 | 0.1 |
| 8 | 6 | 16 | 2 | 24 | 0.8 |  |  |

The win is worth a full point more than 2nd. From 2nd to 17th, each place drops by 0.5; from 17th to 31st, each place drops by 0.1.

- **No bonus points.** There are no podium or fastest-run bonuses.
- **Tiebreak.** Most wins, then most 2nds, and so on down the positions, then best prelim time at the final round.

**The top 31 is every competitor's target.** A top-31 finish earns:

- driver's points
- free tyres, and large discounts on other parts
- a reserved place in the assistants' booth (the second booth), a space in the broadcast, team comms and telemetry area. Garages working from it get richer live telemetry (sector splits, tyre life, rivals' pace) and clearer radio to their driver, so their race calls are better informed

## Racing flags

Every driver, car and garage races under a flag. Each of the three has its own flag, so a car can carry a different flag from its driver or its garage.

- **Any nation with a flag emoji.** A flag is any country or territory that has a Unicode flag emoji, stored as its two-letter ISO 3166-1 code (for example `AU`, `JP`, `SE`). The whole set is available from day one.
- **Defaults.** A new driver's flag matches their nationality, a new garage's matches its home country, and a car's matches its manufacturer's home country. The player may change any of these when creating or registering an entry.
- **Changes.** A flag can be changed in the off-season at entry registration. Each change is logged in the record, and a driver or garage that switches flags loses some fame (similar to a number change).
- **Livery.** Flags sit with the panel they belong to: the garage flag beside the garage name on the front quarter panels, the driver's flag beside their trophies on the right rear (driver's side), and the car's flag beside its trophies on the left rear (passenger's side).
- **Timing screens and broadcast.** The flag appears beside the number and name in timing towers, results and broadcast graphics.
- **Records.** The flag a driver, car or garage raced under is recorded for every entry, so history shows which flag took each win.
- **Standings.** Drivers and garages also compete in national standings by flag (see "Standings"). Car flags have no standings.
- **Neutral and disputed flags.** All flags are treated equally in the game, with no political commentary. Territories with a flag emoji are allowed. 
- **Artwork and licensing.** Flag emoji do not render on Windows, so the game draws flags from a bundled image set keyed by ISO code (`flag-icons`), not from emoji text. Every flag asset must come from an open licence (for example SIL Open Font License, CC BY-SA, MIT or Apache 2.0). The chosen set is `lipis/flag-icons` (MIT licence). The licence of each asset set is recorded in `CREDITS.md` and shown in-game, and flag art is kept in its own folder so share-alike terms stay contained. The emoji is used only in text exports.

## Standings

Every series keeps five championship tables, all calculated from the same round results. Each series (Super Series, and from 2036 Junior) has its own set.

| Table | Who competes | How points count |
| --- | --- | --- |
| Driver Championship | Drivers | Each driver's own points. Decides the champion |
| Garage Championship | Garages | Each garage's best two results per round |
| Manufacturer Championship | Car manufacturers | The best two results per round among cars of that make, across all garages |
| Driver nations | Flags (drivers) | The best two driver results per round among drivers racing under that flag |
| Garage nations | Flags (garages) | The best two garage results per round among garages racing under that flag |

- **Flag used.** A driver or garage scores for the flag it raced under in that round, as recorded in its history.
- **Ties.** Same tiebreak as the driver championship: most wins, then most 2nds, and so on, then best prelim time at the final round.
- **Rewards.** The Driver and Garage Championships carry the prize money in this document. Manufacturer and nations titles carry prestige and fame only: the winning manufacturer's cars sell and sponsor better the next season, and a winning flag gives its drivers and garages a small fame boost. No extra prize money.
- **Records.** Titles in every table go into the history and the Hall of Fame.
- **Display.** One Standings screen with a tab for each table, a current-season view and an all-time view.

## Garages and Field Size

- **Season 1 Baseline:** Starts with exactly **96 garages** and **313 drivers**.
- **Roster & Growth:** Drivers may join, retire, or transfer freely during the off-season. There is no hard upper or lower limit to total entries, though the trend leans toward growth.
- **An entry is one car plus one driver.** The entry qualifies, scores points and carries a number. Each one needs its own car, driver, tyre allocation and entry fee.
- **Garage name on every car.** All of a garage's entries carry its name on the front quarter panels.
- **Prestige rating.** It rises with the number of entries and the number of gold-bordered drivers, and unlocks better title sponsors and supplier deals.
- **Shared prelim data.** A garage's entries share grip, line and setup data during the 7-day window, so an entry running earlier in the order can scout the road for the garage's later runners.
- **The cost of size.** Each extra entry adds costs and splits mechanics' time, parts and tyres. Five cars on a small budget make five weak entries.

**Garage rules**

- **Garage Championship:** each garage's best two results per round count.
- **Team orders:** with two or more cars in the final, the garage can order them to hold position, swap places or race freely.
- **Driver roles:** a lead driver gets first pick of new parts; development drivers test upgrades in the prelims first.

## Numbers, borders and liveries

Numbers 1–40 follow last season's rankings and 41 and up are open to anyone, the champion's number is boxed in black, and a gold border marks anyone who has ever reached a final.

**Race numbers & Special Numbers**

- **Numbers 1–40: last season's rankings.** The driver who finished 1st takes #1, 2nd takes #2, and so on down to #40. A ranked driver may turn down their ranking number and apply for one from 41 up instead.
- **Numbers 41 and up: open to anyone.** Any driver may apply for any free number from 41 upward. Numbers are re-chosen each season, and last season's holder gets first refusal.
- **Number #313 (Reserved):** Permanently retired and reserved for founder Pyra Drake.
- **Clashes:** after first refusal, priority goes to gold-bordered drivers first, then more career points, then earliest registration.
- **Black box:** the reigning champion's #1 carries a black box.
- **Fame:** a number builds recognition over time; changing it resets some of that.

**Gold and Silver borders**

- **Gold Border:** Any driver who has qualified for a final, even once, carries a gold border for the rest of their career. Scoring points in 16th–31st does not earn it. Junior Series points scorers carry a silver border instead; a driver who has earned both carries gold. Gold-bordered drivers command higher salaries and more contract leverage.
- **Silver Border & Junior Rule:** Junior Series points scorers carry a silver border. **Mandatory Rule:** Junior drivers who get a silver border MUST finish their junior season, and MUST enter the Super Series the following season.

**Livery placement (enforced by the series)**

| Panel | Carries |
| --- | --- |
| Rear quarter panels | Right rear (driver's side): the driver's own trophies and shields, which follow the driver to any car. Left rear (passenger's side): the car's trophies and shields, which stay with the car. A trophy decal marks a race win and a shield decal a championship: larger gold trophies and shields for the Super Series, silver ones for the Junior Series |
| Front quarter panels | Garage / team name |
| Doors | Aftermarket parts suppliers |

A supplier's logo can only go on the doors if one of its parts is fitted to the car, and that supplier pays a contingency bonus on results. Door space is limited, so choosing suppliers is a money-versus-performance decision.

## Technical regulations

The Equalizer is the series' only real technical rule: a car's maximum tyre width is set by its kerb weight. There are no power limits, no ballast, no budget cap and no success ballast.

```latex
\text{Max tyre width (mm)} = \frac{\text{Kerb weight (kg)}}{5} + 40
```

| Kerb weight | Max tyre width | Width per tonne |
| --- | --- | --- |
| 900 kg | 220 mm | 244 mm |
| 1,000 kg | 240 mm | 240 mm |
| 1,200 kg | 280 mm | 233 mm |
| 1,500 kg | 340 mm | 227 mm |
| 1,800 kg | 400 mm | 222 mm |

- **The trade-off.** Light cars get more tyre width per kilo, so they corner better; heavy, powerful cars keep their straight-line advantage.
- **A maximum, not a fixed size.** Teams may run narrower tyres than their limit.
- **Road legal; everything else is free.** Any registered, road-legal car powered by an internal combustion engine, with any engine, power level, aero or parts, as long as it stays road legal. Electric cars are not allowed. Hybrids may enter only with their kinetic energy-recovery system removed.
- **Scrutineering.** Kerb weight, tyre width and road legality are checked after each run and race. Tyres over the limit mean disqualification.
- **Tyres.** One very resilient all-weather compound for everyone, supplied by Ironbark Tyre Co. and made to the Last Combustion spec. Each set lasts almost exactly one final race distance before it needs replacing. Allocation: unlimited sets in practice, one racing set for the prelim run, and one fresh set for the final race. Non-racing tyres are allowed on wet gap days during the prelims. There are no pit stops or tyre changes, so the race set runs the full final. Hard driving, wheelspin and sliding use up tyre life faster: a driver who overdrives can lose grip in the final kilometres, while a smooth driver keeps it to the flag.
- **Sporting penalties.** Time penalties for causing contact or cutting the course.

**Changing cars.** An entry may switch cars during the season, but only to another car from the same manufacturer it started the season with.

**Design note:** at +40 mm, a 900 kg car gets about 10% more tyre width per tonne than an 1,800 kg car. That is the light car's cornering edge.

## Cars and upgrades

Every upgrade changes some mix of power, weight, handling, cost and road legality, and the Equalizer turns weight into a tyre-width trade-off.

| Category | Main effect | Trade-off |
| --- | --- | --- |
| Engine internals and tuning | More power | Cost; reliability |
| Intake and exhaust | More power | Noise limits can threaten road legality |
| Forced induction | Large power gain | Weight, heat, cost |
| Engine management (ECU) | Power and throttle response | Needs a tune for each change |
| Drivetrain | Traction and gearing for the course | Cost; heavier diffs add weight |
| Suspension | Handling, ride on bumpy roads | Too stiff hurts on rough courses |
| Brakes | Shorter braking, less fade on descents | Weight; cost |
| Weight reduction | Better cornering and braking | Narrower legal tyres under the Equalizer |
| Aero | Grip at speed | Drag; road-legality limits |
| Wheels and tyre width | Grip, up to the Equalizer limit | Wider is heavier and costs straight-line speed |

- **Course setups.** Gearing, suspension and tyre width can be changed between rounds to suit each course.
- **Road legality.** Every part has a legality rating. A car that stops being road legal fails scrutineering and can't be driven home.
- **Suppliers.** Every part comes from a supplier. Fitting it earns that supplier a door spot and its contingency bonus.
- **Wear.** Parts wear with race and road distance and need servicing or replacing.

## Founders, Special Vehicles, and Ghost Record

- **Pyra Drake:** Founder and chairwoman of Last Combustion. Born in **1996**, she celebrates her **35th birthday** in Season 1 (2031) and her **40th birthday** in Season 6 (2036). The opening ceremony and Round 1 practice always take place on her birthday, **March 31st**. She is a self-insert character and one of the best drivers in history, but does not actively race in LC main events. Her role is setting the first-ever course records, and her number **#313** is permanently retired.
- **Drake Motorsports:** Pyra Drake's personal team where she is founder and owner, with her unique vehicle being a fictional Mazda RX-7 expy called the **Homura Spirit R-7** (rotary-powered lightweight sports car).
- **Healesville HQ & Motoring Festival:** Healesville, Victoria is Pyra Drake's hometown and the global headquarters of Last Combustion. Every year on **November 11th**, Healesville hosts the Last Combustion Closing Ceremony and Awards Gala, kicking off the week-long **Drake Motorsports International Motoring Festival**.
- **Ghost Record:** Before every prelim session, a giant version of the series drones hovers over the course to project a ghost car. Each driver picks their ghost from six cars at the start of their own run: one of the top 5 drivers from last year's main series, or Pyra Drake's #313 Homura Spirit R-7 from the course's demo runs. 
  - **Easy.** The ghost runs at the driver's own pace, always staying 2 seconds ahead, giving hints and assistance.
  - **Hard.** The ghost faithfully recreates the original driver's qualifying run.

## Attention flags

Every car's driving data is streamed by telemetry to the central computer at Last Combustion headquarters. The AI there flags drivers it judges to have superior skill, and alerts both the broadcast and every garage's comms room.

- **Trigger.** The AI compares live sector times against a predicted pace for each car, based on its power, weight, tyre width and the conditions. A driver whose pace beats that prediction by at least 2.5 standard deviations (measured across the field) gets flagged. That should mean a flag only once or twice per round.
- **When.** Flags can fire during prelim runs and during the final race.
- **Broadcast.** Flagged cars get priority on the main broadcast feed, with an on-screen marker and drones switched to follow them. The criteria are strict, so it is rare.
- **Comms rooms.** Every garage is alerted, not just the driver's own.
- **Effects.** A flag boosts fame and draws sponsor and supplier interest. Rival garages notice too, so a flagged driver may get contract offers from them.
- **Scouting.** Flags on other garages' drivers are leads for the player, especially drivers who don't have a gold border yet.

**Crash highlights.** The prelim field is a mixed bag, and some viewers tune in to watch less-skilled drivers crash expensive cars spectacularly. Big crashes make the highlight reels: they raise a driver's fame as notoriety but cost reputation, on top of the repair bill.

## Simulation model

Races are simulated sector by sector from course, car and driver data; the player directs strategy rather than steering.

- **Course data.** Each course is split into sectors, each tagged with a road type (forest, coast, alpine, night), corner density, elevation change, straight length, road width and overtaking spots.
- **Prelim runs.** Each sector time comes from the car's fit to that sector (power, weight, tyre width, setup), the driver's pace and road affinity, track temperature, and random variance that shrinks with consistency.
- **Final race.** Simulated lap by lap and sector by sector. A faster car overtakes when its margin beats the defender's racecraft and the road width allows it.
- **Tyre life.** Each sector uses tyre life based on driving style and tyre management. Near the end of the set, grip drops.
- **Incidents.** Mistakes become more likely when pushing, on worn tyres, in the wet, or with low composure. A crash brings damage, a drone stop signal and possibly retirement.
- **Player calls.** Push, balanced or conserve for each driver; attack or defend; team orders between a garage's cars.
- **Attention flags.** Each sector's gap to predicted pace is compared across the field:

```latex
z = \frac{(t_{predicted} - t_{actual}) - \mu}{\sigma} \qquad \text{flag if } z \geq 2.5
```

Here μ and σ are the mean and standard deviation of that gap across all drivers on the same course.

## Core gameplay loop and progression

Each round, the player prepares in the garage, fights through the prelims, races the final if they make the top 15, and banks the rewards before the next round.

**Progression has two tracks:**

- **Drivers:** unknown with a fresh number → first points (top 31) → gold border (first final) → race wins and trophy decals → champion, with #1 and its black box.
- **Garages:** a single entry → more entries and gold-bordered drivers → higher prestige, better sponsors and suppliers → a multi-car operation contending for the Garage Championship.

## Drivers

Every driver has hidden potential and visible stats that grow with experience, and a career that runs from rookie to retirement.

| Stat | What it does |
| --- | --- |
| Pace | Raw speed over a lap |
| Consistency | How close each run is to the driver's best |
| Racecraft | Overtaking and defending in the final |
| Tyre management | How much grip is left at the end of 300 km |
| Composure | Performance under pressure and on the main feed |
| Wet skill | Pace in rain during the final |
| Road affinity | Separate ratings for forest, coast, alpine and night roads |
| Potential | Hidden ceiling for growth |

- **Profile.** Age, nationality, number, fame, reputation, contract and salary.
- **Growth and decline.** Stats rise with experience on each kind of road and fall slowly with age.
- **Contracts.** Length, salary, lead or development role, and a release fee. Rival garages can make offers, especially after attention flags.
- **Junior pathway.** Junior drivers who reach a Super Series final earn gold and leave Junior eligibility.

## Sponsors and suppliers

Sponsors pay for exposure and suppliers pay for results, and both scale with a garage's prestige and its drivers' fame.

- **Title sponsor.** One per garage. Pays a season fee, with bonuses for finals and wins. Bigger sponsors need higher prestige.
- **Door suppliers.** Only suppliers whose parts are fitted. Each pays contingency bonuses on results, and offers discounts on its parts.
- **Deal terms.** Length, payments, performance targets, and penalties for missing targets or dropping a supplier's part.
- **Fame link.** Famous drivers and numbers bring better offers.

## Negotiations

Drivers, garages, sponsors, manufacturers and suppliers all negotiate with each other, and the same system handles every deal. The player negotiates for their garage, or for their driver in Driver manager mode. AI parties negotiate between themselves with the same rules.

**Who negotiates what**

| Between | Terms |
| --- | --- |
| Driver and garage | Salary, length, lead or development role, release fee, bonuses, right to match rival offers |
| Garage and sponsor | Season fee, length, performance targets, bonuses, penalties, exclusivity, title-sponsor status |
| Garage and manufacturer | Car prices, discounts, factory parts and engineer support, loyalty bonus, which models the garage may switch to |
| Garage and supplier | Part discounts, contingency bonuses, door spot, exclusivity per part category, supply priority |
| Driver and sponsor | Personal sponsorship pay and length (important in Driver manager mode) |
| Driver and manufacturer | Factory-driver and brand-ambassador deals: pay and car use |
| Manufacturer and supplier | AI-only partnerships that decide which suppliers a manufacturer's cars use and which door logos suit them |

**How a negotiation works**

1. **Opening.** One side makes an offer on a set of terms. The player sets terms with sliders and toggles, and a value meter shows how the other side is likely to react.
2. **Response.** The other side accepts, counters, or walks away.
3. **Counters.** Each party has a patience of 3 counters. A lowball offer costs patience, and a party that runs out of patience walks away and will not negotiate again for the rest of the window.
4. **Valuation.** Each party has a hidden reservation value, the least it will accept, worked out from its needs and its leverage. An offer is accepted when its total value is at least that reservation. Every term has a cash-equivalent value, so a party can accept a lower salary for a longer contract or higher bonuses.
5. **Leverage.**
   - Drivers: reputation, fame, gold border, results and flag.
   - Garages: prestige, results, budget and the quality of their cars.
   - Sponsors: the exposure they want, shown by fame and broadcast time.
   - Manufacturers: standing in the Manufacturer Championship and how many of their cars race.
   - Suppliers: how many cars on the grid use their parts.
6. **Relationship.** Each pair has a score from -100 to +100, built up by kept deals, paid bonuses, loyalty and broken contracts. It changes patience and moves reservations by up to ±10%.
7. **Competing offers.** Rival interest, for example after an attention flag, raises a party's reservation by up to 20%. The current partner may have a right to match a rival's offer, which the player can pay for as a term.
8. **Information.** Reservations are hidden. The player sees a range that narrows with relationship, scouting and past deals.
9. **Fixed limits.** Negotiation cannot override the rules: the reserved #313, the Equalizer, door-space limits, the same-manufacturer car-switching rule and legality ratings.

**When deals happen**

- **Off-season (Nov 11 – Feb 28).** The main window. Contracts and deals expire at season end and every party negotiates.
- **During the season.** Sponsors, suppliers and manufacturer supply can be negotiated at any time. A driver can be moved only by paying the release fee. Leaving a deal early triggers its penalties.
- **AI deals.** Between AI parties, deals are resolved in batches with the same valuation, in descending order of prestige, and they produce headlines.

**Screen.** The Negotiation screen shows the term list, the value meter, the other side's mood and patience, the history of offers and the relationship score, with one-click acceptance of a counter.

## Career and economy systems

Prize money and sponsors fund the garage, while fame, reputation, rivalries and the media turn results into stories.

- **Prize money.** Each round pays prize money to the 15 finalists, weighted heavily to the win (table below). Placings outside the final earn no prize money. The season champion, decided on points, wins a $10,000,000 championship prize, and performance bonuses build up through the year. Prize money and sponsors are a garage's main income.
- **Fame and reputation.** Two separate ratings. Fame is popularity with fans, built from broadcast moments, attention flags and overtakes. Reputation is respect in the paddock, built from consistent results and clean racing. Sponsors chase fame; top garages hire on reputation.
- **Driver development.** Drivers have stats that grow with experience on each kind of road: forest, coast, alpine and night. A driver can be brilliant on mountain roads and weak on coastal ones.
- **Rivalries.** Repeated close finishes or contact between two drivers create a rivalry. Rivals racing each other draw extra broadcast attention and fame.
- **Awards.** Rookie of the Year, most attention flags in a season, and a Hall of Fame for retired champions.
- **Damage and repairs.** Crashes cost money and time. Entries are road cars, so a car that can't be repaired can't be driven on the road either.
- **Daily life.** Road distance between rounds adds wear to the car. Delivery driving gives a small income, which helps drivers early in their careers.
- **Commentary and media.** A commentary team and news headlines between rounds, generated from the records (for example, "#247 reaches their first final").

**Final race prize money (AUD)**

| Pos | Prize | Pos | Prize | Pos | Prize |
| --- | --- | --- | --- | --- | --- |
| 1 | $1,000,000 | 6 | $150,000 | 11 | $60,000 |
| 2 | $500,000 | 7 | $100,000 | 12 | $50,000 |
| 3 | $300,000 | 8 | $90,000 | 13 | $40,000 |
| 4 | $250,000 | 9 | $80,000 | 14 | $30,000 |
| 5 | $200,000 | 10 | $70,000 | 15 | $20,000 |

**Season prizes and bonuses (AUD)**

| Award | Amount |
| --- | --- |
| Season champion | $10,000,000 |
| Pole position (fastest prelim run) | $10,000 each time |
| Overtake in the final race | $10,000 each |

Bonuses add up through the year and are paid at the end of the season. All AUD amounts are the reference yen figures divided by 100.

## 2036 expansion

In 2036 the main championship grows and is rebranded, alongside the launch of a junior series.

- **Rebrand.** The main championship becomes **The Last Combustion of the Petrol Engine World Motorsports Super Series Championship (Last Combustion Super Series)**.
- **Bigger final.** The final grows from 15 to 20 cars. Positions 1–20 score from the final, and 21–31 from the prelims.
- **Bigger prize.** Prize money for 1st–15th rises by half and now extends to 20th (table below). The season champion's prize rises to $15,000,000; pole and overtake bonuses rise to $15,000 each.

**Super Series final prize money from 2036 (AUD)**

| Pos | Prize | Pos | Prize | Pos | Prize | Pos | Prize |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | $1,500,000 | 6 | $225,000 | 11 | $90,000 | 16 | $25,000 |
| 2 | $750,000 | 7 | $150,000 | 12 | $75,000 | 17 | $20,000 |
| 3 | $375,000 | 8 | $135,000 | 13 | $60,000 | 18 | $15,000 |
| 4 | $300,000 | 9 | $120,000 | 14 | $45,000 | 19 | $12,500 |
| 5 | $225,000 | 10 | $105,000 | 15 | $30,000 | 20 | $10,000 |

## Last Combustion Junior

In 2036 the series adds a junior championship: **The Last Combustion of the Petrol Engine World Motorsports Junior Series Championship**, known as *Last Combustion Junior*.

- **Purpose.** A championship for young drivers who have never reached a main-series final.
- **Eligibility.** Drivers must be 25 or younger and must never have qualified for a main-series final.
- **Power cap.** Cars may produce no more than 300 PS. A car that makes more as standard can be fitted with an intake restrictor that limits it to 300 PS. A car found over 300 PS is disqualified from the prelims. The Equalizer tyre-width rule still applies.
- **Format.** Practice is condensed to 3 days (proposed) and prelims from 7 days to 5, and the top 15 race the final the day after the prelims.
- **Schedule.** Each Junior round runs at the same venue straight after the Super Series round: Junior practice day 1 is the day after the Super final race. The same dry-and-clear rule applies to Junior prelims.
- **Points and perks.** Junior uses the original 2031 points table: the top 31 score points, with the top 15 scoring from the final. Any points scorer gets free tyres, a reserved place in the assistants' booth and a silver-outlined number.
- **Prizes.** Junior uses the original 2031 prize money: finalists earn $1,000,000 down to $20,000 by position. The Junior champion, decided on points, wins $10,000,000. Pole and overtake bonuses of $10,000 each build up through the year and are paid at season end.
- **Numbers.** Junior cars carry a "J" beside their door number, to set them apart from main-series cars.
- **Mandatory Promotion:** Junior drivers who earn a silver border MUST complete their junior season, then MUST enter the Super Series the following season.
- **Shared garages.** Junior and Super entries belong to the same garages. One garage record runs entries in both series, and Junior entries use the garage's own name, flag and livery with the Junior "J" marking.
  - **Costs and mechanics.** Each Junior entry pays its own entry fee, tyres and mechanic time, drawn from the same budget and workforce.
  - **Prestige.** Junior entries count toward a garage's prestige at half the weight of a Super Series entry.
  - **Standings.** Each series keeps separate standings (see "Standings"); team orders apply only within a series.
  - **Promotion.** A Junior driver who must move up can be kept by the same garage or released to another.

## Records and history

The game keeps a permanent, detailed history of every race, driver, garage and car, so any career can be looked back on in full.

| Record | What is kept |
| --- | --- |
| Race (each round) | Course, dates, conditions on every day, wet-day delays, running order, every prelim time, final grid and result, gaps, tyre condition at the flag, attention flags, penalties and incidents |
| Driver | Every entry and result, numbers held each season, garages driven for, cars driven, points by round and season, finals reached, wins, titles, date the gold border was earned, attention flags, contracts and salary history |
| Garage | Founding date, entries each season, drivers signed and released, cars owned, Garage Championship results, prestige over time, sponsors and suppliers, prize money earned |
| Car | Its own identity (chassis number), make and model, owners and garages, drivers, kerb weight and tyre width at each round, parts and suppliers fitted at each round, door logos, trophy decals, results, odometer including everyday road use |

- **Leaderboards** are built from these records: season standings (drivers, garages, manufacturers and nations), course records for the fastest prelim run and race, and all-time tables (wins, titles, finals, points).
- **Car histories follow the car.** A car sold to another garage keeps its left-rear decals and its full record, so a famous chassis carries its story with it. The driver's right-rear decals go with the driver.

## Super Series points from 2036 (proposed)

The 2036 final has 20 cars, so the points table needs extending. Positions 1–15 keep their original values, so records stay comparable across eras.

| Pos | Pts | Pos | Pts | Pos | Pts |
| --- | --- | --- | --- | --- | --- |
| 16 | 2.0 | 22 | 1.0 | 27 | 0.5 |
| 17 | 1.8 | 23 | 0.9 | 28 | 0.4 |
| 18 | 1.6 | 24 | 0.8 | 29 | 0.3 |
| 19 | 1.4 | 25 | 0.7 | 30 | 0.2 |
| 20 | 1.2 | 26 | 0.6 | 31 | 0.1 |
| 21 | 1.1 |  |  |  |  |

Positions 1–20 score from the final and 21–31 from the prelims. Total available per round: 105.1 points. The gold border rule is unchanged: reaching the final (now top 20) earns it.

---

# Development Specification

Everything below turns the design above into buildable detail. Numbers marked **(tunable)** are starting values to be balanced in playtesting; they live in data files, not code.

## Scope and build order

The full design is large, so development is staged. Each milestone must be playable end to end before the next begins.

| Milestone | Goal | Includes | Excludes |
| --- | --- | --- | --- |
| M0 Foundations | Project runs, saves and loads | Vite + React + TS + Tailwind + Zustand scaffold, SQL.js database, migrations, seeded RNG, save/load, externalised text (`/locales/en.json`), CI (lint, typecheck, unit tests) | Any gameplay |
| M1 World generation | A believable 2031 field | Names, 96 garages, 313 drivers, 313 cars, numbers, contracts, calendar | UI beyond a debug viewer |
| M2 Prelim simulation | One round's prelims resolve | Course sector data (Rd 1), lap-time model, 7-day running order, weather days, classification, points | Final race, economy |
| M3 Final race | A full 15-car final | Lap-by-lap sim, tyre life, incidents, overtakes, player calls, prize money, timing screens | Live map polish, drones |
| M4 Garage and economy | The management loop | Car purchase, upgrades, legality, the negotiation system (drivers, garages, sponsors, manufacturers, suppliers), finances, repairs | Rivalries, media |
| M5 Full season (**vertical slice**) | Seven rounds, off-season, rollover to 2032 | All 7 courses, season end, awards, retirements and new entrants, records | 2036 expansion, Junior |
| M6 Depth | Story and feedback | Attention flags, ghost record, crash highlights, rivalries, media headlines, drone events, live map | |
| M7 2036 expansion | The era change | Super Series rebrand, 20-car final, Junior Series, mandatory promotion | |
| M8 Modes and release | All three career modes, polish | Owner-driver, driver manager, tutorial, audio, Electron/Steam wrapper, Steam achievements and cloud saves, mod loader and Steam Workshop integration, the hidden Founder's career | |

**MVP definition (M5):** a player in Garage owner mode can start a career, buy and upgrade a car, sign a driver, race seven rounds, finish the season, and begin 2032 with all records saved.

## Technical architecture

**Layers**

- **Data layer.** SQLite (SQL.js) is the single source of truth. The database file is persisted to IndexedDB. Content (courses, parts, car models, manufacturers, starting garages and drivers, name pools) ships as versioned JSON in `/data` and is loaded into the database when a new career starts. Mods use the same files and schemas (see "Modding").
- **Simulation layer.** Pure TypeScript with no React or browser imports, so it can be unit-tested in Node and run inside a Web Worker. Entry points: `generateWorld(seed)`, `advanceDay(state)`, `runPrelimDay(state)`, `runFinal(state, calls)`.
- **State layer.** Zustand stores hold UI state and a cached read-model of the current career. Stores never own game truth; they query the database through a repository module and refresh after each simulated step.
- **UI layer.** React + Tailwind. Screens are routed (see "Screens and flow").

**Rules**

- **Deterministic simulation.** Every career has a master seed. Each random draw uses a named stream (`prelim:2031:R3:day4`, `final:2031:R3`, `worldgen`) derived from the master seed, so a save replays identically and bugs can be reproduced.
- **Worker execution.** Prelim days and finals run in a Web Worker and post progress messages, so the UI never freezes while simulating 300+ entries.
- **Save slots.** Three manual slots plus an autosave taken at the start of each round week, before the final, and at season end. Saves carry a schema version; migrations run on load.
- **Externalised text.** The game is English-only, but no player-facing string is written in code. See "Localisation".
- **Data-driven balance.** All coefficients in the formulas below live in `/data/balance.json`.
- **Testing.** Unit tests for the Equalizer, points, tiebreaks, number clashes, border rules and formulas. Property tests that a generated world is always valid (unique numbers, no driver in two garages, every entry has a legal car). A headless "sim 10 seasons" script reports balance statistics.

**Suggested folder layout**

```
/data          courses.json, manufacturers.json, car_models.json, parts.json, garages.json, drivers.json, balance.json, names.json
/locales       en.json (all player-facing text)
/mods          installed mods (one folder each)
/src/sim       rng.ts, worldgen.ts, prelim.ts, final.ts, tyres.ts, incidents.ts, flags.ts
/src/db        schema.sql, migrations/, repo/ (one module per table group)
/src/state     career.store.ts, ui.store.ts
/src/ui        screens/, components/
/src/workers   sim.worker.ts
/tests         sim/, db/
```

## Data model

Core tables (SQLite). Every table has an integer primary key `id`; foreign keys are named `<table>_id`. Dates are ISO strings in game time.

| Table | Key fields |
| --- | --- |
| `career` | mode, master_seed, start_year, current_date, player_garage_id, player_driver_id (nullable), difficulty, founder_career (bool), schema_version |
| `career_mod` | career_id, mod_id, version, load_order |
| `standing_snapshot` | season_id, series, table (`driver` / `garage` / `manufacturer` / `driver_nation` / `garage_nation`), subject_id, after_round, points, position |
| `season` | year, era (`original` / `super`), final_size, status |
| `round` | season_id, number, course_id, practice_start, prelim_start, final_date, status, weather_log (JSON per day) |
| `course` | name, state, shape (`loop` / `out_and_back`), lap_km, final_laps, road_type, altitude_m, night (bool) |
| `sector` | course_id, order, length_m, corner_density, elevation_change_m, straight_m, width_m, overtake_spot (bool) |
| `flag_history` | subject_type (`driver` / `car` / `garage`), subject_id, season_id, flag (ISO code) |
| `garage` | name, home_state, flag, primary_colour, secondary_colour, prestige, cash, founded_year, is_player, ai_profile |
| `driver` | name, gender, birth_date, nationality, flag, stats (columns for each stat), potential, fame, reputation, gold_border_year, silver_border_year, retired_year |
| `driver_road_affinity` | driver_id, road_type, rating |
| `contract` | driver_id, garage_id, start_year, end_year, salary, role (`lead` / `development`), release_fee |
| `manufacturer` | stable_id, name, home_country, type, character, prestige_multiplier |
| `car_model` | manufacturer_id, stable_id, name, base_kerb_kg, base_ps, drivetrain, price_new, legality_base |
| `car` | car_model_id, chassis_no, flag, garage_id, odometer_km, condition, kerb_kg_current |
| `part` | supplier_id, category, name, price, delta_ps, delta_kg, delta_grip, delta_handling, delta_reliability, legality_cost |
| `car_part` | car_id, part_id, installed_date, wear |
| `entry` | season_id, garage_id, driver_id, car_id, race_number, series (`main` / `junior`), fee_paid |
| `result` | round_id, entry_id, prelim_time_ms, prelim_pos, final_pos, final_time_ms, points, prize, dnf_reason, tyre_pct_at_flag |
| `event_log` | round_id, timestamp, type (flag, crash, penalty, overtake, rivalry), payload JSON |
| `sponsor`, `sponsor_deal` | tier, min_prestige, base_fee, bonuses; garage_id, years, targets |
| `supplier`, `supplier_deal` | brand, categories, discount, contingency; garage_id, car_id |
| `trophy` | owner_type (`driver` / `car`), owner_id, kind (`win` / `title`), series, round_id / season_id |
| `negotiation` | window, party_a_type, party_a_id, party_b_type, party_b_id, kind, status, patience_left |
| `offer` | negotiation_id, round, from_side, terms (JSON), value, outcome |
| `relationship` | party_a_type, party_a_id, party_b_type, party_b_id, score |
| `ledger` | garage_id, date, category, amount, note |
| `headline` | date, text, driver_id / garage_id (nullable) |

Records described in "Records and history" are all derivable from these tables; nothing is deleted when a driver retires or a garage folds.

## Starting conditions (proposed, tunable)

| Item | Garage owner | Owner-driver | Driver manager |
| --- | --- | --- | --- |
| Cash | $250,000 | $200,000 | $60,000 |
| Garage | 1 entry-capable garage, 2 mechanics | Just the player: no hired driver or staff, and the player does basic maintenance | None; contracted to a garage |
| Car | One cheap road car (player picks from 3 starters) | Exactly one car, the player's own starter | Same, owned personally |
| Driver | One unknown driver (player picks from 5 offered) | The player's own driver, built at creation | The player's driver |
| Prestige | 1 (of 100) | 1 | n/a |
| Race number | Open number ≥ 41, random if not chosen | Same | Same |
| Sponsor | None; first small offer in week 1 | Same | None |

**Driver creation (Owner-driver and Driver manager).** Spend 100 points across Pace, Consistency, Racecraft, Tyre management, Composure and Wet skill (min 20, max 60 each at start). Pick a gender, a date of birth that makes the driver 18 to 30 at the start, a home road type (+10 affinity), a name, flag and race number, and (for owners) the garage name, flag and two livery colours. Potential is hidden.

**Owner-driver growth.** The Owner-driver starts solo with one car and one entry, which is the player. The first hired mechanic, second car and second driver are unlocked by earnings and prestige, in the same way as in Garage owner mode.

**Difficulty presets** change only starting cash, sponsor generosity, repair costs and AI aggression: Relaxed (+50% cash), Standard, Hard (-30% cash, +25% costs).

## Hidden Founder's career (Easter egg)

A player can race as Pyra Drake by entering her exact details in Owner-driver setup. Nothing in the game, tutorial, store page or marketing mentions it.

**Unlock details.** All of these must match at once:

| Field | Value |
| --- | --- |
| Mode | Owner-driver |
| Driver name | Pyra Drake |
| Gender | Female |
| Date of birth | 31 March 1996 |
| Race number | 313 |
| Garage name | Drake Motorsports |
| Driver flag | Australia (`AU`) |
| Garage flag | Australia (`AU`) |
| Livery colours | Primary `#7f0000`, secondary `#ffd900` |

**How it behaves**

- **No hints.** The setup screen treats every field normally. Number 313 and an age of 35 are rejected as usual when the rest does not match, with the standard messages. The Founder's career starts only when the player confirms and every field matches. Name and garage match ignoring case and surrounding spaces.
- **Overrides.** The #313 reservation and the 18–30 age rule are lifted for this career only. In this world #313 belongs to the player and the NPC founder is replaced, so there is never a second Pyra Drake.
- **Starting package (proposed, tunable).** Elite preset stats (Pace 90, Consistency 85, Racecraft 85, Tyre management 85, Composure 85, Wet skill 80, all road affinities 80), high fame and reputation, and her Homura Spirit R-7 as the garage's one car. Cash, staff and sponsors are the normal Owner-driver start, so the rise from nothing is still earned.
- **Timeline.** She is 35 in 2031, 40 in 2036 and ages and retires like any driver.
- **Ghost record.** The founder's demo runs still exist as the #313 ghost option, so the player can race against her demo laps.
- **Achievements.** All achievements are disabled in the Founder's career. Starting it unlocks one hidden achievement of its own, "Founder's Birthday", once per account.
- **Canon.** The save is marked `founder_career` and is outside the main story (in the standard world, Pyra Drake does not race main events). It is stored and displayed like any other save.

## Modding (Steam Workshop)

The game is data-driven, so mods are packages of the same JSON and SVG files the base game uses, with no scripting.

**What can be modded**

| Area | What a mod can change or add |
| --- | --- |
| Starting garages | Garage names, flags, colours, prestige, home states and which entries they start with |
| Drivers | Names, flags, ages, stats, potential, numbers and starting contracts |
| Name lists | Driver first and last names (by nationality) and garage name pools |
| Manufacturers | New or replacement manufacturers, with home country, type and character |
| Cars | New or replacement car models: kerb weight, power, drivetrain, price tier, body-shape SVG and livery slots |
| Tracks | New or replacement courses: route, sectors, road type, climate profile, vector map path |
| Parts | New or replacement parts and their stats, prices and legality ratings |
| Sponsors | New or replacement sponsors, their tiers, fees, targets and personalities |
| Suppliers | New or replacement suppliers, categories, discounts and contingency terms |
| Balance data | Coefficients in `balance.json`, such as the cost baseline and formula weights |

**Package format.** A mod is a folder with `mod.json` (id, name, version, author, supported game versions, dependencies, load-order hint, list of the areas it touches), `data/` for the JSON files, `art/` for SVGs and `text/en.json` for any new text keys. The real-counterpart reference mapping is optional (`mod_mapping.json`, see "Fictional manufacturers and cars").

**Rules**

- **Stable IDs.** Everything a mod adds has a stable ID with the mod's prefix. Replacing a base item uses the base item's ID.
- **Load order.** Mods load in order and the last to change an item wins. A conflict report names every override.
- **Validation.** On load, each mod's files are checked against the schemas and rules, and invalid mods are rejected with an explanation: unique IDs and numbers, legal Equalizer values, 10 km minimum course length, sector sums, flags that exist, name lists that are not empty, no use of the reserved #313.
- **Balance mods.** A mod that changes balance data is labelled in the save and its records are kept apart from default-world records.
- **Safety.** Data only: no code, and SVGs are sanitised to remove scripts and external references.
- **World generation with mods.** A starting garage or driver mod supplies part of the field and world generation fills the rest to 96 garages and 313 drivers, unless the mod declares a full replacement of the starting field.
- **Calendar with mods.** A track mod can replace any of the seven rounds at career creation. A course's final laps are calculated automatically so the final is at least 300 km.
- **Saves.** A career records the mods used, with their versions, and mods are fixed when the career is created. A missing or changed mod warns before loading. Modded careers are labelled, and their records are not mixed into default-world records.
- **Steam Workshop.** Mods are published, subscribed to and updated through Steamworks in the desktop build. The web build installs mods from local files.

## Achievements and cloud saves

- **Achievements.** Steam achievements are enabled in the desktop build, awarded for milestones such as first points, first final, gold border, first win, a season title, a Garage, Manufacturer or nations title, a Hall of Fame entry, a 10-season career and a rivalry. They are tracked from the event log. The web build keeps a local list.
- **Founder's career.** All achievements are disabled for that save. Starting it unlocks one secret achievement, "Founder's Birthday", and nothing else.
- **Cloud saves.** Steam Cloud syncs saves. Each save is one `.lcsave` file containing the database, its schema version, the mod list and a preview. On a sync conflict the newer file wins and the older one is kept as a backup copy that the player can restore. The web build stores saves in the browser and can export and import `.lcsave` files.

## Localisation

The game is English-only at launch, but all text is externalised so translation can be added later.

- **No hard-coded strings.** All player-facing text lives in `/locales/en.json` under stable keys (for example `garage.hub.title`). A lint rule fails the build on hard-coded text in UI code.
- **Messages, not concatenation.** Messages use ICU MessageFormat for plurals, gender and variables. Sentences are never built by joining fragments.
- **Formats.** Dates, numbers, currency and units come from `Intl` formatters, never hand-built strings.
- **Generated text.** Headlines and commentary are templates (key plus parameters), not finished sentences.
- **Names are data.** Name lists and place names are data files, not translatable text.
- **Mods.** A mod supplies its own text keys in `text/en.json`.

## Cost baseline (proposed, tunable, AUD)

| Item | Cost |
| --- | --- |
| Entry fee per entry per round | $5,000 (top-31 finishers get free tyres, but still pay the fee) |
| Racing tyre set (non-top-31) | $1,800 per set; practice sets $900 |
| Starter road car, used | $12,000–$35,000 |
| Mid-tier car (JDM, sports), used | $40,000–$120,000 |
| Premium supercar, used | $120,000–$400,000 |
| Elite supercar, used | $400,000–$2,000,000 |
| Hypercar | $2,000,000+ (see price tiers) |
| Part price range | $400 (filter, pads) to $60,000 (turbo kit / engine build) |
| Mechanic wage | $1,200 per week each |
| Driver salary, unknown | $0–$20,000 per season (often paid in sponsor product) |
| Driver salary, gold border | $60,000–$400,000 per season; champions higher |
| Small title sponsor | $30,000–$80,000 per season |
| Delivery driving | About $250 per day on non-event days |
| Top-31 discount on parts | 30% |

A one-car, low-budget garage should be able to survive on delivery income and a small sponsor, break even at about 15th–31st finishes, and only profit meaningfully from finals. **Bankruptcy:** cash below -$50,000 for 3 consecutive weeks ends the garage; in Garage owner mode the career ends with a retrospective screen, in Driver manager mode the driver is released and may sign elsewhere.

## Formulas (proposed, tunable)

**Car ratings** (each normalised to 0–1 against the series' range of cars):

- **P (power)** from power-to-weight, `PS / kerb_kg`, with a reduction at altitude: `P × (1 − 0.011 × altitude_m / 100)` (Hotham at about 1,750 m loses roughly 19% before the cars' own turbo compensation).
- **G (grip)** from fitted tyre width as a share of the Equalizer limit, plus suspension and aero parts.
- **B (braking/handling)** from brakes, suspension tune and weight.
- **T (traction)** from drivetrain and tyre width.

**Sector fit.** Each sector has weights that sum to 1, derived from its data: long straights raise the weight of P, high corner density raises G and B, big elevation change raises P and T, narrow width raises B. `Fit_s = wP·P + wG·G + wB·B + wT·T`.

**Sector time.**

```latex
t_s = t_{ref,s} \times \bigl(1 - k_c\,(Fit_s - 0.5)\bigr) \times \bigl(1 - k_d\,(D_s - 0.5)\bigr) + \Delta_{temp} + \varepsilon
```

- `t_ref,s` is the sector's reference time from course data.
- `D_s` is the driver's sector rating: a blend of Pace, the matching road-affinity, and Composure on the main feed. Initial `k_c = 0.10`, `k_d = 0.10`, so the best driver in a mediocre car can beat a mediocre driver in the best car. This is the "driver over horsepower" pillar and the sim-10-seasons script must check it holds.
- `Δ_temp` is a track temperature roll penalty/bonus, within ±0.4% of sector time.
- `ε` is random variance with standard deviation `σ = 0.6% × (1 − Consistency/150)` of sector time.

**Tyre life.** Starts at 100%. Per sector: `loss = base_loss × (1 + 0.4·aggression + 0.3·wheelspin_factor + 0.2·slide_factor − 0.5·(TyreMgmt/100))`. Base loss is set so a neutral driver reaches about 8% at the final's end. Grip multiplier on `Fit` is `1 − 0.004 × max(0, 20 − tyre_pct)` below 20%.

**Incident chance per sector.** `p = p_base × (1 + aggression) × wet_factor × wear_factor × (1 − Composure/200)`. Outcomes: mistake (lose 1–4 s), spin (lose 10–25 s), crash (retire, damage, drone stop signal for followers). Initial `p_base` is 0.0004 per sector per entry in prelims.

**Overtaking (final).** An attacker within 0.5 s overtakes at an overtake spot if `(attacker_sector_speed_advantage + racecraft_diff/100) > threshold`, where the threshold is raised by narrow width and lowered by drone-clear sight lines. Defend calls raise the defender's racecraft by 10 for that sector but cost extra tyre life.

**AI prelim times.** For the ~300 AI entries the same sector formula is evaluated once per sector with no per-entry sim state, then summed. This keeps a prelim day cheap while staying consistent with the final.

**Scrutineering.** After every run: kerb weight and tyre width checked against the Equalizer; road-legality score must be ≥ 0. Failure = disqualification from that run's result; the entry keeps its previous prelim time only if it has one.

**Weather.** Each day for a round is rolled from a course climate profile: `dry_clear`, `overcast`, `wet`. Only `dry_clear` allows prelim runs. Rounds are guaranteed to finish: if more than 14 days pass since the planned prelim start, the series declares remaining runs "dry-enough" on the next overcast day.

**Wear and reliability.** Every part has `wear` from 0 to 100 and a reliability curve. Wear rises with race km and road km. A part above 85 wear has a rising failure chance each sector; failure during a run causes a retirement.

## Fictional manufacturers and cars

The game ships only fictional manufacturers and models, so no licences are needed. Each one is also designed as a stand-in for a real counterpart, so modders can swap in real cars. The real names below are a reference for modders only: they never appear in the shipped game, its data files, store page or marketing.

**Roster focus.** The series is a supercar showcase with JDM and sports cars mixed in.

- **20 manufacturers, 3 models each (60 models):** 12 supercar makers (36 models), 5 JDM makers (15) and 3 sports-car makers (9). Each model is mapped to a specific real model.
- **Field mix (Season 1, 313 cars):** about 50% supercars, 30% JDM and 20% sports cars. New garages and underdogs start in JDM and sports cars, and supercars are the aspiration.
- **Stats are indicative.** Kerb weight and power are rounded starting values chosen to fit the game's balance, not exact real specifications. A mod that imports the real car replaces them. Max tyre width uses the Equalizer (`kg / 5 + 40`).

**Price tiers.** `price_new ≈ ($15,000 + $280 × PS) × tier multiplier`. Used cars sell at 40–70% of new depending on age and odometer.

| Tier | Multiplier | Typical used price | Notes |
| --- | --- | --- | --- |
| Starter | 0.8 | Under $40,000 | What a new underdog garage can afford |
| Mid | 1.0 | $40,000–$120,000 | Strong JDM and sports cars |
| Premium | 1.8 | $120,000–$400,000 | Entry supercars; a stretch for a young garage |
| Elite | 3.5 | $400,000–$2,000,000 | Classic and modern supercars |
| Hyper | 8 | Over $2,000,000 | Hypercars; only the richest garages and sponsors |

**Supercar upkeep.** Servicing and parts cost 1.5× at Premium, 2.5× at Elite and 4× at Hyper. A supercar's extra power is paid for in wear, fragility and running costs, and the Equalizer caps how much of it can reach the road, which keeps lighter JDM and sports cars competitive.

**Manufacturers**

| Fictional | Home | Type | Character | Real counterpart (modding reference) |
| --- | --- | --- | --- | --- |
| Cavallo | Italy | Supercar | Passion and heritage, V8 and V12 | Ferrari |
| Tauro | Italy | Supercar | Wide, loud, dramatic | Lamborghini |
| Vento | Italy | Supercar | Handbuilt carbon hypercars | Pagani |
| Halberd | UK | Supercar | Lightweight carbon, technical | McLaren |
| Ashford | UK | Supercar | Grand tourers to hypercars | Aston Martin |
| Kessler | Germany | Supercar | Rear-engined precision | Porsche |
| Stern | Germany | Supercar | Hand-built V8 power | Mercedes-AMG |
| Rhein | Germany | Supercar | All-wheel-drive traction | Audi |
| Montclair | France | Supercar | Extreme power and top speed | Bugatti |
| Vesper | Sweden | Supercar | Record-chasing hypercars | Koenigsegg |
| Dunmore | USA | Supercar | Big V8 muscle and supercars | Ford |
| Marlowe | USA | Supercar | Front-engined V8 sports and supercars | Chevrolet |
| Homura | Japan | JDM | Light sports cars, rotary specialist | Mazda |
| Tsurugi | Japan | JDM | Turbo AWD coupes, tuner favourites | Subaru |
| Raijin | Japan | JDM | Rear-drive coupes and grand tourers | Nissan |
| Mitaka | Japan | JDM | Reliable, rally heritage | Toyota |
| Hanabi | Japan | JDM | High-revving naturally aspirated | Honda |
| Kestrel | UK | Sports | Light, agile, low power | Lotus |
| Corvina | Italy | Sports | Stylish, sharp-handling, temperamental | Alfa Romeo |
| Brandt | Germany | Sports | Precise, heavier, strong brakes | BMW |

**Models** (max tyre from the Equalizer)

| Fictional model | Tier | Kerb kg | Max tyre | PS | Real counterpart (modding reference) |
| --- | --- | --- | --- | --- | --- |
| Cavallo Quaranta | Elite | 1,100 | 260 mm | 478 | Ferrari F40 |
| Cavallo Tre-Cinque | Premium | 1,350 | 310 mm | 380 | Ferrari F355 |
| Cavallo Otto | Elite | 1,380 | 316 mm | 570 | Ferrari 458 Italia |
| Tauro Cuneo | Elite | 1,500 | 340 mm | 455 | Lamborghini Countach |
| Tauro Piccolo | Premium | 1,400 | 320 mm | 520 | Lamborghini Gallardo |
| Tauro Bravo | Elite | 1,800 | 400 mm | 700 | Lamborghini Aventador |
| Vento Z | Elite | 1,230 | 286 mm | 650 | Pagani Zonda F |
| Vento H | Hyper | 1,350 | 310 mm | 730 | Pagani Huayra |
| Vento Utopia | Hyper | 1,280 | 296 mm | 864 | Pagani Utopia |
| Halberd F1 | Hyper | 1,140 | 268 mm | 627 | McLaren F1 |
| Halberd 570 | Premium | 1,440 | 328 mm | 570 | McLaren 570S |
| Halberd 765 | Elite | 1,330 | 306 mm | 765 | McLaren 765LT |
| Ashford Vantage | Premium | 1,530 | 346 mm | 510 | Aston Martin Vantage |
| Ashford DB | Premium | 1,770 | 394 mm | 608 | Aston Martin DB11 |
| Ashford Lance | Hyper | 1,030 | 246 mm | 1,160 | Aston Martin Valkyrie |
| Kessler Heck | Premium | 1,360 | 312 mm | 450 | Porsche 911 GT3 RS (997) |
| Kessler Rennen | Elite | 1,380 | 316 mm | 612 | Porsche Carrera GT |
| Kessler Boxer | Mid | 1,340 | 308 mm | 385 | Porsche Cayman GT4 |
| Stern GT Black | Elite | 1,540 | 348 mm | 730 | Mercedes-AMG GT Black Series |
| Stern SLR | Elite | 1,768 | 394 mm | 626 | Mercedes-Benz SLR McLaren |
| Stern 63 | Premium | 1,700 | 380 mm | 510 | Mercedes-AMG C63 S Coupé |
| Rhein R8 | Premium | 1,620 | 364 mm | 525 | Audi R8 V10 |
| Rhein Sport Quattro | Elite | 1,200 | 280 mm | 306 | Audi Sport Quattro |
| Rhein TT RS | Mid | 1,450 | 330 mm | 400 | Audi TT RS |
| Montclair EB | Elite | 1,620 | 364 mm | 612 | Bugatti EB110 SS |
| Montclair Veyron | Hyper | 1,950 | 430 mm | 1,001 | Bugatti Veyron 16.4 |
| Montclair Chiron | Hyper | 1,995 | 439 mm | 1,500 | Bugatti Chiron |
| Vesper CCR | Elite | 1,180 | 276 mm | 806 | Koenigsegg CCR |
| Vesper Agera | Hyper | 1,330 | 306 mm | 1,140 | Koenigsegg Agera R |
| Vesper Jesko | Hyper | 1,420 | 324 mm | 1,280 | Koenigsegg Jesko |
| Dunmore GT | Elite | 1,520 | 344 mm | 550 | Ford GT (2005) |
| Dunmore GT-X | Elite | 1,385 | 317 mm | 656 | Ford GT (2017) |
| Dunmore Stallion V8 | Premium | 1,650 | 370 mm | 450 | Ford Mustang GT |
| Marlowe Vettura | Premium | 1,530 | 346 mm | 638 | Chevrolet Corvette ZR1 (C6) |
| Marlowe Z | Premium | 1,600 | 360 mm | 650 | Chevrolet Corvette Z06 (C7) |
| Marlowe Sprint | Mid | 1,700 | 380 mm | 455 | Chevrolet Camaro SS |
| Homura Corsa 1.8 | Starter | 1,020 | 244 mm | 170 | Mazda MX-5 (NB) |
| Homura Spirit R-7 | (not for sale) | 1,150 | 270 mm | 280 | Mazda RX-7 (FD) |
| Homura Eclipse R-8 | Mid | 1,310 | 302 mm | 230 | Mazda RX-8 |
| Tsurugi S2 | Mid | 1,180 | 276 mm | 220 | Subaru Impreza WRX (GC8) |
| Tsurugi 22 | Premium | 1,270 | 294 mm | 280 | Subaru Impreza 22B STI |
| Tsurugi Rex | Mid | 1,250 | 290 mm | 200 | Subaru BRZ |
| Raijin 200S | Mid | 1,240 | 288 mm | 250 | Nissan Silvia (S15) |
| Raijin GT-Line | Premium | 1,560 | 352 mm | 330 | Nissan Skyline GT-R (R34) |
| Raijin R | Premium | 1,740 | 388 mm | 570 | Nissan GT-R (R35) |
| Mitaka Sprinter | Starter | 940 | 228 mm | 130 | Toyota AE86 |
| Mitaka Arrow | Mid | 1,500 | 340 mm | 330 | Toyota Supra (A80) |
| Mitaka Halo | Elite | 1,480 | 336 mm | 560 | Lexus LFA |
| Hanabi Type-R EK | Starter | 1,050 | 250 mm | 185 | Honda Civic Type R (EK9) |
| Hanabi Roadster S | Mid | 1,260 | 292 mm | 240 | Honda S2000 |
| Hanabi Mid-Tech | Premium | 1,350 | 310 mm | 280 | Honda NSX (NA1) |
| Kestrel Swift 1.6 | Starter | 940 | 228 mm | 140 | Lotus Elise |
| Kestrel Merlin | Mid | 980 | 236 mm | 240 | Lotus Exige |
| Kestrel Harrier | Mid | 1,400 | 320 mm | 280 | Lotus Evora |
| Corvina 4C | Mid | 895 | 219 mm | 240 | Alfa Romeo 4C |
| Corvina 8C | Premium | 1,585 | 357 mm | 450 | Alfa Romeo 8C Competizione |
| Corvina Giulia QV | Mid | 1,700 | 380 mm | 510 | Alfa Romeo Giulia Quadrifoglio |
| Brandt M1 | Premium | 1,300 | 300 mm | 277 | BMW M1 |
| Brandt M3 GTS | Premium | 1,530 | 346 mm | 450 | BMW M3 GTS (E92) |
| Brandt 330 | Mid | 1,540 | 348 mm | 340 | BMW 335i (E92) |

The Homura Spirit R-7 is Pyra Drake's #313 benchmark and is not for sale. The starter cars a new garage can pick from are the Kestrel Swift 1.6, Homura Corsa 1.8 and Mitaka Sprinter. The starting field's 313 cars are drawn from these 60 models using the field mix above; supercars appear mostly in the hands of established, high-prestige garages.

**Modding support**

- **Mapping file.** `mod_mapping.json` is optional and ships separately from the game data. It links each fictional model ID to its real counterpart (make, model, generation, years) so a mod can replace names, stats and visuals together. It is not included in the base game.
- **Replacement, not addition.** A mod replaces a fictional manufacturer or model entirely, including its name, logo, body shape and stats. Save files keep working because the game stores the stable internal ID, not the display name.
- **Livery and art.** Real-car mods supply their own body-shape SVG with the standard livery slots (front quarter, doors, rear quarters, number, flag).
- **Mod loader.** See "Modding (Steam Workshop)" for the package format, validation and load order.
- **Legal.** The base game never ships real marks. Responsibility for real-brand mods sits with the modder, and the Workshop policy for them is an open question below.

## World generation and AI

**Season 1 world (96 garages, 313 drivers).**

- **Garage sizes.** About 55 single-entry garages, 25 with 2 entries, 10 with 3, 4 with 4, and 2 with 5. Entries total 313 including the player's.
- **Prestige.** Set from entry count and any gold-bordered drivers (in Season 1, about 20 seeded drivers start gold-bordered as past finalists).
- **Names.** Drivers and garages are generated from name pools weighted toward Australian and a broad international mix. Pools are in `names.json` and must avoid real people and trademarks.
- **Skill distribution.** Driver Pace is drawn from a normal distribution (mean 45, SD 12, clamped 20–85); the ~20 seeded gold-bordered drivers are 60–85. Potential is Pace plus 0–25.
- **Number assignment.** Season 1 numbers 1–40 are assigned to the 40 seeded top drivers by a pre-season ranking; the rest take numbers from 41 up. #313 is reserved.

**Yearly rollover.**

1. Retirement: drivers over 40 retire with rising probability each year; any driver may also retire after repeated poor results or serious injury.
2. Newcomers: 20–45 new drivers enter each year (more if recent seasons were popular); fame and prestige of the series raise the count. New garages form at 3–10 per year; garages with negative cash for 2 seasons fold.
3. Contracts: expiring drivers become free agents and sign with garages in descending order of reputation fit and budget.
4. Numbers are re-chosen (see race numbers).

**AI garage profiles.** `Cautious` (few entries, low spend), `Growth` (adds entries when cash allows), `Star-chaser` (bids for flagged and gold-bordered drivers), `Local` (one entry, loyal to a home-state driver). Each profile defines how it buys parts, signs drivers and calls team orders.

**Player impact.** AI garages respond to the player's success: a rising prestige draws offers and raises rival interest in the player's drivers.

## Screens and flow

| Screen | Purpose |
| --- | --- |
| Main menu / career setup | New career (mode, difficulty, seed), load, settings |
| Garage hub | Cars, drivers, finances and upcoming round at a glance |
| Cars and workshop | Buy/sell cars, fit parts, set course setups, see legality and Equalizer limit live |
| Drivers and contracts | Roster, free agents, scouting with attention-flag leads, negotiation |
| Sponsors and suppliers | Offers, active deals, door-logo layout |
| Round hub | Calendar for the 15+ days, weather, running order, practice controls |
| Practice and prelim view | Timing screen, live map, ghost choice, per-entry results |
| Final race view | Timing tower, sector splits, tyre life, player calls, drone events |
| Standings and records | Tabs for the five standings tables, history browser |
| Season review | Awards, finances, headlines, off-season tasks |
| Settings | Sim speed, text size, accessibility, audio |

**Daily loop.** The game advances one day at a time. Each day shows events needing attention (practice, repairs, offers, a prelim run). Skipping to the next event is always one click.

**Race calls UI.** Calls are presented as a short list per driver per stint (Push / Balanced / Conserve, Attack / Defend, team orders). The sim pauses at set triggers (flag, crash, drone stop) and on the player's request.

**Off-season (mid-October to late February).** Fixed order: awards and closing ceremony (Nov 11), contract window, number applications, driver development and retirements, sponsor and supplier negotiations, car building and testing, entry registration (garage submits entries by 28 February), then the calendar rolls to Round 1 on March 31.

## Audio, art and presentation

- **Style.** Clean, data-rich "broadcast control room" interface. Flat colour with high contrast, so livery, number boxes and borders stay readable at small sizes.
- **Livery rendering.** A single layered SVG car template per body shape with slots for garage name, door logos, rear-quarter decals, number and border; no per-car art is needed.
- **Course map.** Each course has a vector path with sector markers and overtaking spots, used for the live map and the round hub.
- **Audio.** Engine notes grouped by engine type (rotary, turbo four, V8, flat/6), crowd-free ambience, drone whine, radio chatter and commentary stingers. Sound can be reduced or muted independently.
- **Accessibility.** Colour-blind-safe palette for borders and flags, text scaling, no reliance on colour alone, keyboard navigation for all management screens.

## Glossary

| Term | Meaning |
| --- | --- |
| Equalizer | The tyre-width rule linked to kerb weight |
| Entry | One car plus one driver, in one series |
| Prelim | The one-lap time attack held over 7 days |
| Vanguard | The 15 (later 20) finalists |
| Gold / silver border | Marks for reaching a main final / earning Junior points |
| Attention flag | AI-flagged exceptional pace |
| Top 31 | Everyone who scores championship points |
| Door suppliers | Suppliers whose logos appear on a car's doors |
| Ghost record | The projected ghost car in prelim sessions |
| Nations standings | Points tables by the flag drivers or garages race under |
| Founder's career | The hidden Owner-driver start as Pyra Drake |

## Decisions and open questions

**Decided**

- **Single-player only.** No multiplayer (see Technical Stack).
- **Season 1 field.** 96 garages and 313 drivers; later growth follows "World generation and AI".
- **Fixed round count.** Seven rounds each season, including after 2036.
- **Standings.** Drivers, garages, manufacturers, driver nations and garage nations all ship (see "Standings").
- **Flags.** Any flag with a flag emoji is allowed, provided its artwork has an open licence (OFL, CC BY-SA or similar).
- **Road and place names.** Real roads, routes and place names are used as geography and need no licensing.
- **Junior and Super share garages.** One garage runs entries in both series.
- **Owner-driver starts solo.** One car, one entry, no staff.
- **Language.** English only, with all text externalised for later translation.
- **Modding.** Steam Workshop support for starting garages, drivers and stats, name lists, manufacturers, cars and tracks.
- **Founder's career.** A hidden Easter egg start as Pyra Drake. It disables achievements and unlocks its own secret achievement.
- **Negotiations.** Drivers, garages, sponsors, manufacturers and suppliers negotiate with one system.
- **Flag artwork.** `lipis/flag-icons` (MIT).
- **Round 7 name.** The protected event name is not used. The round is the North-west Tasmania mountain roads.
- **Junior schedule.** Junior practice day 1 is the day after the Super final, at the same venue.
- **Modding scope.** Mods may also change parts, sponsors, suppliers and balance data.
- **Steam.** Achievements and cloud saves are enabled.

**Open**

- [ ] Measured lap lengths for each proposed route (needed before M2 course data).
- [ ] Final tuning of the cost baseline and formula coefficients (via the 10-season headless sim).
- [ ] Confirm that `flag-icons` covers every flag emoji (add art from another open-licence set for any gap).
- [ ] Legal review of the real-counterpart mapping, and the Workshop policy for real-brand car mods.
- [ ] Junior practice length (3 days proposed) and whether garages need extra crew for back-to-back events.
- [ ] Whether careers with balance-changing mods still earn achievements.
- [ ] Tuning of negotiation values: patience, relationship effects and reservation formulas.
