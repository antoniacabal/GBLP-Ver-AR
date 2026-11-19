// Indice
    // 0. Imports
    // 1. Los controles de la mesa: un grupo de frente a quien juega, junto a la esquina delantera de la plataforma
    // 2. El joystick: base, palito y bola
    // 3. De la bola al movimiento del juego
    // 4. Agarrar con la mano cerrada
    // 5. Sistema del joystick (IWSDK)

// Joystick físico virtual (etapa 4), a la izquierda, junto a la plataforma:
//   1. cierras la mano alrededor del palito, como en el dibujo "joystick" (o pellizcas la bola: IWSDK OneHandGrabbable)
//   2. mientras lo agarras, la bola se mueve adelante, atrás y a los lados (hasta 4 cm del centro); el palito se inclina con ella
//   3. el desplazamiento es la dirección y la velocidad: Gabriela camina y, como ella se queda en el centro de la plataforma, lo que se
//      mueve es el mapa (xr/maqueta.js)
//   4. al soltar, la bola vuelve suave al centro
// "Adelante" es hacia el fondo de la plataforma, lejos de quien juega. Los controles de Meta no mueven a Gabriela: solo las manos.

// 0. Imports
import * as THREE from 'three'
import { createSystem, OneHandGrabbable, Grabbed } from '@iwsdk/core'
import { CONFIG, runtime } from '../game/config.js'
import { scene as juego } from '../game/scene.js'
import { plataforma } from './maqueta.js'
import { colocacion } from './colocacion.js'
import { entidades } from './estado.js'
import { manos, huecoMano } from './manos.js'

// 1. Los controles de la mesa. La plataforma está girada 45° (para que el juego se vea como la cámara isométrica del original), así
//    que quien juega tiene de frente una esquina. Este grupo deshace ese giro: su +z apunta a quien juega. El joystick va a la izquierda
//    de esa esquina y el botón (etapa 5) a la derecha, fuera de la plataforma y al alcance de las manos
export const mesa = new THREE.Group(); mesa.name = 'controles-mesa'
mesa.rotation.y = Math.PI / 4
export const LUGAR = { joystick: new THREE.Vector3(-0.22, 0, 0.3), boton: new THREE.Vector3(0.22, 0, 0.3) }
const MAT = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })

// 2. El joystick
export const RADIO = 0.04, ALTO_BOLA = 0.085 // (alto para que la mano cerrada lo rodee)
const base = new THREE.Group(); base.name = 'joystick'; base.position.copy(LUGAR.joystick)
{
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.012, 32), MAT(0x201826)); disco.position.y = 0.006
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.003, 8, 40).rotateX(Math.PI / 2), MAT(0xf2c063, { emissive: 0x5a3e0c })); aro.position.y = 0.013
    base.add(disco, aro)
}
const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 14), MAT(0x71708a)); base.add(palo)
const bola = new THREE.Mesh(new THREE.SphereGeometry(0.021, 24, 16), MAT(0xf2c063, { emissive: 0x2e2006 }))
bola.name = 'bola'; bola.position.set(0, ALTO_BOLA, 0)
const Y = new THREE.Vector3(0, 1, 0)
function ponerPalo() { // el palito va de la base a la bola (se inclina con ella)
    const b = bola.position, largo = b.length()
    palo.position.copy(b).multiplyScalar(0.5); palo.scale.set(1, largo, 1)
    palo.quaternion.setFromUnitVectors(Y, b.clone().normalize())
}
ponerPalo()

// 3. De la bola al movimiento: el desplazamiento (en el grupo de la mesa) se lleva al mundo del juego y de ahí al joystick que entiende
//    player.js (runtime.joyX / joyY, relativo a CONFIG.camera.azimuth: lo inverso de lo que hace player.js)
const dir = new THREE.Vector3(), qMesa = new THREE.Quaternion(), qJuego = new THREE.Quaternion()
function aJoystick(off) {
    mesa.getWorldQuaternion(qMesa); juego.getWorldQuaternion(qJuego)
    dir.set(off.x, 0, off.z).divideScalar(RADIO).applyQuaternion(qMesa).applyQuaternion(qJuego.invert()) // (dirección en el juego)
    const a = THREE.MathUtils.degToRad(CONFIG.camera.azimuth)
    return [dir.x * Math.cos(a) - dir.z * Math.sin(a), -dir.x * Math.sin(a) - dir.z * Math.cos(a)]
}

