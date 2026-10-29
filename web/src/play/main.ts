// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK in the browser (play.html, The Firmware Hub's ▶ key): the firmware's own panel core and screens as
// WebAssembly (fm1-ui.ts, firmware/wasm/fm1_ui.c) on a drawn FM-1, and the editor's engine (audio.ts, the same engine
// as the firmware's, compared sample for sample by tools/golden.sh) making the sound. The factory bank is the rack
// editor's (rack/factory, the same 33 patches the FM-1 writes). What the screens change (a knob, a track's notes, PLAY,
// the pattern) goes to the engine as it does in the editor's FM-1 view.
import { AudioHost } from '../audio';
import { BUTTONS, ENCODERS, Fm1Ui } from '../fm1-ui';
import { DEFS } from '../modules';
import { validatePatch, type Patch } from '../patch';
import { encodePatch, POLY_ROW } from '../patchbin';
import { deviceView } from '../poly';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const files = import.meta.glob<unknown>('../rack/factory/*.json', { eager: true, import: 'default' });
const BANK: Patch[] = Object.keys(files).sort().map((f) => validatePatch(structuredClone(files[f]), DEFS));
const host = new AudioHost();
let ui: Fm1Ui | null = null;
let slot = 0;
let patch: Patch = BANK[0];
const t0 = performance.now();

// ---- the patch
const select = $<HTMLSelectElement>('patch');
BANK.forEach((p, i) => select.append(new Option(`${String(i + 1).padStart(2, '0')} ${p.name.toUpperCase()}`, String(i))));
function open(i: number): void {
  slot = (i + BANK.length) % BANK.length;
  patch = structuredClone(BANK[slot]);
  select.value = String(slot);
  host.send({ t: 'panic' });
  host.setPatch(structuredClone(patch));
  ui?.load(encodePatch(patch, true), patch.name.toUpperCase(), { slot, fresh: true });
}
select.onchange = () => open(Number(select.value));
/** module e of the binary the screens run (the compiled form, as the editor's FM-1 view maps it) */
const moduleAt = (e: number): Patch['modules'][number] | undefined => {
  const id = deviceView(patch, true).patch.modules[e]?.id;
  return patch.modules.find((m) => m.id === id);
};

