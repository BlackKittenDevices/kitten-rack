// SPDX-License-Identifier: GPL-3.0-only
// The rack editor's catalog: Eurorack names, families and which ports a panel shows.

export interface Family {
  name: string;
  types: { type: string; label: string; soon?: boolean }[];
}

/** the modules a person can add, by family (the fixed MIDI-CV and OUT are not here) */
export const FAMILIES: Family[] = [
  {
    name: 'Fuentes',
    types: [
      { type: 'osc', label: 'VCO' },
      { type: 'wavetable', label: 'VCO WT' },
      { type: 'pd', label: 'VCO CZ' },
      { type: 'noise', label: 'Ruido' },
      { type: 'string', label: 'Cuerda' },
      { type: 'modal', label: 'Resonador' },
    ],
  },
  {
    name: 'Generativos',
    types: [
      { type: 'turing', label: 'Turing' },
      { type: 'marbles', label: 'Marbles' },
      { type: 'euclid', label: 'Euclídeo' },
      { type: 'bern', label: 'Bernoulli' },
      { type: 'chaos', label: 'Caos' },
      { type: 'random', label: 'Random' },
      { type: 'sh', label: 'S&H' },
      { type: 'seq', label: 'Seq 8' },
      { type: 'steps', label: 'Steps' },
      { type: 'arp', label: 'Arpegiador' },
    ],
  },
  {
    name: 'Filtros',
    types: [
      { type: 'muug', label: 'VCF Muug' },
      { type: 'lpg', label: 'LPG' },
      { type: 'ladder', label: 'VCF Ladder' },
      { type: 'filter', label: 'VCF Multi' },
      { type: 'vowel', label: 'Formante' },
      { type: 'comb', label: 'Comb' },
      { type: 'shape', label: 'Wavefolder' },
    ],
  },
  {
    name: 'VCA y mezcla',
    types: [
      { type: 'vca', label: 'VCA' },
      { type: 'ring', label: 'Ring mod' },
      { type: 'mixer', label: 'Mix 4' },
      { type: 'xfade', label: 'Xfade' },
      { type: 'pan', label: 'Pan' },
      { type: 'select', label: 'Selector' },
      { type: 'dyn', label: 'Compresor' },
    ],
  },
  {
    name: 'Moduladores',
    types: [
      { type: 'func', label: 'Función' },
      { type: 'adsr', label: 'ADSR' },
      { type: 'env', label: 'Env L/R' },
      { type: 'env8', label: 'Env 8' },
      { type: 'rateenv', label: 'Env DX' },
      { type: 'lfo', label: 'LFO' },
      { type: 'glide', label: 'Slew' },
      { type: 'pulse', label: 'Pulso' },
      { type: 'macro', label: 'Macro' },
    ],
  },
  {
    name: 'Lógica y utilidades',
    types: [
      { type: 'clkdiv', label: 'Reloj/Div' },
      { type: 'quant', label: 'Cuantizador' },
      { type: 'math', label: 'Mate' },
      { type: 'logic', label: 'Lógica' },
      { type: 'const', label: 'Offset' },
      { type: 'scale', label: 'Atenuversor' },
      { type: 'ratio', label: 'Ratio' },
      { type: 'drummap', label: 'Drum map' },
      { type: 'scope', label: 'Scope' },
    ],
  },
  {
    name: 'Efectos',
    types: [
      { type: 'delay', label: 'Delay' },
      { type: 'reverb', label: 'Reverb' },
      { type: 'chorus', label: 'Chorus' },
      { type: 'phaser', label: 'Phaser' },
      { type: 'crush', label: 'Bitcrush' },
      { type: 'grain', label: 'Granular' },
      { type: 'shift', label: 'Freq shift' },
    ],
  },
];

const LABELS: Record<string, string> = { fm1: 'MIDI-CV', output: 'OUT', alloc: 'Voces', part: 'Parte', esp: 'Seguidor' };
for (const f of FAMILIES) for (const t of f.types) LABELS[t.type] = t.label;

