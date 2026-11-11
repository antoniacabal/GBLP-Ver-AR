// Indice
    // 0. Imports
    // 1. Técnicas de autorregulación
    // 2. Estado y controles
    // 3. Elección al azar
    // 4. API pública (breathing)

// 0. Imports
import { CONFIG, runtime } from './config.js'
import { GAMES } from './minigames.js'
import gsap from 'gsap'
// A veces (40 %) un minijuego empieza con la cámara ladeada y meciéndose de lado a lado, como en el conteo: el mareo de la crisis.
// No en el conteo (ya lo tiene) ni en Reconstruir la gravedad (ahí la cámara se inclina con Gabriela)
let meciendo = false
const mecer = (si) => {
    gsap.killTweensOf(runtime, 'dutch,dutchSway'); meciendo = si
    if (si) { runtime.dutchSway = -1; gsap.to(runtime, { dutch: (Math.random() < 0.5 ? -1 : 1) * 0.06, duration: 0.9, ease: 'power2.out' }); gsap.to(runtime, { dutchSway: 1, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' }) }
    else gsap.to(runtime, { dutch: 0, dutchSway: 0, duration: 0.8, ease: 'power2.inOut' })
}

// 1. Técnicas de autorregulación (page = sección de respiracion-consciente.html que la explica)
const S = (l, d, f, t, lab) => ({ l, d, f, t, lab }) // lab: rótulo propio del medidor (si no, Inhalar / Sostener / Exhalar / Pausa)
const HOLD = 'Mantén el clic (o la barra espaciadora) al inhalar y sostener; suéltalo al exhalar y en la pausa. El reloj cuenta los segundos de cada fase: cambia justo cuando llega a 0.'
const R = 'respiracion-consciente.html#respira'
// Las mismas técnicas que explica la página de respiración consciente. Respiraciones: solo 5 (caja, exhalación prolongada, labios
// fruncidos, suspiro fisiológico y 4-7-8). Después, los minijuegos de grounding y el Earthing
export const TECHS = [
    { id: 'box', name: 'Respiración en caja (4-4-4-4)', page: R, help: HOLD + ' (4 s · 4 s · 4 s · 4 s)', segs: [S('Inhala por la nariz', 4, 0, 1), S('Retén el aire', 4, 1, 1), S('Exhala por la boca', 4, 1, 0), S('Mantén los pulmones vacíos', 4, 0, 0)] },
    { id: 'exhale', name: 'Exhalación prolongada', page: R, help: HOLD,
        build: () => { const ex = Math.random() < 0.5 ? 6 : 8; return { name: `Exhalación prolongada (4-${ex})`, help: HOLD + ` (4 s · ${ex} s)`, segs: [S('Inhala por la nariz', 4, 0, 1), S('Exhala despacio por la boca', ex, 1, 0)] } } }, // ritmo 4-6 o 4-8 al azar
    { id: 'lips', name: 'Respiración con labios fruncidos (2-4)', page: R, help: HOLD + ' (2 s · 4 s)', segs: [S('Inhala suave por la nariz', 2, 0, 1), S('Exhala por la boca con los labios fruncidos', 4, 1, 0)] },
    { id: '478', name: 'Técnica 4-7-8', page: R, help: HOLD + ' (4 s · 7 s · 8 s)', segs: [S('Inhala por la nariz hacia el abdomen', 4, 0, 1), S('Sostén la respiración', 7, 1, 1), S('Exhala por la boca con un soplido suave', 8, 1, 0)] },
    { id: 'sigh', name: 'Suspiro fisiológico', page: R, help: HOLD + ' (inhala, un sorbo más de aire y exhala muy lento)', segs: [S('Inhala profundo por la nariz', 3, 0, 0.8), S('Sin soltar: otro sorbo corto de aire', 1, 0.8, 1, 'Otro sorbo'), S('Exhala muy despacio por la boca', 6, 1, 0)] },
    { id: 'gravedad', name: 'Reconstruir la gravedad', page: 'respiracion-consciente.html#gravedad', help: 'El mareo inclina el marco de la puerta: enderézalo contra la plomada y sostenlo derecho.', game: 'gravedad' },
    { id: 'foco', name: 'Foco entre el ruido', page: 'respiracion-consciente.html#foco', help: 'Gira el dial hasta encontrar la gota que cae entre el ruido y quédate ahí.', game: 'foco' },
    { id: 'conteo', name: 'Conteo de grounding', page: 'respiracion-consciente.html#conteo', help: 'Cuenta los dedos levantados y toca el número correcto. Con 5 aciertos la crisis pasa.', game: 'conteo' },
    { id: 'earth', name: 'Earthing físico', page: 'respiracion-consciente.html#caminar', help: 'Camina (WASD, flechas o el joystick) hasta el pasto, a un lado del camino, y quédate sobre él respirando lento. Solo ahí baja tu ansiedad.', game: 'earth' },
]
const actionOf = (seg) => seg.t > seg.f || (seg.t === seg.f && seg.t > 0.5) ? 'hold' : 'release' // qué debe hacer el jugador en cada tramo
const faseOf = (seg) => seg.t > seg.f ? 'inhale' : seg.t < seg.f ? 'exhale' : seg.t > 0.5 ? 'hold' : 'pause' // para los colores del medidor (inhalar, sostener, exhalar, pausa)
const labelOf = (seg) => seg.lab || (seg.t > seg.f ? 'Inhalar' : seg.t < seg.f ? 'Exhalar' : seg.t > 0.5 ? 'Sostener' : 'Pausa') // lo que dice el rótulo del medidor (Pausa = pulmones vacíos)

// 2. Estado y controles: clic o espacio sostenidos (los botones y pop-ups no cuentan como "inhalar")
let forced = null, active = false, tech = null, picked = null, last = -1, si = 0, st = 0, L = 0, good = 0, total = 0, holding = false, hooks = {}, lead = 0
const set = (h) => { holding = h }
const ignored = (e) => e.target?.closest?.('button, .gx-modal, .gx-talk, .gx-card, .gx-joy') // el joystick camina, no respira
addEventListener('pointerdown', (e) => { if (!runtime.paused && !ignored(e)) set(true) }); addEventListener('pointerup', () => set(false)); addEventListener('pointercancel', () => set(false)); addEventListener('blur', () => set(false))
addEventListener('keydown', (e) => { if (e.code === 'Space') { if (!runtime.paused) set(true); if (active) e.preventDefault() } })
addEventListener('keyup', (e) => { if (e.code === 'Space') set(false) })
const finish = (ok) => { breathing.stop(); hooks.onCycle?.(ok) }

// 3. Elección al azar: primero el tipo de minijuego (respiración, reconstruir la gravedad, foco entre el ruido, conteo de grounding en la casa
//    o Earthing en la calle) y después la técnica.
//    Antes cada técnica pesaba lo mismo y como hay 5 respiraciones, casi siempre salía una: ahora Earthing sale más seguido.
//    El mismo tipo dos veces seguidas es menos probable, y nunca la misma técnica que acaba de salir
// (gravedad y conteo salen más seguido: antes casi no aparecían; conteo, que era solo de la casa, ahora sale en todas partes)
const PESOS = { casa: { hold: 0.15, conteo: 0.35, gravedad: 0.3, foco: 0.2 }, calle: { hold: 0.15, earth: 0.25, gravedad: 0.25, conteo: 0.2, foco: 0.15 }, mio: { hold: 0.2, earth: 0.15, gravedad: 0.25, conteo: 0.2, foco: 0.2 } }
const kindOf = (t) => t.game || 'hold'
const randomPick = (space, noEarth) => {
    const pesos = { ...PESOS[indoors(space) ? 'casa' : space === 'BUS' ? 'mio' : 'calle'] }
    if (noEarth) delete pesos.earth
    // ("Foco entre el ruido" sale también con el sonido apagado: se juega igual con la vista, que se aclara al acercarse a la gota)
    const prev = TECHS[last] ? kindOf(TECHS[last]) : null
    if (prev && pesos[prev] && Object.keys(pesos).length > 1) pesos[prev] *= 0.4
    let r = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0), kind = Object.keys(pesos)[0]
    for (const k in pesos) { if ((r -= pesos[k]) <= 0) { kind = k; break } }
    const ok = TECHS.map((_, i) => i).filter(i => !TECHS[i].extra && kindOf(TECHS[i]) === kind && (i !== last || kind !== 'hold'))
    return ok[Math.floor(Math.random() * ok.length)]
}
const indoors = (space) => space === 'HOUSE' || space === 'HOME' // en la casa no hay pasto

// 4. API pública (breathing)
export const breathing = {
    init(h) { hooks = h },
    force(id) { forced = id }, // la próxima crisis usa esta técnica (debug)
    pick(space, noEarth = false) { // noEarth: ya salió dos veces seguidas (main.js lleva la cuenta)
        let i; if (forced) { i = Math.max(0, TECHS.findIndex(t => t.id === forced)); forced = null } // modo ?debug: elegir el minijuego
        else i = randomPick(space, noEarth)
        last = i; picked = TECHS[i].build ? { ...TECHS[i], ...TECHS[i].build() } : TECHS[i] // build: la exhalación elige 4-6 o 4-8 cada vez
        // toda técnica de respiración puede hacerse una vez o dos seguidas (al azar)
        // (el último tramo de la primera vuelta lleva la marca repite: ahí el círculo de afuera avisa, brillando dos veces, que viene otra vuelta)
        if (picked.segs && Math.random() < 0.5) { const sg = picked.segs; picked = { ...picked, segs: [...sg.slice(0, -1), { ...sg[sg.length - 1], repite: true }, ...sg], help: picked.help.replace(/\)$/, ', dos veces)') } }
        runtime.techId = picked.id; return picked
    },
    prepare() { return picked || this.pick(runtime.space) }, // la técnica que toca (se elige si aún no hay una)
    start() {
        tech = picked || this.pick(runtime.space); picked = null; active = true; si = 0; st = 0; L = 0; good = total = 0; lead = CONFIG.breathing.lead
        Object.assign(runtime, { techName: tech.name, techHelp: tech.help, techId: tech.id, level: 0, target: 0, stepFill: 0, breathProgress: 0, prompt: '', action: '', label: '', timeLeft: tech.segs ? tech.segs[0].d : CONFIG.earth.timeout })
        if (tech.game) GAMES[tech.game].start()
        if (tech.game !== 'conteo' && tech.game !== 'gravedad' && Math.random() < 0.4) mecer(true) // a veces, la cámara mareada
    },
    stop() { if (meciendo) mecer(false); active = false; runtime.phase = ''; runtime.action = ''; runtime.label = ''; runtime.cue = false; runtime.count = 0; if (tech?.game) GAMES[tech.game].stop() },
    get active() { return active },
    update(dt) {
        if (!active) return
        const B = CONFIG.breathing
        if (tech.game) { // minijuegos
            const r = GAMES[tech.game].update(dt)
            Object.assign(runtime, { prompt: r.prompt, label: r.label || '', fase: '', stepFill: r.fill, target: -1, breathProgress: r.fill, action: '', timeLeft: r.timeLeft })
            if (r.done !== undefined) finish(r.done)
            return
        }
        const seg = tech.segs[si]
        if (lead > 0) { lead -= dt; Object.assign(runtime, { level: 0, target: 0, prompt: '', label: labelOf(seg), fase: faseOf(seg), count: Math.max(1, Math.ceil(lead)), action: '', cue: false, breathProgress: 0, timeLeft: seg.d }); return } // cuenta 3, 2, 1 antes de que el aro empiece a moverse
        st += dt
        const target = seg.f + (seg.t - seg.f) * Math.min(st / seg.d, 1)
        // la barra sube mientras mantienes y baja al soltar, a la misma velocidad que la aguja en ese tramo
        const slope = (seg.t - seg.f) / seg.d, upV = slope > 0 ? slope : B.rate, downV = slope < 0 ? -slope : B.rate
        L = Math.min(1, Math.max(0, L + (holding ? upV : -downV) * dt))
        // se califica el timing: mantener al inhalar y sostener, soltar al exhalar y en la pausa (al empezar cada fase hay un margen de B.grace s)
        total += dt; if (st < B.grace || holding === (actionOf(seg) === 'hold')) good += dt
        // soltar antes de tiempo (al inhalar o sostener) hasta salirse de la franja gris clara: se pierde en el acto
        if (actionOf(seg) === 'hold' && !holding && st >= B.grace && L < target - B.tol) return finish(false)
        // aviso de repetición: en el último tramo antes de que el ejercicio se repita, el círculo de afuera brilla dos veces (también en la
        // respiración en caja, que termina con los pulmones vacíos: antes solo avisaba si la vuelta terminaba exhalando)
        const left = seg.d - st, cue = !!seg.repite && ((left <= 1.3 && left > 0.95) || (left <= 0.6 && left > 0.25))
        Object.assign(runtime, { level: L, target, prompt: seg.l, label: labelOf(seg), action: actionOf(seg), fase: faseOf(seg), cue, count: 0, breathProgress: L, timeLeft: Math.max(0, seg.d - st) }) // el reloj cuenta los segundos de la fase (4, 6 u 8)
        if (st >= seg.d) {
            // al terminar de inhalar, la barra tiene que estar en la franja gris: si no, el minijuego se pierde (premia el buen timing)
            if (seg.t > seg.f && L < seg.t - B.tol) return finish(false)
            si++; st = 0; hooks.onPhase?.(si); if (si >= tech.segs.length) finish(good / total >= B.pass)
        }
    }
}