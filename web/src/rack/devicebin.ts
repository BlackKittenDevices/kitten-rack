// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: a patch binary from the FM-1 (patchbin.ts encodePatch's output, perhaps edited there: knobs, the rack page's
// modules and cables, its SEQ page) read back into a patch the rack editor shows and edits. The device form loses what only
// the editor keeps (positions, assemblies, the device pages it rebuilds); a poly group of the rack's kind (one Part, notes from
// the keys, a Steps track or an Arpeggiator) comes back as the Voice allocator it was made from. Encoding the result gives
// the same bytes again (devicebin.test.ts checks every factory patch).
import { DEFS } from '../modules';
import { PANEL_BUTTONS } from '../modules';
import {
  GROUP_REC, PANEL_BYTES, TYPE_ORDER, BYPASS_BIT, FLAG_MORPH, FLAG_MORPH_MODULES, FLAG_RANGE, FLAG_MIDIMAP, FLAG_INPUTS, FLAG_INPUT_MAP, FLAG_NOTES,
  FLAG_DEVICES, FLAG_EXTRAS, FLAG_BUTTONS, FLAG_NAMES, FLAG_PATTERNS, Q, maskBytes, paramsAt,
} from '../patchbin';
import { MAX_PARTS, PANEL_LABEL_KEYS, PANEL_LABEL_MAX, SOURCES, type MainPanel, type ModuleInst, type Patch, type Cable } from '../patch';
import { wordNote, type Pattern, type SongEntry, type StepNote } from '../track';
import { KIND_CODE } from '../buttons';
import { packInOrder } from './layout';

const DRUM_ROWS = 8;
const TRACK_NAME_MAX = 8;
const ROW_MORE = 0x40;

export class DecodeError extends Error {}

/** a text section field: u8 length, that many bytes */
function skipText(b: Uint8Array, at: number): number {
  if (at >= b.length) throw new DecodeError('cut short');
  return at + 1 + b[at];
}

/** engine.h eng_devices_end */
function devicesEnd(b: Uint8Array, at: number, order: number[]): number {
  const n = b[at++];
  for (let d = 0; d < n; d++) {
    if (b[at] === 0) { order.push(b[at + 1]); at += 2; continue; }
    if (b[at++] !== 1) throw new DecodeError('device kind');
    at = skipText(b, at);
    const np = b[at++];
    for (let g = 0; g < np; g++) {
      at = skipText(b, at);
      const nr = b[at + 3];
      at += 4;
      for (let r = 0; r < nr; r++) {
        const more = (b[at + 1] & 0x80) === 0 && (b[at + 1] & ROW_MORE) !== 0;
        at = skipText(b, at + 2);
        if (more) {
          at += 1 + 2 * b[at];
          const names = b[at++];
          for (let k = 0; k < names; k++) at = skipText(b, at);
        }
      }
    }
  }
  return at;
}

/** engine.h eng_extras_end */
function extrasEnd(b: Uint8Array, at: number): number {
  const n = b[at++];
  for (let d = 0; d < n; d++) {
    at += 5;
    at = skipText(b, at);
    at += 1 + 2 * b[at];
    at += 1 + b[at];
  }
  return at;
}

const text = (b: Uint8Array, at: number, n: number): string => String.fromCharCode(...b.slice(at, at + n).filter((c) => c !== 0)).trim();

