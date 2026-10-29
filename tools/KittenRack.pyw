#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""KITTEN RACK: el instalador con ventana (Windows, macOS y Linux). Doble clic en este archivo.

  - Buscar el FM-1 y ver qué firmware tiene.
  - Instalar KITTEN RACK (el .fwsc de esta carpeta, o la última versión publicada en GitHub), u otro .fwsc
    (por ejemplo Kitten Synths, para volver atrás). Usa el método de Felucca (fm1_install.py, al lado).
  - Abrir el editor offline: la carpeta editor/ servida en http://localhost, donde el navegador deja usar MIDI.
    Si no está, se baja de la última versión publicada.
  - Abrir el editor online (GitHub Pages).

Sin ventana (o sin tkinter) queda el instalador de texto: instalar_kitten_rack.py
"""
import contextlib
import functools
import hashlib
import http.server
import importlib.util
import io
import json
import os
import queue
import re
import subprocess
import sys
import threading
import urllib.request
import webbrowser
import zipfile

REPO = "BlackKittenDevices/kitten-rack"
ONLINE = "https://blackkittendevices.github.io/kitten-rack/"
HERE = os.path.dirname(os.path.abspath(__file__))
EDITOR = os.path.join(HERE, "editor")

BG, PANEL, FG, DIM, ORANGE, RED = "#0b0b0b", "#1a1a1a", "#e8dcc8", "#8a8070", "#ff7f1f", "#e04a3a"

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:                                   # (sin tkinter: el instalador de texto)
    import runpy
    sys.argv[0] = os.path.join(HERE, "instalar_kitten_rack.py")
    runpy.run_path(sys.argv[0], run_name="__main__")
    sys.exit(0)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "kitten-rack-installer", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def releases():
    return json.loads(get(f"https://api.github.com/repos/{REPO}/releases?per_page=10"))


def sha_ok(path, sums):
    name = os.path.basename(path)
    want = next((ln.split()[0] for ln in sums.splitlines() if ln.strip().endswith(name)), None)
    return want is None or hashlib.sha256(open(path, "rb").read()).hexdigest() == want


class Out(io.TextIOBase):
    """lo que escribe fm1_install.py, a la ventana (en castellano)"""
    SAY = [(r"^package: (\S+)", r"Paquete: \1"), (r"^device:\s+(\S+)", r"FM-1: \1"),
           (r"^starting the update on (.*)", r"Empezando la instalación en \1"),
           (r"^switching to update mode", "El FM-1 pasa a modo actualización..."),
           (r"^restarting", "Reiniciando el FM-1..."), (r"^done: the FM-1 runs (.*)", r"Listo: el FM-1 tiene \1"),
           (r"^error: MIDI: (.*)", r"Error MIDI: \1 (¿otro programa usa el FM-1? cerralo)"),
           (r"^error: (.*)", r"Error: \1"), (r"^interrupted.*", "Interrumpido: volvé a instalar para terminar.")]

    def __init__(self, post):
        self.post, self.buf = post, ""

    def write(self, s):
        self.buf += s
        while True:
            m = re.search(r"[\r\n]", self.buf)
            if not m:
                break
            line, self.buf = self.buf[:m.start()], self.buf[m.end():]
            self.line(re.sub(r"\033\[K", "", line).strip())
        return len(s)

    def line(self, s):
        if not s:
            return
        m = re.match(r"writing\s+(\d+)%", s)
        if m:
            self.post(("progress", int(m.group(1))))
            return
        m = re.match(r"checking the package", s)
        if m:
            self.post(("status", "Comprobando el paquete..."))
            return
        for pat, rep in self.SAY:
            if re.match(pat, s):
                s = re.sub(pat, rep, s)
                break
        self.post(("log", s))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class App:
    def __init__(self, root):
        self.root, self.q, self.busy, self.server, self.inst = root, queue.Queue(), False, None, None
        root.title("KITTEN RACK")
        root.configure(bg=BG)
        root.minsize(560, 520)
        style = ttk.Style(root)
        with contextlib.suppress(tk.TclError):
            style.theme_use("clam")
        style.configure("K.Horizontal.TProgressbar", troughcolor=PANEL, background=ORANGE, bordercolor=BG, lightcolor=ORANGE, darkcolor=ORANGE)
        mono = ("Consolas", 10) if sys.platform == "win32" else ("Menlo", 11) if sys.platform == "darwin" else ("DejaVu Sans Mono", 10)
        head = ("Consolas", 22, "bold") if sys.platform == "win32" else ("Menlo", 22, "bold") if sys.platform == "darwin" else ("DejaVu Sans Mono", 20, "bold")
        self.mono = mono

        bar = tk.Frame(root, bg=ORANGE)
        bar.pack(fill="x")
        tk.Label(bar, text="KITTEN RACK", font=head, bg=ORANGE, fg=BG, padx=16, pady=8).pack(side="left")
        tk.Label(bar, text="M-VAVE FM-1", font=mono, bg=ORANGE, fg=BG, padx=16).pack(side="right")

        st = tk.Frame(root, bg=PANEL, padx=14, pady=10)
        st.pack(fill="x", padx=12, pady=(12, 6))
        tk.Label(st, text="FM-1", font=mono, bg=PANEL, fg=DIM).grid(row=0, column=0, sticky="w")
        self.dev = tk.Label(st, text="sin buscar", font=mono, bg=PANEL, fg=FG)
        self.dev.grid(row=0, column=1, sticky="w", padx=10)
        tk.Label(st, text="FIRMWARE", font=mono, bg=PANEL, fg=DIM).grid(row=1, column=0, sticky="w")
        self.pkg = tk.Label(st, text=self.local_pkg_text(), font=mono, bg=PANEL, fg=FG)
        self.pkg.grid(row=1, column=1, sticky="w", padx=10)

        grid = tk.Frame(root, bg=BG)
        grid.pack(fill="x", padx=12, pady=6)
        self.buttons = []
        for i, (txt, sub, fn) in enumerate([
                ("BUSCAR FM-1", "qué firmware tiene", self.info),
                ("INSTALAR KITTEN RACK", "sube el firmware al FM-1", self.install),
                ("EDITOR OFFLINE", "en tu compu, con MIDI", self.offline),
                ("EDITOR ONLINE", "en internet", self.online),
                ("OTRO FIRMWARE...", "un .fwsc (volver a Kitten Synths)", self.other),
                ("BAJAR EDITOR OFFLINE", "la última versión", self.fetch_editor)]):
            b = tk.Button(grid, text=f"{txt}\n{sub}", font=mono, bg=PANEL, fg=ORANGE if i == 1 else FG,
                          activebackground=ORANGE, activeforeground=BG, relief="flat", bd=0, padx=8, pady=10,
                          justify="center", cursor="hand2", command=fn)
            b.grid(row=i // 2, column=i % 2, sticky="nsew", padx=4, pady=4)
            self.buttons.append(b)
        grid.columnconfigure(0, weight=1)
        grid.columnconfigure(1, weight=1)

        self.status = tk.Label(root, text="Conectá el FM-1 por USB y cerrá otros programas MIDI.", font=mono, bg=BG, fg=DIM, anchor="w")
        self.status.pack(fill="x", padx=14)
        self.bar = ttk.Progressbar(root, style="K.Horizontal.TProgressbar", maximum=100)
        self.bar.pack(fill="x", padx=14, pady=4)
        self.log = tk.Text(root, height=10, font=mono, bg=PANEL, fg=FG, insertbackground=FG, relief="flat", bd=0, padx=10, pady=8, wrap="word")
        self.log.pack(fill="both", expand=True, padx=12, pady=(4, 12))
        self.log.tag_configure("err", foreground=RED)
        self.log.tag_configure("ok", foreground=ORANGE)
        self.say("Respaldá tus patches y canciones antes de instalar (con el editor del firmware que tenés).")
        root.after(80, self.pump)
        root.protocol("WM_DELETE_WINDOW", self.close)

    # ---- la ventana
    def say(self, s, tag=None):
        self.log.insert("end", s + "\n", tag or ("err" if s.lower().startswith("error") or "no encontr" in s.lower() else ("ok" if s.startswith("Listo") else None)))
        self.log.see("end")

    def post(self, m):
        self.q.put(m)

    def pump(self):
        try:
            while True:
                k, v = self.q.get_nowait()
                if k == "log":
                    self.say(v)
                elif k == "status":
                    self.status.config(text=v)
                elif k == "progress":
                    self.bar["value"] = v
                    self.status.config(text=f"Escribiendo el firmware: {v}%  (no desenchufes el FM-1)")
                elif k == "dev":
                    self.dev.config(text=v)
                elif k == "pkg":
                    self.pkg.config(text=v)
                elif k == "done":
                    self.busy = False
                    for b in self.buttons:
                        b.config(state="normal")
                    if v:
                        self.status.config(text=v)
                elif k == "open":
                    webbrowser.open(v)
        except queue.Empty:
            pass
        self.root.after(80, self.pump)

    def work(self, fn, *a):
        if self.busy:
            return
        self.busy = True
        for b in self.buttons:
            b.config(state="disabled")
        self.bar["value"] = 0

        def run():
            msg = None
            try:
                msg = fn(*a)
            except Exception as e:  # noqa: BLE001
                self.post(("log", f"Error: {e}"))
                msg = "Algo salió mal: mirá el mensaje de arriba."
            self.post(("done", msg))
        threading.Thread(target=run, daemon=True).start()

    def close(self):
        if self.busy and not messagebox.askyesno("KITTEN RACK", "Hay una tarea en curso. Si está instalando, no cierres: el FM-1 queda esperando.\n¿Cerrar igual?"):
            return
        if self.server:
            self.server.shutdown()
        self.root.destroy()

    # ---- el FM-1
    def local_pkgs(self):
        return sorted(f for f in os.listdir(HERE) if f.lower().startswith("kitten-rack") and f.lower().endswith(".fwsc"))

    def local_pkg_text(self):
        p = self.local_pkgs()
        return p[-1] if p else "se baja de GitHub al instalar"

    def installer(self):
        if self.inst:
            return self.inst
        if sys.platform != "win32":
            try:
                import mido  # noqa: F401
                import rtmidi  # noqa: F401
            except ImportError:
                self.post(("log", "Instalando mido y python-rtmidi (una sola vez)..."))
                r = subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--upgrade", "mido", "python-rtmidi"], capture_output=True, text=True)
                if r.returncode:
                    raise RuntimeError("no se pudo instalar mido / python-rtmidi: python -m pip install mido python-rtmidi")
                import site
                if site.getusersitepackages() not in sys.path:
                    sys.path.append(site.getusersitepackages())
        path = os.path.join(HERE, "fm1_install.py")
        if not os.path.exists(path):
            raise RuntimeError("falta fm1_install.py al lado de este archivo: bajá la carpeta completa")
        spec = importlib.util.spec_from_file_location("fm1_install", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.inst = mod
        return mod

    def call(self, args):
        out = Out(self.post)
        with contextlib.redirect_stderr(out):
            rc = self.installer().main(args, out=out, ask=lambda _p: True)
        out.write("\n")
        return rc, out

    def info(self):
        self.work(self._info)

    def _info(self):
        self.post(("status", "Buscando el FM-1..."))
        found = []
        out = Out(self.post)
        out.line = lambda s: found.append(s) if s else None
        with contextlib.redirect_stderr(out):
            rc = self.installer().main(["--info"], out=out)
        out.write("\n")
        if rc == 0 and found:
            m = re.match(r"(\S+)\s+\[(.*?)\]\s+port: (.*)", found[0])
            ident, mode, port = (m.group(1), m.group(2), m.group(3)) if m else (found[0], "", "")
            kind = "KITTEN RACK" if ident.startswith("FM-1_7") else "Felucca / Kitten Synths / Sloop" if ident.startswith("FM-1_9") else "de fábrica" if ident.startswith("FM-1_0") else "otro"
            loader = "update" in mode
            self.post(("dev", f"{ident}  ({kind})" + ("  EN MODO ACTUALIZACIÓN" if loader else "")))
            self.post(("log", f"FM-1 encontrado en «{port}»: {ident}, firmware {kind}."))
            if loader:
                self.post(("log", "Quedó una instalación sin terminar: apretá INSTALAR para completarla."))
            return "FM-1 listo."
        self.post(("dev", "no encontrado"))
        for s in found:
            out.__class__.line(out, s)
        self.post(("log", "No encontré el FM-1: revisá el cable USB (de datos) y cerrá editores web, DAW u otros programas MIDI."))
        return "No encontré el FM-1."

    def package(self):
        p = self.local_pkgs()
        if p:
            path = os.path.join(HERE, p[-1])
            sums = os.path.join(HERE, "SHA256SUMS")
            if os.path.exists(sums) and not sha_ok(path, open(sums, encoding="utf-8").read()):
                raise RuntimeError(f"{p[-1]} no coincide con su huella SHA-256: bajalo de nuevo")
            return path
        self.post(("status", "Buscando la última versión en GitHub..."))
        for r in releases():
            assets = {a["name"]: a["browser_download_url"] for a in r.get("assets", [])}
            fw = [n for n in assets if n.lower().startswith("kitten-rack") and n.lower().endswith(".fwsc")]
            if fw:
                self.post(("log", f"Bajando {fw[0]} ({r['tag_name']})..."))
                path = os.path.join(HERE, fw[0])
                with open(path, "wb") as f:
                    f.write(get(assets[fw[0]]))
                if "SHA256SUMS" in assets and not sha_ok(path, get(assets["SHA256SUMS"]).decode()):
                    os.remove(path)
                    raise RuntimeError("el archivo bajado no coincide con su huella SHA-256")
                self.post(("pkg", fw[0]))
                return path
        raise RuntimeError("todavía no hay una versión publicada con el firmware")

    def install(self, path=None):
        name = os.path.basename(path) if path else self.local_pkg_text()
        if not messagebox.askyesno("Instalar en el FM-1", f"Se va a instalar: {name}\n\n"
                                   "• Respaldaste tus patches y canciones?\n"
                                   "• Cerraste editores web, DAW y otros programas MIDI?\n"
                                   "• No desenchufes el FM-1 hasta que diga «Listo» (uno o dos minutos).\n\n"
                                   "Si algo se corta, volvé a apretar INSTALAR: el FM-1 queda esperando y se termina.\n\n¿Instalo ahora?"):
            return
        self.work(self._install, path)

    def _install(self, path):
        if self.server:
            self.post(("log", "(el editor offline sigue abierto: cerrá su pestaña del navegador para liberar el MIDI)"))
        pkg = path or self.package()
        self.post(("status", "Instalando..."))
        rc, _ = self.call([pkg, "--yes"])
        if rc == 0:
            self.post(("progress", 100))
            if "kitten-rack" in os.path.basename(pkg).lower():
                self.post(("log", "En el primer arranque KITTEN RACK escribe sus 33 patches de fábrica (si no aparecen: MENU > FACTORY RESET)."))
            self.post(("dev", "actualizado (BUSCAR FM-1 para verlo)"))
            return "Listo: firmware instalado."
        self.post(("log", f"La instalación no terminó (código {rc}). No desenchufes: apretá INSTALAR de nuevo."))
        return "La instalación no terminó."

    def other(self):
        path = filedialog.askopenfilename(title="Elegí un firmware (.fwsc)", filetypes=[("Firmware FM-1", "*.fwsc"), ("Todos", "*.*")], initialdir=HERE)
        if path:
            self.install(path)

    # ---- los editores
    def online(self):
        self.say(f"Abriendo el editor online: {ONLINE}")
        self.say("Usá Chrome o Edge y aceptá el permiso MIDI.")
        webbrowser.open(ONLINE)

    def offline(self):
        if not os.path.exists(os.path.join(EDITOR, "rack.html")):
            if messagebox.askyesno("Editor offline", "No está el editor offline en esta carpeta. ¿Lo bajo de GitHub ahora?"):
                self.work(self._fetch_editor, True)
            return
        self.post(("open", self.serve() + "rack.html"))
        self.say("Editor offline abierto en tu navegador (Chrome o Edge: aceptá el permiso MIDI).")
        self.say("Mientras el instalador esté abierto, el editor sigue andando. Para instalar firmware cerrá su pestaña.")

    def serve(self):
        if not self.server:
            handler = functools.partial(Quiet, directory=EDITOR)
            for port in (5180, 5181, 5182, 5183, 0):
                with contextlib.suppress(OSError):
                    self.server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
                    break
            threading.Thread(target=self.server.serve_forever, daemon=True).start()
        return f"http://localhost:{self.server.server_address[1]}/"

    def fetch_editor(self):
        self.work(self._fetch_editor, False)

    def _fetch_editor(self, then_open):
        self.post(("status", "Buscando el editor en GitHub..."))
        for r in releases():
            assets = {a["name"]: a["browser_download_url"] for a in r.get("assets", [])}
            ed = [n for n in assets if n.lower().startswith("kitten-rack-editor") and n.lower().endswith(".zip")]
            if ed:
                self.post(("log", f"Bajando {ed[0]} ({r['tag_name']})..."))
                data = get(assets[ed[0]])
                with zipfile.ZipFile(io.BytesIO(data)) as z:
                    names = z.namelist()
                    top = os.path.commonprefix(names) if all("/" in n for n in names) else ""
                    top = top[:top.find("/") + 1] if "/" in top else ""
                    for n in names:
                        rel = n[len(top):]
                        if not rel or n.endswith("/") or ".." in rel.split("/"):
                            continue
                        dest = os.path.join(EDITOR, *rel.split("/"))
                        os.makedirs(os.path.dirname(dest), exist_ok=True)
                        with open(dest, "wb") as f:
                            f.write(z.read(n))
                self.post(("log", f"Editor offline guardado en {EDITOR}"))
                if then_open:
                    self.post(("open", self.serve() + "rack.html"))
                return "Editor offline listo."
        raise RuntimeError("no encontré el editor en las versiones publicadas")


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--servir":       # (solo el editor offline, sin ventana: para probarlo)
        os.chdir(EDITOR)
        http.server.ThreadingHTTPServer(("127.0.0.1", 5180), Quiet).serve_forever()
    main()
