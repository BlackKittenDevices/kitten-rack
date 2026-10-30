# Kitten Rack

A virtual Eurorack inside the **M-VAVE FM-1**: modules with panels, jacks and cables, where any output goes to any input. You build it, play it and save it like an instrument. Orange on black, by [Black Kitten Devices](https://github.com/BlackKittenDevices).

[Leer en español](README.es.md) · [▶ Play it in the browser](https://blackkittendevices.github.io/kitten-rack/play.html) · [Editor](https://blackkittendevices.github.io/kitten-rack/)

This document covers everything the firmware has: how to install it, how the FM-1 works with it, the sequencer, the editor on the computer, the visuals and how to record what it plays. The last part is for anyone who wants to work on the code.

**Contents**

1. [Installing and going back](#1-installing-and-going-back)
2. [The FM-1, button by button](#2-the-fm-1-button-by-button)
3. [The sequencer](#3-the-sequencer)
4. [The rack and patching on the device](#4-the-rack-and-patching-on-the-device)
5. [Saving and loading](#5-saving-and-loading)
6. [The visuals](#6-the-visuals)
7. [Recording and capturing: audio, MIDI and the screen](#7-recording-and-capturing-audio-midi-and-the-screen)
8. [The editor on the computer](#8-the-editor-on-the-computer)
9. [MIDI](#9-midi)
10. [The modules](#10-the-modules)
11. [The factory bank](#11-the-factory-bank)
12. [For developers](#12-for-developers)
13. [Credits and license](#13-credits-and-license)

---

## 1. Installing and going back

1. From [Releases](https://github.com/BlackKittenDevices/kitten-rack/releases) download `KittenRack-instalador-X.Y.Z.zip` (the newest) and unzip it.
2. You need **Python 3.8 or newer** (python.org or the Microsoft Store). Nothing else on Windows.
3. **Back up** the patches and songs of the firmware you have now (Kitten Synths: with its editor). Kitten Rack uses its own bank, so what another firmware stored may be lost.
4. Plug in the FM-1 with a USB data cable and close every program that uses MIDI (web editors, DAWs).
5. Double click **`KittenRack.pyw`**. The window has:

| Button | What it does |
| --- | --- |
| BUSCAR FM-1 (find) | Shows which firmware the FM-1 has now |
| INSTALAR Kitten Rack (install) | Uploads the firmware (one or two minutes; don't unplug until it says "Listo"). If something is cut off, press it again: the FM-1 stays waiting |
| EDITOR OFFLINE | Opens the editor from the folder in Chrome or Edge, with MIDI, while the window is open |
| EDITOR ONLINE | Opens the editor on the internet |
| OTRO FIRMWARE... (other firmware) | Installs another `.fwsc`: for example Kitten Synths to go back |
| BAJAR EDITOR OFFLINE (download) | Downloads the newest editor into the `editor/` folder |

If the window doesn't open: `python instalar_kitten_rack.py` (text mode; `--solo-info` only shows the firmware, `--paquete FILE.fwsc` installs another one).

**On the first boot** Kitten Rack writes its 33 factory patches into the bank's first slots. When you update, the factory patches you never edited are replaced by the new ones by themselves; yours are not touched. To get the whole factory bank back there is FACTORY RESET in the SYSTEM menu (hold HOME; it asks for OCT+ twice and erases your patches).

**Special start-ups** (with the FM-1 off, hold and switch on):

- **OCT- + OCT+:** update mode. The FM-1 only waits for new firmware. It is the way back if something goes wrong.
- **SAVE:** safe mode: starts with a minimal emergency patch instead of the saved one (useful if a patch keeps it from starting).

> **Golden rule:** never install firmware without Felucca's USB update. Kitten Rack, Kitten Synths, Felucca, Sloop and Matryoshka have it. M-VAVE's original can be put back with OTRO FIRMWARE.

---

## 2. The FM-1, button by button

The FM-1 plays **patches**: a patch is a whole rack (modules, cables, knob settings and sequences). The screen shows one module at a time; **K1 to K4** turn the four knobs of the page shown.

| Control | What it does |
| --- | --- |
| PRESET (knob) | The next or previous patch in the bank. On SEQ and SONG: the pattern |
| SELECT (knob) | Picks the module |
| ALGO (knob) | Picks the module's page |
| K1 to K4 | The four knobs of the page |
| SEL | Opens the RACK (the modules as Eurorack panels with their cables) |
| EDIT | Patching: cables and modules (see [4](#4-the-rack-and-patching-on-the-device)) |
| FX | Jumps between the effects |
| LFO | Jumps between the sound sources and the modulators |
| ENV | Jumps between the envelopes and the filters |
| ARP | Turns the arpeggiator on or off and shows its page (mode, rate, octaves, length) |
| SEQ | The sequencer screen |
| REC | Records (from any screen) |
| PLAY | Starts or stops. PLAY held + PRESET: the tempo |
| GLO | Opens the RACK; again, the FM-1's page: K1 MIDI channel, K2 clock in, K3 MIDI out, **K4 language (ENGLISH / ESPANOL)** |
| HOME | Back one step. On the module page with nothing behind: the oscilloscope, then the visuals, then back. Held: the menu (the manual, SYSTEM and the settings; ALGO changes tab) |
| SAVE | The save screen (see [5](#5-saving-and-loading)) |
| OCT- / OCT+ | The keyboard's octave. On SEQ: the step pages |
| Keys | Play the patch, with velocity |

**Screen language:** GLO, GLO again and **K4**: ENGLISH or ESPANOL (also in the menu: hold HOME → PANEL → LANGUAGE). It is stored at once. It changes the texts Kitten Rack writes (sequencer, rack, save, visuals, the module catalogue and its jacks); module parameters and patch names stay as they are. It comes in English from the factory.

The battery shows at the bottom right (0 to 3 bars, a bolt on USB).

The full manual, short, is inside the FM-1: **hold HOME**, in the menu.

---

## 3. The sequencer

Each patch brings its tracks (**Steps** modules) with up to **64 patterns** of up to **64 steps**. Everything is saved with the patch.

### The SEQ screen

**SEQ** opens and closes it. The top line shows the steps, rate, swing and tempo (for example `1-16 OF 16  RATE 1/16  120 BPM`).

A melodic track shows a **piano roll**:

| Control | What it does |
| --- | --- |
| ALGO | Moves the cursor along the steps |
| SELECT | Moves the note (the row) up or down |
| SEL tapped (under half a second) | Sets or clears the note at the cursor |
| SEL held | The SONG screen |
| White keys | Also set steps |
| OCT- / OCT+ | Steps 17-32, 33-48, 49-64 |
| PRESET | The pattern (1-64). Running: changes at the end of the pass; stopped: at once |
| Black keys | Pick the track |

**With no step held**, the knobs belong to the track:

| Knob | What it changes |
| --- | --- |
| K1 | Number of steps (1 to 64) |
| K2 | Rate: 1/2, 1/4, 1/8, 1/16, 1/32, 1/64 and the triplets 1/4T, 1/8T, 1/16T |
| K3 | Swing (up to 80 %) |
| K4 | Tempo |

**With a step held** (keep its key down), the knobs belong to that note:

| Knob | What it changes |
| --- | --- |
| K1 | Pitch |
| K2 | Velocity |
| K3 | **Length** (1 to 64 steps, on screen `LENGTH 3 STEPS`). The note sounds to the end of its last step |
| K4 | The chance that it plays |

Other shortcuts: FX held + white key sets an accent; LFO held + white key ties the step to the one before; SEQ held + black key mutes a track.

**Clear the pattern:** hold REC for 4 seconds (it counts `CLEAR PATTERN: 3, 2, 1`).

### Live recording (as in Kitten Synths)

**REC** works from any screen and doesn't take you to SEQ:

- **Running:** starts recording where the sequencer is.
- **Stopped:** it waits. The first note you play starts the transport and the recording together.
- **REC again:** stops recording; what you recorded keeps playing.

Recorded notes **keep how long you held them**: a note held for three steps stays three steps long and sounds whole until you let go. Length is measured in grid steps; for finer detail, raise the rate with K2 (1/32 or 1/64) before recording. You can fix any note afterwards with its step held and K3.

### Trying sounds over a sequence

Record or write a sequence, then move through patches with **PRESET** while it plays: a patch that has **no sequence of its own** takes the one that was playing (its notes, length, rate, swing and the tempo) and the screen says SEQUENCE KEPT. So you can record once and audition sounds over it, as on most synths with a sequencer. Patches that do have their own sequence keep theirs. **SAVE** stores the sequence into the new patch.

### Songs

SEL held on SEQ opens SONG: a row of patterns played one after another. SELECT picks the row, K1 its pattern (at the end: add), K2 transposes (-12 to +12), K4 to the right plays the song and to the left the pattern. ALGO picks the song (1 to 8). SEQ held + REC deletes a row (it asks for REC again within 3 seconds). SEL or HOME go back to SEQ.

---

## 4. The rack and patching on the device

**SEL** opens the RACK: the patch's modules as panels with their cables. SELECT picks, K1-K4 turn, SEL opens the panel, HOME goes back.

**EDIT** opens the PATCHING menu (EDIT again leaves, HOME goes back one step):

- **NEW CABLE:** SELECT picks the module, ALGO the output, SEL takes it. Then SELECT the other module, ALGO the input and SEL plugs it in.
- **CABLES:** the list of every cable. SEL marks one in red, SEL again pulls it.
- **ADD MODULE:** the catalogue by family. SEL puts the module at the end of the rack.
- **REMOVE MODULE:** SELECT picks the module, SEL marks it, SEL again removes it with its cables. MIDI-CV and the output can't be removed (`CANNOT REMOVE THAT`).

Each change reloads the patch, so notes that are sounding are cut. If the engine has no room (there is one delay, one reverb and one chorus), it says so and the patch stays as it was. If the editor is connected, it sees the change at once.

---

## 5. Saving and loading

**SAVE** opens the list of the bank's 64 slots:

- **SELECT** picks a slot.
- **SAVE** saves there. If another patch is there, it asks for SAVE again to overwrite it.
- **SEL** loads that slot's patch.
- **HOME** leaves.

The whole patch is saved: sound, cables and sequences. Slots 1 to 33 hold the factory patches; 34 to 64 are free.

---

## 6. The visuals

### On the FM-1

On the module page, **HOME** (with nothing behind) opens the **oscilloscope**; HOME again, the **visuals**; HOME again goes back. The knobs keep working meanwhile.

- **Oscilloscope:** the output's waveform, triggered on the zero crossing, with automatic gain.
- **Visuals:** five scenes in six shades of orange on black: a corridor, a starburst with a shock ring on every beat, three helices, a spiral and a plasma. The bass, the middle, the highs and the beats drive them. They change every 10 seconds, or on a beat after 5.

### On a big screen (projector, second screen, OBS)

The **VISUALES** page draws the same on the computer, full screen and in more detail. Open it with the editor's **VISUALES** button, or at https://blackkittendevices.github.io/kitten-rack/visuales.html.

1. Plug the FM-1 in over USB. The computer sees it as a sound card called **KittenRack**.
2. Press **EMPEZAR** (start) and allow audio access. The page finds the FM-1's input by itself; otherwise pick it in the list at the top.
3. Play: the picture follows the audio the FM-1 sends over USB.

| Control | What it does |
| --- | --- |
| OSCILOSCOPIO / VISUAL / LOS DOS (keys 1, 2, 3) | What shows. LOS DOS (both) puts the waveform over the scenes |
| ESCENA (arrows ← →) | The previous or next scene |
| AUTO | Changes by itself (every 10 s or on a beat) |
| DETALLE (detail) | How many cells across: 30 is like the FM-1, 160 is fine |
| MIDI | The FM-1's MIDI notes and clock make the picture pulse too |
| PANTALLA COMPLETA (key F) | Full screen. The bar hides after 3 seconds (H shows or hides it) |

To try it without the FM-1: `visuales.html?demo` plays a sound of its own.

**For OBS:** open the page in a window, make it full screen and add a **Window Capture** (or Display Capture) source in OBS. To send it to a VJ program (Resolume, TouchDesigner), use OBS's virtual camera or NDI.

**For anyone programming their own visuals:** every frame, the page publishes what it hears on a `BroadcastChannel` named `kitten-rack-visuales`. Any other page open in the same browser gets it like this:

```js
const c = new BroadcastChannel('kitten-rack-visuales');
c.onmessage = (e) => {
  const { bass, mid, high, beat, scene, mode, note } = e.data;
  // bass, mid, high: 0..255 · beat: true on each beat · scene: 0..4 · note: the last MIDI note
};
```

---

## 7. Recording and capturing: audio, MIDI and the screen

### The audio (the master)

Over USB the FM-1 is a **sound card**: 16-bit stereo audio at 44.1 kHz from the FM-1 to the computer. It is the final mix (the master), the same as the headphone output.

- **Windows:** it appears as the recording input **KittenRack**. In Audacity, Reaper, Ableton, OBS or any DAW, pick that input (stereo, 44,100 Hz) and record.
- **macOS and Linux:** the same, it appears as an audio input device.
- No driver needed.
- The FM-1 takes no audio in over USB: it is output only.

### MIDI

Over the same cable the FM-1 is also a **MIDI device** called KittenRack:

- Record what you play on the FM-1's keys in the DAW (with MIDI OUT on: GLO and GLO again open the FM-1's page, with the MIDI channel, clock in, MIDI out and language).
- The knobs go out as CC 16-19, SELECT / ALGO / PRESET as CC 20, 21 and 23 (relative), the volume as CC 7 and the buttons as CC 80-93. PLAY sends Start and Stop.
- The FM-1 can follow the DAW's **MIDI clock** (turned on on that same page).

### The screen

- The FM-1's screen doesn't go out over USB. To show it big, use the VISUALES page ([6](#6-the-visuals)) and capture it with OBS.

### What it doesn't do (and why)

- **Multitrack recording:** not needed. Kitten Rack is a single instrument and the stereo master is its whole sound. Should it ever be needed, the FM-1's USB has room for about 8 channels of 16 bits at 44.1 kHz.
- **USB disk** (drag-and-drop files): not worth it. Patches are backed up with the editor (EXPORTAR, AL FM-1).

---

## 8. The editor on the computer

The editor is a rack in the browser with the **same engine** as the FM-1: what sounds in one sounds the same in the other.

- **Online:** https://blackkittendevices.github.io/kitten-rack/ (Chrome or Edge, for MIDI).
- **Offline:** the installer's EDITOR OFFLINE button.

What it has:

- Rows of 42 HP. Modules move by dragging their heads.
- A click in the catalogue screws the module into the first free place.
- Cables coloured by signal: orange audio, violet pitch, green CV, bone gates, yellow keys.
- Each module has two CV inputs (CV1 and CV2) that can be assigned to any of its parameters.
- The computer keyboard (A to K, Z and X for the octave) and Web MIDI.
- The FM-1's estimated CPU for the patch.
- **ROLL** on a Steps module opens the big piano roll: a click sets or clears a note, dragging right makes it longer, Shift sets an accent.
- **GUARDAR** saves in the browser; **EXPORTAR / IMPORTAR** to and from a file.
- **VISUALES** opens the visuals page.

(The editor's labels are in Spanish.)

### Try it without an FM-1

https://blackkittendevices.github.io/kitten-rack/play.html is Kitten Rack in the browser: the real firmware's screens and controls compiled for the web, with the editor's engine making the sound. The 33 factory patches, the sequencer, the rack, the visuals and the language setting work; patching with EDIT and saving are done on the FM-1 or in the editor.

### Live with the FM-1

Press **FM-1** at the top. The editor reads the patch the FM-1 is playing and from then on everything goes both ways at once: knobs, cables, modules added or removed, piano roll notes and the patch picked with PRESET.

**AL FM-1** stores the editor's patch into a bank slot (you pick the slot and the name).

### MIDI LEARN: your controller's knobs and faders

Any MIDI controller can drive the rack's parameters, with the CCs it already sends:

1. Press **MIDI LEARN** (top bar). The knobs get a dashed ring.
2. Click a knob (a parameter: cables can't be mapped). It blinks.
3. Move the fader or knob on your controller. The knob shows a tag such as **CC 74** and now follows that control over its whole range.
4. Repeat with as many as you want (up to 32 per patch), then press **MIDI LEARN** again to finish.

Moving a control that was already assigned to another knob moves the assignment. **MAPA MIDI** lists the assignments: each one can listen on every channel (TODOS) or on one, and **SACAR** removes it. There you can also save the map with a name (for example your controller's name) and load it into another patch: it finds the same modules, in the same order.

**The map travels with the patch.** It is saved with GUARDAR, in the exported file and, with **AL FM-1**, inside the FM-1. Then the FM-1 answers your controller by itself, over USB or over its **MIDI TRS** jack, with no computer: map with the editor, store with AL FM-1, unplug both from the computer, connect the controller by TRS, and the patch already has its controls. With the editor linked (FM-1 button), the assignments go to the FM-1 as you make them.

An assigned CC belongs to its parameter: in that patch it no longer moves K1-K4 or the other controls of the list below.

To install firmware, first disconnect the editor (the FM-1 button) or close its tab: MIDI can't be used by two programs at once.

---

## 9. MIDI

The FM-1 and the editor answer any MIDI controller, over USB (and the FM-1 also over the TRS jack):

- Notes on every channel, with velocity. The channel is set on the FM-1's page (all by default).
- The sustain pedal (CC 64) holds notes.
- K1 to K4: CC 16-19, 21-24 or 70-73 (the most common knob banks).
- Mod wheel, pitch bend and aftertouch reach the MIDI-CV module's outputs.
- CC 120 and 123 stop everything.
- MIDI clock and program change are turned on on the FM-1's page.
- Any other CC can be assigned to a parameter with [MIDI LEARN](#midi-learn-your-controllers-knobs-and-faders), and the assignment is saved in the patch.

---

## 10. The modules

Over 50 modules by family. All of them work in the editor and on the FM-1.

| Family | Modules |
| --- | --- |
| Sources | VCO, VCO WT (wavetable), VCO CZ (phase distortion), Noise, String (Karplus), Resonator (modal) |
| Generative | Turing, Marbles, Euclidean, Bernoulli, Chaos (Lorenz), Random, S&H, Seq 8, Steps (the sequencer), Arpeggiator |
| Filters | VCF Muug (a Minimoog ladder that self-oscillates), LPG (Buchla style), VCF Ladder, VCF Multi, Formant, Comb, Wavefolder |
| VCA and mix | VCA, Ring mod, Mix 4, Xfade, Pan, Selector, Compressor |
| Modulators | Function (Maths style), ADSR, Env L/R, Env 8, Env DX, LFO, Slew, Pulse, Macro |
| Logic and utilities | Clock/Div, Quantizer, Math, Logic, Offset, Attenuverter, Ratio, Drum map, Scope |
| Effects | Delay (with a TAPE mode: wow, flutter and saturation), Reverb (with a SPRING mode), Chorus, Phaser, Bitcrush, Granular, Freq shift |

In every patch: **MIDI-CV** (the keyboard and MIDI: pitch, gate, velocity, bend, mod, aftertouch) and **OUT** (the output).

FM-1 limits: one delay, one reverb and one chorus per patch, and a CPU ceiling the editor estimates (the CPU bar at the top).

---

## 11. The factory bank

33 patches of our own, built from scratch (`web/scripts/rack-factory.ts`). They are the same in the editor (**Fábrica…**) and in the FM-1's first 33 slots. Their names stay as they are in either language.

| | Keys (the modulars of the 60s) | | Play by themselves (generative) | | Drones and noise |
| --- | --- | --- | --- | --- | --- |
| 01 | INIT (with tape echo) | 12 | BONK WEST COAST | 25 | LORENZ DRONE |
| 02 | MUUG TAPE | 13 | COMPUTADORA S&H | 26 | DRONE MUUG |
| 03 | MUUG BAJO | 14 | BERLIN SEQ | 27 | NIEBLA GRANULAR |
| 04 | LEAD 1969 | 15 | PERCUSION MOD | 28 | SHIFT ESPACIAL |
| 05 | BRONCES 1971 | 16 | TURING MAQUINA | 29 | MAREA DE RUIDO |
| 06 | THEREMIN | 17 | EUCLIDES | 30 | MAQUINA RUIDO |
| 07 | CAMPANAS RING | 18 | MARBLES PLUCK | 31 | FEEDBACK COMB |
| 08 | BUCHLA TIMBRE | 19 | CAOS MELODICO | 32 | BITCRUSH RADIO |
| 09 | FM CHOWNING | 20 | GOTAS RESONADOR | 33 | CUERDA INFINITA |
| 10 | VOCES FORMANTE | 21 | CUERDAS AZAR | | |
| 11 | SYNC LEAD | 22 | ARPEGIO MARBLES | | |
| | | 23 | POLIRRITMO | | |
| | | 24 | ENJAMBRE LFO | | |

The generative ones start by themselves (they have their own clock) and in almost all of them a key transposes.

---

## 12. For developers

Kitten Rack is a fork of [Matryoshka](https://github.com/glvno/matryoshka) 1.5.1. Much of the code and its comments still use Matryoshka's names; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains its design (formats, engine, protocol) and still holds.

### Where things are

| Folder | What is there |
| --- | --- |
| `firmware/src/` | The firmware in C. `engine.c` the engine (fixed point), `panel.c` the buttons and screens, `seq_ui.c` the sequencer, `rack_ui.c` the rack and patching, `save_ui.c` saving, `viz_ui.c` the visuals, `manual.c` the on-screen manual, `proto.c` the editor protocol, `usb.c` USB audio and MIDI |
| `firmware/wasm/` | The firmware's UI as WebAssembly (`play.html`) |
| `firmware/test/` | Firmware tests on the computer |
| `web/rack.html`, `web/src/rack/` | The rack editor |
| `web/play.html`, `web/src/play/` | The browser player |
| `web/visuales.html`, `web/src/visuals/` | The visuals page |
| `web/src/modules.ts`, `engine.ts` | The reference engine (the FM-1 must sound the same) |
| `web/scripts/rack-factory.ts` | The factory bank |
| `web/scripts/golden.ts` | The kits that compare the two engines sample by sample |
| `tools/` | Installer (`KittenRack.pyw`, `instalar_kitten_rack.py`, `fm1_install.py`), tests, emulator (`tools/emu`) |
| `web/index.html`, the rest of `web/src/` | Matryoshka's original app: kept because the rack editor and the tests use its engine, its format and its protocol |

### Tests

```
cd web && npm ci
npm run fm1-wasm         # the firmware UI as WebAssembly (needs clang + lld)
npx vitest run           # every web test
npx tsc --noEmit -p .    # types
cd ..
tools/golden.sh          # the two engines, sample by sample
tools/panel_test.sh      # the FM-1's buttons and screens
tools/bank_test.sh       # the factory bank
tools/patch_edit_test.sh # adding modules from the device
tools/patch_del_test.sh  # removing modules from the device
tools/preset_test.sh
tools/usb_test.sh        # USB audio and MIDI descriptors
```

To run the editor: `cd web && npm run dev` and open `http://localhost:5173/rack.html` (or `/play.html`, `/visuales.html`).

### Building and publishing

- JieLi's compiler only runs on Linux x86-64: the firmware is built in GitHub Actions.
- `firmware.yml` builds and tests every change.
- `kitten-dev.yml` makes a test build (the "dev" pre-release) with the RAM use.
- `kitten-release.yml` (started by hand with the version number) makes the `.fwsc`, the installer zip and the offline editor, and creates the release.
- `rack-pages.yml` publishes the editor, the player and the visuals on GitHub Pages with every change.

Before installing anything on an FM-1: **never firmware without Felucca's USB update**.

### The Firmware Hub

- `fmhub.json` (at the root) gives the card's text, its category (`synth`), the ▶ key (`play.html`) and the editor key.
- Identity: from 1.0 each release reports `FM-1_79XYZ` with its version inside (1.0.0 = `FM-1_79100`); 0.2 to 0.5 were `FM-1_792` to `FM-1_795`. The update loader is Felucca's.
- USB: MIDI and a UAC1 audio input (16-bit stereo, 44.1 kHz), the same USB the firmware it comes from had; no keyboard or mouse.
- **VST:** the Hub's VIBE FM converter (still "soon") builds a plugin from an open firmware's source. Kitten Rack is ready for it: GPL-3.0, its engine is fixed-point C with no hardware inside (`firmware/src/engine.c`), and its UI already compiles to WebAssembly (`firmware/wasm/fm1_ui.c`, the one `play.html` uses).

### The patch format

Format 49 (Matryoshka's 48 plus Kitten Rack's modules). A sequence note is a 32-bit word: step (6 bits), length - 1 (6), note (7), velocity (7), chance (5), and bit 31, which marks a note that sounds whole to the end of its last step (recorded notes and those lengthened with K3). A patch can end with a MIDI map (flag 8 of byte 7): a count, then 4 bytes per entry: CC, channel (0 = the FM-1's), module index, parameter index. Older firmware refuses such a patch rather than misreading it.

---

## 13. Credits and license

Kitten Rack starts from [Matryoshka](https://github.com/glvno/matryoshka) by michael glaviano (1.5.1, commit `ec7d934`), which comes from [Modular-1](https://github.com/WiggisModular/Modular-1) by WiggisModular and uses the hardware layer and the installer of [Felucca](https://github.com/hugelton/Felucca) by Leo Kuroshita / Hügelton Instruments.

All the code is **GPL-3.0-only**: see [LICENSE](LICENSE) and [LICENSING.md](LICENSING.md).
