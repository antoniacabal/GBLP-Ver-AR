// Indice
    // 0. Imports
    // 1. Escena de la realidad mixta y el "rig" (espacio real → mundo del juego)
    // 2. Bandeja (el recuadro de la maqueta) y entorno virtual (solo en VR y en la vista previa)
    // 3. Recuadro de cada espacio
    // 4. Actualización por cuadro

// La maqueta: el juego se ve como una maqueta pequeña sobre una superficie real (una mesa o el piso).
// No se ve la calle completa: solo un recuadro alrededor de Gabriela. Al caminar, Gabriela se queda en el centro de la bandeja y lo que
// se mueve es el mapa (el mundo pasa por debajo de ella). Dentro de la casa y del MIO cabe el cuarto entero, así que el recuadro es fijo.
//
// Cómo funciona: la cámara de las gafas vive dentro de "rig". El rig convierte el espacio real (metros) en el mundo del juego:
//   mundo = C + giro · k · (real − A)     A = el punto de la mesa · C = el punto del mundo que va sobre A · k = unidades del juego por metro
// Mover C (con Gabriela) hace que el mapa se deslice sobre la mesa; cambiar k la agranda o la achica. El mundo del juego no se toca.
// Lo que queda fuera del recuadro se recorta con planos de corte (renderer.clippingPlanes, solo al dibujar el juego).

// 0. Imports
import * as THREE from 'three'
import { CONFIG, runtime, CAPA_PROTA } from '../config.js'
import { player } from '../player.js'
import { spaces } from '../environment.js'
import { mr, COMODIDAD } from './estado.js'

// 1. Escena de la realidad mixta: todo lo que vive en el espacio real (bandeja, panel, controles, superficies detectadas)
export const escenaMR = new THREE.Scene()
export const rig = new THREE.Group(); rig.name = 'rig'; escenaMR.add(rig)
export const camaraMR = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.02, 60)
camaraMR.layers.enable(CAPA_PROTA) // la protagonista vive en su propia capa (scene.js la puede dibujar nítida)
rig.add(camaraMR)
escenaMR.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2))
addEventListener('resize', () => { camaraMR.aspect = innerWidth / innerHeight; camaraMR.updateProjectionMatrix() })

const Y = new THREE.Vector3(0, 1, 0)
export const planos = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.6)] // 4 lados y el piso

// 2. Bandeja: la base de la maqueta (un recuadro oscuro con borde dorado, los colores del juego)
const MEDIO = 0.33 // media bandeja (m): la calle se ve en un cuadro de 66 cm
const bandeja = new THREE.Group(); rig.add(bandeja)
const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x201826, roughness: 0.85 }))
base.scale.y = 0.022; base.position.y = -0.011 - 0.0015; bandeja.add(base)
const borde = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map(([x, z]) => new THREE.Vector3(x, 0.001, z))), new THREE.LineBasicMaterial({ color: 0xf2c063, transparent: true, opacity: 0.85 }))
bandeja.add(borde)

// Entorno virtual: en realidad virtual (sin passthrough) y en la vista previa del computador hay un piso y una mesa donde va la maqueta
export const entornoVirtual = new THREE.Group(); rig.add(entornoVirtual)
{
    const piso = new THREE.GridHelper(8, 32, 0x71708a, 0x3a3046); piso.material.transparent = true; piso.material.opacity = 0.35
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1, 40), new THREE.MeshStandardMaterial({ color: 0x3a3046, roughness: 0.9 }))
    mesa.name = 'mesa'; entornoVirtual.add(piso, mesa)
}

// 3. Recuadro de cada espacio: en la calle sigue a Gabriela; en el cuarto, la sala y el MIO es la caja del espacio entero
const cajas = {}
function cajaDe(sp) { // centro y medidas del espacio (solo lo visible), con un pequeño margen
    if (cajas[sp]) return cajas[sp]
    const b = new THREE.Box3(), g = spaces[sp]; g.updateMatrixWorld(true)
    g.traverseVisible(o => { if (o.isMesh && !o.material?.transparent) b.expandByObject(o) })
    if (b.isEmpty()) return { x: CONFIG.camera.x, z: CONFIG.camera.z, hx: 6, hz: 6, provisional: true }
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3())
    return (cajas[sp] = { x: c.x, z: c.z, hx: Math.min(14, s.x / 2 + 0.2), hz: Math.min(14, s.z / 2 + 0.2) })
}
export const olvidarCajas = () => { for (const k in cajas) delete cajas[k] } // (cuando terminan de cargar los modelos)

