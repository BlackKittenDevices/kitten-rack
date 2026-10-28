// SPDX-License-Identifier: GPL-3.0-only
// The rack editor: a Eurorack-style front end on Matryoshka's engine and patch model.
import './rack.css';
import { AudioHost } from '../audio';
import { DEFS } from '../modules';
import { cpuEstimate } from '../cpu';
import {
  addModule, connect, removeModule, validatePatch, paramUnit, paramValue, newPatch, NEW_PANEL,
  type Endpoint, type ModuleInst, type ParamDef, type Patch,
} from '../patch';
import { FAMILIES, cableColor, labelOf, paramLabel, portLabel } from './catalog';
import { HP_PX, ROW_H, ROW_HP, ROW_PITCH, RAIL_X, fits, freeSpot, geoOf, onGrid, pack, panelGeo, placeOf, setPlace, type Spot } from './layout';

const NAME = 'KITTEN RACK';
const STORE = 'kittenrack.patches';
const CURRENT = 'kittenrack.current';

const host = new AudioHost();
let patch: Patch = initPatch();
let rows = 3;
let octave = 0;
const knobEls = new Map<string, { ring: SVGPathElement; mod: SVGPathElement; text: HTMLElement; pd: ParamDef; id: number }>();

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;
const rack = $<HTMLDivElement>('#rack');
const wires = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
wires.id = 'wires';

// ---------- patches ----------

function initPatch(): Patch {
  const p = newPatch(DEFS, 'gato negro');
  const main = p.modules.find((m) => m.type === 'fm1')!;
  const out = p.modules.find((m) => m.type === 'output')!;
  const vco = addModule(p, DEFS.osc, 0, 0);
  const vcf = addModule(p, DEFS.ladder, 0, 0);
  const adsr = addModule(p, DEFS.adsr, 0, 0);
  const vca = addModule(p, DEFS.vca, 0, 0);
  vcf.params.cutoff = 900;
  vcf.params.res = 0.35;
  const c = (a: ModuleInst, ap: string, b: ModuleInst, bp: string): void => void connect(p, DEFS, { module: a.id, port: ap }, { module: b.id, port: bp });
  c(main, 'pitch', vco, 'pitch');
  c(vco, 'out', vcf, 'in');
  c(main, 'gate', adsr, 'gate');
  c(adsr, 'env', vcf, 'cv');
  c(vcf, 'lp24', vca, 'in');
  c(adsr, 'env', vca, 'cv');
  c(vca, 'out', out, 'l');
  c(vca, 'out', out, 'r');
  pack(p, DEFS);
  return p;
}

function load(raw: unknown): void {
  try {
    const p = validatePatch(structuredClone(raw), DEFS);
    if (!p.modules.some((m) => m.type === 'fm1')) addModule(p, DEFS.fm1, 0, 0).panel = NEW_PANEL();
    if (!p.modules.some((m) => m.type === 'output')) addModule(p, DEFS.output, 0, 0);
    p.modules = p.modules.filter((m) => DEFS[m.type]);
    if (!onGrid(p, DEFS)) pack(p, DEFS);
    patch = p;
    octave = p.octave ?? 0;
    render();
    sendPatch();
    toast(`Cargado: ${p.name}`);
  } catch (e) {
    toast(`No se pudo abrir el patch: ${(e as Error).message}`);
  }
}

function sendPatch(): void {
  host.setPatch(structuredClone(patch));
  saveCurrent();
  meters();
}

function saveCurrent(): void {
  try {
    localStorage.setItem(CURRENT, JSON.stringify(patch));
  } catch { /* storage off */ }
}

function stored(): Record<string, Patch> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Patch>;
  } catch {
    return {};
  }
}

function saveAs(): void {
  const name = $<HTMLInputElement>('#name').value.trim();
  if (!name) return toast('Escribí un nombre arriba antes de guardar');
  patch.name = name;
  patch.octave = octave;
  const all = stored();
  all[name] = structuredClone(patch);
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
    toast(`Guardado: ${name}`);
  } catch {
    toast('El navegador no deja guardar');
  }
  fillMine();
}

// ---------- the rack ----------

