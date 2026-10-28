// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK's demo patches (src/rack/demos/*.json): they show the format 49 modules. Run from web/:
//   npx vite-node scripts/rack-demos.ts
import { writeFileSync } from 'node:fs';
import { DEFS } from '../src/modules';
import { addModule, connect, newPatch, type ModuleInst, type Patch } from '../src/patch';
import { pack } from '../src/rack/layout';

type Add = (type: string, params?: Record<string, number>) => ModuleInst;
type Wire = (a: ModuleInst, ap: string, b: ModuleInst, bp: string) => void;
function demo(name: string, build: (add: Add, wire: Wire, main: ModuleInst, out: ModuleInst) => void, notes: string): Patch {
  const p = newPatch(DEFS, name);
  const main = p.modules.find((m) => m.type === 'fm1')!, out = p.modules.find((m) => m.type === 'output')!;
  const wire: Wire = (a, ap, b, bp) => {
    if (!connect(p, DEFS, { module: a.id, port: ap }, { module: b.id, port: bp })) throw new Error(`${name}: ${a.type}.${ap} -> ${b.type}.${bp}`);
  };
  build((type, params = {}) => setParams(addModule(p, DEFS[type], 0, 0), params), wire, main, out);
  out.params.level = 0.45;                         /* (a new patch's 0.15 is for a first unshaped note: these are shaped) */
  p.notes = notes;
  pack(p, DEFS);
  return p;
}
function setParams(m: ModuleInst, params: Record<string, number>): ModuleInst {
  for (const [k, v] of Object.entries(params)) {
    if (!DEFS[m.type].params.some((q) => q.name === k)) throw new Error(`${m.type} has no ${k}`);
    m.params[k] = v;
  }
  return m;
}

const demos: Patch[] = [
  demo('bonk west coast', (add, wire, _main, out) => {
    const clock = add('lfo', { wave: 3, rate: 7, depth: 1 });
    const eu = add('euclid', { steps: 16, pulses: 7, rotate: 2 });
    const tm = add('turing', { length: 8, change: 0.08, range: 1, scale: 4, root: 9, level: 0 });
    const vco = add('osc', { wave: 1, level: 0.9 });
    const fold = add('shape', { drive: 3 });
    const lpg = add('lpg', { mode: 0, decay: 0.35 });
    const rev = add('reverb', { size: 0.6, mix: 0.3 });
    wire(clock, 'out', eu, 'clock'); wire(clock, 'out', tm, 'clock');
    wire(tm, 'pitch', vco, 'pitch'); wire(vco, 'out', fold, 'in'); wire(fold, 'out', lpg, 'in');
    wire(eu, 'trig', lpg, 'strike'); wire(lpg, 'out', rev, 'in');
    wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  }, 'Plays itself after ENCENDER: a Turing machine picks notes, a Euclidean rhythm strikes a low pass gate.'),
  demo('lorenz drone', (add, wire, main, out) => {
    const chaos = add('chaos', { speed: 0.3, rho: 30 });
    const v1 = add('osc', { wave: 2, coarse: -12, level: 0.6 });
    const v2 = add('osc', { wave: 3, coarse: -12, fine: 9, level: 0.5 });
    const mix = add('mixer', { l1: 0.8, l2: 0.8 });
    const vcf = add('ladder', { cutoff: 600, res: 0.55, cvamt: 2 });
    const ring = add('ring', { mode: 1, level: 1 });
    const func = add('func', { rise: 2, fall: 3, shape: 0.4, cycle: 1 });
    const rev = add('reverb', { size: 0.85, mix: 0.45 });
    wire(main, 'pitch', v1, 'pitch'); wire(main, 'pitch', v2, 'pitch');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(chaos, 'x', vcf, 'cv'); wire(vcf, 'lp24', ring, 'a'); wire(func, 'out', ring, 'b');
    wire(ring, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  }, 'Hold a key: two oscillators through a ladder that the Lorenz attractor moves, breathing with a cycling function.'),
  demo('marbles pluck', (add, wire, _main, out) => {
    const clock = add('lfo', { wave: 3, rate: 5, depth: 1 });
    const bern = add('bern', { prob: 0.35 });
    const mar = add('marbles', { spread: 0.7, dejavu: 0.7, length: 6, density: 0.85, range: 1, scale: 1 });
    const vco = add('osc', { wave: 2, level: 0.8 });
    const env = add('func', { rise: 0.003, fall: 0.25, shape: 0.7 });
    const vca = add('vca');
    const dly = add('delay', { time: 300, fb: 0.4, mix: 0.3 });
    wire(clock, 'out', bern, 'trig'); wire(bern, 'a', mar, 'clock'); wire(mar, 'pitch', vco, 'pitch');
    wire(mar, 'gate', env, 'trig'); wire(vco, 'out', vca, 'in'); wire(env, 'out', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'r', out, 'r');
  }, 'Plays itself: a Bernoulli gate thins the clock, Marbles picks notes that half repeat, a Function plucks a VCA.'),
];
for (const p of demos) writeFileSync(new URL(`../src/rack/demos/${p.name.replace(/\s+/g, '-')}.json`, import.meta.url), JSON.stringify(p, null, 1) + '\n');
console.log(`wrote ${demos.length} demos`);
