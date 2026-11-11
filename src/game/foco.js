// Indice
    // 0. Imports
    // 1. Panel: la radio vieja (escala de frecuencias, dial y la gota)
    // 2. Controles: girar el dial (arrastrar en círculo, rueda del mouse, A / D)
    // 3. Minijuego

// Foco entre el ruido (escucha selectiva guiada). Después del sismo, todo suena a la vez: sirenas, alarmas de carros, retumbos y un
// zumbido en los oídos que no deja pensar. Escoger UN sonido seguro y constante entre el caos ayuda a volver: aquí es el goteo de una
// tubería que quedó intacta. La pantalla se oscurece y se desenfoca; hay que girar el dial (como sintonizando una radio vieja) hasta
// encontrar la gota. Mientras más cerca, más se oye la gota, más baja el ruido y más se aclara la vista. Si la sostienes sintonizada
// un rato, la crisis pasa. Misma forma que los demás minijuegos (start / stop / update)

// 0. Imports
import gsap from 'gsap'
import { CONFIG, runtime } from './config.js'
import { audio } from './audio.js'
import { haptics } from './haptics.js'

const ANCHO = 0.22     // qué tan lejos del punto exacto ya se empieza a oír la gota (en fracción del dial)
const SINTONIA = 0.86  // desde aquí cuenta como sintonizado
const NECESITA = 2     // segundos sintonizado (acumulados; antes 3)
const GIRO = 270       // grados que recorre el dial de punta a punta

// 1. Panel -----------------------------------------------------------------------------------
const panel = document.createElement('div')
panel.className = 'gx-foco'; panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Foco entre el ruido')
const marcas = Array.from({ length: 28 }, (_, i) => { const a = (-GIRO / 2 + i * GIRO / 27) * Math.PI / 180, r1 = 86, r2 = i % 3 ? 92 : 98; return `<line x1="${100 + Math.sin(a) * r1}" y1="${100 - Math.cos(a) * r1}" x2="${100 + Math.sin(a) * r2}" y2="${100 - Math.cos(a) * r2}"/>` }).join('')
panel.innerHTML = `
    <p class="gx-foco-titulo">Busca el sonido seguro</p>
    <div class="gx-foco-escala" aria-hidden="true"><span class="gx-foco-aguja"></span><span>88</span><span>92</span><span>96</span><span>100</span><span>104</span><span>108</span></div>
    <div class="gx-foco-dial" role="slider" tabindex="0" aria-label="Dial de la radio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
        <svg viewBox="0 0 200 200" aria-hidden="true">
            <g class="gx-foco-marcas" stroke="#E4FFFF" stroke-width="3" stroke-linecap="round" opacity=".6">${marcas}</g>
            <circle cx="100" cy="100" r="72" fill="#482642" stroke="#A6869B" stroke-width="5"/>
            <g class="gx-foco-perilla"><circle cx="100" cy="100" r="56" fill="#71708A"/><rect x="95" y="50" width="10" height="34" rx="5" fill="#F2C063"/></g>
        </svg>
    </div>
    <div class="gx-foco-gota" aria-hidden="true"><svg viewBox="0 0 24 32"><path d="M12 2 C12 2 3 14 3 21 a9 9 0 0 0 18 0 C21 14 12 2 12 2 Z"/></svg></div>
    <p class="gx-foco-ayuda"></p>
    <div class="gx-flechas" aria-hidden="true"><button type="button" class="gx-flecha" data-lado="izq"><svg viewBox="0 0 24 24"><path d="M15 5 L8 12 L15 19"/></svg></button><button type="button" class="gx-flecha" data-lado="der"><svg viewBox="0 0 24 24"><path d="M9 5 L16 12 L9 19"/></svg></button></div>`
document.querySelector('.gx')?.appendChild(panel)
const velo = document.createElement('div'); velo.className = 'gx-foco-velo'; velo.hidden = true; document.querySelector('.gx')?.prepend(velo) // la pantalla oscurecida (detrás del panel)
const dial = panel.querySelector('.gx-foco-dial'), perilla = panel.querySelector('.gx-foco-perilla'), aguja = panel.querySelector('.gx-foco-aguja')
const gota = panel.querySelector('.gx-foco-gota'), ayuda = panel.querySelector('.gx-foco-ayuda')