function render(): void {
  knobEls.clear();
  const maxRow = Math.max(0, ...patch.modules.map((m) => placeOf(m).row));
  rows = Math.max(rows, maxRow + 1, 3);
  rack.replaceChildren();
  rack.style.width = `${RAIL_X * 2 + ROW_HP * HP_PX}px`;
  rack.style.height = `${rows * ROW_PITCH}px`;
  for (let r = 0; r < rows; r++) {
    const rail = document.createElement('div');
    rail.className = 'row';
    rail.style.top = `${r * ROW_PITCH}px`;
    rail.dataset.row = String(r);
    rail.innerHTML = `<span class="row-num">${toRoman(r + 1)}</span>`;
    rack.append(rail);
  }
  for (const m of patch.modules) if (DEFS[m.type]) rack.append(panel(m));
  rack.append(wires);
  wires.setAttribute('width', rack.style.width);
  wires.setAttribute('height', rack.style.height);
  drawWires();
  $<HTMLInputElement>('#name').value = patch.name;
  $('#oct').textContent = `OCT ${octave >= 0 ? '+' : ''}${octave}`;
  meters();
}

const toRoman = (n: number): string => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n);

function panel(m: ModuleInst): HTMLElement {
  const def = DEFS[m.type];
  const geo = geoOf(patch, DEFS, m);
  const at = placeOf(m);
  const el = document.createElement('div');
  el.className = `panel t-${m.type}${m.type === 'fm1' || m.type === 'output' ? ' fixed' : ''}`;
  el.style.left = `${RAIL_X + at.hp * HP_PX}px`;
  el.style.top = `${at.row * ROW_PITCH}px`;
  el.style.width = `${geo.hp * HP_PX}px`;
  el.style.height = `${ROW_H}px`;
  el.dataset.id = String(m.id);
  const head = document.createElement('div');
  head.className = 'head';
  head.innerHTML = `<span class="screw"></span><b>${labelOf(m.type)}</b><span class="hp">${geo.hp}HP</span><span class="screw"></span>`;
  if (!el.classList.contains('fixed')) {
    const x = document.createElement('button');
    x.className = 'kill';
    x.title = 'Sacar módulo';
    x.textContent = '✕';
    x.onclick = (e) => {
      e.stopPropagation();
      if (!x.classList.contains('armed')) {
        x.classList.add('armed');
        x.textContent = '¿SACAR?';
        setTimeout(() => { x.classList.remove('armed'); x.textContent = '✕'; }, 2500);
        return;
      }
      removeModule(patch, m.id);
      render();
      sendPatch();
    };
    head.append(x);
  }
  head.onpointerdown = (e) => dragPanel(e, m, el);
  el.append(head);
  for (const k of geo.knobs) {
    const pd = def.params.find((p) => p.name === k.name);
    if (pd) el.append(knob(m, pd, k.at));
  }
  for (const j of geo.inputs) el.append(jack(m, j.name, j.at, false));
  for (const j of geo.outputs) el.append(jack(m, j.name, j.at, true));
  const foot = document.createElement('div');
  foot.className = 'foot';
  foot.innerHTML = '<span class="screw"></span><span class="screw"></span>';
  el.append(foot);
  return el;
}

// ---------- knobs ----------

const ARC = 270;
const arcPath = (u0: number, u1: number, r: number): string => {
  const a0 = ((-135 + ARC * u0) * Math.PI) / 180;
  const a1 = ((-135 + ARC * Math.max(u0 + 0.0001, u1)) * Math.PI) / 180;
  const p = (a: number): string => `${18 + r * Math.sin(a)} ${18 - r * Math.cos(a)}`;
  return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
};

function valueText(pd: ParamDef, v: number): string {
  if (pd.toggle) return v >= 0.5 ? 'ON' : 'OFF';
  if (pd.choices) return (pd.choices[Math.round(v)] ?? String(Math.round(v))).toUpperCase();
  const a = Math.abs(v);
  const n = a >= 1000 ? `${(v / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${n}${pd.unit ? ` ${pd.unit}` : ''}`;
}

const unitOf = (pd: ParamDef, v: number): number => (pd.choices ? (v - pd.min) / Math.max(1, pd.max - pd.min) : paramUnit(pd, v));
function valueOf(pd: ParamDef, u: number): number {
  let v = pd.choices ? pd.min + Math.round(u * (pd.max - pd.min)) : paramValue(pd, u);
  if (pd.toggle) v = u >= 0.5 ? 1 : 0;
  else if (pd.step && !pd.log) v = Math.round(v / pd.step) * pd.step;
  return Math.min(pd.max, Math.max(pd.min, v));
}

