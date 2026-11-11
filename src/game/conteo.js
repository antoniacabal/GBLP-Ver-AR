// Indice
    // 0. Imports
    // 1. Crisis de disociación: entrada y salida (cámara, mundo semitransparente, desenfoque)
    // 2. La mano: cuántos dedos levantados
    // 3. Respuesta sensorial: sonido, vibración y luz
    // 4. Panel y adaptación a la pantalla (celular de pie o acostado, computador)
    // 5. Minijuego (rondas)

// Conteo de grounding (técnica de anclaje): en medio de un temblor fantasma, Gabriela siente que el cuarto se aleja. Para volver,
// cuenta lo que ve: aparece una mano con algunos dedos levantados (de 0 a 5, y a veces dos manos: hasta 10) y tres números; hay que tocar el correcto. Cada acierto cambia
// la mano y reordena los números, como un ejercicio rápido de reconocimiento. Con 5 aciertos la crisis pasa. Cada error cambia la mano,
// sacude todo el panel y pinta de rojo uno de los tres círculos de abajo; al tercero se pierde.
// Tiene la misma forma que el Earthing (start / stop / update), así breathing.js lo maneja igual que los demás minijuegos

// 0. Imports
import gsap from 'gsap'
import { CONFIG, runtime } from './config.js'
import { spaces } from './environment.js'
import { audio } from './audio.js'
import { haptics } from './haptics.js'

const META = 5 // aciertos para salir de la crisis
const VIDAS = 3 // equivocaciones permitidas: al tercer error la crisis no pasa (los tres círculos de abajo)

// 1. Crisis de disociación ------------------------------------------------------------
//    Entrada: la cámara se ladea (ángulo holandés de 0.08 rad) y se bambolea, el cuarto pierde presencia (los objetos quedan al 35 %
//    de opacidad) y la pantalla se desenfoca. Salida: todo vuelve a su lugar con una línea de tiempo de GSAP.
//    camera.js lee runtime.dutch / runtime.dutchSway (la cámara se reorienta en cada cuadro) y anxiety.js suma runtime.extraBlur
const guardados = new Map() // material → { transparent, opacity } originales (para devolverlos tal cual)
let crisis = null
const materialesDe = (sp) => {
    const out = new Set()
    spaces[sp]?.traverse(o => { if (o.isMesh && o.visible) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && out.add(m)) })
    return [...out].filter(m => !m.transparent || guardados.has(m)) // los que ya eran transparentes (brillos, fallas) se dejan como están
}
function entrarCrisis() {
    crisis?.kill(); gsap.killTweensOf(runtime, 'dutch,dutchSway,extraBlur')
    const mats = materialesDe(runtime.space)
    mats.forEach(m => { if (!guardados.has(m)) guardados.set(m, { transparent: m.transparent, opacity: m.opacity }); m.transparent = true; m.needsUpdate = true })
    runtime.dutchSway = -1
    crisis = gsap.timeline()
        .to(runtime, { dutch: 0.08, duration: 0.9, ease: 'power2.out' }, 0)
        .to(mats, { opacity: 0.35, duration: 1.2, ease: 'power1.inOut' }, 0)
        .to(runtime, { extraBlur: 2.2, duration: 1.2 }, 0)
    gsap.to(runtime, { dutchSway: 1, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }) // bamboleo
}
function salirCrisis() {
    crisis?.kill(); gsap.killTweensOf(runtime, 'dutch,dutchSway,extraBlur')
    const mats = [...guardados.keys()]
    crisis = gsap.timeline({ onComplete: () => { guardados.forEach((g, m) => { m.transparent = g.transparent; m.opacity = g.opacity; m.needsUpdate = true }); guardados.clear(); crisis = null } })
        .to(runtime, { dutch: 0, dutchSway: 0, duration: 0.8, ease: 'power2.inOut' }, 0)
        .to(mats, { opacity: (i, m) => guardados.get(m)?.opacity ?? 1, duration: 0.9, ease: 'power1.out' }, 0)
        .to(runtime, { extraBlur: 0, duration: 0.8 }, 0)
}

