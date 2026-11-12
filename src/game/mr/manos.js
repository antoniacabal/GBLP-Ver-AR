// Indice
    // 0. Imports y utilidades
    // 1. Lectura de las manos (articulaciones de WebXR hand-tracking)
    // 2. Joystick sobre la mesa (mano izquierda): caminar
    // 3. Botón sobre la mesa (mano derecha): interactuar
    // 4. Respirar: puño cerrado = sostener, mano abierta = soltar
    // 5. Reconstruir la gravedad: una barra que se agarra con las dos manos y se inclina
    // 6. Conteo de grounding: mostrar los dedos
    // 7. Foco entre el ruido: agarrar el dial en el aire y girar la muñeca
    // 8. Salida rápida: las dos palmas hacia adelante
    // 9. API pública (manos)

// El juego se juega con las manos (sin controles), como en los dibujos de interacciones ar/gestos:
//   · joystick: un palito con una bola sobre la mesa, a la izquierda de la maqueta. Se pellizca la bola y se empuja (adelante = hacia el
//     fondo de la maqueta, lejos de ti). Gabriela se queda en el centro y el mapa se mueve
//   · botón: sobre la mesa, a la derecha. Se hunde con el índice: interactúa, avanza los diálogos y las tarjetas
//   · respiración: puño cerrado mientras inhalas y sostienes, mano abierta al exhalar
//   · gravedad: pellizca con las dos manos los extremos de una barra imaginaria e inclínala para enderezar el marco
//   · conteo: levanta tantos dedos como los que ves (con una o las dos manos) y quédate así un momento
//   · sonido (foco): pellizca en el aire y gira la muñeca como si giraras el dial
//   · salida rápida: las dos manos abiertas con las palmas hacia adelante
//   · seleccionar en el panel: apuntar y pellizcar (eso ya lo hace controles.js con el rayo de cada mano)
// Las manos reales se ven por el passthrough (y con depth-sensing tapan la maqueta): aquí solo se dibujan el joystick y el botón

// 0. Imports y utilidades
import * as THREE from 'three'
import { runtime } from '../config.js'
import { breathing } from '../breathing.js'
import { rig } from './diorama.js'
import { haciaJoy } from './controles.js'
import { mr } from './estado.js'

const V = () => new THREE.Vector3()
const tecla = (tipo, code) => dispatchEvent(new KeyboardEvent(tipo, { code, key: code === 'Space' ? ' ' : code, bubbles: true }))
const puntero = (tipo, el) => { const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 42, pointerType: 'touch', isPrimary: true, button: 0, buttons: tipo === 'pointerdown' ? 1 : 0 })) }
const visible = (sel) => { const el = document.querySelector(sel); return el && !el.hidden && getComputedStyle(el).display !== 'none' ? el : null }

// 1. Lectura de las manos: cada cuadro, las articulaciones que importan de cada mano (en metros, espacio real)
const ART = ['wrist', 'thumb-tip', 'thumb-metacarpal', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-tip',
    'middle-finger-phalanx-proximal', 'middle-finger-tip', 'ring-finger-phalanx-proximal', 'ring-finger-tip', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-tip']
const crearMano = () => ({ ok: false, p: Object.fromEntries(ART.map(n => [n, V()])), pellizco: false, puno: false, abierta: false, dedos: 0 })
const manos = { left: crearMano(), right: crearMano() }
function leer(frame, ref) {
    manos.left.ok = manos.right.ok = false
    for (const src of mr.sesion?.inputSources || []) {
        if (!src.hand || !manos[src.handedness]) continue
        const m = manos[src.handedness]; let ok = true
        for (const n of ART) {
            const j = src.hand.get(n), pose = j && frame.getJointPose?.(j, ref)
            if (!pose) { ok = false; break }
            const t = pose.transform.position; m.p[n].set(t.x, t.y, t.z)
        }
        m.ok = ok; if (!ok) continue
        const P = m.p, d = (a, b) => P[a].distanceTo(P[b])
        // pellizco (con histéresis: no parpadea en el borde)
        const pz = d('thumb-tip', 'index-finger-tip'); m.pellizco = m.pellizco ? pz < 0.045 : pz < 0.025
        // puño: las cuatro puntas cerca de la muñeca · abierta: lejos
        const puntas = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'].reduce((s, n) => s + d(n, 'wrist'), 0) / 4
        m.puno = m.puno ? puntas < 0.11 : puntas < 0.085
        m.abierta = puntas > 0.145
        // dedos levantados: la punta bastante más lejos de la muñeca que su nudillo (el pulgar: lejos del meñique)
        const largo = (f) => d(f + '-tip', 'wrist') > d(f + '-phalanx-proximal', 'wrist') + 0.04
        m.dedos = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].filter(largo).length + (d('thumb-tip', 'pinky-finger-metacarpal') > 0.085 ? 1 : 0)
    }
}
const hayManos = () => manos.left.ok || manos.right.ok