function knob(m: ModuleInst, pd: ParamDef, at: Spot): HTMLElement {
  const box = document.createElement('div');
  box.className = `knob${pd.toggle ? ' toggle' : ''}${pd.choices ? ' choice' : ''}`;
  box.style.left = `${at.x}px`;
  box.style.top = `${at.y}px`;
  box.title = `${pd.name}${pd.input ? ` (entrada ${portLabel(pd.input)})` : ''}\nArrastrá arriba/abajo, Shift = fino, doble clic = valor inicial`;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  const track = document.createElementNS(ns, 'path');
  track.setAttribute('d', arcPath(0, 1, 16));
  track.setAttribute('class', 'k-track');
  const mod = document.createElementNS(ns, 'path');
  mod.setAttribute('class', 'k-mod');
  const ring = document.createElementNS(ns, 'path');
  ring.setAttribute('class', 'k-ring');
  const cap = document.createElementNS(ns, 'circle');
  cap.setAttribute('cx', '18');
  cap.setAttribute('cy', '18');
  cap.setAttribute('r', '11');
  cap.setAttribute('class', 'k-cap');
  const tick = document.createElementNS(ns, 'line');
  tick.setAttribute('x1', '18');
  tick.setAttribute('y1', '18');
  tick.setAttribute('x2', '18');
  tick.setAttribute('y2', '8');
  tick.setAttribute('class', 'k-tick');
  svg.append(track, mod, ring, cap, tick);
  const name = document.createElement('span');
  name.className = 'k-name';
  name.textContent = paramLabel(pd.name);
  const val = document.createElement('span');
  val.className = 'k-val';
  box.append(name, svg, val);
  const show = (): void => {
    const v = m.params[pd.name] ?? pd.default;
    const u = unitOf(pd, v);
    ring.setAttribute('d', arcPath(0, u, 16));
    tick.setAttribute('transform', `rotate(${-135 + ARC * u} 18 18)`);
    val.textContent = valueText(pd, v);
  };
  show();
  knobEls.set(`${m.id}:${pd.name}`, { ring, mod, text: val, pd, id: m.id });
  const set = (v: number): void => {
    m.params[pd.name] = v;
    show();
    host.send({ t: 'param', id: m.id, name: pd.name, value: v });
    saveCurrent();
    meters();
  };
  svg.onpointerdown = (e) => {
    e.preventDefault();
    if (pd.toggle) {
      set((m.params[pd.name] ?? pd.default) >= 0.5 ? 0 : 1);
      return;
    }
    const y0 = e.clientY;
    const u0 = unitOf(pd, m.params[pd.name] ?? pd.default);
    box.classList.add('turning');
    const move = (ev: PointerEvent): void => set(valueOf(pd, u0 + (y0 - ev.clientY) / (ev.shiftKey ? 900 : 180)));
    const up = (): void => {
      box.classList.remove('turning');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  svg.ondblclick = () => set(pd.default);
  svg.onwheel = (e) => {
    e.preventDefault();
    set(valueOf(pd, unitOf(pd, m.params[pd.name] ?? pd.default) - Math.sign(e.deltaY) * (pd.choices ? 1 / Math.max(1, pd.max - pd.min) : e.shiftKey ? 0.002 : 0.02)));
  };
  return box;
}

/** the modulated values from the engine, drawn as a thin arc beside each knob */
host.onValues = (vals) => {
  for (const k of knobEls.values()) k.mod.setAttribute('d', '');
  if (!vals) return;
  for (const { id, params } of vals)
    for (const [name, v] of Object.entries(params)) {
      const k = knobEls.get(`${id}:${name}`);
      if (k) k.mod.setAttribute('d', arcPath(0, unitOf(k.pd, v), 13));
    }
};

// ---------- jacks and cables ----------

interface JackRef {
  end: Endpoint;
  out: boolean;
}

function jackSpot(end: Endpoint, out: boolean): Spot | null {
  const m = patch.modules.find((x) => x.id === end.module);
  if (!m || !DEFS[m.type]) return null;
  const geo = geoOf(patch, DEFS, m);
  const j = (out ? geo.outputs : geo.inputs).find((q) => q.name === end.port);
  if (!j) return null;
  const at = placeOf(m);
  return { x: RAIL_X + at.hp * HP_PX + j.at.x, y: at.row * ROW_PITCH + j.at.y };
}

function kindOf(type: string, port: string, out: boolean): string {
  const def = DEFS[type];
  return (out ? def.outputs : def.inputs).find((p) => p.name === port)?.kind ?? 'control';
}

function jack(m: ModuleInst, port: string, at: Spot, out: boolean): HTMLElement {
  const el = document.createElement('div');
  const kind = kindOf(m.type, port, out);
  el.className = `jack ${out ? 'out' : 'in'} k-${kind}`;
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  el.dataset.module = String(m.id);
  el.dataset.port = port;
  el.dataset.out = out ? '1' : '0';
  const isPin = port === 'p1' || port === 'p2';
  let label = portLabel(port);
  if (isPin && m.map) {
    const dest = m.map[port as 'p1' | 'p2'];
    if (dest?.length) label = `${label}→${paramLabel(dest[0]).slice(0, 4)}`;
  }
  el.innerHTML = `<span class="hole"></span><span class="j-name">${label}</span>`;
  el.title = `${out ? 'Salida' : 'Entrada'} ${portLabel(port)} (${kind})${isPin ? '\nClic: elegir qué parámetro modula y cuánto' : ''}`;
  el.onpointerdown = (e) => startCable(e, { end: { module: m.id, port }, out }, el, isPin ? () => pinMenu(m, port as 'p1' | 'p2', el) : undefined);
  return el;
}

let dragging: { from: Spot; to: Spot; color: string } | null = null;

function startCable(e: PointerEvent, ref: JackRef, el: HTMLElement, onClick?: () => void): void {
  e.preventDefault();
  e.stopPropagation();
  const origin = jackSpot(ref.end, ref.out)!;
  let anchor: JackRef = ref;
  // pulling a plug out of an input: the cable stays in the hand, held by its other end
  if (!ref.out) {
    const held = [...patch.cables].reverse().find((c) => c.to.module === ref.end.module && c.to.port === ref.end.port);
    if (held && !onClick) {
      patch.cables = patch.cables.filter((c) => c !== held);
      anchor = { end: held.from, out: true };
    }
  }
  const colorOf = (r: JackRef): string => cableColor(kindOf(patch.modules.find((m) => m.id === r.end.module)!.type, r.end.port, r.out), r.end.port);
  let color = cableColor(kindOf(patch.modules.find((m) => m.id === anchor.end.module)!.type, anchor.end.port, anchor.out), anchor.end.port);
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moved = false;
  const from = jackSpot(anchor.end, anchor.out) ?? origin;
  const move = (ev: PointerEvent): void => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!moved && onClick && !ref.out) {
      const held = [...patch.cables].reverse().find((c) => c.to.module === ref.end.module && c.to.port === ref.end.port);
      if (held && anchor === ref) {
        patch.cables = patch.cables.filter((c) => c !== held);
        anchor = { end: held.from, out: true };
        color = colorOf(anchor);
      }
    }
    moved = true;
    const r = rack.getBoundingClientRect();
    const scale = r.width / rack.offsetWidth;
    const fromNow = jackSpot(anchor.end, anchor.out) ?? from;
    dragging = { from: fromNow, to: { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }, color };
    drawWires();
  };
  const up = (ev: PointerEvent): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    dragging = null;
    if (!moved) {
      drawWires();
      if (onClick) onClick();
      return;
    }
    const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('.jack') as HTMLElement | null;
    if (target) {
      const t: JackRef = { end: { module: Number(target.dataset.module), port: target.dataset.port! }, out: target.dataset.out === '1' };
      const [a, b] = anchor.out ? [anchor, t] : [t, anchor];
      if (a.out && !b.out && !connect(patch, DEFS, a.end, b.end)) toast('Ese cable no va ahí (KEYS solo va a KEYS)');
      else if (a.out === b.out) toast('Un cable va de una salida a una entrada');
    }
    render();
    sendPatch();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  void el;
}

