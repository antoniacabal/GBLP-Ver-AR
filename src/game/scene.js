// La escena del juego. Antes el juego tenía su propio renderer, su canvas y su escena; ahora todo eso es de IWSDK (xr/mundo.js), que
// tiene una sola sesión XR y un solo ciclo de dibujo. Aquí "scene" es un grupo con el juego entero: xr/maqueta.js lo pone sobre la
// plataforma, lo escala y lo desplaza (Gabriela queda en el centro y lo que se mueve es el mapa). El resto del juego no cambió:
// sigue haciendo scene.add(...) como antes
import * as THREE from 'three'
import { CAPA_PROTA } from './config.js'
import { mundo } from '../xr/estado.js'

export const renderer = mundo.renderer
export const canvas = renderer.domElement
export const scene = new THREE.Group()
scene.name = 'juego'
// (environment.js le pone fondo y niebla como si fuera una escena: en un grupo no hacen nada, y en realidad aumentada el fondo es el
// cuarto real)
export const ambient = new THREE.AmbientLight(0x8899bb, 0.7)
export const sun = new THREE.DirectionalLight(0xaab4d0, 1)
sun.position.set(8, 14, 6)
scene.add(ambient, sun, sun.target) // (el blanco del sol va dentro del juego: así la luz no cambia de dirección cuando el mapa se mueve)
ambient.layers.enable(CAPA_PROTA); sun.layers.enable(CAPA_PROTA)

// (la protagonista nítida sobre el mundo borroso del nivel 3 de ansiedad usaba un segundo canvas: en las gafas no hay filtros de CSS)
export function renderSharp() {}
