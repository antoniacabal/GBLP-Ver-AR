// Indice
    // 0. Imports
    // 1. Jerarquía: plataforma → escala → juego
    // 2. El recuadro de cada espacio
    // 3. Actualización por cuadro (el mapa se mueve, Gabriela queda en el centro)
    // 4. Hacia dónde está quien juega (para que "adelante" sea hacia el fondo de la maqueta)

// La maqueta: el juego completo, en miniatura, sobre la plataforma.
//   plataforma  → anclada sobre la mesa real (etapa 2: colocación con environment raycast y anclas)
//     escala    → hace el juego pequeño (1/k: k unidades del juego por metro)
//       juego   → el grupo de src/game/scene.js, desplazado para que el punto C (Gabriela, en la calle) quede en el centro
// Antes (versión anterior) se movía la cámara de quien juega para dar el mismo efecto; con IWSDK la cámara es suya y lo que se mueve
// es el mundo del juego, dentro de la plataforma. El mundo del juego en sí (sus coordenadas, la historia) no cambia.

// 0. Imports
import * as THREE from 'three'
import { CONFIG, runtime } from '../game/config.js'
import { player } from '../game/player.js'
import { spaces, SEATS } from '../game/environment.js'
import { scene as juego } from '../game/scene.js'
import { mundo } from './estado.js'

// 1. Jerarquía
export const plataforma = new THREE.Group(); plataforma.name = 'plataforma'
const escala = new THREE.Group(); escala.name = 'escala'
plataforma.add(escala); escala.add(juego); mundo.scene.add(plataforma)
plataforma.position.set(0, 0.76, -0.35) // provisional: frente a quien juega, a la altura de una mesa (la etapa 2 la pone sobre la mesa real)

// 2. El recuadro de cada espacio: en la calle sigue a Gabriela; en el cuarto, la sala y el MIO es la caja del espacio entero
export const MEDIO_CALLE = 0.24, MEDIO = 0.24 // media plataforma (m): unos 50 cm de lado
const cajas = {}
function cajaDe(sp) {
    if (cajas[sp]) return cajas[sp]
    if (sp === 'BUS' && SEATS.length) { // (el grupo del MIO trae también la ciudad que pasa por las ventanas: se arma con las bancas)
        const xs = SEATS.map(s => s.x), zs = SEATS.map(s => s.z), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs)
        return (cajas[sp] = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2 + 1.6, hz: Math.max(1.8, (z1 - z0) / 2 + 1) })
    }
    const b = new THREE.Box3(), g = spaces[sp]; g.updateMatrixWorld(true)
    g.traverseVisible(o => { if (o.isMesh && !o.material?.transparent) b.expandByObject(o) })
    if (b.isEmpty()) return { x: CONFIG.camera.x, z: CONFIG.camera.z, hx: 6, hz: 6, provisional: true }
    // (la caja se mide en el mundo del juego: se deshace la escala y el desplazamiento de la maqueta)
    b.applyMatrix4(new THREE.Matrix4().copy(juego.matrixWorld).invert())
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3())
    return (cajas[sp] = { x: c.x, z: c.z, hx: Math.min(14, s.x / 2 + 0.2), hz: Math.min(14, s.z / 2 + 0.2) })
}
export const olvidarCajas = () => { for (const k in cajas) delete cajas[k] }

// 3. Actualización por cuadro
const C = new THREE.Vector3(), J = new THREE.Vector3()
let ultimo = '', k = 27
export const recuadro = { x: 0, z: 0, hx: 6.5, hz: 6.5, k: 27 } // lo que se ve (en el mundo del juego) y la escala actual
export const comodidad = { temblor: 0.18, temblorMax: 0.12, seguir: 7 } // los temblores se ven suaves en la maqueta; la vista nunca tiembla
export function actualizarMaqueta(dt, t) {
    const sp = runtime.space, calle = sp === 'STREET', salto = sp !== ultimo; ultimo = sp
    const caja = calle ? null : cajaDe(sp)
    if (caja?.provisional) delete cajas[sp]
    // las tomas del juego (al despertar después del sismo, los finales) acercan la maqueta despacio a lo que importa
    const zj = Math.min(2.5, Math.max(1, CONFIG.camera.zoom)), mezcla = (zj - 1) / zj
    const cx = calle ? player.x : caja.x + (CONFIG.camera.x - caja.x) * mezcla
    const cz = calle ? player.z : caja.z + (CONFIG.camera.z - caja.z) * mezcla
    if (salto || !dt) C.set(cx, 0, cz) // (al cambiar de espacio, detrás del fundido, se pone de una vez)
    else { const a = 1 - Math.exp(-dt * comodidad.seguir); C.x += (cx - C.x) * a; C.z += (cz - C.z) * a }
    // escala: la calle siempre igual de grande (Gabriela del mismo tamaño); adentro, el espacio entero cabe en la plataforma
    k = (calle ? 27 : Math.max(caja.hx, caja.hz) / MEDIO) / Math.pow(zj, 0.7)
    // temblor (sismo, frenón del MIO, sustos): se mueve solo el contenido de la maqueta, suave. La vista nunca tiembla
    const s = Math.min(comodidad.temblorMax, (runtime.quake * 0.5 + runtime.stress * 0.06) * comodidad.temblor)
    J.set((Math.sin(t * 19) + Math.sin(t * 11)) * 0.5 * s, 0, (Math.cos(t * 17) + Math.sin(t * 7)) * 0.5 * s)
    escala.scale.setScalar(1 / k)
    juego.position.set(-(C.x + J.x), 0, -(C.z + J.z))
    Object.assign(recuadro, { x: calle ? C.x : caja.x, z: calle ? C.z : caja.z, hx: calle ? MEDIO_CALLE * k : caja.hx, hz: calle ? MEDIO_CALLE * k : caja.hz, k })
    azimut()
}

// 4. Hacia dónde está quien juega, en el mundo del juego. player.js mueve el joystick (y WASD) relativo a CONFIG.camera.azimuth: con
//    la cabeza de quien juega, "adelante" siempre lleva a Gabriela hacia el fondo de la maqueta, se mire desde donde se mire. También
//    vuelve transparentes las casas que la tapan desde donde estás y hace que en los finales Gabriela mire hacia ti
const cabeza = new THREE.Vector3()
function azimut() {
    mundo.camera.getWorldPosition(cabeza); juego.updateMatrixWorld(true); juego.worldToLocal(cabeza)
    const dx = cabeza.x - player.x, dz = cabeza.z - player.z
    if (dx * dx + dz * dz > 1e-6) CONFIG.camera.azimuth = THREE.MathUtils.radToDeg(Math.atan2(dx, dz))
}
CONFIG.player.screenRelative = true // (WASD en la vista previa: relativo a la vista, como el joystick)
