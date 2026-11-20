// Indice
    // 0. Imports
    // 1. El panel: la interfaz del juego entre quien juega y la maqueta
    // 2. Fundido, fondo morado y viñeta (alrededor de la cabeza)
    // 3. Pellizcar el panel con el rayo de la mano
    // si el rayo está sobre un globo de diálogo o la bitácora, el pellizco es para ellos (xr/globos.js, xr/bitacora.js), no para el panel:
// si no, contaba dos veces (el panel está detrás de los globos y un pellizco saltaba dos frases)
function enOtraCosa(rayo) {
    rayo.updateWorldMatrix(true, false); o.setFromMatrixPosition(rayo.matrixWorld); d.set(0, 0, -1).transformDirection(rayo.matrixWorld)
    rayoGlobo.set(o.addScaledVector(d, -0.2), d)
    return rayoGlobo.intersectObjects([globo, ...superficies].filter(seVe), false).length > 0
}

// 4. Sistema del panel (IWSDK)

// La interfaz en las gafas. La página HTML no se ve dentro de la sesión inmersiva, así que la interfaz del juego (narrativa.html y ui.js:
// diálogos, tarjetas, pop-ups, el medidor de respiración y los minijuegos) se copia en un panel (xr/espejo.js) que flota entre quien
// juega y la maqueta, de frente, como la pantalla del juego original: los textos quedan sobre la maqueta, en el mismo lugar que en la
// pantalla. Antes iba de pie detrás de la plataforma y los anuncios y diálogos se veían al fondo, lejos y pequeños.
// Se elige apuntando con la mano y pellizcando: el pellizco llega a la página como un clic en ese mismo punto, así los botones, el
// dial y los números funcionan sin cambiar el juego. Una línea de luz sale de cada mano hacia donde apunta (3.1). Los controles de Meta
// también pueden elegir en el panel (apuntar + gatillo), pero no mueven a Gabriela ni tocan los minijuegos.

// 0. Imports
import * as THREE from 'three'
import { createSystem } from '@iwsdk/core'
import { espejo, textura } from './espejo.js'
import { plataforma } from './maqueta.js'
import { mesa, joystick } from './joystick.js'
import { manos } from './manos.js'
import { globo } from './globos.js'
import { superficies } from './bitacora.js'
import { sonido } from './sonidos.js'
import { colocacion } from './colocacion.js'
import { mundo } from './estado.js'

// 1. El panel: en la línea que va de la cabeza a un punto por encima de la maqueta, siempre de frente, a 0,8–1,2 m de los ojos (la
//    distancia que recomienda Meta para paneles que se usan con rayo: más cerca de 0,8 m cansa la vista; antes estaba a 30–55 cm).
//    Su ancho crece con la distancia: se ve del mismo tamaño (unos 66°) estés donde estés
const LEJOS = 1.25, MIN = 0.8, MAX = 1.2, ANGULO = 1.3 // (ANGULO: ancho del panel / distancia a los ojos; con 1.05 los textos se leían pequeños)
const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
panel.name = 'panel'; panel.renderOrder = 10; panel.visible = false
// (sin prueba de profundidad: así los edificios altos de la calle no tapan los textos)
const soporte = new THREE.Group(); soporte.name = 'soporte-panel'; soporte.add(panel); mundo.scene.add(soporte)
const cab = new THREE.Vector3(), centro = new THREE.Vector3(), meta = new THREE.Vector3(), qMeta = new THREE.Quaternion(), mira = new THREE.Object3D()
let ancho = 0.4, pegar = true
function colocar(camara, dt) {
    camara.getWorldPosition(cab)
    plataforma.getWorldPosition(centro); centro.y += 0.3 // (por encima de la maqueta: los avisos quedan arriba de ella y no la tapan tanto)
    const d = cab.distanceTo(centro), dist = Math.min(MAX, Math.max(MIN, d * LEJOS))
    meta.subVectors(centro, cab).setLength(dist).add(cab)
    mira.position.copy(meta); mira.lookAt(cab); qMeta.copy(mira.quaternion)
    const a = pegar ? 1 : 1 - Math.exp(-dt * 6); pegar = false // (suave: sin temblar con la cabeza)
    soporte.position.lerp(meta, a); soporte.quaternion.slerp(qMeta, a)
    ancho += (dist * ANGULO - ancho) * a
    panel.scale.set(ancho, ancho * innerHeight / innerWidth, 1)
}
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
const susurro = () => !!elSusurro.textContent.trim() && parseFloat(getComputedStyle(elSusurro).opacity) > 0.05
const hayTexto = () => !!document.querySelector(TEXTOS) || susurro()
// las tarjetas de la historia, el anuncio de la técnica y las frases sobre negro: todo el espacio alrededor se vuelve morado oscuro (también
// la maqueta) y el texto flota solo, sin recuadro (xr/espejo.js no pinta el fondo de la tarjeta). Con los pop-ups la maqueta sigue a la vista
const LLENO = '.gx-card:not([hidden]), .gx-anuncio:not([hidden])'
const todoMorado = () => !!document.querySelector(LLENO) || susurro()
const color = new THREE.Color()
let veloT = 0
function fundidos(dt) {
    const cs = getComputedStyle(elFundido), o = parseFloat(cs.opacity) || 0
    fundido.material.opacity = Math.min(o, 0.9); fundido.visible = o > 0.003 // (en realidad aumentada el negro nunca tapa del todo el cuarto real)
    color.setStyle(cs.backgroundColor || '#000'); fundido.material.color.copy(color)
    const lleno = todoMorado()
    veloT += ((lleno ? 0.96 : hayTexto() ? 0.9 : 0) - veloT) * Math.min(1, dt * 3)
    velo.material.opacity = veloT; velo.visible = veloT > 0.01
    velo.material.depthTest = !lleno // (sin prueba de profundidad tapa también la maqueta; el panel va encima)
    const v = parseFloat(elVineta.style.opacity) || 0
    vineta.material.opacity = Math.min(0.55, v * 0.7); vineta.visible = v > 0.01
}