export const labelOf = (type: string): string => LABELS[type] ?? type.toUpperCase();

/** the Main module's outputs a MIDI-CV panel shows (the FM-1's button gates stay off the panel) */
export const MAIN_OUTPUTS = ['pitch', 'gate', 'vel', 'clock', 'run', 'bend', 'mod', 'at', 'keys'];

/** short names for the jacks and knobs, in the Eurorack habit */
const PORT_NAMES: Record<string, string> = {
  pitch: 'V/OCT', gate: 'GATE', vel: 'VEL', clock: 'CLK', clk: 'CLK', run: 'RUN', bend: 'BEND', mod: 'MOD', at: 'AFT',
  keys: 'KEYS', p1: 'CV1', p2: 'CV2', out: 'OUT', in: 'IN', cv: 'CV', pm: 'FM', sync: 'SYNC', env: 'ENV', reset: 'RST',
  trig: 'TRIG', lp24: 'LP24', lp12: 'LP12', bp: 'BP', hp: 'HP', mix: 'MIX', notch: 'NOTCH', peak: 'PEAK', ap: 'AP',
  hp6: 'HP6', morph: 'MORPH', l: 'L', r: 'R', held: 'HELD', pulse: 'PULSO', shape: 'FORMA', hold: 'HOLD', exc: 'EXC',
  transpose: 'TRANSP', pos: 'POS', side: 'SIDE', vowel: 'VOCAL', dcw: 'DCW', fm: 'FM', amp: 'AMP', up: 'ARRIBA',
  down: 'ABAJO', rate: 'RATE', a: 'A', b: 'B', strike: 'GOLPE', inv: 'INV', eor: 'EOR', eoc: 'EOC', off: 'OFF',
  cv1: 'CV1', x: 'X', y: 'Y', z: 'Z',
};
export const portLabel = (name: string): string => PORT_NAMES[name] ?? name.toUpperCase();

const PARAM_NAMES: Record<string, string> = {
  cutoff: 'CORTE', res: 'RESO', level: 'NIVEL', coarse: 'AFIN', fine: 'FINO', wave: 'FORMA', rate: 'VEL', depth: 'PROF',
  decay: 'CAÍDA', damp: 'AMORT', gain: 'GAN', drive: 'DRIVE', mix: 'MEZCLA', time: 'TIEMPO', fb: 'REALIM', size: 'TAMAÑO',
  tempo: 'TEMPO', morph: 'MORPH', track: 'TRACK', cvamt: 'CV AMT', a: 'ATK', d: 'DEC', s: 'SUS', r: 'REL', value: 'VALOR',
  rise: 'SUBIDA', fall: 'BAJADA', shape: 'CURVA', cycle: 'CICLO', offset: 'OFFSET', mode: 'MODO', length: 'LARGO',
  change: 'CAMBIO', range: 'RANGO', scale: 'ESCALA', root: 'TÓNICA', steps: 'PASOS', pulses: 'GOLPES', rotate: 'ROTAR',
  spread: 'DISPERS', dejavu: 'DEJA VU', density: 'DENSID', prob: 'PROB', speed: 'VELOC', rho: 'RHO', emph: 'ÉNFASIS',
  tape: 'CINTA', spring: 'RESORTE', freeze: 'CONGELAR', swell: 'SWELL', pingpong: 'PING-PONG',
};
export const paramLabel = (name: string): string => PARAM_NAMES[name] ?? name.toUpperCase();

/** the hand-picked width of a few modules (the rest is worked out from their knobs and jacks) */
export const HP_MIN: Record<string, number> = { fm1: 10, output: 4, vca: 4, noise: 4, const: 4, macro: 4 };

/** cable colours by what they carry */
export function cableColor(kind: string, port: string): string {
  if (kind === 'keys') return 'var(--c-keys)';
  if (kind === 'gate') return 'var(--c-gate)';
  if (kind === 'audio') return 'var(--c-audio)';
  if (port === 'pitch' || port === 'transpose') return 'var(--c-pitch)';
  return 'var(--c-cv)';
}
