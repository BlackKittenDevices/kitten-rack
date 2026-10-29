// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { Listener, Scope, Vj } from './scenes';

const sine = (f: number, n = 2048, rate = 44100, amp = 0.5): Float32Array => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / rate));

describe('the visuals page (the FM-1 visualizers on a big screen)', () => {
  it('a bass after silence is a beat; its bands are 0..255', () => {
    const l = new Listener();
    for (let t = 0; t < 10; t++) expect(l.listen(new Float32Array(2048), t * 45).beat).toBe(false);
    const b = l.listen(sine(60), 1000);
    expect(b.beat).toBe(true);
    expect(b.bass).toBeGreaterThan(200);
    expect(b.high).toBeLessThanOrEqual(255);
  });
  it('every scene paints in the six shades and moves; a 30-cell grid has the firmware\'s middle', () => {
    for (const w of [30, 60, 160]) {
      const v = new Vj(w, Math.round((w * 9) / 16));
      for (let s = 0; s < 5; s++) {
        v.scene = s;
        const a: number[] = [], b: number[] = [];
        for (let i = 0; i < v.w * v.h; i++) a.push(v.cell(i));
        for (let k = 0; k < 5; k++) v.step({ bass: 200, mid: 120, high: 130, beat: k === 0 }, k * 45);
        v.scene = s;
        for (let i = 0; i < v.w * v.h; i++) b.push(v.cell(i));
        expect(a.every((c) => c >= 0 && c <= 5 && Number.isInteger(c))).toBe(true);
        expect(new Set(a).size).toBeGreaterThan(1);
        expect(a.join(), `scene ${s} at ${w}`).not.toBe(b.join());
      }
    }
  });
  it('the scope starts on a rising zero crossing and fits the screen', () => {
    const s = new Scope();
    let tr: Float32Array = new Float32Array();
    for (let k = 0; k < 30; k++) tr = s.trace(sine(441, 2048, 44100, 0.05), 512);
    expect(Math.abs(tr[0])).toBeLessThan(0.1);
    expect(tr[5]).toBeGreaterThan(0);
    const peak = Math.max(...tr.map(Math.abs));
    expect(peak).toBeGreaterThan(0.6);
    expect(peak).toBeLessThanOrEqual(1);
  });
});
