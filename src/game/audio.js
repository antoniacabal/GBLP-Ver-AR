// Indice
    // 0. Aviso: música de reemplazo (placeholder)
    // 1. Estado y utilidades
    // 2. Mezcla de música y tensión
    // 3. Inicio del audio
    // 4. Efectos de sonido
    // 5. API pública (audio)

// 0. Aviso: música de reemplazo (placeholder)
// TEMP_AUDIO: sonido procedural para probar; sustituir por archivos en /static/audio
//
// ┌──────────────────────────────────────────────────────────────────────────────┐
// │ ⚠️  PLACEHOLDER · MÚSICA TRANQUILA DEL INICIO                                │
// │ Ahora suena un pad procedural (acorde suave + campanitas) SOLO para probar.  │
// │ Para usar la pista definitiva: guardarla en /static/audio y escribir su      │
// │ ruta en CALM_MUSIC_FILE, por ejemplo '/audio/musica-tranquila.mp3'.          │
// └──────────────────────────────────────────────────────────────────────────────┘
import gsap from 'gsap' // (el ruido del conteo de grounding se apaga con GSAP)
const CALM_MUSIC_FILE = ''

// 1. Estado y utilidades
let ctx, drone, droneGain, calmGain, musicOn = true, fxOn = true, beat = 0, bellT = 3, lastA = 0, mixA = -1
const clamp01 = (v) => Math.min(1, Math.max(0, v))

// 2. Mezcla de música y tensión: la música tranquila domina con poca ansiedad; el drone grave entra cuando la ansiedad sube
function mix(a, force) {
    if (!ctx) return
    if (!force && Math.abs(a - mixA) < 0.01) return
    mixA = a
    calmGain.gain.setTargetAtTime(musicOn ? 0.045 * (1 - clamp01((a - 0.1) / 0.5)) : 0, ctx.currentTime, 0.6) // volumen bajado (antes 0.07 y 0.1)
    droneGain.gain.setTargetAtTime(musicOn ? 0.065 * clamp01((a - 0.08) / 0.8) : 0, ctx.currentTime, 0.4)
}

// 3. Inicio del audio: se llama con el primer gesto del usuario
function init() {
    if (ctx) { ctx.resume(); return }
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    // Tensión: drone grave (empieza en silencio y sube con la ansiedad)
    droneGain = ctx.createGain(); droneGain.gain.value = 0; droneGain.connect(ctx.destination)
    drone = ctx.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 55
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220
    drone.connect(lp); lp.connect(droneGain); drone.start()
    // Calma: música tranquila del inicio (entra suave y se va apagando cuando sube la ansiedad)
    calmGain = ctx.createGain(); calmGain.gain.value = 0; calmGain.connect(ctx.destination)
    if (CALM_MUSIC_FILE) {
        const el = new Audio(CALM_MUSIC_FILE); el.loop = true
        ctx.createMediaElementSource(el).connect(calmGain); el.play().catch(() => {})
    } else {
        // (sin pista definitiva: suena el pad procedural de prueba; ver el recuadro PLACEHOLDER de arriba. Antes avisaba en la consola)
        const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 900
        const trem = ctx.createGain(); trem.gain.value = 0.8
        soft.connect(trem); trem.connect(calmGain)
        ;[130.81, 164.81, 196.0, 246.94].forEach((f, i) => { // acorde de do mayor con séptima
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4; g.gain.value = 0.22
            o.connect(g); g.connect(soft); o.start()
        })
        const lfo = ctx.createOscillator(), lg = ctx.createGain() // respiración lenta del volumen
        lfo.frequency.value = 0.12; lg.gain.value = 0.2; lfo.connect(lg); lg.connect(trem.gain); lfo.start()
    }
    mix(lastA, true)
}

// 4. Efectos de sonido
function blip(freq, dur = 0.25, vol = 0.08, type = 'sine') {
    if (!ctx || !fxOn || !isFinite(freq)) return
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.value = freq
    g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur)
}
function bell() { // campanita suave de la música tranquila (nota al azar de una escala pentatónica)
    const f = [523.25, 587.33, 659.25, 783.99, 880][Math.floor(Math.random() * 5)], t = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = f
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
    o.connect(g); g.connect(calmGain); o.start(t); o.stop(t + 2.7)
}

