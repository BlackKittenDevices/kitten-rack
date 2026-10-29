// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: the FM-1's QUITAR MODULO (firmware/src/patch_edit.h pe_module_del) against the editor's removeModule: every
// binary tools/patch_del_test.sh wrote (DIR/PP-MM.bin: patch PP of presets.h, module MM out) read back (devicebin.ts) is
// the factory patch read back with that module removed: the same modules in the same order, the same cables, the same
// parameters and notes.   npx vite-node scripts/patch-del-check.ts DIR
import { readFileSync, readdirSync } from 'node:fs';
import { DEFS } from '../src/modules';
import { removeModule, validatePatch, type Patch } from '../src/patch';
import { encodePatch } from '../src/patchbin';
import { forDevice } from '../src/rack/layout';
import { decodeDevicePatch } from '../src/rack/devicebin';

const dir = process.argv[2];
const files = readdirSync(new URL('../src/rack/factory/', import.meta.url)).filter((f) => f.endsWith('.json')).sort();
const bank = files.map((f) => validatePatch(JSON.parse(readFileSync(new URL(`../src/rack/factory/${f}`, import.meta.url), 'utf8')), DEFS) as Patch);
const shape = (p: Patch): string => {
  const idx = new Map(p.modules.map((m, i) => [m.id, i]));
  const mods = p.modules.map((m) => `${m.type}${m.bypass ? '*' : ''}:${Object.entries(m.params).map(([k, v]) => `${k}=${Math.round(v * 1000)}`).join(',')}:${JSON.stringify(m.notes ?? [])}`);
  const cab = p.cables.map((c) => `${idx.get(c.from.module)}.${c.from.port}>${idx.get(c.to.module)}.${c.to.port}`).sort();
  return JSON.stringify({ mods, cab });
};
let fails = 0, n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.bin')).sort()) {
  const [pp, mm] = f.replace('.bin', '').split('-').map(Number);
  const orig = decodeDevicePatch(encodePatch(forDevice(bank[pp])), 'x');
  const gone = orig.modules[mm];
  const want = structuredClone(orig);
  if (gone.type === 'arp') {   // (a group played by it: from the track that played it, pe_module_del)
    const from = want.cables.find((c) => c.to.module === gone.id && c.to.port === 'keys')?.from;
    for (const c of want.cables) if (c.from.module === gone.id && c.from.port === 'keys' && from) c.from = { ...from };
  }
  removeModule(want, gone.id);
  const got = decodeDevicePatch(new Uint8Array(readFileSync(`${dir}/${f}`)), 'x');
  n++;
  if (shape(got) !== shape(want)) {
    fails++;
    if (fails < 6) console.log(`FAIL ${f} (${bank[pp].name} - ${gone.type})\n  got  ${shape(got)}\n  want ${shape(want)}`);
  }
}
console.log(`${n} deletes compared, ${fails ? `${fails} FAILED` : 'all as the editor'}`);
process.exitCode = fails ? 1 : 0;