// ---- the panel
function knob(parent: HTMLElement, label: string, n: number): void {
  const box = document.createElement('div');
  box.className = 'enc';
  const k = document.createElement('div');
  k.className = 'knob';
  let turns = 0, y0 = 0, acc = 0, dragged = false;
  const turn = (c: number): void => {
    if (!c) return;
    turns += c;
    k.style.setProperty('--a', `${turns * 18}deg`);
    ui?.encoder(n, c);
  };
  k.addEventListener('wheel', (e) => { e.preventDefault(); turn(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  k.addEventListener('pointerdown', (e) => {
    y0 = e.clientY; acc = 0; dragged = false;
    try { k.setPointerCapture(e.pointerId); } catch { /* gone */ }
  });
  k.addEventListener('pointermove', (e) => {
    if (!(e.buttons & 1)) return;
    acc += y0 - e.clientY;
    y0 = e.clientY;
    while (Math.abs(acc) >= 8) { turn(acc > 0 ? 1 : -1); acc -= Math.sign(acc) * 8; dragged = true; }
  });
  k.addEventListener('pointerup', (e) => {
    if (dragged) return;
    const r = k.getBoundingClientRect();
    turn(e.clientX < r.left + r.width / 2 ? -1 : 1);
  });
  const l = document.createElement('span');
  l.textContent = label;
  box.append(k, l);
  parent.append(box);
}
knob($('encs-l'), 'SELECT', ENCODERS.select);
knob($('encs-l'), 'PRESET', ENCODERS.preset);
knob($('encs-l'), 'ALGO', ENCODERS.algo);
['K1', 'K2', 'K3', 'K4'].forEach((l, i) => knob($('encs-r'), l, ENCODERS.k1 + i));

const btnEls = new Map<number, HTMLElement>();
const latched = new Set<number>();
function button(parent: HTMLElement, label: string, id: number): void {
  const b = document.createElement('div');
  b.className = 'btn';
  b.textContent = label;
  b.addEventListener('pointerdown', (e) => {
    if (e.shiftKey || latched.has(id)) {
      if (latched.has(id)) { latched.delete(id); ui?.button(id, false); b.classList.remove('latched', 'down'); }
      else { latched.add(id); ui?.button(id, true); b.classList.add('latched', 'down'); }
      return;
    }
    ui?.button(id, true);
    b.classList.add('down');
    try { b.setPointerCapture(e.pointerId); } catch { /* gone */ }
  });
  const up = (): void => { if (latched.has(id) || !b.classList.contains('down')) return; ui?.button(id, false); b.classList.remove('down'); };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  btnEls.set(id, b);
  parent.append(b);
}
([['FX', BUTTONS.fx], ['SEL', BUTTONS.scl], ['ENV', BUTTONS.env], ['LFO', BUTTONS.lfo], ['EDIT', BUTTONS.edit], ['GLO', BUTTONS.glo],
  ['HOME', BUTTONS.home], ['SAVE', BUTTONS.save], ['ARP', BUTTONS.arp], ['SEQ', BUTTONS.seq], ['PLAY', BUTTONS.play], ['REC', BUTTONS.rec]] as const)
  .forEach(([l, id]) => button($('btns'), l, id));
button($('octs'), 'OCT-', BUTTONS.octDown);
button($('octs'), 'OCT+', BUTTONS.octUp);

// ---- the keys: 27 from F3 (key n = F3 + n), whites in a row, blacks over the gaps
const keysEl = $('keys');
const keyEls = new Map<number, HTMLElement>();
const WHITES = [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 24, 26];
const BLACKS: [number, number][] = [[1, 0], [3, 1], [5, 2], [8, 4], [10, 5], [13, 7], [15, 8], [17, 9], [20, 11], [22, 12], [25, 14]];
let held = 0;
const sounding = new Map<number, number>();
function key(k: number, down: boolean): void {
  if (down === !!(held >> k & 1)) return;
  held = down ? held | (1 << k) : held & ~(1 << k);
  ui?.keys(held);
  keyEls.get(k)?.classList.toggle('on', down);
  if (down) {
    const note = 53 + k + 12 * (ui?.octave ?? 0);
    if (note < 0 || note > 127) return;
    sounding.set(k, note);
    void begin().then(() => host.send({ t: 'on', note, vel: 0.8 }));
  } else {
    const note = sounding.get(k);
    sounding.delete(k);
    if (note !== undefined) host.send({ t: 'off', note });
  }
}
WHITES.forEach((k, i) => {
  const el = document.createElement('div');
  el.className = 'key w';
  el.style.left = `${(i / WHITES.length) * 100}%`;
  el.style.width = `${100 / WHITES.length}%`;
  keyEls.set(k, el);
  keysEl.append(el);
});
BLACKS.forEach(([k, after]) => {
  const el = document.createElement('div');
  el.className = 'key b';
  el.style.left = `${((after + 1) / WHITES.length - 0.3 / WHITES.length) * 100}%`;
  el.style.width = `${(0.6 / WHITES.length) * 100}%`;
  keyEls.set(k, el);
  keysEl.append(el);
});
for (const [k, el] of keyEls) {
  el.addEventListener('pointerdown', (e) => { key(k, true); try { el.setPointerCapture(e.pointerId); } catch { /* gone */ } });
  el.addEventListener('pointerup', () => key(k, false));
  el.addEventListener('pointercancel', () => key(k, false));
}
// the computer keyboard: A = F3's octave C .. K, Z / X the octave buttons
const KB = 'awsedftgyhujk';
addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.target instanceof HTMLSelectElement) return;
  const i = KB.indexOf(e.key.toLowerCase());
  if (i >= 0) key(i + 7, true);   // (A: C4, key 7 from F3)
  else if (e.key === 'z' || e.key === 'x') ui?.button(e.key === 'z' ? BUTTONS.octDown : BUTTONS.octUp, true);
});
addEventListener('keyup', (e) => {
  const i = KB.indexOf(e.key.toLowerCase());
  if (i >= 0) key(i + 7, false);
  else if (e.key === 'z' || e.key === 'x') ui?.button(e.key === 'z' ? BUTTONS.octDown : BUTTONS.octUp, false);
});

