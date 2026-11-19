// Indice
    // 0. Imports
    // 1. La plataforma: base 3D ligeramente elevada (2 cm) sobre la mesa
    // 2. Retículas: siguen el rayo de cada mano sobre las superficies reales (environment raycast)
    // 3. Botón de recolocar (en una esquina de la plataforma, se toca con el dedo)
    // 4. Sistema de colocación (IWSDK)

// Colocación de la experiencia sobre una superficie real (etapa 2):
//   1. al entrar a la realidad aumentada, el juego se pausa y aparece una retícula donde apunta cada mano (IWSDK: EnvironmentRaycastTarget,
//      que hace hit-test contra las superficies que detectan las gafas)
//   2. sobre una superficie horizontal la retícula se ve dorada (si las gafas reconocieron una mesa, el piso o un mueble, también)
//   3. un pellizco con esa mano pone ahí la plataforma, 2 cm por encima, de frente a quien juega
//   4. la plataforma queda anclada al espacio real (IWSDK: XRAnchor) y el juego sigue
// Para moverla: el botón pequeño de la esquina (se toca con el índice) vuelve al paso 1.
// Los controles de Meta no colocan nada (solo sirven para salir: así lo pidió el equipo); solo las manos.

// 0. Imports
import * as THREE from 'three'
import { createSystem, EnvironmentRaycastTarget, RaycastSpace, XRAnchor, XRPlane, PokeInteractable, Pressed } from '@iwsdk/core'
import gsap from 'gsap'
import { runtime } from '../game/config.js'
import { mundo } from './estado.js'
import { plataforma } from './maqueta.js'

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

// 4. Sistema de colocación
const up = new THREE.Vector3(), pos = new THREE.Vector3(), cab = new THREE.Vector3(), q = new THREE.Quaternion()
const ETIQUETAS_BUENAS = ['table', 'desk', 'floor', 'couch', 'bed', 'storage', 'other', '']
export class SistemaColocacion extends createSystem({
    planos: { required: [XRPlane] },
    boton: { required: [PokeInteractable] }
}) {
    init() {
        this.entPlataforma = this.world.createTransformEntity(plataforma)
        this.entRet = {}
        for (const lado of ['left', 'right']) { const r = crearReticula(); reticulas[lado] = r; this.entRet[lado] = this.world.createTransformEntity(r) }
        // el botón de recolocar: se toca con el índice (poke). Sin rayo: el rayo también puede venir de un control de Meta
        this.entBoton = this.world.createTransformEntity(recolocar, { parent: this.entPlataforma })
        this.entBoton.addComponent(PokeInteractable)
        this.antesPresionado = false
        this.sesion = null
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
        estado.colocando = true; plataforma.visible = false; pausar(true); this.buscar(true)
    }
    poner(r) {
        r.getWorldPosition(pos)
        this.world.camera.getWorldPosition(cab)
        // de frente a quien juega, girada para que el juego se vea como en la versión original (la cámara isométrica: a 45°)
        const a = Math.atan2(cab.x - pos.x, cab.z - pos.z)
        this.world.scene.attach(plataforma) // (se suelta del ancla para moverla en coordenadas del mundo)
        plataforma.position.set(pos.x, pos.y + ALTO, pos.z)
        plataforma.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a - Math.PI / 4)
        if (this.entPlataforma.hasComponent(XRAnchor)) this.entPlataforma.setValue(XRAnchor, 'attached', false)
        else this.entPlataforma.addComponent(XRAnchor) // IWSDK la engancha al ancla real: no se corre aunque el seguimiento se reajuste
        estado.colocando = false; estado.puesta = true; plataforma.visible = true; pausar(false); this.buscar(false)
    }
    update() {
        const xr = this.world.input?.xr, sesion = this.world.session
        // entrar y salir de la realidad aumentada
        if (sesion !== this.sesion) {
            this.sesion = sesion
            if (sesion) { estado.puesta = false; this.empezar() }
            else { // de vuelta en la pantalla: la plataforma vuelve a su lugar fijo (frente a la cámara del navegador)
                estado.colocando = false; estado.puesta = false; plataforma.visible = true; pausar(false); this.buscar(false)
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
        // colocando: retículas doradas sobre superficies buenas; el pellizco de esa mano (no los controles) pone la plataforma
        for (const lado of ['left', 'right']) {
            const r = reticulas[lado], buena = this.evaluar(r)
            r.userData.pintar(buena ? DORADO : LILA)
            const mano = xr?.isPrimary?.('hand', lado)
            if (buena && mano && xr.getSelectState(lado).start) { this.poner(r); break }
        }
    }
}