// Los controles de la mesa se ponen junto a la bandeja, del lado de quien juega (se acomodan al poner la maqueta)
const mesa = new THREE.Group(); mesa.visible = false; rig.add(mesa)
const MAT = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })
let clave = ''
function acomodar() {
    const b = rig.getObjectByName('bandeja'); if (!b) return
    // solo cuando la bandeja cambia (al ponerla, al cambiar de espacio): si siguiera a la cabeza, los controles se correrían al moverte
    const k = [b.position.x, b.position.z, b.scale.x, b.scale.z, mr.ancla.p.y].map(v => v.toFixed(2)).join()
    if (k === clave) return
    clave = k
    const hacia = V().subVectors(mr.cabeza, b.position); hacia.y = 0; if (hacia.lengthSq() < 1e-4) hacia.set(0, 0, 1); hacia.normalize()
    mesa.position.set(b.position.x, mr.ancla.p.y, b.position.z); mesa.rotation.set(0, Math.atan2(hacia.x, hacia.z), 0)
    const fondo = Math.max(b.scale.x, b.scale.z) / 2 // (hasta el borde de la bandeja, hacia ti)
    joy.base.position.set(-0.2, 0, fondo + 0.09); boton.base.position.set(0.2, 0, fondo + 0.09)
}

// 2. Joystick: base, palito y bola. La bola se pellizca y se arrastra (hasta 5 cm); al soltar vuelve al centro
const RADIO_JOY = 0.05
const joy = (() => {
    const base = new THREE.Group()
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.012, 32), MAT(0x201826)); disco.position.y = 0.006
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 8, 40).rotateX(Math.PI / 2), MAT(0xf2c063, { emissive: 0x6a4a10 })); aro.position.y = 0.013
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 12), MAT(0x71708a))
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 16), MAT(0xf2c063, { emissive: 0x3a2a08 }))
    base.add(disco, aro, palo, bola); mesa.add(base)
    return { base, palo, bola, agarrada: null, off: V() }
})()
const ALTO_BOLA = 0.07
function ponerBola() { // el palito va de la base a la bola
    const b = joy.bola.position.set(joy.off.x, ALTO_BOLA, joy.off.z)
    const largo = b.length(); joy.palo.position.copy(b).multiplyScalar(0.5); joy.palo.scale.set(1, largo, 1)
    joy.palo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().normalize())
}
ponerBola()
const tmp = V(), mundo = V()
function joystick() {
    const m = manos.left.ok ? manos.left : manos.right.ok ? manos.right : null
    if (!m) { joy.agarrada = null }
    mesa.updateMatrixWorld(true)
    const centro = joy.bola.getWorldPosition(V()); rig.worldToLocal(centro) // (espacio real)
    const pinza = m && V().addVectors(m.p['thumb-tip'], m.p['index-finger-tip']).multiplyScalar(0.5)
    if (!joy.agarrada && m?.pellizco && pinza.distanceTo(centro) < 0.06) joy.agarrada = { m, desde: pinza.clone(), off0: joy.off.clone() }
    if (joy.agarrada && !joy.agarrada.m.pellizco) joy.agarrada = null
    if (joy.agarrada) { // la bola sigue a la pinza (en el plano de la mesa, girado como la base)
        tmp.subVectors(pinza, joy.agarrada.desde); tmp.y = 0
        tmp.applyQuaternion(mesa.quaternion.clone().invert())
        joy.off.copy(joy.agarrada.off0).add(tmp); if (joy.off.length() > RADIO_JOY) joy.off.setLength(RADIO_JOY)
    } else joy.off.multiplyScalar(0.7) // suelta: vuelve al centro
    ponerBola()
    if (!joy.agarrada || joy.off.length() < RADIO_JOY * 0.18) return false
    // de la mesa al mundo del juego: empujar hacia el fondo (lejos de ti, -z de la base) lleva a Gabriela hacia el fondo de la maqueta
    mundo.copy(joy.off).applyQuaternion(mesa.quaternion).applyQuaternion(rig.quaternion).divideScalar(RADIO_JOY)
    const [jx, jy] = haciaJoy(mundo.x, mundo.z); runtime.joyX = jx; runtime.joyY = jy
    return true
}