// ---- MIDI in: notes to the engine and the screens' keys
$<HTMLButtonElement>('midi').onclick = async () => {
  try {
    const a = await navigator.requestMIDIAccess();
    const hook = (): void => {
      for (const i of a.inputs.values())
        i.onmidimessage = (ev) => {
          if (!ev.data) return;
          const [s, d1, d2] = ev.data;
          const k = d1 - 53 - 12 * (ui?.octave ?? 0);
          if ((s & 0xf0) === 0x90 && d2 > 0) {
            void begin().then(() => host.send({ t: 'on', note: d1, vel: d2 / 127 }));
            if (k >= 0 && k < 27) { held |= 1 << k; ui?.keys(held); }
          } else if ((s & 0xf0) === 0x80 || ((s & 0xf0) === 0x90 && d2 === 0)) {
            host.send({ t: 'off', note: d1 });
            if (k >= 0 && k < 27) { held &= ~(1 << k); ui?.keys(held); }
          } else if ((s & 0xf0) === 0xb0) host.send({ t: 'cc', n: d1, v: d2 });
        };
    };
    hook();
    a.onstatechange = hook;
    $('midi').textContent = 'MIDI ON';
  } catch {
    $('midi').textContent = 'NO MIDI';
  }
};

// ---- audio
let started: Promise<void> | null = null;
function begin(): Promise<void> {
  started ??= host.start().then(() => host.setPatch(structuredClone(patch)));
  return started;
}
$('go').onclick = () => { $('start').remove(); void begin(); };

// ---- the firmware's screens
const lcd = $<HTMLCanvasElement>('lcd').getContext('2d')!;
const img = new ImageData(240, 240);
async function boot(): Promise<void> {
  const bytes = await (await fetch(`${import.meta.env.BASE_URL}fm1-ui.wasm`)).arrayBuffer();
  ui = await Fm1Ui.create(bytes, {
    preset: (d) => { setTimeout(() => open(slot + d), 0); },   // (out of the wasm call first)
    param: (e, p, v) => {
      const m = moduleAt(e);
      const name = m && !(p & POLY_ROW) ? DEFS[m.type].params[p]?.name : undefined;
      if (!m || !name) return;
      m.params[name] = v / 65536;
      host.send({ t: 'param', id: m.id, name, value: v / 65536 });
    },
    transport: (run) => host.transport(run),
    track: (e, notes, pat) => {
      const m = moduleAt(e);
      if (!m) return;
      if (pat === 0) m.notes = notes.length ? notes : undefined;
      else {
        const pats = m.patterns ?? [];
        while (pats.length < pat) pats.push(null);
        pats[pat - 1] = { ...(pats[pat - 1] ?? {}), notes };
        m.patterns = pats;
      }
      host.send({ t: 'track', id: m.id, notes, pat });
    },
    pattern: (p, song) => { host.send({ t: 'pattern', p }); host.send({ t: 'song', n: song }); },
    mute: (e, on) => { const m = moduleAt(e); if (m) host.send({ t: 'mute', id: m.id, on }); },
  });
  open(0);
  const frame = (): void => {
    requestAnimationFrame(frame);
    if (!ui) return;
    ui.tick(performance.now() - t0);
    if (ui.takeDirty()) {
      ui.rgba(img.data);
      lcd.putImageData(img, 0, 0);
    }
    const l = ui.lights();
    for (const [id, el] of btnEls) {
      el.classList.toggle('lit', !!(l.buttons.lit >> id & 1));
      el.classList.toggle('dim', !!(l.buttons.dim >> id & 1));
      el.classList.toggle('breath', !!(l.buttons.breath >> id & 1) && Math.floor(performance.now() / 500) % 2 === 0);
    }
    for (const [k, el] of keyEls) {
      el.classList.toggle('lit', !!(l.keys.lit >> k & 1));
      el.classList.toggle('mid', !!(l.keys.mid >> k & 1));
    }
  };
  frame();
}
void boot();