/** a sagging cable from a to b */
function sag(a: Spot, b: Spot): string {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const drop = Math.min(160, 30 + d * 0.28);
  const mx = (a.x + b.x) / 2;
  const my = Math.max(a.y, b.y) + drop;
  return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
}

function drawWires(): void {
  const ns = 'http://www.w3.org/2000/svg';
  wires.replaceChildren();
  const add = (a: Spot, b: Spot, color: string, cable?: (typeof patch.cables)[number]): void => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', `wire${cable ? '' : ' live'}`);
    const shade = document.createElementNS(ns, 'path');
    shade.setAttribute('d', sag(a, b));
    shade.setAttribute('class', 'w-shade');
    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', sag(a, b));
    line.setAttribute('class', 'w-line');
    line.style.stroke = color;
    g.append(shade, line);
    for (const s of [a, b]) {
      const plug = document.createElementNS(ns, 'circle');
      plug.setAttribute('cx', String(s.x));
      plug.setAttribute('cy', String(s.y));
      plug.setAttribute('r', '6.5');
      plug.setAttribute('class', 'w-plug');
      plug.style.fill = color;
      g.append(plug);
    }
    if (cable) {
      g.onclick = () => {
        patch.cables = patch.cables.filter((c) => c !== cable);
        render();
        sendPatch();
      };
      const t = document.createElementNS(ns, 'title');
      t.textContent = 'Clic para sacar el cable';
      g.append(t);
    }
    wires.append(g);
  };
  for (const c of patch.cables) {
    const a = jackSpot(c.from, true);
    const b = jackSpot(c.to, false);
    const mf = patch.modules.find((m) => m.id === c.from.module);
    if (a && b && mf) add(a, b, cableColor(kindOf(mf.type, c.from.port, true), c.from.port), c);
  }
  if (dragging) add(dragging.from, dragging.to, dragging.color);
}

