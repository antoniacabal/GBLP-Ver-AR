// Indice
    // 0. Imports
    // 1. El mareo: hacia dónde se cae Gabriela
    // 2. Panel: el nivel de burbuja y la ayuda
    // 3. Controles: giroscopio, arrastrar, teclado
    // 4. Minijuego

// Reconstruir la gravedad (grounding de orientación vestibular). Después del sismo, el cuerpo sigue sintiendo que el suelo tiembla y
// que el mundo está inclinado (vértigo por estrés agudo). La cámara se acerca a Gabriela, que pierde el equilibrio y se tambalea de un
// lado a otro manoteando; el horizonte se inclina con ella. Hay que sostenerla haciendo fuerza en sentido contrario a la caída:
// inclinando el celular (giroscopio), arrastrando o con A / D. Mientras está derecha, el horizonte se endereza y el ruido de fondo se
// calma; si se mantiene derecha el tiempo suficiente, la crisis pasa y suspira. Misma forma que los demás minijuegos (start / stop / update).
// player.js usa runtime.tambaleo (la pose) y main.js runtime.zoomJugador (la cámara la sigue de cerca)

// 0. Imports
import gsap from 'gsap'
import { CONFIG, runtime } from './config.js'
import { audio } from './audio.js'
import { haptics } from './haptics.js'

const RECTO = 3.5    // grados de tolerancia para contar como "derecha" (con 2.5 era casi imposible)
const NECESITA = 3.5 // segundos derecha (acumulados) para salir de la crisis (antes 5: se hacía largo)
const ZOOM = 2.6     // cuánto se acerca la cámara

// 1. El mareo: una suma de ondas lentas y rápidas (en grados). El jugador corrige en contra: inclinación = mareo - corrección
//    (positiva: se cae hacia la derecha de la pantalla, porque durante el minijuego mira hacia la cámara)
const mareo = (t) => 19 * Math.sin(t * 0.68) + 9 * Math.sin(t * 1.9 + 1) + 4 * Math.sin(t * 3.6 + 2) // (más fuerte y más rápido que antes)

// 2. Panel: solo un nivel de burbuja (la burbuja se va hacia donde se está cayendo) y cómo se juega
const panel = document.createElement('div')
panel.className = 'gx-gravedad'; panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Reconstruir la gravedad')
panel.innerHTML = `
    <div class="gx-nivel" aria-hidden="true"><span class="gx-nivel-burbuja"></span><span class="gx-nivel-centro"></span></div>
    <p class="gx-gravedad-ayuda"></p>
    <div class="gx-flechas" aria-hidden="true"><button type="button" class="gx-flecha" data-lado="izq"><svg viewBox="0 0 24 24"><path d="M15 5 L8 12 L15 19"/></svg></button><button type="button" class="gx-flecha" data-lado="der"><svg viewBox="0 0 24 24"><path d="M9 5 L16 12 L9 19"/></svg></button></div>
    <button type="button" class="gx-gravedad-giro" hidden>Jugar girando el celular</button>`
document.querySelector('.gx')?.appendChild(panel)
const burbuja = panel.querySelector('.gx-nivel-burbuja'), ayuda = panel.querySelector('.gx-gravedad-ayuda'), botonGiro = panel.querySelector('.gx-gravedad-giro')
const tactil = () => document.body.classList.contains('gx-touch-on')

// 3. Controles -----------------------------------------------------------------------------
//    Siempre en contra de la caída: si se va hacia la derecha, se corrige hacia la izquierda (A, arrastrar a la izquierda, inclinar el
//    celular a la izquierda). En celular siempre sale el botón "Jugar girando el celular" (antes en Android se activaba solo y no se
//    notaba que existía): al tocarlo se calibra con la posición en que se tiene en ese momento; en iPhone además pide permiso.
//    Arrastrar funciona en cualquier parte de la pantalla (no hay nada más que tocar durante el minijuego)
let correccion = 0, gamma0 = null, teclas = 0, arrastre = null
const alGiro = (e) => {
    if (!activo || e.gamma == null) return
    // de pie, girar de lado es gamma; acostado (celular horizontal), es beta (con el signo según hacia qué lado se acostó)
    const ang = screen.orientation?.angle ?? window.orientation ?? 0
    const giro = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma
    if (gamma0 === null) gamma0 = giro + correccion
    correccion = -(giro - gamma0)
}

