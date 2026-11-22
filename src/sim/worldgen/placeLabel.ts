// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * How a place is written for the player: an Australian place with its state in capitals ("Brisbane,
 * QLD": the state already says the country), any other place with its region ("Leeds, England").
 */
export function placeLabel(name: string, region: string, country: string): string {
  return country === 'AU' ? `${name}, ${region.toUpperCase()}` : `${name}, ${region}`;
}
