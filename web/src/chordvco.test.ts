// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: the VCO Chord (modules.ts chordvco), after Kitten's VCO Chord 2.0 and HAGIWO's chord VCO: its chords and
// inversions, the arpeggio on the transport, the keys (a voice's pitch) and bits 8, as the FM-1 plays them (engine.c
// m_chordvco, tools/golden.sh).
import { describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { CHORDVCO_CHORDS, CHORDVCO_INV, DEFS, DEVICE_SR, exp2Scale } from './modules';
import { make } from './presets';

/** the output of a patch: a VCO Chord with `params` into OUT (level 1), its pitch from `pitch` (a constant) if given */
function render(params: Record<string, number>, blocks: number, run = false, pitch?: number): Float32Array {
  const p = make('cvc', (add, wire) => {
    add('fm1', 0, 0, { tempo: 120 });
    const v = add('chordvco', 0, 0, params);
    const out = add('output', 0, 0, { level: 1 });
    wire(v, 'out', out, 'l');
    wire(v, 'trig', out, 'r');
    if (pitch !== undefined) wire(add('const', 0, 0, { value: pitch }), 'out', v, 'pitch');
  });
  const e = new Engine(DEVICE_SR);
  e.load(p);
  if (run) e.transport(true);
  const l = new Float32Array(128), r = new Float32Array(128), all = new Float32Array(blocks * 256);
  for (let b = 0; b < blocks; b++) {
    e.render(l, r);
    all.set(l, b * 256);
    all.set(r, b * 256 + 128);
  }
  return all;
}
const left = (x: Float32Array): number[] => Array.from(x).filter((_, i) => i % 256 < 128);
const right = (x: Float32Array): number[] => Array.from(x).filter((_, i) => i % 256 >= 128);
/** rising zero crossings a second */
const crossings = (x: number[]): number => x.reduce((n, v, i) => n + (i > 0 && x[i - 1] < 0 && v >= 0 ? 1 : 0), 0) / (x.length / DEVICE_SR);

describe('VCO Chord', () => {
  it('its parameters: chord, inv, wave, detune first (the pins and K1..K4), then the rest; pitch, clk in; out, trig out', () => {
    const d = DEFS.chordvco;
    expect(d.params.map((p) => p.name)).toEqual(['chord', 'inv', 'wave', 'detune', 'tune', 'arp', 'rate', 'range', 'mutate', 'stroct', 'strst', 'bits', 'level']);
    expect(d.inputs.map((p) => p.name).slice(0, 2)).toEqual(['pitch', 'clk']);
    expect(d.outputs.map((p) => p.name)).toEqual(['out', 'trig']);
    expect(d.paramInputs).toBe(true);
    expect(CHORDVCO_CHORDS).toHaveLength(7);
    expect(CHORDVCO_INV).toHaveLength(16);
  });

  it('exp2Scale is engine.c exp2_scale: C4 an octave up doubles, a semitone is 2^(1/12)', () => {
    expect(exp2Scale(25469723, 0)).toBe(25469723);
    expect(exp2Scale(25469723, 65536)).toBe(50939446);
    expect(Math.abs(exp2Scale(25469723, 65536 / 12) / 25469723 - Math.pow(2, 1 / 12))).toBeLessThan(1e-5);
  });

  it('arp on, sine, no detune: the five play one note, the chord root first; pitch +1 octave doubles it', () => {
    const a = crossings(left(render({ arp: 1, wave: 3 }, 300)));
    const b = crossings(left(render({ arp: 1, wave: 3 }, 300, false, 1)));
    expect(Math.abs(a / 261.6 - 1)).toBeLessThan(0.02);
    expect(Math.abs(b / a - 2)).toBeLessThan(0.02);
  });

  it('the arpeggio steps with the transport: a trig each 1/16 at 120', () => {
    const r = right(render({ arp: 1, rate: 3 }, 400, true));
    let rises = 0;
    for (let i = 1; i < r.length; i++) if (r[i] > 0.5 && r[i - 1] <= 0.5) rises++;
    const sixteenths = (r.length / DEVICE_SR) / 0.125;
    expect(Math.abs(rises - sixteenths)).toBeLessThanOrEqual(2);
  });

  it('bits 8: the output holds steps of 1/508 (8-bit waves summed), at 16384 Hz', () => {
    const l = left(render({ bits: 1, inv: 11, level: 1 }, 20));
    for (const v of l.slice(1000, 1400)) expect(Math.abs(v * 508 - Math.round(v * 508))).toBeLessThan(1e-3);
    let changes = 0;
    for (let i = 1001; i < 1401; i++) if (l[i] !== l[i - 1]) changes++;
    expect(changes).toBeLessThanOrEqual(Math.ceil((400 * 16384) / DEVICE_SR) + 1);
  });

  it('inversion 0 leaves the fifth oscillator (the root) out; 15 plays it', () => {
    const quiet = left(render({ inv: 0, wave: 3 }, 40)), full = left(render({ inv: 15, wave: 3 }, 40));
    const rms = (x: number[]) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    expect(rms(full)).not.toBeCloseTo(rms(quiet), 2);
  });
});
