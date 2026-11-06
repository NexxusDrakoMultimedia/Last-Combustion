# Last Combustion — Game Design Document

Nov 2, 2026 · @Pyra Drake

## Overview

**Last Combustion** is a racing driver management and car upgrading game about a 2031 racing series for road-legal combustion cars, run on closed Australian public roads. It is loosely inspired by the anime/manga *MF Ghost*; all names and branding are original.

The series' full name is **The Last Combustion of the Petrol Engine World Motorsports Championship**, shortened to *Last Combustion* in everyday use.

The player runs a garage: buying and tuning cars, signing drivers, chasing sponsors, and fighting through a 300+ driver preliminary field to reach the final.

**Tagline.** "Racing team simulation game based in a post-petrol world, where the last petrolheads ply their craft." It is the official tagline: it appears on the title screen, the store page, the repository and every public page (see "Branding and marketing").

**Design pillars**

- **Driver over horsepower.** The tyre-width Equalizer means smart setup and driver skill beat raw power.
- **Rise from nobody.** Every driver starts in a huge field; a gold border is earned, never bought.
- **Every upgrade is a trade-off.** Parts and weight change your tyre-width limit, your costs and your door sponsors.
- **The car tells the story.** Trophy decals, garage names and supplier logos make a car's history readable at a glance.

## Technical Stack & Architecture

- **Core Technologies:** Coded in TypeScript, Tailwind CSS, React, and Zustand.
- **Database Storage:** Web application using SQLite (via WASM/SQL.js in-browser with persistent local database save states).
- **Desktop Deployment:** Designed for web execution first, with Electron desktop builds for Windows, macOS and Linux. A Steam release is optional and undecided, because of the game's GPL licence (see "Licensing and distribution").
- **Licence:** GNU GPL v3 or later.
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

## Careers over time

The player's character ages like everyone else, and the career carries on when the character's role changes. The world is never lost.

**Death**

- Characters die only of age or illness. Race deaths are not modelled: drones and rescue crews keep them out of the game, and a serious crash causes injury and time out, not death.
- Annual chance of death: 0.2% under 60, 1% at 60–69, 3% at 70–79, 8% at 80–89 and 20% from 90.

**Garage owner**

- If the owner dies, or the player retires them (allowed in any off-season), the player creates a **new character** who takes over the same garage in the same world: its cars, drivers, cash, fans and records. The successor can be a relative (sharing the surname) or an unrelated buyer.
- A new owner is created like any other owner (age 18 to 50) with a new name, gender, date of birth and hometown. The garage keeps its name, flag and colours, which the successor may change.
- Handover is not free. Relationships with sponsors, suppliers and drivers each drop by 20 and recover through normal dealings. A headline and a memorial mark the change.

**Owner-driver**

- When the owner-driver retires from racing (any off-season after at least one season, and forced at 50), the same character becomes a **Garage owner**. Their driver record stays in the history, they keep their fans (which fade after retirement as in "Fans"), and the garage's seat is filled by a driver the player hires.
- From then on the character follows the Garage owner rules, including succession.

**Driver manager**

- A driver can **found a garage at any time**, including mid-season, and becomes an **Owner-driver**. The driver's contract with their old garage must be bought out at its release fee or run to its end, and the new garage's entries start from the next round after its entry fees are paid.
- **Founding fee:** $50,000, paid from the driver's cash.
- **Funding that carries over** depends on fame and reputation: `carry % = clamp((fame + reputation) ÷ 200, 20%, 100%)`. The new garage starts with `(cash − fee) × carry %`. The rest stays with the driver as a personal reserve, which they may lend to the garage later at no interest. Personal sponsorship deals transfer at `carry %` of their remaining value if the sponsor agrees (see "Negotiations").
- The garage also starts with 25% of the driver's fans, and prestige of `1 + fame ÷ 10`.
- A Driver manager who retires can either found a garage the same way and continue as a Garage owner, or end the career with a retrospective and Hall of Fame entry if they qualify.

**Each save is a universe**

- A save holds one self-contained universe: its own world, history, almanac, records, rivalries and storylines, built from its master seed. Saves never share anything, and nothing carries between them except the player's settings and achievements.
- The universe goes on without the player. The series, the other garages, the drivers and the history do not stop when the player's career does.

**When a career fails**

- **Failure ends the career, not the universe.** A garage can go bankrupt (cash below zero with no way to pay its bills at a season's end, after a sale of its cars and a bank-style bailout that the player may refuse), the owner or driver can die or retire with no one to carry on, or the player can simply walk away from the garage. The garage then ceases to operate (its closing year goes in the almanac, as in "Records and history"), its cars and staff are sold or released into the world's markets, and its history stays.
- **The player then chooses between three paths:**
  - **Reincarnate in the same universe** as a **new character**, who may be a relative of the old one (sharing the surname and some history) or unrelated, in an existing garage or in a **new, unrelated garage** that the new character founds. Rivals, sponsors and records carry on, and the new character starts with their own reputation and, as in "Starting conditions", the usual start for their role.
  - **Take over an existing garage** in the same universe (as a new owner), if one is for sale or has failed and left a vacancy.
  - **Reset the universe**, which deletes the save and starts a new one with a new master seed.
- **The old career is remembered.** The failed career appears in the universe's history and Hall of Shame or Fame as it deserves, the almanac keeps its entries, and the commentary and headlines may refer to it.
- **Achievements and the Founder's career.** Achievements are not lost when a career fails, and reincarnating does not count as starting a new game for achievements that need one.
- **Data.** The `character` table's `end_reason` gains a `bankrupt` and an `abandoned` value, and the garage's `closed_year` is set when it stops operating.

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

The season runs annually from **March to October**. It consists of six rounds on Australian roads, travelling clockwise around the country: it starts in South Australia, crosses to Western Australia, then goes up and around through Queensland and New South Wales and finishes in Victoria at the series' home town, Healesville. Every course must be a mountain or road course with a lap of 10 to 80 km on sealed (paved) public roads only, with no dirt or gravel, and every course is a closed loop (no out-and-back or point-to-point courses). Urban street circuits are not allowed.

- **Pyra Drake's Birthday & Season Start:** Pyra was born in 1996, celebrating her 35th birthday in Season 1 (2031) and her 40th birthday in Season 6 (2036). The first day of Round 1 practice and the opening ceremony always takes place on her birthday, **March 31st**.
- **Season Wrap:** The racing season concludes in **mid-October** after Round 6.
- **Closing Ceremony & Festival:** The Closing Ceremony, Awards Gala, and opening day of the week-long **Drake Motorsports International Motoring Festival** in **Healesville, Victoria** (HQ town of Last Combustion and Pyra's hometown) always take place on **November 11th**.

| Rd | Course | State | Character |
| --- | --- | --- | --- |
| 1 | Adelaide Hills, Gorge Road and Lobethal | SA | Season opener: fast, flowing hill and gorge roads on the edge of Adelaide |
| 2 | Yallingup and Metricup, Margaret River region | WA | Forest and coast roads on Caves Road; the far-west round, run at night |
| 3 | Mount Nebo / Mount Glorious | Qld | Narrow, bumpy climbs and descents; suits light cars |
| 4 | Jamberoo Mountain Road / Macquarie Pass | NSW | Steep escarpment climb and descent; tight and often wet |
| 5 | Marysville, Buxton and the Black Spur | Vic | Tight, damp forest sweepers; a rhythm test |
| 6 | Healesville, Chum Creek, Toolangi and Dixons Creek | Vic | The finale at the series' home town: hill roads above Healesville |

**Proposed routes**

Every round runs on a closed loop. The six rounds are far apart, so the gaps between them include long-distance travel. A preliminary run is **strictly one lap** of the course, and the lap count takes the final past 300 km. A lap is at most **80 km** and at least 10 km. The final's lap count is the smallest whole number of laps that reaches 300 km, using the measured lap length.

| Rd | Route | Lap (measured) | Final laps |
| --- | --- | --- | --- |
| 1 | Adelaide Hills Gorge Loop: Magill, St Bernards Road and Gorge Road along the Torrens Gorge to Cudlee Creek, Lobethal Road to Lobethal, then Basket Range and Old Norton Summit Road back to Magill | 66.4 km | 5 (332 km) |
| 2 | Yallingup and Metricup Loop: Cowaramup, Harman's Mill Road and Caves Road to Yallingup, Wildwood Road and Metricup-Yelverton Road, then the Bussell Highway back | 62.3 km | 5 (311 km) |
| 3 | Mount Nebo–Mount Glorious Loop: The Gap, Waterworks Road and Mount Nebo Road up to Mount Nebo, Mount Glorious Road down to Samford, Samford Road and Settlement Road back to The Gap | 57.4 km | 6 (344 km) |
| 4 | Jamberoo Mountain Loop: Jamberoo, Jamberoo Mountain Road up to Robertson, the Illawarra Highway down Macquarie Pass to Albion Park, and Jamberoo Road back | 63.8 km | 5 (319 km) |
| 5 | Marysville and Buxton Loop: Marysville, Buxton–Marysville Road to Buxton, then the Maroondah Highway over the upper Black Spur to Narbethong and Marysville Road back | 42.1 km | 8 (337 km) |
| 6 | Healesville Hills Loop: Healesville, the Healesville–Kinglake Road through Chum Creek to Toolangi, the Melba Highway to Dixons Creek, then Old Healesville Road and the Healesville–Yarra Glen Road back to Healesville | 52.6 km | 6 (316 km) |

**How these were measured.** `tools/routes/measure_routes.py` routes each course through its waypoints on OpenStreetMap road data (public OSRM server) and records the lap length, the share of the lap driven twice and any motorway. The lengths above are road distances along the chosen roads and will be re-checked in the final sector survey. Several loops share a short stretch of road (for example the start of Round 3 and the suburban start of Round 1); none is an out-and-back. Several other regions were tried and dropped because they could not close into a loop within 80 km without a motorway, a dirt road or a long retrace: the Oxley Highway, Mount Hotham, the Great Ocean Road, the Royal National Park, the Cethana roads in Tasmania (a loop there is 83.8 km) and a Barossa loop (which retraced 14% of its length).

**Course outlines.** The same script saves each route's outline to `data/courses/outlines.json` for the track map and the timing view. Each outline is a simplified, flattened path (about 80–300 points) with the cumulative distance in kilometres at every point, so sector boundaries, car positions and drone markers can be placed by distance along the lap. See "Course outlines" in the development specification.

## Weekend format & Management Interface

Each round is a 7-day practice week, then 7 days of preliminaries for a field of at least 300 entries, then a final race of at least 300 km for the top 15.

1. **Practice (7 days).** The course opens for practice a week before the prelims, with as many tyre sets as each entry needs. Round 1 Practice Day 1 always opens on **March 31st**.
2. **Preliminaries (7 days).** A prologue-style time attack: each entry gets **exactly one lap**, and that time sets its placing. Entries start one at a time, at set intervals, in a published running order. The order is seeded: drivers with championship points are spread evenly through the order across all seven days, and everyone else is placed by random draw. Seeding uses the current championship standings. In Season 1 (2031) there are no earlier standings and no points yet, so the Round 1 running order is a random draw.
3. **Dry and clear only.** Prelim runs are only held in completely dry, non-overcast conditions. A rainy or overcast day becomes an extra practice day and pushes the prelims back a day, so every round gets seven full prelim days. On these gap days, entries may practise on non-racing tyres to save their racing set.
4. **One racing set.** Once the prelims start, each entry gets one racing set for its single prelim lap. A wet day pauses the running order, which resumes on the next dry, clear day.
5. **Prelim classification.** Positions 16–31 score points from their prelim placing. Everyone below 31st scores nothing.
6. **Final race.** The top 15 start the final on a fresh set of race tyres, gridded in prelim order, over a minimum of 300 km, with no pit stops or tyre changes. The final result sets positions 1–15.

**Implementation note:** AI prelim times come from a formula (driver skill, car power and weight, course fit, track temperature roll, random variance). Only the 15-car final is simulated in full.

**Race UI & Simulation View:** Races are presented as a **pure management interface** complete with real-time timing screens (sector splits, delta speeds, tyre life) and an interactive **live map** tracking car locations and drone markers.

**Round timeline.** A round takes at least 15 days: 7 practice days, 7 prelim days (longer if wet days push them back) and the final race the day after the prelims. The rounds are spread over the whole country, so there are about three weeks between rounds for repairs and long-distance travel (SA to WA to Queensland). Six 15-day rounds with five three-week gaps run from 31 March to mid-October, followed by an off-season for contracts, numbers and car building.

**Round timeline from 2036.** The Junior round follows the Super Series final at the same venue: Junior practice day 1 is the day after the Super final, then 3 practice days, 5 prelim days and the Junior final the day after, a 9-day block. A round slot becomes 15 + 9 = 24 days. Six slots (144 days) plus about 11 days between rounds finish in mid-October, so the season still ends on schedule. Garages with entries in both series keep their crews, trucks and tyre stores at the venue between the two events.

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

- **Recognised nations only.** A flag is any country or territory recognised by at least one of the FIA (through its member national sporting authorities), the International Olympic Committee (National Olympic Committees) or FIFA (member associations), stored as its code (the two-letter ISO 3166-1 code where there is one, for example `AU`, `JP`, `SE`). This includes territories and home nations that these bodies recognise, such as Hong Kong, Puerto Rico, the Faroe Islands, Gibraltar, Palestine, and Chinese Taipei (`TW`). England, Scotland, Wales and Northern Ireland do not race under their own flags at the start (see "The United Kingdom shrinks" below); they race as the United Kingdom (`GB`). The set is available from day one.
- **Defaults.** A new driver's flag matches their nationality, a new garage's matches its home country, and a car's matches its manufacturer's home country. The player may change any of these when creating or registering an entry.
- **Changes.** A flag can be changed in the off-season at entry registration. Each change is logged in the record, and a driver or garage that switches flags loses some fame (similar to a number change).
- **Livery.** Flags sit with the panel they belong to: the garage flag beside the garage name on the front quarter panels, the driver's flag beside their trophies on the right rear (driver's side), and the car's flag beside its trophies on the left rear (passenger's side).
- **Timing screens and broadcast.** The flag appears beside the number and name in timing towers, results and broadcast graphics.
- **Records.** The flag a driver, car or garage raced under is recorded for every entry, so history shows which flag took each win.
- **Standings.** Drivers and garages also compete in national standings by flag (see "Standings"). Car flags have no standings.
- **Short and long names.** Every flag has a short name for the interface and general use (for example "Australia") and a long, formal name for standings, celebrations, the podium ceremony and similar occasions (for example "Commonwealth of Australia"). Where the two are the same (such as Japan) the long name repeats the short one. Both live in `data/flags.json` under `names`, so mods can change them, and the interface chooses which to show by context (short in lists, tooltips and the timing tower; long in the standings headings, trophy and anthem moments, and commentary at celebrations).
- **The United Kingdom shrinks.** At the start of a career, England, Scotland, Wales and Northern Ireland do not compete separately: every driver, car and garage from any of them races under the United Kingdom flag (`GB`, short name "United Kingdom", long name "United Kingdom of Great Britain and Northern Ireland"). Over a career the United Kingdom can shrink in three ways, and none is guaranteed:
  - **Northern Ireland joins Ireland** (reunification). Northern Irish drivers, cars and garages move to the Irish flag (`IE`).
  - **Scotland becomes independent.** Scottish drivers, cars and garages move to the Scottish flag (`gb-sct`). Its long name from then on is "Republic of Scotland" (short name "Scotland").
  - **Wales becomes independent (last).** Wales can leave only after Scotland and Northern Ireland have both gone, so it is always the last step. Welsh drivers, cars and garages move to the Welsh flag (`gb-wls`), and England is all that is left of the union, so the United Kingdom ends: the `GB` flag and name are retired, and English drivers, cars and garages move to the English flag (`gb-eng`). From then on the long names are "Kingdom of England" (short name "England"), "Principality of Wales" (short name "Wales") and "Republic of Scotland" (short name "Scotland", as it has been since its own independence).
  - **The long name follows the union.** While it exists, the short name stays "United Kingdom" and the flag stays `GB`. The long name changes with what is left: "United Kingdom of Great Britain" once Northern Ireland has joined Ireland (England, Scotland and Wales remain); "United Kingdom of England, Wales and Northern Ireland" if Scotland leaves first; and "United Kingdom of England and Wales" once both have left. If neither happens, it stays "United Kingdom of Great Britain and Northern Ireland".
  - **When.** Each event is drawn separately per career (named streams `world:reunification:northern-ireland`, `world:independence:scotland` and `world:independence:wales`; Wales is only drawn once the other two have happened, and can occur in the same off-season or later), within 2034 to 2070 and never in the first three seasons, and each can also never happen in a given career. The political climate makes the United Kingdom's changes more likely than not, with a single roll each and no extra layer (proposed, tunable in `data/flags.json`): Northern Ireland rejoining Ireland 75% (the Good Friday Agreement provides for it), Scotland leaving 60%, and Wales leaving 40% once the other two have gone. Spain is the opposite, with its extra layer that usually means nothing happens. Northern Ireland and Scotland can go in either order or in the same off-season, and Wales always after both. The player is never told the dates in advance.
  - **What changes.** Only people from the region that leaves change flag, taken from their hometown and base in the same flag and hometown fields. Flag standings, fan counts and records follow the move, and old history keeps its original flag with a note. Headlines, commentary and a storyline card mark each event.
- **Spanish regions can become independent.** Until it happens, drivers, cars and garages from the Basque Country, Catalonia, Galicia and the Canary Islands race under the Spain flag (`ES`). Each of the four can become an independent nation at its own random point in the future, drawn separately per career from the named streams `world:independence:basque`, `world:independence:catalonia`, `world:independence:galicia` and `world:independence:canaries` (between 2034 and 2070, never in the first three seasons, and each may also never happen in a given career). There are two layers of chance (proposed numbers, tunable in `data/flags.json`). First, a single roll per career, from the named stream `world:independence:spain`, decides whether Spain breaks up at all, and there is a high chance (75%) it never happens, in which case no region leaves. Second, if it does, each region has its own chance, in this order: Catalonia and the Basque Country the most likely (60% each), Galicia third (40%) and the Canary Islands last (25%). Overall that is about 15% for Catalonia and the Basque Country, 10% for Galicia and 6% for the Canary Islands in any one career. Independence takes effect in an off-season with headlines, commentary and a storyline card. From then on the new flag is available (`es-pv`, `es-ct`, `es-ga`, `ic`) with a short and a long name (long / short: "Basque Country" / "Basque", "Catalonian Republic" / "Catalonia", "Republic of Galicia" / "Galicia" and "Republic of the Canary Islands" / "Canary Islands", the last short name being my assumption), and each driver, car and garage with a hometown and base in that region moves from `ES` to it. Spain keeps its flag and its other drivers.
  - **Same mechanism as the UK changes.** The UK and Spanish events are "world change events" in `data/flags.json` (`splits`): a list of the flag changes, the window of years, the chance it happens at all, and which hometowns move. Mods can change them, turn them off, or add others, and the base game never shows the dates to the player in advance.