// 4. Actualización por cuadro
const C = new THREE.Vector3(), J = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion()
let ultimo = '', k = 26
export const recuadro = { x: 0, z: 0, hx: 9, hz: 9 } // lo que se ve ahora (mundo del juego); controles.js lo usa para apuntar al mapa
export function actualizarDiorama(dt, t) {
    const sp = runtime.space, calle = sp === 'STREET', salto = sp !== ultimo; ultimo = sp
    const caja = calle ? null : cajaDe(sp)
    if (caja?.provisional) delete cajas[sp]
    // zoom de las tomas del juego (al despertar después del sismo y en los finales): la maqueta se acerca despacio a lo que importa
    const zj = Math.min(2.5, Math.max(1, CONFIG.camera.zoom)), mezcla = (zj - 1) / zj
    let cx, cz
    if (calle) { cx = player.x; cz = player.z }
    else { cx = caja.x + (CONFIG.camera.x - caja.x) * mezcla; cz = caja.z + (CONFIG.camera.z - caja.z) * mezcla }
    // el mapa sigue a Gabriela sin saltos (al cambiar de espacio, detrás del fundido, se pone de una vez)
    if (salto || !dt) C.set(cx, 0, cz)
    else { const a = 1 - Math.exp(-dt * COMODIDAD.seguir); C.x += (cx - C.x) * a; C.z += (cz - C.z) * a }
    // escala: la calle siempre en el mismo cuadro (con zoom se ve menos calle, más grande) · adentro, el espacio entero cabe en la bandeja
    k = (calle ? 27 : Math.max(caja.hx, caja.hz) / MEDIO) / mr.zoom / Math.pow(zj, 0.7)
    // temblor (sismo, frenón del MIO, sustos): solo se mueve el contenido de la maqueta, muy suave. La vista nunca tiembla
    const s = Math.min(COMODIDAD.temblorMax, (runtime.quake * 0.5 + runtime.stress * 0.06) * COMODIDAD.temblor)
    J.set((Math.sin(t * 19) + Math.sin(t * 11)) * 0.5 * s, 0, (Math.cos(t * 17) + Math.sin(t * 7)) * 0.5 * s)
    // rig: mundo = C + J + giro · k · (real − A)
    const A = mr.ancla.p, th = mr.ancla.yaw + mr.giro
    q.setFromAxisAngle(Y, th); rig.quaternion.copy(q); rig.scale.setScalar(k)
    tmp.copy(A).multiplyScalar(k).applyQuaternion(q)
    rig.position.set(C.x + J.x, -tmp.y, C.z + J.z).sub(tmp.set(tmp.x, 0, tmp.z))
    rig.updateMatrixWorld(true)
    // recuadro visible (en el mundo del juego) y sus planos de corte
    const bx = (calle ? C.x : caja.x) + J.x, bz = (calle ? C.z : caja.z) + J.z, hx = calle ? MEDIO * k : caja.hx, hz = calle ? MEDIO * k : caja.hz
    Object.assign(recuadro, { x: bx, z: bz, hx, hz })
    planos[0].set(tmp.set(1, 0, 0), -(bx - hx)); planos[1].set(tmp.set(-1, 0, 0), bx + hx)
    planos[2].set(tmp.set(0, 0, 1), -(bz - hz)); planos[3].set(tmp.set(0, 0, -1), bz + hz)
    // la bandeja va justo debajo del recuadro (en el espacio real)
    rig.worldToLocal(tmp.set(bx, 0, bz)); bandeja.position.copy(tmp)
    bandeja.rotation.set(0, -th, 0); bandeja.scale.set(2 * hx / k + 0.012, 1, 2 * hz / k + 0.012)
    bandeja.visible = mr.ancla.puesta || !mr.xr
    // mesa virtual (VR y vista previa): de la altura de la bandeja hasta el piso
    entornoVirtual.visible = mr.modo !== 'ar'
    const mesa = entornoVirtual.getObjectByName('mesa'), alto = Math.max(0.1, A.y - 0.025)
    mesa.position.set(A.x, alto / 2, A.z); mesa.scale.set(1, alto, 1)
}
export const escalaActual = () => k
