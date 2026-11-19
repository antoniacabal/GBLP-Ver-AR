// Indice
    // 0. Imports
    // 1. La plataforma: base 3D ligeramente elevada (2 cm) sobre la mesa
    // 2. Retículas: siguen el rayo de cada mano sobre las superficies reales (environment raycast)
    // 3. Botón de recolocar (en una esquina de la plataforma, se toca con el dedo)
    // 4. Las dos manos apoyadas en la mesa (la forma principal de colocarla, dibujo "Detección del espacio")
    // 5. Sistema de colocación (IWSDK)

// Colocación de la experiencia sobre una superficie real (como en los dibujos "Detección del espacio"):
//   1. al entrar a la realidad aumentada, el juego se pausa y las superficies que detectan las gafas se ven como una malla (IWSDK: Scene
//      Understanding, sus planos y mallas en alambre)
//   2. apoyas las dos manos abiertas sobre la mesa: aparece el contorno de la plataforma delante de ellas y se va llenando de dorado
//   3. si las dejas quietas un momento, la plataforma aparece ahí, 2 cm por encima de la mesa, de frente a quien juega
//   4. la plataforma queda anclada al espacio real (IWSDK: XRAnchor) y el juego sigue
// También se puede apuntar con una mano (una retícula sigue su rayo: IWSDK EnvironmentRaycastTarget, hit-test contra las superficies) y
// pellizcar donde la retícula se vea dorada (una superficie horizontal: mesa, piso o mueble).
// Para moverla: el botón pequeño de la esquina (se toca con el índice) vuelve al paso 1.
// Los controles de Meta no colocan nada (solo sirven para salir: así lo pidió el equipo); solo las manos.

// 0. Imports
import * as THREE from 'three'
import { createSystem, EnvironmentRaycastTarget, RaycastSpace, XRAnchor, XRPlane, PokeInteractable, Pressed, SceneUnderstandingSystem } from '@iwsdk/core'
import gsap from 'gsap'
import { runtime } from '../game/config.js'
import { mundo, entidades } from './estado.js'
import { plataforma } from './maqueta.js'
import { manos, normalPalma, centroPalma } from './manos.js'

export const LADO = 0.5, ALTO = 0.02 // plataforma de 50 cm, 2 cm sobre la mesa
const DORADO = 0xf2c063, LILA = 0xa6869b, MORADO = 0x201826
const estado = { colocando: false, puesta: false }
export const colocacion = estado

// 1. La plataforma: una losa morada con el borde dorado (los colores del juego). El juego se apoya encima (y = 0 de la plataforma)
const base = new THREE.Group(); base.name = 'base'
{
    const losa = new THREE.Mesh(new THREE.BoxGeometry(LADO, ALTO, LADO), new THREE.MeshStandardMaterial({ color: MORADO, roughness: 0.85 }))
    losa.position.y = -ALTO / 2 - 0.0015 // (1.5 mm debajo del piso del juego: sin parpadeo entre los dos)
    const borde = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x * LADO / 2, 0.0005, z * LADO / 2))), new THREE.LineBasicMaterial({ color: DORADO }))
    base.add(losa, borde)
}
plataforma.add(base)

// 2. Retículas: un aro y el contorno de la plataforma, donde caería
function crearReticula() {
    const g = new THREE.Group()
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.045, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: DORADO, transparent: true, opacity: 0.95, depthWrite: false }))
    const marco = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x * LADO / 2, 0.003, z * LADO / 2))), new THREE.LineBasicMaterial({ color: DORADO, transparent: true, opacity: 0.7 }))
    g.add(aro, marco); g.visible = false
    g.userData.pintar = (c) => { aro.material.color.setHex(c); marco.material.color.setHex(c) }
    return g
}
const reticulas = { left: null, right: null }

// 3. Botón de recolocar: un botón pequeño (2.4 cm) en la esquina de atrás a la derecha de la plataforma, con el ícono de un ancla
const recolocar = new THREE.Group(); recolocar.name = 'recolocar'
{
    const caja = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.01, 24), new THREE.MeshStandardMaterial({ color: MORADO }))
    caja.position.y = 0.005
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 24), new THREE.MeshStandardMaterial({ color: LILA, emissive: 0x1a0f1a }))
    tapa.position.y = 0.012; tapa.name = 'tapa'
    recolocar.add(caja, tapa); recolocar.position.set(LADO / 2 - 0.03, 0, -LADO / 2 + 0.03)
}
plataforma.add(recolocar)

