// Vibración del celular cuando algo se mueve en el juego (sismo, edificio, frenón del MIO, choques con gente).
// Solo funciona en teléfonos que lo permiten (Android); el botón "Vibración" de ui.js la apaga.
import { runtime } from './config.js'

const supported = typeof navigator !== 'undefined' && 'vibrate' in navigator
let on = true
export const haptics = {
    supported,
    get on() { return on },
    set(v) { on = v; if (!v) this.stop() },
    buzz(pattern) { if (supported && on && !runtime.paused) try { navigator.vibrate(pattern) } catch { /* el navegador puede bloquearla */ } },
    stop() { if (supported) try { navigator.vibrate(0) } catch { /* nada que detener */ } }
}
