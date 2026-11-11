// Indice
    // 0. Imports
    // 1. Visor de la protagonista (solo con ?debug)
    // 2. Escena: luces, piso y apoyos
    // 3. Controles del visor
    // 4. Animación

// Espacio aparte para revisar a Gabriela sin el resto del juego: se abre desde el panel de debug (Protagonista → Abrir visor).
// La cámara se gira arrastrando y se acerca con la rueda (como la muestra del index). Aquí, y solo aquí, se pueden ver sus huesos.
// Mientras está abierto el juego queda en pausa

// 0. Imports
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { crearPersonaje, alturaPaso, alturaFeliz, saltoSusto, SALTO, EXPRESIONES } from './personaje.js'
import { runtime } from './config.js'

// 1. Visor de la protagonista
let abierto = null
export function abrirVisor() {
    if (abierto) return
    const pausaAntes = runtime.paused; runtime.paused = true
    const capa = document.createElement('div')
    capa.style.cssText = 'position:fixed;inset:0;z-index:5000;background:radial-gradient(circle at 50% 40%,#e4ffff,#a9b8c9)'
    const lienzo = document.createElement('canvas'); lienzo.style.cssText = 'display:block;width:100%;height:100%;cursor:grab'
    capa.append(lienzo); document.body.append(capa)
    const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

    // 2. Escena: las mismas luces del juego (scene.js), un piso con cuadrícula y apoyos para sentarse y acostarse
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0x8899bb, 0.7))
    const sol = new THREE.DirectionalLight(0xaab4d0, 1); sol.position.set(8, 14, 6); scene.add(sol)
    const rejilla = new THREE.GridHelper(6, 12, 0x71708a, 0x9aa7b8); scene.add(rejilla)
    const silla = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.48, 0.6), new THREE.MeshStandardMaterial({ color: 0x799180 })); silla.position.set(0, 0.24, -0.02); scene.add(silla)
    const cama = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 2.2), new THREE.MeshStandardMaterial({ color: 0xbf4e24 })); cama.position.set(0, 0.275, 0); scene.add(cama)
    const camara = new THREE.PerspectiveCamera(35, 1, 0.05, 100); camara.position.set(3.2, 2.2, 3.6)
    const controles = new OrbitControls(camara, lienzo); controles.target.set(0, 0.85, 0); controles.enableDamping = true
    const tamano = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix() }
    tamano(); addEventListener('resize', tamano)

    const prota = crearPersonaje(1.8, { normal: 'assets/protagonista/Personaje.fbx' }, (clave, cont) => {
        huesos = new THREE.SkeletonHelper(cont); huesos.material.depthTest = false; huesos.material.linewidth = 2; huesos.visible = ajustes.huesos; scene.add(huesos)
    })
    prota.cargar('normal'); scene.add(prota.grupo)
    let huesos = null

    // 3. Controles del visor
    const ajustes = { animacion: 'quieta', velocidad: 1, intensidad: 1, apuro: 0, huesos: false, piso: true, girar: false }
    const gui = new GUI({ title: 'Protagonista', container: capa }); gui.domElement.style.cssText = 'position:absolute;top:12px;right:12px'
    gui.add(ajustes, 'animacion', { 'Sin animación (pose del archivo)': 'ninguna', 'De pie': 'quieta', 'Caminar': 'caminar', 'Caminar con ansiedad (correr)': 'correr', 'Sentada': 'sentada', 'Acostada': 'acostada', 'Miedo (manos en la cabeza)': 'miedo', 'Feliz (idle de la muestra del index)': 'feliz', 'Sobresalto (salto hacia atrás)': 'sobresalto', 'Coger algo': 'coger', 'Comer': 'comer' }).name('animación')
    gui.add(ajustes, 'velocidad', 0, 2, 0.05).name('velocidad')
    gui.add(ajustes, 'intensidad', 0, 1, 0.05).name('intensidad (k)')
    gui.add(ajustes, 'apuro', 0, 1, 0.05).name('apuro al caminar (r)')
    gui.add(ajustes, 'huesos').name('ver huesos')
    gui.add(ajustes, 'piso').name('piso y apoyos')
    gui.add(ajustes, 'girar').name('girar sola')
    // expresiones de la cara (personaje.js): "Parpadeando" usa la normal con su parpadeo; las demás la dejan fija
    gui.add({ cara: 'Parpadeando' }, 'cara', ['Parpadeando', ...Object.keys(EXPRESIONES)]).name('expresión').onChange(v => prota.fijarCara(v === 'Parpadeando' ? null : v))
    gui.add({ cerrar }, 'cerrar').name('✕ Cerrar el visor')
    window.visor = { ajustes, gui, prota, camara, controles } // (desde la consola: visor.ajustes.animacion = 'correr'; visor.gui.controllersRecursive().forEach(c => c.updateDisplay()))
    const alTeclado = (e) => { if (e.code === 'Escape') { e.stopImmediatePropagation(); cerrar() } }
    addEventListener('keydown', alTeclado, true)

    // 4. Animación: misma lógica que player.js (fase del paso, altura del paso, acostada de lado, sentada sobre el cojín)
    const reloj = new THREE.Clock(); let t = 0, fase = 0, cuadro = 0
    const g = prota.grupo
    function animar() {
        cuadro = requestAnimationFrame(animar)
        const dt = Math.min(0.05, reloj.getDelta()) * ajustes.velocidad; t += dt
        const a = ajustes.animacion, k = ajustes.intensidad; let arco = 0
        g.rotation.set(0, 0, 0, 'XYZ'); g.position.set(0, 0.015, 0)
        silla.visible = ajustes.piso && a === 'sentada'; cama.visible = ajustes.piso && a === 'acostada'; rejilla.visible = ajustes.piso
        if (a === 'caminar' || a === 'correr') {
            const r = a === 'correr' ? 1 : ajustes.apuro
            fase += dt * (8.5 + 4 * r); prota.pose('caminar', fase, k, r); g.position.y += alturaPaso(fase, k, r)
        } else if (a === 'coger') prota.pose('coger', t, (t % 1.8) / 1.1)
        else if (a === 'sobresalto') { const p = (t % 1.6) / SALTO, j = saltoSusto(p); prota.pose('sobresalto', t, p); g.position.z = -0.9 * j.atras; arco = Math.max(0, j.y) }
        else if (a === 'acostada') { g.rotation.set(-Math.PI / 2, 0, -Math.PI / 2, 'ZYX'); g.position.set(0, 0.55 + 0.2, 0); prota.pose('acostada', t, k) }
        else if (a === 'sentada') { g.position.set(0, 0.48 - 0.46, 0.1); prota.pose('sentada', t, k) }
        else if (a === 'feliz') { prota.pose('feliz', t, k); g.position.y += alturaFeliz(t) }
        else prota.pose(a, t, k)
        prota.aplicar(dt || 0.016, a === 'sobresalto' ? 22 : 10) // el salto es rápido: los huesos siguen la pose sin retraso
        if (a !== 'acostada' && a !== 'sentada' && a !== 'ninguna') g.position.y = 0.002 - prota.piso() + arco // de pie: apoyada en la suela más baja (como en player.js)
        if (huesos) huesos.visible = ajustes.huesos
        controles.autoRotate = ajustes.girar; controles.update()
        renderer.render(scene, camara)
    }
    animar()

    function cerrar() {
        cancelAnimationFrame(cuadro); removeEventListener('resize', tamano); removeEventListener('keydown', alTeclado, true)
        gui.destroy(); controles.dispose(); delete window.visor; renderer.dispose(); capa.remove(); runtime.paused = pausaAntes; abierto = null
    }
    abierto = { cerrar }
}
