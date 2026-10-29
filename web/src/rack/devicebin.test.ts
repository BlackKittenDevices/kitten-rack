// SPDX-License-Identifier: GPL-3.0-only
// The FM-1's binaries read back (devicebin.ts): every factory patch, encoded, decoded and encoded again, gives the same bytes.
import { describe, expect, it } from 'vitest';
import { DEFS } from '../modules';
import { encodePatch } from '../patchbin';
import { validatePatch, type Patch } from '../patch';
import { decodeDevicePatch } from './devicebin';
import { forDevice } from './layout';

const files = import.meta.glob<unknown>('./factory/*.json', { eager: true, import: 'default' });

describe('devicebin', () => {
  for (const [file, raw] of Object.entries(files).sort()) {
    it(`reads back ${file}`, () => {
      const p = validatePatch(structuredClone(raw), DEFS) as Patch;
      const bin = encodePatch(forDevice(p));
      const back = decodeDevicePatch(bin, p.name);
      const again = encodePatch(forDevice(validatePatch(structuredClone(back), DEFS) as Patch));
      expect([...again]).toEqual([...bin]);
    });
  }
});
