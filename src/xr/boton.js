// Indice
    // 0. Imports
    // 1. El botón: base y tapa, a la derecha del joystick
    // 2. Qué hace al presionarlo (lo mismo que el clic izquierdo en el juego)
    // 3. Sistema del botón (IWSDK)

// Botón de interacción (etapa 5): un botón 3D sobre la mesa, a la derecha del joystick, que se presiona con el índice.
//   1. acercas el índice y lo tocas (IWSDK: PokeInteractable; la punta del dedo es un puntero de toque)
//   2. el botón se hunde (y se ilumina) mientras lo presionas
//   3. al presionarlo pasa lo mismo que con el clic izquierdo: interactuar con objetos y personas, avanzar los diálogos, continuar las
//      tarjetas y los pop-ups de "Empezar"
//   4. al soltarlo vuelve arriba
// Un solo toque = una sola acción: después de presionarlo, durante 0.35 s no vuelve a contar (y hay que soltarlo antes del siguiente).
// Solo con las manos: los controles de Meta no lo activan.

// 0. Imports
import * as THREE from 'three'
import { createSystem, PokeInteractable, Pressed } from '@iwsdk/core'
import { colocacion } from './colocacion.js'
import { LUGAR } from './joystick.js'
import { entidades } from './estado.js'

// 1. El botón
const base = new THREE.Group(); base.name = 'boton'; base.position.copy(LUGAR.boton)
const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 32), new THREE.MeshStandardMaterial({ color: 0xbf4e24, roughness: 0.5, emissive: 0x2a0a02 }))
{
    const caja = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.014, 32), new THREE.MeshStandardMaterial({ color: 0x201826, roughness: 0.7 }))
    caja.position.y = 0.007
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.003, 8, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2c063, emissive: 0x5a3e0c }))
    aro.position.y = 0.015
    base.add(caja, aro)
}
const ARRIBA = 0.022, ABAJO = 0.014 // la tapa se hunde 8 mm
tapa.position.y = ARRIBA

// 2. Qué hace. Primero lo que está en pantalla: un pop-up con un solo botón de "Empezar" (los controles, cómo se juega) o la tarjeta
//    de la historia; si no hay nada de eso, interactuar (la tecla E que ya entendía el juego: main.js; también avanza los diálogos)
const visible = (sel) => { const el = document.querySelector(sel); return el && el.offsetParent !== null ? el : null }
function interactuar() {
    const empezar = visible('.gx-controls:not([hidden]) [data-act="start"]') || visible('.gx-tutorial:not([hidden]) [data-act="start"]')
    if (empezar) return empezar.click()
    const tarjeta = visible('.gx-card:not([hidden])')
    if (tarjeta) return tarjeta.click() // (completa el texto y, si ya está completo, continúa)
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }))
    dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }))
}

// 3. Sistema del botón
const ESPERA = 0.35
export class SistemaBoton extends createSystem({}) {
    init() {
        const entBase = this.world.createTransformEntity(base, { parent: entidades.mesa }) // (el grupo de la mesa: joystick.js)
        this.entTapa = this.world.createTransformEntity(tapa, { parent: entBase })
        this.entTapa.addComponent(PokeInteractable)
        this.presionado = false; this.espera = 0
    }
    update(delta) {
        const activo = !!this.world.session && colocacion.puesta && !colocacion.colocando
        const xr = this.world.input?.xr, conManos = !!(xr?.isPrimary?.('hand', 'left') || xr?.isPrimary?.('hand', 'right'))
        this.espera = Math.max(0, this.espera - delta)
        const ahora = activo && conManos && this.entTapa.hasComponent(Pressed)
        // la tapa baja y sube suave; se ilumina mientras está abajo
        tapa.position.y += ((ahora ? ABAJO : ARRIBA) - tapa.position.y) * Math.min(1, delta * 30)
        tapa.material.emissive.setHex(ahora ? 0x7a2a0a : 0x2a0a02)
        if (ahora && !this.presionado && !this.espera) { this.espera = ESPERA; interactuar() } // (un toque = una acción)
        this.presionado = ahora
    }
}
