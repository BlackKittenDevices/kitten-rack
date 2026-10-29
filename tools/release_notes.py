#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""KITTEN RACK: a release's notes, in English and Spanish (kitten-release.yml, kitten-release-edit.yml). V = the version."""
import os

v = os.environ.get("V", "X.Y.Z")
print(f"""**English:** download `KittenRack-instalador-{v}.zip`, unzip it and open `KittenRack.pyw` (double click): it installs the firmware and opens the offline and online editor (`README.txt` inside). Back up your data first.
Try it in the browser: https://blackkittendevices.github.io/kitten-rack/play.html · Manual: https://github.com/BlackKittenDevices/kitten-rack#readme

**Español:** bajá `KittenRack-instalador-{v}.zip`, descomprimilo y abrí `KittenRack.pyw` (doble clic): instala el firmware y abre el editor offline y el online (instrucciones en `LEEME.txt`). Respaldá tus datos antes.
Manual: https://github.com/BlackKittenDevices/kitten-rack/blob/main/README.es.md

Felucca update loader · USB MIDI + USB audio (UAC1, 16-bit stereo, 44.1 kHz) · GPL-3.0""")
