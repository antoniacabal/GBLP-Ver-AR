import * as THREE from 'three'
import { CAPA_PROTA } from './config.js'
export const canvas = document.querySelector('canvas.webgl')
export const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1620)
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
export const ambient = new THREE.AmbientLight(0x8899bb, 0.7)
export const sun = new THREE.DirectionalLight(0xaab4d0, 1)
sun.position.set(8, 14, 6)
scene.add(ambient, sun)
addEventListener('resize', () => { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight) }) // la resolución también se actualiza: con zoom del navegador u otra pantalla ya no queda pixelado
// Protagonista nítida (nivel 3 de ansiedad): el mundo se ve muy borroso, pero ella no. Se dibuja otra vez, solo ella (capa 1),
// en un segundo canvas transparente encima, sin el filtro de blur. Las luces también alumbran la capa 1
ambient.layers.enable(CAPA_PROTA); sun.layers.enable(CAPA_PROTA)
let sharp = null, sharpCanvas = null
const sizeSharp = () => { if (!sharp) return; sharp.setPixelRatio(Math.min(devicePixelRatio, 2)); sharp.setSize(innerWidth, innerHeight) }
addEventListener('resize', sizeSharp)
export function renderSharp(cam, on) {
    if (!on) { if (sharpCanvas) sharpCanvas.style.display = 'none'; return }
    if (!sharp) {
        sharpCanvas = document.createElement('canvas'); sharpCanvas.className = 'webgl-nitida'; sharpCanvas.setAttribute('aria-hidden', 'true'); canvas.after(sharpCanvas)
        sharp = new THREE.WebGLRenderer({ canvas: sharpCanvas, antialias: true, alpha: true }); sizeSharp()
    }
    sharpCanvas.style.display = ''
    const bg = scene.background; scene.background = null
    cam.layers.set(CAPA_PROTA); sharp.render(scene, cam); cam.layers.set(0); cam.layers.enable(CAPA_PROTA)
    scene.background = bg
}
