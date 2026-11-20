// Sonidos de confirmación de las manos. Las manos no vibran como los controles: cada gesto necesita una respuesta que se vea y una que
// se oiga (si no, quien juega repite el gesto o cree que falló). Son notas cortas del sintetizador del juego (game/audio.js), distintas
// para cada tipo de acción, suaves para no tapar la música ni los minijuegos (que ya tienen sus propios sonidos)
import { audio } from '../game/audio.js'

const notas = (lista, tipo = 'sine', vol = 0.07) => lista.forEach(([f, d, en = 0]) => audio.blip(f, d, vol, tipo, en))
export const sonido = {
    toque: () => notas([[660, 0.12], [880, 0.14, 0.07]], 'triangle'),             // tocar un botón de la mesa con el índice
    click: () => notas([[1046, 0.09]], 'sine', 0.06),                             // CLICK con la línea de luz (panel, globos)
    pagina: () => notas([[1320, 0.05], [880, 0.08, 0.04]], 'triangle', 0.05),     // la bitácora: pestaña o página
    agarrar: () => notas([[330, 0.1], [440, 0.12, 0.06]], 'triangle'),            // agarrar el joystick o la barra del equilibrio
    soltar: () => notas([[440, 0.08], [330, 0.1, 0.05]], 'triangle', 0.05),       // soltarlos
    colocar: () => notas([[523, 0.15], [659, 0.15, 0.1], [784, 0.3, 0.2]]),        // la maqueta quedó puesta sobre la mesa
    salida: () => notas([[440, 0.18], [349, 0.28, 0.12]], 'sine', 0.08),          // salida rápida (abrir o volver)
    no: () => notas([[220, 0.18], [196, 0.22, 0.1]], 'square', 0.03)              // no se puede (la salida rápida durante un ejercicio)
}
