# KITTEN RACK

Un Eurorack virtual para el **M-VAVE FM-1**: módulos con panel, jacks y cables, donde cualquier salida va a cualquier entrada. Se arma, se toca y se guarda como un instrumento, no como un groovebox. Estética de Halloween y gatos negros, de [Black Kitten Devices](https://github.com/BlackKittenDevices).

> **Estado: en desarrollo, todavía no se probó en el FM-1.** Por ahora hay un editor web nuevo. El firmware es el de Matryoshka 1.5.1 sin cambios, hasta que el rack llegue a la pantalla del FM-1.

## Sobre los hombros de gigantes

KITTEN RACK parte de [Matryoshka](https://github.com/glvno/matryoshka) de michael glaviano (versión 1.5.1, commit `ec7d934`), que a su vez viene de [Modular-1](https://github.com/WiggisModular/Modular-1) de WiggisModular y usa la capa de hardware y el instalador de [Felucca](https://github.com/hugelton/Felucca) de Leo Kuroshita / Hügelton Instruments. Todo el código es **GPL-3.0-only**; ver [LICENSE](LICENSE), [LICENSING.md](LICENSING.md) y el [README original de Matryoshka](README-matryoshka.md).

## El editor rack

`web/rack.html` y `web/src/rack/`: un editor rústico montado sobre el motor de audio y el formato de patch de Matryoshka.

- Rack de filas de 42 HP; los módulos se ubican en cualquier fila y se mueven arrastrando su cabeza.
- Unos 45 módulos por familias: fuentes, generativos, filtros, VCA y mezcla, moduladores, lógica y efectos.
- Cables con color por señal: naranja audio, violeta pitch, verde CV, hueso gates, amarillo keys.
- Cada módulo tiene dos entradas CV (CV1 y CV2) que se asignan a cualquiera de sus parámetros.
- Teclado de la computadora (A a K, Z y X para la octava) y Web MIDI.
- CPU estimada del FM-1 para el patch, presets de fábrica y exportar e importar en el formato de Matryoshka.

### Probarlo

```
cd web
npm ci
npm run dev
```

Abrí `http://localhost:5173/rack.html` en Chrome o Edge.

### Pruebas

```
cd web
npx vitest run src/rack
```

## Firmware

El workflow `.github/workflows/firmware.yml` compila el firmware en GitHub Actions en cada cambio de `firmware/` (el compilador de JieLi solo corre en Linux x86-64). Antes de instalar algo en un FM-1, leé las advertencias del [README original](README-matryoshka.md): **nunca instales un firmware sin la actualización por USB de Felucca**, porque es la vía de vuelta.

## Plan

El documento de diseño cubre el concepto, el catálogo de módulos, la interfaz del FM-1 y las etapas. Lo próximo:

1. Identidad propia del firmware (nombre e identidad `FM-1_xxx` en el instalador).
2. El rack en la pantalla del FM-1: grilla, modo cable, agregar y mover módulos.
3. VCOs generativos (Turing, Marbles, Euclídeo, Drift) y el VCF ladder de Muug.
4. Secuenciador de 64 pasos fuera del patch.
