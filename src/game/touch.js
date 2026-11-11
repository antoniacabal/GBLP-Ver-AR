// Indice
    // 0. Condiciones
    // 1. Joystick virtual
    // 2. Botón Interactuar
    // 3. Mostrar / ocultar

// Controles táctiles: joystick a la izquierda y botón "Interactuar" a la derecha (el HTML está en narrativa.html).
import { runtime } from './config.js'

// 0. Condiciones: cuándo se muestran los controles táctiles
const narrow = matchMedia('(max-width: 768px)'), coarse = matchMedia('(pointer: coarse)')
const root = document.querySelector('.gx-touch')
let wired = false
const wanted = () => coarse.matches || narrow.matches || ('ontouchstart' in window && innerWidth < 1100)

// 1. Joystick virtual: el pulgar arrastra la perilla dentro del aro; la distancia al centro es la velocidad (runtime.joyX / joyY, de -1 a 1)
function wireJoystick() {
    const base = root.querySelector('.gx-joy'), knob = base.querySelector('.gx-joy-knob')
    let id = null
    const move = (e) => {
        const r = base.getBoundingClientRect(), R = r.width / 2
        let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R)
        const d = Math.hypot(dx, dy), max = R * 0.62 // la perilla no se sale del aro
        if (d > max) { dx *= max / d; dy *= max / d }
        knob.style.transform = `translate(${dx}px, ${dy}px)`
        runtime.joyX = dx / max; runtime.joyY = -dy / max // arriba en pantalla = adelante
    }
    const release = (e) => {
        if (e.pointerId !== id) return
        id = null; base.classList.remove('on'); knob.style.transform = ''; runtime.joyX = runtime.joyY = 0
    }
    base.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; try { base.setPointerCapture(id) } catch { /* sin captura igual funciona */ } base.classList.add('on'); move(e) })
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e) })
    base.addEventListener('pointerup', release); base.addEventListener('pointercancel', release); base.addEventListener('lostpointercapture', release)
}

// 2. Botón Interactuar: simula la tecla E (interactuar y avanzar diálogos) y la barra espaciadora (sostener para respirar)
function wireButtons() {
    const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }))
    root.querySelectorAll('.gx-key').forEach(b => {
        const on = b.dataset.k === 'KeyE' ? ['KeyE', 'Space'] : [b.dataset.k]
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); on.forEach(c => key('keydown', c)) })
        const up = () => { if (!b.classList.contains('on')) return; b.classList.remove('on'); on.forEach(c => key('keyup', c)) }
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up)
    })
}

// 3. Mostrar / ocultar: y escuchar cambios de pantalla
function apply() {
    if (!root) return
    const on = wanted()
    if (on && !wired) { wireJoystick(); wireButtons(); document.querySelector('canvas.webgl').style.touchAction = 'none'; wired = true }
    root.hidden = !on
    document.body.classList.toggle('gx-touch-on', on)
}
narrow.addEventListener('change', apply); coarse.addEventListener('change', apply); addEventListener('resize', apply)
apply()
