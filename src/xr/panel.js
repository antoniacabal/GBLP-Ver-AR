// Indice
    // 0. Imports
    // 1. El panel: la interfaz del juego pegada al borde de atrás de la plataforma
    // 2. Fundido, fondo morado y viñeta (alrededor de la cabeza)
    // 3. Pellizcar el panel con el rayo de la mano
    // 4. Sistema del panel (IWSDK)

// La interfaz en las gafas. La página HTML no se ve dentro de la sesión inmersiva, así que la interfaz del juego (narrativa.html y ui.js:
// diálogos, tarjetas, pop-ups, el medidor de respiración y los minijuegos) se copia en un panel (xr/espejo.js) que va pegado al borde
// de atrás de la plataforma, como parte de la maqueta: no flota frente a la cara ni sigue la cabeza.
// Se elige apuntando con la mano y pellizcando: el pellizco llega a la página como un clic en ese mismo punto, así los botones, el
// dial y los números funcionan sin cambiar el juego. Los controles de Meta no tocan el panel (solo sirven para salir).

// 0. Imports
import * as THREE from 'three'
import { createSystem } from '@iwsdk/core'
import { espejo, textura } from './espejo.js'
import { plataforma } from './maqueta.js'
import { LADO } from './colocacion.js'
import { mesa } from './joystick.js'

// 1. El panel: tan ancho como la plataforma (un poco más), de pie detrás de ella e inclinado hacia quien juega
const ANCHO = 0.62
const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
panel.name = 'panel'; panel.renderOrder = 10; panel.visible = false
// (sin prueba de profundidad: así los edificios altos de la calle no tapan los textos)
const soporte = new THREE.Group(); soporte.name = 'soporte-panel'; soporte.add(panel); plataforma.add(soporte)
function medir() {
    const alto = ANCHO * innerHeight / innerWidth
    panel.scale.set(ANCHO, alto, 1); panel.position.set(0, alto / 2, 0)
    soporte.position.set(0, 0.07, -LADO / 2 - 0.04); soporte.rotation.set(-0.18, 0, 0) // 7 cm sobre la plataforma, inclinado hacia atrás
}
medir(); addEventListener('resize', medir)
const punto = new THREE.Mesh(new THREE.CircleGeometry(0.004, 20), new THREE.MeshBasicMaterial({ color: 0xf2c063, depthTest: false, transparent: true }))
punto.renderOrder = 12; punto.visible = false; soporte.add(punto)

// 2. Fundido (y el destello del sismo), fondo morado con los textos grandes y viñeta de la ansiedad: alrededor de la cabeza
const elFundido = document.querySelector('.gx-fade'), elVineta = document.querySelector('.gx-vignette'), elSusurro = document.querySelector('.gx-whisper')
const fundido = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }))
fundido.renderOrder = 5; fundido.frustumCulled = false; fundido.visible = false
// fondo morado: una esfera grande que sí respeta la profundidad. La maqueta está más cerca, así que no la tapa: solo oscurece el cuarto
const velo = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ color: 0x201826, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false }))
velo.renderOrder = 4; velo.frustumCulled = false; velo.visible = false
const vineta = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')
    const g = x.createRadialGradient(128, 128, 40, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,1)')
    x.fillStyle = g; x.fillRect(0, 0, 256, 256)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthTest: false, depthWrite: false }))
    m.position.z = -0.25; m.renderOrder = 6; m.frustumCulled = false; m.visible = false; return m
})()
// solo los textos grandes oscurecen el cuarto (no los diálogos con mamá ni los avisos chiquitos)
const TEXTOS = '.gx-card:not([hidden]), .gx-modal:not([hidden]), .gx-anuncio:not([hidden])'
const hayTexto = () => !!document.querySelector(TEXTOS) || (!!elSusurro.textContent.trim() && parseFloat(getComputedStyle(elSusurro).opacity) > 0.05)
const color = new THREE.Color()
let veloT = 0
function fundidos(dt) {
    const cs = getComputedStyle(elFundido), o = parseFloat(cs.opacity) || 0
    fundido.material.opacity = Math.min(o, 0.9); fundido.visible = o > 0.003 // (en realidad aumentada el negro nunca tapa del todo el cuarto real)
    color.setStyle(cs.backgroundColor || '#000'); fundido.material.color.copy(color)
    veloT += ((hayTexto() ? 0.9 : 0) - veloT) * Math.min(1, dt * 3)
    velo.material.opacity = veloT; velo.visible = veloT > 0.01
    const v = parseFloat(elVineta.style.opacity) || 0
    vineta.material.opacity = Math.min(0.55, v * 0.7); vineta.visible = v > 0.01
}