// ---------- the CV pins' menu ----------

function pinMenu(m: ModuleInst, pin: 'p1' | 'p2', el: HTMLElement): void {
  closeMenus();
  const def = DEFS[m.type];
  if (!m.map || !m.att) return;
  const menu = document.createElement('div');
  menu.className = 'menu';
  const idx = pin === 'p1' ? 0 : 1;
  menu.innerHTML = `<b>${portLabel(pin)} de ${labelOf(m.type)}</b><p>Qué mueve esta entrada</p>`;
  for (const p of def.params) {
    const row = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = m.map[pin].includes(p.name);
    box.onchange = () => {
      m.map![pin] = box.checked ? [...m.map![pin], p.name] : m.map![pin].filter((n) => n !== p.name);
      render();
      sendPatch();
      pinMenu(m, pin, document.querySelector(`.panel[data-id="${m.id}"] .jack[data-port="${pin}"]`) as HTMLElement);
    };
    row.append(box, ` ${paramLabel(p.name)}`);
    menu.append(row);
  }
  const amt = document.createElement('label');
  amt.className = 'amt';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '-100';
  range.max = '100';
  range.value = String(Math.round(m.att[idx] * 100));
  const out = document.createElement('span');
  out.textContent = `${range.value} %`;
  range.oninput = () => {
    m.att![idx] = Number(range.value) / 100;
    out.textContent = `${range.value} %`;
    host.send({ t: 'att', id: m.id, index: idx, value: m.att![idx] });
    saveCurrent();
  };
  amt.append('Cantidad ', range, out);
  menu.append(amt);
  const close = document.createElement('button');
  close.textContent = 'Listo';
  close.onclick = closeMenus;
  menu.append(close);
  document.body.append(menu);
  const r = el.getBoundingClientRect();
  menu.style.left = `${Math.min(window.innerWidth - 240, r.left)}px`;
  menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 6)}px`;
}

const closeMenus = (): void => document.querySelectorAll('.menu').forEach((m) => m.remove());

// ---------- moving panels ----------

function dragPanel(e: PointerEvent, m: ModuleInst, el: HTMLElement): void {
  if ((e.target as HTMLElement).closest('.kill')) return;
  e.preventDefault();
  const start = placeOf(m);
  const hp = geoOf(patch, DEFS, m).hp;
  const x0 = e.clientX;
  const y0 = e.clientY;
  const scale = rack.getBoundingClientRect().width / rack.offsetWidth;
  let to = start;
  el.classList.add('lifted');
  const move = (ev: PointerEvent): void => {
    const dx = (ev.clientX - x0) / scale;
    const dy = (ev.clientY - y0) / scale;
    const row = Math.max(0, Math.min(rows - 1, start.row + Math.round(dy / ROW_PITCH)));
    const x = Math.max(0, Math.min(ROW_HP - hp, start.hp + Math.round(dx / HP_PX)));
    const ok = fits(patch, DEFS, row, x, hp, m.id);
    el.style.left = `${RAIL_X + x * HP_PX}px`;
    el.style.top = `${row * ROW_PITCH}px`;
    el.classList.toggle('blocked', !ok);
    if (ok) to = { row, hp: x };
  };
  const up = (): void => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    el.classList.remove('lifted', 'blocked');
    setPlace(m, to.row, to.hp);
    render();
    saveCurrent();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// ---------- the catalog ----------

function fillCatalog(): void {
  const box = $('#catalog');
  for (const f of FAMILIES) {
    const h = document.createElement('h3');
    h.textContent = f.name;
    box.append(h);
    for (const t of f.types) {
      const b = document.createElement('button');
      b.className = 'add';
      if (t.soon || !DEFS[t.type]) {
        b.disabled = true;
        b.innerHTML = `${t.label} <i>pronto</i>`;
      } else {
        b.innerHTML = `${t.label} <i>${panelGeo(DEFS[t.type]).hp}HP</i>`;
        b.onclick = () => addToRack(t.type);
      }
      box.append(b);
    }
  }
}

function addToRack(type: string): void {
  const def = DEFS[type];
  if (patch.modules.length >= 64) return toast('Un patch tiene como máximo 64 módulos');
  const hp = panelGeo(def).hp;
  const spot = freeSpot(patch, DEFS, hp, rows);
  if (spot.row >= rows) rows = spot.row + 1;
  const m = addModule(patch, def, 0, 0);
  setPlace(m, spot.row, spot.hp);
  render();
  sendPatch();
  document.querySelector(`.panel[data-id="${m.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  toast(`${labelOf(type)} en la fila ${toRoman(spot.row + 1)}`);
}