const escucharGiro = () => { gamma0 = null; addEventListener('deviceorientation', alGiro) }
botonGiro.addEventListener('click', async () => {
    try { if (typeof DeviceOrientationEvent?.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') return } catch { return }
    escucharGiro(); botonGiro.hidden = true
    ayuda.textContent = 'Gira el celular en contra de la caída.'; haptics.buzz(30)
})
const lienzo = document.querySelector('canvas.webgl')
const empezarArrastre = (e) => { if (!activo || e.target === botonGiro || e.target.closest?.('.gx-flecha')) return; arrastre = { x: e.clientX, c: correccion } }
;[lienzo, panel].forEach(el => el?.addEventListener('pointerdown', empezarArrastre))
addEventListener('pointermove', (e) => { if (arrastre && activo) correccion = arrastre.c - (e.clientX - arrastre.x) * 0.25 })
;['pointerup', 'pointercancel'].forEach(t => addEventListener(t, () => { arrastre = null }))
// flechas táctiles (celular): mantener una presionada es como mantener A o D
panel.querySelectorAll('.gx-flecha').forEach(b => {
    const d = b.dataset.lado === 'izq' ? 1 : -1
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); teclas = d; b.classList.add('on') })
    const soltar = () => { if (teclas === d) teclas = 0; b.classList.remove('on') }
    ;['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, soltar))
})
const alTeclado = (e) => {
    if (!activo || e.repeat) return
    const d = e.code === 'KeyA' || e.code === 'ArrowLeft' ? 1 : e.code === 'KeyD' || e.code === 'ArrowRight' ? -1 : 0 // A empuja hacia la izquierda
    if (!d) return
    if (e.type === 'keydown') teclas = d; else if (teclas === d) teclas = 0
}
addEventListener('keydown', alTeclado); addEventListener('keyup', alTeclado)

// 4. Minijuego ----------------------------------------------------------------------------------
let activo = false, t = 0, derecho = 0, inclinacion = 0, oido = 0, estabaRecto = false, ganado = false, zoomAntes = 1
export const gravedad = {
    start() {
        activo = true; t = 0; derecho = 0; ganado = false; correccion = 0; teclas = 0; gamma0 = null; estabaRecto = false; arrastre = null
        const conGiro = tactil() && 'DeviceOrientationEvent' in window
        botonGiro.hidden = !conGiro // en celular: la opción de jugar girándolo
        ayuda.textContent = tactil() ? 'Usa las flechas o arrastra, en contra de la caída.' : 'Arrastra o usa A / D, en contra de la caída.'
        panel.hidden = false; gsap.fromTo(panel, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
        // la cámara se acerca a Gabriela (main.js la sigue mientras runtime.zoomJugador)
        zoomAntes = CONFIG.camera.zoom; runtime.zoomJugador = true; gsap.to(CONFIG.camera, { zoom: ZOOM, duration: 1, ease: 'power2.inOut' })
        runtime.tambaleo = 0
        audio.ruido.start()
    },
    stop() {
        activo = false; panel.hidden = true; removeEventListener('deviceorientation', alGiro)
        runtime.tambaleo = undefined; runtime.zoomJugador = false
        gsap.to(CONFIG.camera, { zoom: zoomAntes, duration: 0.9, ease: 'power2.inOut' })
        gsap.to(runtime, { dutch: 0, duration: 0.8, ease: 'power2.out' })     // el horizonte vuelve a su lugar
        audio.ruido.stop(); if (ganado) audio.suspiro()                         // Gabriela suspira
    },
    update(dt) {
        t += dt
        if (teclas) correccion += teclas * 60 * dt // (con 40 no alcanzaba al mareo en sus picos: era imposible con teclas o flechas)
        inclinacion = mareo(t) - correccion
        const recto = Math.abs(inclinacion) < RECTO
        derecho = recto ? derecho + dt : Math.max(0, derecho - dt * 0.15) // si se vuelve a torcer, lo avanzado se pierde muy de a poco (antes 0.6: la barra bajaba demasiado)
        if (recto && !estabaRecto) haptics.buzz(30)                       // un toque suave al quedar derecha
        estabaRecto = recto
        // Gabriela se tambalea hacia donde se cae y el horizonte se inclina con ella; el ruido se calma mientras más derecha
        runtime.tambaleo = Math.max(-1, Math.min(1, inclinacion / 20))
        runtime.dutch = inclinacion * Math.PI / 180 * 0.4; runtime.dutchSway = 0
        if ((oido -= dt) <= 0) { oido = 0.25; audio.ruido.calma(Math.max(0, 1 - Math.abs(inclinacion) / 15) * 0.7 + Math.min(1, derecho / NECESITA) * 0.3) }
        gsap.set(burbuja, { x: Math.max(-1, Math.min(1, inclinacion / 20)) * 70 })
        burbuja.classList.toggle('gx-nivel-burbuja--recta', recto)
        const timeLeft = Math.max(0, CONFIG.gravedad.timeout - t), fill = Math.min(1, derecho / NECESITA)
        if (derecho >= NECESITA) { ganado = true; return { prompt: '', fill: 1, done: true, timeLeft } }
        if (timeLeft <= 0) return { prompt: '', fill, done: false, timeLeft: 0 }
        return { prompt: '', label: recto ? 'Así, sostente' : 'No te dejes caer', fill, timeLeft }
    }
}
