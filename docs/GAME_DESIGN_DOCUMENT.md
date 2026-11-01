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
- **Desktop/Steam Deployment:** Designed for web execution first, structured for an eventual Steam release using an Electron wrapper.
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

## Season calendar

The season runs annually from **March to October**. It consists of seven rounds on Australian roads, starting in Queensland and moving south to a Targa Tasmania finale. Every course must be a mountain or road course of at least 10 km; urban street circuits are not allowed.

- **Round 1 Launch:** The first day of Round 1 practice and the championship opening ceremony always take place on **March 31st**, which coincides with founder Pyra Drake's birthday.
- **Season Conclusion & Post-Season:** The racing season aims to wrap up in **mid-October** at Round 7 in Tasmania. On **November 11th**, the series hosts the official Closing Ceremony and Awards Gala, which serves as the opening day of the week-long **Drake Motorsports International Motoring Festival** held in **Healesville, Victoria**—the headquarters town of Last Combustion and Pyra Drake's hometown.

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

Each round runs on a loop or an out-and-back course. A preliminary run is **exactly one lap** of the course, and the lap count takes the final past 300 km.

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

Each round is a 7-day practice week, then 7 days of preliminaries for a large field, then a final race of at least 300 km for the top 15 (top 20 from 2036 in Super Series).

1. **Practice (7 days).** The course opens for practice a week before the prelims, with as many tyre sets as each entry needs. Round 1 Practice Day 1 always opens on **March 31st**.
2. **Preliminaries (7 days).** A prologue-style time attack: each entry gets **exactly one lap**, and that time sets its placing. Entries start one at a time, at set intervals, in a published running order. The order is seeded using current championship standings (Round 1 uses last season's).
3. **Dry and clear only.** Prelim runs are only held in completely dry, non-overcast conditions. A rainy day becomes an extra practice day and pushes the prelims back.
4. **One racing set.** Once the prelims start, each entry gets one racing set for its single prelim lap.
5. **Prelim classification.** Positions 16–31 (16–42 from 2036 in Super Series) score points from their prelim placing. Everyone below scores nothing.
6. **Final race.** The finalists start the final on a fresh set of race tyres over a minimum of 300 km, with no pit stops or tyre changes.

**Race UI & Simulation View:** Races are presented as a **pure management interface** complete with real-time timing screens (sector splits, delta speeds, tyre life) and an interactive **live map** tracking car locations and drone markers.

**Round timeline:** A round takes at least 15 days: 7 practice days, 7 prelim days, and the final race. The season runs from **March 31st to mid-October**, followed by post-season celebrations starting **November 11th** and an off-season for contracts, driver transfers, and car building through February.

## Points systems (Even Decimals Only)

### 2031–2035 Main Series & Last Combustion Junior Points System

The top 31 drivers score each round. 1st place awards **25.0 points**, scaling smoothly with **even decimal numbers only** (`.0`, `.2`, `.4`, `.6`, `.8`). Positions 1–15 score from the final; positions 16–31 score from the preliminaries. *This original points system is also retained permanently for Last Combustion Junior starting in 2036.*

| Pos | Pts | Pos | Pts | Pos | Pts | Pos | Pts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 25.0 | 9 | 13.6 | 17 | 3.6 | 25 | 1.6 |
| 2 | 22.4 | 10 | 12.2 | 18 | 3.2 | 26 | 1.4 |
| 3 | 21.0 | 11 | 10.8 | 19 | 2.8 | 27 | 1.2 |
| 4 | 19.6 | 12 | 9.4 | 20 | 2.4 | 28 | 1.0 |
| 5 | 18.2 | 13 | 8.0 | 21 | 2.2 | 29 | 0.8 |
| 6 | 16.8 | 14 | 7.0 | 22 | 2.0 | 30 | 0.4 |
| 7 | 15.4 | 15 | 6.0 | 23 | 1.8 | 31 | 0.2 |
| 8 | 14.0 | 16 | 4.0 | 24 | 1.7 |  |  |

- **No bonus points.** There are no podium or fastest-run bonuses.
- **Tiebreak.** Most wins, then most 2nds, and so on down the positions, then best prelim time at the final round.

**The top 31 is every competitor's target.** A top-31 finish earns:

- Driver's points
- Free tyres, and large discounts on other parts
- A reserved place in the assistants' booth (the second booth), a space in the broadcast, team comms and telemetry area. Garages working from it get richer live telemetry (sector splits, tyre life, rivals' pace) and clearer radio to their driver, so their race calls are better informed

## Garages and Field Size

- **Season 1 Baseline:** Starts with exactly **96 garages** and **313 drivers**.
- **Roster & Growth:** Drivers may join, retire, or transfer freely during the off-season. There is no hard upper or lower limit to total entries, though the trend leans toward growth.
- **An entry is one car plus one driver.** Each entry needs its own car, driver, tyre allocation, and entry fee.
- **Garage Championship:** Each garage's best two results per round count.

## Numbers, borders and liveries

Numbers 1–40 follow last season's rankings and 41 and up are open to anyone, the champion's number is boxed in black, and a gold border marks anyone who has ever reached a final.