// ---------- meters, presets, toolbar ----------

function meters(): void {
  let use = 0;
  try {
    use = cpuEstimate(patch).use;
  } catch { /* an odd patch: no estimate */ }
  const pct = Math.round(use * 100);
  const bar = $('#cpu-bar');
  bar.style.width = `${Math.min(100, pct)}%`;
  bar.classList.toggle('hot', pct > 80);
  $('#cpu-txt').textContent = `${pct}%`;
  const hp = patch.modules.reduce((s, m) => s + (DEFS[m.type] ? geoOf(patch, DEFS, m).hp : 0), 0);
  $('#hp-txt').textContent = `${hp}/${rows * ROW_HP} HP · ${patch.modules.length}/64 módulos · ${patch.cables.length} cables`;
}

const presetFiles = import.meta.glob<unknown>('../../presets/*.json', { eager: true, import: 'default' });

function fillPresets(): void {
  const sel = $<HTMLSelectElement>('#presets');
  for (const [file, raw] of Object.entries(presetFiles).sort()) {
    const o = document.createElement('option');
    o.value = file;
    o.textContent = (raw as { name?: string }).name ?? file;
    sel.append(o);
  }
  sel.onchange = () => {
    if (sel.value) load(presetFiles[sel.value]);
    sel.value = '';
  };
}

function fillMine(): void {
  const sel = $<HTMLSelectElement>('#mine');
  sel.replaceChildren(new Option('Mis patches…', ''));
  for (const name of Object.keys(stored()).sort()) sel.append(new Option(name, name));
  sel.onchange = () => {
    const p = stored()[sel.value];
    if (p) load(p);
    sel.value = '';
  };
}

function toast(msg: string): void {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout((t as unknown as { timer: number }).timer);
  (t as unknown as { timer: number }).timer = window.setTimeout(() => t.classList.remove('on'), 2600);
}

function exportJson(): void {
  patch.octave = octave;
  const text = JSON.stringify(patch);
  const box = $<HTMLDialogElement>('#export-box');
  $<HTMLTextAreaElement>('#export-text').value = text;
  box.showModal();
  $('#export-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Patch copiado');
    } catch {
      $<HTMLTextAreaElement>('#export-text').select();
      toast('Seleccionado: copialo con Ctrl+C');
    }
  };
  $('#export-close').onclick = () => box.close();
}

function importJson(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (f) load(JSON.parse(await f.text()));
  };
  input.click();
}

// ---------- playing: the computer keyboard and MIDI ----------

const KEYMAP = 'awsedftgyhujkolp;';
const down = new Set<string>();

function noteOn(note: number, vel: number): void {
  if (!host.running) void power();
  host.send({ t: 'on', note, vel });
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'x') {
    octave = Math.max(-3, Math.min(3, octave + (k === 'z' ? -1 : 1)));
    $('#oct').textContent = `OCT ${octave >= 0 ? '+' : ''}${octave}`;
    return;
  }
  const i = KEYMAP.indexOf(k);
  if (i < 0 || down.has(k)) return;
  down.add(k);
  noteOn(60 + octave * 12 + i, 100);
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  const i = KEYMAP.indexOf(k);
  if (i < 0 || !down.has(k)) return;
  down.delete(k);
  host.send({ t: 'off', note: 60 + octave * 12 + i });
});

