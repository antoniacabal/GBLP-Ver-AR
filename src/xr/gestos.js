// Indice
    // 0. Imports y utilidades
    // 1. Lectura de las manos (articulaciones del seguimiento de manos de las gafas)
    // 2. Respirar: puño cerrado = inhalar y sostener · mano abierta = exhalar
    // 3. Reconstruir la gravedad: una barra imaginaria agarrada con las dos manos
    // 4. Conteo de grounding: mostrar los dedos
    // 5. Foco entre el ruido: pellizcar y girar la muñeca (el dial)
    // 6. Salida rápida: las dos palmas hacia adelante
    // 7. Controles de Meta: solo para salir
    // 8. Sistema de gestos (IWSDK)

// Gestos de las manos (etapa 6). El juego ya entiende la barra espaciadora (respirar), A / D (gravedad y foco) y los clics en los números
// (conteo): los gestos se traducen a eso, así la lógica de los minijuegos no cambia (los tiempos y las condiciones son los de siempre).
//   · puño cerrado ............ inhalar y sostener (la barra espaciadora apretada) · mano abierta: exhalar (soltarla)
//   · las dos manos pellizcando e inclinando la barra entre ellas ... enderezar el marco (gravedad)
//   · dedos levantados (una o dos manos), quietos un momento ......... elegir ese número (conteo)
//   · pellizcar y girar la muñeca ..................................... girar el dial (foco)
//   · las dos palmas abiertas hacia adelante .......................... salida rápida
//   · pellizcar apuntando al panel ..................................... elegir (xr/panel.js)
// Para que no se confundan: la mano que está agarrando el joystick o cerca del botón de la mesa no cuenta para estos gestos.
// IWSDK no reconoce gestos: se calculan con las articulaciones de las manos (WebXR Hand Input) que entrega la sesión.

// 0. Imports y utilidades
import * as THREE from 'three'
import { createSystem, Grabbed } from '@iwsdk/core'
import { runtime } from '../game/config.js'
import { breathing } from '../game/breathing.js'
import { colocacion } from './colocacion.js'
import { mesa } from './joystick.js'

const V = () => new THREE.Vector3()
const tecla = (tipo, code) => dispatchEvent(new KeyboardEvent(tipo, { code, key: code === 'Space' ? ' ' : code, bubbles: true }))
const tocar = (el) => { // un toque en un botón de la interfaz (los números del conteo responden a pointerdown)
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    for (const tipo of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 43, pointerType: 'touch', isPrimary: true, button: 0, buttons: tipo === 'pointerdown' ? 1 : 0 }))
}

// 1. Lectura de las manos: cada cuadro, las articulaciones que importan (en metros, en el espacio de referencia de la sesión)
const ART = ['wrist', 'thumb-tip', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-tip', 'middle-finger-phalanx-proximal', 'middle-finger-tip',
    'ring-finger-phalanx-proximal', 'ring-finger-tip', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-tip']
const crearMano = () => ({ ok: false, libre: false, p: Object.fromEntries(ART.map(n => [n, V()])), pellizco: false, puno: false, abierta: false, dedos: 0 })
const manos = { left: crearMano(), right: crearMano() }
const cabeza = { p: V(), q: new THREE.Quaternion() }
function leer(frame, ref, sesion) {
    manos.left.ok = manos.right.ok = false
    const vista = frame.getViewerPose(ref)
    if (vista) { const t = vista.transform; cabeza.p.set(t.position.x, t.position.y, t.position.z); cabeza.q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w) }
    for (const src of sesion.inputSources) {
        const m = src.hand && manos[src.handedness]; if (!m) continue
        let ok = true
        for (const n of ART) {
            const j = src.hand.get(n), pose = j && frame.getJointPose?.(j, ref)
            if (!pose) { ok = false; break }
            const t = pose.transform.position; m.p[n].set(t.x, t.y, t.z)
        }
        m.ok = ok; if (!ok) continue
        const P = m.p, d = (a, b) => P[a].distanceTo(P[b])
        const pz = d('thumb-tip', 'index-finger-tip'); m.pellizco = m.pellizco ? pz < 0.045 : pz < 0.025 // (con histéresis: no parpadea)
        const puntas = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'].reduce((s, n) => s + d(n, 'wrist'), 0) / 4
        m.puno = m.puno ? puntas < 0.11 : puntas < 0.085 // las cuatro puntas cerca de la muñeca
        m.abierta = puntas > 0.145
        const larga = (f) => d(f + '-tip', 'wrist') > d(f + '-phalanx-proximal', 'wrist') + 0.04 // la punta bastante más lejos que su nudillo
        m.dedos = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].filter(larga).length + (d('thumb-tip', 'pinky-finger-metacarpal') > 0.085 ? 1 : 0)
    }
}
// ¿la mano está ocupada con los controles de la mesa? (agarrando el joystick o a menos de 14 cm de él o del botón)
const w = V(), r = V()
function ocupada(m, refAMundo, joyAgarrado) {
    if (joyAgarrado && m.pellizco) return true
    if (!mesa.visible) return false
    w.copy(m.p['index-finger-tip']).applyMatrix4(refAMundo)
    return mesa.children.some(c => c.getWorldPosition(r).distanceTo(w) < 0.14)
}

