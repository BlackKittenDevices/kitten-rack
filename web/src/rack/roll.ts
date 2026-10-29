// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: a Steps track's piano roll in the rack editor (the FM-1's SEQ page, larger): its steps across (up to 64),
// pitches down, a click places or removes a note, a drag to the right sets its length, Shift places an accent. Its steps,
// rate and swing on top. The pattern edited is the patch's selected one (Main's seq.pattern). Every change goes back
// through `changed` (the rack sends it to the browser's engine and, linked, to the FM-1 as TRACK / PARAM).
import { DEFS } from '../modules';
import type { ModuleInst, Patch } from '../patch';
import { ACCENT_VEL, STEP_VEL, STEPS_MAX, STEPS_RATES, fixNotes, type StepNote } from '../track';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (n: number): string => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const LOW = 24, HIGH = 108;   // C1 .. C8

export interface RollHost {
  /** the notes (and, with `param`, a parameter) of the track changed */
  changed(m: ModuleInst, pat: number, notes: StepNote[] | undefined, param?: { name: string; value: number }): void;
  /** a pitch heard while placing it */
  audition(note: number): void;
}

function notesOf(p: Patch, m: ModuleInst, pat: number): StepNote[] {
  if (pat === 0) return [...(m.notes ?? [])];
  return [...(m.patterns?.[pat - 1]?.notes ?? [])];
}

export function openRoll(p: Patch, m: ModuleInst, host: RollHost): void {
  document.querySelector('#roll-box')?.remove();
  const main = p.modules.find((x) => x.type === 'fm1');
  const pat = main?.seq?.pattern ?? 0;
  const box = document.createElement('dialog');
  box.id = 'roll-box';
  box.className = 'roll';
  const head = document.createElement('div');
  head.className = 'roll-head';
  const title = document.createElement('b');
  title.textContent = `${m.name || 'STEPS'} · PATRÓN ${String(pat + 1).padStart(2, '0')}`;
  head.append(title);
  const def = DEFS.steps;
  const num = (label: string, name: string, min: number, max: number): HTMLElement => {
    const l = document.createElement('label');
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = String(min);
    inp.max = String(max);
    inp.value = String(Math.round(m.params[name] ?? def.params.find((q) => q.name === name)!.default));
    inp.onchange = () => {
      const v = Math.max(min, Math.min(max, Math.round(Number(inp.value) || min)));
      inp.value = String(v);
      m.params[name] = v;
      host.changed(m, pat, fixNotes(notes), { name, value: v });
      draw();
    };
    l.append(`${label} `, inp);
    return l;
  };
  const rate = document.createElement('label');
  const sel = document.createElement('select');
  STEPS_RATES.forEach((r, i) => sel.append(new Option(r, String(i))));
  sel.value = String(Math.round(m.params.rate ?? 4));
  sel.onchange = () => {
    m.params.rate = Number(sel.value);
    host.changed(m, pat, fixNotes(notes), { name: 'rate', value: m.params.rate });
  };
  rate.append('RITMO ', sel);
  const clear = document.createElement('button');
  clear.textContent = 'BORRAR';
  clear.onclick = () => {
    if (!clear.classList.contains('armed')) {
      clear.classList.add('armed');
      clear.textContent = '¿SEGURO?';
      setTimeout(() => { clear.classList.remove('armed'); clear.textContent = 'BORRAR'; }, 2500);
      return;
    }
    notes = [];
    host.changed(m, pat, undefined);
    draw();
  };
  const close = document.createElement('button');
  close.textContent = 'LISTO';
  close.onclick = () => box.close();
  head.append(num('PASOS', 'len', 1, STEPS_MAX), rate, num('SWING %', 'swing', 50, 80), clear, close);
  const help = document.createElement('p');
  help.textContent = 'Clic: pone o saca una nota · arrastrá a la derecha: más larga · Shift: acento · la rueda sube y baja';
  const scroll = document.createElement('div');
  scroll.className = 'roll-scroll';
  const grid = document.createElement('div');
  grid.className = 'roll-grid';
  scroll.append(grid);
  box.append(head, help, scroll);
  document.body.append(box);
  let notes = notesOf(p, m, pat);
  const CW = 22, RH = 16, KEYW = 44;

  function draw(): void {
    const len = Math.max(1, Math.min(STEPS_MAX, Math.round(m.params.len ?? 16)));
    grid.replaceChildren();
    grid.style.width = `${KEYW + len * CW}px`;
    grid.style.height = `${(HIGH - LOW + 1) * RH}px`;
    for (let n = HIGH; n >= LOW; n--) {
      const y = (HIGH - n) * RH;
      const row = document.createElement('div');
      row.className = `roll-row${[1, 3, 6, 8, 10].includes(n % 12) ? ' black' : ''}${n % 12 === 0 ? ' c' : ''}`;
      row.style.top = `${y}px`;
      row.style.width = `${KEYW + len * CW}px`;
      const key = document.createElement('span');
      key.className = 'roll-key';
      key.textContent = noteName(n);
      key.onpointerdown = () => host.audition(n);
      row.append(key);
      grid.append(row);
    }
    for (let k = 0; k < len; k++) {
      const line = document.createElement('div');
      line.className = `roll-beat${k % 4 === 0 ? ' bar' : ''}`;
      line.style.left = `${KEYW + k * CW}px`;
      grid.append(line);
    }
    for (const nt of notes) {
      if (nt.note < LOW || nt.note > HIGH || nt.at >= len) continue;
      const el = document.createElement('div');
      el.className = `roll-note${nt.vel >= ACCENT_VEL ? ' acc' : ''}`;
      el.style.left = `${KEYW + nt.at * CW + 1}px`;
      el.style.top = `${(HIGH - nt.note) * RH + 1}px`;
      el.style.width = `${Math.min(nt.len, len - nt.at) * CW - 2}px`;
      el.style.height = `${RH - 2}px`;
      el.title = `${noteName(nt.note)} · paso ${nt.at + 1} · ${nt.len} paso${nt.len > 1 ? 's' : ''}`;
      grid.append(el);
    }
  }

  grid.onpointerdown = (e) => {
    const r = grid.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < KEYW) return;
    const len = Math.max(1, Math.round(m.params.len ?? 16));
    const k = Math.floor((x - KEYW) / CW), n = HIGH - Math.floor(y / RH);
    if (k < 0 || k >= len || n < LOW || n > HIGH) return;
    const hit = notes.find((q) => q.note === n && q.at <= k && k < q.at + q.len);
    if (hit) {
      notes = notes.filter((q) => q !== hit);
      host.changed(m, pat, fixNotes(notes));
      draw();
      return;
    }
    const nt: StepNote = { at: k, len: 1, note: n, vel: e.shiftKey ? ACCENT_VEL : STEP_VEL };
    notes.push(nt);
    host.audition(n);
    draw();
    const move = (ev: PointerEvent): void => {
      const kk = Math.floor((ev.clientX - r.left - KEYW) / CW);
      const l = Math.max(1, Math.min(len - k, kk - k + 1));
      if (l !== nt.len) {
        nt.len = l;
        draw();
      }
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      notes = fixNotes(notes) ?? [];
      host.changed(m, pat, notes.length ? notes : undefined);
      draw();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  draw();
  box.showModal();
  // open on the notes there are (else around C4)
  const mid = notes.length ? notes.reduce((s, q) => s + q.note, 0) / notes.length : 60;
  scroll.scrollTop = Math.max(0, (HIGH - mid) * RH - scroll.clientHeight / 2);
}
