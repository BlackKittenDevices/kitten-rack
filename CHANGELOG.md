# Changelog

Kitten Rack's versions. Each release on GitHub has an installer, the `.fwsc` and the offline editor. The history of Matryoshka, which Kitten Rack starts from, is in [docs/CHANGELOG-matryoshka.md](docs/CHANGELOG-matryoshka.md).

## 1.5.0-rc3 — 2026-11-15 (test version)

- **A new look for the screen** (the owner's mocks): the module page is a panel with **four knobs** (scale, pointer, the knob's colour on its tab) and, on top, the knob turned last, large; **envelopes draw their curve**, each stage in the colour of the knob that sets it, the knobs named after what they move. GLO and the sandbox page the same; the **menu** and the **SONG** page on the same faceplate (LEDs, value windows, key caps).
- **Visuals:** MENU → PANEL → **VISUAL** (AUTO or one scene kept) and **VISUAL SCOPE** (the oscilloscope over the scenes).

## 1.5.0-rc2 — 2026-11-15 (test version)

- **VCO Chord**, a recreation of VCO Chord 2.0 (Black Kitten Devices, after HAGIWO's chord VCO): five oscillators, seven chords, sixteen inversions, seven waves, detune, a built-in arpeggiator (up, down, up-down, random; on CLK or PLAY; octave range, mutation, structure) and an 8-bit mode with the Arduino's sound. Its pitch follows the keys (a voice's V/OCT) and any CV, such as a Seq 960 row. Patch format 52, only for patches that use it.
- Example patch `docs/patches/vco-chord.json`.

## 1.5.0-rc1 — 2026-11-15 (test version)

- **Seq 960: 16 steps and ratchets**, as Graham Hanks suggested: **CHAIN** (8 / 16 A+B) chains rows A and B into one row of 16 steps on output A, KEYS and VEL (row C keeps its eight, for the filter); **R1..R8** play each step 1 to 4 times. Patch format 51, only for patches that use them (a patch without them is still written as 50 and opens in 1.4.0).
- A new example patch, `docs/patches/960-16-pasos.json`.

## 1.4.0 — 2026-11-10

(Tested on the FM-1 as 1.4.0-rc1.)

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
