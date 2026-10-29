// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: the FM-1's visualizers (firmware/src/viz_ui.c) for a big screen: the same oscilloscope and the same five VJ
// scenes (corridor, starburst, helices, spiral, plasma) in the same six shades of orange, on a grid of any size. The
// firmware's grid is 30 x 27 cells; here the distances and angles are measured in those cells too, so a finer grid draws
// the same picture with more detail. Pure code (no DOM): main.ts feeds it audio and paints the cells.

export const PALETTE = ['#000000', '#290c00', '#5a2000', '#ac4400', '#ff7a1a', '#ffca55'];
export const SCENES = ['PASILLO', 'ESTALLIDO', 'HÉLICES', 'ESPIRAL', 'PLASMA'];
const SIN = Array.from({ length: 64 }, (_, k) => Math.round(127 * Math.sin((2 * Math.PI * k) / 64)));
const BAND = [0, 1, 2, 3, 4, 5, 3, 1];

export interface Bands { bass: number; mid: number; high: number; beat: boolean }

/** the bass, the middle and the highs of a block of samples (-1..1), each 0..255 of what it reached lately, and a beat */
export class Listener {
  private max = [2000, 2000, 2000];
  private avg = 64;
  private lastBeat = -1e9;
  bass = 0;
  mid = 0;
  high = 0;
  /** samples at about 22 kHz (the firmware's tap rate): pass the analyser's block with `stride` 2 at 44.1 / 48 kHz */
  listen(x: Float32Array, now: number, stride = 2): Bands {
    let lp = 0, prev = 0, lo = 0, all = 0, hi = 0, n = 0;
    for (let i = 0; i < x.length; i += stride, n++) {
      const v = x[i] * 32767;
      lp += (v - lp) / 16;
      all += Math.abs(v);
      lo += Math.abs(lp);
      hi += Math.abs(v - prev);
      prev = v;
    }
    n = Math.max(1, n);
    const f = [lo / n, Math.max(0, all - lo) / n, hi / n];
    for (let k = 0; k < 3; k++) {
      this.max[k] = f[k] > this.max[k] ? f[k] : this.max[k] - this.max[k] / 64;
      if (this.max[k] < 300) this.max[k] = 300;
      f[k] = Math.min(255, (f[k] * 255) / this.max[k]);
    }
    [this.bass, this.mid, this.high] = f;
    let beat = false;
    if (this.bass > this.avg + 60 && now - this.lastBeat > 180) {
      this.lastBeat = now;
      beat = true;
    }
    this.avg = (this.avg * 15 + this.bass) / 16;
    return { bass: this.bass, mid: this.mid, high: this.high, beat };
  }
}