// 3. Botón: una base y una tapa que se hunde con la punta del índice (de cualquier mano)
const boton = (() => {
    const base = new THREE.Group()
    const caja = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.014, 32), MAT(0x201826)); caja.position.y = 0.007
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 32), MAT(0xbf4e24, { emissive: 0x2a0a02 })); tapa.position.y = 0.02
    base.add(caja, tapa); mesa.add(base)
    return { base, tapa, hundido: false }
})()
const TAPA = 0.027
function apretarBoton() {
    let fondo = 0
    for (const m of [manos.left, manos.right]) {
        if (!m.ok) continue
        const p = boton.base.worldToLocal(rig.localToWorld(m.p['index-finger-tip'].clone()))
        if (Math.hypot(p.x, p.z) < 0.04 && p.y < TAPA + 0.02 && p.y > -0.02) fondo = Math.max(fondo, TAPA - p.y)
    }
    boton.tapa.position.y = 0.02 - Math.min(0.009, Math.max(0, fondo))
    const ahora = boton.hundido ? fondo > 0.002 : fondo > 0.007
    if (ahora === boton.hundido) return
    boton.hundido = ahora
    boton.tapa.material.emissive.setHex(ahora ? 0x7a2a0a : 0x2a0a02)
    if (ahora) { // como el botón táctil "Interactuar" (E y espacio); con una tarjeta en pantalla, la adelanta
        const card = visible('.gx-card'); if (card) card.click()
        tecla('keydown', 'KeyE'); tecla('keydown', 'Space'); vibrarMano()
    } else { tecla('keyup', 'KeyE'); tecla('keyup', 'Space') }
}

// 4. Respirar: en los minijuegos de respiración, cerrar el puño (cualquier mano) es sostener la barra espaciadora
let respirando = false
function respirar() {
    const juega = breathing.active && !['gravedad', 'foco', 'conteo', 'earth'].includes(runtime.techId)
    const puno = juega && (manos.left.ok && manos.left.puno || manos.right.ok && manos.right.puno)
    if (puno === respirando) return
    respirando = puno; tecla(puno ? 'keydown' : 'keyup', 'Space')
}

// 5. Gravedad: las dos manos pellizcando; si la barra entre ellas se inclina, se empuja el marco (A / D). Mano derecha más arriba = la
//    barra gira hacia la izquierda = A
let empuje = 0
function gravedad() {
    const juega = breathing.active && runtime.techId === 'gravedad' && manos.left.ok && manos.right.ok && manos.left.pellizco && manos.right.pellizco
    let d = 0
    if (juega) {
        const L = manos.left.p['index-finger-tip'], R = manos.right.p['index-finger-tip']
        const ang = Math.atan2(R.y - L.y, Math.hypot(R.x - L.x, R.z - L.z))
        d = ang > 0.12 ? -1 : ang < -0.12 ? 1 : 0
    }
    if (d === empuje) return
    if (empuje) tecla('keyup', empuje < 0 ? 'KeyA' : 'KeyD')
    empuje = d; if (d) tecla('keydown', d < 0 ? 'KeyA' : 'KeyD')
}

// 6. Conteo: los dedos levantados de las dos manos; si la cuenta se queda igual 0.7 s, se elige ese número (si está entre las opciones)
let cuenta = -1, quieta = 0, elegida = -1
function conteo(dt) {
    if (!(breathing.active && runtime.techId === 'conteo') || !hayManos()) { cuenta = -1; elegida = -1; return }
    const n = (manos.left.ok ? manos.left.dedos : 0) + (manos.right.ok ? manos.right.dedos : 0)
    if (n !== cuenta) { cuenta = n; quieta = 0; if (n !== elegida) elegida = -1; return }
    if ((quieta += dt) < 0.7 || elegida === n) return
    const b = [...document.querySelectorAll('.gx-conteo-op')].find(b => b.textContent.trim() === String(n))
    if (b) { elegida = n; puntero('pointerdown', b); setTimeout(() => puntero('pointerup', b), 120); vibrarMano() }
}

