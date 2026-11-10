# Changelog

Kitten Rack's versions. Each release on GitHub has an installer, the `.fwsc` and the offline editor. The history of Matryoshka, which Kitten Rack starts from, is in [docs/CHANGELOG-matryoshka.md](docs/CHANGELOG-matryoshka.md).

## 1.4.0-rc1 — 2026-11-10 (test version)

- **Seq 960**, after Moog's 960 sequential controller: three rows of eight steps (A, B, C, 1 / 2 / 4 octaves each), a stage switch per step (PLAY / SKIP / STOP / RESET), the transport or a clock in CLK, RESET and HOLD inputs, outputs A, B, C, GATE, T1..T8 and KEYS: the notes of row A, B or C (KROW) into a voice or a Drum map without the FM-1's keys, velocity fixed or from a row (VEL). Patch format 50 (only patches that use it).

## 1.3.0 — 2026-11-01

- A button stays lit while what it opened shows (SEQ, SAVE, EDIT, HOME, FX, LFO, ENV, GLO); the keys light while held or played by the sequencer (MENU > PANEL > KEY LIGHTS turns that off).
- The repository's front page: what Kitten Rack is, screenshots, a quick guide; the full manual moved to `docs/MANUAL.md` and `docs/MANUAL.es.md`.

## 1.2.0 — 2026-11-01

- Live takes as played: QUANTIZE OFF keeps each note's timing within its step and where it was let go; fix it on SEQ (step held + ALGO) or quantize the pattern (SEQ held + OCT−).
- REC as on SLOOP: the REC window (MODE GRID / FREE, LENGTH 1/2/4 bars, START on a note or after a count-in, QUANTIZE), free takes whose tempo follows you, MENU > REC.
- A click (OFF / REC / ON, never in the USB audio), PLAY's light on the beat, undo (REC + OCT−), tap tempo (PLAY held + REC), REC held 4 s clears the pattern on any screen.

## 1.1.0 — 2026-10-30

- PRESET onto a patch with no sequence keeps the one playing, to try sounds over it.
- MIDI LEARN in the editor; the map is stored in the patch and works on the FM-1 over USB or TRS.
- The name is written Kitten Rack.

## 1.0.0 — 2026-10-29

- First full release: identity `FM-1_79100`, the ENGLISH / ESPANOL screen setting, the browser player, the big-screen visuals.

## 0.1 – 0.5 — 2026-10-29

- Test versions: the rack on the FM-1, patching on the device, the Muug filter, the factory bank, the visuals, the installer.