// 2. Respirar (en los minijuegos de respiración): cualquier mano libre con el puño cerrado aprieta la barra espaciadora
let respirando = false
function respirar() {
    const juega = breathing.active && !['gravedad', 'foco', 'conteo', 'earth'].includes(runtime.techId)
    const puno = juega && ['left', 'right'].some(l => manos[l].libre && manos[l].puno)
    if (puno === respirando) return
    respirando = puno; tecla(puno ? 'keydown' : 'keyup', 'Space')
}

// 3. Gravedad: las dos manos pellizcando; si la barra entre ellas se inclina, se empuja el marco hacia ese lado (A / D).
//    La mano derecha más arriba gira la barra hacia la izquierda: A (empuja a la izquierda)
let empuje = 0
function gravedad() {
    const L = manos.left, R = manos.right
    const juega = breathing.active && runtime.techId === 'gravedad' && L.libre && R.libre && L.pellizco && R.pellizco
    let d = 0
    if (juega) {
        const a = L.p['index-finger-tip'], b = R.p['index-finger-tip']
        const ang = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z))
        d = ang > 0.12 ? -1 : ang < -0.12 ? 1 : 0
    }
    if (d === empuje) return
    if (empuje) tecla('keyup', empuje < 0 ? 'KeyA' : 'KeyD')
    empuje = d; if (d) tecla('keydown', d < 0 ? 'KeyA' : 'KeyD')
}

// 4. Conteo: los dedos levantados de las dos manos; si la cuenta se queda igual 0.7 s, se elige ese número (si está entre las opciones).
//    Para elegir otro hay que cambiar la cuenta
let cuenta = -1, quieta = 0, elegida = -1
function conteo(dt) {
    if (!(breathing.active && runtime.techId === 'conteo') || !(manos.left.ok || manos.right.ok)) { cuenta = -1; elegida = -1; return }
    const n = (manos.left.ok ? manos.left.dedos : 0) + (manos.right.ok ? manos.right.dedos : 0)
    if (n !== cuenta) { cuenta = n; quieta = 0; if (n !== elegida) elegida = -1; return }
    if ((quieta += dt) < 0.7 || elegida === n) return
    const b = [...document.querySelectorAll('.gx-conteo-op')].find(b => b.textContent.trim() === String(n))
    if (b) { elegida = n; tocar(b) }
}