// 2. La mano ----------------------------------------------------------------------------
//    Las ilustraciones de static/assets/minijuego (mano0.png a mano5.png: de puño cerrado a los cinco dedos). La mano sale un poco
//    girada y a veces reflejada, para que no se cuente de memoria. Se cargan antes, así no parpadean al cambiar
// ancho de cada imagen en px (no miden lo mismo: el puño es más bajo y la mano abierta más ancha). Se muestran todas a la misma escala,
// cada una con su ancho relativo a la más ancha y alineadas por abajo (por la manga): así ninguna se ve más grande que las otras
const ANCHOS = [424, 444, 517, 483, 532, 684], MAX_ANCHO = 684
const MANOS = [0, 1, 2, 3, 4, 5].map(n => { const img = new Image(); img.src = 'assets/minijuego/mano' + n + '.png'; img.alt = ''; img.draggable = false; return img })

// 3. Respuesta sensorial ------------------------------------------------------------------
//    Acierto: dos notas que suben (520 y 660 Hz), un pulso corto de vibración y un brillo menta alrededor de la mano y del botón.
//    Error: un golpe grave (120 Hz), vibración doble, el botón se pone rojo y todo el panel tiembla de lado a lado.
//    Calma: de fondo suena un ruido sordo que, con cada acierto, se apaga y se vuelve más grave (filtro pasa-bajos: audio.ruido)
const sentir = {
    acierto(boton) {
        audio.blip(520, 0.18, 0.07); gsap.delayedCall(0.09, () => audio.blip(660, 0.32, 0.07))
        haptics.buzz(40)
        gsap.fromTo(boton, { scale: 1 }, { scale: 1.15, backgroundColor: '#9ff0de', duration: 0.15, yoyo: true, repeat: 1, ease: 'power1.out' })
        gsap.fromTo(manoEl, { boxShadow: '0 0 0 0 rgba(159,240,222,.9)' }, { boxShadow: '0 0 0 18px rgba(159,240,222,0)', duration: 0.6, ease: 'power2.out' })
    },
    error(boton) {
        audio.blip(120, 0.35, 0.12, 'triangle')
        haptics.buzz([60, 40, 60])
        gsap.fromTo(panel, { x: 0 }, { x: 14, duration: 0.07, repeat: 5, yoyo: true, ease: 'power1.inOut', onComplete: () => gsap.set(panel, { x: 0 }) })
        gsap.fromTo(boton, { backgroundColor: '#F2B8B5' }, { backgroundColor: '#E4FFFF', duration: 0.5, delay: 0.2 })
    },
    calma: (k) => audio.ruido.calma(k) // 0: recién empieza · 1: completó el ejercicio
}

// 4. Panel ----------------------------------------------------------------------------------
//    Botones grandes (más de 64 px: en medio de un temblor es fácil fallar el dedo), con pointerdown (sin la espera de 300 ms del toque)
//    y una respuesta inmediata al presionar y soltar. En pantallas bajas y anchas (celular acostado) la mano va a la izquierda y los
//    números en columna a la derecha; si se rota el teléfono, todo se acomoda con una animación (FLIP con GSAP)
const panel = document.createElement('div')
panel.className = 'gx-conteo'; panel.hidden = true; panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Conteo de grounding')
panel.innerHTML = '<p class="gx-conteo-titulo">¿Cuántos dedos ves?</p><div class="gx-conteo-mano"></div><div class="gx-conteo-ops"></div><div class="gx-conteo-vidas" aria-label="Errores">' + '<i></i>'.repeat(VIDAS) + '</div>'
document.querySelector('.gx')?.appendChild(panel)
const manoEl = panel.querySelector('.gx-conteo-mano'), opsEl = panel.querySelector('.gx-conteo-ops'), vidasEl = panel.querySelector('.gx-conteo-vidas')
const acostado = () => innerWidth > innerHeight && innerHeight < 560
let forma = ''
function acomodar(animar = true) {
    const nueva = acostado() ? 'horizontal' : 'vertical'
    if (nueva === forma) return
    const piezas = [manoEl, ...opsEl.children], antes = piezas.map(el => el.getBoundingClientRect())
    forma = nueva; panel.classList.toggle('gx-conteo--horizontal', nueva === 'horizontal')
    if (!animar || panel.hidden) return
    piezas.forEach((el, i) => { const d = el.getBoundingClientRect(); gsap.from(el, { x: antes[i].left - d.left, y: antes[i].top - d.top, duration: 0.45, ease: 'power2.inOut' }) })
}
addEventListener('resize', () => acomodar())

