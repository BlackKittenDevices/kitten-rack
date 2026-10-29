// SPDX-License-Identifier: GPL-3.0-only
// The rack's geometry: rows of HP, a panel's size and where its knobs and jacks sit.
import type { ModuleDef, ModuleInst, Patch } from '../patch';
import { HP_MIN, MAIN_OUTPUTS } from './catalog';

export const HP_PX = 20;
export const ROW_HP = 42;
export const ROW_H = 380;
export const ROW_GAP = 34;
export const RAIL_X = 40;
export const ROW_PITCH = ROW_H + ROW_GAP;
const HEAD = 40;
const KNOB_W = 54;
const KNOB_H = 62;
const JACK_W = 34;
const JACK_H = 44;
const PAD = 10;

export interface Spot {
  x: number;
  y: number;
}

export interface PanelGeo {
  hp: number;
  knobs: { name: string; at: Spot }[];
  inputs: { name: string; at: Spot }[];
  outputs: { name: string; at: Spot }[];
}

/** the knobs a panel shows (every parameter but the hidden ones) */
export function knobsOf(def: ModuleDef): string[] {
  if (def.type === 'fm1') return ['tempo', 'morph'];
  return def.params.map((p) => p.name);
}

export function inputsOf(def: ModuleDef): string[] {
  return def.inputs.map((p) => p.name);
}

export function outputsOf(def: ModuleDef, extra: string[] = []): string[] {
  if (def.type === 'fm1') return def.outputs.map((o) => o.name).filter((n) => MAIN_OUTPUTS.includes(n) || extra.includes(n));
  return def.outputs.map((p) => p.name);
}

/** a panel's width in HP and its knob and jack positions (pixels from the panel's top left) */
export function panelGeo(def: ModuleDef, extra: string[] = []): PanelGeo {
  const knobs = knobsOf(def);
  const ins = inputsOf(def);
  const outs = outputsOf(def, extra);
  let hp = Math.max(4, HP_MIN[def.type] ?? 4);
  for (let tries = 0; tries < 30; tries++) {
    const w = hp * HP_PX;
    const perJack = Math.max(1, Math.floor((w - 2 * PAD) / JACK_W));
    const jackRows = (ins.length ? Math.ceil(ins.length / perJack) : 0) + (outs.length ? Math.ceil(outs.length / perJack) : 0);
    const knobRows = Math.max(1, Math.floor((ROW_H - HEAD - PAD - jackRows * JACK_H) / KNOB_H));
    const perKnobRow = Math.max(1, Math.floor((w - 2 * PAD) / KNOB_W));
    const fits = knobs.length <= knobRows * perKnobRow && HEAD + Math.ceil(knobs.length / perKnobRow) * KNOB_H + jackRows * JACK_H + PAD <= ROW_H;
    if (fits || hp >= ROW_HP) break;
    hp += 2;
  }
  const w = hp * HP_PX;
  const perKnobRow = Math.max(1, Math.floor((w - 2 * PAD) / KNOB_W));
  const perJack = Math.max(1, Math.floor((w - 2 * PAD) / JACK_W));
  const center = (count: number, per: number, i: number, cell: number): number => {
    const inRow = Math.min(per, count - Math.floor(i / per) * per);
    const used = inRow * cell;
    return (w - used) / 2 + (i % per) * cell + cell / 2;
  };
  const geo: PanelGeo = { hp, knobs: [], inputs: [], outputs: [] };
  knobs.forEach((name, i) => geo.knobs.push({ name, at: { x: center(knobs.length, perKnobRow, i, KNOB_W), y: HEAD + Math.floor(i / perKnobRow) * KNOB_H + 24 } }));
  // jacks from the bottom up: outputs last row(s), inputs above
  const outRows = outs.length ? Math.ceil(outs.length / perJack) : 0;
  const inRows = ins.length ? Math.ceil(ins.length / perJack) : 0;
  const bottom = ROW_H - PAD - JACK_H / 2;
  outs.forEach((name, i) => geo.outputs.push({ name, at: { x: center(outs.length, perJack, i, JACK_W), y: bottom - (outRows - 1 - Math.floor(i / perJack)) * JACK_H } }));
  ins.forEach((name, i) => geo.inputs.push({ name, at: { x: center(ins.length, perJack, i, JACK_W), y: bottom - outRows * JACK_H - (inRows - 1 - Math.floor(i / perJack)) * JACK_H } }));
  return geo;
}

