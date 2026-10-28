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

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePatch } from '../patch';
import { encodePatch } from '../patchbin';

/** the demo patches (scripts/rack-demos.ts) load, are written in format 49 and make sound (a held key for the drone) */
it.each(readdirSync(resolve(__dirname, 'demos')))('demo %s plays', (file) => {
  const p = validatePatch(JSON.parse(readFileSync(resolve(__dirname, 'demos', file), 'utf8')), DEFS);
  expect(encodePatch(p)[1]).toBe(49);
  const e = new Engine(44118);
  e.load(p);
  e.noteOn(48, 0.8);
  const l = new Float32Array(128), r = new Float32Array(128);
  let s = 0, peak = 0;
  for (let b = 0; b < 1400; b++) {
    e.render(l, r);
    for (const x of l) { s += x * x; peak = Math.max(peak, Math.abs(x)); }
  }
  const rms = Math.sqrt(s / (1400 * 128));
  console.log(file, 'rms', rms.toFixed(4), 'peak', peak.toFixed(3));
  expect(rms).toBeGreaterThan(0.01);
  expect(peak).toBeLessThan(1.5);
});