- **Vyktory (rare easter egg).** There is a 1 in 31,031,996 chance, rolled once per career at the start of the 2032 season from the named stream `world:easter:vyktory`, that Australia (`AU`) renames itself the "Commonwealth of Vyktory" (short name "Vyktory") and adopts the Vyktory flag (gold and white, with a maroon and black "V"; `assets/flags/vyktory.svg`). It is a nod to a fictional nation of Nexxus Drako Multimedia.
  - **What changes.** The flag, short name and long name change everywhere from then on, in the interface, standings, commentary and celebrations, for the rest of the career. The code stays `AU`, so standings, fans, records and saves are unaffected, and the Australian rounds and roads are still the same. Old history keeps the old name.
  - **How it is shown.** A short headline, a commentary line and the new flag appearing. The commentary line breaks the fourth wall: the team knows they are in a game and blames it on something humorous, picked at random from a small set of templates, such as divine intervention, a cosmic-ray bit flip, a bad random number, a corrupted save file, or the developer having a very good idea at 3 a.m. The team plays it dry (Alistair Thorne reads it straight, Reece Calloway is baffled, Kazumi Aikawa is unbothered, and José Antonio Carrera asks about the paperwork). The game never says it is rare or an easter egg. The lines are in `locales/en.json` and the commentary data, so mods can add more.
  - **Secret achievement.** Seeing it unlocks one secret achievement, "Hail Vyktory", whose text is not shown until it is earned. It follows the normal achievement rules (disabled in the Founder's career and in careers using balance mods) and counts only if the rename actually happens in the player's own career.
  - **Data and mods.** The event is data (`data/flags.json`, `renames`), so mods can change or turn it off. The flag is part of the game's art under the GPL, but the Vyktory name and design are fictional-world material of Nexxus Drako Multimedia and stay under the trademark policy (see `TRADEMARKS.md`).
- **Hidden heritage (dual nationality).** Drivers, cars and garages from a region that can change flag (England, Scotland, Wales and Northern Ireland; the Basque Country, Catalonia, Galicia and the Canary Islands) carry a hidden second flag, their heritage flag, which is the flag of the nation the region could become (`gb-eng`, `gb-sct`, `gb-wls`, `IE` for Northern Ireland, `es-pv`, `es-ct`, `es-ga`, `ic`). It is set from their hometown (or the garage's base) when they are created.
  - **Stats count to both.** Everything a person earns counts for their current flag and for their heritage flag: points and wins in the nation standings, fans, records and awards. The heritage tallies are kept from the first season and are hidden, so on the day a region becomes a nation it already has its history: its champions, its record holders and its fan base. Nation standings count the same person under two flags, so their rows are not added together (like fans, see "Fans").
  - **Hidden until it matters.** The heritage flag is not shown, and the nation standings only list a flag once it exists as a racing flag. After the flag becomes available the person moves to it (see the events above), and the history stays with them.
  - **Which regions.** The base game records heritage for every region it can ever split (so the Welsh and English tallies exist for mods that split the United Kingdom further), and mods can add regions.
  - **Data.** The mapping from hometown region to heritage flag is data (`data/flags.json`, `heritage`), and each person's heritage flag is stored in the `heritage` table (`subject_type`, `subject_id`, `flag`) so history can be recalculated.
- **Excluded flags.** Everything outside the recognised set is excluded, including Antarctica (`AQ`) and the international organisations: the Arab League (`ARAB`), the Association of Southeast Asian Nations (`ASEAN`), the Central European Free Trade Agreement (`CEFTA`), the East African Community (`EAC`) and the United Nations (`UN`). The European Union (`EU`) and flags such as Catalonia, the Basque Country, Galicia, the Canary Islands and Saint Helena are also outside the set at the start, because none of the three bodies has a member for them; the four Spanish regions can join it later (see "Spanish regions can become independent"). (Kosovo is in, because the IOC and FIFA both recognise it.) The explicit exclusions are listed in `data/flags.json` under `excluded`, and the recognised set will be listed there under `recognised`, built from the three bodies' official member lists by a tool in `tools/data`. Excluded flags are left out of the flag picker, flag standings and name generation, and a test checks that no world uses them. Mods can add recognised flags only if they cite the body that recognises them, and they cannot remove the exclusions.
- **Neutral and disputed flags.** All flags are treated equally in the game, with no political commentary. Territories are allowed when the FIA, IOC or FIFA recognises them.
- **Artwork and licensing.** Flag emoji do not render on Windows, so the game draws flags from a bundled image set keyed by ISO code (`flag-icons`), not from emoji text. Every flag asset must come from an open licence (for example SIL Open Font License, CC BY-SA, MIT or Apache 2.0). The chosen set is `lipis/flag-icons` (MIT licence). Checked against version 7.6.0 (4x3 set): it has art for all 249 ISO country codes, the extra flag emoji (Ascension, Tristan da Cunha, Clipperton, Diego Garcia, Canary Islands, European Union and United Nations, the last of which is excluded) and England, Scotland and Wales (only Scotland can ever be used, after it leaves the United Kingdom; see "The United Kingdom shrinks"). The only gap is Ceuta & Melilla (`EA`), which commonly shows the Spanish flag in emoji fonts, so it uses the `ES` art. The set also contains extra flags with no emoji (for example Kosovo, Catalonia and Northern Ireland), which stay out of the default flag picker and are available to mods. The licence of each asset set is recorded in `CREDITS.md` and shown in-game, and flag art is kept in its own folder so share-alike terms stay contained. The emoji is used only in text exports.

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
- **Built so far (M5, standings and season end).** The five tables are built (`src/sim/standings.ts`, with `computeStandings` in `src/db/season.ts`): the Driver Championship with its full tiebreak (most wins, then 2nds and so on, then the best prelim time at the final round), and the garage, manufacturer and nation tables from each group's best two results per round (a flag's garages each score their best two first). `endSeason` closes a season once all six rounds are complete: it pays the champion's garage $10,000,000, pays the pole and overtake bonuses that built up through the year, gives a gold border to every driver who reached a final, records the two champions and saves the final tables as `standing_snapshot` rows.
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

Numbers 1–40 follow last season's rankings (and the top 40 must take them) and 41 and up are open to anyone, the champion's number is boxed in black, and a gold border marks anyone who has ever reached a final.

**Race numbers & Special Numbers**

- **Numbers 1–40: last season's rankings, and mandatory.** From 2032 onwards the driver who finished 1st must take #1, 2nd must take #2, and so on down to #40. A ranked driver cannot turn their number down. If a ranked driver is not racing in the Super Series this season (retired, or moved to the Junior Series), their number is free, and it goes to the best-ranked racing driver after 40 who has no number yet. Everyone else applies for a number from 41 up. The rule is built as `rankingNumbers` in `src/sim/numbers.ts`; the season rollover that applies it comes in M5.
- **Season 1 (2031).** The series has no history, so there is no ranking: every number except #313 is open, and 1–40 are handed out like any other number. There is no black box and nobody has a gold border until the first final is raced.
- **Numbers 41 and up: open to anyone.** Any driver may apply for any free number from 41 upward. Numbers are re-chosen each season, and last season's holder gets first refusal.
- **Number #313 (Reserved):** Permanently retired and reserved for founder Pyra Drake.
- **Clashes** (decided by the series office under Ingrid Halloran): after first refusal, priority goes to gold-bordered drivers first, then more career points, then earliest registration.
- **Black box:** the reigning champion's #1 carries a black box.
- **Fame:** a number builds recognition over time; changing it resets some of that. Taking a ranked number (1 to 40) does not reset it: the driver keeps the number fame they have built, and the fame of a ranked number they hold carries on in the same way.
- **Preferred number.** Each driver has a preferred number, the one they chose for themselves (stored as `driver.preferred_number`, set when they are created). It stays part of their legacy, shown on their profile and in the records, even while a ranked number has to be worn, and a driver who is no longer ranked can go back to it (with first refusal, see above).

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

The Equalizer is the series' only real technical rule: a car's maximum tyre width is set by its kerb weight. The limit always wins over the series' minimum tyre width, so a very light car (such as a 640 kg one, limited to 168 mm) never ends up on tyres wider than it is allowed. There are no power limits, no ballast, no budget cap and no success ballast.

**Season rollover (built, first version).** `startNextSeason` opens the next year once the last has ended. Drivers from 36 up may retire (8% a year per year over 35, always at 50; a player's own garage is never touched), and a rookie aged 18 to 21 with a lower pace takes the seat on a contract at half the salary. Expiring contracts are renewed for a year on the same terms until negotiation has screens. Numbers 1 to 40 follow last season's final table, drivers keep a free number of 41 or more, and the rest take the lowest free ones. The numbers are in `data/balance.json` (`season`).

**Garages closing and opening (built).** At each rollover every computer garage is first paid a season's sponsorship (`$40,000 + $1,500 × prestige` for each entry, `season.garages` in `data/balance.json`; a computer garage has no other income yet apart from prizes), and then its books are checked: a garage that ends the season with negative cash counts a broke year (back in the black it starts again), and after two broke years in a row it closes (`garage.closed_year`, `broke_years`). The player's garage and Drake Motorsports never close. A closed garage's entries are not carried over, its contracts end (its drivers are free agents), and its cars go on the used market. The year's three to ten new garages (as many as the field has room for) are one-car teams of prestige 6 with a generated name, nation, base and colours, 5 fans, a used starter car and a driver: with 60% chance the best of the free agents (picked among the top five), otherwise a rookie. With these numbers the field stays near 320 entries with a few closures a year. Draws come from `rollover:<year>:garages` and `rollover:<year>:garage-drivers`.

**Driver development (built).** Each rollover, every driver who carries on grows or declines along their own curve. A curve is drawn from the career's seed and the driver's id (stream `curve:<driver id>`, so it is the same every time and is not stored): a growth age of 23 to 30 (raw speed; judgement stats, racecraft, composure and consistency, peak two years later), a decline age of 31 to 37, a growth rate of 0.7 to 1.4 times and a decline rate of 0.7 to 1.4 times, so there are early and late bloomers, quick learners and gentle or harsh fades. Growth runs at full rate until the growth age, fades in a straight line over three years and stops; from the decline age stats slip (`0.5 × years over × decline rate`, judgement stats at half that). Pace closes 20% of the gap to potential each year; other stats gain 1.5 a year. Potential is a soft cap: pace never rises above it without training, and other stats gain less the further they are above it, down to nothing 15 points over. A little noise, from `rollover:<year>:growth`, is added to every stat. Numbers are in `data/balance.json` (`season.progression`).

**Training (built).** A garage can train each driver it has entered, from level 0 (none) to 3: coaching ($20,000 a season, +25% growth, 30% less decline, potential soft cap +2), a programme ($60,000, +50%, 60% less, +4) or an elite programme ($150,000, +80%, 90% less, +6). Training is paid for from the garage's cash at the end of the season (ledger category `training`) and then applies to that rollover's development, so a trained driver improves faster, keeps their peak much longer and can climb a little past their potential. A garage that cannot pay gives none, and the driver's level resets to 0. The player sets levels in the Drivers panel. Computer garages pick a level of one per 20 prestige points, lowered until they hold three times its cost. Drivers whose garage closed are not trained.

**World changes (built, first version).** The UK and Spanish events are data in `data/flags.json` (`worldChanges`: the window, the Spain gate, each event's chance, prerequisites, regions and target flags, and the union's long names). `planWorldChanges` draws each event's year from its named stream when the career is made, and `applyWorldChanges` runs when a season starts: people whose hometown (or a garage whose base) is in the region move to the new flag, flag names are recorded in the `flag_name` table, and the event goes in `world_event`. When the United Kingdom ends, anyone still carrying `GB` goes to England's flag. Cars keep their flag, which follows the maker. Not built yet: the hidden second flag, headlines and cards, and the Ultimate Vyktory forcing.

**Driver identity (built).** A driver is described as masculine, feminine or non-binary (`driver.identity`; about 4% of drivers are non-binary, `worldgen.driver.nonBinaryShare`, drawn from a separate stream so it never changes the rest of a world). It shows as pronouns (he/him, she/her, they/them, from `locales/en.json`) and as the male sign (♂), female sign (♀) or the combined male and female sign (⚥). `driver.gender` stays as the name pool the name came from and has no other use. Rookies get the same chance each season.

**Hidden drivers (built).** Twelve fictional driver characters, trademarks of Nexxus Drako Multimedia, take twelve seats in the starting field of every career (`data/easter_drivers.json`, seats chosen from the named stream `worldgen:easter`). They keep their generated pace and other stats, have maximum potential (99), and carry a dragon emoji (🐉) with a deliberately cryptic hint, "The dragon blood flows through this one." Nothing else explains them. They race under their own nations until the Vyktory rename happens in a career, when they take the Vyktory flag (`AU`).

| Driver | Nation | Identity |
| --- | --- | --- |
| Alyx Southgate | England (`GB`, hometown in England) | Non-binary |
| Kalliope Northbridge | Singapore | Non-binary |
| Svetlana Reznikov | Ukraine | Feminine |
| Haruka Nakano | Japan | Feminine |
| Skyla Morrison | Australia | Feminine |
| Violet Trethvick | Ireland | Feminine |
| Alexis North | Australia | Non-binary |
| Dae Blake | New Zealand | Non-binary |
| Samuel Goldsmith | Bahamas | Masculine |
| Jack Monkhouse | Australia | Masculine |
| Aisi Smith | Tuvalu | Non-binary |
| Elli Richter | Liechtenstein | Feminine |

The Vyktory rename itself is now built too: `planWorldChanges` rolls it once per career (1 in 31,031,996, for 2032) and `applyVyktory` renames Australia and moves the hidden drivers.

**First screens (built, plain).** The title screen is the Garage owner setup: the owner's name, how they are described, date of birth (18 to 50), and the garage's name, flag and two colours. `foundPlayerGarage` makes the smallest starting garage the player's (the field stays at 96 garages and 313 entries), with $250,000, prestige 1, 5 fans and its one entry kept as the starting driver and car; the owner then picks one of three cheap starter cars and one of five unknown driver prospects (`createStarterOffers`, `chooseStarter`, from the named streams `starter:cars` and `starter:drivers`); the garage's old car goes on the used market, its old driver becomes a free agent, and the cars and prospects passed over go to the market and free agency too, and nothing can be run until the choice is made. The hub shows the garage, the calendar, buttons to run the next prelims and final, end the season and start the next, and the drivers' table, plus save, load and export. The old debug panel is gone.

**Cars screen (built, plain).** The hub lists the player's cars and the used market. A car can be bought from a listing if the garage can afford it, and a car the garage owns can be put into the entry before the season starts (`setEntryCar`); once a round has run the entry's car is fixed. Upgrades, the dealer, the auction and driver signing still have no screens.

**Game shell (built, first version).** Taking its feel from management games such as WORKS: Motorsport Factory (a working place rather than menus, dense data panels, a dark slate look with a maroon accent), the screen is a top bar (garage name and year, balance, the next round and one button for the next thing to do), a right-hand rail that opens panels (Season with the calendar and the drivers' table, Cars, Market, and later Upgrades, Staff, Sponsors and Money) and a garage floor showing each entry with its number, driver, car and condition bar, above a news strip. Panels are dialogs that close with a button or Escape, and the starter choice is a panel that cannot be dismissed. Colours are theme tokens (`--color-lc-*` in `src/index.css`) so the design-system themes can replace them. The top-down garage map and a running game clock with speed controls are still to come; the art and layout are our own, not copied.

**Upgrades panel (built).** The rail's Upgrades panel lists every part for the selected car by category and grade, with its supplier, effects (power, weight, grip, handling, traction and legality cost) and the price this garage pays after any supplier deal. Fitting a part replaces the one already in its category, and a fitted part can be removed (it has no resale value). The panel shows the car's kerb weight, tyre width against the Equalizer limit, the road-legality score out of the budget and whether it would pass scrutineering. Part wear and servicing, and designing your own parts, still have no screens.

**Sponsors and Money panels (built).** The rail's Sponsors panel shows the garage's title sponsor (name, season fee and last year) or, with none, the sponsors its prestige lets it approach; Negotiate opens the existing sponsor negotiation, where the player names a season fee and a length of one to three years, and the sponsor accepts, counters lower or walks away (and will not talk again that year). The Money panel shows the garage's cash, income and expenses so far and the ledger by category (prize money, championship prize, bonuses, sponsors, merchandise, entry fees, tyres, servicing, travel, repairs, release fees, gear, parts, restoration and car purchases and sales). Staff is still to come.

**Entries (built).** The Cars panel lists the garage's entries (number, driver and car) and can add one: choose a spare car the garage owns that is not racing and a driver under contract who is not racing, and the entry takes the lowest free race number from 41 up (never #313). A garage may have up to eight entries and always keeps at least one; entries can be added or withdrawn until the first round starts. Each extra entry adds its own entry fee, tyres, servicing and travel every round (up to about $8,550 in all), and its results score separately for the driver, the garage and the other tables.

**Drivers panel (built).** The rail's Drivers panel lists the drivers who have no seat this season (free agents: unchosen starter prospects, released drivers, and anyone not entered), best first, with their rating, stats and a hint at a fair salary. Negotiate opens the existing contract negotiation: the player names a salary and a length of one to five years, and the driver accepts, counters or walks away (and will not talk again that year). A signed driver can be put in the garage's entry before the season starts (`setEntryDriver`); the driver they replace stays under contract but is not racing. Drivers entered with another garage cannot be signed until their season ends, and a second entry for a second driver is still to come.

**Recognised flags (built, first version).** `data/flags.json` now names 214 nations and territories, each with a short and a long name (for example "Czechia" and "Czech Republic"), and the garage flag in the new-career screen lists all of them. They were put together from the three bodies' member lists as I know them (the FIA's national authorities, the IOC's National Olympic Committees and FIFA's associations), so the list should be checked against the official lists before release. The 15 nations with fan populations keep them, and any other flag starts with no national fan base. Excluded flags and the home nations that only appear after the splits are not in the list.

**Layout handicap (built).** As in the real series, four-wheel-drive and mid-engine cars are handicapped: their maximum tyre width is 10 mm less than the kerb-weight figure (`data/balance.json`, `upgrades.handicapMm`, so mods can tune it). A car model's listed limit is the base figure; each car's own limit and tyre width apply the handicap, and scrutineering checks against it.

**Awards at the flag (built).** Everything a race earns is given out when it ends: prize money, the gold border for a driver's first final, a win decal on the winning driver and car, and any new titles. Pole and overtaking bonuses add up through the year and are paid at the end of the season with the champion's prize (more bonus kinds can be added to `season_bonus`), and the shield decals for the champions are added then.

**Name generators and nicknames (built).** People, garages, cars and nicknames come from themed, categorised generators (`data/names/`): garages from eleven themes (heritage, engineering, animal, place, myth, speed, vintage, touge, bush, business, colour), car models by category (hypercar, supercar, JDM, sports, domestic, other) with real model names denied, and nicknames such as "The Midnight Ghost" chosen from the road a driver calls home and how they race. About 40% of drivers have one. One nation in twenty is picked with no weighting at all. Drivers also earn titles (`data/titles.json`) for career feats, as in Wangan Midnight and Tokyo Xtreme Racer, and equip one.

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
- **Scrutineering.** Kerb weight, tyre width and road legality are checked after each run and race by the series' technical team under Declan Marsh. Tyres over the limit mean disqualification.
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

- **Built so far (M4, upgrades).** Thirty parts: ten categories (engine, intake and exhaust, forced induction, ECU, drivetrain, suspension, brakes, weight reduction, aero, wheels), each in street, sport and race grades, from six fictional suppliers (Outback Racing Parts, Kobato Works, Stahlwerk Dynamik, Pista Corsa Components, Nordvik Lightweight and Gridline Drivetrain), priced from $400 to $60,000 (see `data/parts.json`). A car carries one part per category, and buying a part for a category replaces the old one. Prices are multiplied by the tier's upkeep factor. Parts add power as a percentage of the model's, change weight, and add small bonuses to grip, handling and traction, which the prelim and final simulations use. Weight reduction lowers the Equalizer limit, so the tyres narrow with it, which still nets a grip gain because a lighter car gets more tyre per kilogram.
- **Road legality (built).** A stock car has a budget of 100 and every part uses some of it (street parts 0 to 5, sport 0 to 18, race 8 to 30). A score below zero is not road legal. Scrutineering checks it, and the tyre width against the Equalizer, before each prelim round: a car that fails is disqualified, does not run, gets no time and is recorded as `disqualified`. A garage can fit too many parts, but the car cannot race until it removes some, and parts have no resale value.
- **Built so far (M4, repairs and servicing).** Fitted parts now wear: every kilometre raced wears each part twice as fast as the chassis, and the wear of the most worn part adds to the chance of mechanical trouble in the final (a part at 100 wear is as risky as a worn-out chassis). A garage can service a car's parts, which resets their wear for a quarter of each part's price (after any supplier deal) in proportion to how worn it is. The chassis can only be restored: it takes all the wear away for 12% of the car's new price in proportion to the wear, and later kilometres wear it from zero again (a restoration is recorded as a wear offset, so the car's kilometres and history are kept). A car that crashes in a round (a prelim run or the final) costs a repair bill of 3% of its new price, charged when the round is settled.
- **Course setups.** Gearing, suspension and tyre width can be changed between rounds to suit each course.
- **Road legality.** Every part has a legality rating. A car that stops being road legal fails scrutineering and can't be driven home.
- **Suppliers.** Every part comes from a supplier. Fitting it earns that supplier a door spot and its contingency bonus.
- **Wear.** Parts and the chassis wear with distance and need servicing or replacing. Racing kilometres wear a car ten times as much as everyday and travel kilometres (see "Wear and reliability").
- **Model year.** Every actual chassis has its own model year. A car built before a model's latest refresh is still a car of that model; its age and use set its wear and value.

## Founders, Special Vehicles, and Ghost Record

- **Pyra Drake:** Founder and chairwoman of Last Combustion. Born in **1996**, she celebrates her **35th birthday** in Season 1 (2031) and her **40th birthday** in Season 6 (2036). The opening ceremony and Round 1 practice always take place on her birthday, **March 31st**. She is a self-insert character and one of the best drivers in history, but does not actively race in LC main events. Her role is setting the first-ever course records, and her number **#313** is permanently retired. Her hometown is Healesville, Victoria, and she lives in Brisbane, Queensland.
- **Drake Motorsports:** Pyra Drake's personal team, based in **Brisbane**, Queensland, where she is founder and owner, with her unique vehicle being a fictional Mazda RX-7 expy called the **Homura Spirit R-7** (rotary-powered lightweight sports car).
- **Series management (Declan Marsh and Ingrid Halloran):** two administrators who are not related to Pyra or to each other run the day-to-day operations of Last Combustion from the Healesville headquarters, where they both live. Pyra remains chairwoman.
  - **Declan Marsh**, technical administrator, runs the technical side: the regulations and the Equalizer, scrutineering, telemetry, the drone fleet and the attention-flag AI. In the game he issues technical bulletins, scrutineering rulings and rule-change announcements.
  - **Ingrid Halloran**, interpersonal administrator, runs the interpersonal side: relations with garages, drivers, sponsors, suppliers and the media. In the game she handles number clashes, penalty appeals, entry disputes, ceremonies and the headlines about the series.
  - They appear as senders of messages and in the headlines, and they never race.
  - **Ageing.** They age like everyone else, and a successor takes over when they retire or die: one of their children or an unrelated person in a similar role (see "Commentary team", "Ageing and succession").
  - **Fictional characters.** "Declan Marsh" and "Ingrid Halloran" are fictional people, unrelated to any real person, and their names are placeholders that Nexxus may change.
- **Healesville HQ & Motoring Festival:** Healesville, Victoria is Pyra Drake's hometown and the global headquarters of Last Combustion. Every year on **November 11th**, Healesville hosts the Last Combustion Closing Ceremony and Awards Gala, kicking off the week-long **Drake Motorsports International Motoring Festival**.
- **Ghost Record:** Before every prelim session, a giant version of the series drones hovers over the course to project a ghost car. Each driver picks their ghost from six cars at the start of their own run: one of the top 5 drivers from last year's main series, or Pyra Drake's #313 Homura Spirit R-7 from the course's demo runs. In Season 1 there is no last year, so the ghost is Pyra Drake's #313 demo run only.
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

- **Course data.** Each course is split into sectors, each tagged with a road type (forest, coast, mountain, night), corner density, elevation change, straight length, road width and overtaking spots.
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

## Final race engine

The M3 engine plays the final sector by sector for the whole field at once. All numbers are in the `final` block of `data/balance.json`.

- **Grid and traffic.** The 15 qualifiers start in prelim order, 1.5 s apart. Cars keep a minimum gap of 0.25 s, and a car within 3 s of the car ahead is "close" and loses time stuck behind it.
- **Overtakes.** A pass can happen only at an overtake spot, when the attacker is within 0.5 s. The score is 50 x speed advantage + racecraft difference / 100 + a stance bonus, and it must beat 0.25 (0.40 on narrow roads). A close failed pass can end in contact (5 s penalty, damage, a slower defender). Each completed pass pays the garage $10,000 as an overtake bonus.
- **Calls.** Each player entry has a call: push (faster, more tyre wear, more incident risk), balanced, or conserve (slower, less wear and risk). Team orders are free, hold or swap. The computer sets calls for every other entry.
- **Tyres.** Tyre wear depends on the call, the driver's aggression and tyre management, and the car's wheelspin and slide. The base loss is set so a reference driver on a balanced call ends the race with about 8% life. Below 20% life the car loses time (a time multiplier, 0.003 per point), instead of the Fit multiplier used in the prelims.
- **Mechanical trouble.** Each sector has a small chance of a mechanical warning that grows with wear. A warning becomes a limp mode if the driver is conserving, and a retirement otherwise.
- **Crashes and drones.** A crash brings out a drone stop: the field holds for 60 s with 0.5 s between queued cars.
- **Weather.** One race in about eight has rain for 1 or 2 laps part-way through. It pauses the race so the player can change calls, and wet skill matters.
- **Pauses.** Events that need a decision pause the race. Results do not depend on where the player pauses.
- **Classification.** A car is classified if it finishes or completes at least half the distance. Positions 1 to 15 take points and prize money from `data/points.json` and `data/prizes.json`, and the pole-sitter's bonus is paid with the overtake bonuses (table `season_bonus`).
- **Records.** Sector exit times, tyre life and positions are stored in `timing` for the timing screens, prize money in `ledger` and the garage's cash, and racing kilometres and wear on each car.

## Incidents, rivalries and storylines

Things go wrong, people clash and stories build. This system turns the simulation's raw events into incidents the player can react to, rivalries between drivers, garages, manufacturers and nations, and storylines that run across practice, prelims, races, events and whole seasons. All of it is recorded in the event log, feeds the headlines and commentary, and moves fans, reputation and sponsor interest.

### Incidents

Incidents are rolled per sector from the incident formula (see "Formulas"), then given a type. Each has a cost, a way the player can respond, and a record.

| Scope | Incident | What happens | Player response |
| --- | --- | --- | --- |
| Practice | Breakdown | A worn part fails (see "Wear and reliability"); the session ends and the part needs repair or replacing | Order the repair before prelims, or swap the part |
| Practice | Crash | Damage and repair days; may rule the car out of the next session | Repair, or run the spare setup |
| Practice | Setup breakthrough | A run finds time; the garage learns a better setup for that course | Keep it, or keep it secret from rivals who watch the timing |
| Practice | Sandbagging | An entry hides its pace with a slow run; rivals misjudge it | Scout, or bluff |
| Prelims | Run ended | A crash or failure on the single lap means no time and no placing | None in the moment; repairs and apology to sponsors afterwards |
| Prelims | Wildlife on the road | Kangaroos and other animals can cross the road; drones warn, and a late warning costs a mistake | Drone alert; driver composure decides the reaction |
| Prelims | Blocked course | A stopped car brings the drone stop signal; the next runner is held and restarted | Accept the restart or protest |
| Final | Mistake and spin | Time lost (1–4 s and 10–25 s) | Push, balance or conserve calls |
| Final | Contact | Two cars touch; time penalty, damage, and rivalry heat | Appeal to Ingrid Halloran's office |
| Final | Mechanical failure | Engine, brakes, gearbox or tyre trouble from worn parts | Conserve to reach the flag, or retire |
| Final | Weather change | Rain, or a damp patch, arrives part-way | Wet skill and tyre calls matter |
| Final | Lost grip | An over-driven tyre set loses grip in the last kilometres | Conserve earlier |
| Final | Drone stop | A crash ahead blocks the road; the following cars are held | Hold position, attack or defend on the restart |
| Event | Scrutineering finding | A car found over the Equalizer limit or not road legal loses its result | Appeal; Declan Marsh's team rules on it |

- **Pauses.** The simulation pauses for the player on contact, a mechanical warning, a drone stop, a weather change and an attention flag.
- **Consequences.** Every incident writes an event-log row with its scope, the entries involved and the point on the lap (distance along the outline). Damage and retirement follow the existing rules.
- **No deaths.** Incidents cause damage and injury time only (see "Careers over time").

### Rivalries

A rivalry grows from repeated meetings between two parties. Drivers are the main case, and garages, manufacturers and flags can also have one.

- **Heat.** Each pair has a heat score that rises with shared moments and decays 10% each round. Typical gains: finishing within 0.5 s of each other (+8), contact (+15), an overtake in the final (+6), a head-to-head in the title fight (+10 per round), a driver moving to the other's rival garage (+20), a public jab in the press (+10), taking a rival's race number (+10).
- **Levels.** Spark (heat 30), Rivalry (60), Feud (90) and, for a pair with at least five seasons of history, Legendary. A rivalry ends when heat falls below 10, a party retires, or a reconciliation event is accepted.
- **Effects.** Rivals who race each other draw extra broadcast attention and fans (fan gains ×1.1 at Spark, ×1.25 at Rivalry, ×1.5 at Feud). Head-to-head, both lose a little composure and gain racecraft aggression; sponsors and the media pay attention, and the next meeting appears in the headlines.
- **Limits.** A driver has at most three live rivalries. The player's drivers get a rivalry board with the history of meetings.
- **Other kinds.** Garage rivalries (Garage Championship battles), manufacturer rivalries (Manufacturer Championship battles) and nation rivalries (flag standings) use the same heat rules at a slower pace.

### Storylines

A storyline is a short arc of connected beats, built from the records and shown to the player as a thread. Storylines give the world memory without scripting every season.

- **Templates.** Storylines are data-driven templates: a trigger, up to five beats, and an outcome. Examples:
  - *Rookie on the rise*: an unknown driver scores in a prelim, then a first final, then the gold border.
  - *Comeback*: a driver returns from a bad crash.
  - *The last season*: a veteran announces their final year.
  - *Underdog garage*: a one-car garage reaches its first final.
  - *Hometown hero*: a local driver at the Healesville finale.
  - *Defending champion's slump*: a champion who loses form.
  - *Manufacturer war*: two makes fight for the title.
  - *Flag pride*: a nation's drivers rally.
  - *New model*: a manufacturer launches a successor and a driver is picked to race it.
  - *Rivalry feud*: a rivalry reaches Feud level and goes through a build-up, a showdown and an aftermath.
- **Beats across scopes.** A beat can happen in practice, in the prelims, in the final, at an event or at season level, and a storyline normally spans several. For example, *Rookie on the rise* might begin with a strong practice run, pay off in a prelim, and finish with a gold border at season end.
- **Choices.** Some beats give the player a choice: how to answer the press, whether to accept a sponsor's request, whether to protest. The choice changes the outcome and moves fans, reputation or relationships.
- **Outcomes.** Each storyline pays out in fans, reputation, relationship changes, sponsor interest and headlines, and writes to the history.
- **Pacing.** At most three storylines are highlighted for the player at a time, and the rest play out in the headlines. AI garages and drivers have storylines too.
- **Events.** Between rounds and at the festival, event cards bring stories to the player: press days, charity drives, a visit from Pyra Drake, technical bulletins from Declan Marsh and disputes handled by Ingrid Halloran.
- **Seasons.** Season-level arcs track the title fight, the Garage and Manufacturer Championships, driver retirements and new entrants, and the yearly lineup refreshes.
- **Moddable.** Templates, incident tables and rivalry weights are data files, so mods can add or change them.

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
| Road affinity | Separate ratings for forest, coast, mountain and night roads |
| Potential | Hidden ceiling for growth |

- **Profile.** Age, nationality, flag, hometown, residence, number, fans, fame, reputation, contract and salary.
- **Growth and decline.** Stats rise with experience on each kind of road and fall slowly with age.
- **Contracts.** Length, salary, lead or development role, and a release fee. Rival garages can make offers, especially after attention flags.
- **Junior pathway.** Junior drivers who reach a Super Series final earn gold and leave Junior eligibility.

## Personalities and traits

Drivers, cars and garages have traits, in the manner of an RPG. Traits give each one a recognisable character, make choices more than a stat comparison, and feed the incident, rivalry and storyline systems. Traits are data (`data/traits.json`), so mods can add or change them.

**Drivers (full depth).** Each driver has a personality and 2 to 4 traits.

- **Personality.** Five axes from 0 to 100: Temperament (calm to fiery), Ambition, Loyalty, Sociability and Discipline. They are generated with the world, drift slowly with events, and are visible only as descriptive words until the player has worked with the driver.
- **Traits.** Named, with a clear effect and sometimes a drawback. Examples: *Wet-weather Wizard* (wet skill bonus), *Tyre Whisperer* (less tyre loss), *Hot-headed* (higher contact chance, bigger rivalry gain), *Clutch* (composure bonus in the final), *Media Darling* (faster fan growth), *Homebody* (better on home road type, unhappy far from residence), *Loyal* (accepts renewals, rarely listens to rival offers), *Mercenary* (follows the money), *Mentor* (raises a teammate's potential growth), *Glass Jaw* (composure drops after a crash).
- **Earned traits.** Traits can be gained or lost through career events (a first win, a serious crash, a long rivalry), up to a cap of four.
- **Where they act.** Race calls and team orders (a hot-headed driver may ignore "hold"), negotiations (ambition and loyalty shift asking price and willingness to move), incidents and rivalries, and storyline cards.

**Cars (light).** Each chassis has up to 2 traits that come from its model and its history, such as *Balanced*, *Peaky power*, *Heavy front*, *Tyre eater*, *Cooks its brakes*, *Reliable*, *Restored* (a repaired car) or *Provenance* (auction-house history). Traits are small modifiers to the existing car ratings, wear or mechanical risk, and are shown on the car and at auction.

**Garages (light).** Each garage has a culture with 1 or 2 traits, such as *Family outfit*, *Data-driven*, *Penny-pincher*, *Talent factory*, *Old guard* or *Showboat*. They shape AI behaviour (spending, risk, how they treat young drivers, which sponsors they court), what a player garage's staff and drivers expect, and the tone of storylines.

**Rules.**

- Traits never replace stats. A trait is worth about +-1 to 3 rating points or a clear behavioural change, and every strong upside has a cost.
- All trait values and probabilities live in `data/traits.json` and `data/balance.json`, and generation uses the named stream `worldgen:traits`, so the same seed gives the same personalities.
- Trait names and descriptions are in `locales/en.json`.
- Founder's-career characters and the commentary team carry fixed traits written by hand.

**Build order.** M4 (negotiation) adds personality to driver generation and contracts, M5 adds earned traits and driver-development effects, M6 adds trait-driven incidents, rivalries and storylines. Car and garage traits arrive with the auction house and AI garage behaviour in M4.

## Driver gear

Drivers wear gear that adjusts and boosts their attributes: a helmet, a race suit, gloves, boots and up to two trinkets. Gear belongs to the driver, not the car, so it follows them to any garage.

**Slots.** Helmet, suit, gloves and boots (one each) and trinket (up to two). A loadout that breaks the slot limits is not allowed.

**Tiers.** Better tiers give bigger boosts, and every item stays inside the boost budget of its tier (the total points it adds across attributes).

| Tier | Boost budget | Price | How it is obtained |
| --- | --- | --- | --- |
| Basic | 1–2 points | $300–$800 | Gear shop |
| Club | 3–4 points | $2,000–$4,500 | Gear shop |
| Pro | 6–8 points | $13,000–$28,000 | Gear shop |
| Elite | 9–12 points | $70,000–$130,000 | Gear shop, or earned |
| Legendary | 12–16 points | Not for sale | Earned through a storyline, or found at auction |

**What gear changes.** Items boost Pace, Consistency, Racecraft, Tyre management, Composure, Wet skill, or one road affinity (forest, coast, mountain or night).

- **Cap.** Gear raises any single attribute by at most +10 in total, and no attribute goes above 99.
- **Set bonus.** Several pieces from the same supplier give a bonus: 2 pieces +1 Composure; 3 pieces +2 Composure and +1 Consistency; 4 pieces +3 Composure and +2 Consistency.
- **Effective stats.** The simulation uses a driver's stats with gear applied. The driver's own record is never changed, so taking gear off puts the driver back exactly where they were.

**Suppliers.** Gear comes from four fictional suppliers: Brumby Gear (Australia), Vanta Safety (Italy), Kinetic Works (Japan) and Nordlys Racewear (Sweden). Their logos can also appear on the driver's suit and helmet in a sponsorship deal (see "Sponsors and suppliers").

**Trinkets.** Small personal items such as Worn Dice, a Wattle Sprig or a Brass Stopwatch. Two special ones are never sold: the **Border Coin** (an elite trinket earned the first time a driver wins a gold border) and the **Founder's Coin** (legendary, given by Pyra Drake in a storyline).

**Gear wear (built).** Gear wears with racing, like parts do: every racing kilometre adds 0.03 wear to each item a driver wears, times a tier factor (basic 1, club 0.8, pro 0.6, elite 0.45, legendary 0.3), up to 100 (`repairs` in `data/balance.json`, column `driver_gear.wear`). A worn item gives less of its boost, down to 40% at 100 wear, and a piece at 80 wear or more no longer counts towards a supplier set bonus. The driver's own record is still never changed. The Drivers panel lists the gear of the player's entered drivers with its wear, and the garage can have the maker refurbish an item for half its price in proportion to its wear. Earned and found items that are not sold (price 0) cannot be refurbished and simply wear on. Computer garages have their entered drivers' worn gear refurbished at each rollover as far as their cash goes.

**Starting gear.** In Season 1 every AI driver wears a basic kit that matches their garage's budget: well-funded garages kit their drivers out in club and pro gear, small garages in basic gear. A new player's driver starts with basic gear.

**Where it appears.** The gear shop, the driver profile and the contract negotiation (a garage can include gear in a driver's contract). Famous gear, for example a champion's helmet, can come up at the auction house. Gear data lives in `data/gear.json`, so mods can add items, tiers and suppliers.

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

**Built so far (M4, negotiation).** The core rules and driver contracts are built. Every party has a hidden walk-away value `F × m` (or `F ÷ m` for a payer), with leverage capped at ±0.2, a relationship effect of ±10% and a rival effect of up to +20%. A party accepts at or past that value; otherwise it counters (asking 15%, then 7%, then 2% better) and loses a point of patience, or two or three for a lowball under 80% or 60% of its value, and it walks away when its patience runs out. A driver that has walked away will not negotiate with that garage again that year. A driver's contract is valued at the salary plus 5% for each extra year (they like security), so a longer deal can be cheaper per season, and the garage pays a release fee of half the salary per year left to the driver's old garage. Relationships are stored per pair (+5 for a kept deal, +10 for a renewal). In this part a driver can only be signed when they have no entry this season with another garage (the off-season move). Sponsors, suppliers, manufacturers, bonuses and rival interest come next.

**Built so far (M4, sponsors).** Title sponsors are built on the same negotiation rules. Twelve fictional sponsors in four tiers (local, regional, national and global, in `data/sponsors.json`) each need a minimum garage prestige and carry their own weight. A garage asks a sponsor for a season fee and a length of 1 to 3 years; the sponsor's hidden walk-away fee is `F ÷ m`, where `F = $25,000 + $700 × prestige + $400 × the best driver's fame`, and a sponsor that is stronger than the garage pays less. It accepts an ask at or under its walk-away fee, counters with a lower fee, or walks away (and will not deal again that year). A garage can have one title sponsor at a time. Each round the sponsor pays a sixth of the season fee when the round is settled. Supplier, manufacturer and bonus terms come next.

**Built so far (M4, supplier and manufacturer deals).** A garage can negotiate a discount from a part supplier (on its parts) or a manufacturer (on new cars) with the same rules as sponsors. The fair discount is 5% + 0.1% per prestige point for a supplier and 3% + 0.12% per point for a manufacturer, both capped at 15%. The party's hidden walk-away discount is `F ÷ m`, the garage asks for a discount and a length of 1 to 3 years, and the party accepts up to its walk-away discount, counters with a smaller one, or walks away (and will not deal again that year). A garage can have one deal at a time with each party. The discount is applied automatically: fitting a part from a supplier with a deal, and buying a new car from a manufacturer with a deal, cost less, and an explicit price given to the dealer still wins. Contingency bonuses, door spots, exclusivity, factory support and the right to match come next.

**Starting values (v1, tunable)**

- **Fair value.** Each term has a fair value `F` in AUD per season.
  - Driver salary: `F = 40 × (rating − 20)²`, where `rating` is the driver's overall stat (20–85), multiplied by 1.8 for a gold border and a further 1.3 for the reigning champion. This gives an unknown rating-30 driver $4,000, a rating-70 gold-border driver about $180,000 and a rating-85 champion about $395,000.
  - Title sponsor fee: `F = 25,000 + 700 × garage prestige + 400 × best driver's fame` (fame 0–100). A new garage gets about $30,000 and an established one about $55,000 or more.
  - Supplier: door discount `5% + 0.1% × garage prestige` (max 15%), and a contingency of $800 per championship point.
  - Manufacturer: new-car discount `3% + 0.12% × garage prestige` (max 15%), plus factory support at higher prestige.
  - Release fee: `0.5 × salary × years left on the contract`.
- **Walk-away value.** A party that wants more (a driver, supplier, manufacturer) walks away below `F × m`. A party that pays (a sponsor) walks away above `F ÷ m`, where `m = 1 + L − 0.10 × (relationship ÷ 100) + 0.20 × rival interest`, and leverage `L` runs from -0.2 to +0.2 depending on whose results, fame and standing are stronger.
- **Counters.** A party starts at 15% above its walk-away value and concedes to +7%, then +2%, across its three counters. An offer below 80% of walk-away value costs one extra patience, and one below 60% costs two.
- **Patience.** 3 counters. +1 with a relationship of 50 or more, -1 at -50 or less (minimum 1).
- **Relationship changes.** +5 for a kept deal, +3 for a paid bonus, +10 for renewing, -10 for a broken contract, -20 for walking out mid-deal, and decay toward 0 by 1 per season.
- **Rival interest.** 0 to 1: an attention flag raises it by 0.5, a final by 0.3, a win by 0.4, and it decays by 0.25 per round.

**When deals happen**

- **Off-season (Nov 11 – Feb 28).** The main window. Contracts and deals expire at season end and every party negotiates.
- **During the season.** Sponsors, suppliers and manufacturer supply can be negotiated at any time. A driver can be moved only by paying the release fee. Leaving a deal early triggers its penalties.
- **AI deals.** Between AI parties, deals are resolved in batches with the same valuation, in descending order of prestige, and they produce headlines.

**Screen.** The Negotiation screen shows the term list, the value meter, the other side's mood and patience, the history of offers and the relationship score, with one-click acceptance of a counter.

## Career and economy systems

Prize money and sponsors fund the garage, while fame, reputation, rivalries and the media turn results into stories.

- **Prize money.** Each round pays prize money to the 15 finalists, weighted heavily to the win (table below). Placings outside the final earn no prize money. The season champion, decided on points, wins a $10,000,000 championship prize, and performance bonuses build up through the year. Prize money and sponsors are a garage's main income.
- **The driver's share (built).** Prize money a driver wins (the final's prize, the champion's prize and the pole and overtake bonuses) is not all the garage's. Each contract sets the share the garage keeps, from 30% to 100%, 80% by default; the driver keeps the rest as personal earnings (`driver.earnings`). The share is a term of the contract negotiation: a driver values each point of share they take above the fair 20% at `valuePerSeason` (`data/balance.json`, `negotiation.prizeShare`), so asking for a bigger share cuts the salary they will accept and a driver who counters keeps the garage's share as offered and moves the salary (or, if the salary would fall below zero, the share). The sponsor's title fee and the sale of cars stay the garage's.
- **Fame and reputation.** Two separate ratings. Fame is the 0–100 rating derived from fan count (see "Fans"), built from broadcast moments, attention flags and overtakes. Reputation is respect in the paddock, built from consistent results and clean racing. Sponsors chase fame; top garages hire on reputation.
- **Driver development.** Drivers have stats that grow with experience on each kind of road: forest, coast, mountain and night. A driver can be brilliant on mountain roads and weak on coastal ones.
- **Rivalries.** Repeated close finishes or contact between two drivers create a rivalry. Rivals racing each other draw extra broadcast attention and fame.
- **Awards.** Rookie of the Year, most attention flags in a season, Fan Favourite (largest fan gain), and a Hall of Fame for retired champions.
- **Damage and repairs.** Crashes cost money and time. Entries are road cars, so a car that can't be repaired can't be driven on the road either.
- **Daily life.** Road distance between rounds adds wear to the car. Delivery driving gives a small income, which helps drivers early in their careers.
- **Commentary and media.** The commentary team (see "Commentary team") and news headlines between rounds, generated from the records (for example, "#247 reaches their first final").

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

Bonuses add up through the year and are paid at the end of the season.

## Commentary team

Every run and race has a commentary team. The four commentators are fictional characters with their own backgrounds, home towns and areas of expertise, and the commentary system picks who speaks about which moment.

| Commentator | From | Background | Role | Speaks about |
| --- | --- | --- | --- | --- |
| Reece Calloway | Brisbane, Australia | Former professional driver | Driving analyst | Driving, incidents, tyres and attention flags |
| Alistair Thorne | Newcastle upon Tyne, United Kingdom | Multisport commentator | Lead commentator | The live action, storylines, rivalries and milestones |
| Kazumi Aikawa | Hakone, Japan | Former touge prodigy | Road and line specialist | The road and the line, mountain and night stages, and the underdogs |
| José Antonio Carrera | Sabadell, Spain | Business magnate | Business and garages analyst | Money, sponsors, auctions and garages |

- **Voices.** Reece is calm and technical, Alistair is warm and quick, Kazumi is quiet and precise, and José Antonio is confident and blunt.
- **Who speaks.** Each moment (an incident, a rivalry, a storyline beat, a fan milestone, an auction) is tagged with a topic, and the commentator whose areas match speaks first, with another adding a comment. Alistair carries the live action.
- **Text.** Lines are templates with keys, so they are translatable and can be changed by mods (see "Localisation" and "Incidents, rivalries and storylines").
- **Fictional characters.** The four commentators are fictional characters, separate from any real person or existing game character, and Nexxus Drako Multimedia claims no copyright or trademark in them (or in any character other than Pyra Drake). Kazumi Aikawa is Nexxus's own creation. The names of every character except Pyra Drake, Kazumi Aikawa and José Antonio Carrera (that is, Declan Marsh, Ingrid Halloran, Reece Calloway and Alistair Thorne) are placeholders that Nexxus may change at any time, and so are the names of the characters' children and successors. The names live only in data (`data/commentators.json` and the series-staff data in world generation), never in the rules, so renaming one is a data change. Everything about the characters' in-game lives is invented, and no real surnames or personal details of real people appear anywhere in the project.
- **Data.** The team lives in `data/commentators.json`, with each commentator's flag and home town as places in the places list.

**Ageing and succession.** Declan Marsh, Ingrid Halloran and the four commentators are fictional people who age in real game time, like every other character. They have invented birth dates (stored with the rest of their data and never taken from real people).

- **Retirement and death.** Each has a retirement age (around 65 to 72, drawn once from the named stream `worldgen:staff`) and the same death model as other characters. When they retire or die, a headline and a farewell event card mark the moment, and the role passes on.
- **Successors.** The role passes to either one of their fictional children or an unrelated person of a similar role, chosen when the vacancy opens from the named stream `worldgen:staff` (about 60% a child, if there is an adult one; otherwise an outsider). A child keeps the family surname, the parent's expertise and home town. An outsider is generated to fit the role: a similar background, expertise and voice type, a different name, and their own flag and home town. Either way the successor gets their own personality and traits (see "Personalities and traits"), and a new commentator keeps the "speaks about" areas of the role with a small shift in emphasis. A new technical or interpersonal administrator inherits the technical or interpersonal duties and message style.
- **Parents may linger.** A retired parent can still appear in tribute segments, anniversaries and Healesville festival events until death.
- **Underage heir.** If the chosen child is not yet an adult when the parent leaves, an acting successor (an outsider) covers the role until the child turns 25 and can take it over, and the other commentators cover the topics in the meantime.
- **Pyra Drake** is not covered by this rule, because she is the chairwoman and her story follows the career-mode rules in "Careers over time".
- **Data.** Birth dates, retirement ages, the children (name, birth date, home town, voice) and the outsider pool live in `data/commentators.json` and the series-staff data, so mods can change them.

## Fans

Fan counts are a constant talking point in the commentary, the headlines and the broadcast graphics. Every driver, car, garage and flag has a fan count, and so does the series as a whole.

**What is counted**

| Subject | What its fans are |
| --- | --- |
| Driver | People who follow this driver, wherever they race |
| Car | People who follow this particular chassis, and its history stays with the car when it is sold |
| Garage | People who follow the garage and its name |
| Flag | The fans behind a nation: a national base plus a share of the fans of the drivers and garages racing under that flag |
| Series | The worldwide audience of Last Combustion |

- **Not added together.** Fans overlap (one person can follow a driver, a car and a garage), so the counts are shown separately and are not summed, except by the explicit shares below.
- **Fame is derived from fans.** The fame rating (0–100) used in negotiations and sponsor deals is calculated from the fan count: `fame = clamp(12.5 × log10(fans ÷ 10), 0, 100)`. So 10 fans is fame 0, 1,000 fans is 25, 100,000 is 50, 10 million is 75 and 1 billion is 100. Reputation (respect in the paddock) is separate.

**Where fans come from (v1, tunable)**

Gains are a share of the current series audience `S`, so a big moment is bigger in a bigger series:

| Moment | Driver gains |
| --- | --- |
| Race win | 1.0% of `S` |
| 2nd or 3rd | 0.4% |
| Rest of the final | 0.1% |
| Points scorer in 16th–31st | 0.01% |
| Pole position | 0.3% |
| Attention flag | 0.6% |
| Overtake in the final | 0.02% each |
| Spectacular crash (highlight reel) | 0.15% |
| Close finish with a rival | 0.1% |
| Round held in the driver's home state (hometown bonus) | gains ×1.2 |
| Penalty, disqualification or reckless crash | -0.05% |
| Changing number or flag | lose 10% of fans |
| Season of inactivity | lose 3% of fans |
| Each year after retirement | lose 5% of fans |

**Shares between subjects**

- **Garage.** Gains 40% of what its current drivers gain, plus its own gains from Garage Championship results, and keeps half of a departing driver's contribution.
- **Car.** Gains 30% of what the driver gains while driving it, so a famous chassis builds a following.
- **Flag.** Gains 15% of what its drivers and garages gain, on top of the national base. Every named flag has at least 5 fans, even with no national base. The United Kingdom's fans are the sum of its home nations' (England, Scotland, Wales and Northern Ireland each keep a hidden tally from the start, with a base from their real populations and the share of their own people), and when a home nation leaves, its tally leaves the UK's total and goes with it (Northern Ireland's to Ireland's). Spain's regions each hold a hidden portion of Spain's fans by their real population (Catalonia 8.0 million, Galicia 2.7, the Basque Country 2.2, the Canary Islands 2.2, of 48.6), which they take with them on independence. Flag fans carry over from season to season, and growth for flags is not built yet. National base = `population × 0.002%`, ×20 for Australia as the host nation (about 10,000 fans for Australia and a few thousand for the other big nations at the start).
- **Series.** Starts small, at 200,000 in 2031 (a brand-new series), and grows 25% a year for its first five seasons and 8% a year after that, plus 0.5% for each attention flag, 1% for the closing festival, and 10% for the Junior launch in 2036. Individual fan counts are capped at 40% of the series audience.

**Built so far (fan growth).** Each final gives out fans (`awardRoundFans`, `src/db/fans.ts`, numbers in `data/balance.json` `fans`): a driver gains a share of the series audience for a win, a podium, the rest of the final, a points score in 16th to 31st, pole and each overtake (×1.2 when the round is in the driver's home state, taken from the hometown's region), the driver's garage gains 40% of it and the car 30%, and the driver's flag gains 15% (and the garage's flag 15% of the garage's share). The United Kingdom's gain also goes to the hometown's home-nation tally (so it stays the sum of them), and Spain's gain goes in portions to the regions that have not left. Nobody goes over 40% of the audience, and a driver's fame follows their fans. At the rollover the series audience grows (25% for the first five seasons, then 8%, plus 1% for the festival), drivers with no seat lose 3% and retired drivers 5% for each year after the year they retired. At season end each garage with entries earns $2 a fan in merchandise. Not built yet: attention flags, spectacular crashes, close finishes, the reckless-crash penalty, the Junior launch bonus, number or flag changes, prestige milestones, the Fan Favourite award and fan headlines.

**Starting values**

- Every driver starts as an unknown with 10–400 fans (median about 60), a new garage starts with 5 and a new chassis with none. The whole series starts with only 200,000 fans.
- A new garage starts with 50.
- In Season 1 nobody has a gold border or any reputation beyond 5–35, because the series is new and there is no history. Gold borders are earned from Round 1's final onwards.
- Garage, car and flag counts in Season 1 are built from their drivers using the shares above.

**Uses**

- **Money.** Sponsor deals use fame (and so fans). Garages earn merchandise income of about $2 per garage fan per season, paid at season end.
- **Negotiation and prestige.** Fame is a leverage factor, and fan milestones raise a garage's prestige.
- **Story.** Headlines and commentary report fan milestones (for example "#247 reaches 1,000 fans"), a car's fans appear in the broadcast graphics, and the About screen shows the series audience.
- **Awards.** A Fan Favourite award goes to the driver with the largest fan gain in the season.

## Driver origins: hometown and residence

Every driver has a **hometown** (where they grew up) and a **residence** (where they live now). Both usually match the flag the driver races under, but not always, so a driver may race for one country, come from another and live in a third.

- **Generation.** Hometown is in the flag's country 92% of the time. Residence is in the flag's country 70% of the time; for a driver whose flag is not Australia, 20% live in Australia (to be near the series) and 10% live elsewhere. For Australian-flag drivers, 95% live in Australia.
- **Places.** Hometown and residence are chosen from a places list (town or city, region or state, country, latitude and longitude). The planned source is the GeoNames cities dataset (CC BY 4.0, to be confirmed). The list is moddable.
- **Hometown effects.** It sets the starting home road type (+10 affinity) and gives a fan bonus when a round is held in the driver's home state.
- **Residence effects.** Daily roads near the residence slowly train that road type's affinity, delivery driving income depends on the local area, and the garage's travel cost is set by the distance from its base to each venue: `$2,000 + $1.00 per km`, about $3,500 on average. The base of an Owner-driver's garage is their residence.
- **Moving.** A driver can move in the off-season for $5,000. It takes effect from the next season.
- **Pyra Drake.** Her hometown is **Healesville**, Victoria, and her residence is **Brisbane**, Queensland.

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

## Super Series points from 2036

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

## Last Combustion Junior

In 2036 the series adds a junior championship: **The Last Combustion of the Petrol Engine World Motorsports Junior Series Championship**, known as *Last Combustion Junior*.

- **Purpose.** A championship for young drivers who have never reached a main-series final.
- **Eligibility.** Drivers must be 25 or younger on 1 March of the season (the day the season starts, so a driver who has turned 26 cannot compete), and must never have qualified for a main-series final. A driver who raced in the Super Series before 2036 can move down to Junior only if they have never scored a point there (any of the top 31 in a prelim or the final). A driver who has moved up cannot come back (see "Mandatory Promotion"). The checks are built as `juniorEligibility` in `src/sim/junior.ts`.
- **Power cap.** Cars may produce no more than **313 kW** (about 426 PS, at 0.7355 kW per PS). A car that makes more as standard can be fitted with an intake restrictor that limits it to 313 kW. A car found over 313 kW is disqualified from the prelims. The Equalizer tyre-width rule still applies. Car data is stored in PS, so the cap is checked as `PS × 0.7355 ≤ 313`.
- **Format.** Practice is condensed to 3 days and prelims from 7 days to 5, and the top 15 race the final the day after the prelims.
- **Schedule.** Each Junior round runs at the same venue straight after the Super Series round: Junior practice day 1 is the day after the Super final race. The same dry-and-clear rule applies to Junior prelims.
- **Points and perks.** Junior uses the original 2031 points table: the top 31 score points, with the top 15 scoring from the final. Any points scorer gets free tyres, a reserved place in the assistants' booth and a silver-outlined number.
- **Prizes.** Junior uses the original 2031 prize money: finalists earn $1,000,000 down to $20,000 by position. The Junior champion, decided on points, wins $10,000,000. Pole and overtake bonuses of $10,000 each build up through the year and are paid at season end.
- **Numbers.** Junior cars carry a "J" beside their door number, to set them apart from main-series cars.
- **Mandatory Promotion:** Junior drivers who earn a silver border MUST complete their junior season, then MUST enter the Super Series the following season. **There is no way back:** a driver who has moved up from Junior after earning a silver-bordered number in their final Junior season can never return to the Junior Series, even if they are still 25 or younger and even if they lose their Super Series seat. A driver over 25 cannot compete in Junior at all.
- **Shared garages.** Junior and Super entries belong to the same garages. One garage record runs entries in both series, and Junior entries use the garage's own name, flag and livery with the Junior "J" marking.
  - **Costs and mechanics.** Each Junior entry pays its own entry fee, tyres and mechanic time, drawn from the same budget and workforce.
  - **Prestige.** Junior entries count toward a garage's prestige at half the weight of a Super Series entry.
  - **Standings.** Each series keeps separate standings (see "Standings"); team orders apply only within a series.
  - **Promotion.** A Junior driver who must move up can be kept by the same garage or released to another.
  - **Extra crew.** Optional but beneficial. A garage can hire extra mechanics for the Junior block. Each one speeds repairs and car changeovers between the two events and lowers the chance of setup errors. Without them the garage still runs both series by splitting its crew.

## Auction house and car trading

Cars change hands through dealers, private negotiation and the auction house. A chassis is a one-off with a story, so every sale shows its full provenance.

**Provenance.** Every lot shows the chassis record: model and model year, road km and race km, wear, previous owners and garages, drivers who raced it, results and incidents, and its **left quarter panel history**: the car's own trophy and shield decals (race wins and championships), which stay with the car whatever happens to the driver's right-side decals. The chassis fan count (see "Fans") is shown too.

**Where to buy**

| Route | What it is |
| --- | --- |
| Dealers | New cars of any model still on sale, at the new price with the tier and manufacturer discounts, negotiated with the manufacturer |
| Used market | Fixed-price listings of ordinary used cars, refreshed each week |
| Auction house | Timed auctions of specific chassis, run weekly online and as live events at the Healesville festival in November |
| Private negotiation | The player approaches the owner of a particular chassis (a garage, a collector or a manufacturer) and negotiates a sale with the normal negotiation system |

**Auctions**

- **Lots.** Each lot is one chassis with a reserve price, a closing time and its provenance. The auction house lists retired-model cars and famous chassis alongside everyday ones.
- **Bidding.** Players and AI garages bid. A bid must beat the current price by the minimum increment (2% of the price, at least $500). A bid in the last minutes extends the close by two minutes, so there is no sniping.
- **Fees.** The buyer pays a 10% premium on top of the hammer price, and the seller pays a 5% fee. An unsold lot (below reserve) is withdrawn and may be offered again at a lower reserve.
- **AI bidders.** Each AI garage has a budget and a want-list drawn from its profile. Its maximum bid is the car's value times a personal factor of 0.8 to 1.2, and rises for a chassis with a famous history.
- **Selling.** The player can consign a chassis, choosing a reserve. Selling a car with an entry means finding a replacement car (the same-manufacturer rule applies in season).

**Built so far (M4, first part).** New cars from dealers at the list price less any negotiated discount (a model is for sale from its introduced year until it retires, and one-off cars are never for sale), used base prices of 70% of new falling 5% a year to a floor of 40%, the value formula below with a chassis's race wins counted from the results, and the `car_ownership` history. Each garage with entries is charged its round costs (entry fee, tyres, servicing and travel from its base to the venue, see "Cost baseline") once the round's prelims are done. The used market and selling to a dealer are built too: a dealer pays 80% of a car's value and lists it for 110%, private sellers keep 12 ordinary used cars on the market (made from the career seed and the date, so the same day gives the same cars), and a car with an entry this season cannot be sold. Cars for sale belong to a hidden market garage (`garage.kind = 'market'`) and are never shown as a racing garage. The auction house and private negotiation come next.

**Built so far (M4, auctions).** Auctions are built with proxy bidding: a bid is the most a garage will pay, and the auction raises it one increment at a time only as far as needed, so the best maximum wins and pays one increment over the second best (never less than the reserve, never more than their own maximum, and the earliest bid wins a tie). That makes last-minute sniping pointless, so the two-minute extension applies only to live bidding at the festival, later. A weekly auction opens with eight lots of ordinary used cars from private sellers and closes a week later, a festival auction closes the same day, and a garage can consign its own cars (one with an entry this season cannot be sold). A lot opens at half its reserve (at least $500) and a raise is at least 2% (at least $500). When the auction closes, each computer garage takes an interest in a lot at random (15%) and will pay 0.8 to 1.2 times the car's value, but only if it can afford the price plus the premium. The buyer pays the price plus 10% and the seller receives the price less 5%; the auction house keeps the difference. A lot below its reserve goes unsold. Famous chassis, retired-model lots and want-lists come later.

**Value.** The value of a chassis is `base × wear factor × provenance factor`.

- **Base** is the used price from the price tiers, for its model and model year.
- **Wear factor** is `1 − 0.006 × wear`, so a worn-out car is worth far less, while racing kilometres cost it more than road kilometres because they wear it more.
- **Provenance factor** rewards a good record: `1 + 0.03 × wins + 0.25 × championships` for the left-quarter-panel decals, plus `0.00000015 × chassis fans` (so a chassis with a million fans is worth 15% more), capped at 5×. A famous chassis can sell for many times the price of an identical car with no history.

**Negotiated purchases.** Buying a particular chassis from its owner is a negotiation like any other: price, payment terms, a right of first refusal on a later sale, and optional extras such as the spare parts, the logbook or the owner's driver for a season. The seller's reservation rises with the chassis's provenance and with rival interest.

**Records.** Every sale writes to the car's history (seller, buyer, price, route) and to the garages' ledgers, and a famous sale makes the headlines.

## Records and history

The game keeps a permanent, detailed history of every race, driver, garage and car, so any career can be looked back on in full.

| Record | What is kept |
| --- | --- |
| Race (each round) | Course, dates, conditions on every day, wet-day delays, running order, every prelim time, final grid and result, gaps, tyre condition at the flag, attention flags, penalties and incidents |
| Driver | Every entry and result, numbers held each season, garages driven for, cars driven, points by round and season, finals reached, wins, titles, date the gold border was earned, attention flags, contracts and salary history |
| Garage | Founding date, entries each season, drivers signed and released, cars owned, Garage Championship results, prestige over time, sponsors and suppliers, prize money earned |
| Car | Its own identity (chassis number), make and model, owners and garages, drivers, model year, kerb weight and tyre width at each round, parts and suppliers fitted at each round, door logos, trophy decals, results, road km and race km, wear, sales and auction history |

- **The almanac.** There is an almanac of every driver and garage that ever scored a point in the Junior or Super Series. An entry has the full career: total points (with the Junior and Super Series split), seasons that scored, first and last scoring year, wins, finals, titles, and the year they started and ended. Every other driver and garage gets one line: 0 points, the year they started and the year they ended. Someone who retired or stopped operating before ever scoring a point has an end year, and someone still active has the end year blank (\"2031 to present\"). A driver starts in the first season they enter (or, if they never did, the year they turned 18), and a garage in its founding year. It is built as `almanac` in `src/db/almanac.ts`, with `retireDriver` and `closeGarage` recording the end year.
- **Leaderboards** are built from these records: season standings (drivers, garages, manufacturers and nations), course records for the fastest prelim run and race, and all-time tables (wins, titles, finals, points).
- **Car histories follow the car.** A car sold to another garage keeps its left-rear decals (its left quarter panel history) and its full record, so a famous chassis carries its story with it, and the sale price reflects it. The driver's right-rear decals go with the driver.

---

## Development Specification

Everything below turns the design above into buildable detail. Numbers marked **(tunable)** are starting values to be balanced in playtesting; they live in data files, not code.

## Scope and build order

The full design is large, so development is staged. Each milestone must be playable end to end before the next begins.

| Milestone | Goal | Includes | Excludes |
| --- | --- | --- | --- |
| M0 Foundations | Project runs, saves and loads | Vite + React + TS + Tailwind + Zustand scaffold, SQL.js database, migrations, seeded RNG, save/load, externalised text (`/locales/en.json`), the platform-services interface, engineering standards and CI (see "Engineering standards and tooling") | Any gameplay |
| M1 World generation | A believable 2031 field | Names, 96 garages, 313 drivers, 313 cars, numbers, contracts, calendar | UI beyond a debug viewer |
| M2 Prelim simulation | One round's prelims resolve | Course sectors, lap-time model with driver gear, 7-day running order, weather days, prelim and practice incidents, classification, points | Final race, economy |
| M3 Final race | A full 15-car final | Lap-by-lap sim, tyre life, mid-race incidents with pauses, overtakes, player calls, prize money, timing screens | Live map polish, drones |
| M4 Garage and economy | The management loop | Car purchase (dealers, used market, auction house, private negotiation), upgrades, legality, the negotiation system (drivers, garages, sponsors, manufacturers, suppliers), finances, repairs | Rivalries, media |
| M5 Full season (**vertical slice**) | Six rounds, off-season, rollover to 2032 | All 6 courses, fan counts, hometowns and residences, season end, awards, retirements and new entrants, records | 2036 expansion, Junior |
| M6 Depth | Story and feedback | Attention flags, ghost record, crash highlights, rivalries, storyline engine and event cards, media headlines, drone events, live map | |
| M7 2036 expansion | The era change | Super Series rebrand, 20-car final, Junior Series, mandatory promotion | |
| M8 Modes and release | All three career modes, polish | Owner-driver, driver manager, tutorial, audio, Electron desktop builds, achievements and cloud-save export/sync, mod loader and mod browser, the hidden Founder's career, optional Steam module if the licence question allows | |

**MVP definition (M5):** a player in Garage owner mode can start a career, buy and upgrade a car, sign a driver, race six rounds, finish the season, and begin 2032 with all records saved.

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

```text
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

## Licensing and distribution

The game is licensed under the **GNU General Public License, version 3 or (at the user's option) any later version** (SPDX `GPL-3.0-or-later`).

- **Scope.** All code and all first-party data, art, audio and text are GPL-3.0-or-later unless a file says otherwise. `LICENSE` holds the licence text, every source file carries an `SPDX-License-Identifier` header, and the repository follows the REUSE specification.
- **Dependencies and assets.** Only GPL-compatible licences are allowed: MIT, BSD, ISC, Apache-2.0, MPL-2.0, LGPL, CC0, CC BY and CC BY-SA 4.0 (one-way compatible), and SIL OFL fonts. Licences that are not compatible (non-commercial, no-derivatives, proprietary) are blocked by a licence check in CI. Third-party licences are listed in `CREDITS.md` and shown in-game. `flag-icons` is MIT, so it complies.
- **Source.** The source is public. The About screen links to the exact source tag of the running build.
- **Names and IP.** The game name "Last Combustion", its logo and the character Pyra Drake are trademarks and intellectual property of **Nexxus Drako Multimedia**. No other character is claimed: Nexxus makes no copyright or trademark claim on anyone but Pyra. The GPL covers the software and content licensed under it, but it does not give anyone the right to use the name, the logo or Pyra Drake. Forks must use a different name and logo and may not present Pyra as their own. `TRADEMARKS.md` states the policy (GPLv3 section 7 allows declining trademark rights). The copyright holder named in every SPDX header is Nexxus Drako Multimedia.
- **Mods must be GPL-compatible.** Mods are data files read at runtime, and their authors keep their copyright, but every mod must carry a GPL-compatible licence to be loaded or listed. See "Modding".
- **Easter egg.** The Founder's career check stores a hash of the normalised details, not the plain text, so browsing the source does not spoil it. This document is the only plain-text record.

**Steam.** The Steamworks SDK is proprietary, and its terms do not mix cleanly with GPL distribution of a combined work, so a Steam release may not be possible. It is treated as optional and undecided.

- The GPL builds never include Steamworks. Steam-specific code lives in a separate optional module behind the platform interface below.
- If a Steam release is pursued, it needs legal advice, and probably an additional permission under GPLv3 section 7 granted by every copyright holder. To keep that option open, contributors sign off their commits under the Developer Certificate of Origin and the project decides on a contributor agreement before accepting large outside contributions.

**Distribution channels (initial):** the web build, GitHub Releases (Windows, macOS, Linux), itch.io and Flathub.

## Platform services

Anything that depends on a store or platform sits behind one interface, so the game works fully without Steam.

| Service | Local / web / GPL build (default) | Steam build (optional) |
| --- | --- | --- |
| Achievements | Local list stored in the profile | Steam achievements |
| Cloud saves | Export and import `.lcsave` files, plus an optional auto-sync folder the player chooses (works with any sync tool) | Steam Cloud |
| Mod distribution | Local `mods/` folder plus a mod index (see "Modding") | Steam Workshop |
| Identity | Local profile name | Steam profile |

Implementations: `LocalPlatform` (default), `WebPlatform`, and `SteamPlatform` (optional, separate package, not part of the GPL release).

## Engineering standards and tooling

The project follows common industry practice from the first commit (milestone M0).

**Versioning and changelog**

- **Semantic Versioning 2.0.0** for releases: `MAJOR.MINOR.PATCH`. Before 1.0 the minor number follows the milestones (M2 is `0.2.0`), and `1.0.0` is the first full release (M8). Pre-releases use `-alpha.N`, `-beta.N` and `-rc.N`. Release tags are `vX.Y.Z`.
- **Changelog.** `CHANGELOG.md` follows *Keep a Changelog 1.1.0* (Added, Changed, Deprecated, Removed, Fixed, Security), but it is empty until there is a release: pull requests do not edit it. The first release (`0.1.0`) is a simple display of the game's features, written when it is released, and later releases list their changes under the usual headings, written at release time (from Conventional Commits and by hand where needed).
- **Separate versions.** The save schema has an integer version with migrations, the data/mod schema has its own version, and `mod.json` states a SemVer range of supported game versions. Breaking changes to the mod format need a major release and a migration note.
- **Releases.** Publishing a tag creates a GitHub Release with notes from the changelog and attaches the web build and the desktop builds with checksums.

**Source control**

- Trunk-based development: short-lived branches and pull requests into a protected `main`; squash merges; required checks and review; `CODEOWNERS`.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, with `!` for breaking changes), enforced by commitlint. Commits are signed off (DCO).

**Code quality**

- TypeScript in strict mode, ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier and EditorConfig.
- Husky and lint-staged for fast pre-commit checks.
- Node version pinned in `.nvmrc`, pnpm with a committed lockfile.
- Vitest for unit tests (simulation coverage target 90%), fast-check for property tests, React Testing Library for components, Playwright for end-to-end tests, and axe for accessibility checks.
- Accessibility target: WCAG 2.1 AA. Performance budgets: a prelim day of 300+ entries simulates in under 2 seconds in the worker, and the web bundle stays under an agreed size.
- No in-game telemetry and no network calls other than optional mod downloads. The one exception is the Google tag on the web build hosted on GitHub Pages (`lc.nexxusdrako.au`), which is only built in when the `GTAG_ID` secret is set (the ID is kept in GitHub secrets, not in the repository) and is loaded only after the visitor accepts a cookie prompt (declining stops it and removes its cookies, and a "Cookie settings" button reopens the choice), so local, test and desktop (Electron and Steam) builds carry no analytics.

**GitHub Actions workflows**

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | Pull request, push to `main` | Install, lint, typecheck, unit and property tests, build, licence check, REUSE lint |
| `e2e.yml` | Pull request | Playwright end-to-end and accessibility tests |
| `codeql.yml` | Pull request, weekly | Code scanning |
| `dependency-review.yml` | Pull request | Blocks vulnerable or GPL-incompatible new dependencies |
| `balance.yml` | Nightly, manual | Runs the headless multi-season sim and fails if balance statistics drift beyond set limits |
| `docs.yml` | Pull request | Markdown lint, link check, API docs build |
| `release.yml` | Tag push `v*` | Release automation: changelog, web build, Electron builds for Windows, macOS and Linux, checksums, GitHub Release |
| `pages.yml` | Merge to `main`, release | Deploy the web build to GitHub Pages at `lc.nexxusdrako.au` (a custom domain, so the build uses the root path) |

Dependabot (or Renovate) keeps npm packages and GitHub Actions up to date, with actions pinned to versions or commit hashes.

**Documentation**

- `README.md` (what it is, how to build and run, licence), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant), `SECURITY.md`, issue and pull request templates.
- `docs/GAME_DESIGN_DOCUMENT.md` (this document), `docs/ARCHITECTURE.md`, architecture decision records in `docs/adr/` (MADR format), a modding guide in `docs/modding/`, and published JSON Schemas for all mod files in `schemas/`.
- TypeDoc API documentation for the simulation layer. User-facing text lives in `/locales`.

**Definition of done:** the change has tests, passes every required check, updates the docs where behaviour changes, introduces no hard-coded strings and no incompatible licences.

## Course outlines

Each course has a saved outline that drives the track map, the live map and the timing view.

- **Format.** `data/courses/outlines.json` holds one entry per course: `viewBox`, an SVG `path`, and `points` as `[x, y, km]` where `km` is the cumulative distance along the lap. Coordinates are a flattened, simplified plan (not latitude and longitude), scaled to fit a 1000-unit box.
- **Use.** Sector boundaries are stored as `start_km` on each sector and found on the outline by distance. Car positions, gaps, drone markers and overtaking spots use the same distance, so the live map and the timing screens always agree.
- **Closed loops.** Every outline is a closed loop, and the first point is the start/finish line.
- **Source and attribution.** Outlines are generated from OpenStreetMap road data and carry the attribution "Route geometry © OpenStreetMap contributors, ODbL 1.0", shown in the credits. Only the simplified outline is stored in the repository, not the raw map data, so the file is a derived map-style work rather than a copy of the database. This is on the legal review list.
- **Regeneration.** `tools/routes/measure_routes.py` rebuilds the outlines and lap lengths from `tools/routes/routes.json`, and a mod track supplies its own outline in the same format.

## Data model

Core tables (SQLite). The schema version is stored in SQLite's `user_version`, not in a table. Every table has an integer primary key `id`; foreign keys are named `<table>_id`. Dates are ISO strings in game time.

| Table | Key fields |
| --- | --- |
| `career` | mode, character_id, master_seed, start_year, game_date, player_garage_id, player_driver_id (nullable), difficulty, founder_career (bool) |
| `character` | career_id, kind (`owner` / `driver` / `owner_driver`), name, gender, birth_date, hometown_place_id, residence_place_id, personal_cash, start_date, end_date, end_reason (`death` / `retired` / `became_owner` / `founded_garage` / `bankrupt` / `abandoned`), predecessor_id |
| `series_official` | name, role (`technical` / `interpersonal` / `chair`), residence_place_id |
| `career_mod` | career_id, mod_id, version, load_order |
| `standing_snapshot` | season_id, series, table_kind (`driver` / `garage` / `manufacturer` / `driver_nation` / `garage_nation`), subject_id, after_round, points, position |
| `season` | year, era (`original` / `super`), final_size, series_fans, status |
| `place` | name, region, country (ISO code), latitude, longitude |
| `flag_fans` | flag (ISO code), season_id, fans |
| `fan_log` | subject_type, subject_id, date, delta, reason |
| `round` | season_id, number, course_id, practice_start, prelim_start, final_date, status, weather_log (JSON per day) |
| `course` | name, state, shape (always `loop`), lap_km, final_laps, road_type, altitude_m, night (bool), outline (JSON: viewBox, path, points with cumulative km) |
| `sector` | course_id, sector_order, surface (always `sealed`), start_km, length_m, corner_density, straight_m, elevation_change_m, width_m, overtake_spot (bool), ref_seconds |
| `commentator` | stable_id, name, flag, hometown_place_id, background, role, focus (JSON), voice |
| `gear_supplier` | stable_id, name, home_country |
| `gear_item` | stable_id, name, slot, tier, supplier_id (nullable), price, stats (JSON) |
| `driver_gear` | driver_id, item_id |
| `flag_history` | subject_type (`driver` / `car` / `garage`), subject_id, season_id, flag (ISO code) |
| `garage` | name, home_state, base_place_id, fans, flag, primary_colour, secondary_colour, prestige, cash, founded_year, is_player, ai_profile |
| `driver` | name, gender, birth_date, nationality, flag, hometown_place_id, residence_place_id, fans, stats (columns for each stat), potential, fame, reputation, gold_border_year, silver_border_year, retired_year, earnings |
| `driver_road_affinity` | driver_id, road_type, rating |
| `contract` | driver_id, garage_id, start_year, end_year, salary, role (`lead` / `development`), release_fee, garage_prize_share |
| `manufacturer` | stable_id, name, home_country, type (`hypercar` / `supercar` / `sports` / `jdm` / `domestic` / `other`), character, next_refresh_year |
| `car_model` | manufacturer_id, stable_id, name, tier, base_kerb_kg, max_tyre_mm, base_ps, layout, price_new, generation, introduced_year, retired_year (nullable), predecessor_id (nullable) |
| `car` | car_model_id, chassis_no, model_year, flag, fans, garage_id, road_km, race_km, wear, kerb_kg_current, tyre_width_mm |
| `part` | supplier_id, category, name, price, delta_ps, delta_kg, delta_grip, delta_handling, delta_reliability, legality_cost |
| `car_part` | car_id, part_id, installed_date, wear |
| `entry` | season_id, garage_id, driver_id, car_id, race_number, series (`main` / `junior`), fee_paid |
| `result` | round_id, entry_id, run_day, run_slot, prelim_time_ms, prelim_pos, final_pos, final_time_ms, points, prize, pole, dnf_reason, tyre_pct_at_flag |
| `event_log` | round_id, scope (`practice` / `prelim` / `final` / `event` / `season`), timestamp, km (distance along the lap, nullable), type (incident, flag, crash, penalty, overtake, rivalry, story), entries involved, payload JSON |
| `rivalry` | kind (`driver` / `garage` / `manufacturer` / `flag`), party_a_id, party_b_id, heat, level, started, last_event, ended (nullable) |
| `storyline` | template_id, subject_type, subject_id, status (`active` / `resolved` / `abandoned`), started, resolved |
| `storyline_beat` | storyline_id, step, scope, happened_on, event_log_id, choice (nullable), outcome |
| `sponsor`, `sponsor_deal` | tier, min_prestige, base_fee, bonuses; garage_id, years, targets |
| `supplier`, `supplier_deal` | brand, categories, discount, contingency; garage_id, car_id |
| `trophy` | owner_type (`driver` / `car`), owner_id, kind (`win` / `title`), series, round_id / season_id |
| `car_ownership` | car_id, garage_id, from_date, to_date (nullable), price, route (`new` / `used` / `auction` / `private`) |
| `auction` | opens, closes, kind (`weekly` / `festival`), location |
| `auction_lot` | auction_id, car_id, seller_garage_id, reserve, final_price (nullable), buyer_garage_id (nullable), status |
| `auction_bid` | lot_id, bidder_garage_id, amount, placed_at |
| `negotiation` | window_kind, party_a_type, party_a_id, party_b_type, party_b_id, kind, status, patience_left |
| `offer` | negotiation_id, round_no, from_side, terms (JSON), value, outcome |
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

**Character creation by mode**

| Mode | Who is created | Age at the start |
| --- | --- | --- |
| Garage owner | The owner: name, gender, date of birth, plus the garage name, flag and two livery colours. The owner does not race | 18 to 50 |
| Owner-driver | One person who is both owner and driver: the owner details above plus the driver details below | 18 to 30 |
| Driver manager | The driver only: name, gender, flag, number and the driver details below | Always 18 (the date of birth is set automatically) |

**Driver details (Owner-driver and Driver manager).** Spend 100 points across Pace, Consistency, Racecraft, Tyre management, Composure and Wet skill (min 20, max 60 each at start). Pick a hometown and a residence (see "Driver origins"), a home road type (+10 affinity), a name, gender, flag and race number. Potential is hidden. In Garage owner mode the first hired driver is chosen from the 5 offered.

**Owner-driver growth.** The Owner-driver starts solo with one car and one entry, which is the player. The first hired mechanic, second car and second driver are unlocked by earnings and prestige, in the same way as in Garage owner mode.

**Difficulty presets** change only starting cash, sponsor generosity, repair costs and AI aggression: Relaxed (+50% cash), Standard, Hard (-30% cash, +25% costs).

## Hidden Founder's career (Easter egg)

A player can play as Pyra Drake by entering her exact details in Garage owner or Owner-driver setup. Nothing in the game, tutorial, store page or marketing mentions it.

**Unlock details.** All of these must match at once:

| Field | Value |
| --- | --- |
| Mode | Garage owner or Owner-driver |
| Name | Pyra Drake |
| Gender | Female |
| Date of birth | 31 March 1996 |
| Race number | 313 |
| Garage name | Drake Motorsports |
| Driver flag | Australia (`AU`), Owner-driver only |
| Garage flag | Australia (`AU`) |
| Livery colours | Primary `#7f0000`, secondary `#ffd900` |

Driver mode is not available for the unlock: the Driver manager's driver always starts at 18, and Pyra is 35 in 2031.

**How it behaves**

- **No hints.** The setup screen treats every field normally. Number 313 and an age of 35 are rejected as usual when the rest does not match, with the standard messages. The Founder's career starts only when the player confirms and every field for the chosen mode matches. Name and garage match ignoring case and surrounding spaces.
- **Overrides.** The #313 reservation is lifted for this career only. In Owner-driver mode the 18–30 age rule is lifted too, since she is 35 in 2031. In Garage owner mode her age already fits the 18–50 range, and the rule needs no override. In this world #313 belongs to the player and the NPC founder is replaced, so there is never a second Pyra Drake.
- **Starting package (proposed, tunable).** Her Homura Spirit R-7 is the garage's one car. She has about 60,000 fans (fame about 47, the biggest name in a small series), Drake Motorsports about 24,000 and the R-7 about 16,000. Her hometown is Healesville and her residence is Brisbane, set automatically (they are not part of the unlock). Drake Motorsports is based in Brisbane. They are unrelated to Pyra. Cash, staff and sponsors are the normal start for the mode, so the rise from nothing is still earned.
  - **Owner-driver.** She is the driver, with elite preset stats (Pace 90, Consistency 85, Racecraft 85, Tyre management 85, Composure 85, Wet skill 80, all road affinities 80), and races as #313.
  - **Garage owner.** She is the owner and does not race, matching her role as chairwoman. The garage's first entry carries #313 and a driver chosen from the 5 offered.
- **Timeline.** She is 35 in 2031, 40 in 2036 and ages and retires like any driver.
- **Ghost record.** The founder's demo runs still exist as the #313 ghost option, so the player can race against her demo laps.
- **Achievements.** All achievements are disabled in the Founder's career. Starting it unlocks one hidden achievement of its own, "Founder's Birthday", once per account.
- **Ultimate Vyktory (hidden code, proposed).** On the same setup screen where the Founder's details are entered, the player can also enter the sequence up, up, down, down, left, right, left, right with the keyboard, a gamepad or the on-screen arrows. It counts only if the Founder's career then starts (every field matching, as above); on any other setup it does nothing and gives no feedback. If it counts:
  - The game logo is replaced by the Vyktory flag, on the title screen and in the interface, for that save.
  - In 2036 (the year of Pyra's 40th birthday) the world changes that normally happen at a random time or not at all are all forced at once: the United Kingdom splits fully (England, Scotland, Wales and Northern Ireland race separately and Ireland reunifies), the Basque Country, Catalonia, Galicia and the Canary Islands become independent, and Australia is renamed the Commonwealth of Vyktory with the Vyktory flag (the normal 1 in 31,031,996 roll is skipped). They happen in the 2035-36 off-season with the usual headlines and commentary, including the fourth-wall line.
  - It unlocks one more hidden achievement, "Ultimate Vyktory", once per account. This is the one exception to the Founder's career having no other achievements, and it is not shown anywhere until earned.
  - The save records that the code was used (`ultimate_vyktory`), so its world is outside the normal story. The sequence is stored hashed with the other unlock data and is not mentioned in any player-facing text. Open question: the classic Konami code ends with B and A, and the sequence here is the eight directions as specified; whether to add B and A is for Nexxus to decide.
- **Canon.** The save is marked `founder_career` and is outside the main story (in the standard world, Pyra Drake does not race main events). It is stored and displayed like any other save.

## Modding

The game is data-driven, so mods are packages of the same JSON and SVG files the base game uses, with no scripting.

**What can be modded**

| Area | What a mod can change or add |
| --- | --- |
| Starting garages | Garage names, flags, colours, prestige, home states and which entries they start with |
| Drivers | Names, flags, ages, stats, potential, numbers and starting contracts |
| Name lists | Driver first and last names (by nationality) and garage name pools |
| Manufacturers | New or replacement manufacturers, with home country, type and character |
| Cars | New or replacement car models: kerb weight, power, drivetrain, price tier, body-shape SVG and livery slots |
| Tracks | New or replacement courses: route, outline for the map, sectors, road type, climate profile |
| Parts | New or replacement parts and their stats, prices and legality ratings |
| Sponsors | New or replacement sponsors, their tiers, fees, targets and personalities |
| Suppliers | New or replacement suppliers, categories, discounts and contingency terms |
| Balance data | Coefficients in `balance.json`, such as the cost baseline and formula weights |

**Package format.** A mod is a folder with `mod.json` (id, name, version, author, supported game versions, dependencies, load-order hint, list of the areas it touches), `data/` for the JSON files, `art/` for SVGs and `text/en.json` for any new text keys. The real-counterpart reference mapping is optional (`mod_mapping.json`, see "Fictional manufacturers and cars").

**Rules**

- **Stable IDs.** Everything a mod adds has a stable ID with the mod's prefix. Replacing a base item uses the base item's ID.
- **Load order.** Mods load in order and the last to change an item wins. A conflict report names every override.
- **Validation.** On load, each mod's files are checked against the schemas and rules, and invalid mods are rejected with an explanation: unique IDs and numbers, legal Equalizer values, closed-loop course with a lap length between 10 and 80 km, every sector sealed (a course with any unsealed surface is rejected), sector sums, flags that exist, name lists that are not empty, no use of the reserved #313.
- **Balance mods.** A mod that changes balance data is labelled in the save, its records are kept apart from default-world records, and achievements are disabled for that career.
- **Safety.** Data only: no code, and SVGs are sanitised to remove scripts and external references.
- **World generation with mods.** A starting garage or driver mod supplies part of the field and world generation fills the rest to 96 garages and 313 drivers, unless the mod declares a full replacement of the starting field.
- **Calendar with mods.** A track mod can replace any of the six rounds at career creation. A course's final laps are calculated automatically so the final is at least 300 km. Lap length must be between 10 and 80 km.
- **Saves.** A career records the mods used, with their versions, and mods are fixed when the career is created. A missing or changed mod warns before loading. Modded careers are labelled, and their records are not mixed into default-world records.
- **Distribution.** Mods go in a local `mods/` folder (or are imported in the web build). A mod index, a public repository of mod listings with download links, feeds an in-game mod browser. If a Steam release goes ahead, Steam Workshop is added as a second source through the optional Steam module.
- **Mod licence (mandatory).** `mod.json` must declare a `license` as an SPDX identifier, and the mod folder must include the licence text. Only GPL-compatible licences are accepted: GPL-3.0-or-later, GPL-3.0-only, AGPL-3.0, LGPL-3.0, MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0, MPL-2.0, Unlicense, CC0-1.0, CC-BY-4.0 and CC-BY-SA-4.0 (and OFL-1.1 for fonts). A mod with a missing, unknown or incompatible licence (including non-commercial, no-derivatives or "all rights reserved") is rejected by the loader and the mod index. All art, audio and fonts inside a mod must also be GPL-compatible, and the licence is shown in the mod manager.
- **Names in mods.** A mod may say it is made "for Last Combustion" or "compatible with Last Combustion" but may not use the logo, imply it is official, or use the Pyra Drake character without permission (see `TRADEMARKS.md`).
- **Hosting policy.** Wherever we host mods or the index, we follow the standard DMCA takedown procedure, and we claim no responsibility for modifications that private players make or apply.

## Achievements and cloud saves

- **Achievements.** Achievements are enabled (Steam achievements in a Steam build, otherwise a local list), awarded for milestones such as first points, first final, gold border, first win, a season title, a Garage, Manufacturer or nations title, a Hall of Fame entry, a 10-season career and a rivalry. They are tracked from the event log. They are disabled in careers that use balance-changing mods, and in the Founder's career.
- **Founder's career.** All achievements are disabled for that save. Starting it unlocks one secret achievement, "Founder's Birthday", and nothing else.
- **Cloud saves.** Enabled through the platform interface (Steam Cloud in a Steam build, otherwise export/import and an optional auto-sync folder). Each save is one `.lcsave` file containing the database, its schema version, the mod list and a preview. On a sync conflict the newer file wins and the older one is kept as a backup copy that the player can restore. The web build stores saves in the browser and can export and import `.lcsave` files.

## Arc numbers

Four numbers run through the game as a quiet signature: **31**, **96**, **313** and **31396** (313 and 96 written together). The game calls them **arc numbers** and never explains them, and they are never spelled out in the interface beyond that name.

- **Where they already sit.** 31 is the number of scoring positions and Pyra Drake's birthday date (31 March), 96 is the number of starting garages and of launch car models, and 313 is the reserved race number, the size of the starting field and the Junior Series power cap in kilowatts. Nothing about this is highlighted in the game.
- **Achievements.** A small group of achievements is built on them. Each is called an "arc" achievement, its text mentions only "an arc number", and the number appears only as a hidden threshold or progress counter.

| Achievement | What it asks for |
| --- | --- |
| Last of the Points | Finish in 31st place, the final scoring position, in any prelim |
| Ghost of the Founder | Beat Pyra Drake's #313 ghost in a prelim on Hard |
| A Full Field | Score 96 Garage Championship points in one season |
| Arc Complete | Reach 31,396 fans with a driver |

- **Rare touches.** Some cosmetic events, such as a drone saluting a driver or a special line in the commentary, fire at odds of 1 in 31,396 per lap and are drawn from the seeded random streams, so they are repeatable.
- **Tone.** Players are never told these are the designer's favourite numbers. Keep mentions in the game, store text and marketing to the term "arc numbers". This document and the code may name the numbers.
- **Interaction with other rules.** Arc achievements follow the normal achievement rules (disabled in the Founder's career and in careers using balance-changing mods).

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
| Entry fee per entry per round | $3,000 (top-31 finishers get free tyres, but still pay the fee) |
| Racing tyre set (non-top-31) | $1,500 per set; practice sets $300 |
| Starter road car, used | $12,000–$35,000 |
| Mid-tier car (JDM, sports), used | $40,000–$120,000 |
| Premium supercar, used | $120,000–$400,000 |
| Elite supercar, used | $400,000–$2,000,000 |
| Hypercar | $2,000,000+ (see price tiers) |
| Part price range | $400 (filter, pads) to $60,000 (turbo kit / engine build) |
| Mechanic wage | $500 per week each |
| Travel and accommodation | $2,000 plus $1.00 per km from the garage's base to the venue (about $3,500 on average), plus $750 per extra entry |
| Servicing | $1,200 per round per entry at Starter tier (see supercar upkeep) |
| Driver salary, unknown | $0–$20,000 per season (often paid in sponsor product) |
| Driver salary, gold border | $60,000–$400,000 per season; champions higher |
| Small title sponsor | $30,000–$80,000 per season |
| Delivery driving | About $250 per day on non-event days |
| Top-31 discount on parts | 30% |

**Balance check (v1).** A solo Owner-driver with one Starter car spends about $68,000 a season over six rounds: entry fees $18,000, racing tyres $9,000, practice tyres $12,600, servicing $7,200 and travel $21,000. Income at zero points is about $67,000: roughly 108 non-event days of delivery driving at $250 ($27,000) plus a small sponsor ($40,000). So a one-car garage survives on delivery income and a small sponsor at zero points, earns a small surplus (about $12,000) from top-31 finishes through free tyres and discounts, and only profits meaningfully from finals. A Garage owner with two mechanics ($52,000 a year) and a hired driver runs about $63,000 in deficit until finals arrive, which gives roughly four seasons of runway on $250,000. Upgrades, supercars and crashes are paid for out of final prize money. **Bankruptcy:** cash below -$50,000 for 3 consecutive weeks ends the garage; in Garage owner mode the career ends with a retrospective screen, in Driver manager mode the driver is released and may sign elsewhere.

## Formulas (proposed, tunable)

**Car ratings** (each normalised to 0–1 against the series' range of cars):

- **P (power)** from power-to-weight, `PS / kerb_kg`, with a reduction at altitude: `P × (1 − 0.011 × altitude_m / 100)` (no base-game course is high: Mount Nebo at about 650 m loses roughly 7%, and the effect matters mainly for mod courses in the mountains).
- **G (grip)** from tyre width per kilogram, which the Equalizer favours in light cars (the narrowest 0.215 mm/kg scores 0, the widest 0.265 mm/kg scores 1), plus suspension and aero parts.
- **B (braking/handling)** from brakes, suspension tune and weight.
- **T (traction)** from drivetrain (AWD 0.9, mid-engine and rear-engine 0.8, front-engine rear-drive 0.6, front-drive 0.5) and tyre width.
- **Wear.** Each rating falls by 0.2% per point of chassis wear.
- **Normalisation.** Power-to-weight runs from 0.05 PS/kg (0) to 0.75 PS/kg (1), and tyre width from 170 mm to 440 mm.

**Sector fit.** Each sector has weights that sum to 1, derived from its data: long straights raise the weight of P, high corner density raises G and B, big elevation change raises P and T, narrow width raises B. `Fit_s = wP·P + wG·G + wB·B + wT·T`.

**Sectors.** Each course is split into sectors of about 2.5 km (17 to 27 per course) from its saved outline (see "Course outlines"). A sector records its corner density (quarter-turns per km), its longest straight, its elevation change, its road width and whether it is a place to overtake, and has a reference time for a reference car and driver.

- **Corner density** is measured from the outline and scaled up by 2.5, because the simplified outline hides the small bends.
- **Reference speed** is `120 − 10 × corner density` km/h, kept between 40 and 110 km/h, which gives lap times of roughly 25 to 60 minutes.
- **Elevation** is a smooth synthetic profile from the course's altitude until the courses are surveyed.
- **Overtaking.** A sector with a 250 m or longer straight and a road at least 6.2 m wide is a place to overtake, and every course has at least three.

**Driver rating on a sector.** `D = (0.55 × Pace + 0.30 × affinity for the road type (night on a night course) + 0.15 × Composure) ÷ 100`, using the driver's stats after gear is applied (see "Driver gear").

**Calibration (v1).** In a 313-entry field, driver pace correlates about 0.8 with a prelim result and car quality about 0.6, and about 11 to 13 of the 15 fastest are supercars or hypercars, which meets the design target that the driver matters more than the car.

**Sector time.**

```latex
t_s = t_{ref,s} \times \bigl(1 - k_c\,(Fit_s - 0.5)\bigr) \times \bigl(1 - k_d\,(D_s - 0.5)\bigr) + \Delta_{temp} + \varepsilon
```

- `t_ref,s` is the sector's reference time from course data.
- `D_s` is the driver's sector rating: a blend of Pace, the matching road-affinity, and Composure on the main feed. Initial values are `k_c = 0.12` and `k_d = 0.09`, set with `tools/balance/prelim_check.py`. In a 313-entry field (half supercars), driver pace correlates 0.76 with prelim result against 0.64 for car quality, so the driver matters more but the car still matters, and about 11 of the 15 finalists are supercars. This is the "driver over horsepower" pillar, and the 10-season headless sim must keep these figures within ±0.05 when the formulas change.
- `Δ_temp` is a track temperature roll penalty/bonus, within ±0.4% of sector time.
- `ε` is random variance with standard deviation `σ = 0.6% × (1 − Consistency/150)` of sector time.

**Tyre life.** Starts at 100%. Per sector: `loss = base_loss × (1 + 0.4·aggression + 0.3·wheelspin_factor + 0.2·slide_factor − 0.5·(TyreMgmt/100))`. Base loss is set so a neutral driver reaches about 8% at the final's end. Grip multiplier on `Fit` is `1 − 0.004 × max(0, 20 − tyre_pct)` below 20%.

**Incident chance per sector.** `p = p_base × (1 + aggression) × wet_factor × wear_factor × (1 − Composure/200)`. Outcomes: mistake (lose 1–4 s), spin (lose 10–25 s), crash (retire, damage, drone stop signal for followers). Initial `p_base` is 0.002 per sector per entry in prelims, which gives roughly a 5% chance of an incident per lap: about 16 incidents (mostly mistakes, a few spins and about one crash) across a 313-car round. Rare wildlife on the road is rolled separately, at 0.4% per run.

**Overtaking (final).** An attacker within 0.5 s overtakes at an overtake spot if `(attacker_sector_speed_advantage + racecraft_diff/100) > threshold`, where the threshold is raised by narrow width and lowered by drone-clear sight lines. Defend calls raise the defender's racecraft by 10 for that sector but cost extra tyre life.

**AI prelim times.** For the ~300 AI entries the same sector formula is evaluated once per sector with no per-entry sim state, then summed. This keeps a prelim day cheap while staying consistent with the final.

**Scrutineering.** After every run: kerb weight and tyre width checked against the Equalizer; road-legality score must be ≥ 0. Failure = disqualification from that run's result; the entry keeps its previous prelim time only if it has one.

**Weather.** Each day for a round is rolled from a course climate profile: `dry_clear`, `overcast`, `wet`. Only `dry_clear` allows prelim runs. Rounds are guaranteed to finish: the weather settles if the prelims are held up. After 14 blocked days it can be no worse than overcast (the rain stops), and after 28 blocked days it is always dry and clear, so the prelims run.

**Licence plates (built).** Every car is identified by its Australian licence plate (the chassis number stays in the records as the car's build number). Plates follow the standard issue formats of the eight states and territories, from the Wikipedia article "Vehicle registration plates of Australia": ACT `YRU·00A`, New South Wales `DT·00·HW`, Northern Territory `CG·77·AA`, Queensland `000·RV2`, South Australia `S000·DOI`, Tasmania `N 00 QD`, Victoria `2GJ·1AA` and Western Australia `1JEB·000`. The formats, each state's colours and slogan, and the series each one has used are in `data/plates.json`. **Letters vary.** Apart from the few letters a state's own rules fix (the Y of the ACT, the C of the Northern Territory, the S of South Australia), every letter and digit is drawn, including the series prefix (the D of New South Wales, the N of Tasmania, the 2G of Victoria, the 1J of Western Australia), which comes from the state's list of series: a new car leans towards the current series and an old one towards earlier ones. **The plate says where the car is registered.** The plate badge is drawn in the state's colours with the state's short name (ACT, NSW, NT, QLD, SA, TAS, VIC or WA) on it, and the state's full name and slogan on hover, in the Cars, Market, Upgrades and starter choices. A car is registered in the state of the garage that owns it when it is made (a garage abroad, or the used market, draws a state by how many cars each state has), and keeps its plate when it is sold. **Unique within a state.** No two cars registered in the same state share a plate (the database enforces it on state and plate together), but the same personalised plate can be held in two different states. None uses I or O in its letters, and none spells a word on a short deny list. Plates are drawn from the career seed and the car's id (`plate:<id>`), so a career always gives the same plates, and cars in older saves are registered when the save is opened. **Personalised plates.** Famous cars can have a personalised plate (`custom` in `data/plates.json`, keyed by car model), written as it is and registered in a state of its own, which need not be the owner's state. Pyra Drake's Homura Spirit R-7 wears the Victorian personalised plate `NEXXUS`.

**Wear and reliability.** Every chassis and every part has `wear` from 0 (new) to 100 (worn out). Wear is added per kilometre, and the kind of kilometre matters:

- **Road km** (everyday driving, delivery work and travel between rounds): `0.0004` wear per km.
- **Race km** (practice, prelim laps and finals): `0.004` wear per km, ten times as much.
- **Tier factor.** Both are multiplied by 0.8 (Starter), 1.0 (Mid), 1.2 (Premium), 1.5 (Elite) or 2.0 (Hyper), matching the supercar upkeep rules.
- **Examples.** A mid-tier car that covers 60,000 road km has 24 wear. One season of racing is about 1,200 km, which adds roughly 5 wear. Servicing resets part wear and has a cost; chassis wear can only be reduced by a restoration.
- **Failure.** A part above 85 wear has a rising failure chance each sector; failure during a run causes a retirement.
- **Worn parts give less (built).** A part's gains in power, grip, handling and traction shrink with its wear, down to half at 100 wear (`repairs.partWearEffect`); its weight and downsides do not change. The Upgrades panel shows each fitted part's wear and a Service parts button with the bill (a quarter of each part's price in proportion to its wear), which puts every part back to new.
- **Season 1.** Every chassis starts with some road km and no race km, because the series has never raced before.

## Fictional manufacturers and cars

The game ships only fictional manufacturers and models, so no licences are needed. Each one is also designed as a stand-in for a real counterpart, so modders can swap in real cars. The real names below are a reference for modders only: they never appear in the shipped game, its data files, store page or marketing.

**Roster focus.** The series is a supercar showcase, with hypercars at the top and JDM, sports, Australian domestic and other cars mixed in.

- **31 manufacturers and 96 models, with 2 to 5 models per manufacturer.** By category: 3 hypercar makers, 9 supercar makers, 6 sports-car makers, 7 JDM makers, 4 Australian domestic makers and 2 others. Each model is mapped to a specific real model.
- **No era cut-off.** The list below is the launch lineup for 2031. Manufacturers keep their lineups moving after that (see "Manufacturer lineups").
- **Field mix (Season 1, 313 cars):** 3% hypercars, 47% supercars (half the field), 22% JDM, 15% sports, 10% Australian domestic and 3% other. New garages and underdogs start in JDM, sports and domestic cars, and supercars are the aspiration.
- **Stats are indicative.** Kerb weight and power are rounded starting values chosen to fit the game's balance, not exact real specifications. A mod that imports the real car replaces them. Max tyre width uses the Equalizer (`kg / 5 + 40`).

**Price tiers.** `price_new ≈ ($15,000 + $280 × PS) × tier multiplier`. Used cars sell at 40–70% of new depending on age, wear and provenance (see "Auction house and car trading").

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
| Vento | Italy | Hypercar | Handbuilt carbon hypercars | Pagani |
| Halberd | UK | Supercar | Lightweight carbon, technical | McLaren |
| Ashford | UK | Supercar | Grand tourers to hypercars | Aston Martin |
| Kessler | Germany | Supercar | Rear-engined precision | Porsche |
| Stern | Germany | Supercar | Hand-built V8 power | Mercedes-AMG |
| Rhein | Germany | Supercar | All-wheel-drive traction | Audi |
| Montclair | France | Hypercar | Extreme power and top speed | Bugatti |
| Vesper | Sweden | Hypercar | Record-chasing hypercars | Koenigsegg |
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
| Pennine | UK | Sports | Small, cheeky, great on tight roads | Mini |
| Aurelian | Italy | Sports | Small turbo hatches, high revs, fragile | Abarth / Fiat |
| Ardent | France | Sports | Soft, agile hot hatches | Renault |
| Mizuho | Japan | JDM | Rally-bred turbo sedans and coupes | Mitsubishi |
| Suzuri | Japan | JDM | Tiny, light and cheap | Suzuki |
| Redback | Australia | Domestic | Utes and V8 sedans, cheap and tough | Holden |
| Wattle | Australia | Domestic | Local muscle and turbo sixes | Ford Australia |
| Bunyip | Australia | Domestic | Hemi-powered local classics | Chrysler Australia |
| Banksia | Australia | Domestic | Lightweight local sports cars | Elfin / Bolwell |
| Haeju | South Korea | Other | Value performance | Hyundai |
| Skald | Sweden | Other | Turbo pioneers, quirky and safe | Saab |

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
| Cavallo Fondatore | Hyper | 1,365 | 313 mm | 660 | Ferrari Enzo |
| Pennine Mk I | Starter | 680 | 176 mm | 76 | Classic Mini Cooper |
| Pennine Cooper S | Starter | 1,150 | 270 mm | 163 | Mini Cooper S (R53) |
| Pennine GP | Mid | 1,200 | 280 mm | 218 | Mini John Cooper Works GP (R56) |
| Aurelian Uno T | Starter | 850 | 210 mm | 105 | Fiat Uno Turbo |
| Aurelian Lupa 1.4T | Starter | 1,050 | 250 mm | 190 | Abarth 595 Competizione |
| Aurelian Spider 124 | Mid | 1,060 | 252 mm | 170 | Abarth 124 Spider |
| Ardent 5 Turbo | Mid | 980 | 236 mm | 160 | Renault 5 Turbo |
| Ardent Petite RS | Mid | 1,200 | 280 mm | 200 | Renault Clio RS 200 |
| Ardent Trophy | Mid | 1,400 | 320 mm | 275 | Renault Mégane R.S. Trophy |
| Mizuho Evo IX | Mid | 1,400 | 320 mm | 280 | Mitsubishi Lancer Evolution IX |
| Mizuho Orion | Mid | 1,300 | 300 mm | 200 | Mitsubishi Starion |
| Mizuho GTO | Mid | 1,700 | 380 mm | 280 | Mitsubishi 3000GT VR-4 |
| Suzuri Cappu | Starter | 700 | 180 mm | 64 | Suzuki Cappuccino |
| Suzuri Swift Sport | Starter | 1,000 | 240 mm | 136 | Suzuki Swift Sport |
| Suzuri Works | Starter | 680 | 176 mm | 64 | Suzuki Alto Works |
| Redback Torana | Mid | 1,100 | 260 mm | 200 | Holden Torana A9X |
| Redback Sedan SS | Mid | 1,700 | 380 mm | 367 | Holden Commodore SS (VE) |
| Redback Ute SS | Mid | 1,780 | 396 mm | 367 | Holden Commodore SS Ute (VE) |
| Redback GTS-R | Premium | 1,900 | 420 mm | 636 | HSV GTSR W1 |
| Wattle GT-HO | Elite | 1,430 | 326 mm | 300 | Ford Falcon GT-HO Phase III |
| Wattle XR6 Turbo | Mid | 1,700 | 380 mm | 325 | Ford Falcon XR6 Turbo (BF) |
| Wattle XR8 Ute | Mid | 1,800 | 400 mm | 395 | Ford Falcon XR8 Ute (FG) |
| Wattle GT-F | Premium | 1,800 | 400 mm | 455 | Ford Falcon GT F |
| Bunyip Charger E49 | Premium | 1,300 | 300 mm | 300 | Chrysler Valiant Charger E49 |
| Bunyip Charger E55 | Mid | 1,350 | 310 mm | 250 | Chrysler Valiant Charger R/T E55 |
| Bunyip Pacer | Mid | 1,350 | 310 mm | 245 | Chrysler Valiant Pacer |
| Banksia Clubman | Starter | 640 | 168 mm | 150 | Elfin Clubman |
| Banksia Nagari | Mid | 900 | 220 mm | 160 | Bolwell Nagari |
| Banksia MS8 | Premium | 780 | 196 mm | 430 | Elfin MS8 Streamliner |
| Haeju Veloce | Mid | 1,400 | 320 mm | 275 | Hyundai Veloster N |
| Haeju i-Sprint | Mid | 1,450 | 330 mm | 280 | Hyundai i30 N |
| Haeju Coupe 3.8 | Mid | 1,500 | 340 mm | 300 | Hyundai Genesis Coupe 3.8 |
| Skald Sonett | Starter | 840 | 208 mm | 65 | Saab Sonett III |
| Skald 900 Turbo | Mid | 1,200 | 280 mm | 175 | Saab 900 Turbo 16S |
| Skald Viggen | Mid | 1,400 | 320 mm | 225 | Saab 9-3 Viggen |

The Homura Spirit R-7 is Pyra Drake's #313 benchmark and is not for sale. The starter cars a new garage can pick from are the Kestrel Swift 1.6, Homura Corsa 1.8 and Mitaka Sprinter. The starting field's 313 cars are drawn from these 96 models using the field mix above; supercars appear mostly in the hands of established, high-prestige garages.

**Manufacturer lineups**

Manufacturers do not stand still. Each one refreshes its lineup about every five years (a random interval of 4 to 6 years, first due between 2034 and 2037), and the 96 launch models are only the 2031 starting point.

- **What changes.** At a refresh a manufacturer replaces one or two of its models with next-generation successors (about 5–12% more power, 0–4% lighter, a higher price and a generation number in the name), and it may add a new sport derivative of an existing model.
- **Limits.** A manufacturer always has between 2 and 5 models on sale. If a refresh would take it above 5, its oldest model is retired. A retired model only means it can no longer be bought new. Every chassis already built keeps racing and keeps its history, and it can still be traded on the used market and at auction.
- **Unique cars.** One-off cars such as the Homura Spirit R-7 are never refreshed.
- **Timing.** The refresh runs in the yearly rollover (see "World generation and AI"), and the headlines report new models.
- **Mods.** A mod may supply its own successors, which then replace the generated ones.

**Modding support**

- **Mapping file.** `mod_mapping.json` is optional and ships separately from the game data. It links each fictional model ID to its real counterpart (make, model, generation, years) so a mod can replace names, stats and visuals together. It is not included in the base game.
- **Replacement, not addition.** A mod replaces a fictional manufacturer or model entirely, including its name, logo, body shape and stats. Save files keep working because the game stores the stable internal ID, not the display name.
- **Livery and art.** Real-car mods supply their own body-shape SVG with the standard livery slots (front quarter, doors, rear quarters, number, flag).
- **Mod loader.** See "Modding" for the package format, validation and load order.
- **Legal.** The base game never ships real marks. Mods are covered by the hosting policy in "Modding": standard DMCA takedown, and no responsibility is claimed for modifications that private players make or apply.

## World generation and AI

**Season 1 world (96 garages, 313 drivers).**

- **Garage sizes.** 1 to 8 entries per garage, averaging about 3.3, and adding up to 313 entries across 96 garages (the player's garage and entry are part of that total).
- **Prestige.** Set from entry count and any gold-bordered drivers. In Season 1 nobody has a gold border, so prestige comes from entry count alone.
- **Names.** Drivers and garages are generated from name pools weighted toward Australian and a broad international mix. Pools are in `names.json` and must avoid real people and trademarks.
- **Car sector fit.** Generated cars get a base fit drawn from a normal distribution: supercars mean 0.52, SD 0.12; JDM and sports cars mean 0.46, SD 0.10 (tuned in `tools/balance/prelim_check.py`).
- **Skill distribution.** Driver Pace is drawn from a normal distribution (mean 45, SD 12, clamped 20–85); nobody starts gold-bordered or stands out through history, so the strongest drivers simply come from the top of the distribution. Potential is Pace plus 0–25.
- **Number assignment.** Season 1 has no ranking to follow, so numbers are drawn at random from 1 to 400, excluding the reserved #313.

**Yearly rollover.**

0. Lineups: manufacturers due for a refresh retire and introduce models (see "Manufacturer lineups").
1. Retirement: drivers over 40 retire with rising probability each year; any driver may also retire after repeated poor results or serious injury.
2. Newcomers: 20–45 new drivers enter each year (more if recent seasons were popular); fame and prestige of the series raise the count. New garages form at 3–10 per year; garages with negative cash for 2 seasons fold (built, see "Season rollover").
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
| Auction house | Lots with full provenance (including the left quarter panel history), bidding, consignment and private offers |
| Round hub | Calendar for the 15+ days, weather, running order, practice controls |
| Practice and prelim view | Timing screen, live map, ghost choice, per-entry results |
| Final race view | Timing tower, sector splits, tyre life, player calls, drone events |
| Standings and records | Tabs for the five standings tables, history browser |
| Story and rivalries | Active storylines and their beats, the rivalry board, event cards and headlines |
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
- **Interface references.** Two sites set the tone for the interface: F1 Glory (a browser career game) and Lapwerks (a browser track maker). We follow their design principles only. We do not copy their artwork, wording, logos or code.
  - **From F1 Glory.** Friendly, card-based menus: a mode picker of large cards, each with an icon, a title, a one-line promise and a small "New" or "Soon" badge; a grid for picking an era; generous rounded corners (about 14 to 16 px on cards, pill-shaped buttons); a bright default look with a dark option; a clear single accent colour, with gold kept for rank and prestige; a wide, bold display face over a plain readable body face (Anybody and Inter there); ranking cards with tabs; a "Beta" strip that is honest about rough edges; the language switcher in the top bar; and a duel-with-a-friend entry point (an idea for later, not a promise). It also shows flags with a country-flag emoji font so they render on Windows, which we do with the `flag-icons` art instead.
  - **From Lapwerks.** A dark, flat "tarmac" interface: five near-black steps (about `#0b0b0c` to `#3b3b41`) for layers, off-white "chalk" text (about `#f3f2ef`, muted `#a7a6a1`), hairline borders at 10% and 18% white, small radii (4 to 6 px), no gradients, one orange accent (`#ff4f00`) for the main action, a signal yellow (`#ffd400`) for highlights and good news, a blue for information and a red for danger; one variable typeface for display, body and numbers, so figures line up; numbered steps ("01 Draw, 02 Shape, 03 Set the scene"); small callout chips tied to a map feature (a corner number with its settings); and racing readouts that feel live: sector times, a live delta, a ghost and a personal best.
  - **What LC takes from them.** A data-first dark default for race and management screens (timing tower, sector times with a live delta against the ghost record, tyre life, the course map with numbered corners and overtaking spots); card menus for modes, careers and the garage hub; one primary action per view; numbered steps for multi-step flows such as negotiations and upgrades; flat colour with hairlines instead of shadows; and badges for new and coming-soon features. All of it is built from the theme tokens below, so the light, dark and NDM themes carry it. The NDM theme swaps the orange accent for the brand gold on a maroon band and keeps the same structure.
  - **Token layers.** Surfaces use five layers (`surface-0` to `surface-4`), text uses `ink` and `ink-muted`, borders use `line` and `line-strong`, and colours are `accent`, `signal`, `info` and `danger` (plus the NDM `surface-brand` and `on-brand`). Components use only these.
- **Themes.** The release game is themable, and the player picks a theme in Settings (the choice is saved with the player's settings, not the career). Three themes ship:
  - **Light.** A standard light theme: white surfaces, black text.
  - **Dark.** A standard dark theme: dark neutral surfaces, light text.
  - **NDM.** The Nexxus Drako Multimedia brand theme, built from the NDM design system (`github.com/NexxusDrakoMultimedia/design-system`): black surface, white text, gold (`#ffd900`) headings and accents, maroon (`#7f0000`) header and hero bands with gold display text, gold fill with maroon text for the primary button, and gold focus rings. It follows the design system's `tokens.css` dark values and its rule that gold text never sits on a light surface.
  - **How it works.** All colours come from CSS custom properties (design tokens such as `surface`, `ink`, `ink-muted`, `accent`, `surface-brand`, `on-brand`, `line`, `focus`, and the status colours `success`, `warning`, `danger`), set by a `data-theme` attribute on the page. No component hard-codes a colour. The first launch follows the operating system's light or dark setting, and the player can override it.
  - **Fixed colours.** Race content keeps its own colours in every theme, because it is data: garage liveries and number boxes, flags, the gold border, and course maps. Themes recolour the interface around them only.
  - **Accessibility holds in every theme.** Text meets WCAG AA contrast (4.5:1 for body text, 3:1 for large text and icons), the focus ring is always visible, and status colours are colour-blind safe (success is blue, not green) and always paired with a word or icon.
  - **Mods.** A theme is a data file (`data/themes.json`: a name and a token map), so mods can add themes. Themes that fail the contrast check are not listed. The NDM theme is shipped with the game, but the NDM logos, artwork and Pyra Drake stay reserved (see `TRADEMARKS.md`), and the fonts are loaded by the interface and not used for text in a way that needs a licence we lack.
  - **Fonts.** Display text uses Orbitron and body text uses Exo 2 (both SIL Open Font Licence, which is compatible with the GPL); HK Modular is not used in the game because it is licensed through Canva. Both fonts are bundled with the game and recorded in `CREDITS.md`, so the game does not load fonts from the internet at run time.
  - **Build order.** The token layer and the three themes arrive with the first real screens in M4, and the Settings control with the screen flow.

## Branding and marketing

Branding and social media are planned work for after the first playable season (M5), and nothing here is built yet. This section records what is decided and what is still open, so the work can start from it.

**Decided**

- **Name and tagline.** The game is **Last Combustion**, and the tagline is above ("Overview"). The tagline is used exactly as written, with no variations.
- **Owner and identity.** The game, its logo and its characters belong to Nexxus Drako Multimedia (NDM) and sit under the NDM identity: maroon and gold, flat colour, no gradients or drop shadows, Orbitron and Exo 2 for web type (see "Themes" and the `design-system` repository). The game's own logo and key art are separate from the NDM logos and follow the same rules.
- **Voice.** Warm, direct and identity-forward, in Australian English, with display lines in uppercase and running text in sentence case, and no emoji used as decoration. Every public-facing page carries the Acknowledgement of Country and NDM's statements, with the Intersex-Inclusive Progress Pride flag as the only pride flag, exactly as the design system requires.
- **Web home.** The playable web build is at `lc.nexxusdrako.au`, and the Google tag there is loaded only after the visitor accepts cookies.
- **Mods and forks** may say they are made "for" or "compatible with" Last Combustion, but not use the logo or Pyra Drake (see `TRADEMARKS.md`).

**To do, in order**

1. **Brand kit:** logo lockups (stacked and horizontal, light and dark), the favicon and avatar, colour and type rules, a one-page style guide, and press-ready key art.
2. **Store and site pages:** a landing page with the tagline, a short pitch, screenshots and a trailer, a press kit, and the Steam page if the Steam decision goes ahead (see "Platform services").
3. **Social media:** the accounts and handles (to be chosen), a posting plan around the season calendar (the March 31st season start, round weekends, the November 11th Healesville festival and award nights), highlight clips from the final-race engine and commentary lines, and community channels that match the NDM ones already in use.
4. **Content hooks:** the commentary team, the almanac and records, headlines and rivalries make shareable moments; a weekly challenge and a "this day in the almanac" post are candidates.
5. **Community and legal:** a code of conduct for community spaces, a clear policy for fan art and streaming, and the trademark policy kept in step with `TRADEMARKS.md`.

**Open questions**

- Which platforms and handles to use, and who runs them.
- Whether to run a public beta or a demo, and when.
- The Steam decision and the store page timing.
- Whether to commission key art and a trailer, or make them in-house.
- Press and creator outreach, and how to handle the cookie prompt on marketing pages.

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
| Fans | The follower count of a driver, car, garage, flag or the series |
| Hometown / residence | Where a driver grew up / where they live now |
| Founder's career | The hidden Garage owner or Owner-driver start as Pyra Drake |
| Arc numbers | The four numbers (31, 96, 313, 31396) behind a small group of achievements and rare touches |

## Decisions and open questions

**Decided**

- **Single-player only.** No multiplayer (see Technical Stack).
- **Season 1 field.** 96 garages and 313 drivers; later growth follows "World generation and AI".
- **Fixed round count.** Six rounds each season, including after 2036.
- **Standings.** Drivers, garages, manufacturers, driver nations and garage nations all ship (see "Standings").
- **Flags.** Any flag with a flag emoji is allowed, provided its artwork has an open licence (OFL, CC BY-SA or similar), and the flag is recognised by the FIA, IOC or FIFA (so `AQ`, `ARAB`, `ASEAN`, `CEFTA`, `EAC` and `UN` are out).
- **Road and place names.** Real roads, routes and place names are used as geography and need no licensing.
- **Junior and Super share garages.** One garage runs entries in both series.
- **Owner-driver starts solo.** One car, one entry, no staff.
- **Starting ages.** Garage owner 18–50, Owner-driver 18–30, Driver manager always 18.
- **Language.** English only, with all text externalised for later translation.
- **Modding.** Mods for starting garages, drivers and stats, name lists, manufacturers, cars, tracks, parts, sponsors, suppliers and balance data, each with a mandatory GPL-compatible licence.
- **Careers over time.** An owner who dies or retires is replaced by a new character in the same world; a retiring owner-driver becomes a garage owner; a driver can found a garage at any time for a fee, with funding set by fame and reputation.
- **Incidents, rivalries and storylines.** Mid-race incidents, rivalries (heat and levels) and data-driven storylines run across practice, prelims, races, events and seasons.
- **Arc numbers.** 31, 96, 313 and 31396 feature in a few achievements and rare touches, and appear in the game only as "arc numbers".
- **Auction house.** Specific chassis are bought at auction or by negotiation, with their left quarter panel history and provenance included in the price.
- **Chassis.** Every raced chassis has its own model year and wear, with racing km wearing ten times as much as road km.
- **First year.** 2031 is the series' first year: nobody starts gold-bordered, and numbers and the Round 1 order are drawn at random.
- **Manufacturer lineups.** 31 manufacturers and 96 launch models (2 to 5 per manufacturer, no era cut-off); lineups refresh about every five years.
- **Driver gear.** Helmets, suits, gloves, boots and trinkets boost driver attributes (capped at +10 each), with set bonuses; data-driven and moddable.
- **Commentary team.** Reece Calloway, Alistair Thorne, Kazumi Aikawa and José Antonio Carrera.
- **Series management.** Declan Marsh (technical) and Ingrid Halloran (interpersonal) run the day-to-day of the series from Healesville; Drake Motorsports is based in Brisbane.
- **Founder's career.** A hidden Easter egg start as Pyra Drake, in Garage owner and Owner-driver modes. It disables achievements and unlocks its own secret achievement.
- **Negotiations.** Drivers, garages, sponsors, manufacturers and suppliers negotiate with one system.
- **Flag artwork.** `lipis/flag-icons` (MIT), checked: complete except Ceuta & Melilla, which uses the Spanish flag.
- **Event name.** The protected "Targa" event name is not used.
- **Junior schedule.** Junior practice day 1 is the day after the Super final, at the same venue. Junior practice lasts 3 days.
- **Balance mods and achievements.** Careers using balance-changing mods have achievements disabled.
- **Mod hosting policy.** Standard DMCA takedown. No responsibility is claimed for modifications by private players.
- **Platform features.** Achievements and cloud saves are enabled through a platform interface that works without Steam.
- **Licence.** GNU GPL v3 or later. A Steam release is optional and undecided.
- **IP.** The name, logo and Pyra Drake belong to Nexxus Drako Multimedia and are reserved; no other character is claimed (see `TRADEMARKS.md`).
- **Calendar.** Six closed loops, run clockwise around the country from South Australia (Round 1) to Western Australia (2), Queensland (3), New South Wales (4) and Victoria (5–6), ending at Healesville, the series' home. No out-and-back courses. Tasmania, the Northern Territory and the ACT are not in the base calendar and are open to mods.
- **Lap length and surface.** Maximum 80 km (minimum 10 km), sealed roads only, no dirt. All six lap lengths are measured.
- **Engineering standards.** Semantic Versioning, Keep a Changelog, Conventional Commits, GitHub Actions and the tooling listed in "Engineering standards and tooling".
- **Balance.** Cost baseline, formula coefficients and negotiation values are set at v1 (see `tools/balance/prelim_check.py`) and are the design team's to adjust.
- **Extra crew.** Optional but beneficial.

**Open**

- [ ] Check that every route is fully sealed. The automatic surface check (Overpass) was unavailable, so run `tools/routes/measure_routes.py` once the Overpass server responds. Roads to watch: Old Norton Summit Road, Knotts Hill Road and Burdetts Road (Round 1), Puzey Road, Johnson Road and Yelverton North Road (Round 2), and the Camerons Road area and Old Healesville Road (Round 6).
- [ ] Consider a seventh round (a second Western Australian course, or the Northern Territory or Tasmania) if a good sealed loop under 80 km is found.
- [ ] Legal review of the ODbL attribution for the saved course outlines.
- [ ] Re-verify the v1 balance numbers with the real TypeScript simulation at M2 and across 10 seasons at M5.
- [ ] Legal review of the real-counterpart mapping in `mod_mapping.json`.
- [ ] Legal review of `TRADEMARKS.md`, and how the logo and the artwork of the Drake characters are separated from the GPL grant (section 7 covers trademarks, not copyright in artwork).
- [ ] Whether to pursue Steam at all, and if so the GPLv3 section 7 additional permission and contributor agreement (needs legal advice).
