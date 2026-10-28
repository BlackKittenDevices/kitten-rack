// SPDX-License-Identifier: GPL-3.0-only
import { expect, it } from 'vitest';
import { Engine } from '../engine';
import { DEFS } from '../modules';
import { addModule, connect, newPatch, type ModuleInst } from '../patch';

/** the rack's starter patch (main.ts initPatch) makes sound on a key and goes quiet after it */
it('the starter patch sounds on a note', () => {
  const p = newPatch(DEFS, 't');
  const main = p.modules.find((m) => m.type === 'fm1')!;
  const out = p.modules.find((m) => m.type === 'output')!;
  const vco = addModule(p, DEFS.osc, 0, 0), vcf = addModule(p, DEFS.ladder, 0, 0), adsr = addModule(p, DEFS.adsr, 0, 0), vca = addModule(p, DEFS.vca, 0, 0);
  vcf.params.cutoff = 900;
  const c = (a: ModuleInst, ap: string, b: ModuleInst, bp: string): void => void connect(p, DEFS, { module: a.id, port: ap }, { module: b.id, port: bp });
  c(main, 'pitch', vco, 'pitch'); c(vco, 'out', vcf, 'in'); c(main, 'gate', adsr, 'gate'); c(adsr, 'env', vcf, 'cv');
  c(vcf, 'lp24', vca, 'in'); c(adsr, 'env', vca, 'cv'); c(vca, 'out', out, 'l'); c(vca, 'out', out, 'r');
  expect(p.cables.length).toBe(8);
  const e = new Engine(48000);
  e.load(p);
  const l = new Float32Array(128), r = new Float32Array(128);
  const rms = (blocks: number): number => {
    let s = 0;
    for (let b = 0; b < blocks; b++) {
      e.render(l, r);
      for (const x of l) s += x * x;
    }
    return Math.sqrt(s / (blocks * 128));
  };
  expect(rms(20)).toBeLessThan(1e-4);
  e.noteOn(57, 0.8);
  const on = rms(100);
  e.noteOff(57);
  rms(400);
  const after = rms(50);
  console.log('rms on', on.toFixed(4), 'after release', after.toFixed(6));
  expect(on).toBeGreaterThan(0.01);
  expect(after).toBeLessThan(on / 20);
});