/** a placed module's geometry: the MIDI-CV panel also shows the FM-1 button outputs a cable already uses */
export function geoOf(p: Patch, defs: Record<string, ModuleDef>, m: ModuleInst): PanelGeo {
  if (m.type !== 'fm1') return panelGeo(defs[m.type]);
  const extra = [...new Set(p.cables.filter((c) => c.from.module === m.id && !MAIN_OUTPUTS.includes(c.from.port)).map((c) => c.from.port))];
  return panelGeo(defs[m.type], extra);
}

/** a module's rack place, read from its stored x / y */
export const placeOf = (m: ModuleInst): { row: number; hp: number } => ({ row: Math.max(0, Math.round(m.y / ROW_PITCH)), hp: Math.max(0, Math.round((m.x - RAIL_X) / HP_PX)) });

export function setPlace(m: ModuleInst, row: number, hp: number): void {
  m.x = RAIL_X + hp * HP_PX;
  m.y = row * ROW_PITCH;
}

/** whether a module of `hp` fits at row / start without overlapping another (and inside the row) */
export function fits(p: Patch, defs: Record<string, ModuleDef>, row: number, start: number, hp: number, skip = -1): boolean {
  if (start < 0 || start + hp > ROW_HP) return false;
  for (const m of p.modules) {
    if (m.id === skip || !defs[m.type]) continue;
    const at = placeOf(m);
    if (at.row !== row) continue;
    const w = geoOf(p, defs, m).hp;
    if (start < at.hp + w && at.hp < start + hp) return false;
  }
  return true;
}

/** the first free place for `hp`, row by row, left to right; a new row when every row is full */
export function freeSpot(p: Patch, defs: Record<string, ModuleDef>, hp: number, rows: number): { row: number; hp: number } {
  for (let row = 0; row < rows; row++) for (let x = 0; x + hp <= ROW_HP; x++) if (fits(p, defs, row, x, hp)) return { row, hp: x };
  return { row: rows, hp: 0 };
}

/** whether every module sits on the grid without overlaps (a patch saved by this editor); else it is packed again */
export function onGrid(p: Patch, defs: Record<string, ModuleDef>): boolean {
  for (const m of p.modules) {
    if (!defs[m.type]) continue;
    if (m.x !== RAIL_X + placeOf(m).hp * HP_PX || m.y !== placeOf(m).row * ROW_PITCH) return false;
    const at = placeOf(m);
    if (!fits(p, defs, at.row, at.hp, geoOf(p, defs, m).hp, m.id)) return false;
  }
  return true;
}

/** pack every module into rows: MIDI-CV first, then the rest in reading order of where they were, OUT last */
export function pack(p: Patch, defs: Record<string, ModuleDef>): number {
  const order = [...p.modules].filter((m) => defs[m.type]).sort((a, b) => rank(a) - rank(b) || a.y - b.y || a.x - b.x);
  let row = 0;
  let x = 0;
  for (const m of order) {
    const w = geoOf(p, defs, m).hp;
    if (x + w > ROW_HP) {
      row++;
      x = 0;
    }
    setPlace(m, row, x);
    x += w;
  }
  return row + 1;
}

const rank = (m: ModuleInst): number => (m.type === 'fm1' ? 0 : m.type === 'output' ? 2 : 1);

/** the rack's modules in reading order: row by row, left to right */
export const readingOrder = (p: Patch): ModuleInst[] =>
  [...p.modules].sort((a, b) => placeOf(a).row - placeOf(b).row || placeOf(a).hp - placeOf(b).hp || a.id - b.id);

/** the patch as the FM-1 gets it: its device pages in the rack's reading order (pages.ts devicesOf reads columns of x, so
 * every module stands in a column of its own, left to right in reading order). The rack keeps its own copy as it is. */
export function forDevice(p: Patch): Patch {
  const q = structuredClone(p);
  const order = new Map(readingOrder(p).map((m, i) => [m.id, i]));
  for (const m of q.modules) {
    m.x = RAIL_X + 1000 * (order.get(m.id) ?? 0);
    m.y = 0;
  }
  return q;
}

/** pack the modules into rows in the order given (ids; the rest after them, as they are listed) */
export function packInOrder(p: Patch, defs: Record<string, ModuleDef>, ids: number[]): number {
  const seen = new Set(ids);
  const order = [...ids.map((id) => p.modules.find((m) => m.id === id)).filter((m): m is ModuleInst => !!m && !!defs[m.type]),
    ...p.modules.filter((m) => !seen.has(m.id) && defs[m.type])];
  let row = 0;
  let x = 0;
  for (const m of order) {
    const w = geoOf(p, defs, m).hp;
    if (x + w > ROW_HP) {
      row++;
      x = 0;
    }
    setPlace(m, row, x);
    x += w;
  }
  return row + 1;
}