async function midi(): Promise<void> {
  const st = $('#midi');
  if (!navigator.requestMIDIAccess) {
    st.textContent = 'MIDI: no disponible';
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    const hook = (): void => {
      const names: string[] = [];
      access.inputs.forEach((inp) => {
        names.push(inp.name ?? 'MIDI');
        inp.onmidimessage = (ev) => {
          const d = ev.data;
          if (!d) return;
          const s = d[0] & 0xf0;
          if (s === 0x90 && d[2] > 0) noteOn(d[1], d[2]);
          else if (s === 0x80 || (s === 0x90 && d[2] === 0)) host.send({ t: 'off', note: d[1] });
          else if (s === 0xb0) host.send({ t: 'cc', n: d[1], v: d[2] });
          else if (s === 0xe0) host.send({ t: 'bend', v: ((d[2] << 7) | d[1]) / 8192 - 1 });
          else if (s === 0xd0) host.send({ t: 'at', v: d[1] / 127 });
          else if (d[0] === 0xf8) host.send({ t: 'clock' });
          else if (d[0] === 0xfa || d[0] === 0xfb) host.send({ t: 'clockrun', on: true });
          else if (d[0] === 0xfc) host.send({ t: 'clockrun', on: false });
        };
      });
      st.textContent = names.length ? `MIDI: ${names.join(', ')}` : 'MIDI: sin equipos';
    };
    hook();
    access.onstatechange = hook;
  } catch {
    st.textContent = 'MIDI: permiso negado';
  }
}

async function power(): Promise<void> {
  if (host.running) {
    host.send({ t: 'panic' });
    host.mute(!host.muted);
  } else {
    await host.start();
    host.setPatch(structuredClone(patch));
  }
  const on = host.running && !host.muted;
  $('#power').textContent = on ? 'APAGAR' : 'ENCENDER';
  $('#power').classList.toggle('on', on);
  document.body.classList.toggle('live', on);
}

let playing = false;

function boot(): void {
  document.title = NAME;
  $('#logo').textContent = NAME;
  fillCatalog();
  fillPresets();
  fillMine();
  try {
    const saved = localStorage.getItem(CURRENT);
    if (saved) {
      load(JSON.parse(saved));
    } else render();
  } catch {
    render();
  }
  host.setPatch(structuredClone(patch));
  $('#power').onclick = () => void power();
  $('#new').onclick = () => {
    const b = $('#new');
    if (!b.classList.contains('armed')) {
      b.classList.add('armed');
      b.textContent = '¿SEGURO?';
      setTimeout(() => { b.classList.remove('armed'); b.textContent = 'NUEVO'; }, 2500);
      return;
    }
    b.classList.remove('armed');
    b.textContent = 'NUEVO';
    patch = initPatch();
    rows = 3;
    render();
    sendPatch();
  };
  $('#save').onclick = saveAs;
  $<HTMLInputElement>('#name').onchange = () => {
    patch.name = $<HTMLInputElement>('#name').value.trim() || patch.name;
    saveCurrent();
  };
  $('#export').onclick = exportJson;
  $('#import').onclick = importJson;
  $('#addrow').onclick = () => {
    rows++;
    render();
  };
  $('#delrow').onclick = () => {
    const used = Math.max(0, ...patch.modules.map((m) => placeOf(m).row));
    if (rows - 1 > used && rows > 1) {
      rows--;
      render();
    } else toast('La última fila tiene módulos');
  };
  $('#play').onclick = () => {
    playing = !playing;
    host.transport(playing);
    $('#play').textContent = playing ? '■ STOP' : '▶ PLAY';
  };
  const zoom = $<HTMLInputElement>('#zoom');
  zoom.oninput = () => {
    rack.style.transform = `scale(${Number(zoom.value) / 100})`;
    $('#stage').style.setProperty('--z', String(Number(zoom.value) / 100));
  };
  document.addEventListener('pointerdown', (e) => {
    if (!(e.target as HTMLElement).closest('.menu, .jack')) closeMenus();
  });
  host.onError = (msg) => toast(`Motor: ${msg}`);
  void midi();
}

boot();
