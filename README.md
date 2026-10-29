# KITTEN RACK

Un Eurorack virtual para el **M-VAVE FM-1**: módulos con panel, jacks y cables, donde cualquier salida va a cualquier entrada. Se arma, se toca y se guarda como un instrumento, no como un groovebox. Estética de Halloween y gatos negros, de [Black Kitten Devices](https://github.com/BlackKittenDevices).

> **Estado: en desarrollo, todavía no se probó en un FM-1 real.** Todo lo de abajo se probó en la computadora (los dos motores comparados muestra por muestra y la pantalla del FM-1 simulada), no en el aparato.

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

## Módulos propios de KITTEN RACK

Además de los módulos de Matryoshka, KITTEN RACK suma estos (formato de patch 49, en los dos motores, comparados muestra por muestra con `tools/golden.sh`):

| Módulo | Qué hace |
| --- | --- |
| LPG | Low pass gate estilo Buchla: un vactrol abre un filtro y un VCA; la entrada GOLPE lo abre de golpe (el "bonk") |
| Función | Generador de funciones estilo Maths: subida, bajada, curva, ciclo; con cable en IN es un slew; salidas EOR y EOC |
| Ring mod | Modulador en anillo, modo ring o AM |
| Turing | Turing Machine: melodía al azar que se repite y muta; da pitch, gate, CV y además suena |
| Euclídeo | Ritmos euclídeos: golpes repartidos en pasos, con rotación y reset |
| Marbles | Notas al azar en una escala, con dispersión, deja vu, largo y densidad |
| Bernoulli | Cada disparo va a A o a B según una probabilidad, en modo disparo o latch |
| Caos | Atractor de Lorenz: tres CV lentas que nunca se repiten |
| VCF Muug | La escalera Minimoog de FMini-1: corte -5..+5 y énfasis 0..10 como los diales del original; pasado 8 autooscila y canta una senoidal afinada (1 V/oct con TRACK) |

Y dos modos nuevos en efectos que ya estaban:

- **Delay, CINTA (0..1):** eco de cinta. La cabeza tiembla (wow lento y flutter rápido), cada vuelta pierde agudos y satura suave.
- **Reverb, RESORTE (on/off):** tanque de resortes. Ecos separados, el "boing" de la dispersión y la banda recortada, fina y goteante.

## Banco de fábrica

33 patches propios, armados desde cero con módulos y cables (`web/scripts/rack-factory.ts`). Son los mismos en el editor (**Fábrica…**) y en los primeros 33 lugares del FM-1 (con FACTORY RESET). Los otros 31 lugares quedan libres para tus patches. El volumen de todos se igualó haciéndolos sonar en el motor, y cada uno se comparó en los dos motores (editor y FM-1).

| | Teclado (los modulares de los 60) | | Suenan solos (generativos) | | Drones y ruido |
| --- | --- | --- | --- | --- | --- |
| 00 | INIT (con eco de cinta) | 11 | BONK WEST COAST | 24 | LORENZ DRONE |
| 01 | MUUG TAPE | 12 | COMPUTADORA S&H | 25 | DRONE MUUG |
| 02 | MUUG BAJO | 13 | BERLIN SEQ | 26 | NIEBLA GRANULAR |
| 03 | LEAD 1969 | 14 | PERCUSION MOD | 27 | SHIFT ESPACIAL |
| 04 | BRONCES 1971 | 15 | TURING MAQUINA | 28 | MAREA DE RUIDO |
| 05 | THEREMIN | 16 | EUCLIDES | 29 | MAQUINA RUIDO |
| 06 | CAMPANAS RING | 17 | MARBLES PLUCK | 30 | FEEDBACK COMB |
| 07 | BUCHLA TIMBRE | 18 | CAOS MELODICO | 31 | BITCRUSH RADIO |
| 08 | FM CHOWNING | 19 | GOTAS RESONADOR | 32 | CUERDA INFINITA |
| 09 | VOCES FORMANTE | 20 | CUERDAS AZAR | | |
| 10 | SYNC LEAD | 21 | ARPEGIO MARBLES | | |
| | | 22 | POLIRRITMO | | |
| | | 23 | ENJAMBRE LFO | | |

Los que suenan solos arrancan al ENCENDER (tienen su propio reloj) y en casi todos una tecla transpone. Los patches de Matryoshka ya no están en el firmware: quedan solo como material de prueba de los tests (`firmware/test/presets_matryoshka.h`).

## MIDI

El editor web usa MIDI en su propia página, https://blackkittendevices.github.io/kitten-rack/ (en Chrome o Edge). La vista previa dentro de claude.ai no deja usar MIDI. La página se publica sola con cada cambio (`.github/workflows/rack-pages.yml`); hace falta activarla una vez en el repositorio: **Settings › Pages › Source: GitHub Actions**.

El FM-1 y el editor responden a cualquier controlador MIDI por USB (y el FM-1 también por TRS):

- Notas en todos los canales, con velocidad. El canal se elige en el menú del FM-1 (todos por defecto).
- El pedal de sustain (CC 64) sostiene las notas.
- K1 a K4 del FM-1: CC 16-19, 21-24 o 70-73 (los bancos de perillas más comunes).
- Rueda de modulación, pitch bend y aftertouch llegan a las salidas de MIDI-CV.
- CC 120 y 123 apagan todo. Reloj MIDI y program change se activan en el menú.

## Patchear en el FM-1

GLO abre el RACK. Ahí, **REC** abre el menú PATCHEO:

- **CABLE NUEVO:** SELECT elige el módulo, ALGO la salida, SEL la agarra. Después SELECT va al otro módulo, ALGO elige la entrada y SEL enchufa.
- **CABLES:** la lista de todos los cables. SEL marca uno en rojo y SEL otra vez lo saca.
- **AGREGAR MODULO:** el catálogo por familias. SEL pone el módulo al final del rack.
- **QUITAR ULTIMO AGREGADO:** saca el último módulo que agregaste desde el aparato, con sus cables.

HOME vuelve un paso y REC sale. Cada cambio vuelve a cargar el patch entero, así que las notas que suenan se cortan. SAVE lo guarda como cualquier edición. Si el motor no tiene lugar (el FM-1 tiene un solo delay, una sola reverb y un solo chorus), avisa y el patch queda como estaba.

## Firmware

El workflow `.github/workflows/firmware.yml` compila el firmware en GitHub Actions en cada cambio de `firmware/` (el compilador de JieLi solo corre en Linux x86-64). Antes de instalar algo en un FM-1, leé las advertencias del [README original](README-matryoshka.md): **nunca instales un firmware sin la actualización por USB de Felucca**, porque es la vía de vuelta.

## Plan

El documento de diseño cubre el concepto, el catálogo de módulos, la interfaz del FM-1 y las etapas. Lo próximo:

1. Probarlo en el FM-1, juntos y con backup.
2. Mover módulos de lugar en el rack desde el aparato, y que el editor web lea los cambios hechos en el FM-1.
3. Secuenciador de 64 pasos fuera del patch.
4. Manual en español.
