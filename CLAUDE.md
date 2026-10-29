# KITTEN RACK — notes for Claude

A Eurorack-style modular firmware for the **M-VAVE FM-1**, a fork of Matryoshka 1.5.1 (glvno/matryoshka). Repo: BlackKittenDevices/kitten-rack. User-facing docs: `README.md` (English) and `README.es.md` (Spanish, rioplatense); keep both in step with what the device does. Design of the inherited parts (formats, engine, protocol): `docs/ARCHITECTURE.md` (written for Matryoshka; its ledger links point at files that were removed).

## The owner

- Not a programmer, works on Windows, cannot run GitHub steps: Claude commits, pushes to `main` and runs releases.
- Look: orange on black. The device screen has ENGLISH / ESPANOL (GLO K4, `LG(en, es)` in ui.c, English default): every new KITTEN RACK text needs both. Docs: README.md English, README.es.md Spanish (keep both in step); the editor is Spanish; the LCD manual (`firmware/src/manual.c`) stays in English capitals, ≤ 35 chars a line, no `;`.
- Backs up before installing. **Never ship firmware without Felucca's USB update (OTA) path**: it is the way back.

## Layout

- `firmware/src/`: `engine.c` (fixed point) ↔ `web/src/modules.ts` / `engine.ts` (reference): keep both in step, add a golden kit (`web/scripts/golden.ts`) per new behaviour. Device UI: `panel.c`, `seq_ui.c`, `rack_ui.c`, `save_ui.c`, `viz_ui.c`, `manual.c`. Patch edits from the device: `patch_edit.h`, `patch_check.h`.
- `web/rack.html` + `web/src/rack/`: the rack editor (live link with the FM-1). `web/play.html` + `web/src/play/`: the browser player (the firmware UI as wasm, `npm run fm1-wasm`, + the engine), The Firmware Hub's play key (`fmhub.json`). `web/visuales.html` + `web/src/visuals/`: the big-screen visuals (FM-1 USB audio in, BroadcastChannel `kitten-rack-visuales` out). The rest of `web/` is Matryoshka's app; kept because the engine, formats, protocol and tests live there.
- Factory bank: `web/scripts/rack-factory.ts` (33 patches). Patch format 49. Note word: at(6) len-1(6) note(7) vel(7) chance(5), bit 31 = hold the last step whole (`NW_HOLD`).

## Checks before pushing

`cd web && npx vitest run && npx tsc --noEmit -p .`, then `tools/golden.sh`, `tools/panel_test.sh`, `tools/bank_test.sh`, `tools/patch_edit_test.sh`, `tools/patch_del_test.sh`, `tools/preset_test.sh`, `tools/usb_test.sh`. The emulator: `tools/emu/target/release/m1emu` (see docs/EMULATOR.md); `web/scripts/rack-link-e2e.mjs` drives the editor against it.

## CI and releases

- `firmware.yml` builds and tests (the JieLi toolchain runs only in CI). `kitten-dev.yml`: a dev pre-release with RAM / pool headroom in `dev-build.log` (needs RAM ≥ 4096 B and pool ≥ 8192 B free). `rack-pages.yml`: the editor + visuals on GitHub Pages. `web.yml`: web tests.
- A release: `gh api -X POST repos/BlackKittenDevices/kitten-rack/actions/workflows/kitten-release.yml/dispatches -f ref=main -f 'inputs[tag]=vX.Y.Z'` (the proxy blocks pushing tags). Identity: 0.Y = `FM-1_79Y`, from 1.0 `FM-1_79XYZ` (tools/build.py). 0.x and -suffix tags are pre-releases; `kitten-release-edit.yml` changes a release's title / notes / pre-release mark (the session cannot edit releases). Release assets download with `gh api -H "Accept: application/octet-stream" repos/BlackKittenDevices/kitten-rack/releases/assets/ID`.

## Gotchas

- `tools/build.py` rejects immediates between 0xFFC00000 and 0xFFD00000. RAM is tight: big buffers go in `ENG_POOL`.
- C argument evaluation order is unspecified: never read a value in one argument that another argument's call changes.
- `lcd_blit` takes big-endian pixels; `lcd_sync()` before reusing a buffer.
- Never `git checkout <file>` with uncommitted work. `pkill -f` matches the shell itself.
