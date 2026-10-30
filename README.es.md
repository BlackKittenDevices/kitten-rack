# Kitten Rack

Un Eurorack virtual adentro del **M-VAVE FM-1**: módulos con panel, jacks y cables, donde cualquier salida va a cualquier entrada. Se arma, se toca y se guarda como un instrumento. Naranja sobre negro, de [Black Kitten Devices](https://github.com/BlackKittenDevices).

[Read in English](README.md) · [▶ Probalo en el navegador](https://blackkittendevices.github.io/kitten-rack/play.html) · [Editor](https://blackkittendevices.github.io/kitten-rack/)

Este documento explica todo lo que tiene el firmware: cómo instalarlo, cómo se usa el FM-1 con él, el secuenciador, el editor en la computadora, las visuales y cómo grabar lo que suena. Al final hay una parte para quien quiera tocar el código.

**Contenido**

1. [Instalar y volver atrás](#1-instalar-y-volver-atrás)
2. [El FM-1, botón por botón](#2-el-fm-1-botón-por-botón)
3. [El secuenciador](#3-el-secuenciador)
4. [El rack y el patcheo en el aparato](#4-el-rack-y-el-patcheo-en-el-aparato)
5. [Guardar y cargar](#5-guardar-y-cargar)
6. [Las visuales](#6-las-visuales)
7. [Grabar y capturar: audio, MIDI y pantalla](#7-grabar-y-capturar-audio-midi-y-pantalla)
8. [El editor en la computadora](#8-el-editor-en-la-computadora)
9. [MIDI](#9-midi)
10. [Los módulos](#10-los-módulos)
11. [El banco de fábrica](#11-el-banco-de-fábrica)
12. [Para desarrolladores](#12-para-desarrolladores)
13. [Créditos y licencia](#13-créditos-y-licencia)

---

## 1. Instalar y volver atrás

1. En [Releases](https://github.com/BlackKittenDevices/kitten-rack/releases) bajá `KittenRack-instalador-X.Y.Z.zip` (la versión más nueva) y descomprimilo.
2. Necesitás **Python 3.8 o más nuevo** (python.org o la Microsoft Store). En Windows no hace falta nada más.
3. **Respaldá** los patches y canciones del firmware que tenés ahora (Kitten Synths: con su editor). Kitten Rack usa su propio banco.
4. Conectá el FM-1 con un cable USB de datos y cerrá todo programa que use MIDI (editores web, DAW).
5. Doble clic en **`KittenRack.pyw`**. La ventana tiene:

| Botón | Qué hace |
| --- | --- |
| BUSCAR FM-1 | Muestra qué firmware tiene el FM-1 ahora |
| INSTALAR Kitten Rack | Sube el firmware (uno o dos minutos, no desenchufes hasta que diga "Listo"). Si algo se corta, apretalo de nuevo: el FM-1 queda esperando |
| EDITOR OFFLINE | Abre el editor de la carpeta en Chrome o Edge, con MIDI, mientras la ventana esté abierta |
| EDITOR ONLINE | Abre el editor en internet |
| OTRO FIRMWARE... | Instala otro `.fwsc`: por ejemplo Kitten Synths para volver atrás |
| BAJAR EDITOR OFFLINE | Baja la última versión del editor a la carpeta `editor/` |

Si la ventana no abre: `python instalar_kitten_rack.py` (modo texto; `--solo-info` solo muestra el firmware, `--paquete ARCHIVO.fwsc` instala otro).

**En el primer arranque** Kitten Rack escribe sus 33 patches de fábrica. Al actualizar, los patches de fábrica que nunca editaste se reemplazan solos por los nuevos; los tuyos no se tocan. Para volver al banco de fábrica entero está FACTORY RESET en el menú SYSTEM (HOME sostenido; pide OCT+ dos veces y borra tus patches).

**Arranques especiales** (con el FM-1 apagado, mantené apretado y prendé):

- **OCT- + OCT+:** modo actualización. El FM-1 solo espera un firmware nuevo. Es la vía de vuelta si algo sale mal.
- **SAVE:** modo seguro: arranca con un patch mínimo de emergencia en vez del guardado (sirve si un patch no deja arrancar).

> **Regla de oro:** nunca instales un firmware que no tenga la actualización por USB de Felucca. Kitten Rack, Kitten Synths, Felucca, Sloop y Matryoshka la tienen. El original de M-VAVE se puede volver a poner con OTRO FIRMWARE.

---

## 2. El FM-1, botón por botón

El FM-1 toca **patches**: un patch es un rack entero (módulos, cables, perillas y secuencias). La pantalla muestra un módulo a la vez; **K1 a K4** mueven sus cuatro perillas de la página que se ve.

| Control | Qué hace |
| --- | --- |
| PRESET (perilla) | El patch siguiente o anterior del banco. En SEQ y SONG: el patrón |
| SELECT (perilla) | Elige el módulo |
| ALGO (perilla) | Elige la página del módulo |
| K1 a K4 | Las cuatro perillas de la página |
| SEL | Abre el RACK (los módulos como paneles Eurorack con sus cables) |
| EDIT | El patcheo: cables y módulos (ver [4](#4-el-rack-y-el-patcheo-en-el-aparato)) |
| FX | Salta entre los efectos |
| LFO | Salta entre las fuentes de sonido y los moduladores |
| ENV | Salta entre las envolventes y los filtros |
| ARP | Prende o apaga el arpegiador y muestra su página (modo, ritmo, octavas, largo) |
| SEQ | La pantalla del secuenciador |
| REC | Graba (desde cualquier pantalla) |
| PLAY | Arranca o para. PLAY sostenido + PRESET: el tempo |
| GLO | Abre el RACK; otra vez, la página del FM-1: K1 canal MIDI, K2 reloj de entrada, K3 MIDI OUT, **K4 idioma (ENGLISH / ESPANOL)** |
| HOME | Vuelve un paso. En la pantalla del módulo sin nada atrás: osciloscopio, después visuales, después vuelve. Sostenido: el menú (el manual, SYSTEM y los ajustes; ALGO cambia de solapa) |
| SAVE | La pantalla de guardar (ver [5](#5-guardar-y-cargar)) |
| OCT- / OCT+ | La octava del teclado. En SEQ: las páginas de pasos |
| Teclas | Tocan el patch, con velocidad |

**Idioma de la pantalla:** GLO, GLO otra vez y **K4**: ENGLISH o ESPANOL (también en el menú, HOME sostenido → PANEL → LANGUAGE). Se guarda al instante. Cambia los textos que Kitten Rack escribe (secuenciador, rack, guardar, visuales, catálogo de módulos y sus jacks); los parámetros de los módulos y los nombres de los patches quedan como están. De fábrica viene en inglés.

La batería se ve abajo a la derecha (0 a 3 rayitas, un rayo con USB).

El manual completo, en inglés y corto, está adentro del FM-1: **HOME sostenido**, en el menú.

---

## 3. El secuenciador

Cada patch trae sus pistas (módulos **Steps**) con hasta **64 patrones** de hasta **64 pasos**. Todo se guarda con el patch.

### La pantalla SEQ

**SEQ** la abre y la cierra. Arriba dice los pasos, el ritmo, el swing y el tempo (por ejemplo `1-16 DE 16  RITMO 1/16  120 BPM` en español, `1-16 OF 16  RATE 1/16  120 BPM` en inglés).

En una pista melódica se ve un **piano roll**:

| Control | Qué hace |
| --- | --- |
| ALGO | Mueve el cursor por los pasos |
| SELECT | Sube o baja la nota (el renglón) |
| SEL tocado (menos de medio segundo) | Pone o saca la nota donde está el cursor |
| SEL sostenido | La pantalla SONG (canciones) |
| Teclas blancas | También ponen pasos |
| OCT- / OCT+ | Pasos 17-32, 33-48, 49-64 |
| PRESET | El patrón (1-64). Corriendo: cambia al final de la vuelta; parado: en el momento |
| Teclas negras | Eligen la pista |

**Sin ningún paso apretado**, las perillas son de la pista:

| Perilla | Qué cambia |
| --- | --- |
| K1 | Cantidad de pasos (1 a 64) |
| K2 | Ritmo: 1/2, 1/4, 1/8, 1/16, 1/32, 1/64 y los tresillos 1/4T, 1/8T, 1/16T |
| K3 | Swing (hasta 80 %) |
| K4 | Tempo |

**Con un paso apretado** (mantené su tecla), las perillas son de esa nota:

| Perilla | Qué cambia |
| --- | --- |
| K1 | La altura |
| K2 | La velocidad |
| K3 | **El largo** (1 a 64 pasos, en pantalla `LARGO 3 PASOS`). La nota suena hasta el final de su último paso |
| K4 | La probabilidad de que suene (chance) |

Otros atajos: FX sostenido + tecla blanca pone un acento; LFO sostenido + tecla blanca liga el paso con el anterior; SEQ sostenido + tecla negra silencia una pista.

**Borrar el patrón:** REC sostenido 4 segundos (cuenta `BORRAR PATRON: 3, 2, 1`).

### Grabar en vivo (como Kitten Synths)

**REC** funciona desde cualquier pantalla y no te lleva a SEQ:

- **Corriendo:** empieza a grabar donde va el secuenciador.
- **Parado:** queda esperando. La primera nota que toques arranca el transporte y la grabación a la vez.
- **REC otra vez:** deja de grabar; lo grabado sigue sonando.

Las notas grabadas **guardan cuánto las sostuviste**: si mantuviste una nota tres pasos, queda de tres pasos y suena entera hasta soltar. El largo se mide en pasos de la grilla; para más detalle, subí el ritmo con K2 (1/32 o 1/64) antes de grabar. Después podés corregir cualquier nota con su paso apretado y K3.

### Probar sonidos sobre una secuencia

Grabá o escribí una secuencia y recorré patches con **PRESET** mientras suena: un patch que **no tiene secuencia propia** se queda con la que venía sonando (sus notas, largo, rate, swing y el tempo) y la pantalla dice SECUENCIA CONSERVADA. Así grabás una vez y probás sonidos encima, como en la mayoría de los sintes con secuenciador. Los patches que sí tienen su propia secuencia conservan la suya. **SAVE** guarda la secuencia en el patch nuevo.

### Canciones

SEL sostenido en SEQ abre SONG: una fila de patrones que se tocan uno tras otro. SELECT elige la fila, K1 su patrón (al final: agregar), K2 transpone (-12 a +12), K4 a la derecha toca la canción y a la izquierda el patrón. ALGO elige la canción (1 a 8). SEQ sostenido + REC borra una fila (pide REC de nuevo en 3 segundos). SEL o HOME vuelven a SEQ.

---

## 4. El rack y el patcheo en el aparato

**SEL** abre el RACK: los módulos del patch como paneles con sus cables. SELECT elige, K1-K4 giran, SEL abre el panel, HOME vuelve.

**EDIT** abre el menú PATCHEO (EDIT de nuevo sale, HOME vuelve un paso):

- **CABLE NUEVO:** SELECT elige el módulo, ALGO la salida, SEL la agarra. Después SELECT el otro módulo, ALGO la entrada y SEL enchufa.
- **CABLES:** la lista de todos los cables. SEL marca uno en rojo, SEL otra vez lo saca.
- **AGREGAR MODULO:** el catálogo por familias. SEL lo pone al final del rack.
- **QUITAR MODULO:** SELECT elige el módulo, SEL lo marca, SEL otra vez lo saca con sus cables. MIDI-CV y la salida no se pueden sacar (`ESE NO SE QUITA`).

Cada cambio vuelve a cargar el patch, así que las notas que suenan se cortan. Si el motor no tiene lugar (hay un solo delay, una sola reverb y un solo chorus), avisa y el patch queda como estaba. Si el editor está conectado, ve el cambio al instante.

---

## 5. Guardar y cargar

**SAVE** abre la lista de los 64 lugares del banco:

- **SELECT** elige un lugar.
- **SAVE** guarda ahí. Si ya hay otro patch, pide SAVE de nuevo para pisarlo.
- **SEL** carga el patch de ese lugar.
- **HOME** sale.

Se guarda el patch entero: sonido, cables y secuencias. Los lugares 1 a 33 traen los patches de fábrica; del 34 al 64 están libres.

---

## 6. Las visuales

### En el FM-1

En la pantalla del módulo, **HOME** (sin nada para atrás) abre el **osciloscopio**; HOME otra vez, las **visuales**; HOME otra vez vuelve. Las perillas siguen funcionando mientras tanto.

- **Osciloscopio:** la onda de la salida, con disparo en el cruce por cero y volumen automático.
- **Visuales:** cinco escenas en seis tonos de naranja sobre negro: un pasillo, un estallido con onda de choque en cada golpe, tres hélices, una espiral y un plasma. Los graves, los medios, los agudos y los golpes las mueven. Cambian cada 10 segundos, o con un golpe después de 5.

### En la pantalla grande (proyector, segunda pantalla, OBS)

La página **VISUALES** dibuja lo mismo en la computadora, a pantalla completa y con más detalle. Se abre con el botón **VISUALES** del editor, o directo en https://blackkittendevices.github.io/kitten-rack/visuales.html.

1. Conectá el FM-1 por USB. La computadora lo ve como una placa de sonido llamada **KittenRack**.
2. Apretá **EMPEZAR** y aceptá el permiso de audio. La página busca sola la entrada del FM-1; si no, elegila en la lista de arriba.
3. Tocá: la imagen sigue el audio que sale del FM-1 por USB.

| Control | Qué hace |
| --- | --- |
| OSCILOSCOPIO / VISUAL / LOS DOS (teclas 1, 2, 3) | Qué se ve. LOS DOS pone la onda arriba de las escenas |
| ESCENA (flechas ← →) | La escena anterior o la siguiente |
| AUTO | Que cambie sola (cada 10 s o con un golpe) |
| DETALLE | Cuántas celdas de ancho: 30 es como el FM-1, 160 es fino |
| MIDI | Las notas y el reloj MIDI del FM-1 también hacen latir la imagen |
| PANTALLA COMPLETA (tecla F) | Ocupa toda la pantalla. La barra se esconde sola a los 3 segundos (H la muestra o la esconde) |

Para probarla sin el FM-1: `visuales.html?demo` toca un sonido propio.

**Para OBS:** abrí la página en una ventana, ponela en pantalla completa y agregá en OBS una fuente **Captura de ventana** (o Captura de pantalla). Para mandarla a otro programa de VJ (Resolume, TouchDesigner) se puede usar la salida virtual de OBS o NDI.

**Para quien programe sus propias visuales:** la página publica lo que escucha en cada cuadro por un `BroadcastChannel` llamado `kitten-rack-visuales`. Cualquier otra página abierta en el mismo navegador lo recibe así:

```js
const c = new BroadcastChannel('kitten-rack-visuales');
c.onmessage = (e) => {
  const { bass, mid, high, beat, scene, mode, note } = e.data;
  // bass, mid, high: 0..255 · beat: true en cada golpe · scene: 0..4 · note: la última nota MIDI
};
```

---

## 7. Grabar y capturar: audio, MIDI y pantalla

### El audio (el master)

Por USB el FM-1 es una **placa de sonido**: audio estéreo de 16 bits a 44,1 kHz que sale del FM-1 hacia la computadora. Es la mezcla final (el master), la misma que sale por los auriculares.

- **Windows:** aparece como entrada de grabación **KittenRack**. En Audacity, Reaper, Ableton, OBS o cualquier DAW, elegí esa entrada (estéreo, 44 100 Hz) y grabá.
- **macOS y Linux:** igual, aparece como dispositivo de audio de entrada.
- No hace falta driver.
- El FM-1 no recibe audio por USB: es solo salida.

### El MIDI

Por el mismo cable el FM-1 es también un **dispositivo MIDI** llamado KittenRack:

- Grabá en el DAW lo que tocás en el teclado del FM-1 (con MIDI OUT prendido: GLO y GLO otra vez abren la página del FM-1, con canal MIDI, reloj de entrada, MIDI OUT e idioma).
- Las perillas salen como CC 16-19, SELECT / ALGO / PRESET como CC 20, 21 y 23 (relativos), el volumen como CC 7 y los botones como CC 80-93. PLAY manda Start y Stop.
- El FM-1 puede seguir el **reloj MIDI** del DAW (se activa en esa misma página).

### La pantalla

- La pantalla del FM-1 no sale por USB. Para mostrarla en grande usá la página VISUALES ([6](#6-las-visuales)) y capturala con OBS.

### Qué no hace (y por qué)

- **Grabación multipista:** no hace falta. Kitten Rack es un solo instrumento y el master estéreo es su sonido completo. Si algún día hiciera falta, el USB del FM-1 aguanta unos 8 canales de 16 bits a 44,1 kHz.
- **Disco USB** (copiar archivos arrastrando): no vale la pena. Los patches se respaldan con el editor (EXPORTAR, AL FM-1).

---

## 8. El editor en la computadora

El editor es un rack en el navegador con el **mismo motor** que el FM-1: lo que suena en uno suena igual en el otro.

- **Online:** https://blackkittendevices.github.io/kitten-rack/ (Chrome o Edge, para tener MIDI).
- **Offline:** el botón EDITOR OFFLINE del instalador.

Lo que tiene:

- Filas de 42 HP. Los módulos se mueven arrastrando su cabeza.
- Un clic en el catálogo atornilla el módulo en el primer lugar libre.
- Cables con color por señal: naranja audio, violeta pitch, verde CV, hueso gates, amarillo keys.
- Cada módulo tiene dos entradas CV (CV1 y CV2) que se asignan a cualquiera de sus parámetros.
- Teclado de la computadora (A a K, Z y X para la octava) y Web MIDI.
- CPU estimada del FM-1 para el patch.
- **ROLL** en un módulo Steps abre el piano roll grande: clic pone o saca una nota, arrastrar a la derecha la alarga, Shift pone un acento.
- **GUARDAR** guarda en el navegador; **EXPORTAR / IMPORTAR** a un archivo.
- **VISUALES** abre la página de visuales.

### Probar sin FM-1

https://blackkittendevices.github.io/kitten-rack/play.html es Kitten Rack en el navegador: las pantallas y los controles del firmware real compilados para la web, con el motor del editor haciendo el sonido. Los 33 patches de fábrica, el secuenciador, el rack, las visuales y el idioma funcionan; patchear con EDIT y guardar se hacen en el FM-1 o en el editor.

### En vivo con el FM-1

Apretá **FM-1** arriba. El editor lee el patch que está tocando el FM-1 y desde ahí todo va y viene al instante: perillas, cables, módulos agregados o sacados, notas del piano roll y el patch que elegís con PRESET.

**AL FM-1** guarda el patch del editor en un lugar del banco (elegís el lugar y el nombre).

### MIDI LEARN: las perillas y faders de tu controlador

Cualquier controlador MIDI puede mover los parámetros del rack, con los CC que ya manda:

1. Apretá **MIDI LEARN** (barra de arriba). Las perillas muestran un aro punteado.
2. Hacé clic en una perilla (un parámetro: los cables no se asignan). Titila.
3. Mové el fader o la perilla de tu controlador. La perilla muestra una etiqueta como **CC 74** y desde ahí sigue a ese control en todo su recorrido.
4. Repetí con todas las que quieras (hasta 32 por patch) y apretá **MIDI LEARN** de nuevo para terminar.

Si movés un control que ya estaba asignado a otra perilla, la asignación se muda. **MAPA MIDI** muestra la lista: cada una puede escuchar en todos los canales (TODOS) o en uno, y **SACAR** la borra. Ahí también guardás el mapa con un nombre (por ejemplo el de tu controlador) y lo cargás en otro patch: busca los mismos módulos, en el mismo orden.

**El mapa viaja con el patch.** Se guarda con GUARDAR, en el archivo exportado y, con **AL FM-1**, adentro del FM-1. Después el FM-1 responde solo a tu controlador, por USB o por su jack **MIDI TRS**, sin compu: asignás con el editor, guardás con AL FM-1, desenchufás los dos de la PC, conectás el controlador por TRS y el patch ya tiene sus controles. Con el editor conectado (botón FM-1), las asignaciones pasan al FM-1 a medida que las hacés.

Un CC asignado es de su parámetro: en ese patch ya no mueve K1-K4 ni los otros controles de la lista de abajo.

Para instalar firmware, primero desconectá el editor (botón FM-1) o cerrá su pestaña: el MIDI no se puede usar desde dos programas a la vez.

---

## 9. MIDI

El FM-1 y el editor responden a cualquier controlador MIDI, por USB (y el FM-1 también por el jack TRS):

- Notas en todos los canales, con velocidad. El canal se elige en la página del FM-1 (todos por defecto).
- El pedal de sustain (CC 64) sostiene las notas.
- K1 a K4: CC 16-19, 21-24 o 70-73 (los bancos de perillas más comunes).
- Rueda de modulación, pitch bend y aftertouch llegan a las salidas del módulo MIDI-CV.
- CC 120 y 123 apagan todo.
- Reloj MIDI y program change se activan en la página del FM-1.
- Cualquier otro CC se puede asignar a un parámetro con [MIDI LEARN](#midi-learn-las-perillas-y-faders-de-tu-controlador), y la asignación queda guardada en el patch.

---

## 10. Los módulos

Más de 50 módulos por familias. Todos andan en el editor y en el FM-1.

| Familia | Módulos |
| --- | --- |
| Fuentes | VCO, VCO WT (wavetable), VCO CZ (phase distortion), Ruido, Cuerda (Karplus), Resonador (modal) |
| Generativos | Turing, Marbles, Euclídeo, Bernoulli, Caos (Lorenz), Random, S&H, Seq 8, Steps (el secuenciador), Arpegiador |
| Filtros | VCF Muug (escalera Minimoog que autooscila), LPG (estilo Buchla), VCF Ladder, VCF Multi, Formante, Comb, Wavefolder |
| VCA y mezcla | VCA, Ring mod, Mix 4, Xfade, Pan, Selector, Compresor |
| Moduladores | Función (estilo Maths), ADSR, Env L/R, Env 8, Env DX, LFO, Slew, Pulso, Macro |
| Lógica y utilidades | Reloj/Div, Cuantizador, Mate, Lógica, Offset, Atenuversor, Ratio, Drum map, Scope |
| Efectos | Delay (con modo CINTA: wow, flutter y saturación), Reverb (con modo RESORTE), Chorus, Phaser, Bitcrush, Granular, Freq shift |

Fijos en cada patch: **MIDI-CV** (el teclado y el MIDI: pitch, gate, velocidad, bend, mod, aftertouch) y **OUT** (la salida).

Límites del FM-1: un solo delay, una sola reverb y un solo chorus por patch, y un tope de CPU que el editor estima (barra CPU arriba).

---

## 11. El banco de fábrica

33 patches propios, armados desde cero (`web/scripts/rack-factory.ts`). Son los mismos en el editor (**Fábrica…**) y en los primeros 33 lugares del FM-1.

| | Teclado (los modulares de los 60) | | Suenan solos (generativos) | | Drones y ruido |
| --- | --- | --- | --- | --- | --- |
| 01 | INIT (con eco de cinta) | 12 | BONK WEST COAST | 25 | LORENZ DRONE |
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

Los que suenan solos arrancan solos (tienen su propio reloj) y en casi todos una tecla transpone.

---

## 12. Para desarrolladores

Kitten Rack es un fork de [Matryoshka](https://github.com/glvno/matryoshka) 1.5.1. Gran parte del código y de los comentarios todavía usa los nombres de Matryoshka; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explica su diseño (formatos, motor, protocolo) y sigue valiendo.

### Dónde está cada cosa

| Carpeta | Qué hay |
| --- | --- |
| `firmware/src/` | El firmware en C. `engine.c` el motor (punto fijo), `panel.c` los botones y pantallas, `seq_ui.c` el secuenciador, `rack_ui.c` el rack y el patcheo, `save_ui.c` guardar, `viz_ui.c` las visuales, `manual.c` el manual en pantalla, `proto.c` el protocolo con el editor, `usb.c` audio y MIDI USB |
| `firmware/test/` | Pruebas del firmware en la computadora |
| `web/rack.html`, `web/src/rack/` | El editor rack |
| `web/visuales.html`, `web/src/visuals/` | La página de visuales |
| `web/src/modules.ts`, `engine.ts` | El motor de referencia (el FM-1 tiene que sonar igual) |
| `web/scripts/rack-factory.ts` | El banco de fábrica |
| `web/scripts/golden.ts` | Los kits que comparan los dos motores muestra por muestra |
| `tools/` | Instalador (`KittenRack.pyw`, `instalar_kitten_rack.py`, `fm1_install.py`), pruebas, emulador (`tools/emu`) |
| `web/index.html`, el resto de `web/src/` | La app original de Matryoshka: queda porque el editor rack y las pruebas usan su motor, su formato y su protocolo |

### Pruebas

```
cd web && npm ci
npx vitest run           # todas las pruebas web
npx tsc --noEmit -p .    # tipos
cd ..
tools/golden.sh          # los dos motores, muestra por muestra
tools/panel_test.sh      # los botones y pantallas del FM-1
tools/bank_test.sh       # el banco de fábrica
tools/patch_edit_test.sh # agregar módulos desde el aparato
tools/patch_del_test.sh  # sacar módulos desde el aparato
tools/preset_test.sh
tools/usb_test.sh
```

Para correr el editor: `cd web && npm run dev` y abrir `http://localhost:5173/rack.html`.

### Compilar y publicar

- El compilador de JieLi solo corre en Linux x86-64: el firmware se compila en GitHub Actions.
- `firmware.yml` compila y prueba cada cambio.
- `kitten-dev.yml` arma una versión de prueba (pre-release "dev") con el uso de RAM.
- `kitten-release.yml` (se lanza a mano con el número de versión) arma el `.fwsc`, el zip del instalador y el editor offline, y crea el release.
- `rack-pages.yml` publica el editor y las visuales en GitHub Pages con cada cambio en `web/`.

Antes de instalar algo en un FM-1: **nunca un firmware sin la actualización por USB de Felucca**.

### The Firmware Hub

- `fmhub.json` (en la raíz) da el texto de la tarjeta en inglés, la categoría (`synth`), el botón ▶ (`play.html`) y el del editor.
- Identidad: desde la 1.0 cada release se presenta como `FM-1_79XYZ` con su versión adentro (1.0.0 = `FM-1_79100`); las 0.2 a 0.5 eran `FM-1_792` a `FM-1_795`. El cargador de actualización es el de Felucca.
- USB: MIDI y una entrada de audio UAC1 (estéreo de 16 bits, 44,1 kHz), el mismo USB del firmware del que viene; no se presenta como teclado ni mouse.
- **VST:** el conversor de VIBE FM del Hub (todavía "pronto") arma un plugin desde el código fuente de un firmware abierto. Kitten Rack está listo para eso: es GPL-3.0, su motor es C en punto fijo sin hardware adentro (`firmware/src/engine.c`) y la interfaz ya compila a WebAssembly (`firmware/wasm/fm1_ui.c`, la que usa `play.html`). Cuando el conversor abra, se pide por mail a zven@thefirmwarehub.com.

### El formato de patch

Formato 49 (el de Matryoshka 48 más los módulos de Kitten Rack). Una nota de secuencia es una palabra de 32 bits: paso (6 bits), largo - 1 (6), nota (7), velocidad (7), chance (5) y el bit 31, que marca una nota que suena entera hasta el final de su último paso (las grabadas y las que se alargan con K3). Un patch puede terminar con un mapa MIDI (flag 8 del byte 7): una cantidad y después 4 bytes por asignación: CC, canal (0 = el del FM-1), índice de módulo, índice de parámetro. Un firmware anterior rechaza ese patch en vez de leerlo mal.

---

## 13. Créditos y licencia

Kitten Rack parte de [Matryoshka](https://github.com/glvno/matryoshka) de michael glaviano (1.5.1, commit `ec7d934`), que viene de [Modular-1](https://github.com/WiggisModular/Modular-1) de WiggisModular y usa la capa de hardware y el instalador de [Felucca](https://github.com/hugelton/Felucca) de Leo Kuroshita / Hügelton Instruments.

Todo el código es **GPL-3.0-only**: ver [LICENSE](LICENSE) y [LICENSING.md](LICENSING.md). Los cambios por versión están en [CHANGELOG.md](CHANGELOG.md).