/** the VJ screen: a grid of w x h cells, each a shade 0..5 */
export class Vj {
  readonly w: number;
  readonly h: number;
  private r: Uint16Array;
  private c: Uint16Array;
  private a: Uint8Array;
  private hx: Int32Array;   // the helices' column per cell (x in firmware cells)
  private fx: Float32Array;
  private fy: Float32Array;
  t = 0;
  scene = 0;
  auto = true;
  private since = 0;
  pulse = 0;
  ring = 0;
  bass = 0;
  mid = 0;
  high = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.r = new Uint16Array(n);
    this.c = new Uint16Array(n);
    this.a = new Uint8Array(n);
    this.hx = new Int32Array(n);
    this.fx = new Float32Array(n);
    this.fy = new Float32Array(n);
    // one cell here is s firmware cells; the middle where the firmware's is (14.5, 13 of 30 x 27, scaled to this shape)
    const s = 30 / w;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const fx = (x + 0.5) * s - 0.5, fy = (y + 0.5) * s - 0.5;
        const dx = fx - 14.5, dy = fy - (h * s - 1) / 2;
        this.fx[i] = fx;
        this.fy[i] = fy;
        this.r[i] = Math.round(8 * Math.hypot(dx, dy));
        this.c[i] = Math.floor(8 * Math.max(Math.abs(dx), Math.abs(dy)));
        this.a[i] = ((Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * 64) % 64) + 64) % 64;
        this.hx[i] = Math.round(fx);
      }
  }

  /** one frame (the firmware draws one every 45 ms: call this at that pace, `now` in ms) */
  step(b: Bands, now: number): void {
    this.bass = b.bass;
    this.mid = b.mid;
    this.high = b.high;
    if (b.beat) {
      this.pulse = 255;
      this.ring = 0;
      if (this.auto && now - this.since > 5000) this.next(now);
    }
    this.t++;
    this.pulse = Math.max(0, this.pulse - 24);
    this.ring += 12;
    if (this.auto && now - this.since > 10000) this.next(now);
  }

  next(now: number, by = 1): void {
    this.scene = (this.scene + by + SCENES.length) % SCENES.length;
    this.since = now;
  }

  /** cell i's shade, 0..5 */
  cell(i: number): number {
    const r = this.r[i], a = this.a[i], t = this.t;
    switch (this.scene) {
      case 0: {
        const c = this.c[i], z = (c + 256 - ((t * 3) & 255)) & 31;
        if (c < 10) return this.pulse > 128 ? 3 : 0;
        if (z < 5) return this.bass > 150 ? 5 : 4;
        if (z < 8) return 2;
        if (((a + (t >> 2)) & 7) === 0 && z < 14) return this.high > 120 ? 5 : 3;
        return c > 100 ? 1 : 0;
      }
      case 1: {
        const k = (a * 4 + (t >> 1)) & 15, len = 40 + this.bass / 2, wid = 3 + this.mid / 48;
        if (r < 10 + this.bass / 12) return 5;
        if (this.pulse && Math.abs(r - this.ring) < 6) return 5;
        if (k < wid && r < len) return r < len / 2 ? 5 : 4;
        if (k < wid + 2 && r < len + 20) return 2;
        if ((i * 37 + t * 5) % 61 === 0 && this.high > 90) return 3;
        return r > 140 && ((a + t) & 15) === 0 ? 1 : 0;
      }
      case 2: {
        const x = this.fx[i], y = Math.round(this.fy[i]);
        const col = x < 9.5 ? 0 : x < 19.5 ? 1 : 2, xc = 5 + 10 * col, ph = (y * 3 + t + col * 21) & 63;
        const amp = 2 + Math.floor(this.mid / 64);
        const off = (SIN[ph] * amp) / 127, back = (SIN[(ph + 32) & 63] * amp) / 127;
        const dx = x - xc, depth = SIN[(ph + 16) & 63], half = 15 / this.w;   // (a strand is one firmware cell wide)
        if (Math.abs(dx - off) <= 0.5 + half) return depth > 0 ? 5 : 3;
        if (Math.abs(dx - back) <= 0.5 + half) return depth > 0 ? 2 : 4;
        if ((((y + (t >> 1)) % 3) + 3) % 3 === 0 && ((dx > off && dx < back) || (dx < off && dx > back))) return this.bass > 160 ? 3 : 1;
        return 0;
      }
      case 3: {
        const k = (a + Math.floor(r / 4) + 256 - ((t * 2) & 255)) & 63, wid = 6 + this.bass / 32;
        if (r < 6) return this.pulse > 100 ? 5 : 3;
        if ((k & 15) < wid / 2) return r < 60 ? 5 : r < 110 ? 4 : 3;
        if ((k & 15) < wid / 2 + 2) return 2;
        return this.pulse > 160 && r > 150 ? 1 : 0;
      }
      default: {
        const s = 30 / this.w;
        const dx = Math.round(Math.abs(this.fx[i] * 2 - 29)), dy = Math.round(Math.abs(this.fy[i] * 2 - (this.h * s - 1)));
        const v = SIN[(dx * 3 + t) & 63] + SIN[(((dy * 4 - t) % 64) + 64) & 63] + SIN[(Math.floor(r / 3) + t * 2) & 63] + this.bass;
        return BAND[(Math.floor((v + 400) / 48) + (t >> 3)) & 7];
      }
    }
  }
}

/** the oscilloscope's trace: from the first rising zero crossing, `n` samples, scaled to about 0.75 of the half height */
export class Scope {
  gain = 1;
  trace(x: Float32Array, n: number): Float32Array {
    let start = 0;
    for (let i = 1; i < Math.min(x.length - n, x.length / 2); i++)
      if (x[i - 1] < 0 && x[i] >= 0) {
        start = i;
        break;
      }
    let peak = 0;
    for (let i = start; i < start + n && i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    const want = Math.min(16, 0.75 / Math.max(peak, 0.02));
    this.gain = (this.gain * 7 + want) / 8;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, (x[start + i] ?? 0) * this.gain));
    return out;
  }
}
