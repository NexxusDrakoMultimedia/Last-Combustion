// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from './rng';
import { executiveData } from './worldgen/data';
import { personName } from './worldgen/names';

export type ExecutiveRole = keyof typeof executiveData.roles;
export const EXECUTIVE_ROLES = Object.keys(executiveData.roles) as ExecutiveRole[];

/** The roles that can be filled now: the others wait for what they affect to be built. */
export const BUILT_ROLES: ExecutiveRole[] = EXECUTIVE_ROLES.filter(
  (r) => executiveData.roles[r].built,
);

/** An executive who could be hired. */
export interface ExecutiveOffer {
  role: ExecutiveRole;
  name: string;
  /** 0 to 100. */
  skill: number;
  /** What they would cost a year at their asking salary. */
  salary: number;
  age: number;
}

/** What an executive of some skill asks a year: $40,000 plus $1,200 a point. */
export function fairSalaryFor(skill: number): number {
  return Math.round(executiveData.salaryBase + executiveData.salaryPerSkill * skill);
}

/** What an executive is paid for one round: a year's salary shared over the six rounds. */
export function salaryPerRound(salary: number): number {
  return Math.round(salary / 6);
}

/** How many executive roles a garage of some prestige may fill: one from prestige 10, then one more for every 10. */
export function executiveSlots(prestige: number): number {
  if (prestige < executiveData.firstSlotPrestige) return 0;
  return (
    1 + Math.floor((prestige - executiveData.firstSlotPrestige) / executiveData.prestigePerSlot)
  );
}

/** The executives on offer for one role, drawn from a stream. */
export function executiveOffers(rng: RandomStream, role: ExecutiveRole): ExecutiveOffer[] {
  const [lo, hi] = executiveData.skill as [number, number];
  return Array.from({ length: executiveData.offersPerRole }, () => {
    const skill = rng.int(lo, hi);
    return {
      role,
      name: personName(rng, 'AU', rng.chance(0.5) ? 'male' : 'female'),
      skill,
      salary: fairSalaryFor(skill),
      age: rng.int(38, 58),
    };
  });
}

/** What a garage's executives add up to. Every field is 0 when there are none. */
export interface ExecutiveBonuses {
  /** Added to the garage's leverage in every deal (a bigger number is better for the garage). */
  leverage: number;
  /** An extra counter of patience in every deal. */
  extraPatience: boolean;
  /** Multiplies the title sponsor fee asked: `1 + this`. */
  sponsorFee: number;
  /** Lowers a sponsor's minimum prestige by this many points. */
  sponsorPrestige: number;
  /** Multiplies the fans gained from results: `1 + this`. */
  fans: number;
  /** Multiplies merchandise income: `1 + this`. */
  merchandise: number;
  /** Points off the auction buyer's premium and the seller's fee (as shares, 0.03 is three points). */
  auctionPremium: number;
  auctionFee: number;
  /** Shares off part prices and part wear. */
  partPrice: number;
  partWear: number;
  /** Adds to the effect of driver training: `1 + this`. */
  training: number;
  /** Share off the cost of refurbishing gear. */
  gearCost: number;
  /** Share off utility, fuel and logistics bills (for when suppliers are built). */
  utilities: number;
  /** Share off the chance that a supply outage runs on into a second round. */
  outages: number;
  /** Multiplies the prestige the garage has earned above the base: `1 + this`. */
  prestige: number;
}

export const NO_BONUSES: ExecutiveBonuses = {
  leverage: 0,
  extraPatience: false,
  sponsorFee: 0,
  sponsorPrestige: 0,
  fans: 0,
  merchandise: 0,
  auctionPremium: 0,
  auctionFee: 0,
  partPrice: 0,
  partWear: 0,
  training: 0,
  gearCost: 0,
  utilities: 0,
  outages: 0,
  prestige: 0,
};

/**
 * The bonuses of a set of executives: each role gives its maximum times skill ÷ 100, and a Chief
 * Executive raises every other executive's bonus by up to 10% (times their own skill).
 */
export function executiveBonuses(
  executives: readonly { role: ExecutiveRole; skill: number }[],
): ExecutiveBonuses {
  const roles = executiveData.roles;
  const chief = executives.find((e) => e.role === 'chief_executive');
  const lift = chief ? 1 + (roles.chief_executive.max.othersBonus * chief.skill) / 100 : 1;
  const out: ExecutiveBonuses = { ...NO_BONUSES };
  for (const e of executives) {
    const share = Math.max(0, Math.min(100, e.skill)) / 100;
    const mult = e.role === 'chief_executive' ? 1 : lift;
    const get = (max: number) => max * share * mult;
    switch (e.role) {
      case 'chief_executive':
        out.prestige = roles.chief_executive.max.prestige * share;
        break;
      case 'commercial_director':
        out.sponsorFee = get(roles.commercial_director.max.sponsorFee);
        out.sponsorPrestige = Math.round(get(roles.commercial_director.max.sponsorPrestige));
        break;
      case 'contracts_director':
        out.leverage = get(roles.contracts_director.max.leverage);
        out.extraPatience = e.skill >= roles.contracts_director.extraPatienceFromSkill;
        break;
      case 'head_of_marketing':
        out.fans = get(roles.head_of_marketing.max.fans);
        out.merchandise = get(roles.head_of_marketing.max.merchandise);
        break;
      case 'operations_director':
        out.utilities = get(roles.operations_director.max.utilities);
        out.outages = get(roles.operations_director.max.outageLength);
        break;
      case 'finance_director':
        out.auctionPremium = get(roles.finance_director.max.auctionPremium);
        out.auctionFee = get(roles.finance_director.max.auctionFee);
        break;
      case 'technical_director':
        out.partPrice = get(roles.technical_director.max.partPrice);
        out.partWear = get(roles.technical_director.max.partWear);
        break;
      case 'sporting_director':
        out.training = get(roles.sporting_director.max.training);
        out.gearCost = get(roles.sporting_director.max.gearCost);
        break;
      default:
        break;
    }
  }
  return out;
}

/** The age an executive retires at (60 to 70), drawn once for each person from the career's seed. */
export function retirementAge(stream: RandomStream): number {
  const [lo, hi] = executiveData.retireAge as [number, number];
  return stream.int(lo, hi);
}

/** The pay the market gives an executive of a skill. */
export const marketSalary = (skill: number): number =>
  executiveData.salaryBase + executiveData.salaryPerSkill * skill;

/**
 * The chance that a rival poaches an executive in a year: higher for better executives, and for
 * those paid below the market for their skill.
 */
export function poachChance(skill: number, salary: number): number {
  const c = executiveData.poach;
  const ratio = salary / marketSalary(skill);
  const [lo, hi] = c.payRange as [number, number];
  const pay = Math.min(hi, Math.max(lo, 2 - ratio));
  return Math.min(1, (c.base + (c.perSkill * skill) / 100) * pay);
}
