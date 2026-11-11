// Indice
    // 0. Imports y utilidades
    // 1. Elementos del juego (el HTML vive en narrativa.html)
    // 2. Medidor de respiración
    // 3. Música y salida rápida
    // 4. Pop-ups
    // 5. Texto que se escribe letra por letra
    // 6. Diálogos con personajes (mamá)
    // 7. API pública (ui)

// 0. Imports y utilidades
import { CONFIG, runtime } from './config.js'
import { audio } from './audio.js'
import { haptics } from './haptics.js'
import gsap from 'gsap'
const CHL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 L5 12 L12 19 M20 5 L13 12 L20 19"/></svg>'
const CHR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 L19 12 L12 19 M4 5 L11 12 L4 19"/></svg>'
const btn = (label, dir) => `<button type="button" class="gx-act">${dir === 'left' ? CHL : ''}<span>${label}</span>${dir === 'right' ? CHR : ''}</button>` // solo para los botones que cambian (pop-up de opciones)

// 1. Elementos del juego: toda la estructura (pop-ups, tarjetas, medidor) está escrita en narrativa.html
const root = document.querySelector('.gx')
if (!root) throw new Error('Falta la estructura .gx del juego en narrativa.html')
const $ = (s) => root.querySelector(s)
const timerEl = $('.gx-timer'), whisperEl = $('.gx-whisper'), msg = $('.gx-msg'), needle = $('.gx-needle'), fadeEl = $('.gx-fade'), card = $('.gx-card'), label = $('.gx-label'), hint = $('.gx-breath-hint'), fillPath = $('.gx-fill'), zonePath = $('.gx-zone')
const isTouch = () => document.body.classList.contains('gx-touch-on')
// 2. Medidor de respiración: un círculo que respira. El de adentro es TU respiración (crece mientras mantienes); el aro claro marca el ritmo
//    a seguir y la franja gris clara alrededor del aro es la zona correcta
const breathEl = $('.gx-breath'), barFill = $('.gx-bar-fill'), orbEdge = $('.gx-orb-borde'), countEl = $('.gx-orb-count')
const RAD = (f) => 38 + 102 * Math.min(1, Math.max(0, f)) // radio del círculo para un nivel de 0 a 1
let lastFill = -1, lastPrompt = '', lastHint = null

