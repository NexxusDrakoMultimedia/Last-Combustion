// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/**
 * The .lcsave file: one file holding a whole career.
 *
 * Layout (all numbers big-endian):
 *   4 bytes   magic "LCSV"
 *   1 byte    container format version (1)
 *   4 bytes   header length in bytes
 *   n bytes   header, UTF-8 JSON (see SaveHeader)
 *   rest      the SQLite database
 */

export const SAVE_MAGIC = 'LCSV';
export const SAVE_FORMAT_VERSION = 1;

export interface SavePreview {
  mode: string;
  gameDate: string;
  founderCareer: boolean;
}

export interface SaveHeader {
  formatVersion: number;
  /** SQLite schema version of the database inside. */
  schemaVersion: number;
  /** Version of the game that wrote the file. */
  appVersion: string;
  createdAt: string;
  label: string;
  /** Mods used by the career: id and version. */
  mods: { id: string; version: string }[];
  preview: SavePreview;
  payloadBytes: number;
  /** SHA-256 of the database bytes, hex. */
  payloadSha256: string;
}

export type SaveHeaderInput = Omit<SaveHeader, 'formatVersion' | 'payloadBytes' | 'payloadSha256'>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function encodeSave(input: SaveHeaderInput, payload: Uint8Array): Promise<Uint8Array> {
  const header: SaveHeader = {
    ...input,
    formatVersion: SAVE_FORMAT_VERSION,
    payloadBytes: payload.byteLength,
    payloadSha256: await sha256Hex(payload),
  };
  const headerBytes = encoder.encode(JSON.stringify(header));
  const out = new Uint8Array(4 + 1 + 4 + headerBytes.byteLength + payload.byteLength);
  const view = new DataView(out.buffer);
  out.set(encoder.encode(SAVE_MAGIC), 0);
  view.setUint8(4, SAVE_FORMAT_VERSION);
  view.setUint32(5, headerBytes.byteLength);
  out.set(headerBytes, 9);
  out.set(payload, 9 + headerBytes.byteLength);
  return out;
}

export class SaveFileError extends Error {}

export async function decodeSave(
  bytes: Uint8Array,
): Promise<{ header: SaveHeader; payload: Uint8Array }> {
  if (bytes.byteLength < 9 || decoder.decode(bytes.subarray(0, 4)) !== SAVE_MAGIC) {
    throw new SaveFileError('This is not a Last Combustion save file.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formatVersion = view.getUint8(4);
  if (formatVersion > SAVE_FORMAT_VERSION) {
    throw new SaveFileError('This save file was written by a newer version of the game.');
  }
  const headerLength = view.getUint32(5);
  if (9 + headerLength > bytes.byteLength) throw new SaveFileError('The save file is truncated.');
  let header: SaveHeader;
  try {
    header = JSON.parse(decoder.decode(bytes.subarray(9, 9 + headerLength))) as SaveHeader;
  } catch {
    throw new SaveFileError('The save file header is damaged.');
  }
  const payload = bytes.subarray(9 + headerLength);
  if (payload.byteLength !== header.payloadBytes) {
    throw new SaveFileError('The save file is truncated.');
  }
  if ((await sha256Hex(payload)) !== header.payloadSha256) {
    throw new SaveFileError('The save file is damaged (checksum mismatch).');
  }
  return { header, payload: payload.slice() };
}
