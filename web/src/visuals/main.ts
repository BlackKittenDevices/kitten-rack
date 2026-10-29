// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: the visuals page (visuales.html): the FM-1's oscilloscope and VJ scenes (scenes.ts) full screen, for a
// projector, a second screen or OBS (a window capture). The sound comes in through the FM-1's USB audio (the computer sees
// it as a sound card: its input is the FM-1's master), so whatever the FM-1 plays moves the picture; its USB MIDI (notes,
// clock) can make it beat too. Nothing goes back to the FM-1.
// Other pages and tools on the same computer get what it hears, every frame, on the BroadcastChannel 'kitten-rack-visuales':
//   { bass, mid, high (0..255), beat (boolean), scene (0..4), mode, note? (the last MIDI note on) }
// ?demo plays a sound of its own instead of an input (to try the page without the FM-1).
import { Listener, PALETTE, SCENES, Scope, Vj, type Bands } from './scenes';

type Mode = 'scope' | 'vj' | 'both';
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('screen');
const g = canvas.getContext('2d')!;
const ui = $<HTMLDivElement>('ui');
const help = $<HTMLDivElement>('help');
const state = $<HTMLSpanElement>('state');
const inputSel = $<HTMLSelectElement>('input');
const sceneBtn = $<HTMLButtonElement>('scene');
const autoBtn = $<HTMLButtonElement>('auto');
const cellsIn = $<HTMLInputElement>('cells');
const midiBtn = $<HTMLButtonElement>('midi');
const demo = new URLSearchParams(location.search).has('demo');

const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(`kittenrack.vis.${k}`); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(`kittenrack.vis.${k}`, v); } catch { /* (private window) */ } },
};
let mode: Mode = (store.get('mode') as Mode | null) ?? 'vj';
let cells = Number(store.get('cells') ?? 60) || 60;
cellsIn.value = String(cells);

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: AudioNode | null = null;
let stream: MediaStream | null = null;
let buf = new Float32Array(2048);
const listener = new Listener();
const scope = new Scope();
let vj = new Vj(cells, 27);
const pix = document.createElement('canvas');
const pg = pix.getContext('2d')!;
let img: ImageData | null = null;
const RGB = PALETTE.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('kitten-rack-visuales') : null;
let midiBeat = false;
let lastNote: number | undefined;
let midiOn = false;

function resize(): void {
  const d = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * d);
  canvas.height = Math.round(innerHeight * d);
  const h = Math.max(4, Math.round((cells * canvas.height) / canvas.width));
  if (!img || vj.w !== cells || vj.h !== h) {
    const old = vj;
    vj = new Vj(cells, h);
    vj.scene = old.scene;
    vj.auto = old.auto;
    pix.width = cells;
    pix.height = h;
    img = pg.createImageData(cells, h);
  }
}

function showMode(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode);
  sceneBtn.textContent = `${SCENES[vj.scene]} ${vj.scene + 1}/${SCENES.length}`;
  autoBtn.classList.toggle('on', vj.auto);
  midiBtn.classList.toggle('on', midiOn);
}

// ---- the sound
async function listInputs(): Promise<void> {
  const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  const want = store.get('input');
  inputSel.replaceChildren(...all.map((d, k) => new Option(d.label || `Entrada ${k + 1}`, d.deviceId)));
  const fm1 = all.find((d) => d.deviceId === want) ?? all.find((d) => /fm-?1|m-?vave|kitten|matryoshka|felucca|modular/i.test(d.label));
  if (fm1) inputSel.value = fm1.deviceId;
}

async function useInput(id?: string): Promise<void> {
  stream?.getTracks().forEach((t) => t.stop());
  source?.disconnect();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
  });
  source = ctx!.createMediaStreamSource(stream);
  source.connect(analyser!);
  const label = stream.getAudioTracks()[0]?.label ?? '';
  state.textContent = `ENTRADA: ${label || 'la del sistema'}`;
}

function demoSound(): void {   // a bass on every beat, a hat between: enough to move every scene
  const out = ctx!.createGain();
  out.gain.value = 0.6;
  out.connect(analyser!);
  source = out;
  let k = 0;
  setInterval(() => {
    const t = ctx!.currentTime + 0.02;
    const o = ctx!.createOscillator(), e = ctx!.createGain();
    o.type = k % 2 ? 'square' : 'sawtooth';
    o.frequency.setValueAtTime(k % 2 ? 880 + 220 * (k % 3) : 55 * (1 + (k % 4 === 3 ? 0.5 : 0)), t);
    e.gain.setValueAtTime(k % 2 ? 0.15 : 0.9, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + (k % 2 ? 0.06 : 0.35));
    o.connect(e).connect(out);
    o.start(t);
    o.stop(t + 0.4);
    k++;
  }, 250);
  state.textContent = 'DEMO: un sonido propio';
}

