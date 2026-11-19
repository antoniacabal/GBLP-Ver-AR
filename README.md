# Grietas bajo la piel · realidad aumentada para Meta Quest

**URL:** https://antoniacabal.github.io/GBLP-Ver-AR/

Versión de realidad aumentada (RA) de *Grietas bajo la piel*, la experiencia web sobre las huellas emocionales que deja un sismo. El juego completo —personajes, escenarios, historia, minijuegos y finales— aparece como una **maqueta sobre una mesa real** y se juega **con las manos**. Hecho con **IWSDK** (Meta Immersive Web SDK), **Three.js** y **WebXR**.

La versión original para computador está en https://antoniacabal.github.io/grietas-bajo-la-piel/

## Cómo se usa

1. En las gafas Meta Quest (3 o 3S), abre la URL en el navegador, pulsa **Empezar**, acepta la advertencia y luego **Entrar en realidad aumentada**. Acepta el permiso de espacio.
2. **Colocar:** las superficies que detectan las gafas se ven como una malla. **Apoya las dos manos abiertas sobre la mesa**: delante de ellas aparece el contorno de la plataforma y se llena de dorado; si las dejas quietas un momento, aparece la plataforma (50 cm, 2 cm sobre la mesa), anclada al espacio real. También puedes apuntar con una mano a una superficie y **pellizcar** cuando el aro se vea dorado.
3. **Jugar con las manos:**

| Interacción | Qué hace |
| --- | --- |
| **Joystick** (izquierda de la plataforma): agarrar el palito con la mano cerrada (o pellizcar la bola) y empujarlo | Gabriela camina; ella queda en el centro y **lo que se mueve es el mapa** |
| **Botón** (derecha): hundirlo con el índice | Interactuar, avanzar diálogos y tarjetas (lo del clic izquierdo) |
| Apuntar al **panel** y pellizcar | Elegir opciones de la interfaz |
| **Puño** cerrado / mano abierta | Inhalar y sostener / exhalar (minijuegos de respiración) |
| Pellizcar con **las dos manos** e inclinar la barra | Reconstruir la gravedad |
| Mostrar **los dedos** | Conteo de grounding |
| **Girar la mano** en el aire, como una perilla | Foco entre el ruido (el dial del sonido) |
| **Las dos palmas** hacia adelante | Salida rápida |
| Botón "Mover la maqueta" (esquina de atrás de la plataforma) | Volver a colocarla en otro lugar |

Los **controles** de Meta solo sirven para salir: **B / Y** abre la salida rápida; ahí, **A / X** para parar.

Se juega sentado o de pie, sin caminar. La vista nunca tiembla: los temblores (el sismo, el frenón del MIO) se ven suaves en la maqueta.

## Funciones de IWSDK que usa

| Función | Cómo se usa | Dónde |
| --- | --- | --- |
| Sesión de RA (passthrough) | Una sola sesión, un solo renderer y un solo ciclo para todo el juego | `src/iwsdk.config.json`, `src/xr/mundo.js` |
| Scene Understanding | Muestra la malla de las superficies mientras se coloca, encuentra la altura de la mesa bajo las manos y reconoce mesas, piso y muebles | `features.sceneUnderstanding`, `src/xr/colocacion.js` |
| Environment Raycast | La retícula sigue el rayo de cada mano sobre las superficies reales | `EnvironmentRaycastTarget` |
| Room Surfaces and Anchors | La plataforma queda anclada al espacio real | `XRAnchor` |
| Hand Tracking | Colocar con las manos apoyadas, joystick (agarre), botón (toque con el índice) y gestos | `OneHandGrabbable`, `PokeInteractable`, `src/xr/manos.js`, `src/xr/gestos.js` |
| Interfaz espacial | La interfaz del juego en un panel que flota entre quien juega y la maqueta, de frente | `src/xr/panel.js` |

## Trabajar en el proyecto

```bash
npm install
npm run dev
```

`npm run dev` sirve con https (certificado propio) y carga el emulador **IWER** (una Quest 3 simulada con su sala de prueba): abre `https://localhost:5173/narrativa.html` y acepta el aviso del certificado. La primera vez descarga un navegador de unos 200 MB. Para probar con el emulador sin certificado: `npm run dev -- --mode iwer` y `http://localhost:5173/narrativa.html`.

`npm run build` crea `dist/`; GitHub Actions publica en GitHub Pages con cada envío a `main`. Añadir `?debug` a la URL muestra el panel de pruebas (saltar a cada escena o minijuego).

## Cómo está hecho

El juego (`src/game/`) es el mismo de la versión original: la historia, los estados, los minijuegos, los modelos y el audio no cambiaron. La realidad aumentada vive en `src/xr/`, como sistemas de IWSDK:

| Archivo | Qué hace |
| --- | --- |
| `xr/arranque.js` | Crea el mundo de IWSDK, carga el juego y registra los sistemas |
| `xr/mundo.js` | El mundo y el sistema que da un paso del juego en cada cuadro |
| `xr/maqueta.js` | El juego en miniatura sobre la plataforma: escala, el mapa que se mueve, el recorte y lo que no se dibuja |
| `xr/colocacion.js` | La malla del escaneo, colocar con las manos apoyadas o con la retícula, recolocar, el ancla |
| `xr/manos.js` | Lectura de las articulaciones de las manos (pellizco, puño, mano abierta, dedos, palma) |
| `xr/panel.js` + `xr/espejo.js` | La interfaz HTML copiada en un panel 3D; fundidos y fondo morado |
| `xr/joystick.js` · `xr/boton.js` | Los controles de la mesa |
| `xr/gestos.js` | Gestos de las manos y controles solo para salir |

Los archivos públicos (modelos, audio, escenas de IWSDK) están en `src/public/`. Los modelos se exportan de Blender como FBX y el juego carga su versión GLB con Draco (`npm run modelos`).

## Pendiente

- Probar y ajustar en la Quest real: tamaño de la plataforma y del panel, umbrales de los gestos, sensación del joystick y del botón.
- Reorganizar las páginas de técnicas de respiración y recursos de prevención para esta versión.
