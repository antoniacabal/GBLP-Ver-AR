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
import { spaces, SEATS, modelosListos } from '../game/environment.js'
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
        // (incluye la franja de ciudad que pasa por las ventanas, en el lado -z a unos 7 unidades: así se ve el viaje)
        const za = Math.min(z0 - 1, -8.6), zb = z1 + 1
        return (cajas[sp] = { x: (x0 + x1) / 2, z: (za + zb) / 2, hx: (x1 - x0) / 2 + 1.6, hz: (zb - za) / 2 })
    }
    const b = medir(sp)
    if (b.isEmpty()) return { x: CONFIG.camera.x, z: CONFIG.camera.z, hx: 6, hz: 6, provisional: true }
    return (cajas[sp] = deCaja(b))
}
// la caja de lo que se ve del espacio, medida en el mundo del juego (sin la escala, el giro ni el desplazamiento de la maqueta: antes se
// medía en el mundo de las gafas y, con la plataforma girada, salía torcida)
const relCaja = new THREE.Matrix4(), inv = new THREE.Matrix4(), unaCaja = new THREE.Box3()
function medir(sp) {
    const b = new THREE.Box3(), g = spaces[sp]
    g.updateWorldMatrix(true, true); inv.copy(juego.matrixWorld).invert()
    g.traverseVisible(o => {
        if (!o.isMesh || o.material?.transparent || !o.geometry) return
        if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); unaCaja.copy(o.boundingBox) }
        else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); unaCaja.copy(o.geometry.boundingBox) }
        b.union(unaCaja.applyMatrix4(relCaja.multiplyMatrices(inv, o.matrixWorld)))
    })
    return b
}
const deCaja = (b) => { const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return { b, x: c.x, z: c.z, hx: Math.min(14, s.x / 2 + 0.3), hz: Math.min(14, s.z / 2 + 0.3) } }
// en las gafas los modelos pueden tardar en cargar más que la espera de modelosListos: si la caja se midió con el cuarto a medias, la cama
// quedaba cortada. Por eso, adentro, cada 2 s se vuelve a medir; la caja solo crece (nunca se encoge de golpe)
let tMedir = 0
function remedir(sp, dt) {
    if ((tMedir -= dt) > 0 || !cajas[sp]?.b) return
    tMedir = 2
    const b = medir(sp), a = cajas[sp].b
    if (b.isEmpty() || (a.containsPoint(b.min) && a.containsPoint(b.max))) return
    cajas[sp] = deCaja(b.union(a))
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
    else if (caja) remedir(sp, dt || 0)
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
    // el recuadro en la plataforma (metros): en la calle, centrado; adentro, donde cae la caja del espacio (fijo aunque tiemble el juego)
    recortar(calle ? 0 : (caja.x - C.x) / k, calle ? 0 : (caja.z - C.z) / k, recuadro.hx / k, recuadro.hz / k, dt)
    azimut()
    esconderFuera()
}

// 3.1 Recorte: lo que sale del recuadro no se dibuja (planos de corte en los materiales del juego). No se recorta todo lo que se dibuja
//     (renderer.clippingPlanes): eso cortaría también las manos, la plataforma y la interfaz de IWSDK
export const planos = [0, 1, 2, 3, 4].map(() => new THREE.Plane())
const LOCAL = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].map(n => new THREE.Plane(new THREE.Vector3(...n), 0))
mundo.renderer.localClippingEnabled = true
let tMateriales = 0
function recortar(cx, cz, hx, hz, dt) {
    LOCAL[0].constant = -(cx - hx); LOCAL[1].constant = cx + hx; LOCAL[2].constant = -(cz - hz); LOCAL[3].constant = cz + hz
    LOCAL[4].constant = 0.0005 // (y nada por debajo de la plataforma)
    plataforma.updateWorldMatrix(true, false) // (solo la cadena hasta la plataforma: recalcular todo el juego cada cuadro costaba mucho)
    planos.forEach((p, i) => p.copy(LOCAL[i]).applyMatrix4(plataforma.matrixWorld))
    // cada segundo, los materiales nuevos del juego (modelos que terminan de cargar, clones) reciben los planos
    if ((tMateriales -= dt) > 0) return
    tMateriales = 1
    // Gabriela no se recorta nunca (en el cuarto, junto a una pared, se le cortaba un pedazo)
    const suyos = new Set(); player.group.traverse(o => { for (const m of [o.material].flat()) if (m) suyos.add(m) })
    juego.traverse(o => { for (const m of [o.material].flat()) { if (!m) continue; const q = suyos.has(m) ? null : planos; if (m.clippingPlanes !== q) { m.clippingPlanes = q; m.needsUpdate = true } } })
}

// 3.2 Rendimiento: en la calle, lo que queda fuera del recuadro se esconde mientras se dibuja (las gafas dibujan dos veces, una por ojo).
//     Se vuelve a mostrar al empezar el cuadro siguiente, antes de que el juego corra: la lógica del juego nunca ve el cambio
let piezas = null
const escondidas = [], esfera = new THREE.Sphere(), aJuego = new THREE.Matrix4(), rel = new THREE.Matrix4()
function prepararPiezas() {
    piezas = []
    spaces.STREET.traverse(o => {
        if (!o.isMesh || !o.geometry) return
        if (o.isInstancedMesh) { o.computeBoundingSphere(); piezas.push({ o, s: o.boundingSphere.clone() }); return }
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
        piezas.push({ o, s: o.geometry.boundingSphere.clone() })
    })
}
function esconderFuera() {
    if (runtime.space !== 'STREET') return
    if (!piezas) prepararPiezas()
    aJuego.copy(juego.matrixWorld).invert() // (con las matrices del último dibujo, las mismas que tienen las piezas: sin recalcular todo)
    const r = recuadro
    for (const { o, s } of piezas) {
        if (!o.visible) continue
        esfera.copy(s).applyMatrix4(rel.multiplyMatrices(aJuego, o.matrixWorld)) // (en coordenadas del juego)
        const dx = Math.max(Math.abs(esfera.center.x - r.x) - r.hx, 0), dz = Math.max(Math.abs(esfera.center.z - r.z) - r.hz, 0)
        if (Math.hypot(dx, dz) > esfera.radius + 0.5) { o.visible = false; escondidas.push(o) }
    }
}
export const mostrarFuera = () => { while (escondidas.length) escondidas.pop().visible = true }
export const olvidarPiezas = () => { piezas = null }

// 4. Hacia dónde está quien juega, en el mundo del juego. player.js mueve el joystick (y WASD) relativo a CONFIG.camera.azimuth: con
//    la cabeza de quien juega, "adelante" siempre lleva a Gabriela hacia el fondo de la maqueta, se mire desde donde se mire. También
//    vuelve transparentes las casas que la tapan desde donde estás y hace que en los finales Gabriela mire hacia ti
const cabeza = new THREE.Vector3()
function azimut() {
    mundo.camera.getWorldPosition(cabeza); juego.updateWorldMatrix(true, false); juego.worldToLocal(cabeza)
    const dx = cabeza.x - player.x, dz = cabeza.z - player.z
    if (dx * dx + dz * dz > 1e-6) CONFIG.camera.azimuth = THREE.MathUtils.radToDeg(Math.atan2(dx, dz))
}
CONFIG.player.screenRelative = true // (WASD en la vista previa: relativo a la vista, como el joystick)

// cuando terminan de cargar los modelos, las cajas de los espacios y las piezas de la calle se vuelven a medir
modelosListos.then(() => { olvidarCajas(); olvidarPiezas() })
