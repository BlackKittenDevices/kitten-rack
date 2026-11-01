// SPDX-License-Identifier: GPL-3.0-only
// The FM-1's binaries read back (devicebin.ts): every factory patch, encoded, decoded and encoded again, gives the same bytes.
import { describe, expect, it } from 'vitest';
import { DEFS } from '../modules';
import { encodePatch } from '../patchbin';
import { parse, parseTrack, trackFrame } from '../protocol';
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
  it('keeps notes played off the grid (a take, QUANTIZE OFF) through the FM-1 and back', () => {
    const p = validatePatch(structuredClone(files['./factory/02-muug-bajo.json']), DEFS) as Patch;
    const st = p.modules.find((m) => m.type === 'steps')!;
    st.notes = [{ at: 0, len: 1, note: 48, vel: 100, hold: true, off: 9, end: 40 }, { at: 3, len: 2, note: 50, vel: 90 }, { at: 6, len: 1, note: 52, vel: 80, off: 33 }];
    st.patterns = [{ notes: [{ at: 1, len: 1, note: 55, vel: 100, hold: true, end: 12 }] }];
    const v = validatePatch(structuredClone(p), DEFS) as Patch;
    const bin = encodePatch(forDevice(v));
    expect(bin[7] & 16).toBe(16);
    const back = decodeDevicePatch(bin, v.name);
    const bs = back.modules.find((m) => m.type === 'steps')!;
    expect(bs.notes!.map((n) => [n.at, n.off, n.end])).toEqual([[0, 9, 40], [3, undefined, undefined], [6, 33, undefined]]);
    expect(bs.patterns![0]!.notes![0].end).toBe(12);
    const again = encodePatch(forDevice(validatePatch(structuredClone(back), DEFS) as Patch));
    expect([...again]).toEqual([...bin]);
    st.notes = st.notes.map(({ off: _o, end: _e, ...n }) => n);
    st.patterns = [{ notes: [{ at: 1, len: 1, note: 55, vel: 100, hold: true }] }];
    expect(encodePatch(forDevice(validatePatch(structuredClone(p), DEFS) as Patch))[7] & 16).toBe(0);
  });
  it('sends and reads a track\'s timing in TRACK frames', () => {
    const notes = [{ at: 0, len: 1, note: 60, vel: 100, off: 5 }, { at: 2, len: 2, note: 62, vel: 100, hold: true, end: 7 }];
    const f = trackFrame(3, notes, 0);
    const p = parse(f)!;
    const t = parseTrack(p.payload)!;
    expect(t.notes.map((n) => [n.off, n.end])).toEqual([[5, undefined], [undefined, 7]]);
    expect(parse(trackFrame(3, [{ at: 0, len: 1, note: 60, vel: 100 }], 0))!.payload).toHaveLength(7);
  });
  it('drops MIDI map entries that name nothing', () => {
    const p = validatePatch(structuredClone(files['./factory/00-init.json']), DEFS) as Patch;
    p.midiMap = [{ cc: 300, module: p.modules[0].id, param: 'x' }, { cc: 5, module: 99999, param: 'cutoff' }];
    expect(validatePatch(structuredClone(p), DEFS).midiMap).toBeUndefined();
  });
});
