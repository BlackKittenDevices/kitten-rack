// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK's factory bank: 24 patches built here from modules and cables (src/rack/factory/NN-name.json). The rack
// editor's Fábrica list and the FM-1's factory slots (export-defs.ts -> firmware/src/presets.h) both read these files.
// Three ideas run through it: the 60s modulars (Moog, Buchla, ARP: played from the keys), modern generative patching
// (patches that play themselves), and noise machines and drones (knobs to turn live). Each patch is rendered on the
// reference engine and its OUT level set so the bank sits at one loudness, and must fit the FM-1 (encodePatch).
// Run from web/:  npx vite-node scripts/rack-factory.ts
import { readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { DEFS } from '../src/modules';
import { addModule, connect, newPatch, NEW_PANEL, validatePatch, type ModuleInst, type Patch } from '../src/patch';
import { pack } from '../src/rack/layout';
import { Engine } from '../src/engine';
import { deviceBudget, encodePatch } from '../src/patchbin';
import { cpuEstimate } from '../src/cpu';

type Pins = { p1?: string[]; p2?: string[]; att?: [number, number] };
type Add = (type: string, params?: Record<string, number>, pins?: Pins) => ModuleInst;
type Wire = (a: ModuleInst, ap: string, b: ModuleInst, bp: string) => void;
type Play = 'keys' | 'self';
interface Built { patch: Patch; play: Play }

const OUT_DIR = new URL('../src/rack/factory/', import.meta.url);
const SR = 44118;

function build(name: string, play: Play, notes: string, make: (add: Add, wire: Wire, main: ModuleInst, out: ModuleInst) => void): Built {
  const p = newPatch(DEFS, name);
  const main = p.modules.find((m) => m.type === 'fm1')!, out = p.modules.find((m) => m.type === 'output')!;
  const wire: Wire = (a, ap, b, bp) => {
    if (!connect(p, DEFS, { module: a.id, port: ap }, { module: b.id, port: bp })) throw new Error(`${name}: ${a.type}.${ap} -> ${b.type}.${bp}`);
  };
  const add: Add = (type, params = {}, pins) => {
    const m = addModule(p, DEFS[type], 0, 0);
    for (const [k, v] of Object.entries(params)) {
      if (!DEFS[type].params.some((q) => q.name === k)) throw new Error(`${name}: ${type} has no ${k}`);
      m.params[k] = v;
    }
    if (pins) {
      for (const s of ['p1', 'p2'] as const)
        for (const q of pins[s] ?? []) if (!DEFS[type].params.some((x) => x.name === q)) throw new Error(`${name}: ${type} has no ${q} to pin`);
      m.map = { p1: pins.p1 ?? [], p2: pins.p2 ?? [], k1: [], k2: [], k3: [], k4: [] };
      if (pins.att) m.att = pins.att;
    }
    return m;
  };
  make(add, wire, main, out);
  withSequencer(p, main);
  p.notes = notes;
  pack(p, DEFS);
  return { patch: validatePatch(structuredClone(p), DEFS), play };
}

/**
 * Every patch gets the FM-1's own sequencer, as INIT has it: the keys go through a Steps track (SEQ, REC and PLAY record
 * and play it), an arpeggiator the ARP button switches on and off, and a one-voice allocator; the cables that took the
 * keyboard's pitch, gate and velocity from MIDI-CV take them from the allocator instead, so a played and a sequenced
 * note sound the same.
 */
function withSequencer(p: Patch, main: ModuleInst): void {
  const steps = addModule(p, DEFS.steps, 0, 0);
  Object.assign(steps.params, { len: 16, rate: 4, swing: 50, gate: 0.25, dir: 0 });
  steps.name = 'PATTERN';
  steps.att = [1, 1];
  steps.map = { p1: ['len'], p2: ['rate'], k1: ['len'], k2: ['rate'], k3: ['swing'], k4: ['gate'] };
  const arp = addModule(p, DEFS.arp, 0, 0);
  Object.assign(arp.params, { mode: 0, rate: 4, octaves: 1, gate: 0.5, latch: 0 });
  arp.bypass = true;
  const voice = addModule(p, DEFS.alloc, 0, 0);
  Object.assign(voice.params, { voices: 1, assign: 0, legato: 0, priority: 0, unison: 0, channel: 0, low: 0, high: 127, steal: 1, stack: 0 });
  for (const c of p.cables)
    if (c.from.module === main.id && ['pitch', 'gate', 'vel'].includes(c.from.port)) c.from = { module: voice.id, port: c.from.port };
  for (const [a, ap, b, bp] of [[main, 'keys', steps, 'keys'], [steps, 'keys', arp, 'keys'], [arp, 'keys', voice, 'keys']] as const)
    if (!connect(p, DEFS, { module: a.id, port: ap }, { module: b.id, port: bp })) throw new Error(`${p.name}: sequencer ${a.type}.${ap} -> ${b.type}.${bp}`);
  main.panel = { ...(main.panel ?? {}), toggle: ['arp'], kinds: { ...(main.panel?.kinds ?? {}), arp: 'bypass' }, targets: { ...(main.panel?.targets ?? {}), arp: { module: arp.id } } } as typeof main.panel;
}

/** the classic Matryoshka INIT (one voice, keys, a filter, an envelope), with a tape echo before OUT */
function init(): Built {
  const src = JSON.parse(readFileSync(new URL('../presets/01-init.json', import.meta.url), 'utf8'));
  const p = validatePatch(src, DEFS);
  p.name = 'init';
  const vca = p.modules.find((m) => m.type === 'vca')!, out = p.modules.find((m) => m.type === 'output')!;
  p.cables = p.cables.filter((c) => !(c.from.module === vca.id && c.to.module === out.id));
  const d = addModule(p, DEFS.delay, 0, 0);
  Object.assign(d.params, { time: 320, fb: 0.35, mix: 0.25, tape: 0.5 });
  for (const [a, ap, b, bp] of [[vca, 'out', d, 'in'], [d, 'out', out, 'l'], [d, 'out', out, 'r']] as const)
    if (!connect(p, DEFS, { module: a.id, port: ap }, { module: b.id, port: bp })) throw new Error('init');
  const m = p.modules.find((x) => x.type === 'fm1')!;   // the free buttons KITTEN RACK's (FX, LFO, EDIT: panel.c kr_button)
  m.panel = { ...(m.panel ?? {}), kinds: { ...NEW_PANEL().kinds, ...(m.panel?.kinds ?? {}) } } as typeof m.panel;
  p.notes = 'El punto de partida: un oscilador, un filtro, una envolvente y un eco de cinta. Se toca con el teclado.';
  pack(p, DEFS);
  return { patch: validatePatch(p, DEFS), play: 'keys' };
}

const BANK: [string, () => Built][] = [
  ['init', init],

  // ---------------------------------------------------------------- the 60s modulars, played from the keys
  ['muug tape', () => build('muug tape', 'keys', 'Dos sierras por el Muug (una envolvente lo abre, el teclado lo sigue), eco de cinta y resorte. Teclado.', (add, wire, main, out) => {
    const v1 = add('osc', { wave: 2, coarse: -12, level: 0.7 });
    const v2 = add('osc', { wave: 2, coarse: -12, fine: 7, level: 0.6 });
    const mix = add('mixer', { l1: 0.7, l2: 0.7 });
    const vcf = add('muug', { cutoff: -1.5, emph: 6.5, drive: 1.6, cvamt: 3, track: 1 });
    const fenv = add('adsr', { a: 0.005, d: 0.35, s: 0.2, r: 0.3 });
    const aenv = add('adsr', { a: 0.004, d: 0.6, s: 0.6, r: 0.25 });
    const vca = add('vca', { gain: 1.8 });
    const dly = add('delay', { time: 330, fb: 0.55, mix: 0.3, tape: 0.7 });
    const rev = add('reverb', { size: 0.45, damp: 0.2, mix: 0.25, spring: 1 });
    wire(main, 'pitch', v1, 'pitch'); wire(main, 'pitch', v2, 'pitch');
    wire(main, 'gate', fenv, 'gate'); wire(main, 'gate', aenv, 'gate');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(fenv, 'env', vcf, 'cv'); wire(vcf, 'out', vca, 'in'); wire(aenv, 'env', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', rev, 'in');
    wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['muug bajo', () => build('muug bajo', 'keys', 'El bajo de 1968: sierra y cuadrada una octava abajo, glide corto, el Muug abierto de golpe por su envolvente. Teclado.', (add, wire, main, out) => {
    const port = add('glide', { time: 0.035 });
    const v1 = add('osc', { wave: 2, coarse: -12, level: 0.8 });
    const v2 = add('osc', { wave: 3, coarse: -24, pw: 0.45, level: 0.6 });
    const mix = add('mixer', { l1: 0.8, l2: 0.65 });
    const vcf = add('muug', { cutoff: -2.2, emph: 4.8, drive: 2.2, cvamt: 3.4, track: 1 });
    const fenv = add('adsr', { a: 0.002, d: 0.22, s: 0.12, r: 0.12 });
    const aenv = add('adsr', { a: 0.002, d: 0.5, s: 0.85, r: 0.09 });
    const vca = add('vca');
    wire(main, 'pitch', port, 'in'); wire(port, 'out', v1, 'pitch'); wire(port, 'out', v2, 'pitch');
    wire(main, 'gate', fenv, 'gate'); wire(main, 'gate', aenv, 'gate');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(fenv, 'env', vcf, 'cv'); wire(vcf, 'out', vca, 'in'); wire(aenv, 'env', vca, 'cv');
    wire(vca, 'out', out, 'l'); wire(vca, 'out', out, 'r');
  })],
  ['lead 1969', () => build('lead 1969', 'keys', 'Lead que canta: portamento, vibrato que la rueda de modulación profundiza, dos sierras al Muug resonante, eco de cinta. Teclado.', (add, wire, main, out) => {
    const port = add('glide', { time: 0.12 });
    const vib = add('lfo', { wave: 0, rate: 5.6, depth: 0.012 }, { p1: ['depth'], att: [0.05, 1] });
    const v1 = add('osc', { wave: 2, level: 0.7 });
    const v2 = add('osc', { wave: 2, fine: 9, level: 0.6 });
    const mix = add('mixer', { l1: 0.7, l2: 0.7 });
    const vcf = add('muug', { cutoff: -0.6, emph: 6.2, drive: 1.4, cvamt: 2.4, track: 1 });
    const fenv = add('adsr', { a: 0.01, d: 0.5, s: 0.35, r: 0.4 });
    const aenv = add('adsr', { a: 0.008, d: 0.3, s: 0.9, r: 0.35 });
    const vca = add('vca');
    const dly = add('delay', { time: 380, fb: 0.45, mix: 0.3, tape: 0.6 });
    wire(main, 'pitch', port, 'in'); wire(port, 'out', v1, 'pitch'); wire(port, 'out', v2, 'pitch');
    wire(vib, 'out', v1, 'pitch'); wire(vib, 'out', v2, 'pitch'); wire(main, 'mod', vib, 'p1');
    wire(main, 'gate', fenv, 'gate'); wire(main, 'gate', aenv, 'gate');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(fenv, 'env', vcf, 'cv'); wire(vcf, 'out', vca, 'in'); wire(aenv, 'env', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'out', out, 'r');
  })],
  ['bronces 1971', () => build('bronces 1971', 'keys', 'Bronces a la manera modular: sierras desafinadas, el filtro abre más lento que el volumen, chorus. Teclado.', (add, wire, main, out) => {
    const v1 = add('osc', { wave: 2, unison: 3, detune: 14, level: 0.75 });
    const v2 = add('osc', { wave: 2, coarse: -12, fine: -5, level: 0.5 });
    const mix = add('mixer', { l1: 0.75, l2: 0.6 });
    const vcf = add('muug', { cutoff: -2.6, emph: 2.6, drive: 1.8, cvamt: 3.2, track: 1 });
    const fenv = add('adsr', { a: 0.09, d: 0.6, s: 0.55, r: 0.35 });
    const aenv = add('adsr', { a: 0.03, d: 0.3, s: 0.9, r: 0.3 });
    const vca = add('vca');
    const ch = add('chorus', { rate: 0.45, depth: 0.45, mix: 0.4 });
    wire(main, 'pitch', v1, 'pitch'); wire(main, 'pitch', v2, 'pitch');
    wire(main, 'gate', fenv, 'gate'); wire(main, 'gate', aenv, 'gate');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(fenv, 'env', vcf, 'cv'); wire(vcf, 'out', vca, 'in'); wire(aenv, 'env', vca, 'cv');
    wire(vca, 'out', ch, 'in'); wire(ch, 'l', out, 'l'); wire(ch, 'r', out, 'r');
  })],
  ['theremin', () => build('theremin', 'keys', 'Ciencia ficción de los 50 y 60: una senoidal que se desliza entre notas con vibrato ancho, entrada lenta, sala grande. Teclado.', (add, wire, main, out) => {
    const port = add('glide', { time: 0.32, curve: 1 });
    const vib = add('lfo', { wave: 0, rate: 6.2, depth: 0.022 });
    const v = add('osc', { wave: 0, coarse: 12, level: 0.85 });
    const v2 = add('osc', { wave: 1, coarse: 12, level: 0.25 });
    const mix = add('mixer', { l1: 0.85, l2: 0.3 });
    const env = add('adsr', { a: 0.22, d: 0.2, s: 1, r: 0.7 });
    const vca = add('vca');
    const rev = add('reverb', { size: 0.72, damp: 0.35, mix: 0.35 });
    wire(main, 'pitch', port, 'in'); wire(port, 'out', v, 'pitch'); wire(port, 'out', v2, 'pitch');
    wire(vib, 'out', v, 'pitch'); wire(vib, 'out', v2, 'pitch');
    wire(v, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vca, 'in');
    wire(main, 'gate', env, 'gate'); wire(env, 'env', vca, 'cv');
    wire(vca, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['campanas ring', () => build('campanas ring', 'keys', 'Campanas de modulador en anillo: dos senoidales a un intervalo raro multiplicadas, caída de golpe, tanque de resortes. Teclado.', (add, wire, main, out) => {
    const a = add('osc', { wave: 0, level: 0.9 });
    const b = add('osc', { wave: 0, coarse: 19, fine: 37, level: 0.9 });
    const ring = add('ring', { mode: 0, level: 1 });
    const hit = add('func', { rise: 0.002, fall: 1.6, shape: 0.6 });
    const vca = add('vca');
    const rev = add('reverb', { size: 0.6, damp: 0.25, mix: 0.35, spring: 1 });
    wire(main, 'pitch', a, 'pitch'); wire(main, 'pitch', b, 'pitch');
    wire(a, 'out', ring, 'a'); wire(b, 'out', ring, 'b'); wire(ring, 'out', vca, 'in');
    wire(main, 'gate', hit, 'trig'); wire(hit, 'out', vca, 'cv');
    wire(vca, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['buchla timbre', () => build('buchla timbre', 'keys', 'Costa oeste desde el teclado: una senoidal modula en frecuencia a un triángulo, el wavefolder dobla según la función, low pass gate. Teclado.', (add, wire, main, out) => {
    const mod = add('osc', { wave: 0, coarse: 12, level: 0.8 });
    const car = add('osc', { wave: 1, pm: 0.9, level: 0.85 });
    const fold = add('shape', { drive: 2.2, mode: 2, stages: 2, level: 0.75 }, { p1: ['drive'], att: [0.9, 1] });
    const fn = add('func', { rise: 0.004, fall: 0.7, shape: 0.5 });
    const k = add('const', { value: 3 });
    const amt = add('vca', { gain: 1 });
    const lpg = add('lpg', { mode: 0, decay: 0.7, offset: 0, level: 1.6 });
    const rev = add('reverb', { size: 0.5, damp: 0.3, mix: 0.25 });
    wire(main, 'pitch', mod, 'pitch'); wire(main, 'pitch', car, 'pitch'); wire(mod, 'out', car, 'pm');
    wire(car, 'out', fold, 'in'); wire(main, 'gate', fn, 'trig');
    wire(k, 'out', amt, 'in'); wire(fn, 'out', amt, 'cv'); wire(amt, 'out', fold, 'p1');
    wire(fold, 'out', lpg, 'in'); wire(main, 'gate', lpg, 'strike');
    wire(lpg, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],

  ['fm chowning', () => build('fm chowning', 'keys', 'FM de Chowning (1967): una senoidal modula a otra a una razón inarmónica; el índice baja con la envolvente, de metal a campana. Teclado.', (add, wire, main, out) => {
    const mod = add('osc', { wave: 0, coarse: 21, fine: 50, level: 0.9 });
    const car = add('osc', { wave: 0, pm: 0, level: 0.85 }, { p1: ['pm'], att: [1, 1] });
    const index = add('adsr', { a: 0.002, d: 1.4, s: 0.15, r: 1.2 });
    const k = add('const', { value: 4.5 });
    const amt = add('vca', { gain: 1 });
    const amp = add('adsr', { a: 0.002, d: 2.5, s: 0, r: 1.5 });
    const vca = add('vca');
    const rev = add('reverb', { size: 0.6, damp: 0.35, mix: 0.3 });
    wire(main, 'pitch', mod, 'pitch'); wire(main, 'pitch', car, 'pitch'); wire(mod, 'out', car, 'pm');
    wire(main, 'gate', index, 'gate'); wire(k, 'out', amt, 'in'); wire(index, 'env', amt, 'cv'); wire(amt, 'out', car, 'p1');
    wire(main, 'gate', amp, 'gate'); wire(car, 'out', vca, 'in'); wire(amp, 'env', vca, 'cv');
    wire(vca, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['voces formante', () => build('voces formante', 'keys', 'Un coro de los primeros sintes: sierras desafinadas por un filtro de vocales que un LFO lento lleva de A a U, chorus y sala. Teclado.', (add, wire, main, out) => {
    const v = add('osc', { wave: 2, unison: 3, detune: 18, level: 0.8 });
    const sub = add('osc', { wave: 1, coarse: -12, level: 0.4 });
    const mix = add('mixer', { l1: 0.8, l2: 0.45 });
    const talk = add('lfo', { wave: 1, rate: 0.18, depth: 1 });
    const half = add('scale', { gain: 2, offset: 2 });
    const vow = add('vowel', { vowel: 0, res: 0.65, level: 1 });
    const boost = add('vca', { gain: 2 });
    const one = add('const', { value: 1 });
    const env = add('adsr', { a: 0.15, d: 0.4, s: 0.85, r: 0.8 });
    const vca = add('vca', { gain: 2 });
    const ch = add('chorus', { rate: 0.35, depth: 0.5, mix: 0.45 });
    wire(main, 'pitch', v, 'pitch'); wire(main, 'pitch', sub, 'pitch');
    wire(v, 'out', mix, 'in1'); wire(sub, 'out', mix, 'in2'); wire(mix, 'out', vow, 'in');
    wire(talk, 'out', half, 'in'); wire(half, 'out', vow, 'vowel');
    wire(vow, 'out', boost, 'in'); wire(one, 'out', boost, 'cv'); wire(boost, 'out', vca, 'in');
    wire(main, 'gate', env, 'gate'); wire(env, 'env', vca, 'cv');
    wire(vca, 'out', ch, 'in'); wire(ch, 'l', out, 'l'); wire(ch, 'r', out, 'r');
  })],
  ['sync lead', () => build('sync lead', 'keys', 'Oscilador sincronizado: una sierra esclava de otra, su afinación barrida por la envolvente; el grito clásico. Teclado.', (add, wire, main, out) => {
    const master = add('osc', { wave: 3, level: 0 });
    const slave = add('osc', { wave: 2, coarse: 7, level: 0.8 });
    const sweep = add('adsr', { a: 0.003, d: 0.7, s: 0.25, r: 0.4 });
    const depth = add('scale', { gain: 1.8, offset: 0 });
    const vcf = add('muug', { cutoff: 1, emph: 3, drive: 1.5, cvamt: 1, track: 1 });
    const amp = add('adsr', { a: 0.004, d: 0.3, s: 0.85, r: 0.3 });
    const vca = add('vca');
    const dly = add('delay', { time: 290, fb: 0.35, mix: 0.22, tape: 0.4 });
    wire(main, 'pitch', master, 'pitch'); wire(main, 'pitch', slave, 'pitch'); wire(master, 'out', slave, 'sync');
    wire(main, 'gate', sweep, 'gate'); wire(sweep, 'env', depth, 'in'); wire(depth, 'out', slave, 'pitch');
    wire(slave, 'out', vcf, 'in'); wire(main, 'gate', amp, 'gate'); wire(vcf, 'out', vca, 'in'); wire(amp, 'env', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'out', out, 'r');
  })],

  // ---------------------------------------------------------------- patches that play themselves
  ['bonk west coast', () => build('bonk west coast', 'self', 'Suena solo: una Turing elige notas, un ritmo euclídeo golpea la low pass gate.', (add, wire, _main, out) => {
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
  })],
  ['computadora s&h', () => build('computadora s&h', 'self', 'La computadora de las películas de los 60: sample and hold sobre ruido elige una nota en cada pulso, LPG y ecos ping-pong. Suena solo; una tecla transpone.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 8, depth: 1 });
    const nz = add('noise', { level: 1 });
    const sh = add('sh', { mode: 0 });
    const q = add('quant', { scale: 4, root: 2 });
    const vco = add('osc', { wave: 3, pw: 0.3, coarse: 12, level: 0.8 });
    const lpg = add('lpg', { mode: 0, decay: 0.16 });
    const dly = add('delay', { time: 187, fb: 0.5, mix: 0.35, pingpong: 1 });
    wire(nz, 'out', sh, 'in'); wire(clock, 'out', sh, 'clock'); wire(sh, 'out', q, 'in');
    wire(q, 'out', vco, 'pitch'); wire(main, 'pitch', vco, 'pitch');
    wire(vco, 'out', lpg, 'in'); wire(clock, 'out', lpg, 'strike');
    wire(lpg, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'r', out, 'r');
  })],
  ['berlin seq', () => build('berlin seq', 'self', 'Secuencia de 8 pasos en La menor, dos osciladores al Muug, el filtro respira lento, eco de cinta. Suena solo; una tecla transpone.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 7.2, depth: 1 });
    const seq = add('seq', { s1: 0, s2: 0, s3: 0.25, s4: 0, s5: 0.5833, s6: 0.4167, s7: 0.8333, s8: 0.5833, len: 8 });
    const q = add('quant', { scale: 2, root: 9 });
    const v1 = add('osc', { wave: 2, coarse: -15, level: 0.75 });
    const v2 = add('osc', { wave: 3, coarse: -27, fine: 6, pw: 0.4, level: 0.5 });
    const mix = add('mixer', { l1: 0.75, l2: 0.6 });
    const sweep = add('lfo', { wave: 1, rate: 0.045, depth: 1 });
    const vcf = add('muug', { cutoff: -1.6, emph: 7, drive: 1.8, cvamt: 2.6 }, { p1: ['cutoff'], att: [0.35, 1] });
    const env = add('func', { rise: 0.002, fall: 0.18, shape: 0.6 });
    const vca = add('vca', { gain: 1.4 });
    const amp = add('func', { rise: 0.002, fall: 0.25, shape: 0.3 });
    const dly = add('delay', { time: 250, fb: 0.5, mix: 0.3, tape: 0.4 });
    wire(clock, 'out', seq, 'clock'); wire(seq, 'out', q, 'in'); wire(q, 'out', v1, 'pitch'); wire(q, 'out', v2, 'pitch');
    wire(main, 'pitch', v1, 'pitch'); wire(main, 'pitch', v2, 'pitch');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(clock, 'out', env, 'trig'); wire(env, 'out', vcf, 'cv'); wire(sweep, 'out', vcf, 'p1');
    wire(clock, 'out', amp, 'trig'); wire(vcf, 'out', vca, 'in'); wire(amp, 'out', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'out', out, 'r');
  })],
  ['percusion mod', () => build('percusion mod', 'self', 'Batería hecha con módulos: bombo de senoidal con caída de pitch, caja de ruido pasabanda, hats de ruido pasaaltos, tres ritmos euclídeos. Suena solo.', (add, wire, _main, out) => {
    const clock = add('lfo', { wave: 3, rate: 8, depth: 1 });
    const ek = add('euclid', { steps: 16, pulses: 4, rotate: 0 });
    const es = add('euclid', { steps: 16, pulses: 2, rotate: 4 });
    const eh = add('euclid', { steps: 16, pulses: 11, rotate: 1 });
    const kpitch = add('func', { rise: 0.001, fall: 0.09, shape: 0.8 });
    const kdepth = add('scale', { gain: 2.5, offset: 0 });
    const kick = add('osc', { wave: 0, coarse: -30, level: 1 });
    const kamp = add('lpg', { mode: 2, decay: 0.38, level: 1.4 });
    const nz = add('noise', { level: 1, color: 0 });
    const sf = add('filter', { cutoff: 1900, res: 0.35 });
    const samp = add('lpg', { mode: 2, decay: 0.14, level: 0.9 });
    const hf = add('filter', { cutoff: 7500, res: 0.1 });
    const hamp = add('lpg', { mode: 2, decay: 0.045, level: 0.6 });
    const mix = add('mixer', { l1: 0.9, l2: 0.55, l3: 0.35 });
    const rev = add('reverb', { size: 0.25, damp: 0.5, mix: 0.12, spring: 1 });
    wire(clock, 'out', ek, 'clock'); wire(clock, 'out', es, 'clock'); wire(clock, 'out', eh, 'clock');
    wire(ek, 'trig', kpitch, 'trig'); wire(kpitch, 'out', kdepth, 'in'); wire(kdepth, 'out', kick, 'pitch');
    wire(kick, 'out', kamp, 'in'); wire(ek, 'trig', kamp, 'strike');
    wire(nz, 'out', sf, 'in'); wire(sf, 'bp', samp, 'in'); wire(es, 'trig', samp, 'strike');
    wire(nz, 'out', hf, 'in'); wire(hf, 'hp', hamp, 'in'); wire(eh, 'trig', hamp, 'strike');
    wire(kamp, 'out', mix, 'in1'); wire(samp, 'out', mix, 'in2'); wire(hamp, 'out', mix, 'in3');
    wire(mix, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['turing maquina', () => build('turing maquina', 'self', 'Una Turing escribe una melodía en La menor y la reescribe de a poco; su CV mueve el Muug. Suena solo; una tecla transpone.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 6, depth: 1 });
    const tm = add('turing', { length: 8, change: 0.12, range: 1, scale: 2, root: 9, level: 0 });
    const vco = add('osc', { wave: 2, coarse: -12, level: 0.8 });
    const sub = add('osc', { wave: 3, coarse: -24, level: 0.45 });
    const mix = add('mixer', { l1: 0.8, l2: 0.5 });
    const vcf = add('muug', { cutoff: -1.2, emph: 6.4, drive: 1.5, cvamt: 2.8, track: 0 }, { p1: ['cutoff'], att: [0.5, 1] });
    const env = add('adsr', { a: 0.003, d: 0.25, s: 0.45, r: 0.2 });
    const vca = add('vca', { gain: 2 });
    const dly = add('delay', { time: 333, fb: 0.5, mix: 0.3, tape: 0.5 });
    const rev = add('reverb', { size: 0.55, mix: 0.2 });
    wire(clock, 'out', tm, 'clock'); wire(tm, 'pitch', vco, 'pitch'); wire(tm, 'pitch', sub, 'pitch');
    wire(main, 'pitch', vco, 'pitch'); wire(main, 'pitch', sub, 'pitch');
    wire(vco, 'out', mix, 'in1'); wire(sub, 'out', mix, 'in2'); wire(mix, 'out', vcf, 'in');
    wire(tm, 'gate', env, 'gate'); wire(env, 'env', vcf, 'cv'); wire(tm, 'cv', vcf, 'p1');
    wire(vcf, 'out', vca, 'in'); wire(env, 'env', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['euclides', () => build('euclides', 'self', 'Tres cuerdas pulsadas, cada una con su ritmo euclídeo. Suena solo; una tecla transpone las tres.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 9, depth: 1 });
    const e1 = add('euclid', { steps: 16, pulses: 5, rotate: 0 });
    const e2 = add('euclid', { steps: 16, pulses: 3, rotate: 2 });
    const e3 = add('euclid', { steps: 12, pulses: 7, rotate: 1 });
    const s1 = add('string', { decay: 2.2, damp: 0.35, coarse: -12, level: 0.8 });
    const s2 = add('string', { decay: 1.6, damp: 0.25, coarse: -5, level: 0.7 });
    const s3 = add('string', { decay: 1.1, damp: 0.15, coarse: 3, level: 0.55 });
    const mix = add('mixer', { l1: 1, l2: 1, l3: 0.9 });
    const rev = add('reverb', { size: 0.5, damp: 0.3, mix: 0.3 });
    const ch = add('chorus', { rate: 0.3, depth: 0.4, mix: 0.35 });
    wire(clock, 'out', e1, 'clock'); wire(clock, 'out', e2, 'clock'); wire(clock, 'out', e3, 'clock');
    wire(e1, 'trig', s1, 'gate'); wire(e2, 'trig', s2, 'gate'); wire(e3, 'trig', s3, 'gate');
    wire(main, 'pitch', s1, 'pitch'); wire(main, 'pitch', s2, 'pitch'); wire(main, 'pitch', s3, 'pitch');
    wire(s1, 'out', mix, 'in1'); wire(s2, 'out', mix, 'in2'); wire(s3, 'out', mix, 'in3');
    wire(mix, 'out', rev, 'in'); wire(rev, 'out', ch, 'in'); wire(ch, 'l', out, 'l'); wire(ch, 'r', out, 'r');
  })],
  ['marbles pluck', () => build('marbles pluck', 'self', 'Suena solo: Bernoulli ralea el reloj, Marbles elige notas que se repiten a medias, una Función pulsa el VCA.', (add, wire, _main, out) => {
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
  })],
  ['caos melodico', () => build('caos melodico', 'self', 'El atractor de Lorenz compone: X retenido en cada pulso y cuantizado a Re pentatónica, Y abre el oscilador CZ, ecos ping-pong. Suena solo.', (add, wire, main, out) => {
    const chaos = add('chaos', { speed: 0.5, rho: 28 });
    const clock = add('lfo', { wave: 3, rate: 5, depth: 1 });
    const sh = add('sh', { mode: 0 });
    const q = add('quant', { scale: 3, root: 2 });
    const cz = add('pd', { wave: 5, dcw: 0.35, range: 3, level: 0.8 });
    const env = add('func', { rise: 0.004, fall: 0.32, shape: 0.6 });
    const vca = add('vca');
    const rev = add('reverb', { size: 0.6, mix: 0.25 });
    const dly = add('delay', { time: 300, fb: 0.45, mix: 0.35, pingpong: 1 });
    wire(chaos, 'x', sh, 'in'); wire(clock, 'out', sh, 'clock'); wire(sh, 'out', q, 'in');
    wire(q, 'out', cz, 'pitch'); wire(main, 'pitch', cz, 'pitch'); wire(chaos, 'y', cz, 'dcw');
    wire(cz, 'out', vca, 'in'); wire(clock, 'out', env, 'trig'); wire(env, 'out', vca, 'cv');
    wire(vca, 'out', rev, 'in'); wire(rev, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'r', out, 'r');
  })],
  ['gotas resonador', () => build('gotas resonador', 'self', 'Gotas sobre una barra: Marbles dispara notas sueltas en Mi menor pentatónica a un resonador, sobre una lluvia suave. Suena solo.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 7, depth: 1 });
    const mar = add('marbles', { spread: 0.6, dejavu: 0.4, length: 8, density: 0.35, range: 1, scale: 4, root: 4 });
    const nz = add('noise', { level: 0.6, color: 0.7 });
    const hit = add('lpg', { mode: 2, decay: 0.02, level: 0.8 });
    const res = add('modal', { coarse: 0, decay: 2.4, struct: 0.35, bright: 0.6, damp: 0.3 });
    const rain = add('filter', { cutoff: 900, res: 0.1 });
    const mix = add('mixer', { l1: 0.9, l2: 0.12 });
    const rev = add('reverb', { size: 0.8, damp: 0.3, mix: 0.45 });
    wire(clock, 'out', mar, 'clock'); wire(nz, 'out', hit, 'in'); wire(mar, 'gate', hit, 'strike'); wire(hit, 'out', res, 'in');
    wire(mar, 'pitch', res, 'pitch'); wire(main, 'pitch', res, 'pitch');
    wire(nz, 'out', rain, 'in'); wire(res, 'out', mix, 'in1'); wire(rain, 'lp24', mix, 'in2');
    wire(mix, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['cuerdas azar', () => build('cuerdas azar', 'self', 'Dos cuerdas pulsadas al azar: Bernoulli reparte el reloj, un valor al azar elige notas en Mi dórico, chorus. Suena solo.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 4.5, depth: 1 });
    const bern = add('bern', { prob: 0.55 });
    const rnd = add('random', { mode: 0 });
    const q = add('quant', { scale: 5, root: 4 });
    const s1 = add('string', { decay: 3.5, damp: 0.25, coarse: -12, level: 0.8 });
    const s2 = add('string', { decay: 2.5, damp: 0.4, coarse: 0, level: 0.6 });
    const mix = add('mixer', { l1: 1, l2: 0.9 });
    const rev = add('reverb', { size: 0.55, mix: 0.3 });
    const ch = add('chorus', { rate: 0.4, depth: 0.6, mix: 0.5 });
    wire(clock, 'out', bern, 'trig'); wire(clock, 'out', rnd, 'clock'); wire(rnd, 'held', q, 'in');
    wire(q, 'out', s1, 'pitch'); wire(q, 'out', s2, 'pitch'); wire(main, 'pitch', s1, 'pitch'); wire(main, 'pitch', s2, 'pitch');
    wire(bern, 'a', s1, 'gate'); wire(bern, 'b', s2, 'gate');
    wire(s1, 'out', mix, 'in1'); wire(s2, 'out', mix, 'in2'); wire(mix, 'out', rev, 'in');
    wire(rev, 'out', ch, 'in'); wire(ch, 'l', out, 'l'); wire(ch, 'r', out, 'r');
  })],

  ['arpegio marbles', () => build('arpegio marbles', 'self', 'Un arpegio que muta: Marbles repite a medias una frase de 4 notas en Do pentatónica, el oscilador CZ por el Muug, ecos ping-pong. Suena solo; una tecla transpone.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 9, depth: 1 });
    const mar = add('marbles', { spread: 0.8, dejavu: 0.85, length: 4, density: 1, range: 1, scale: 3, root: 0 });
    const cz = add('pd', { wave: 0, dcw: 0.6, range: 3, level: 0.8 });
    const vcf = add('muug', { cutoff: -0.4, emph: 5.5, cvamt: 2, track: 0 });
    const env = add('func', { rise: 0.002, fall: 0.12, shape: 0.7 });
    const vca = add('vca', { gain: 2 });
    const dly = add('delay', { time: 333, fb: 0.5, mix: 0.35, pingpong: 1 });
    wire(clock, 'out', mar, 'clock'); wire(mar, 'pitch', cz, 'pitch'); wire(main, 'pitch', cz, 'pitch');
    wire(cz, 'out', vcf, 'in'); wire(mar, 'gate', env, 'trig'); wire(env, 'out', vcf, 'cv');
    wire(vcf, 'out', vca, 'in'); wire(env, 'out', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'r', out, 'r');
  })],
  ['polirritmo', () => build('polirritmo', 'self', 'Tres relojes divididos (3, 4 y 5) golpean tres barras afinadas: nunca coinciden igual. Suena solo; una tecla transpone.', (add, wire, main, out) => {
    const clock = add('lfo', { wave: 3, rate: 10, depth: 1 });
    const d3 = add('clkdiv', { div: 3 });
    const d5 = add('clkdiv', { div: 5 });
    const nz = add('noise', { level: 0.7 });
    const mix = add('mixer', { l1: 0.9, l2: 0.8, l3: 0.7 });
    const rev = add('reverb', { size: 0.6, damp: 0.3, mix: 0.3 });
    const taps: [ModuleInst, string][] = [[d3, 'out'], [d3, 'd4'], [d5, 'out']];
    ([[-12, 1.4], [3, 0.9], [10, 0.6]] as const).forEach(([st, dec], i) => {
      const hit = add('lpg', { mode: 2, decay: 0.015, level: 0.7 });
      const bar = add('modal', { coarse: st, decay: dec, struct: 0.7, bright: 0.55, damp: 0.35 });
      wire(nz, 'out', hit, 'in'); wire(taps[i][0], taps[i][1], hit, 'strike'); wire(hit, 'out', bar, 'in');
      wire(main, 'pitch', bar, 'pitch'); wire(bar, 'out', mix, `in${i + 1}`);
    });
    wire(clock, 'out', d3, 'clock'); wire(clock, 'out', d5, 'clock');
    wire(mix, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['enjambre lfo', () => build('enjambre lfo', 'self', 'Ambient que cambia solo: un acorde de tres osciladores y LFO lentos que se modulan entre ellos (afinación, filtro, mezcla). Suena solo; el teclado cambia la raíz.', (add, wire, main, out) => {
    const v1 = add('osc', { wave: 1, coarse: -12, level: 0.6 });
    const v2 = add('osc', { wave: 0, coarse: -5, level: 0.5 });
    const v3 = add('osc', { wave: 2, coarse: 4, fine: 6, level: 0.3 });
    const mix = add('mixer', { l1: 0.7, l2: 0.6, l3: 0.4 }, { p1: ['l3'], p2: ['l2'], att: [0.4, 0.3] });
    const mother = add('lfo', { wave: 0, rate: 0.03, depth: 1 });
    const l1 = add('lfo', { wave: 1, rate: 0.11, depth: 0.012 }, { p1: ['rate'], att: [0.5, 1] });
    const l2 = add('lfo', { wave: 0, rate: 0.07, depth: 1 }, { p1: ['depth'], att: [0.5, 1] });
    const l3 = add('lfo', { wave: 0, rate: 0.19, depth: 1 });
    const vcf = add('filter', { cutoff: 900, res: 0.45, cvamt: 1.6 });
    const rev = add('reverb', { size: 0.9, damp: 0.4, mix: 0.5 });
    wire(main, 'pitch', v1, 'pitch'); wire(main, 'pitch', v2, 'pitch'); wire(main, 'pitch', v3, 'pitch');
    wire(mother, 'out', l1, 'p1'); wire(mother, 'out', l2, 'p1'); wire(l1, 'out', v3, 'pitch'); wire(l1, 'out', v2, 'pitch');
    wire(l2, 'out', vcf, 'cv'); wire(l3, 'out', mix, 'p1'); wire(mother, 'out', mix, 'p2');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(v3, 'out', mix, 'in3');
    wire(mix, 'out', vcf, 'in'); wire(vcf, 'lp12', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],

  // ---------------------------------------------------------------- drones and noise machines, knobs to turn live
  ['lorenz drone', () => build('lorenz drone', 'keys', 'Mantené una tecla: dos osciladores por un ladder que mueve el atractor de Lorenz, respirando con una función en ciclo.', (add, wire, main, out) => {
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
  })],
  ['drone muug', () => build('drone muug', 'self', 'Dos Muug cantando solos (énfasis pasado 8), a una quinta y a la deriva; el teclado los mueve. Girá CORTE y ENFASIS.', (add, wire, main, out) => {
    const a = add('muug', { cutoff: -2.1, emph: 9.2, cvamt: 1 }, { p1: ['cutoff'], att: [0.06, 1] });
    const b = add('muug', { cutoff: -1.52, emph: 8.8, cvamt: 1 }, { p1: ['cutoff'], att: [0.15, 1] });
    const chaos = add('chaos', { speed: 0.12, rho: 26 });
    const slow = add('lfo', { wave: 0, rate: 0.03, depth: 1 });
    const mix = add('mixer', { l1: 0.7, l2: 0.6 });
    const rev = add('reverb', { size: 0.85, damp: 0.4, mix: 0.5 });
    wire(main, 'pitch', a, 'cv'); wire(main, 'pitch', b, 'cv');
    wire(chaos, 'y', a, 'p1'); wire(slow, 'out', b, 'p1');
    wire(a, 'out', mix, 'in1'); wire(b, 'out', mix, 'in2');
    wire(mix, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['niebla granular', () => build('niebla granular', 'self', 'Drone de órgano y sierra desafinada, partido en granos que suben una octava, sala larga. Suena solo; el teclado cambia la nota.', (add, wire, main, out) => {
    const wt = add('wavetable', { bank: 1, pos: 0.4, coarse: -12, level: 0.7 });
    const saw = add('osc', { wave: 2, unison: 3, detune: 25, coarse: -12, level: 0.5 });
    const mix = add('mixer', { l1: 0.7, l2: 0.5 });
    const scan = add('lfo', { wave: 1, rate: 0.05, depth: 1 });
    const gr = add('grain', { position: 0.5, size: 0.22, density: 28, pitch: 12, spray: 0.6, mix: 0.7 }, { p1: ['position'], att: [0.4, 1] });
    const rev = add('reverb', { size: 0.9, damp: 0.4, mix: 0.5 });
    wire(main, 'pitch', wt, 'pitch'); wire(main, 'pitch', saw, 'pitch');
    wire(wt, 'out', mix, 'in1'); wire(saw, 'out', mix, 'in2'); wire(mix, 'out', gr, 'in');
    wire(scan, 'out', gr, 'p1'); wire(gr, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['shift espacial', () => build('shift espacial', 'self', 'Radio desde la órbita: senoidal y triángulo por un desplazador de frecuencia que un LFO hace oscilar, eco largo. Suena solo.', (add, wire, main, out) => {
    const v1 = add('osc', { wave: 0, coarse: -12, level: 0.8 });
    const v2 = add('osc', { wave: 1, coarse: -5, level: 0.5 });
    const mix = add('mixer', { l1: 0.8, l2: 0.5 });
    const swing = add('lfo', { wave: 1, rate: 0.12, depth: 1 });
    const sh = add('shift', { shift: 12, cvamt: 180, mix: 1 });
    const dly = add('delay', { time: 420, fb: 0.7, mix: 0.5, tape: 0.3 });
    const rev = add('reverb', { size: 0.7, mix: 0.3 });
    wire(main, 'pitch', v1, 'pitch'); wire(main, 'pitch', v2, 'pitch');
    wire(v1, 'out', mix, 'in1'); wire(v2, 'out', mix, 'in2'); wire(mix, 'out', sh, 'in'); wire(swing, 'out', sh, 'cv');
    wire(sh, 'up', dly, 'in'); wire(dly, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(sh, 'down', out, 'r'); wire(rev, 'out', out, 'r');
  })],
  ['marea de ruido', () => build('marea de ruido', 'self', 'Viento y mar con ruido: dos filtros barridos por un LFO lento y Lorenz, uno por lado, sala enorme. Girá los cortes.', (add, wire, _main, out) => {
    const nz = add('noise', { level: 0.9, color: 0.35 });
    const tide = add('lfo', { wave: 0, rate: 0.07, depth: 1 });
    const chaos = add('chaos', { speed: 0.15, rho: 24 });
    const f1 = add('filter', { cutoff: 500, res: 0.4, cvamt: 2.5 });
    const f2 = add('filter', { cutoff: 1400, res: 0.55, cvamt: 1.5 });
    const rev = add('reverb', { size: 0.92, damp: 0.5, mix: 0.45 });
    wire(nz, 'out', f1, 'in'); wire(nz, 'out', f2, 'in'); wire(tide, 'out', f1, 'cv'); wire(chaos, 'z', f2, 'cv');
    wire(f1, 'lp24', rev, 'in'); wire(rev, 'out', out, 'l'); wire(f2, 'bp', out, 'r'); wire(rev, 'out', out, 'r');
  })],
  ['maquina ruido', () => build('maquina ruido', 'self', 'Máquina de ruido: ruido en un comb cuyo tono salta al azar, bitcrush, recorte, cortado por una cuadrada, eco de cinta gastada. Suena solo.', (add, wire, _main, out) => {
    const nz = add('noise', { level: 0.8 });
    const tick = add('lfo', { wave: 3, rate: 3.2, depth: 1 });
    const chop = add('lfo', { wave: 3, rate: 0.9, depth: 1 });
    const rnd = add('random', { mode: 0 });
    const comb = add('comb', { coarse: -12, fb: 0.92, damp: 0.15, mix: 1 });
    const crush = add('crush', { bits: 5, rate: 10 });
    const clip = add('shape', { drive: 3, mode: 1, level: 0.6 });
    const vca = add('vca');
    const dly = add('delay', { time: 140, fb: 0.6, mix: 0.3, tape: 0.85 });
    wire(tick, 'out', rnd, 'clock'); wire(rnd, 'held', comb, 'pitch');
    wire(nz, 'out', comb, 'in'); wire(comb, 'out', crush, 'in'); wire(crush, 'out', clip, 'in');
    wire(clip, 'out', vca, 'in'); wire(chop, 'out', vca, 'cv');
    wire(vca, 'out', dly, 'in'); wire(dly, 'out', out, 'l'); wire(dly, 'out', out, 'r');
  })],
  ['feedback comb', () => build('feedback comb', 'self', 'Un comb al borde de la autooscilación, excitado por ruido suave: un tono que silba y se quiebra. El teclado lo afina; girá REALIM y AMORT.', (add, wire, main, out) => {
    const nz = add('noise', { level: 0.25, color: 0.6 });
    const wob = add('lfo', { wave: 0, rate: 0.2, depth: 0.01 });
    const comb = add('comb', { coarse: -12, fb: 0.975, damp: 0.25, mix: 1 });
    const comb2 = add('comb', { coarse: -5, fb: -0.95, damp: 0.4, mix: 1 });
    const mix = add('mixer', { l1: 0.7, l2: 0.5 });
    const rev = add('reverb', { size: 0.75, damp: 0.4, mix: 0.4 });
    wire(nz, 'out', comb, 'in'); wire(nz, 'out', comb2, 'in');
    wire(main, 'pitch', comb, 'pitch'); wire(main, 'pitch', comb2, 'pitch'); wire(wob, 'out', comb, 'pitch');
    wire(comb, 'out', mix, 'in1'); wire(comb2, 'out', mix, 'in2');
    wire(mix, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['bitcrush radio', () => build('bitcrush radio', 'self', 'Onda corta: estática, una portadora que busca sintonía al azar, modulada en amplitud, recortada en bits y pasada por un resorte. Suena solo.', (add, wire, _main, out) => {
    const tune = add('random', { mode: 1, rate: 0.6 });
    const car = add('osc', { wave: 0, coarse: 12, level: 0.8 });
    const am = add('osc', { wave: 3, coarse: -24, level: 0.9 });
    const ring = add('ring', { mode: 1, level: 1 });
    const nz = add('noise', { level: 0.35, color: 0.1 });
    const mix = add('mixer', { l1: 0.7, l2: 0.6 });
    const bp = add('filter', { cutoff: 1500, res: 0.6, cvamt: 2 });
    const crush = add('crush', { bits: 6, rate: 4 });
    const rev = add('reverb', { size: 0.4, mix: 0.3, spring: 1 });
    wire(tune, 'out', car, 'pitch'); wire(tune, 'out', am, 'pitch'); wire(car, 'out', ring, 'a'); wire(am, 'out', ring, 'b');
    wire(ring, 'out', mix, 'in1'); wire(nz, 'out', mix, 'in2'); wire(mix, 'out', bp, 'in'); wire(tune, 'out', bp, 'cv');
    wire(bp, 'bp', crush, 'in'); wire(crush, 'out', rev, 'in'); wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
  ['cuerda infinita', () => build('cuerda infinita', 'keys', 'Tocá una nota y congelala: FX (o el pedal de sustain) congela la reverb; la cuerda sigue sonando encima. Teclado.', (add, wire, main, out) => {
    const s = add('string', { decay: 3, damp: 0.3, level: 0.8 });
    const s2 = add('string', { decay: 2.5, damp: 0.45, coarse: 12, level: 0.35 });
    const mix = add('mixer', { l1: 0.8, l2: 0.5 });
    const rev = add('reverb', { size: 0.85, damp: 0.25, mix: 0.55, mod: 0.5 }, { p1: ['freeze'], att: [1, 1] });
    wire(main, 'pitch', s, 'pitch'); wire(main, 'pitch', s2, 'pitch'); wire(main, 'gate', s, 'gate'); wire(main, 'gate', s2, 'gate');
    wire(s, 'out', mix, 'in1'); wire(s2, 'out', mix, 'in2'); wire(mix, 'out', rev, 'in');
    wire(main, 'fx', rev, 'p1'); wire(main, 'sustain', rev, 'p1');
    wire(rev, 'out', out, 'l'); wire(rev, 'out', out, 'r');
  })],
];

// ---------------------------------------------------------------- render, level, check, write
const PHRASE = [48, 55, 60, 63, 67, 60, 58, 55];
function render(b: Built, level: number, secs = 8): { rms: number; peak: number } {
  const p = structuredClone(b.patch);
  p.modules.find((m) => m.type === 'output')!.params.level = level;
  const e = new Engine(SR);
  e.load(p);
  const n = Math.round(secs * SR), blk = 128;
  let sum = 0, peak = 0, k = 0;
  const l = new Float32Array(blk), r = new Float32Array(blk);
  for (let pos = 0, step = 0; pos < n; pos += blk) {
    const t = pos / SR;
    if (b.play === 'keys') {   // a phrase: half a second a note, held 0.4 s (the drones: two long notes)
      const len = b.patch.name.includes('drone') ? 3.5 : 0.5, hold = b.patch.name.includes('drone') ? 3.2 : 0.4;
      const idx = Math.floor(t / len), within = t - idx * len;
      if (idx !== step && within < blk / SR) { e.noteOn(PHRASE[idx % PHRASE.length], 0.9); step = idx; }
      if (within >= hold && within < hold + blk / SR) e.noteOff(PHRASE[idx % PHRASE.length]);
      if (pos === 0) e.noteOn(PHRASE[0], 0.9);
    }
    e.render(l, r);
    if (t > 0.5) for (let i = 0; i < blk; i++) { sum += l[i] * l[i] + r[i] * r[i]; k += 2; peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i])); }
  }
  return { rms: Math.sqrt(sum / Math.max(1, k)), peak };
}

const TARGET_RMS = 0.11, PEAK_MAX = 0.8;
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const report: string[] = [];
BANK.forEach(([slug, make], i) => {
  const b = make();
  const probe = render(b, 0.5);
  if (!(probe.rms > 1e-4)) throw new Error(`${slug}: silent (rms ${probe.rms})`);
  const level = Math.min(1, 0.5 * Math.min(TARGET_RMS / probe.rms, PEAK_MAX / probe.peak));
  b.patch.modules.find((m) => m.type === 'output')!.params.level = Math.round(level * 100) / 100;
  const got = render(b, b.patch.modules.find((m) => m.type === 'output')!.params.level);
  const budget = deviceBudget(b.patch);
  if (!budget.fits) throw new Error(`${slug}: over the FM-1: ${JSON.stringify(budget.over)}`);
  const bin = encodePatch(b.patch);
  const cpu = { used: Math.round(cpuEstimate(b.patch).use * 100) };
  report.push(`${String(i).padStart(2, '0')} ${slug.padEnd(18)} ${b.play.padEnd(4)} level ${b.patch.modules.find((m) => m.type === 'output')!.params.level.toFixed(2)} rms ${got.rms.toFixed(3)} peak ${got.peak.toFixed(2)} cpu ${cpu?.used ?? '?'}% ${bin.length} B ${b.patch.modules.length} mod`);
  writeFileSync(new URL(`${String(i).padStart(2, '0')}-${slug.replace(/[^a-z0-9]+/g, '-')}.json`, OUT_DIR), JSON.stringify(b.patch, null, 1) + '\n');
});
console.log(report.join('\n'));
console.log(`wrote ${readdirSync(OUT_DIR).length} patches`);
