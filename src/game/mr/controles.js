// Indice
    // 0. Imports
    // 1. Rayo de cada control y puntero sobre el panel
    // 2. Eventos hacia la página (clics en la interfaz, teclas del juego)
    // 3. Caminar: stick izquierdo o arrastrando el mapa
    // 4. Girar y acercar la maqueta (stick derecho) y botones
    // 5. Vibración de los controles
    // 6. API pública (controles)

// Controles de las gafas (Meta Quest y similares). El juego ya entiende el teclado, el clic y el joystick táctil: aquí los controles de
// las gafas se traducen a eso mismo, así el juego no cambia.
//   Gatillo ............ interactuar · avanzar diálogos · sostener para respirar · pulsar los botones del panel
//   Agarre (grip) ...... agarrar el mapa y arrastrarlo: Gabriela camina hacia donde lo lleves
//   Stick izquierdo .... caminar (adelante = hacia el fondo de la maqueta, lejos de ti)
//   Stick derecho ...... girar la maqueta (por pasos de 30°) y acercarla o alejarla
//   A .................. interactuar (como el gatillo)
//   B / Y .............. salida rápida (pausa)
//   X .................. volver a colocar la maqueta en otra superficie
// Con las manos (sin controles): pellizcar = gatillo

// 0. Imports
import * as THREE from 'three'
import { CONFIG, runtime } from '../config.js'
import { haptics } from '../haptics.js'
import { breathing } from '../breathing.js'
import { rig } from './diorama.js'
import { mr, COMODIDAD } from './estado.js'

// 1. Rayos y puntero: cada control (o mano) tiene un rayo; si toca el panel, ahí aparece un punto y el gatillo hace clic en la página
const manos = [] // { i, ctrl, src, rayo, punto, gatillo, objetivo, agarre }
let panel = null // la malla del panel (index.js la registra)
export const registrarPanel = (m) => { panel = m }
const raycaster = new THREE.Raycaster(), mtx = new THREE.Matrix4()
const MAT_RAYO = new THREE.LineBasicMaterial({ color: 0xe4ffff, transparent: true, opacity: 0.55, depthTest: false })
function crearRayo() {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
    const l = new THREE.Line(g, MAT_RAYO); l.renderOrder = 40; l.scale.z = 2; return l
}
const puntoPanel = new THREE.Mesh(new THREE.CircleGeometry(0.006, 20), new THREE.MeshBasicMaterial({ color: 0xf2c063, depthTest: false, transparent: true }))
puntoPanel.renderOrder = 41
function apuntar(m) { // dónde toca el rayo en el panel → coordenadas de la página
    m.panel = null
    if (!panel?.visible || !m.ctrl.visible) return null
    m.ctrl.updateMatrixWorld(true); mtx.identity().extractRotation(m.ctrl.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(m.ctrl.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(mtx).normalize()
    const hit = raycaster.intersectObject(panel, false)[0]
    if (!hit) return null
    m.panel = { x: hit.uv.x * innerWidth, y: (1 - hit.uv.y) * innerHeight, punto: hit.point, dist: hit.distance }
    return m.panel
}

// 2. Eventos hacia la página. Si el rayo está sobre algo de la interfaz (un botón, el dial, un número...), recibe el puntero ahí mismo.
//    Si no, el gatillo es la tecla E y la barra espaciadora a la vez (lo mismo que hace el botón táctil "Interactuar")
let atrapador = null // vista previa: una capa transparente encima de la página (index.js); se aparta para preguntar qué hay debajo
export const usarAtrapador = (el) => { atrapador = el }
function bajo(x, y) {
    if (atrapador) atrapador.style.pointerEvents = 'none'
    const el = document.elementFromPoint(x, y)
    if (atrapador) atrapador.style.pointerEvents = ''
    return el && el.closest('.gx') && !el.matches('.gx') ? el : null
}
const evento = (tipo, el, x, y, botones) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 41, pointerType: 'mouse', isPrimary: true, button: 0, buttons: botones, view: window }))
const tecla = (tipo, code) => dispatchEvent(new KeyboardEvent(tipo, { code, key: code === 'Space' ? ' ' : code, bubbles: true }))
// (los minijuegos capturan el puntero con setPointerCapture: con un puntero simulado eso falla; se ignora y todo sigue igual)
const capturar = Element.prototype.setPointerCapture
Element.prototype.setPointerCapture = function (id) { try { capturar.call(this, id) } catch { /* puntero simulado */ } }