/** the rack editor's patch for a binary the FM-1 holds; throws DecodeError when the binary is not one it can read */
export function decodeDevicePatch(b: Uint8Array, name = 'FM-1'): Patch {
  if (b.length < 8 || b[0] !== 0xa1) throw new DecodeError('not a patch');
  const ver = b[1];
  const n = b[2];
  const ng = b[3];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ncab = dv.getUint16(4, true);
  const flags = dv.getUint16(6, true);
  if (ver < 46) throw new DecodeError(`format ${ver}: too old`);
  let at = 8;
  const groups: { parts: number; unisonParts: number; assign: number; legato: number; unison: boolean; share: boolean; priority: number; steal: boolean; src: number; channel: number; low: number; high: number; flawed: boolean }[] = [];
  for (let g = 0; g < ng; g++) {
    const flaws = b.slice(at + 4, at + 4 + 5 * MAX_PARTS);
    groups.push({
      parts: b[at] & 15, unisonParts: b[at] >> 4, assign: b[at + 1], legato: b[at + 2] & 0x3f, unison: !!(b[at + 2] & 0x80), share: !!(b[at + 2] & 0x40),
      priority: b[at + 3] & 0x7f, steal: !(b[at + 3] & 0x80), src: b[at + 4 + 5 * MAX_PARTS], channel: b[at + 5 + 5 * MAX_PARTS], low: b[at + 6 + 5 * MAX_PARTS], high: b[at + 7 + 5 * MAX_PARTS],
      flawed: flaws.some((x, i) => x !== [0, 0, 0, 0, 100][i % 5]),
    });
    at += GROUP_REC;
  }
  const member: number[] = [];
  if (ng) for (let i = 0; i < n; i++) member.push(b[at++]);
  const switched = dv.getUint16(at, true);
  const lit = dv.getUint16(at + 2, true);
  const labels: Record<string, string> = {};
  PANEL_LABEL_KEYS.forEach((k, i) => {
    const s = text(b, at + 4 + i * PANEL_LABEL_MAX, PANEL_LABEL_MAX);
    if (s) labels[k] = s;
  });
  at += PANEL_BYTES;
  const mods: ModuleInst[] = [];
  for (let i = 0; i < n; i++) {
    const tb = b[at++];
    const type = TYPE_ORDER[tb & 0x7f];
    if (!type || !DEFS[type]) throw new DecodeError(`module type ${tb & 0x7f}`);
    const def = DEFS[type];
    const m: ModuleInst = { id: i + 1, type, x: 0, y: 0, params: {} };
    if (tb & BYPASS_BIT) m.bypass = true;
    for (const pd of paramsAt(type, ver)) {
      m.params[pd.name] = dv.getInt32(at, true) / Q;
      at += 4;
    }
    for (const pd of def.params) if (!(pd.name in m.params)) m.params[pd.name] = pd.default;
    if (def.paramInputs) {
      m.att = [dv.getInt32(at, true) / Q, dv.getInt32(at + 4, true) / Q];
      at += 8;
      const map = {} as Record<(typeof SOURCES)[number], string[]>;
      for (const s of SOURCES) {
        const mask = maskBytes(type) === 4 ? dv.getUint32(at, true) : dv.getUint16(at, true);
        at += maskBytes(type);
        map[s] = def.params.filter((_, k) => (mask >>> k) & 1).map((q) => q.name);
      }
      m.map = map;
    }
    if (type === 'steps') {
      const s = text(b, at, def.data ?? 0);
      if (s) m.name = s;
    }
    at += def.data ?? 0;
    mods.push(m);
  }
  const cables: Cable[] = [];
  for (let c = 0; c < ncab; c++, at += 4) {
    const [f, fo, t, ti] = [b[at], b[at + 1], b[at + 2], b[at + 3]];
    const from = mods[f], to = mods[t];
    if (!from || !to) throw new DecodeError('cable');
    const op = DEFS[from.type].outputs[fo]?.name, ip = DEFS[to.type].inputs[ti]?.name;
    if (!op || !ip) throw new DecodeError('cable port');
    cables.push({ from: { module: from.id, port: op }, to: { module: to.id, port: ip } });
  }
  if (flags & FLAG_MORPH) {
    for (const m of mods) {
      const bside: Record<string, number> = {};
      for (const pd of paramsAt(m.type, ver)) {
        bside[pd.name] = dv.getInt32(at, true) / Q;
        at += 4;
      }
      m.paramsB = bside;
    }
    if (flags & FLAG_MORPH_MODULES) {
      mods.forEach((m, i) => { if (!((b[at + (i >> 3)] >> (i & 7)) & 1)) delete m.paramsB; });
      at += Math.ceil(n / 8);
    }
  }
  if (flags & FLAG_INPUTS) at += n;
  if (flags & FLAG_INPUT_MAP) {
    const nr = b[at++];
    for (let r = 0; r < nr; r++) {
      const m = mods[b[at]];
      const input = DEFS[m.type].inputs[b[at + 1]]?.name;
      at += 2;
      const mask = maskBytes(m.type) === 4 ? dv.getUint32(at, true) : dv.getUint16(at, true);
      at += maskBytes(m.type);
      if (input) (m.inputMap ??= {})[input] = DEFS[m.type].params.filter((_, k) => (mask >>> k) & 1).map((q) => q.name);
    }
  }
  if (flags & FLAG_NOTES) {
    const nt = b[at++];
    for (let k = 0; k < nt; k++) {
      const m = mods[b[at]];
      const cnt = b[at + 1];
      const notes: StepNote[] = [];
      for (let j = 0; j < cnt; j++) notes.push(wordNote(dv.getUint32(at + 2 + 4 * j, true)));
      if (notes.length) m.notes = notes;
      at += 2 + 4 * cnt;
    }
  }
  const main = mods.find((m) => m.type === 'fm1');
  if (flags & FLAG_PATTERNS) {
    const pattern = b[at], song = b[at + 1], nt = b[at + 2];
    at += 3;
    for (let k = 0; k < nt; k++) {
      const m = mods[b[at]];
      const np = b[at + 1];
      at += 2;
      const pats: (Pattern | null)[] = [];
      for (let j = 0; j < np; j++) {
        if (b[at] === 0xff) { pats.push(null); at++; continue; }
        const cnt = b[at], lenByte = b[at + 1], rate = b[at + 2];
        at += 3;
        const short = !!(lenByte & 0x80);
        const notes: StepNote[] = [];
        for (let q = 0; q < cnt; q++) {
          if (short) {
            const w = dv.getUint16(at, true);
            notes.push({ at: w & 15, len: ((w >> 4) & 15) + 1, note: (w >> 8) & 127, vel: w & 0x8000 ? 127 : 100 });
            at += 2;
          } else {
            notes.push(wordNote(dv.getUint32(at, true)));
            at += 4;
          }
        }
        const x: Pattern = {};
        if (notes.length) x.notes = notes;
        if (lenByte & 0x7f) x.len = lenByte & 0x7f;
        if (rate !== 0xff) x.rate = rate;
        pats.push(x);
      }
      if (m) m.patterns = pats;
    }
    const nsongs = b[at++];
    const songs: SongEntry[][] = [];
    for (let s = 0; s < nsongs; s++) {
      const len = b[at++];
      const e: SongEntry[] = [];
      for (let j = 0; j < len; j++, at += 2) e.push({ pat: b[at], shift: (b[at + 1] << 24) >> 24 });
      songs.push(e);
    }
    if (main && (pattern || song || songs.length)) main.seq = { ...(pattern ? { pattern } : {}), ...(song ? { song } : {}), ...(songs.length ? { songs } : {}) };
  }
  const order: number[] = [];   // the device pages' modules, in their order: the rack's reading order (layout.ts forDevice)
  if (flags & FLAG_DEVICES) at = devicesEnd(b, at, order);
  if (flags & FLAG_EXTRAS) at = extrasEnd(b, at);
  const panel: MainPanel = {};
  if (flags & FLAG_BUTTONS) {
    const codes = PANEL_BUTTONS.map((_, i) => b[at + i]);
    at += PANEL_BUTTONS.length;
    const byCode = Object.fromEntries(Object.entries(KIND_CODE).map(([k, v]) => [v, k])) as Record<number, string>;
    panel.kinds = {};
    PANEL_BUTTONS.forEach((btn, i) => {
      const kind = byCode[codes[i]] ?? 'gate';
      if (kind === 'page') {
        const cnt = b[at++];
        at += 2 * cnt;   // (a Page button's list names device pages the editor rebuilds: it keeps the kind)
        panel.kinds![btn] = 'page';
      } else if (kind === 'bypass') {
        const cnt = b[at++];
        const ids = [...b.slice(at, at + cnt)].map((x) => mods[x]?.id).filter((x): x is number => x !== undefined);
        at += cnt;
        panel.kinds![btn] = 'bypass';
        if (ids.length) (panel.targets ??= {})[btn] = { module: ids[0] };
      } else if (kind === 'nothing') panel.kinds![btn] = 'nothing';
    });
  }
  if (flags & FLAG_NAMES) {
    const nm = b[at++];
    for (let k = 0; k < nm; k++) {
      const m = mods[b[at++]];
      const names: string[] = [];
      for (let r = 0; r < DRUM_ROWS; r++, at += TRACK_NAME_MAX) names.push(text(b, at, TRACK_NAME_MAX));
      if (m && names.some((x) => x)) m.names = names;
    }
  }
  if (flags & FLAG_RANGE) {
    const nr = b[at++];
    for (let r = 0; r < nr; r++, at += 5) {
      const m = mods[b[at]];
      const pin = b[at + 1] ? 'p2' : 'p1';
      const pd = DEFS[m?.type ?? '']?.params[b[at + 2]];
      if (m && pd) ((m.range ??= {})[pin] ??= {})[pd.name] = [b[at + 3] / 255, b[at + 4] / 255];
    }
  }
  const midiMap: { cc: number; ch?: number; module: number; param: string }[] = [];
  if (flags & FLAG_MIDIMAP) {   // KITTEN RACK: the MIDI map (patchbin.ts midiMapList)
    const nm = b[at++];
    for (let k = 0; k < nm; k++, at += 4) {
      const m = mods[b[at + 2]];
      const pd = DEFS[m?.type ?? '']?.params[b[at + 3]];
      if (m && pd) midiMap.push({ cc: b[at] & 127, ...(b[at + 1] ? { ch: b[at + 1] } : {}), module: m.id, param: pd.name });
    }
  }
  if (at !== b.length) throw new DecodeError(`${b.length - at} bytes left over`);
  // the panel: which buttons switch and which are on
  const toggle = PANEL_BUTTONS.filter((_, i) => (switched >> i) & 1);
  const on = PANEL_BUTTONS.filter((_, i) => (lit >> i) & 1 && panel.kinds?.[PANEL_BUTTONS[i]] !== 'bypass');
  if (toggle.length) panel.toggle = toggle;
  if (on.length) panel.on = on;
  if (Object.keys(labels).length) panel.labels = labels;
  if (main && Object.keys(panel).length) main.panel = panel;
  // a poly group of one Part: the Voice allocator it was made from, its keys from where the group took its notes
  groups.forEach((g, gi) => {
    const inGroup = mods.filter((_, i) => member[i] === gi + 1);
    if (inGroup.length !== 1 || inGroup[0].type !== 'part' || g.flawed) throw new DecodeError('a poly group the rack cannot show');
    const part = inGroup[0];
    part.type = 'alloc';
    part.params = Object.fromEntries(DEFS.alloc.params.map((pd) => [pd.name, pd.default]));
    Object.assign(part.params, {
      voices: g.parts, assign: g.assign, legato: g.legato, priority: g.priority, unison: g.unison ? (g.share ? 2 : 1) : 0, steal: g.steal ? 1 : 0,
      stack: g.unisonParts, channel: g.channel, low: g.low, high: g.high,
    });
    const src = g.src ? mods[g.src - 1] : main;
    if (src) cables.push({ from: { module: src.id, port: 'keys' }, to: { module: part.id, port: 'keys' } });
  });
  for (const m of mods) {
    if (m.type !== 'part') continue;
    // a Part outside any group (an allocator of one voice played by the keys): the allocator, its keys from the Main module
    m.type = 'alloc';
    m.params = Object.fromEntries(DEFS.alloc.params.map((pd) => [pd.name, pd.default]));
    if (main) cables.push({ from: { module: main.id, port: 'keys' }, to: { module: m.id, port: 'keys' } });
  }
  const p: Patch = { version: 2, name, modules: mods, cables, ...(midiMap.length ? { midiMap } : {}) };
  packInOrder(p, DEFS, [...(main ? [main.id] : []), ...order.map((i) => mods[i]?.id).filter((x): x is number => x !== undefined && x !== main?.id)]);
  return p;
}
