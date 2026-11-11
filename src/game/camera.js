import * as THREE from 'three'
import { CONFIG, runtime, CAPA_PROTA } from './config.js'
import { SPACE_ZOOM } from './environment.js'
// cuarto y sala: zoom propio (environment.js). En pantallas angostas (celular de pie) la cámara se aleja para que quepa el ancho y sobraba
// mucho fondo arriba y abajo: adentro de la casa se acerca un poco más (el cuarto es angosto, la sala ancha)
const ANGOSTO = { HOUSE: 1.28, HOME: 1.12 }
const zoomNow = () => CONFIG.camera.zoom * (SPACE_ZOOM[runtime.space] || 1) * (innerWidth / innerHeight < 1 ? ANGOSTO[runtime.space] || 1 : 1)
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200)
camera.layers.enable(CAPA_PROTA) // capa propia: la protagonista (scene.js la puede dibujar aparte, nítida)
const target = new THREE.Vector3()
export function resizeCamera() {
    const a = innerWidth / innerHeight, v = CONFIG.camera.view * Math.max(1, 1.4 / a) // pantallas angostas (móvil / ventana estrecha): se aleja para que quepa el mismo ancho que en escritorio
    camera.left = -v * a / 2; camera.right = v * a / 2; camera.top = v / 2; camera.bottom = -v / 2
    camera.zoom = zoomNow(); camera.updateProjectionMatrix()
}
// desiredX / desiredZ: dentro de la casa y del MIO es fijo; en la calle sigue al personaje (también cuando la calle gira)
export function updateCamera(t, dt, desiredX, desiredZ = 0) {
    const c = CONFIG.camera, az = THREE.MathUtils.degToRad(c.azimuth), el = THREE.MathUtils.degToRad(c.elevation), k = Math.min(1, dt * c.follow)
    c.x += (desiredX - c.x) * k; c.z += (desiredZ - c.z) * k
    // en los minijuegos (salvo Reconstruir la gravedad, que juega con el equilibrio) la cámara tiembla mucho menos: hay que poder concentrarse
    const calmo = runtime.state === 'BREATHING' && runtime.techId !== 'gravedad' ? 0.3 : 1
    const s = CONFIG.anxiety.shakeMax * (runtime.visAnx ?? runtime.anxiety) ** 2 * calmo + runtime.quake * 0.5 + runtime.stress * 0.12 // ansiedad + sismo + choques con gente
    target.set(c.x + (Math.sin(t * 41) + Math.sin(t * 23)) * s, c.y + Math.sin(t * 37) * s, c.z + Math.cos(t * 29) * s)
    camera.position.set(target.x + c.distance * Math.cos(el) * Math.sin(az), target.y + c.distance * Math.sin(el), target.z + c.distance * Math.cos(el) * Math.cos(az))
    camera.lookAt(target)
    // crisis de disociación (conteo.js): la cámara se ladea (ángulo holandés) y se bambolea de lado a lado
    if (runtime.dutch) { camera.rotateZ(runtime.dutch); camera.rotateY((runtime.dutchSway || 0) * 0.015) }
    const z = zoomNow(); if (camera.zoom !== z) { camera.zoom = z; camera.updateProjectionMatrix() }
}
addEventListener('resize', resizeCamera); resizeCamera()