// 5. Minijuego -------------------------------------------------------------------------------
let aciertos = 0, errores = 0, t = 0, objetivo = -1, ganado = false, perdido = false, ocupado = false
const mezclar = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const DOS_MANOS = 0.35 // probabilidad de que la ronda tenga dos manos (se cuenta hasta 10)
function ronda(primera = false) {
    // una mano (0 a 5) o, a veces, dos manos (hasta 10). Nunca el mismo total dos veces seguidas
    let dedos, n
    do { dedos = Math.random() < DOS_MANOS ? [1 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 6)] : [Math.floor(Math.random() * 6)]; n = dedos[0] + (dedos[1] ?? 0) } while (n === objetivo)
    objetivo = n
    const dos = dedos.length === 2
    manoEl.classList.toggle('gx-conteo-mano--dos', dos)
    manoEl.replaceChildren(...dedos.map(d => { const img = MANOS[d].cloneNode(); img.style.width = (ANCHOS[d] / MAX_ANCHO * (dos ? 48 : 100)).toFixed(1) + '%'; return img }))
    ;[...manoEl.children].forEach((img, i) => {
        // con dos manos: la de la izquierda reflejada (como la mano izquierda) y la de la derecha normal; con una, al azar
        const espejo = dos ? (i === 0 ? -1 : 1) : (Math.random() < 0.5 ? 1 : -1)
        gsap.fromTo(img, { scale: 0.6, opacity: 0, rotation: 0 }, { scaleX: espejo, scaleY: 1, opacity: 1, rotation: (Math.random() * 2 - 1) * (dos ? 8 : 12), duration: 0.35, ease: 'back.out(1.7)', transformOrigin: '50% 60%', delay: (primera ? 0 : 0.1) + i * 0.06 })
    })
    // tres opciones: la correcta y dos distintas, en un orden nuevo cada vez (con dos manos, números cercanos: hay que contar de verdad)
    const candidatos = dos ? [n - 3, n - 2, n - 1, n + 1, n + 2, n + 3].filter(v => v >= 0 && v <= 10) : [0, 1, 2, 3, 4, 5].filter(v => v !== n)
    const otras = mezclar(candidatos).slice(0, 2)
    opsEl.innerHTML = ''
    mezclar([n, ...otras]).forEach((v, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gx-conteo-op'; b.textContent = v; b.setAttribute('aria-label', `${v} dedos`)
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); gsap.to(b, { scale: 0.92, duration: 0.08 }); elegir(b, v) })
        b.addEventListener('pointerup', () => gsap.to(b, { scale: 1, duration: 0.12 }))
        b.addEventListener('pointerleave', () => gsap.to(b, { scale: 1, duration: 0.12 }))
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(b, v) } }) // con teclado también
        opsEl.appendChild(b)
        gsap.fromTo(b, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.7)', delay: 0.06 * i + (primera ? 0 : 0.12) })
    })
}
function elegir(b, v) {
    if (ocupado || ganado || perdido || runtime.paused) return
    if (v !== objetivo) {
        // error: se marca un círculo, todo tiembla y cambia la mano (no se puede adivinar probando los otros números)
        sentir.error(b); errores++; ocupado = true
        vidasEl.children[errores - 1]?.classList.add('gx-conteo-vida--mal')
        gsap.to([...opsEl.children].filter(o => o !== b), { opacity: 0.4, duration: 0.15 })
        gsap.delayedCall(0.55, () => { ocupado = false; if (errores >= VIDAS) { perdido = true; return } ronda() })
        return
    }
    aciertos++; ocupado = true
    sentir.acierto(b); sentir.calma(aciertos / META)
    gsap.to([...opsEl.children].filter(o => o !== b), { opacity: 0, scale: 0.8, duration: 0.15 }) // las demás se van enseguida
    gsap.delayedCall(0.32, () => {
        ocupado = false
        if (aciertos >= META) { ganado = true; return }
        ronda()
    })
}

export const conteo = {
    start() {
        aciertos = 0; errores = 0; t = 0; objetivo = -1; ganado = false; perdido = false; ocupado = false
        ;[...vidasEl.children].forEach(i => i.classList.remove('gx-conteo-vida--mal'))
        acomodar(false); panel.hidden = false
        gsap.fromTo(panel, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
        entrarCrisis(); audio.ruido.start(); ronda(true)
    },
    stop() { panel.hidden = true; salirCrisis(); audio.ruido.stop() },
    update(dt) {
        t += dt
        const timeLeft = Math.max(0, CONFIG.conteo.timeout - t), fill = aciertos / META
        if (ganado) return { prompt: '', fill: 1, done: true, timeLeft }
        if (timeLeft <= 0 || perdido) return { prompt: '', fill, done: false, timeLeft }
        return { prompt: '', label: `${aciertos} de ${META}`, fill, timeLeft }
    }
}