// pausa del juego mientras se coloca (y se reanuda al terminar)
let pausadoAqui = false
function pausar(v) {
    if (v && !runtime.paused) { pausadoAqui = true; runtime.paused = true; gsap.globalTimeline.pause() }
    if (!v && pausadoAqui) { pausadoAqui = false; runtime.paused = false; gsap.globalTimeline.resume() }
}

// 4. Las dos manos apoyadas en la mesa: abiertas, con las palmas hacia abajo, a la misma altura (por debajo de la cabeza), separadas
//    como al apoyarlas y quietas. Mientras se cumple, el contorno de la plataforma aparece delante de ellas y se llena en QUIETAS s;
//    la plataforma va justo delante de las puntas de los dedos (así el joystick y el botón quedan donde estaban las manos)
const QUIETAS = 0.9
const vista = crearReticula(); vista.children[0].visible = false // (la vista previa: solo el contorno, sin el aro)
const relleno = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: DORADO, transparent: true, opacity: 0.35, depthWrite: false }))
relleno.position.y = 0.002; vista.add(relleno)
const apoyo = { t: 0, antes: [new THREE.Vector3(), new THREE.Vector3()] }
const nP = new THREE.Vector3(), cP = [new THREE.Vector3(), new THREE.Vector3()], medio = new THREE.Vector3(), haciaDelante = new THREE.Vector3()
function manosApoyadas(refAMundo, cabezaMundo) {
    for (const [i, l] of ['left', 'right'].entries()) {
        const m = manos[l]
        if (!m.ok || !m.abierta || normalPalma(m, l, nP).y > -0.75) return false // abierta y la palma hacia abajo
        centroPalma(m, cP[i]).applyMatrix4(refAMundo)
    }
    const sep = Math.hypot(cP[0].x - cP[1].x, cP[0].z - cP[1].z)
    if (Math.abs(cP[0].y - cP[1].y) > 0.05 || sep < 0.12 || sep > 0.8) return false
    if (cabezaMundo.y - (cP[0].y + cP[1].y) / 2 < 0.25) return false // (por debajo de la cabeza: sobre una mesa o el piso, no en el aire)
    return true
}
// la plataforma delante de las manos: en la dirección en que mira quien juega, a la altura de la mesa (el plano horizontal que hay justo
// debajo de las palmas, si las gafas lo detectaron; si no, 2 cm debajo del centro de las palmas)
function dondeVa(planos, cabezaMundo, out) {
    medio.addVectors(cP[0], cP[1]).multiplyScalar(0.5)
    haciaDelante.set(medio.x - cabezaMundo.x, 0, medio.z - cabezaMundo.z).normalize()
    let y = medio.y - 0.02, mejor = 0.07
    for (const e of planos) {
        const p = e.getValue(XRPlane, '_plane'), o = e.object3D
        if (!p || p.orientation !== 'horizontal' || !o) continue
        const d = medio.y - o.getWorldPosition(nP).y
        if (d > -0.01 && d < mejor) { mejor = d; y = nP.y }
    }
    // (la plataforma va girada 45°: su esquina queda frente a los dedos)
    return out.copy(medio).addScaledVector(haciaDelante, 0.1 + LADO * Math.SQRT1_2 + 0.02).setY(y)
}

// el letrero mientras se coloca: un rótulo pequeño, abajo y delante de la vista (sigue la cabeza con suavidad, sin pegarse a ella)
const letrero = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 200
    const g = c.getContext('2d')
    const dibujar = () => {
    g.clearRect(0, 0, 1024, 200); g.fillStyle = 'rgba(32,24,38,0.88)'; g.beginPath(); g.roundRect(4, 4, 1016, 192, 40); g.fill()
    g.strokeStyle = 'rgba(242,192,99,0.8)'; g.lineWidth = 4; g.stroke()
    g.fillStyle = '#E4FFFF'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = '700 50px Outfit, sans-serif'; g.fillText('Apoya las dos manos abiertas sobre la mesa', 512, 78)
    g.font = '400 36px Outfit, sans-serif'; g.fillStyle = '#d9c6d3'; g.fillText('o apunta a una superficie y pellizca', 512, 140)
    }
    dibujar()
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.07), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false }))
    m.renderOrder = 20; m.visible = false
    document.fonts?.ready.then(() => { dibujar(); t.needsUpdate = true }) // (por si la letra Outfit carga después)
    return m
})()
const frente = new THREE.Vector3(), meta = new THREE.Vector3(), qCab = new THREE.Quaternion()
function seguirCabeza(camara, dt, saltar) {
    camara.getWorldPosition(cab); camara.getWorldQuaternion(qCab)
    frente.set(0, 0, -1).applyQuaternion(qCab).setY(0).normalize()
    meta.copy(cab).addScaledVector(frente, 0.6); meta.y -= 0.22
    if (saltar) letrero.position.copy(meta); else letrero.position.lerp(meta, 1 - Math.exp(-dt * 3))
    letrero.lookAt(cab)
}