// 3. Pellizcar el panel: el rayo de cada mano; si toca el panel, el pellizco es un clic de la página en ese punto
const raycaster = new THREE.Raycaster(), mtx = new THREE.Matrix4()
const evento = (tipo, el, x, y, botones) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: botones, view: window }))
const bajo = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('.gx') && !el.matches('.gx') ? el : null }
// (los minijuegos capturan el puntero con setPointerCapture: con un puntero simulado eso falla; se ignora y todo sigue igual)
const capturar = Element.prototype.setPointerCapture
Element.prototype.setPointerCapture = function (id) { try { capturar.call(this, id) } catch { /* puntero simulado */ } }
const agarre = { left: null, right: null } // lo que cada mano está apretando en la página
function apuntar(rayo) {
    rayo.updateWorldMatrix(true, false); mtx.identity().extractRotation(rayo.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(rayo.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(mtx).normalize()
    const hit = panel.visible && raycaster.intersectObject(panel, false)[0]
    return hit ? { x: hit.uv.x * innerWidth, y: (1 - hit.uv.y) * innerHeight, punto: hit.point } : null
}

// el pellizco que agarra el joystick o se acerca al botón no es un clic en el panel (aunque el rayo de esa mano lo esté tocando)
const w1 = new THREE.Vector3(), w2 = new THREE.Vector3()
function cercaDeLaMesa(rayo) {
    if (!mesa.visible) return false
    rayo.getWorldPosition(w1)
    return mesa.children.some(c => c.getWorldPosition(w2).distanceTo(w1) < 0.16)
}

// 4. Sistema del panel
let tEspejo = 0
export class SistemaPanel extends createSystem({}) {
    init() {
        this.world.camera.add(fundido, velo, vineta)
        this.sesion = null
    }
    update(delta) {
        const sesion = this.world.session
        if (sesion !== this.sesion) { // en las gafas la interfaz se agranda un poco (se lee desde la mesa); en la pantalla, como siempre
            this.sesion = sesion; document.documentElement.classList.toggle('gx-en-xr', !!sesion)
        }
        if (!sesion) { panel.visible = punto.visible = fundido.visible = velo.visible = vineta.visible = false; return }
        fundidos(delta)
        // la interfaz se vuelve a copiar unas 24 veces por segundo (40 durante un minijuego, que se mueve más)
        if ((tEspejo -= delta) <= 0) {
            tEspejo = document.body.classList.contains('gx-minijuego') ? 1 / 40 : 1 / 24
            espejo.actualizar()
            panel.visible = !espejo.vacio && plataforma.visible
        }
        // manos: apuntar y pellizcar (los controles no: isPrimary('hand'))
        const xr = this.world.input?.xr, rayos = this.world.playerSpaceEntities?.raySpaces
        let visto = null
        for (const lado of ['left', 'right']) {
            const mano = xr?.isPrimary?.('hand', lado), rayo = rayos?.[lado]?.object3D
            if (!mano || !rayo) { if (agarre[lado]) this.soltar(lado); continue }
            const p = apuntar(rayo), st = xr.getSelectState(lado)
            if (p && (!visto || agarre[lado])) visto = p
            if (st.start && p && !cercaDeLaMesa(rayo)) { const el = bajo(p.x, p.y); if (el) { agarre[lado] = { el, x: p.x, y: p.y }; evento('pointerover', el, p.x, p.y, 0); evento('pointerdown', el, p.x, p.y, 1) } }
            else if (st.active && agarre[lado] && p && (Math.abs(p.x - agarre[lado].x) > 0.5 || Math.abs(p.y - agarre[lado].y) > 0.5)) { // arrastrar (el dial, la plomada)
                const a = agarre[lado]; a.x = p.x; a.y = p.y; evento('pointermove', a.el, a.x, a.y, 1)
            }
            if ((st.end || !st.active) && agarre[lado]) this.soltar(lado, p)
        }
        punto.visible = !!visto
        if (visto) { punto.position.copy(visto.punto); soporte.worldToLocal(punto.position); punto.quaternion.identity(); punto.translateZ(0.002) }
    }
    soltar(lado, p) {
        const a = agarre[lado]; agarre[lado] = null; if (!a) return
        const x = p?.x ?? a.x, y = p?.y ?? a.y
        evento('pointerup', a.el, x, y, 0)
        const el = bajo(x, y)
        if (el && (el === a.el || a.el.contains(el))) a.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window }))
    }
}
