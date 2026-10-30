// SPDX-License-Identifier: GPL-3.0-only
// The FM-1's binaries read back (devicebin.ts): every factory patch, encoded, decoded and encoded again, gives the same bytes.
import { describe, expect, it } from 'vitest';
import { DEFS } from '../modules';
import { encodePatch } from '../patchbin';
import { validatePatch, type Patch } from '../patch';
import { decodeDevicePatch } from './devicebin';
import { forDevice } from './layout';
import { DEVICE_COMPILE } from '../device-compile';

const files = import.meta.glob<unknown>('./factory/*.json', { eager: true, import: 'default' });

describe('devicebin', () => {
  for (const compile of [true, false])
  for (const [file, raw] of Object.entries(files).sort()) {
    it(`reads back ${file}${compile ? '' : ' (no compile pass)'}`, () => {
      DEVICE_COMPILE.on = compile;
      const p = validatePatch(structuredClone(raw), DEFS) as Patch;
      const bin = encodePatch(forDevice(p));
      const back = decodeDevicePatch(bin, p.name);
      const again = encodePatch(forDevice(validatePatch(structuredClone(back), DEFS) as Patch));
      DEVICE_COMPILE.on = true;
      expect([...again]).toEqual([...bin]);
    });
  }
  it('keeps a MIDI map (MIDI LEARN) through the FM-1 and back', () => {
    const p = validatePatch(structuredClone(files['./factory/02-muug-bajo.json']), DEFS) as Patch;
    const muug = p.modules.find((m) => m.type === 'muug')!, osc = p.modules.find((m) => m.type === 'osc')!;
    p.midiMap = [{ cc: 74, module: muug.id, param: 'cutoff' }, { cc: 71, ch: 3, module: muug.id, param: 'emph' }, { cc: 20, module: osc.id, param: DEFS.osc.params[1].name }];
    const v = validatePatch(structuredClone(p), DEFS) as Patch;
    expect(v.midiMap).toHaveLength(3);
    const bin = encodePatch(forDevice(v));
    expect(bin[7] & 8).toBe(8);
    const back = decodeDevicePatch(bin, v.name);
    const byId = (q: Patch, id: number) => q.modules.find((m) => m.id === id)!;
    expect(back.midiMap?.map((e) => [e.cc, e.ch ?? 0, byId(back, e.module).type, e.param])).toEqual(
      v.midiMap!.map((e) => [e.cc, e.ch ?? 0, byId(v, e.module).type, e.param]));
    const again = encodePatch(forDevice(validatePatch(structuredClone(back), DEFS) as Patch));
    expect([...again]).toEqual([...bin]);
  });
  it('drops MIDI map entries that name nothing', () => {
    const p = validatePatch(structuredClone(files['./factory/00-init.json']), DEFS) as Patch;
    p.midiMap = [{ cc: 300, module: p.modules[0].id, param: 'x' }, { cc: 5, module: 99999, param: 'cutoff' }];
    expect(validatePatch(structuredClone(p), DEFS).midiMap).toBeUndefined();
  });
});