// 3. Pellizcar el panel: el rayo de cada mano; si toca el panel, el pellizco es un clic de la página en ese punto
const raycaster = new THREE.Raycaster(), mtx = new THREE.Matrix4()
const evento = (tipo, el, x, y, botones) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 41, pointerType: 'touch', isPrimary: true, button: 0, buttons: botones, view: window }))
// (el primer elemento de la interfaz en ese punto, aunque encima haya otro lienzo: el del emulador, o el de IWSDK si queda arriba)
const bajo = (x, y) => document.elementsFromPoint(x, y).find(el => el.closest('.gx') && !el.matches('.gx')) || null
// (los minijuegos capturan el puntero con setPointerCapture: con un puntero simulado eso falla; se ignora y todo sigue igual)
const capturar = Element.prototype.setPointerCapture
Element.prototype.setPointerCapture = function (id) { try { capturar.call(this, id) } catch { /* puntero simulado */ } }
const agarre = { left: null, right: null } // lo que cada mano está apretando en la página
function apuntar(rayo) {
    rayo.updateWorldMatrix(true, false); mtx.identity().extractRotation(rayo.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(rayo.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(mtx).normalize()
    // (el rayo empieza 20 cm detrás de la mano: por si la mano queda muy cerca o un poco más allá del panel)
    raycaster.ray.origin.addScaledVector(raycaster.ray.direction, -0.2)
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

// 3.1 Rayos de luz: una línea dorada sale de cada mano (y de cada control de Meta) hacia donde apunta; si toca el panel o un globo de
//     diálogo llega hasta ahí y brilla más. Así se ve qué se va a elegir. No sale de la mano que agarra el joystick, que está cerrada o
//     que está junto a los controles de la mesa (ahí no se elige nada del panel)
const seVe = (x) => { for (let p = x; p; p = p.parent) if (!p.visible) return false; return true }
const LARGO = 0.45 // (sin tocar nada: 45 cm, tenue)
const lineas = Object.fromEntries(['left', 'right'].map(l => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 1, 6).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xf2c063, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
    m.name = 'rayo-' + l; m.renderOrder = 12; m.visible = false; m.frustumCulled = false; mundo.scene.add(m); return [l, m]
}))
const Y = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3(), d = new THREE.Vector3(), rayoGlobo = new THREE.Raycaster()
function linea(lado, rayo, p) {
    const m = lineas[lado]
    rayo.updateWorldMatrix(true, false); o.setFromMatrixPosition(rayo.matrixWorld); d.set(0, 0, -1).transformDirection(rayo.matrixWorld)
    let largo = p ? Math.max(0.03, o.distanceTo(p.punto)) : 0
    if (!largo) { rayoGlobo.set(o, d); const h = rayoGlobo.intersectObjects([globo, ...superficies].filter(seVe), false)[0]; if (h) largo = h.distance } // (o un globo, la bitácora o el panel de controles)
    m.visible = true; m.position.copy(o); m.quaternion.setFromUnitVectors(Y, d)
    m.scale.set(1, largo || LARGO, 1); m.material.opacity = largo ? 0.85 : 0.3
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
        if (!sesion) { panel.visible = punto.visible = fundido.visible = velo.visible = vineta.visible = lineas.left.visible = lineas.right.visible = false; pegar = true; return }
        fundidos(delta)
        // la interfaz se vuelve a copiar unas 24 veces por segundo (40 durante un minijuego, que se mueve más)
        if ((tEspejo -= delta) <= 0) {
            tEspejo = document.body.classList.contains('gx-minijuego') ? 1 / 40 : 1 / 24
            espejo.actualizar()
            panel.visible = !espejo.vacio && plataforma.visible
        }
        if (panel.visible) colocar(this.world.camera, delta); else pegar = true
        // manos: apuntar y pellizcar · controles de Meta: apuntar y apretar el gatillo (solo para elegir en el panel y los globos: los controles
        // siguen sin mover a Gabriela ni tocar los minijuegos)
        const xr = this.world.input?.xr, rayos = this.world.playerSpaceEntities?.raySpaces
        let visto = null
        for (const lado of ['left', 'right']) {
            const mano = xr?.isPrimary?.('hand', lado), control = !mano && xr?.isPrimary?.('controller', lado), rayo = rayos?.[lado]?.object3D
            if (!(mano || control) || !rayo) { lineas[lado].visible = false; if (agarre[lado]) this.soltar(lado); continue }
            const m = manos[lado], ocupada = mano && ((m.ok && m.puno) || joystick.mano === m || cercaDeLaMesa(rayo))
            const p = apuntar(rayo), st = xr.getSelectState(lado)
            if (ocupada || colocacion.colocando) lineas[lado].visible = false; else linea(lado, rayo, p)
            if (p && (!visto || agarre[lado])) visto = p
            if (st.start && p && !cercaDeLaMesa(rayo) && !enOtraCosa(rayo)) { const el = bajo(p.x, p.y); if (el) { if (el.closest('button, a, [role="button"], .gx-conteo-op, .gx-act')) sonido.click(); agarre[lado] = { el, x: p.x, y: p.y }; evento('pointerover', el, p.x, p.y, 0); evento('pointerdown', el, p.x, p.y, 1) } }
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
