// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Migration } from '../migrate';

/** Schema version 2: the starting world (milestone M1). See the GDD, "Data model". */
export const migration0002: Migration = {
  version: 2,
  name: 'world',
  sql: `
    CREATE TABLE place (
      id         INTEGER PRIMARY KEY,
      stable_id  TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      region     TEXT NOT NULL,
      country    TEXT NOT NULL,
      latitude   REAL NOT NULL,
      longitude  REAL NOT NULL
    );

    CREATE TABLE series_official (
      id                 INTEGER PRIMARY KEY,
      name               TEXT NOT NULL,
      role               TEXT NOT NULL CHECK (role IN ('chair', 'technical', 'interpersonal')),
      residence_place_id INTEGER NOT NULL REFERENCES place (id)
    );

    CREATE TABLE season (
      id           INTEGER PRIMARY KEY,
      year         INTEGER NOT NULL UNIQUE,
      era          TEXT NOT NULL CHECK (era IN ('original', 'super')),
      final_size   INTEGER NOT NULL,
      series_fans  INTEGER NOT NULL,
      status       TEXT NOT NULL
    );

    CREATE TABLE course (
      id          INTEGER PRIMARY KEY,
      stable_id   TEXT NOT NULL UNIQUE,
      number      INTEGER NOT NULL,
      name        TEXT NOT NULL,
      state       TEXT NOT NULL,
      shape       TEXT NOT NULL CHECK (shape = 'loop'),
      lap_km      REAL NOT NULL CHECK (lap_km BETWEEN 10 AND 80),
      final_laps  INTEGER NOT NULL,
      road_type   TEXT NOT NULL CHECK (road_type IN ('forest', 'coast', 'mountain', 'night')),
      altitude_m  INTEGER NOT NULL,
      night       INTEGER NOT NULL CHECK (night IN (0, 1))
    );

    CREATE TABLE round (
      id              INTEGER PRIMARY KEY,
      season_id       INTEGER NOT NULL REFERENCES season (id),
      number          INTEGER NOT NULL,
      course_id       INTEGER NOT NULL REFERENCES course (id),
      practice_start  TEXT NOT NULL,
      prelim_start    TEXT NOT NULL,
      final_date      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'scheduled',
      weather_log     TEXT,
      UNIQUE (season_id, number)
    );

    CREATE TABLE manufacturer (
      id            INTEGER PRIMARY KEY,
      stable_id     TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      home_country  TEXT NOT NULL,
      type          TEXT NOT NULL CHECK (type IN ('hypercar', 'supercar', 'sports', 'jdm', 'domestic', 'other')),
      character     TEXT NOT NULL,
      next_refresh_year INTEGER NOT NULL
    );

    CREATE TABLE car_model (
      id               INTEGER PRIMARY KEY,
      stable_id        TEXT NOT NULL UNIQUE,
      manufacturer_id  INTEGER NOT NULL REFERENCES manufacturer (id),
      name             TEXT NOT NULL,
      tier             TEXT NOT NULL CHECK (tier IN ('starter', 'mid', 'premium', 'elite', 'hyper', 'unique')),
      base_kerb_kg     INTEGER NOT NULL,
      max_tyre_mm      INTEGER NOT NULL,
      base_ps          INTEGER NOT NULL,
      layout           TEXT NOT NULL CHECK (layout IN ('FR', 'MR', 'RR', 'AWD', 'FF')),
      price_new        INTEGER NOT NULL,
      generation       INTEGER NOT NULL DEFAULT 1,
      introduced_year  INTEGER NOT NULL,
      retired_year     INTEGER,
      predecessor_id   INTEGER REFERENCES car_model (id),
      CHECK (max_tyre_mm = CAST(ROUND(base_kerb_kg / 5.0 + 40) AS INTEGER))
    );

    CREATE TABLE garage (
      id               INTEGER PRIMARY KEY,
      name             TEXT NOT NULL UNIQUE,
      flag             TEXT NOT NULL,
      base_place_id    INTEGER NOT NULL REFERENCES place (id),
      home_state       TEXT NOT NULL,
      primary_colour   TEXT NOT NULL,
      secondary_colour TEXT NOT NULL,
      prestige         INTEGER NOT NULL CHECK (prestige BETWEEN 1 AND 100),
      cash             INTEGER NOT NULL,
      founded_year     INTEGER NOT NULL,
      is_player        INTEGER NOT NULL DEFAULT 0 CHECK (is_player IN (0, 1)),
      ai_profile       TEXT NOT NULL CHECK (ai_profile IN ('cautious', 'growth', 'star_chaser', 'local')),
      fans             INTEGER NOT NULL
    );

    CREATE TABLE driver (
      id                  INTEGER PRIMARY KEY,
      name                TEXT NOT NULL,
      gender              TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      birth_date          TEXT NOT NULL,
      nationality         TEXT NOT NULL,
      flag                TEXT NOT NULL,
      hometown_place_id   INTEGER NOT NULL REFERENCES place (id),
      residence_place_id  INTEGER NOT NULL REFERENCES place (id),
      pace                INTEGER NOT NULL,
      consistency         INTEGER NOT NULL,
      racecraft           INTEGER NOT NULL,
      tyre_management     INTEGER NOT NULL,
      composure           INTEGER NOT NULL,
      wet_skill           INTEGER NOT NULL,
      potential           INTEGER NOT NULL,
      home_road_type      TEXT NOT NULL CHECK (home_road_type IN ('forest', 'coast', 'mountain', 'night')),
      fans                INTEGER NOT NULL,
      fame                REAL NOT NULL,
      reputation          INTEGER NOT NULL,
      gold_border_year    INTEGER,
      silver_border_year  INTEGER,
      retired_year        INTEGER
    );

    CREATE TABLE driver_road_affinity (
      driver_id  INTEGER NOT NULL REFERENCES driver (id),
      road_type  TEXT NOT NULL CHECK (road_type IN ('forest', 'coast', 'mountain', 'night')),
      rating     INTEGER NOT NULL,
      PRIMARY KEY (driver_id, road_type)
    );

    CREATE TABLE car (
      id                INTEGER PRIMARY KEY,
      car_model_id      INTEGER NOT NULL REFERENCES car_model (id),
      chassis_no        TEXT NOT NULL UNIQUE,
      flag              TEXT NOT NULL,
      fans              INTEGER NOT NULL,
      garage_id         INTEGER NOT NULL REFERENCES garage (id),
      model_year        INTEGER NOT NULL,
      road_km           INTEGER NOT NULL CHECK (road_km >= 0),
      race_km           INTEGER NOT NULL CHECK (race_km >= 0),
      wear              REAL NOT NULL CHECK (wear BETWEEN 0 AND 100),
      kerb_kg_current   INTEGER NOT NULL,
      tyre_width_mm     INTEGER NOT NULL,
      CHECK (tyre_width_mm <= CAST(ROUND(kerb_kg_current / 5.0 + 40) AS INTEGER))
    );

    CREATE TABLE contract (
      id           INTEGER PRIMARY KEY,
      driver_id    INTEGER NOT NULL REFERENCES driver (id),
      garage_id    INTEGER NOT NULL REFERENCES garage (id),
      start_year   INTEGER NOT NULL,
      end_year     INTEGER NOT NULL CHECK (end_year >= start_year),
      salary       INTEGER NOT NULL,
      role         TEXT NOT NULL CHECK (role IN ('lead', 'development')),
      release_fee  INTEGER NOT NULL
    );

    CREATE TABLE entry (
      id           INTEGER PRIMARY KEY,
      season_id    INTEGER NOT NULL REFERENCES season (id),
      garage_id    INTEGER NOT NULL REFERENCES garage (id),
      driver_id    INTEGER NOT NULL REFERENCES driver (id),
      car_id       INTEGER NOT NULL REFERENCES car (id),
      race_number  INTEGER NOT NULL CHECK (race_number >= 1),
      series       TEXT NOT NULL DEFAULT 'main' CHECK (series IN ('main', 'junior')),
      fee_paid     INTEGER NOT NULL DEFAULT 0,
      UNIQUE (season_id, series, race_number),
      UNIQUE (season_id, series, driver_id),
      UNIQUE (season_id, series, car_id)
    );

    CREATE TABLE flag_fans (
      flag       TEXT NOT NULL,
      season_id  INTEGER NOT NULL REFERENCES season (id),
      fans       INTEGER NOT NULL,
      PRIMARY KEY (flag, season_id)
    );
  `,
};
