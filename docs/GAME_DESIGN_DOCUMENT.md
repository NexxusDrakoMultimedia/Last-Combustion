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

The season runs annually from **March to October**. It consists of seven rounds on Australian roads, starting in Queensland and moving south to a Targa Tasmania finale. Every course must be a mountain or road course of at least 10 km; urban street circuits are not allowed.

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
| 7 | Targa roads, Cethana / Hellyer Gorge | Tas | The finale: technical mountain roads, cold tarmac, big elevation changes |

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
| 7 | Cethana Loop: the Targa Cethana stage roads near Sheffield and the Cethana dam; connecting roads to be chosen | Loop | ~40 km | 8 |

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
- **Format.** Prelims are condensed from 7 days to 5, and the top 15 race the final.
- **Points and perks.** Junior uses the original 2031 points table: the top 31 score points, with the top 15 scoring from the final. Any points scorer gets free tyres, a reserved place in the assistants' booth and a silver-outlined number.
- **Prizes.** Junior uses the original 2031 prize money: finalists earn $1,000,000 down to $20,000 by position. The Junior champion, decided on points, wins $10,000,000. Pole and overtake bonuses of $10,000 each build up through the year and are paid at season end.
- **Numbers.** Junior cars carry a "J" beside their door number, to set them apart from main-series cars.
- **Mandatory Promotion:** Junior drivers who earn a silver border MUST complete their junior season, then MUST enter the Super Series the following season.

## Records and history

The game keeps a permanent, detailed history of every race, driver, garage and car, so any career can be looked back on in full.

| Record | What is kept |
| --- | --- |
| Race (each round) | Course, dates, conditions on every day, wet-day delays, running order, every prelim time, final grid and result, gaps, tyre condition at the flag, attention flags, penalties and incidents |
| Driver | Every entry and result, numbers held each season, garages driven for, cars driven, points by round and season, finals reached, wins, titles, date the gold border was earned, attention flags, contracts and salary history |
| Garage | Founding date, entries each season, drivers signed and released, cars owned, Garage Championship results, prestige over time, sponsors and suppliers, prize money earned |
| Car | Its own identity (chassis number), make and model, owners and garages, drivers, kerb weight and tyre width at each round, parts and suppliers fitted at each round, door logos, trophy decals, results, odometer including everyday road use |

- **Leaderboards** are built from these records: season standings, the Garage Championship, course records for the fastest prelim run and race, and all-time tables (wins, titles, finals, points).
- **Car histories follow the car.** A car sold to another garage keeps its left-rear decals and its full record, so a famous chassis carries its story with it. The driver's right-rear decals go with the driver.

## Open questions

- [ ] Measured lap lengths for each proposed route.
- [ ] Number of AI garages, and how new garages and drivers enter each year.
- [ ] Multiplayer or single-player only.