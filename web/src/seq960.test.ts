// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: the Seq 960 (modules.ts seq960): its stage switches, its clocks, its CV and trigger outputs and its keys out
// into an instrument's allocator (engine.ts trackKeys), as the FM-1 plays them (engine.c m_seq960, tools/golden.sh).
import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { DEFS, seq960Next } from './modules';
import { make } from './presets';
import { makeAssembly } from './assembly';
import { arpOf } from './poly';

describe('seq960Next', () => {
  const m = (...x: number[]): number[] => [...x, ...Array(8 - x.length).fill(0)];
  it('plays every step in turn and wraps', () => {
    expect([-1, 0, 6, 7].map((p) => seq960Next(p, m()))).toEqual([0, 1, 7, 0]);
  });
  it('skips SKIP steps', () => {
    expect(seq960Next(0, m(0, 1, 1, 0))).toBe(3);
    expect(seq960Next(7, m(1, 0))).toBe(1);
  });
  it('holds on a STOP step', () => {
    expect(seq960Next(2, m(0, 0, 2))).toBe(-2);
    expect(seq960Next(1, m(0, 0, 2))).toBe(2);
  });
  it('a RESET step goes back to step 1 at once (it never plays)', () => {
    expect(seq960Next(2, m(0, 0, 0, 3))).toBe(0);
    expect(seq960Next(2, m(1, 0, 0, 3))).toBe(1);
  });
  it('nothing to play: -2', () => {
    expect(seq960Next(-1, Array(8).fill(1))).toBe(-2);
    expect(seq960Next(-1, m(3))).toBe(-2);
  });
});

/** a patch: the Seq 960 on the transport (or on an LFO square in clk), its rows and outputs into a mixer; keys into one voice */
function patch(params: Record<string, number>, clocked = false) {
  return make('s960', (add, wire) => {
    add('fm1', 0, 0, { tempo: 120 });
    const s = add('seq960', 0, 0, params);
    if (clocked) wire(add('lfo', 0, 0, { wave: 3, rate: 40, depth: 1 }), 'out', s, 'clk');
    const out = add('output', 0, 0, { level: 1 });
    const al = add('alloc', 0, 0, { voices: 1 });
    wire(s, 'keys', al, 'keys');
    wire(s, 'a', out, 'l');
    wire(al, 'pitch', out, 'r');
  });
}

describe('Seq 960', () => {
  it('has 39 knobs and no pins (PIN_EXEMPT), keys out, eight step triggers', () => {
    const d = DEFS.seq960;
    expect(d.params.length).toBe(39);
    expect(d.paramInputs).toBeFalsy();
    expect(d.outputs.map((o) => o.name)).toEqual(['a', 'b', 'c', 'gate', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 'keys']);
  });

  it('with the transport: row A in octaves times its range, step by step; keys play the instrument (C4 + semitones)', () => {
    const p = patch({ a1: 0, a2: 0.25, a3: 1 / 12, a4: -0.4, ra: 1, m5: 3 });
    makeAssembly(p, p.modules.filter((m) => m.type === 'alloc').map((m) => m.id), 'voice').poly = {};
    expect(arpOf(p, p.modules.find((m) => m.type === 'alloc')!)?.type).toBe('seq960');
    const e = new Engine(48000);
    e.load(p);
    const l = new Float32Array(128), r = new Float32Array(128);
    const seenA: number[] = [], seenP: number[] = [];
    e.transport(true);
    for (let b = 0; b < 1200; b++) {
      e.render(l, r);
      const a = Math.round(l[64] * 1000) / 1000, pr = Math.round(r[64] * 1000) / 1000;
      if (seenA[seenA.length - 1] !== a) seenA.push(a);
      if (seenP[seenP.length - 1] !== pr) seenP.push(pr);
    }
    // range 2 oct: 0, 0.5, 1/6, -0.8; step 5 is a RESET: back to step 1
    expect(seenA.slice(0, 6)).toEqual([0, 0.5, 0.167, -0.8, 0, 0.5]);
    // the instrument's pitch (octaves from C4): +6 semitones, +2, -10 (-9.6 rounded)
    expect(seenP).toContain(0.5);
    expect(seenP).toContain(0.167);
    expect(seenP).toContain(-0.833);
  });

  it('a STOP step holds it there; step triggers follow the step', () => {
    const p = make('s960stop', (add, wire) => {
      add('fm1', 0, 0, { tempo: 120 });
      const s = add('seq960', 0, 0, { a1: 0.1, a2: 0.2, a3: 0.3, m3: 2, gate: 1 });
      const out = add('output', 0, 0, { level: 1 });
      wire(s, 'a', out, 'l');
      wire(s, 't3', out, 'r');
    });
    const e = new Engine(48000);
    e.load(p);
    const l = new Float32Array(128), r = new Float32Array(128);
    e.transport(true);
    let t3 = 0, last = 0;
    for (let b = 0; b < 1500; b++) {
      e.render(l, r);
      if (r[100] > 0.5) t3++;
      last = l[100];
    }
    expect(Math.round(last * 100) / 100).toBe(0.3);
    expect(t3).toBeGreaterThan(0);
  });

  it('on a clock in clk, without the transport', () => {
    const p = patch({ a1: 0.25, a2: 0.75 }, true);
    const e = new Engine(48000);
    e.load(p);
    const l = new Float32Array(128), r = new Float32Array(128);
    const seen = new Set<number>();
    for (let b = 0; b < 400; b++) {
      e.render(l, r);
      seen.add(Math.round(l[0] * 100) / 100);
    }
    expect(seen.has(0.25) && seen.has(0.75)).toBe(true);
  });
});