// 4. Agarrar con la mano cerrada: si una mano se cierra (puño) con el hueco de la mano a menos de 7 cm de la bola, queda agarrada
//    hasta que se abra; mientras tanto la bola sigue a la mano (con la diferencia que había al agarrarla, así no salta).
//    joystick.mano: la mano que lo tiene (los gestos no la cuentan: cerrar la mano aquí no es respirar)
export const joystick = { mano: null }
const hueco = new THREE.Vector3(), bolaMundo = new THREE.Vector3(), agarre = new THREE.Vector3(), refAMundo = new THREE.Matrix4()
function manoCerrada(player) {
    refAMundo.copy(player.matrixWorld)
    const m = joystick.mano
    if (m) { // ¿sigue cerrada?
        if (!m.ok || !m.puno) { joystick.mano = null; return false }
        huecoMano(m, hueco).applyMatrix4(refAMundo).add(agarre)
        base.worldToLocal(hueco); bola.position.set(hueco.x, ALTO_BOLA, hueco.z)
        return true
    }
    bola.getWorldPosition(bolaMundo)
    for (const l of ['left', 'right']) {
        const c = manos[l]
        if (!c.ok || !c.puno) { c.antesAbierta = c.ok; continue }
        huecoMano(c, hueco).applyMatrix4(refAMundo)
        // (solo si se cerró aquí: una mano que ya venía cerrada, de respirar, no lo agarra al pasar)
        const recien = c.antesAbierta; c.antesAbierta = false
        if (recien && hueco.distanceTo(bolaMundo) < 0.07) { joystick.mano = c; agarre.subVectors(bolaMundo, hueco); return true }
    }
    return false
}

// 5. Sistema del joystick
const off = new THREE.Vector3()
export class SistemaJoystick extends createSystem({ bola: { required: [OneHandGrabbable] } }) {
    init() {
        this.entMesa = this.world.createTransformEntity(mesa, { parent: entidades.plataforma }); entidades.mesa = this.entMesa // (el botón también va aquí)
        this.entBase = this.world.createTransformEntity(base, { parent: this.entMesa })
        this.entBola = this.world.createTransformEntity(bola, { parent: this.entBase })
        // la bola se agarra con la mano y solo se traslada (sin girar), dentro de un cuadrado de 8 cm a la altura de la bola
        this.entBola.addComponent(OneHandGrabbable, { rotate: false, translate: true, translateMin: [-RADIO, ALTO_BOLA, -RADIO], translateMax: [RADIO, ALTO_BOLA, RADIO] })
        this.moviendo = false
    }
    update(delta) {
        const sesion = this.world.session, activo = !!sesion && colocacion.puesta && !colocacion.colocando
        mesa.visible = activo
        const xr = this.world.input?.xr, conManos = !!(xr?.isPrimary?.('hand', 'left') || xr?.isPrimary?.('hand', 'right'))
        const pellizcada = activo && this.entBola.hasComponent(Grabbed)
        const cerrada = activo && conManos && !pellizcada && manoCerrada(this.world.player)
        if (!activo || pellizcada) joystick.mano = null
        const agarrada = pellizcada || cerrada
        if (agarrada) { // dentro de un círculo (el agarre limita a un cuadrado)
            off.set(bola.position.x, 0, bola.position.z); if (off.length() > RADIO) off.setLength(RADIO)
            bola.position.set(off.x, ALTO_BOLA, off.z)
        } else { // suelta: vuelve suave al centro
            const k = Math.exp(-delta * 14); bola.position.x *= k; bola.position.z *= k; bola.position.y = ALTO_BOLA
            off.set(bola.position.x, 0, bola.position.z)
        }
        ponerPalo()
        // mueve a Gabriela solo con las manos (zona muerta del 15 %); al soltar, se detiene
        if (agarrada && conManos && off.length() > RADIO * 0.15) {
            const [jx, jy] = aJoystick(off); runtime.joyX = jx; runtime.joyY = jy; this.moviendo = true
        } else if (this.moviendo) { runtime.joyX = runtime.joyY = 0; this.moviendo = false }
    }
}
