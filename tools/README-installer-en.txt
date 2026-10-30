Kitten Rack - installer for the M-VAVE FM-1
===========================================

What is in this folder
  KittenRack.pyw            THE INSTALLER WINDOW: double click it
  editor/                   the rack editor, to use offline (the installer opens it)
  instalar_kitten_rack.py   the same installer in text mode (if the window doesn't open)
  fm1_install.py            Felucca's install method, used by both
  kitten-rack-*.fwsc        the firmware
  SHA256SUMS                fingerprints to check the file arrived whole
  LEEME.txt                 this text in Spanish

Before installing
  1. You need Python 3.8 or newer (python.org or the Microsoft Store).
     On Windows nothing else is needed: it uses the system's MIDI.
  2. Back up the patches and songs of the firmware you have now (Kitten Synths: with its editor).
     Kitten Rack uses its own patch bank and the previous one may be lost.
  3. Plug the FM-1 in with a data USB cable and close every program that uses MIDI
     (web editors, DAWs, the Kitten Synths editor).

The installer window (its buttons are in Spanish)
  BUSCAR FM-1            shows which firmware the FM-1 has now
  INSTALAR Kitten Rack   uploads the firmware (one or two minutes; don't unplug until it says "Listo").
                         If something is cut off, press it again: the FM-1 stays waiting and finishes.
  EDITOR OFFLINE         opens the editor from this folder in your browser (Chrome or Edge), with MIDI.
                         It works while the installer window is open.
  EDITOR ONLINE          opens the editor on the internet (https://blackkittendevices.github.io/kitten-rack/)
  OTRO FIRMWARE...       installs another .fwsc, for example Kitten Synths to go back
  BAJAR EDITOR OFFLINE   downloads the newest editor into the editor/ folder

  The editor and the installer can't use MIDI at the same time: to install, close the editor's tab.

Then, on the FM-1
  On the first boot Kitten Rack writes its 33 factory patches. When you update, the factory patches
  you never edited are replaced by the new ones (yours are not touched).
  LANGUAGE GLO, GLO again, K4: ENGLISH or ESPANOL (stored at once; it comes in English)
  SEL      the RACK (the patch's modules)
  EDIT     patching: NEW CABLE, CABLES (pull one), ADD MODULE, REMOVE MODULE (SELECT picks,
           SEL twice removes it with its cables). EDIT again leaves
  FX       jumps between the effects
  LFO      jumps between the sound sources and the modulators
  ENV      jumps between the envelopes and the filters
  ARP      turns the arpeggiator on / off and shows its page (mode, rate, octaves, length)
  SEQ      the sequencer screen (piano roll): SELECT picks the note, ALGO the step, SEL tapped
           sets or clears the note there (SEL held: songs), the white keys set steps too,
           OCT- / OCT+ the pages (up to 64 steps). No step held: K1 steps, K2 rate, K3 swing,
           K4 tempo. With a step held: K1 pitch, K2 velocity, K3 note length, K4 chance.
           REC held 4 seconds clears the pattern
  REC      records from any screen: running, it records where it is; stopped, it waits for the first
           note and starts by itself. REC again stops recording (it keeps playing). Notes keep the length
           you held them (in steps: for more detail raise the rate with K2 before recording)
  HOME     on the module page: the oscilloscope, again: the visuals, again: back
  SAVE     pick a slot with SELECT: SAVE saves there (if another patch is there, SAVE again overwrites it),
           SEL loads the one there, HOME leaves. The whole patch is saved: sound and sequences.

Visuals on a big screen (projector, OBS)
  In the editor, the VISUALES button (or https://blackkittendevices.github.io/kitten-rack/visuales.html).
  The computer sees the FM-1 as the sound card "KittenRack": press EMPEZAR, allow audio access
  and the picture follows the sound. Keys: 1 oscilloscope, 2 visual, 3 both, arrows the scene,
  F full screen. In OBS: Window Capture.

Recording the sound
  In Audacity, Reaper, OBS or any DAW pick the input "KittenRack" (stereo, 44100 Hz):
  it is the FM-1's master. MIDI (notes and knobs) comes over the same cable to record too.

Try it without an FM-1
  https://blackkittendevices.github.io/kitten-rack/play.html

The editor, live with the FM-1
  Open the editor (offline or online, in Chrome or Edge) and press the FM-1 button at the top:
  it reads the patch the FM-1 plays and from then on what you move on one the other does
  (knobs, cables, modules, notes). ROLL on the Steps module opens the piano roll. AL FM-1 stores into a
  bank slot. To install firmware, first disconnect the editor (FM-1 button) or close its tab.

The full manual: README.md at https://github.com/BlackKittenDevices/kitten-rack

Without the window (text mode)
  python instalar_kitten_rack.py                         installs
  python instalar_kitten_rack.py --solo-info             only shows which firmware it has
  python instalar_kitten_rack.py --paquete FILE.fwsc     installs another firmware
