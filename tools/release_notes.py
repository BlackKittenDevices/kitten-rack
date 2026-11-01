#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Kitten Rack: a release's notes, in English and Spanish (kitten-release.yml, kitten-release-edit.yml). V = the version."""
import os

v = os.environ.get("V", "X.Y.Z")
print(f"""**New in 1.2 · Nuevo en 1.2**
- **Live takes as played / Grabación tal cual la tocás:** QUANTIZE OFF (default) keeps each note's timing within its step, and where you let it go; fix it on SEQ (step held + ALGO), or QUANTIZE the pattern (SEQ held + OCT-). CUANTIZAR en OFF (de fábrica) guarda el tiempo de cada nota dentro de su paso y dónde la soltaste; se corrige en SEQ (paso sostenido + ALGO) o se cuantiza el patrón (SEQ sostenido + OCT-).
- **REC as on SLOOP / REC como en SLOOP:** REC (stopped) opens the REC window, K1-K4: MODE GRID / FREE (the tempo follows you: REC on the "1" after the last bar), LENGTH 1/2/4 bars, START first note / count-in, QUANTIZE. REC (parado) abre la ventana de REC, K1-K4: MODO GRILLA / LIBRE (el tempo te sigue: REC en el "1" después del último compás), LARGO 1/2/4 compases, INICIO primera nota / cuenta, CUANTIZAR.
- **Click** OFF / REC / ON (MENU > REC), never in the USB audio. **Undo** the take: REC held + OCT-. **Tap tempo**: PLAY held + REC taps. REC held 4 s clears the pattern on any screen. Click OFF / REC / ON (MENÚ > REC), nunca va al audio USB. Deshacer la toma: REC sostenido + OCT-. Tap tempo: PLAY sostenido + toques de REC. REC sostenido 4 s borra el patrón en cualquier pantalla.

**English:** download `KittenRack-instalador-{v}.zip`, unzip it and open `KittenRack.pyw` (double click): it installs the firmware and opens the offline and online editor (`README.txt` inside). Back up your data first.
Try it in the browser: https://blackkittendevices.github.io/kitten-rack/play.html · Manual: https://github.com/BlackKittenDevices/kitten-rack#readme

**Español:** bajá `KittenRack-instalador-{v}.zip`, descomprimilo y abrí `KittenRack.pyw` (doble clic): instala el firmware y abre el editor offline y el online (instrucciones en `LEEME.txt`). Respaldá tus datos antes.
Manual: https://github.com/BlackKittenDevices/kitten-rack/blob/main/README.es.md

Felucca update loader · USB MIDI + USB audio (UAC1, 16-bit stereo, 44.1 kHz) · GPL-3.0""")
