#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Instalador de KITTEN RACK para el M-VAVE FM-1 (Windows, macOS y Linux).

Doble clic en este archivo, o desde una terminal:   python instalar_kitten_rack.py

Qué hace, paso a paso, preguntando antes de tocar el FM-1:
  1. en macOS y Linux instala lo que necesita (mido y python-rtmidi) si falta; en Windows usa el MIDI del sistema;
  2. busca el paquete del firmware (kitten-rack-*.fwsc) en esta misma carpeta; si no está, baja la última versión
     publicada en GitHub (BlackKittenDevices/kitten-rack) y comprueba su huella SHA-256;
  3. busca el FM-1 por USB-MIDI y muestra qué firmware tiene ahora;
  4. instala con el mismo método que los instaladores de Felucca (tools/fm1_install.py, que va al lado de este archivo):
     el FM-1 se reinicia solo y al final se comprueba que quedó KITTEN RACK.

Para volver a otro firmware (por ejemplo Kitten Synths), el mismo instalador acepta su paquete:
  python instalar_kitten_rack.py --paquete C:\\ruta\\kitten-synths.fwsc

Opciones: --paquete ARCHIVO.fwsc   --puerto NOMBRE   --solo-info   --si (no pregunta)
"""
import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import urllib.request

REPO = "BlackKittenDevices/kitten-rack"
HERE = os.path.dirname(os.path.abspath(__file__))


def say(msg=""):
    print(msg, flush=True)


def pause(code):
    """(doble clic en Windows: que la ventana no se cierre antes de leer)"""
    if os.name == "nt" and sys.stdin and sys.stdin.isatty():
        try:
            input("\nApretá Enter para cerrar.")
        except EOFError:
            pass
    sys.exit(code)


def need_modules():
    if sys.platform == "win32":
        return                                       # (Windows: fm1_install.py usa el MIDI del sistema, no hace falta nada)
    try:
        import mido  # noqa: F401
        import rtmidi  # noqa: F401
        return
    except ImportError:
        pass
    say("Instalando lo que hace falta para hablar MIDI (mido y python-rtmidi)...")
    r = subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--upgrade", "mido", "python-rtmidi"])
    if r.returncode != 0:
        say("No se pudo instalar mido / python-rtmidi. Probá a mano:  python -m pip install mido python-rtmidi")
        pause(1)
    import site
    sp = site.getusersitepackages()
    if sp not in sys.path:
        sys.path.append(sp)


def load_installer():
    path = os.path.join(HERE, "fm1_install.py")
    if not os.path.exists(path):
        say("Falta fm1_install.py al lado de este archivo: bajá la carpeta completa del instalador.")
        pause(1)
    spec = importlib.util.spec_from_file_location("fm1_install", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "kitten-rack-installer", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def find_package(explicit):
    if explicit:
        if not os.path.exists(explicit):
            say(f"No encuentro {explicit}")
            pause(2)
        return explicit
    local = sorted(f for f in os.listdir(HERE) if f.lower().startswith("kitten-rack") and f.lower().endswith(".fwsc"))
    if local:
        path = os.path.join(HERE, local[-1])
        sums = os.path.join(HERE, "SHA256SUMS")
        if os.path.exists(sums):
            check_sum(path, open(sums, encoding="utf-8").read())
        return path
    say("No hay un paquete en esta carpeta: busco la última versión en GitHub...")
    try:
        rel = json.loads(get(f"https://api.github.com/repos/{REPO}/releases?per_page=5"))
    except Exception as e:  # noqa: BLE001
        say(f"No pude conectarme a GitHub ({e}). Bajá el .fwsc a mano y ponelo al lado de este archivo.")
        pause(1)
    for r in rel:
        assets = {a["name"]: a["browser_download_url"] for a in r.get("assets", [])}
        fw = [n for n in assets if n.lower().startswith("kitten-rack") and n.lower().endswith(".fwsc")]
        if fw:
            say(f"Versión {r['tag_name']}: bajando {fw[0]} ...")
            data = get(assets[fw[0]])
            path = os.path.join(HERE, fw[0])
            with open(path, "wb") as f:
                f.write(data)
            if "SHA256SUMS" in assets:
                check_sum(path, get(assets["SHA256SUMS"]).decode("utf-8"))
            return path
    say("Todavía no hay una versión publicada con el firmware. Probá más tarde.")
    pause(1)


def check_sum(path, sums):
    name = os.path.basename(path)
    want = next((line.split()[0] for line in sums.splitlines() if line.strip().endswith(name)), None)
    if not want:
        return
    got = hashlib.sha256(open(path, "rb").read()).hexdigest()
    if got != want:
        say(f"El archivo {name} no coincide con su huella SHA-256 (se bajó mal o fue cambiado). No lo instalo.")
        pause(2)
    say(f"Huella SHA-256 correcta: {name}")


def main():
    ap = argparse.ArgumentParser(description="Instalador de KITTEN RACK para el FM-1")
    ap.add_argument("--paquete", help="un .fwsc para instalar (otro firmware, por ejemplo para volver atrás)")
    ap.add_argument("--puerto", help="el nombre del puerto MIDI del FM-1, si hay varios")
    ap.add_argument("--solo-info", action="store_true", help="solo mostrar qué firmware tiene el FM-1")
    ap.add_argument("--si", action="store_true", help="no preguntar")
    a = ap.parse_args()

    say("=== KITTEN RACK: instalador para el M-VAVE FM-1 ===\n")
    if sys.version_info < (3, 8):
        say("Hace falta Python 3.8 o más nuevo (python.org).")
        pause(1)
    need_modules()
    inst = load_installer()
    port = ["--port", a.puerto] if a.puerto else []

    say("1) Conectá el FM-1 por USB y cerrá todo programa que use MIDI (editores web, DAW).")
    say("   Buscando el FM-1...\n")
    rc = inst.main(["--info", *port])
    if rc != 0:
        say("\nNo encontré el FM-1. Revisá el cable USB (que sea de datos), cerrá otros programas MIDI y probá de nuevo.")
        say("Si hay varios equipos MIDI, indicá el puerto:  python instalar_kitten_rack.py --puerto \"nombre\"")
        pause(rc)
    if a.solo_info:
        pause(0)

    pkg = find_package(a.paquete)
    say(f"\n2) Paquete: {os.path.basename(pkg)}")
    say("   Antes de seguir:")
    say("   - Los patches y canciones guardados con el firmware de ahora pueden perderse: respaldalos con su editor.")
    say("   - KITTEN RACK conserva el instalador de Felucca: si algo sale mal, el FM-1 queda esperando una")
    say("     instalación nueva y este mismo programa la termina. Para volver a tu firmware anterior, usá")
    say("     --paquete con su archivo .fwsc.")
    say("   - No desenchufes el FM-1 hasta que el instalador diga que terminó (tarda uno o dos minutos).")
    if not a.si:
        try:
            ok = input("\n¿Instalo ahora? Escribí s y Enter: ").strip().lower() in ("s", "si", "sí", "y", "yes")
        except EOFError:
            ok = False
        if not ok:
            say("Cancelado: no se tocó nada.")
            pause(1)

    say("\n3) Instalando...\n")
    rc = inst.main([pkg, "--yes", *port])
    if rc == 0:
        say("\nListo: el FM-1 tiene el firmware nuevo.")
        if "kitten-rack" in os.path.basename(pkg).lower():
            say("En el primer arranque KITTEN RACK escribe sus 33 patches de fábrica (si el banco no estaba vacío,")
            say("hacé MENU > FACTORY RESET). GLO abre el RACK; REC en el rack, el patcheo.")
    else:
        say(f"\nLa instalación no terminó (código {rc}). No desenchufes: volvé a abrir este instalador y lo completa.")
    pause(rc)


if __name__ == "__main__":
    main()