function apretar(m) {
    m.gatillo = true
    if (mr.colocando) return void mr.alColocar?.()
    const p = m.panel, el = p && bajo(p.x, p.y)
    if (el) { m.objetivo = { el, x: p.x, y: p.y }; evento('pointerover', el, p.x, p.y, 0); evento('pointerdown', el, p.x, p.y, 1); return }
    m.objetivo = 'teclas'; tecla('keydown', 'KeyE'); tecla('keydown', 'Space')
}
function soltar(m) {
    m.gatillo = false
    const o = m.objetivo; m.objetivo = null
    if (o === 'teclas') { tecla('keyup', 'KeyE'); tecla('keyup', 'Space'); return }
    if (!o) return
    const p = m.panel || o, x = p.x ?? o.x, y = p.y ?? o.y
    evento('pointerup', o.el, x, y, 0)
    if (bajo(x, y) === o.el || o.el.contains(bajo(x, y))) o.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window }))
}
function arrastrar(m) { // con el gatillo apretado sobre un control de la interfaz (el dial del foco, la plomada...): el puntero se mueve
    const o = m.objetivo; if (!o || o === 'teclas' || !m.panel) return
    if (Math.abs(m.panel.x - o.x) < 0.5 && Math.abs(m.panel.y - o.y) < 0.5) return
    o.x = m.panel.x; o.y = m.panel.y; evento('pointermove', o.el, o.x, o.y, 1)
}

// 3. Caminar. El juego mueve a Gabriela con runtime.joyX / joyY (el joystick táctil), relativo a CONFIG.camera.azimuth: index.js pone
//    ahí hacia dónde está quien juega, así "adelante" siempre es hacia el fondo de la maqueta, se mire desde donde se mire
const mundo = new THREE.Vector3(), real = new THREE.Vector3()
function haciaJoy(vx, vz) { // dirección en el mundo del juego → joystick (lo inverso de player.js)
    const a = THREE.MathUtils.degToRad(CONFIG.camera.azimuth)
    return [vx * Math.cos(a) - vz * Math.sin(a), -vx * Math.sin(a) - vz * Math.cos(a)]
}
// Arrastrar el mapa: al apretar el agarre se toma el mapa en ese punto. Mover la mano lleva el mapa: Gabriela camina para el lado
// contrario (si jalas el mapa hacia ti, ella avanza hacia el fondo). Es como un joystick que se agarra en cualquier parte del mapa
const RADIO_AGARRE = 0.1 // metros de mano para caminar a toda velocidad
const lineaAgarre = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf2c063, transparent: true, opacity: 0.8, depthTest: false }))
lineaAgarre.renderOrder = 40; lineaAgarre.visible = false; lineaAgarre.frustumCulled = false
function caminar(stick) {
    let jx = 0, jy = 0
    const m = manos.find(m => m.agarre)
    lineaAgarre.visible = !!m
    if (m) {
        real.setFromMatrixPosition(m.grip.matrix) // (en el espacio real: el control es hijo del rig)
        const d = real.clone().sub(m.agarre); d.y = 0
        const pos = lineaAgarre.geometry.attributes.position; pos.setXYZ(0, m.agarre.x, m.agarre.y, m.agarre.z); pos.setXYZ(1, real.x, m.agarre.y, real.z); pos.needsUpdate = true
        const n = Math.min(1, d.length() / RADIO_AGARRE)
        if (n > 0.12) {
            mundo.copy(d).applyQuaternion(rig.quaternion).normalize().multiplyScalar(-n) // el mapa va con la mano: ella, al revés
            ;[jx, jy] = haciaJoy(mundo.x, mundo.z)
        }
    } else if (stick && Math.hypot(stick[0], stick[1]) > 0.15) { jx = stick[0]; jy = -stick[1] } // (en los controles, adelante es -y)
    runtime.joyX = jx; runtime.joyY = jy
}

// 4. Stick derecho y botones
let giroListo = true, foco = 0, botonesAntes = new Map()
function vista(stick, dt) {
    if (!stick) return
    const [x, y] = stick
    if (Math.abs(x) > 0.7 && giroListo) { giroListo = false; mr.giro += Math.sign(x) * COMODIDAD.giroPaso; vibrar(0.15, 30) } // por pasos: girar suave marea
    if (Math.abs(x) < 0.3) giroListo = true
    if (Math.abs(y) > 0.25) mr.zoom = Math.min(2.2, Math.max(0.55, mr.zoom * Math.exp(-y * dt * 1.2)))
}
// Reconstruir la gravedad y Foco entre el ruido se juegan con A / D (o las flechas): en las gafas, con el stick izquierdo de lado
function minijuego(stick) {
    const juega = breathing.active && (runtime.techId === 'gravedad' || runtime.techId === 'foco')
    const d = juega && stick ? (stick[0] < -0.4 ? -1 : stick[0] > 0.4 ? 1 : 0) : 0
    if (d === foco) return
    if (foco) tecla('keyup', foco < 0 ? 'KeyA' : 'KeyD')
    foco = d; if (d) tecla('keydown', d < 0 ? 'KeyA' : 'KeyD')
}
function botones(m, gp) {
    const antes = botonesAntes.get(m) || [], ahora = gp.buttons.map(b => b.pressed); botonesAntes.set(m, ahora)
    const nuevo = (i) => ahora[i] && !antes[i], solto = (i) => !ahora[i] && antes[i]
    const der = m.src.handedness !== 'left'
    if (der && nuevo(4)) apretar(m); if (der && solto(4)) soltar(m) // A
    if (nuevo(5)) document.querySelector('.gx-exit')?.click() // B / Y: salida rápida
    if (!der && nuevo(4)) mr.alRecolocar?.() // X: poner la maqueta en otro lado
}

