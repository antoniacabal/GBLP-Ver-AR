# Grietas bajo la piel · versión de realidad aumentada

Versión para gafas de realidad aumentada (Meta Quest 3 / 3S y otras con WebXR) de *Grietas bajo la piel*, la experiencia web sobre las huellas emocionales que deja un sismo. La versión original para computador vive en su propio repositorio.

En las gafas, el juego aparece como una **maqueta sobre una mesa real**:

- Las gafas **detectan el entorno** (WebXR `plane-detection`, `mesh-detection`, `hit-test`, `anchors` y `depth-sensing`): se ven las superficies que encuentran, la maqueta se pone sobre una mesa o el piso y queda anclada, tus manos reales tapan la maqueta y sale un aviso si te acercas mucho a una pared o un mueble.
- **Sin mareo**: la vista nunca la mueve el juego. Los temblores (sismo, frenón del MIO, sustos) se ven en la maqueta y mucho más suaves; el giro de la maqueta es por pasos.
- **Un recuadro, no la calle entera**: solo se ve un cuadro de la ciudad alrededor de Gabriela.
- **Se mueve el mapa, no Gabriela**: ella se queda en el centro de la bandeja y la ciudad se desliza debajo (con el stick izquierdo o agarrando el mapa con el botón lateral).

## Trabajar en el proyecto

```bash
npm install
npm run dev
```

En el computador, `narrativa.html` ofrece una **vista previa** de la maqueta (la misma interfaz y controles con mouse y teclado).

### Probar en las gafas

Las gafas solo abren la realidad aumentada en páginas con `https`. Dos opciones:

- La página publicada en GitHub Pages (se publica sola con cada push a `main`).
- En la red local: `npm run dev:gafas` y abrir en el navegador de las gafas `https://<ip-del-computador>:5173` (aceptar el aviso del certificado).

## Cómo está hecho

El juego (`src/game/`) es el mismo de la versión original; la realidad aumentada vive en `src/game/mr/`:

| Archivo | Qué hace |
| --- | --- |
| `mr/index.js` | Elegir modo, abrir la sesión WebXR, panel 3D, fundidos y el dibujo de cada cuadro |
| `mr/diorama.js` | La maqueta: el recuadro recortado, la bandeja y el mapa que sigue a Gabriela |
| `mr/entorno.js` | Superficies y muebles detectados, colocar la maqueta, avisos de seguridad |
| `mr/controles.js` | Controles de las gafas → teclado, clic y joystick del juego |
| `mr/espejo.js` | Copia la interfaz HTML en el panel 3D (en las gafas la página no se ve) |
| `mr/estado.js` | Estado compartido y ajustes de comodidad |

## Modelos 3D

Los modelos se exportan de Blender como FBX a `static/assets/`, pero el juego carga su versión GLB comprimida con Draco. Después de agregar o cambiar un FBX:

```bash
npm run modelos
```

Los FBX no se publican: `npm run build` los quita de `dist/`.

## Pendiente

- Reorganizar las páginas de técnicas de respiración y recursos de prevención para esta versión.
- Probar y ajustar en las gafas (tamaño del panel y de la maqueta, rendimiento).
