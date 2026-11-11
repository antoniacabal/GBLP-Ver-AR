import { CONFIG, runtime } from './config.js'
import { canvas } from './scene.js'
import { ui } from './ui.js'
import { audio } from './audio.js'

// anxiety: 0 calma · .25 leve · .5 media · .75 alta · 1 pánico (lo que sube y baja en cada crisis)
// Niveles de ansiedad (lo que dura entre crisis). Cada uno define cómo se ve el mundo:
//   sat = saturación · blur = desenfoque (px en pantalla de computador) · pal = cuánto se acerca a la paleta de ansiedad (rojos y morados)
//   -1  antes del sismo y después del final bueno: lo más saturado, sin blur, paleta normal
//    0  después del sismo: menos saturado, blur casi nada (se va notando de a poco)
//    1  perdiste un minijuego (alucinaciones): menos saturación, blur muy bajo, la paleta de ansiedad empieza a entrar
//    2  dos seguidos (fantasmas): más rojos y morados, pero se nota la paleta normal; blur intermedio
//    3  tres seguidos (final malo): mucho blur (solo se ve clara la protagonista), colores saturados pero muy oscuros, paleta de ansiedad completa
// (después del sismo el mundo se ve casi con la paleta de ansiedad desde el nivel 0; solo vuelve a la normal al ganar, nivel -1)
const LEVELS = { '-1': { sat: 1.05, blur: 0, pal: 0 }, 0: { sat: 0.7, blur: 0.25, pal: 0.55 }, 1: { sat: 0.66, blur: 0.6, pal: 0.7 }, 2: { sat: 0.76, blur: 1.4, pal: 0.85 }, 3: { sat: 0.95, blur: 5, pal: 1 } }
const lerp = (a, b, k) => a + (b - a) * k
const at = (lv) => { // valores para un nivel con decimales (el cambio entre niveles es gradual)
    const lo = Math.max(-1, Math.min(3, Math.floor(lv))), hi = Math.min(3, lo + 1), k = Math.min(1, Math.max(0, lv - lo)), A = LEVELS[lo], B = LEVELS[hi]
    return { sat: lerp(A.sat, B.sat, k), blur: lerp(A.blur, B.blur, k), pal: lerp(A.pal, B.pal, k) }
}
// Durante una crisis (minijuego, pop-ups del MIO) el mundo se queda a medio camino del siguiente nivel: 0.5, 1.5 o 2.5.
// Así ganar o perder no cambia todo de golpe: desde ese punto medio baja o sube al nivel que toque.
// Niveles intermedios (los estados de los minijuegos):
//   0.5  primera crisis desde el nivel 0 (después del sismo, sin minijuegos perdidos)
//   1.5  crisis con un minijuego perdido seguido
//   2.5  crisis con dos perdidos seguidos (si pierde esta, llega al 3: final malo)

const CRISIS = ['ANXIETY', 'BREATHING', 'BUS_EARTH', 'BUS_LOST']
export const targetLevel = () => !runtime.postQuake || runtime.healed ? -1 : Math.min(3, (runtime.failStreak || 0) + (CRISIS.includes(runtime.state) ? 0.5 : 0))

let last = ''
export function updateAnxiety(dt = 0) {
    const a = Math.min(1, Math.max(0, runtime.anxiety)), C = CONFIG.anxiety
    runtime.anxiety = a
    // el nivel visible se acerca despacio al real: los cambios "se empiezan a notar" en vez de saltar (sube más rápido de lo que baja)
    const want = targetLevel()
    if (runtime.levelVis === undefined) runtime.levelVis = want
    else runtime.levelVis += Math.sign(want - runtime.levelVis) * Math.min(Math.abs(want - runtime.levelVis), dt * (want > runtime.levelVis ? 0.5 : runtime.healed ? 1.5 : 0.25)) // al ganar todo vuelve a la normal en un par de segundos
    // ansiedad visible: sigue a la del momento pero sin saltos (antes, al terminar una crisis, la viñeta, la saturación y los edificios volvían de golpe)
    runtime.visAnx = runtime.visAnx === undefined ? a : runtime.visAnx + (a - runtime.visAnx) * Math.min(1, dt * 0.7)
    const v = runtime.visAnx
    const L = at(runtime.levelVis), screen = Math.min(1, Math.max(0.45, innerWidth / 1200)) // en pantallas angostas (celular) el mismo blur pesa más
    // la crisis del momento suma un poco encima del nivel (más ansiedad = más blur y más paleta de ansiedad)
    const blur = (L.blur + 0.6 * v * v + (runtime.extraBlur || 0)) * screen, sat = L.sat * (1 - 0.15 * v)
    runtime.palette = Math.min(1, L.pal + 0.3 * v) // environment.js pinta el mundo con esta mezcla
    const f = `saturate(${sat.toFixed(3)}) blur(${blur.toFixed(2)}px)`
    if (f !== last) { canvas.style.filter = f; last = f }
    runtime.sharpPlayer = runtime.levelVis > 2.75 // nivel 3: la protagonista se ve nítida sobre el mundo borroso (scene.js)
    ui.vignette.style.opacity = (C.vignetteMax * Math.max(v, L.pal * 0.6)).toFixed(3)
    audio.setIntensity(a)
}
