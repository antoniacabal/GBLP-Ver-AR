// Ajustes de la experiencia en las gafas (la pestaña "Ajustes" de la bitácora, xr/bitacora.js):
//   · efectos visuales: los temblores de la maqueta, la deformación de los edificios con la ansiedad y la viñeta oscura alrededor de la
//     vista. Apagarlos no cambia la historia ni los minijuegos: solo se ven más tranquilos
//   · sonido: la música y los efectos (el mismo botón "Música" de la salida rápida, así los dos quedan de acuerdo)
//   · mover la maqueta: vuelve a colocarla (como el botón "Mover la maqueta" de la mesa; xr/colocacion.js lo atiende)
import { CONFIG } from '../game/config.js'
import { comodidad } from './maqueta.js'
import { colocacion } from './colocacion.js'

const DISTORSION = CONFIG.anxiety.distort, TEMBLOR = comodidad.temblor
const botonMusica = () => document.querySelector('[data-a="music"]')
export const ajustes = {
    efectos: true,
    get sonido() { return !botonMusica()?.textContent.includes('OFF') }
}
export function alternarEfectos() {
    ajustes.efectos = !ajustes.efectos
    CONFIG.anxiety.distort = ajustes.efectos ? DISTORSION : 0
    comodidad.temblor = ajustes.efectos ? TEMBLOR : 0
}
export const alternarSonido = () => botonMusica()?.click()
export const moverMaqueta = () => { colocacion.recolocar = true }