// 7. Foco: pellizcando, el giro de la muñeca (visto desde quien juega) gira el dial. Se manda como la rueda del mouse sobre el dial
let giroAntes = null
const adelante = V(), arriba = V(), derecha = V()
function foco() {
    const m = manos.right.ok && manos.right.pellizco ? manos.right : manos.left.ok && manos.left.pellizco ? manos.left : null
    const dial = breathing.active && runtime.techId === 'foco' && m && document.querySelector('.gx-foco-dial')
    if (!dial) { giroAntes = null; return }
    adelante.set(0, 0, -1).applyQuaternion(mr.cabezaQ); arriba.set(0, 1, 0).applyQuaternion(mr.cabezaQ); derecha.crossVectors(adelante, arriba)
    tmp.subVectors(m.p['pinky-finger-metacarpal'], m.p['index-finger-metacarpal']) // atraviesa la palma: gira con la muñeca
    const ang = Math.atan2(tmp.dot(arriba), tmp.dot(derecha))
    if (giroAntes !== null) {
        let d = ang - giroAntes; d = Math.atan2(Math.sin(d), Math.cos(d))
        if (Math.abs(d) > 0.002) dial.dispatchEvent(new WheelEvent('wheel', { deltaY: d * 500, bubbles: true, cancelable: true })) // girar a la derecha sube el dial
    }
    giroAntes = ang
}

// 8. Salida rápida: las dos manos abiertas, con las palmas hacia adelante, durante 0.7 s
let palmas = 0, esperaSalida = 0
const palmaAdelante = (m, izq) => {
    const a = V().subVectors(m.p['index-finger-metacarpal'], m.p.wrist), b = V().subVectors(m.p['pinky-finger-metacarpal'], m.p.wrist)
    const n = izq ? b.cross(a) : a.cross(b); return n.normalize().dot(adelante) > 0.55
}
function salida(dt) {
    esperaSalida = Math.max(0, esperaSalida - dt)
    adelante.set(0, 0, -1).applyQuaternion(mr.cabezaQ)
    const ok = manos.left.ok && manos.right.ok && manos.left.abierta && manos.right.abierta && palmaAdelante(manos.left, true) && palmaAdelante(manos.right, false)
    palmas = ok ? palmas + dt : 0
    if (palmas > 0.7 && !esperaSalida && !runtime.paused) { palmas = 0; esperaSalida = 2.5; document.querySelector('.gx-exit')?.click(); vibrarMano() }
}

const vibrarMano = () => {} // (las manos no vibran; queda el lugar por si se usan controles)

// 9. API pública
export const gestos = {
    get activas() { return hayManos() },
    // cada cuadro en las gafas (index.js): lee las manos y aplica los gestos
    actualizar(frame, ref, dt) {
        if (!frame || !mr.sesion) { mesa.visible = false; return }
        leer(frame, ref)
        mesa.visible = hayManos() && mr.ancla.puesta && !mr.colocando
        if (!hayManos()) { if (respirando) { respirando = false; tecla('keyup', 'Space') } if (empuje) { tecla('keyup', empuje < 0 ? 'KeyA' : 'KeyD'); empuje = 0 } return }
        if (mr.colocando) return
        acomodar()
        joystick(); apretarBoton(); respirar(); gravedad(); conteo(dt); foco(); salida(dt)
    },
    // las teclas que alguno de los gestos dejó apretadas se sueltan (al salir de las gafas o al pausar)
    soltar() { if (respirando) tecla('keyup', 'Space'); if (empuje) tecla('keyup', empuje < 0 ? 'KeyA' : 'KeyD'); if (boton.hundido) { tecla('keyup', 'KeyE'); tecla('keyup', 'Space') } respirando = false; empuje = 0; boton.hundido = false; joy.agarrada = null }
}
