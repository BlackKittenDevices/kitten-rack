#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Kitten Rack: a release's notes, in English and Spanish (kitten-release.yml, kitten-release-edit.yml). V = the version."""
import os

v = os.environ.get("V", "X.Y.Z")
print(f"""**New in 1.3 · Nuevo en 1.3**
- **Lights / Luces:** a button stays lit while what it opened shows (SEQ, SAVE, EDIT, HOME, FX, LFO, ENV, GLO); the keys light while held or played by the sequencer (MENU > PANEL > KEY LIGHTS turns that off). Un botón queda encendido mientras se ve lo que abrió; las teclas se encienden al tocarlas o cuando suena su nota en el secuenciador (se apaga en MENÚ > PANEL > KEY LIGHTS).
- From 1.2 / De la 1.2: takes as played (QUANTIZE OFF), the REC window (MODE GRID / FREE, LENGTH, START, QUANTIZE), click (never on USB), undo, tap tempo, REC held 4 s clears the pattern anywhere. Grabación tal cual, ventana de REC, click (nunca al USB), deshacer, tap tempo, REC 4 s borra el patrón en cualquier pantalla.

**English:** download `KittenRack-instalador-{v}.zip`, unzip it and open `KittenRack.pyw` (double click): it installs the firmware and opens the offline and online editor (`README.txt` inside). Back up your data first.
Try it in the browser: https://blackkittendevices.github.io/kitten-rack/play.html · Manual: https://github.com/BlackKittenDevices/kitten-rack#readme

**Español:** bajá `KittenRack-instalador-{v}.zip`, descomprimilo y abrí `KittenRack.pyw` (doble clic): instala el firmware y abre el editor offline y el online (instrucciones en `LEEME.txt`). Respaldá tus datos antes.
Manual: https://github.com/BlackKittenDevices/kitten-rack/blob/main/README.es.md

Felucca update loader · USB MIDI + USB audio (UAC1, 16-bit stereo, 44.1 kHz) · GPL-3.0""")