// 5. API pública (audio)
// Sonidos grabados (static/audios): el terremoto y la sirena. Pasan por el mismo audio del juego, así que la pausa y "Música: OFF" también los afectan.
// ahogado: suena apagado, como de lejos o bajo el agua (un filtro pasa-bajos cuyo corte se mece despacio, como cuando el agua se mueve)
const playing = new Set()
function playFile(url, { volume = 0.7, loop = false, ahogado = false } = {}) {
    if (!ctx || !fxOn) return null
    const el = new Audio(url), g = ctx.createGain(); el.loop = loop; g.gain.value = volume
    const fuente = ctx.createMediaElementSource(el)
    if (ahogado) {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 2.5
        const lfo = ctx.createOscillator(), prof = ctx.createGain(); lfo.frequency.value = 0.35; prof.gain.value = 160; lfo.connect(prof); prof.connect(f.frequency); lfo.start()
        fuente.connect(f); f.connect(g); el.addEventListener('pause', () => { try { lfo.stop() } catch {} }, { once: true })
    } else fuente.connect(g)
    g.connect(ctx.destination)
    const snd = {
        el, g,
        fade(d = 1.5) { // se apaga despacio (curva suave hasta 0, sin cortes) y se detiene
            const t = ctx.currentTime, v = g.gain.value, curve = new Float32Array(32).map((_, i) => v * Math.cos(i / 31 * Math.PI / 2))
            g.gain.cancelScheduledValues(t); g.gain.setValueCurveAtTime(curve, t, d); setTimeout(() => snd.stop(), d * 1000 + 300)
        },
        stop() { el.pause(); playing.delete(snd) }
    }
    el.addEventListener('ended', () => playing.delete(snd)); el.play().catch(() => {}); playing.add(snd)
    return snd
}

// Ruido de fondo del conteo de grounding: un ruido sordo (café) que pasa por un filtro pasa-bajos. Con cada acierto el filtro baja y el volumen
// también (GSAP): suena como si el mundo se fuera calmando. Respeta "Efectos: OFF"
let ruidoSrc = null, ruidoFiltro = null, ruidoGain = null
const RUIDO = 0.05
const ruido = {
    start() {
        if (!ctx || ruidoSrc) return
        const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
        let ult = 0; for (let i = 0; i < len; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ult * 3.5 }
        ruidoSrc = ctx.createBufferSource(); ruidoSrc.buffer = buf; ruidoSrc.loop = true
        ruidoFiltro = ctx.createBiquadFilter(); ruidoFiltro.type = 'lowpass'; ruidoFiltro.frequency.value = 1800
        ruidoGain = ctx.createGain(); ruidoGain.gain.value = 0
        ruidoSrc.connect(ruidoFiltro); ruidoFiltro.connect(ruidoGain); ruidoGain.connect(ctx.destination); ruidoSrc.start()
        gsap.to(ruidoGain.gain, { value: fxOn ? RUIDO : 0, duration: 0.8 })
    },
    calma(k) { // 0 → 1
        if (!ruidoSrc) return
        gsap.to(ruidoFiltro.frequency, { value: 1800 - 1500 * k, duration: 0.8, ease: 'power2.out' })
        gsap.to(ruidoGain.gain, { value: (fxOn ? RUIDO : 0) * (1 - 0.75 * k), duration: 0.8 })
    },
    stop() {
        if (!ruidoSrc) return
        const src = ruidoSrc, g = ruidoGain; ruidoSrc = null
        gsap.to(g.gain, { value: 0, duration: 0.6, onComplete: () => { try { src.stop() } catch { /* ya se detuvo */ } } })
    }
}

