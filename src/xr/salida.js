// Indice
    // 0. Imports
    // 1. El botón de salida rápida: en la esquina de la plataforma que da a quien juega, lo más cerca posible
    // 2. El rótulo
    // 3. Sistema de la salida rápida (IWSDK)

// Salida rápida en las gafas: un botón 3D sobre la mesa, justo delante de la esquina de la plataforma que da a quien juega (entre el
// joystick y el botón de interacción, más cerca que los dos), con el rótulo "Salida rápida". Se presiona con el índice (IWSDK:
// PokeInteractable), como el botón de interacción.
//   · presionarlo abre la salida rápida (pausa el juego: "Seguir" o "Parar" en el panel)
//   · presionarlo otra vez con la salida rápida abierta vuelve al juego
// También siguen sirviendo las dos palmas hacia adelante (xr/gestos.js) y B / Y en los controles.

// 0. Imports
import * as THREE from 'three'
import { createSystem, PokeInteractable, Pressed } from '@iwsdk/core'
import { colocacion } from './colocacion.js'
import { entidades } from './estado.js'
import { runtime } from '../game/config.js'
import { ui } from '../game/ui.js'
import { sonido } from './sonidos.js'

// 1. El botón: 15 cm delante del centro de la mesa y fuera de la plataforma (la esquina queda a 35 cm del centro del grupo de la mesa)
export const LUGAR_SALIDA = new THREE.Vector3(0, 0, 0.46)
const base = new THREE.Group(); base.name = 'salida'; base.position.copy(LUGAR_SALIDA)
const tapa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.045), // (rectangular: una tecla ancha, fácil de tocar)
    new THREE.MeshStandardMaterial({ color: 0xe4ffff, roughness: 0.5, emissive: 0x1a2a2a }))
{
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.012, 0.063), new THREE.MeshStandardMaterial({ color: 0x580213, roughness: 0.7 }))
    caja.position.y = 0.006
    // las dos rayas de "pausa" sobre la tapa (como el ícono de la salida rápida en el panel)
    const raya = new THREE.BoxGeometry(0.006, 0.002, 0.02), mat = new THREE.MeshBasicMaterial({ color: 0x580213 })
    for (const x of [-0.006, 0.006]) { const r = new THREE.Mesh(raya, mat); r.position.set(x, 0.0075, 0); tapa.add(r) }
    base.add(caja)
}
const ARRIBA = 0.019, ABAJO = 0.012
tapa.position.y = ARRIBA

// 2. El rótulo, de pie detrás del botón y siempre de frente a quien juega
const rotulo = (() => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 80
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const dibujar = () => {
        const g = c.getContext('2d'); g.clearRect(0, 0, 320, 80)
        g.fillStyle = 'rgba(88,2,19,0.92)'; g.beginPath(); g.roundRect(4, 4, 312, 72, 36); g.fill()
        g.strokeStyle = '#F2C063'; g.lineWidth = 3; g.stroke()
        g.fillStyle = '#E4FFFF'; g.font = '600 36px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Salida rápida', 160, 42)
        t.needsUpdate = true
    }
    dibujar(); document.fonts?.ready.then(dibujar)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.018), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }))
    m.position.set(0, 0.05, 0); base.add(m); return m
})()

// 3. Sistema
const ESPERA = 0.6, cab = new THREE.Vector3()
// (durante un ejercicio de respiración el juego no deja abrir la salida rápida: antes el botón parecía no hacer nada; ahora lo dice)
function alternar() {
    const pausa = document.querySelector('.gx-pause:not([hidden])')
    if (pausa) { sonido.salida(); return pausa.querySelector('[data-act="go"]')?.click() } // ya abierta: vuelve al juego
    if (runtime.state === 'BREATHING') { sonido.no(); return ui.aviso?.('La salida rápida se abre al terminar el ejercicio de respiración.') }
    sonido.salida(); document.querySelector('.gx-exit')?.click()
}
export class SistemaSalida extends createSystem({}) {
    init() {
        const entBase = this.world.createTransformEntity(base, { parent: entidades.mesa }) // (el grupo de la mesa: joystick.js)
        this.entTapa = this.world.createTransformEntity(tapa, { parent: entBase })
        this.entTapa.addComponent(PokeInteractable)
        this.presionado = false; this.espera = 0
    }
    update(delta) {
        const activo = !!this.world.session && colocacion.puesta && !colocacion.colocando
        if (!activo) return
        const xr = this.world.input?.xr, conManos = !!(xr?.isPrimary?.('hand', 'left') || xr?.isPrimary?.('hand', 'right'))
        this.espera = Math.max(0, this.espera - delta)
        const ahora = conManos && this.entTapa.hasComponent(Pressed)
        tapa.position.y += ((ahora ? ABAJO : ARRIBA) - tapa.position.y) * Math.min(1, delta * 30)
        tapa.material.emissive.setHex(ahora ? 0xf2c063 : 0x1a2a2a) // (se ilumina al tocarlo: así se sabe que el dedo llegó)
        if (ahora && !this.presionado && !this.espera) { this.espera = ESPERA; alternar() }
        this.presionado = ahora
        this.world.camera.getWorldPosition(cab); rotulo.lookAt(cab)
    }
}
