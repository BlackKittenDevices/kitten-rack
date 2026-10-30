#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Kitten Rack: a release's notes, in English and Spanish (kitten-release.yml, kitten-release-edit.yml). V = the version."""
import os

v = os.environ.get("V", "X.Y.Z")
print(f"""**New in 1.1 · Nuevo en 1.1**
- **Change patch, keep the sequence / Cambiá de patch y la secuencia sigue:** a patch with no sequence of its own takes the one playing, to try sounds over it (SAVE stores it). Un patch sin secuencia propia se queda con la que suena, para probar sonidos (SAVE la guarda).
- **MIDI LEARN** in the editor: click a knob, move a control of your controller. The map is saved in the patch and, with AL FM-1, in the FM-1: it answers the controller over USB or TRS with no computer. MIDI presets by name. En el editor: clic en una perilla, mové un control de tu controlador. El mapa queda en el patch y, con AL FM-1, en el FM-1: responde por USB o TRS sin compu. Mapas MIDI con nombre.
- Name written as **Kitten Rack** / El nombre ahora es **Kitten Rack**.

**English:** download `KittenRack-instalador-{v}.zip`, unzip it and open `KittenRack.pyw` (double click): it installs the firmware and opens the offline and online editor (`README.txt` inside). Back up your data first.
Try it in the browser: https://blackkittendevices.github.io/kitten-rack/play.html · Manual: https://github.com/BlackKittenDevices/kitten-rack#readme

**Español:** bajá `KittenRack-instalador-{v}.zip`, descomprimilo y abrí `KittenRack.pyw` (doble clic): instala el firmware y abre el editor offline y el online (instrucciones en `LEEME.txt`). Respaldá tus datos antes.
Manual: https://github.com/BlackKittenDevices/kitten-rack/blob/main/README.es.md

Felucca update loader · USB MIDI + USB audio (UAC1, 16-bit stereo, 44.1 kHz) · GPL-3.0""")