// 5. Sistema de colocación
const up = new THREE.Vector3(), pos = new THREE.Vector3(), cab = new THREE.Vector3(), q = new THREE.Quaternion()
const ETIQUETAS_BUENAS = ['table', 'desk', 'floor', 'couch', 'bed', 'storage', 'other', '']
export class SistemaColocacion extends createSystem({
    planos: { required: [XRPlane] },
    boton: { required: [PokeInteractable] }
}) {
    init() {
        this.entPlataforma = this.world.createTransformEntity(plataforma); entidades.plataforma = this.entPlataforma // (los controles de la mesa se cuelgan de ella)
        this.entRet = {}
        for (const lado of ['left', 'right']) { const r = crearReticula(); reticulas[lado] = r; this.entRet[lado] = this.world.createTransformEntity(r) }
        // el botón de recolocar: se toca con el índice (poke). Sin rayo: el rayo también puede venir de un control de Meta
        this.entBoton = this.world.createTransformEntity(recolocar, { parent: this.entPlataforma })
        this.entBoton.addComponent(PokeInteractable)
        this.antesPresionado = false
        this.sesion = null
        this.world.createTransformEntity(vista); vista.visible = false
        this.world.createTransformEntity(letrero)
        this.refAMundo = new THREE.Matrix4(); this.lugar = new THREE.Vector3()
    }
    // la malla de las superficies detectadas (Scene Understanding) solo se ve mientras se coloca, en los colores del juego
    escaneo(si) {
        const su = this.world.getSystem?.(SceneUnderstandingSystem)
        if (!su?.config?.showWireFrame) return
        if (si && su.planeMaterial && !su.planeMaterial.userData.gblp) {
            su.planeMaterial.color.setHex(LILA); su.planeMaterial.opacity = 0.45; su.planeMaterial.userData.gblp = true
            su.meshMaterial?.color.setHex(DORADO); if (su.meshMaterial) su.meshMaterial.opacity = 0.25
        }
        if (su.config.showWireFrame.value !== si) su.config.showWireFrame.value = si
    }
    // ¿la retícula está sobre una superficie horizontal buena para la plataforma? (y, si las gafas la reconocieron, cuál es)
    evaluar(r) {
        if (!r.visible) return false
        up.set(0, 1, 0).applyQuaternion(r.getWorldQuaternion(q))
        if (up.y < 0.9) return false
        r.getWorldPosition(pos)
        let etiqueta = ''
        for (const e of this.queries.planos.entities) {
            const p = e.getValue(XRPlane, '_plane'), o = e.object3D
            if (!p || p.orientation !== 'horizontal' || !o) continue
            const centro = o.getWorldPosition(cab)
            if (Math.abs(centro.y - pos.y) < 0.04) { etiqueta = p.semanticLabel || ''; break }
        }
        return ETIQUETAS_BUENAS.includes(etiqueta)
    }
    // las retículas solo buscan superficies mientras se coloca (cada una pide su hit-test a las gafas: no hace falta todo el juego)
    buscar(si) {
        for (const lado of ['left', 'right']) {
            const e = this.entRet[lado], tiene = e.hasComponent(EnvironmentRaycastTarget)
            if (si && !tiene) e.addComponent(EnvironmentRaycastTarget, { space: lado === 'left' ? RaycastSpace.Left : RaycastSpace.Right, maxDistance: 5 })
            if (!si && tiene) e.removeComponent(EnvironmentRaycastTarget)
            if (!si) reticulas[lado].visible = false
        }
    }
    empezar() {
        estado.colocando = true; plataforma.visible = false; pausar(true); this.buscar(true); this.escaneo(true); apoyo.t = 0
        letrero.visible = true; this.saltarLetrero = true
    }
    terminar() {
        estado.colocando = false; pausar(false); this.buscar(false); this.escaneo(false); vista.visible = false; apoyo.t = 0; letrero.visible = false
    }
    poner(r) {
        this.ponerEn(r.getWorldPosition(pos))
    }
    ponerEn(punto) {
        pos.copy(punto)
        this.world.camera.getWorldPosition(cab)
        // de frente a quien juega, girada para que el juego se vea como en la versión original (la cámara isométrica: a 45°)
        const a = Math.atan2(cab.x - pos.x, cab.z - pos.z)
        this.world.scene.attach(plataforma) // (se suelta del ancla para moverla en coordenadas del mundo)
        plataforma.position.set(pos.x, pos.y + ALTO, pos.z)
        plataforma.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a - Math.PI / 4)
        if (this.entPlataforma.hasComponent(XRAnchor)) this.entPlataforma.setValue(XRAnchor, 'attached', false)
        else this.entPlataforma.addComponent(XRAnchor) // IWSDK la engancha al ancla real: no se corre aunque el seguimiento se reajuste
        estado.puesta = true; plataforma.visible = true; this.terminar()
    }
    // las dos manos apoyadas: la vista previa delante de ellas; si se quedan quietas QUIETAS s, ahí va la plataforma
    apoyadas(delta) {
        this.refAMundo.copy(this.world.player.matrixWorld)
        this.world.camera.getWorldPosition(cab)
        if (!manosApoyadas(this.refAMundo, cab)) { apoyo.t = 0; vista.visible = false; return false }
        // si se mueven más de 2.5 cm, la cuenta empieza otra vez (para poder acomodarlas)
        if (apoyo.t > 0 && (cP[0].distanceTo(apoyo.antes[0]) > 0.025 || cP[1].distanceTo(apoyo.antes[1]) > 0.025)) apoyo.t = 0
        if (apoyo.t === 0) { apoyo.antes[0].copy(cP[0]); apoyo.antes[1].copy(cP[1]) }
        apoyo.t += delta
        dondeVa(this.queries.planos.entities, cab, this.lugar)
        vista.visible = true; vista.position.copy(this.lugar).setY(this.lugar.y + 0.004)
        vista.quaternion.setFromAxisAngle(up.set(0, 1, 0), Math.atan2(cab.x - this.lugar.x, cab.z - this.lugar.z) - Math.PI / 4) // (como quedará)
        const k = Math.min(1, apoyo.t / QUIETAS); relleno.scale.set(LADO * k, 1, LADO * k)
        vista.userData.pintar(k >= 1 ? DORADO : LILA)
        if (k >= 1) { this.ponerEn(this.lugar); return true }
        return false
    }
    update(delta) {
        const xr = this.world.input?.xr, sesion = this.world.session
        // entrar y salir de la realidad aumentada
        if (sesion !== this.sesion) {
            this.sesion = sesion
            if (sesion) { estado.puesta = false; this.empezar() }
            else { // de vuelta en la pantalla: la plataforma vuelve a su lugar fijo (frente a la cámara del navegador)
                estado.puesta = false; plataforma.visible = true; this.terminar()
                if (this.entPlataforma.hasComponent(XRAnchor)) this.entPlataforma.removeComponent(XRAnchor)
                this.world.scene.attach(plataforma); plataforma.position.set(0, 0.76, -0.35); plataforma.quaternion.identity()
            }
        }
        recolocar.visible = !!sesion && estado.puesta
        if (!sesion) return
        // recolocar: al presionar el botón de la esquina
        const presionado = this.entBoton.hasComponent(Pressed)
        recolocar.getObjectByName('tapa').position.y = presionado ? 0.008 : 0.012
        if (presionado && !this.antesPresionado && estado.puesta) this.empezar()
        this.antesPresionado = presionado
        if (!estado.colocando) return
        // si cambia lo que hay en cada lado (soltaste los controles y aparecieron las manos, o al revés), las retículas se rehacen: el
        // hit-test de IWSDK queda atado a la fuente que había al crearlas y seguiría el control que ya no se usa
        const fuentes = ['left', 'right'].map(l => xr?.getPrimaryInputSource?.(l))
        if (!this.fuentes || fuentes.some((f, i) => f !== this.fuentes[i])) { this.fuentes = fuentes; this.buscar(false); this.buscar(true) }
        seguirCabeza(this.world.camera, delta, this.saltarLetrero); this.saltarLetrero = false
        // colocando: las dos manos apoyadas en la mesa (lo principal)...
        if (this.apoyadas(delta)) return
        // ...o apuntar: retículas doradas sobre superficies buenas; el pellizco de esa mano (no los controles) pone la plataforma
        for (const lado of ['left', 'right']) {
            const r = reticulas[lado], buena = this.evaluar(r)
            r.userData.pintar(buena ? DORADO : LILA)
            const mano = xr?.isPrimary?.('hand', lado)
            if (buena && mano && xr.getSelectState(lado).start) { this.poner(r); break }
        }
    }
}