// 5. Vibración: lo que vibraba en el celular (sismo, sustos, choques) vibra también en los controles, más suave
function vibrar(fuerza, ms) { manos.forEach(m => { try { m.src?.gamepad?.hapticActuators?.[0]?.pulse(fuerza, ms) } catch { /* sin vibración */ } }) }
const buzz = haptics.buzz.bind(haptics)
haptics.buzz = (patron) => {
    buzz(patron)
    if (!mr.xr || runtime.paused) return
    const p = [patron].flat(), ms = p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0)
    vibrar(Math.min(0.45, 0.15 + ms / 2000), Math.min(900, ms))
}

// 6. API pública
export const controles = {
    lineaAgarre, puntoPanel,
    preparar(renderer) {
        for (let i = 0; i < 2; i++) {
            const ctrl = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i), rayo = crearRayo()
            const m = { i, ctrl, grip, src: null, rayo, gatillo: false, objetivo: null, agarre: null, panel: null }
            ctrl.add(rayo); rig.add(ctrl, grip)
            ctrl.addEventListener('connected', (e) => { m.src = e.data; rayo.visible = e.data.targetRayMode === 'tracked-pointer' })
            ctrl.addEventListener('disconnected', () => { if (m.gatillo) soltar(m); m.src = null; m.agarre = null })
            ctrl.addEventListener('selectstart', () => apretar(m))
            ctrl.addEventListener('selectend', () => soltar(m))
            ctrl.addEventListener('squeezestart', () => { if (!mr.colocando) m.agarre = new THREE.Vector3().setFromMatrixPosition(grip.matrix) })
            ctrl.addEventListener('squeezeend', () => { m.agarre = null })
            manos.push(m)
        }
        rig.add(lineaAgarre)
    },
    get fuentes() { return manos.map(m => m.src).filter(s => s && s.targetRayMode === 'tracked-pointer') },
    actualizar(dt) {
        let izq = null, der = null, punto = null
        for (const m of manos) {
            const gp = m.src?.gamepad
            if (gp) {
                const s = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0] || 0, gp.axes[1] || 0]
                if (m.src.handedness === 'left') izq = s; else der = s
                botones(m, gp)
            }
            const p = apuntar(m)
            m.rayo.scale.z = p ? p.dist / rig.scale.x : 2 // (la línea vive dentro del control, en metros reales)
            if (p && (!punto || m.gatillo)) punto = p
            arrastrar(m)
        }
        // con un solo control: el stick camina (si es el derecho, también)
        if (!izq && der && !manos.some(m => m.src?.handedness === 'left')) { izq = der; der = null }
        caminar(izq); minijuego(izq); vista(der, dt)
        puntoPanel.visible = !!punto
        if (punto) { puntoPanel.position.copy(punto); panel.parent.worldToLocal(puntoPanel.position); puntoPanel.quaternion.copy(panel.quaternion); puntoPanel.translateZ(0.002) }
    },
    soltarTodo() { manos.forEach(m => { if (m.gatillo) soltar(m); m.agarre = null }); runtime.joyX = runtime.joyY = 0; minijuego(null) },
    // Vista previa abierta en el navegador de las gafas (sin entrar a la realidad aumentada): si el navegador entrega los controles como
    // mandos (Gamepad API), el stick camina y el gatillo interactúa. Si no, quedan el joystick y el botón Interactuar en pantalla (touch.js)
    mando() {
        const gps = [...(navigator.getGamepads?.() || [])].filter(Boolean)
        let x = 0, y = 0, gat = false
        for (const g of gps) {
            const s = g.axes.length >= 4 ? [g.axes[2], g.axes[3]] : [g.axes[0] || 0, g.axes[1] || 0]
            if (Math.hypot(...s) > Math.hypot(x, y)) [x, y] = s
            gat ||= !!g.buttons[0]?.pressed
        }
        if (gps.length) {
            const mueve = Math.hypot(x, y) > 0.15
            if (mueve || this._mandoMovia) { runtime.joyX = mueve ? x : 0; runtime.joyY = mueve ? -y : 0 } // (sin pisar el joystick en pantalla)
            this._mandoMovia = mueve
        }
        if (gat !== !!this._mandoGat) { this._mandoGat = gat; tecla(gat ? 'keydown' : 'keyup', 'KeyE'); tecla(gat ? 'keydown' : 'keyup', 'Space') }
    },
    // vista previa en el computador: el mouse hace de rayo (index.js)
    simular(tipo, x, y) {
        const m = this._sim ||= { gatillo: false, objetivo: null, panel: null }
        m.panel = x === undefined ? null : { x, y }
        if (tipo === 'down') apretar(m); else if (tipo === 'up') soltar(m); else arrastrar(m)
    }
}