async function start(): Promise<void> {
  help.remove();
  ctx = new AudioContext({ latencyHint: 'interactive' });
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  buf = new Float32Array(analyser.fftSize);
  if (demo) {
    demoSound();
    return;
  }
  try {
    await useInput(store.get('input') ?? undefined);
  } catch {
    try {
      await useInput();
    } catch (e) {
      state.textContent = `SIN ENTRADA DE AUDIO (${(e as Error).name}): permití el micrófono / la entrada`;
      return;
    }
  }
  await listInputs();
  if (inputSel.value && stream?.getAudioTracks()[0]?.getSettings().deviceId !== inputSel.value) await useInput(inputSel.value);
}

inputSel.onchange = async () => {
  store.set('input', inputSel.value);
  if (ctx) await useInput(inputSel.value);
};

// ---- MIDI: a note on or a beat of the clock (24 ticks) makes it beat
async function toggleMidi(): Promise<void> {
  if (midiOn) {
    midiOn = false;
    showMode();
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    let ticks = 0;
    const hook = (): void => {
      for (const inp of access.inputs.values())
        inp.onmidimessage = (ev) => {
          if (!midiOn || !ev.data) return;
          const [s, d1, d2] = ev.data;
          if (s === 0xf8 && ++ticks % 24 === 0) midiBeat = true;
          else if (s === 0xfa) ticks = 0;
          else if ((s & 0xf0) === 0x90 && d2 > 0) {
            midiBeat = true;
            lastNote = d1;
          }
        };
    };
    hook();
    access.onstatechange = hook;
    midiOn = true;
  } catch {
    state.textContent = 'ESTE NAVEGADOR NO DA MIDI (usá Chrome o Edge)';
  }
  showMode();
}

// ---- drawing
let lastStep = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  let bands: Bands = { bass: 0, mid: 0, high: 0, beat: false };
  if (analyser) {
    analyser.getFloatTimeDomainData(buf);
    bands = listener.listen(buf, now, Math.max(1, Math.round((ctx?.sampleRate ?? 44100) / 22050)));
  }
  if (midiBeat) {
    bands.beat = true;
    midiBeat = false;
  }
  const W = canvas.width, H = canvas.height;
  if (mode !== 'scope' && now - lastStep >= 45) {   // (the firmware's pace: the scenes move as on the FM-1)
    lastStep = now;
    vj.step(bands, now);
    const d = img!.data;
    for (let i = 0, n = vj.w * vj.h; i < n; i++) {
      const c = RGB[vj.cell(i)];
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }
    pg.putImageData(img!, 0, 0);
    showMode();
  } else if (mode === 'scope' && bands.beat) vj.pulse = 255;
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  if (mode === 'scope') {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  } else {
    g.drawImage(pix, 0, 0, W, H);
  }
  if (mode !== 'vj') {
    if (mode === 'both') {
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(0, H * 0.2, W, H * 0.6);
    } else {
      g.strokeStyle = '#401c00';
      g.lineWidth = Math.max(1, H / 300);
      g.beginPath();
      g.moveTo(0, H / 2);
      g.lineTo(W, H / 2);
      g.stroke();
    }
    const tr = scope.trace(buf, analyser ? Math.min(512, buf.length / 2) : 512);
    g.strokeStyle = PALETTE[4];
    g.shadowColor = PALETTE[5];
    g.shadowBlur = H / 60;
    g.lineWidth = Math.max(2, H / 180);
    g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i < tr.length; i++) {
      const x = (i / (tr.length - 1)) * W, y = H / 2 - tr[i] * H * 0.42;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }
  channel?.postMessage({ bass: Math.round(bands.bass), mid: Math.round(bands.mid), high: Math.round(bands.high), beat: bands.beat, scene: vj.scene, mode, note: lastNote });
}

// ---- controls
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
  b.onclick = () => {
    mode = b.dataset.mode as Mode;
    store.set('mode', mode);
    showMode();
  };
sceneBtn.onclick = () => { vj.next(performance.now()); showMode(); };
autoBtn.onclick = () => { vj.auto = !vj.auto; showMode(); };
midiBtn.onclick = () => void toggleMidi();
cellsIn.oninput = () => {
  cells = Number(cellsIn.value);
  store.set('cells', String(cells));
  resize();
};
const full = (): void => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
};
$<HTMLButtonElement>('full').onclick = full;
$<HTMLButtonElement>('start').onclick = () => void start();
let idle = 0;
const wake = (): void => {
  ui.classList.remove('gone');
  clearTimeout(idle);
  idle = window.setTimeout(() => { if (ctx) ui.classList.add('gone'); }, 3000);
};
addEventListener('pointermove', wake);
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === '2' || k === '3') mode = (['scope', 'vj', 'both'] as const)[Number(k) - 1];
  else if (k === 'arrowright' || k === 'arrowleft') vj.next(performance.now(), k === 'arrowright' ? 1 : -1);
  else if (k === 'f') full();
  else if (k === 'h') ui.classList.toggle('gone');
  else if (k === ' ' || k === 'enter') { if (!ctx) void start(); }
  else return;
  store.set('mode', mode);
  showMode();
  e.preventDefault();
});
addEventListener('resize', resize);
resize();
showMode();
wake();
requestAnimationFrame(frame);