// 5. Foco: pellizcando, el giro de la muñeca (visto desde quien juega) gira el dial (como la rueda del mouse sobre el dial)
let giroAntes = null
const adelante = V(), arriba = V(), derecha = V(), tmp = V()
function foco() {
    const m = manos.right.libre && manos.right.pellizco ? manos.right : manos.left.libre && manos.left.pellizco ? manos.left : null
    const dial = breathing.active && runtime.techId === 'foco' && m && document.querySelector('.gx-foco-dial')
    if (!dial) { giroAntes = null; return }
    adelante.set(0, 0, -1).applyQuaternion(cabeza.q); arriba.set(0, 1, 0).applyQuaternion(cabeza.q); derecha.crossVectors(adelante, arriba)
    tmp.subVectors(m.p['pinky-finger-metacarpal'], m.p['index-finger-metacarpal']) // atraviesa la palma: gira con la muñeca
    const ang = Math.atan2(tmp.dot(arriba), tmp.dot(derecha))
    if (giroAntes !== null) {
        let d = ang - giroAntes; d = Math.atan2(Math.sin(d), Math.cos(d))
        if (Math.abs(d) > 0.002) dial.dispatchEvent(new WheelEvent('wheel', { deltaY: d * 500, bubbles: true, cancelable: true })) // a la derecha sube
    }
    giroAntes = ang
}

// 6. Salida rápida: las dos manos libres, abiertas, con las palmas hacia adelante, durante 0.7 s
let palmas = 0, esperaSalida = 0
const palmaAdelante = (m, izq) => {
    const a = V().subVectors(m.p['index-finger-metacarpal'], m.p.wrist), b = V().subVectors(m.p['pinky-finger-metacarpal'], m.p.wrist)
    return (izq ? b.cross(a) : a.cross(b)).normalize().dot(adelante) > 0.55
}
function salida(dt) {
    esperaSalida = Math.max(0, esperaSalida - dt)
    adelante.set(0, 0, -1).applyQuaternion(cabeza.q)
    const L = manos.left, R = manos.right
    const ok = L.libre && R.libre && L.abierta && R.abierta && palmaAdelante(L, true) && palmaAdelante(R, false)
    palmas = ok ? palmas + dt : 0
    if (palmas > 0.7 && !esperaSalida && !runtime.paused && runtime.state !== 'BREATHING') { palmas = 0; esperaSalida = 2.5; document.querySelector('.gx-exit')?.click() }
}

// 7. Controles de Meta: no tocan la maqueta ni la actividad; solo sirven para salir.
//    B o Y: abre la salida rápida (y, si ya está abierta, vuelve al juego) · A o X con la salida rápida abierta: "Parar" (sale del juego)
const antes = new Map()
function controles(sesion) {
    for (const src of sesion.inputSources) {
        if (src.hand || !src.gamepad) continue
        const b = src.gamepad.buttons.map(x => x.pressed), a = antes.get(src) || []; antes.set(src, b)
        const nuevo = (i) => b[i] && !a[i]
        const pausa = document.querySelector('.gx-pause:not([hidden])')
        if (nuevo(5)) (pausa ? pausa.querySelector('[data-act="go"]') : document.querySelector('.gx-exit'))?.click()
        if (nuevo(4) && pausa) pausa.querySelector('[data-act="stop"]')?.click()
    }
}

// 8. Sistema de gestos
const refAMundo = new THREE.Matrix4()
export class SistemaGestos extends createSystem({ agarrados: { required: [Grabbed] } }) {
    update(delta) {
        const sesion = this.world.session, frame = this.world.renderer.xr.getFrame?.(), ref = this.world.renderer.xr.getReferenceSpace?.()
        if (!sesion || !frame || !ref) return this.soltar()
        controles(sesion)
        if (!colocacion.puesta || colocacion.colocando) return this.soltar()
        leer(frame, ref, sesion)
        // del espacio de referencia de la sesión al mundo de IWSDK (las manos se miden allá; la mesa está acá)
        refAMundo.copy(this.world.player.matrixWorld)
        const ents = this.queries.agarrados.entities, joyAgarrado = (ents.size ?? ents.length) > 0
        for (const l of ['left', 'right']) manos[l].libre = manos[l].ok && !ocupada(manos[l], refAMundo, joyAgarrado)
        respirar(); gravedad(); conteo(delta); foco(); salida(delta)
    }
    // las teclas que algún gesto dejó apretadas se sueltan (al pausar, recolocar o salir de las gafas)
    soltar() {
        if (respirando) { respirando = false; tecla('keyup', 'Space') }
        if (empuje) { tecla('keyup', empuje < 0 ? 'KeyA' : 'KeyD'); empuje = 0 }
        giroAntes = null; palmas = 0
    }
}