// 2. Controles -----------------------------------------------------------------------------------
//    Arrastrar en círculo alrededor del dial (el cambio de ángulo mueve la perilla), la rueda del mouse sobre el dial, o A / D (y las flechas)
let v = 0.5, objetivo = 0.5, girando = null, teclas = 0
const ponerV = (nv) => { v = Math.min(1, Math.max(0, nv)); dial.setAttribute('aria-valuenow', Math.round(v * 100)) }
const anguloDe = (e) => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) }
dial.addEventListener('pointerdown', (e) => { e.preventDefault(); girando = anguloDe(e); dial.setPointerCapture(e.pointerId) })
dial.addEventListener('pointermove', (e) => {
    if (girando === null) return
    const a = anguloDe(e); let d = a - girando; d = Math.atan2(Math.sin(d), Math.cos(d)); girando = a
    ponerV(v + d * 180 / Math.PI / GIRO)
})
;['pointerup', 'pointercancel'].forEach(t => dial.addEventListener(t, () => { girando = null }))
dial.addEventListener('wheel', (e) => { e.preventDefault(); ponerV(v - e.deltaY * 0.0006) }, { passive: false })
// flechas táctiles (celular): mantener una presionada es como mantener A o D
panel.querySelectorAll('.gx-flecha').forEach(b => {
    const d = b.dataset.lado === 'izq' ? -1 : 1
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); teclas = d; b.classList.add('on') })
    const soltar = () => { if (teclas === d) teclas = 0; b.classList.remove('on') }
    ;['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, soltar))
})
const alTeclado = (e) => {
    if (!activo || e.repeat) return
    const d = e.code === 'KeyA' || e.code === 'ArrowLeft' ? -1 : e.code === 'KeyD' || e.code === 'ArrowRight' ? 1 : 0
    if (!d) return
    if (e.type === 'keydown') teclas = d; else if (teclas === d) teclas = 0
}
addEventListener('keydown', alTeclado); addEventListener('keyup', alTeclado)

// 3. Minijuego --------------------------------------------------------------------------------------
let activo = false, t = 0, sintonizado = 0, ganado = false, proximaGota = 0, estaba = false
const cerca = () => Math.max(0, 1 - Math.abs(v - objetivo) / ANCHO) // 0: lejos · 1: justo en la gota
export const foco = {
    start() {
        activo = true; t = 0; sintonizado = 0; ganado = false; teclas = 0; proximaGota = 0.4; estaba = false
        objetivo = 0.12 + Math.random() * 0.76
        do { ponerV(Math.random()) } while (Math.abs(v - objetivo) < 0.35) // empieza lejos de la gota
        ayuda.textContent = document.body.classList.contains('gx-touch-on') ? 'Gira el dial con el dedo o usa las flechas.' : 'Gira el dial: arrastra en círculo, usa la rueda del mouse o A / D.'
        panel.hidden = false; velo.hidden = false
        gsap.fromTo(panel, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
        audio.radio.start()
    },
    stop() {
        activo = false; panel.hidden = true
        gsap.to(velo, { opacity: 0, duration: 0.8, onComplete: () => { velo.hidden = true } }); gsap.to(runtime, { extraBlur: 0, duration: 0.8 })
        audio.radio.stop()
    },
    update(dt) {
        t += dt
        if (teclas) ponerV(v + teclas * 0.22 * dt)
        const c = cerca(), listo = c >= SINTONIA
        sintonizado = listo ? sintonizado + dt : Math.max(0, sintonizado - dt * 0.5)
        if (listo && !estaba) haptics.buzz(30)
        estaba = listo
        // el caos baja y la gota sube mientras más cerca; la vista se aclara con ella
        audio.radio.mezcla(c, v)
        runtime.extraBlur = 6 * (1 - c); velo.style.opacity = (0.72 * (1 - c)).toFixed(3)
        // la gota cae siempre al mismo ritmo (constante: eso la hace segura); se oye y se ve más mientras más cerca
        if ((proximaGota -= dt) <= 0) { proximaGota = 0.85; audio.radio.gota(c); if (c > 0.3) gsap.fromTo(gota, { y: -6, opacity: c }, { y: 6, opacity: 0, duration: 0.6, ease: 'power1.in' }) }
        gsap.set(perilla, { rotation: (v - 0.5) * GIRO, transformOrigin: '50% 50%' })
        aguja.style.left = (v * 100).toFixed(1) + '%'
        const timeLeft = Math.max(0, CONFIG.foco.timeout - t), fill = Math.min(1, sintonizado / NECESITA)
        if (sintonizado >= NECESITA) { ganado = true; return { prompt: '', fill: 1, done: true, timeLeft } }
        if (timeLeft <= 0) return { prompt: '', fill, done: false, timeLeft: 0 }
        return { prompt: '', label: listo ? 'Quédate con la gota' : c > 0 ? 'Más cerca...' : 'Gira el dial', fill, timeLeft }
    }
}
