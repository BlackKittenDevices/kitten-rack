// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-only
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFS } from '../modules';
import { FAMILIES } from './catalog';
import { ROW_H, ROW_HP, panelGeo, placeOf, fits } from './layout';
import type { Patch } from '../patch';

describe('panel geometry', () => {
  const types = ['fm1', 'output', ...FAMILIES.flatMap((f) => f.types.filter((t) => !t.soon).map((t) => t.type))];
  it.each(types)('%s fits a row, knobs above the jacks', (type) => {
    const def = DEFS[type];
    expect(def, type).toBeTruthy();
    const g = panelGeo(def);
    expect(g.hp).toBeLessThanOrEqual(ROW_HP);
    const knobBottom = Math.max(0, ...g.knobs.map((k) => k.at.y + 38));
    const jackTop = Math.min(ROW_H, ...[...g.inputs, ...g.outputs].map((j) => j.at.y - 14));
    expect(knobBottom, `${type}: knobs ${knobBottom} jacks ${jackTop}`).toBeLessThanOrEqual(jackTop);
    for (const j of [...g.inputs, ...g.outputs]) {
      expect(j.at.x).toBeGreaterThan(8);
      expect(j.at.x).toBeLessThan(g.hp * 20 - 8);
    }
  });
});

describe('the rack page', () => {
  beforeAll(async () => {
    const html = readFileSync(resolve(__dirname, '../../rack.html'), 'utf8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script'));
    (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
    (HTMLElement.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = () => {};
    await import('./main');
  });

  const current = (): Patch => JSON.parse(localStorage.getItem('kittenrack.current')!) as Patch;
  const noOverlaps = (p: Patch): void => {
    for (const m of p.modules) {
      const at = placeOf(m);
      expect(fits(p, DEFS, at.row, at.hp, panelGeo(DEFS[m.type]).hp, m.id), `${m.type} #${m.id} overlaps`).toBe(true);
    }
  };

  it('opens on the starter patch: six modules, eight cables', () => {
    expect(document.querySelectorAll('.panel').length).toBe(6);
    expect(document.querySelectorAll('#wires .wire').length).toBe(8);
    expect(document.querySelectorAll('#catalog .add').length).toBeGreaterThan(40);
  });

  it('adds a module from the catalog into a free place', () => {
    const b = [...document.querySelectorAll<HTMLButtonElement>('#catalog .add')].find((x) => x.textContent?.startsWith('LFO'))!;
    b.click();
    b.click();
    expect(document.querySelectorAll('.panel.t-lfo').length).toBe(2);
    noOverlaps(current());
  });

  it('loads every factory patch onto the grid without overlaps', () => {
    const sel = document.querySelector<HTMLSelectElement>('#presets')!;
    const files = [...sel.options].map((o) => o.value).filter(Boolean);
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      sel.value = f;
      sel.dispatchEvent(new Event('change'));
      const p = current();
      expect(p.modules.length, f).toBeGreaterThan(1);
      noOverlaps(p);
      expect(document.querySelectorAll('.panel').length, f).toBe(p.modules.filter((m) => DEFS[m.type]).length);
      expect(document.querySelectorAll('#wires .wire').length, f).toBe(p.cables.length);
    }
  });
});