**Race numbers & Special Numbers**

- **Numbers 1–40:** Last season's rankings.
- **Numbers 41 and up:** Open to anyone.
- **Number #313 (Reserved):** Permanently retired and reserved for founder Pyra Drake.
- **Black box:** The reigning champion's #1 carries a black box.

**Gold and Silver borders**

- **Gold Border:** Any driver who has qualified for a main series final carries a gold border for the rest of their career.
- **Silver Border & Junior Rule:** Junior Series points scorers carry a silver border. **Mandatory Rule:** Junior drivers who get a silver border MUST finish their junior season, and MUST enter the Super Series the following season.

**Livery placement (enforced by the series)**

- **Rear quarter panels:** Right rear (driver's side) carries the driver's own trophies/shields; left rear carries the car's trophies/shields. Gold decals for Super Series, silver for Junior Series.
- **Front quarter panels:** Garage / team name.
- **Doors:** Aftermarket parts suppliers.

## Technical regulations

The Equalizer is the series' only real technical rule: a car's maximum tyre width is set by its kerb weight. There are no power limits, no ballast, no budget cap and no success ballast.

$$
\text{Max tyre width (mm)} = \frac{\text{Kerb weight (kg)}}{5} + 40
$$

| Kerb weight | Max tyre width | Width per tonne |
| --- | --- | --- |
| 900 kg | 220 mm | 244 mm |
| 1,000 kg | 240 mm | 240 mm |
| 1,200 kg | 280 mm | 233 mm |
| 1,500 kg | 340 mm | 227 mm |
| 1,800 kg | 400 mm | 222 mm |

- **The trade-off.** Light cars get more tyre width per kilo, so they corner better; heavy, powerful cars keep their straight-line advantage.
- **Road legal; everything else is free.** Any registered, road-legal car powered by an internal combustion engine. Electric cars are not allowed; hybrids may enter only with KERS removed.
- **Tyres.** Supplied by Ironbark Tyre Co. (all-weather compound). One racing set for the prelim run, one fresh set for the final race.

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

## Founders, Special Vehicles, and Ghost Record

- **Pyra Drake:** Founder and chairwoman of Last Combustion. Born in **1996**, she celebrates her **35th birthday** in Season 1 (2031) and her **40th birthday** in Season 6 (2036). The opening ceremony and Round 1 practice always take place on her birthday, **March 31st**. She is a self-insert character and one of the best drivers in history, but does not actively race in LC main events. Her role is setting the first-ever course records, and her number **#313** is permanently retired.
- **Drake Motorsports:** Pyra Drake's personal team where she is founder and owner, with her unique vehicle being a fictional Mazda RX-7 expy called the **Homura Spirit R-7** (rotary-powered lightweight sports car).
- **Healesville HQ & Motoring Festival:** Healesville, Victoria is Pyra Drake's hometown and the global headquarters of Last Combustion. Every year on **November 11th**, Healesville hosts the Last Combustion Closing Ceremony and Awards Gala, kicking off the week-long **Drake Motorsports International Motoring Festival**.
- **Ghost Record:** Before every prelim session, a giant drone projects a ghost car over the course. Drivers choose their ghost from the top 5 drivers of the prior year or Pyra Drake's #313 demo run, in either **Easy** mode (2 seconds ahead, teaching line) or **Hard** (recreates exact historical qualifying run).

## Attention flags

The central AI computer flags drivers whose live sector times beat predicted pace by at least 2.5 standard deviations:

$$
z = \frac{(t_{\text{predicted}} - t_{\text{actual}}) - \mu}{\sigma} \qquad \text{flag if } z \ge 2.5
$$

Flags trigger broadcast attention, comms alerts, and enhanced sponsor/supplier interest.

## Simulation model

Races are simulated sector by sector based on course features, car setup, driver stats, tyre life, and random variance. Player interaction is focused on strategy calls (Push, Balanced, Conserve; Attack, Defend; Team Orders).

## Core gameplay loop and progression

Each round, the player prepares cars in the garage, fights through the prelims, races the final if qualified, and banks rewards. Progression scales from unknown rookie to champion, and single-garage operations to multi-car title contenders.

## Drivers, Sponsors, and Economy

- **Drivers:** Feature hidden potential and visible stats (Pace, Consistency, Racecraft, Tyre Management, Composure, Wet Skill, Road Affinity).
- **Sponsors & Suppliers:** Provide financial backing, season fees, and contingency bonuses tied to garage prestige, driver fame, and fitted parts.
- **Finances:** Funded by round prize money (scaling up to $1,000,000 for 1st place in the final) and corporate sponsors, offset by repair costs and travel wear.

**Original Final race prize money (AUD) — (Used in 2031–2035 Main Series & Last Combustion Junior)**

| Pos | Prize | Pos | Prize | Pos | Prize |
| --- | --- | --- | --- | --- | --- |
| 1 | $1,000,000 | 6 | $150,000 | 11 | $60,000 |
| 2 | $500,000 | 7 | $100,000 | 12 | $50,000 |
| 3 | $300,000 | 8 | $90,000 | 13 | $40,000 |
| 4 | $250,000 | 9 | $80,000 | 14 | $30,000 |
| 5 | $200,000 | 10 | $70,000 | 15 | $20,000 |

**2031–2035 Season prizes and bonuses (AUD)**

| Award | Amount |
| --- | --- |
| Season champion | $10,000,000 |
| Pole position (fastest prelim run) | $10,000 each time |
| Overtake in the final race | $10,000 each |

## 2036 expansion

In 2036 (Season 6), the main series expands and is rebranded to **The Last Combustion of the Petrol Engine World Motorsports Super Series Championship (Last Combustion Super Series)**. This season also marks Pyra Drake's 40th birthday.

- **Bigger final:** The final grows from 15 to **20 cars**.
- **Expanded Points System (Top 42):** Points scoring expands to the top 42 drivers, with 1st place scoring **25.0 points**, 42nd place scoring **0.2 points**, and all values using strict **even decimal increments** (`.0`, `.2`, `.4`, `.6`, `.8`). Top 20 finalists score significantly more total points than non-finalists.

| Pos | Pts | Pos | Pts | Pos | Pts | Pos | Pts | Pos | Pts | Pos | Pts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **1** | **25.0** | **8** | 14.6 | **15** | 6.2 | **22** | 2.4 | **29** | 1.6 | **36** | 0.8 |
| **2** | 22.8 | **9** | 13.2 | **16** | 5.2 | **23** | 2.2 | **30** | 1.4 | **37** | 0.8 |
| **3** | 21.4 | **10** | 11.8 | **17** | 4.4 | **24** | 2.0 | **31** | 1.4 | **38** | 0.6 |
| **4** | 20.0 | **11** | 10.4 | **18** | 3.6 | **25** | 1.8 | **32** | 1.2 | **39** | 0.6 |
| **5** | 18.6 | **12** | 9.0 | **19** | 3.0 | **26** | 1.8 | **33** | 1.2 | **40** | 0.4 |
| **6** | 17.2 | **13** | 8.0 | **20** | 2.6 | **27** | 1.6 | **34** | 1.0 | **41** | 0.4 |
| **7** | 15.8 | **14** | 7.0 | **21** | 2.4 | **28** | 1.6 | **35** | 1.0 | **42** | **0.2** |

- **Bigger prizes & bonuses:** 1st place prize in the Super Series final increases to **$1,500,000**, the season championship prize rises to **$15,000,000**, and both pole position and overtake bonuses rise to **$15,000** each.

**Super Series final prize money from 2036 (AUD)**

| Pos | Prize | Pos | Prize | Pos | Prize | Pos | Prize |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | $1,500,000 | 6 | $225,000 | 11 | $90,000 | 16 | $25,000 |
| 2 | $750,000 | 7 | $150,000 | 12 | $75,000 | 17 | $20,000 |
| 3 | $375,000 | 8 | $135,000 | 13 | $60,000 | 18 | $15,000 |
| 4 | $300,000 | 9 | $120,000 | 14 | $45,000 | 19 | $12,500 |
| 5 | $225,000 | 10 | $105,000 | 15 | $30,000 | 20 | $10,000 |

**2036+ Super Series Season prizes and bonuses (AUD)**

| Award | Amount |
| --- | --- |
| Season champion | $15,000,000 |
| Pole position (fastest prelim run) | $15,000 each time |
| Overtake in the final race | $15,000 each |

## Last Combustion Junior

Launched alongside the 2036 Super Series expansion:

- **Eligibility:** Drivers 25 or younger who have never reached a main-series final.
- **Power Cap:** Maximum 300 PS (enforced via intake restrictors).
- **Format & Perks:** 5-day prelims, top 15 final, and "J" door numbers. Points scorers earn free tyres and a silver-outlined number.
- **Points & Prize Money:** Uses the **original 2031 points system** (top 31 score, 25.0 points max for 1st) and **original 2031 final prize money** ($1,000,000 for 1st down to $20,000 for 15th). The Junior champion wins $10,000,000. Pole position and overtake bonuses in Junior remain $10,000 each.
- **Mandatory Promotion:** Junior drivers who earn a silver border MUST complete their junior season, then MUST enter the Super Series next season.

## Records and history

The game uses a permanent **SQLite** database backend to store comprehensive histories for races, drivers, garages, and individual car chassis (where trophy decals and histories permanently follow the physical chassis upon sale).

| Record | What is kept |
| --- | --- |
| Race (each round) | Course, dates, conditions on every day, wet-day delays, running order, every prelim time, final grid and result, gaps, tyre condition at the flag, attention flags, penalties and incidents |
| Driver | Every entry and result, numbers held each season, garages driven for, cars driven, points by round season, finals reached, wins, titles, date the gold border was earned, attention flags, contracts and salary history |
| Garage | Founding date, entries each season, drivers signed and released, cars owned, Garage Championship results, prestige over time, sponsors and suppliers, prize money earned |
| Car | Its own identity (chassis number), make and model, owners and garages, drivers, kerb weight and tyre width at each round, parts and suppliers fitted at each round, door logos, trophy decals, results, odometer including everyday road use |