// 3. Música, pantalla completa, vibración y salida rápida: los botones de arriba siguen activos sobre los pop-ups y en los finales
let musicOn = true
const musicBtn = $('[data-a="music"]'), vibraBtn = $('[data-a="vibra"]'), fullBtn = $('.gx-full')
musicBtn.addEventListener('click', () => {
    musicOn = !musicOn; musicBtn.textContent = `Música: ${musicOn ? 'ON' : 'OFF'}`
    audio.setMusic(musicOn); audio.setFx(musicOn) // silenciar también apaga los efectos
})
// Vibración: solo en celulares que la permiten (touch.js marca el body con gx-touch-on; en iPhone no existe y el botón no sale)
document.body.classList.toggle('gx-vibra-ok', haptics.supported)
vibraBtn.addEventListener('click', () => { haptics.set(!haptics.on); vibraBtn.textContent = `Vibración: ${haptics.on ? 'ON' : 'OFF'}`; if (haptics.on) haptics.buzz(60) })
// Pantalla completa (también funciona F11, pero esa la maneja el navegador)
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement
const fsOk = document.fullscreenEnabled || document.webkitFullscreenEnabled
fullBtn.hidden = !fsOk; document.body.classList.toggle('gx-full-ok', !!fsOk) // iPhone no permite pantalla completa en páginas
fullBtn.addEventListener('click', () => {
    const d = document, el = d.documentElement
    try {
        const r = fsEl() ? (d.exitFullscreen || d.webkitExitFullscreen).call(d) : (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' })
        r?.catch?.(() => {})
    } catch { /* el navegador no la dejó */ }
})
const syncFull = () => { const on = !!fsEl(); fullBtn.classList.toggle('gx-full--on', on); fullBtn.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa'); fullBtn.title = fullBtn.getAttribute('aria-label') }
document.addEventListener('fullscreenchange', syncFull); document.addEventListener('webkitfullscreenchange', syncFull); syncFull()
const goHome = () => { audio.setMusic(false); audio.setFx(false); haptics.stop(); document.documentElement.classList.remove('sin-scroll'); location.href = CONFIG.exitUrl }
let pauseOn = false, holdOn = false // pauseOn: salida rápida · holdOn: pop-up de controles o de "cómo se juega" abierto
const syncPause = () => { runtime.paused = pauseOn || holdOn; runtime.paused ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume() }
const setPaused = (v) => { pauseOn = v; $('.gx-pause').hidden = !v; audio.setPaused(v); if (v) haptics.stop(); syncPause() }
const inGame = () => runtime.state === 'BREATHING' // durante los minijuegos no se puede abrir la salida rápida (ni con Esc)
$('.gx-exit').addEventListener('click', () => { if (!inGame()) setPaused(true) })
$('.gx-pause [data-act="go"]').addEventListener('click', () => setPaused(false))
$('.gx-pause [data-act="stop"]').addEventListener('click', goHome)
$('.gx-pause [data-act="controls"]').addEventListener('click', () => { // los controles se abren encima de la pausa; al cerrarlos se vuelve a la pausa
    const pausa = $('.gx-pause'), ctrl = $('.gx-controls'), etiqueta = ctrl.querySelector('[data-act="start"] span'), antes = etiqueta.textContent
    pausa.hidden = true; etiqueta.textContent = 'Volver'
    openHold(ctrl, () => { etiqueta.textContent = antes; pausa.hidden = false; pausa.querySelector('[data-act="go"]').focus({ preventScroll: true }) })
})
let retryFn = null // final malo: vuelve a la semana después del sismo · final bueno: reinicia todo
$('.gx-ending [data-act="restart"]').addEventListener('click', () => retryFn ? retryFn() : location.reload())
$('.gx-ending [data-act="home"]').addEventListener('click', goHome)

// 4. Pop-ups: como en la advertencia del index, ninguno se cierra por fuera de sus botones; clic afuera sacude la caja. Esc abre la salida rápida.
const shake = (d) => { d.classList.remove('sacudir'); void d.offsetWidth; d.classList.add('sacudir') }
root.querySelectorAll('.gx-dialog').forEach(d => d.addEventListener('animationend', () => d.classList.remove('sacudir')))
root.querySelectorAll('.gx-modal').forEach(m => m.addEventListener('pointerdown', (e) => { if (e.target === m) shake(m.querySelector('.gx-dialog')) }))
const dlg = $('.gx-pause .gx-dialog')
addEventListener('keydown', (e) => { if (e.code === 'Escape' && !inGame()) pauseOn ? shake(dlg) : setPaused(true) })
const openHold = (m, onClose) => { // abre un pop-up que congela el juego hasta pulsar su botón "Empezar"
    const b = m.querySelector('[data-act="start"]')
    m.hidden = false; holdOn = true; syncPause()
    b.addEventListener('click', () => { m.hidden = true; holdOn = false; syncPause(); onClose?.() }, { once: true })
    b.focus({ preventScroll: true })
}

// 5. Texto que se escribe letra por letra (la caja mantiene su tamaño: lo que falta se reserva invisible)
const typer = (p) => {
    let tw = null, full = ''
    return {
        write(text, type, done) { // done: se llama cuando el texto terminó de escribirse solo
            tw?.kill(); tw = null; full = text
            if (!type || !text) { p.textContent = text; return }
            p.innerHTML = '<span></span><span style="visibility:hidden"></span>'
            const shown = p.firstChild, rest = p.lastChild, n = { c: 0 }
            rest.textContent = text
            tw = gsap.to(n, { c: text.length, duration: text.length / 45, ease: 'none',
                onUpdate: () => { const i = Math.floor(n.c); shown.textContent = text.slice(0, i); rest.textContent = text.slice(i) },
                onComplete: () => { tw = null; p.textContent = text; done?.() } })
        },
        finish() { if (!tw) return false; tw.kill(); tw = null; p.textContent = full; return true }, // true si todavía se estaba escribiendo
        stop() { tw?.kill(); tw = null }
    }
}
// Tarjetas de narrativa: aparecen y se van con un fundido. Primero entra el título, después el texto (letra por letra si type)
// y el botón "Continuar" aparece un rato después, también con fundido. Un clic o toque lo adelanta todo de una vez
const cardH = card.querySelector('h2'), cardP = card.querySelector('p'), cardActions = card.querySelector('.gx-card-actions'), cardNext = cardActions.querySelector('button'), cardT = typer(cardP)
let onCardNext = null, cardTl = null, cardReady = false, cardFilled = false, cardText = '' // cardReady: el botón "Continuar" ya está a la vista
const showCardNext = (wait) => {
    if (!onCardNext || cardReady) return
    cardTl?.kill(); cardTl = gsap.timeline({ delay: wait }).call(() => { cardReady = true; cardActions.style.visibility = ''; cardNext.focus({ preventScroll: true }) }).fromTo(cardActions, { opacity: 0 }, { opacity: 1, duration: wait ? 0.8 : 0.3 })
}
let skipping = false, skipIdle = 0 // skipping: se apretó Saltar en una escena; las tarjetas y frases que siguen pasan solas hasta que vuelve el juego
const skipCard = () => { // completa el título y el texto y muestra el botón ya
    if (card.hidden || !onCardNext || !cardFilled) return
    if (cardReady) return onCardNext()
    cardTl?.kill(); gsap.killTweensOf([cardH, cardP]); gsap.set([card, cardH, cardP], { opacity: 1 }); cardT.stop(); cardP.textContent = cardText; showCardNext(0)
}
cardNext.addEventListener('click', (e) => { e.stopPropagation(); skipCard() })
card.addEventListener('click', skipCard)

// 6. Diálogos con personajes: clic, toque o "Continuar" avanzan (si el texto se está escribiendo, primero lo completan)
const talkEl = $('.gx-talk'), talkName = $('.gx-talk-name'), talkNext = $('.gx-talk [data-act="talk-next"]'), talkT = typer($('.gx-talk-text'))
let lines = [], li = 0, onLine = null, onEnd = null, talker = '', talkSince = 0 // talkSince: cuándo se abrió (el mismo clic que abre el diálogo no lo adelanta)
const showLine = () => { // cada frase puede ser un texto o [quién habla, texto]
    const [who, text] = Array.isArray(lines[li]) ? lines[li] : [talker, lines[li]]
    talkName.textContent = who; talkT.write(text, true); talkNext.querySelector('span').textContent = li < lines.length - 1 ? 'Continuar' : 'Cerrar'; onLine?.(li) }
const closeTalk = () => { talkT.stop(); talkEl.hidden = true; lines = []; onLine = onEnd = null }
const advance = () => {
    if (talkEl.hidden || runtime.paused) return
    if (talkT.finish()) return
    if (++li < lines.length) return showLine()
    const done = onEnd; closeTalk(); done?.()
}
talkNext.addEventListener('click', advance)
// saltar todo el diálogo (doble clic en Continuar o el botón Saltar): pasa por las frases que faltan (por si alguna dispara algo) y lo cierra
const skipTalk = () => {
    if (talkEl.hidden) return
    talkT.stop(); while (++li < lines.length) onLine?.(li)
    const done = onEnd; closeTalk(); done?.()
}
talkNext.addEventListener('dblclick', skipTalk)
// Clic (o toque) en cualquier parte mientras alguien habla: acelera el texto y, si ya terminó, pasa a la siguiente frase
addEventListener('pointerdown', (e) => { if (!talkEl.hidden && e.button === 0 && e.timeStamp > talkSince && !e.target.closest('button, .gx-modal, .gx-touch')) advance() })
addEventListener('keydown', (e) => { // se registra antes que la interacción del juego: la tecla que avanza el diálogo no interactúa con nada más
    if (talkEl.hidden || e.repeat || e.code !== 'KeyE' || e.isTrusted) return // solo la E del botón táctil (el teclado: clic para avanzar)
    e.preventDefault(); e.stopImmediatePropagation(); advance()
})

// 7. API pública (ui)
// Botón "?" del minijuego: vuelve a abrir la explicación (main.js dice cuál) · anuncio grande de la técnica que empieza
let helpFn = null
const linea = $('.gx-linea'); let lineaKey = '' // línea de tiempo de la mañana
$('.gx-ayuda').addEventListener('click', () => helpFn?.())
const anuncio = $('.gx-anuncio'), anuncioT = anuncio.querySelector('strong')
const progEl = $('.gx-progreso'), progFill = $('.gx-progreso-fill'), progPct = $('.gx-progreso-pct'); let lastPct = -1
let skipTo = null // escena larga con su propio salto (el sismo): Saltar la corta de una vez y va a donde diga main.js
let whisperTl = null, sceneSince = 0 // whisperTl: las frases sobre negro en curso · sceneSince: desde cuándo hay un diálogo o una escena (para el botón Saltar)
let sayTimer = null, touchHidden = null, whispering = false, topHidden = null
const modals = [...root.querySelectorAll('.gx-modal')]
const saltar = $('.gx-saltar')
saltar.addEventListener('click', (e) => {
    e.stopPropagation()
    if (skipTo) { const f = skipTo; skipTo = null; saltar.hidden = true; sceneSince = 0; return f() } // el sismo: salta toda la escena
    skipping = true; skipIdle = performance.now(); saltar.hidden = true; sceneSince = 0
    if (!talkEl.hidden) skipTalk()
    if (!card.hidden && onCardNext) onCardNext() // la tarjeta pasa ya (las siguientes pasan solas: ver fill en card)
    if (whispering) whisperTl?.progress(1)
})
const avisoEl = $('.gx-aviso'); let avisoTimer = null
export const ui = {
    vignette: $('.gx-vignette'),
    say(t) { // los mensajes se van solos después de unos segundos (los de la respiración los pone updateBreath)
        msg.textContent = t; sayTimer?.kill()
        sayTimer = t ? gsap.delayedCall(Math.min(7, 2.8 + t.length * 0.05), () => { if (msg.textContent === t) msg.textContent = '' }) : null
    },
    aviso(t) { // aviso enano (como un diálogo chiquito): se va solo a los pocos segundos
        avisoEl.textContent = t; avisoEl.hidden = false; avisoTimer?.kill()
        avisoTimer = gsap.delayedCall(Math.min(5, 2.4 + t.length * 0.04), () => { avisoEl.hidden = true })
    },
    updateOverlay() { // los controles táctiles no se ven encima de las tarjetas, los pop-ups ni la pantalla en negro; los botones de arriba, no en las tarjetas
        const hide = !card.hidden || modals.some(m => !m.hidden) || gsap.getProperty(fadeEl, 'opacity') > 0.35
        if (hide !== touchHidden) { touchHidden = hide; document.body.classList.toggle('gx-touch-oculto', hide); if (hide) { runtime.joyX = runtime.joyY = 0 } }
        const top = this.blackout && !pauseOn
        if (top !== topHidden) { topHidden = top; document.body.classList.toggle('gx-tarjeta', top) }
        document.body.classList.toggle('gx-minijuego', inGame())
        // minijuegos con su propio panel (sonido, gravedad, conteo): en el celular no usan el joystick ni Interactuar (game.css los esconde y acomoda el resto)
        document.body.classList.toggle('gx-mini-panel', inGame() && ['foco', 'gravedad', 'conteo'].includes(runtime.techId))
        // Saltar: aparece cuando un diálogo, una tarjeta con "Continuar" o las frases sobre negro llevan un rato (2 s) en pantalla
        const scene = !talkEl.hidden || (!card.hidden && !!onCardNext) || whispering || !!skipTo, now = performance.now()
        if (!scene) sceneSince = 0; else if (!sceneSince) sceneSince = now
        const showSkip = scene && !pauseOn && now - sceneSince > 2000
        if (saltar.hidden === showSkip) saltar.hidden = !showSkip
        if (skipping) { if (scene) skipIdle = now; else if (now - skipIdle > 600) skipping = false } // la escena terminó: el juego vuelve a la normalidad
        document.body.classList.toggle('gx-negro', gsap.getProperty(fadeEl, 'opacity') > 0.5) // pantalla en negro: la línea de tiempo no se queda flotando (se veía gris y rota antes de la tarjeta del sismo)
    },
    showBreath(v) { $('.gx-breath').hidden = !v },
    // Terremoto (en el MIO, antes de "Todo se movió"): la línea de tiempo tiembla y se apaga (1: solo "Ir a la Universidad", 2: toda la barra)
    // y al final se rompe en pedazos que caen. lineaRestaurar la deja como antes
    lineaSismo(n) { linea.classList.toggle('gx-linea--sismo1', n >= 1); linea.classList.toggle('gx-linea--sismo2', n >= 2) },
    // "Ir a la Universidad" se suelta de la barra, cae hasta abajo de la pantalla y ahí se rompe en pedazos (el resto de la barra se queda temblando)
    lineaRompe() {
        const li = linea.querySelector('.gx-linea--ahora') || linea.lastElementChild; if (!li || li.classList.contains('gx-linea-cae')) return
        const r = li.getBoundingClientRect(); if (!r.width) return
        const rnd = (a, b) => a + Math.random() * (b - a), caja = document.createElement('div'); caja.className = 'gx-linea-pedazos'; root.append(caja)
        // la ficha que cae: una copia del paso, con su fondo de barra (para que se lea sola)
        const ficha = document.createElement('div'); ficha.className = 'gx-linea-ficha'
        Object.assign(ficha.style, { left: (r.left - 8) + 'px', top: (r.top - 4) + 'px', width: (r.width + 16) + 'px', height: (r.height + 8) + 'px' })
        ficha.append(li.cloneNode(true)); caja.append(ficha); li.classList.add('gx-linea-cae')
        const piso = innerHeight - r.height - 14, giro = rnd(-30, 30)
        gsap.timeline({ onComplete: () => romper(ficha) })
            .to(ficha, { rotation: rnd(-10, 10), y: 6, duration: 0.25, ease: 'power1.out' })        // se despega
            .to(ficha, { y: piso - r.top, rotation: giro, duration: 0.95, ease: 'power2.in' })      // cae
        // al llegar abajo se parte: pedazos (triángulos de la ficha) que saltan hacia los lados y se desvanecen
        function romper(el) {
            const fr = el.getBoundingClientRect(), w = r.width + 16, h = r.height + 8, cols = 6, filas = 2, cw = w / cols, ch = h / filas
            const P = Array.from({ length: filas + 1 }, (_, i) => Array.from({ length: cols + 1 }, (_, j) => [
                j * cw + (j > 0 && j < cols ? rnd(-0.3, 0.3) * cw : 0), i * ch + (i > 0 && i < filas ? rnd(-0.3, 0.3) * ch : 0)]))
            const tri = []
            for (let i = 0; i < filas; i++) for (let j = 0; j < cols; j++) {
                const a = P[i][j], b = P[i][j + 1], c = P[i + 1][j + 1], d = P[i + 1][j]
                Math.random() < 0.5 ? tri.push([a, b, c], [a, c, d]) : tri.push([a, b, d], [b, c, d])
            }
            const x0 = fr.left + fr.width / 2 - w / 2, y0 = fr.top + fr.height / 2 - h / 2
            tri.forEach(t => {
                const p = el.cloneNode(true); p.className = 'gx-linea-ficha gx-linea-pedazo'
                Object.assign(p.style, { left: x0 + 'px', top: y0 + 'px', transform: `rotate(${giro}deg)`, clipPath: `polygon(${t.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` })
                const cx = t.reduce((s2, q) => s2 + q[0], 0) / 3, cy = t.reduce((s2, q) => s2 + q[1], 0) / 3
                p.style.transformOrigin = `${cx.toFixed(0)}px ${cy.toFixed(0)}px`
                caja.append(p)
                const lado = (cx - w / 2) / w
                gsap.timeline()
                    .to(p, { x: lado * rnd(60, 180) + rnd(-20, 20), y: rnd(-70, -20), rotation: giro + rnd(-140, 140), duration: rnd(0.35, 0.5), ease: 'power2.out' }) // salta al romperse
                    .to(p, { y: `+=${rnd(40, 90)}`, opacity: 0, duration: rnd(0.4, 0.7), ease: 'power2.in' })
            })
            el.remove()
            li.classList.add('gx-linea-fuera') // el pedazo roto ya no ocupa su lugar en la barra
            gsap.delayedCall(1.6, () => caja.remove())
        }
    },
    lineaRestaurar() { linea.classList.remove('gx-linea--sismo1', 'gx-linea--sismo2', 'gx-linea--rota'); linea.querySelectorAll('.gx-linea-cae').forEach(li => li.classList.remove('gx-linea-cae', 'gx-linea-fuera')); root.querySelectorAll('.gx-linea-pedazos').forEach(c => c.remove()) },
    progress(p) { // barra de abajo (después del sismo): p de 0 a 1, o null para esconderla
        progEl.hidden = p === null; if (p === null) return
        const pct = Math.round(p * 100); if (pct === lastPct) return; lastPct = pct
        progFill.style.width = pct + '%'; progPct.textContent = pct + ' %'; progEl.setAttribute('aria-valuenow', pct)
        progPct.style.left = Math.min(97, Math.max(3, pct)) + '%' // el % va encima de la punta de la barra (sin salirse de la pantalla)
    },
    onHelp(fn) { helpFn = fn },
    timeline(steps, idx) { // pasos de la mañana: los anteriores quedan hechos, el actual resaltado (solo se redibuja si cambia)
        const k = steps.join('|') + idx; if (k === lineaKey) return; lineaKey = k
        linea.innerHTML = steps.map((s, i) => `<li class="${i < idx ? 'gx-linea--hecho' : i === idx ? 'gx-linea--ahora' : ''}"${i === idx ? ' aria-current="step"' : ''}><span>${s}</span></li>`).join('')
    },
    announce(name, cb) { // aparece grande en el centro, se queda un momento y se va; después sigue cb
        anuncioT.textContent = name; anuncio.hidden = false; gsap.killTweensOf(anuncio)
        gsap.timeline({ onComplete: () => { anuncio.hidden = true; cb?.() } })
            .fromTo(anuncio, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)' })
            .to(anuncio, { opacity: 0, scale: 1.06, duration: 0.4, ease: 'power1.in' }, '+=1.5')
    },
    updateBreath() {
        const step = runtime.target < 0, f = step ? runtime.stepFill : runtime.level // Earthing: el arco muestra el tiempo sobre el pasto
        document.body.classList.toggle('gx-respirando', !breathEl.hidden && !step) // aviso del brillo bajo la frase de arriba (solo en las respiraciones)
        if (breathEl.dataset.fase !== (runtime.fase || '')) breathEl.dataset.fase = runtime.fase || '' // colores del círculo: inhalar, sostener, exhalar, pausa
        breathEl.classList.toggle('gx-breath--barra', step) // Earthing: una barra que se llena con el tiempo sobre el pasto (no el círculo)
        orbEdge.classList.toggle('gx-orb-borde--aviso', !!runtime.cue) // el círculo grande de afuera brilla amarillo antes de repetir
        const cnt = runtime.count ? String(runtime.count) : ''; if (countEl.textContent !== cnt) countEl.textContent = cnt // cuenta 3, 2, 1 en el centro
        if (!step) {
            const r = RAD(runtime.target).toFixed(1), w = (2 * CONFIG.breathing.tol * 102).toFixed(1)
            needle.setAttribute('r', r); zonePath.setAttribute('r', r); zonePath.setAttribute('stroke-width', w)
        }
        const k = Math.round(f * 300)
        if (k !== lastFill) { lastFill = k; fillPath.setAttribute('r', RAD(f).toFixed(1)); barFill.style.width = (Math.min(1, f) * 100).toFixed(1) + '%' }
        const s = Math.ceil(runtime.timeLeft || 0), tt = `⏱ ${s} s` // reloj del minijuego: se pone rojo y late en los últimos 5 s
        if (timerEl.textContent !== tt) { timerEl.textContent = tt; timerEl.classList.toggle('gx-timer--poco', s <= 5) }
        const p = runtime.prompt || '', long = p.length > 16 // el rótulo dice qué hacer (Inhalar / Sostener / Exhalar); la frase completa va en el mensaje de arriba
        label.textContent = runtime.label || (long || !p ? 'Respirar' : p)
        if ((long || runtime.label) && p && p !== lastPrompt) msg.textContent = p
        lastPrompt = p
        // qué hacer con el clic en este momento: mantener (inhalar / retener) o soltar (exhalar / pausa)
        const h = step || !runtime.action ? '' : runtime.action === 'hold'
            ? (isTouch() ? 'Mantén presionado Interactuar' : 'Mantén el clic o la barra espaciadora')
            : (isTouch() ? 'Suelta el botón Interactuar' : 'Suelta el clic')
        if (h !== lastHint) { lastHint = h; hint.textContent = h; hint.dataset.action = runtime.action }
    },
    fade(o, d = 1, cb) { gsap.to(fadeEl, { opacity: o, duration: d, onComplete: cb }) },
    cargando(v) { gsap.killTweensOf(whisperEl); whisperEl.textContent = v ? 'Cargando…' : ''; gsap.set(whisperEl, { opacity: v ? 0.55 : 0 }) }, // mientras cargan los modelos, sobre la pantalla negra
    flash(cb) { // destello blanco que se apaga a negro (el golpe del sismo)
        gsap.killTweensOf(fadeEl); gsap.set(fadeEl, { opacity: 1, backgroundColor: '#e4ffff' })
        gsap.to(fadeEl, { backgroundColor: '#000000', duration: 1.4, ease: 'power2.in', onComplete: cb })
    },
    whisper(lines, cb) { // frases sueltas sobre la pantalla negra, una tras otra
        if (skipping) return void cb?.() // saltando la escena: las frases no se muestran
        whispering = true; document.body.classList.add("gx-susurro") // los botones de arriba siguen a la vista (solo se esconde la línea de tiempo)
        const tl = whisperTl = gsap.timeline({ onComplete: () => { whisperEl.textContent = ''; whispering = false; document.body.classList.remove("gx-susurro"); cb?.() } })
        lines.forEach(l => tl.call(() => { whisperEl.textContent = l }).to(whisperEl, { opacity: 1, duration: 1.1 }).to(whisperEl, { opacity: 0, duration: 1.1 }, '+=1.4'))
    },
    // opts: { type: true → el texto se escribe letra por letra · onContinue → muestra el botón "Continuar" }
    card(title, text = '', opts = {}) {
        cardT.stop(); cardTl?.kill(); gsap.killTweensOf([card, cardH, cardP, cardActions]); onCardNext = null; cardReady = false; cardFilled = false
        if (!title) { if (!card.hidden) gsap.to(card, { opacity: 0, duration: 0.7, onComplete: () => { card.hidden = true } }); return } // se va con un fundido
        const wasHidden = card.hidden
        const fill = () => { // el texto completo se pone invisible desde el principio: así la tarjeta ya tiene su alto y el título no se mueve cuando el texto aparece
            cardH.textContent = title; cardText = text; cardP.innerHTML = ''; const ghost = document.createElement('span'); ghost.style.visibility = 'hidden'; ghost.textContent = text; cardP.append(ghost)
            gsap.set([cardH, cardP], { opacity: 0 }); onCardNext = opts.onContinue || null; cardFilled = true
            if (skipping && onCardNext) gsap.delayedCall(0.05, () => { if (onCardNext === opts.onContinue) onCardNext() }) // saltando: la tarjeta pasa sola
            cardActions.hidden = !onCardNext; cardActions.style.visibility = 'hidden' // el botón ocupa su lugar desde el principio, pero aparece después
        }
        card.hidden = false
        cardTl = gsap.timeline()
        if (wasHidden) { fill(); cardTl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.8 }) }
        else cardTl.to(card, { opacity: 1, duration: 0.2 }).to([cardH, cardP, cardActions], { opacity: 0, duration: 0.5 }, 0).call(fill) // de una tarjeta a otra: lo de antes se desvanece primero
        cardTl.to(cardH, { opacity: 1, duration: 0.9, ease: 'power1.out' }, '+=0.1')
            .call(() => {
                gsap.set(cardP, { opacity: 1 })
                if (opts.type) cardT.write(text, true, () => showCardNext(1.2))
                else { cardT.write(text); gsap.fromTo(cardP, { opacity: 0 }, { opacity: 1, duration: 0.8 }); showCardNext(1.6) }
            })
    },
    cancelSkip() { skipping = false },
    setSkip(fn) { skipTo = fn; sceneSince = 0 }, // una escena larga (el sismo) se puede saltar entera: fn decide a dónde va
    // corta la escena que esté en pantalla (tarjeta y frases sobre negro) sin fundidos: lo usa el salto del sismo
    cortarEscena() {
        cardT.stop(); cardTl?.kill(); gsap.killTweensOf([card, cardH, cardP, cardActions]); onCardNext = null; cardReady = false; card.hidden = true
        whisperTl?.kill(); whisperTl = null; whisperEl.textContent = ''; gsap.set(whisperEl, { opacity: 0 }); whispering = false; document.body.classList.remove('gx-susurro')
        skipping = false
    }, // empieza algo que no es escena (por ejemplo comer): lo que viene después no se salta solo
    get blackout() { return !card.hidden }, // tarjeta de narrativa: los botones de arriba se esconden (en las frases sobre negro, como "Todo se movió", siguen)
    hud(v) { document.body.classList.toggle("gx-sin-hud", !v) }, // al principio: los botones de arriba y la línea de tiempo salen solo después del pop-up de controles
    controls(onClose) { openHold($('.gx-controls'), onClose) }, // pop-up de controles del inicio
    tutorial(info, onClose) { // pop-up "Cómo se juega". info: { sub, steps: [{ img, txt }] (tres dibujos con su frase), page → enlace a la página que explica la técnica }
        const m = $('.gx-tutorial'), list = m.querySelector('.gx-list'), more = m.querySelector('.gx-more')
        m.querySelector('.gx-sub').textContent = info.sub
        more.hidden = !info.page; if (info.page) more.href = info.page
        list.classList.add('gx-pasos')
        list.innerHTML = info.steps.map((s, i) => `<li><span class="gx-paso-img">${s.img}</span><span class="gx-paso-txt"><b>${i + 1}</b> ${s.txt}</span></li>`).join('')
        openHold(m, onClose)
    },
    // diálogo con un personaje. opts: { onLine(i) → al mostrar cada frase · onEnd → al cerrar }
    talk(name, ls, opts = {}) { talker = name; lines = ls; li = 0; onLine = opts.onLine || null; onEnd = opts.onEnd || null; talkEl.hidden = false; talkSince = performance.now(); showLine(); talkNext.focus({ preventScroll: true }) },
    closeTalk,
    choice(title, text, opts, warning = '') { // pop-up con opciones: [{ label, dir, fn }] · warning: aviso destacado (opcional)
        const m = $('.gx-choice'), box = m.querySelector('.gx-actions'), w = m.querySelector('.gx-aviso-mio')
        m.querySelector('h2').textContent = title; m.querySelector('p').textContent = text; w.textContent = warning; w.hidden = !warning
        box.innerHTML = opts.map(o => btn(o.label, o.dir)).join('')
        box.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', opts[i].fn)); m.hidden = false
    },
    hideChoice() { $('.gx-choice').hidden = true },
    hideEnding() { $('.gx-ending').hidden = true },
    ending(title, text, retry = null) {
        retryFn = retry; $('.gx-ending [data-act="restart"] span').textContent = retry ? 'Intentarlo otra vez' : 'Volver a jugar'
        $('.gx-ending h2').textContent = title; $('.gx-ending p').textContent = text; $('.gx-ending').hidden = false
    }
}