// Ruido blanco o café (para el caos de la radio, el suspiro y el ruido del conteo)
function bufferRuido(cafe = false, seg = 2) {
    const len = ctx.sampleRate * seg, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
    let ult = 0
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (cafe) { ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.5 } else d[i] = w }
    return buf
}
// Suspiro de alivio (al ganar Reconstruir la gravedad): aire filtrado que entra y sale despacio
function suspiro() {
    if (!ctx || !fxOn) return
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
    src.buffer = bufferRuido(false, 2.4); f.type = 'bandpass'; f.Q.value = 0.8
    f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1100, t + 0.8); f.frequency.linearRampToValueAtTime(450, t + 2.2)
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.7); g.gain.linearRampToValueAtTime(0.03, t + 1.1); g.gain.linearRampToValueAtTime(0, t + 2.3)
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + 2.4)
}
// Foco entre el ruido (volúmenes bajos a propósito: se siente el caos sin lastimar los oídos; nada agudo ni fuerte): el caos de después del sismo (sirena, alarma de carro, zumbido en los oídos, retumbos y estática que cambia con el
// dial) y, escondida, una gota que cae a ritmo constante. mezcla(c, v): c = qué tan cerca está el dial de la gota (0 a 1) · v = posición del dial
let radioNodos = null
const CAOS = 0.6 // volumen máximo del caos
const radio = {
    start() {
        if (!ctx || radioNodos) return
        const t = ctx.currentTime, caos = ctx.createGain(); caos.gain.value = 0; caos.connect(ctx.destination)
        const osc = (tipo, f, vol) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.value = f; g.gain.value = vol; o.connect(g); g.connect(caos); o.start(); return o }
        const lfo = (f, prof, destino) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = prof; o.connect(g); g.connect(destino); o.start(); return o }
        const sirena = osc('triangle', 760, 0.018); const l1 = lfo(0.22, 220, sirena.frequency) // sirena lejana (triangular: sin el filo del diente de sierra)
        const alarma = osc('triangle', 980, 0.005); const l2 = lfo(3, 160, alarma.frequency)  // alarma de carro, al fondo
        const zumbido = osc('sine', 2900, 0.0025)                                                 // zumbido en los oídos: apenas se nota (antes 5200 Hz, muy agudo)
        const retumbo = ctx.createBufferSource(); retumbo.buffer = bufferRuido(true); retumbo.loop = true
        const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 140; const rg = ctx.createGain(); rg.gain.value = 0.3
        retumbo.connect(rf); rf.connect(rg); rg.connect(caos); retumbo.start()
        const estatica = ctx.createBufferSource(); estatica.buffer = bufferRuido(false); estatica.loop = true
        const ef = ctx.createBiquadFilter(); ef.type = 'bandpass'; ef.Q.value = 1.2; ef.frequency.value = 1500; const eg = ctx.createGain(); eg.gain.value = 0.025
        estatica.connect(ef); ef.connect(eg); eg.connect(caos); estatica.start()
        // el caos entra despacio (2 s) y todo pasa por un compresor: nunca hay un golpe de volumen
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -30; comp.ratio.value = 6; caos.disconnect(); caos.connect(comp); comp.connect(ctx.destination)
        caos.gain.setTargetAtTime(fxOn ? CAOS : 0, t, 0.7)
        radioNodos = { caos, ef, fuentes: [sirena, l1, alarma, l2, zumbido, retumbo, estatica] }
    },
    mezcla(c, v) {
        if (!radioNodos) return
        const t = ctx.currentTime
        radioNodos.caos.gain.setTargetAtTime(fxOn ? CAOS * (0.08 + 0.92 * (1 - c)) : 0, t, 0.2) // el caos nunca desaparece del todo: baja al fondo
        radioNodos.ef.frequency.setTargetAtTime(300 + v * 3200, t, 0.05)                // la estática cambia de tono al girar, como una radio
    },
    gota(c) { // una gota: un "plic" que baja de tono; más fuerte mientras más cerca (un poquito se oye siempre: es la pista)
        if (!ctx || !fxOn) return
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12)
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012 + 0.08 * c, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.32)
    },
    stop() {
        if (!radioNodos) return
        const n = radioNodos; radioNodos = null
        n.caos.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
        setTimeout(() => n.fuentes.forEach(f => { try { f.stop() } catch { /* ya se detuvo */ } }), 1500)
    }
}

export const audio = {
    ruido, radio, suspiro,
    playFile,
    init, blip,
    setMusic(v) { musicOn = v; mix(lastA, true) },
    setFx(v) { fxOn = v; if (!v) playing.forEach(p => p.stop()) },
    setPaused(v) { if (ctx) v ? ctx.suspend() : ctx.resume(); playing.forEach(p => v ? p.el.pause() : p.el.play().catch(() => {})) }, // pausa universal: detiene todo el audio,
    setIntensity(a) { lastA = a; if (!ctx) return; drone.frequency.value = 55 + a * 20; mix(a) },
    update(dt, anxiety) {
        beat -= dt // latido que se acelera con la ansiedad
        if (beat <= 0 && anxiety > 0.2) { blip(60, 0.18, 0.1 * anxiety + 0.03); beat = 1.1 - 0.7 * anxiety }
        bellT -= dt // campanitas de la música tranquila (solo con poca ansiedad y sin pista definitiva)
        if (bellT <= 0) { bellT = 2.2 + Math.random() * 2.6; if (ctx && musicOn && !CALM_MUSIC_FILE && anxiety < 0.45) bell() }
    },
    ring(dur = 4) { // pitido en los oídos después del golpe del sismo
        if (!ctx || !fxOn) return
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime
        o.type = 'sine'; o.frequency.value = 3100
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur)
    },
    breathCue(phase) { blip(300 + (phase % 4) * 40, 0.4, 0.06) },
    result(ok) { blip(ok ? 523 : 140, 0.5, 0.1, ok ? 'sine' : 'square') }
}