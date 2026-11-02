// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import sponsorsJson from '../../data/sponsors.json';
import { sponsorBalance } from './worldgen/data';

export type SponsorTier = 'local' | 'regional' | 'national' | 'global';

export interface SponsorData {
  id: string;
  name: string;
  homeCountry: string;
  tier: SponsorTier;
  /** The least garage prestige this sponsor will deal with. */
  minPrestige: number;
  /** 0-100: how much weight the sponsor carries in a negotiation. */
  strength: number;
}

export const sponsors = sponsorsJson.sponsors as SponsorData[];

/** The sponsors a garage with this prestige may approach. */
export const eligibleSponsors = (prestige: number): SponsorData[] =>
  sponsors.filter((s) => s.minPrestige <= prestige);

/**
 * The fair title-sponsor fee per season: $25,000 + $700 per point of garage prestige + $400 per
 * point of the best driver's fame (see the GDD, "Negotiations").
 */
export function titleSponsorFee(prestige: number, bestDriverFame: number): number {
  const c = sponsorBalance;
  return c.feeBase + c.feePerPrestige * prestige + c.feePerFame * bestDriverFame;
}

/** What a sponsor pays each round: the season fee spread over the six rounds. */
export function feePerRound(seasonFee: number): number {
  return Math.round(seasonFee / sponsorBalance.roundsPerSeason);
}
