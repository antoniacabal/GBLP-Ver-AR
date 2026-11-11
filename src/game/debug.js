// Indice
    // 0. Imports
    // 1. Panel de debug
    // 2. Modo
    // 3. Mapas
    // 4. Minijuegos
    // 5. Ajustes de crisis
    // 6. Ansiedad, calle eterna y escenario
    // 7. Pruebas

// 0. Imports
import GUI from 'lil-gui'
import { CONFIG, runtime } from './config.js'
import { sm } from './stateMachine.js'
import { TECHS } from './breathing.js'
import { player } from './player.js'
import { EXPRESIONES } from './personaje.js'
import { SEGS } from './environment.js'
import { npcList } from './npcs.js'

// 1. Panel de debug
// Solo visible con ?debug en la URL (moderadores/desarrolladores).
export function initDebug(actions) {
    if (!new URLSearchParams(location.search).has('debug')) return
    window.juego = { runtime, CONFIG, player, npcs: npcList } // para revisar el estado desde la consola (solo con ?debug)
    const g = new GUI({ title: 'Debug' }), f = (n) => g.addFolder(n).close()
    const add = (folder, items) => Object.entries(items).forEach(([label, fn]) => folder.add({ [label]: fn }, label))

    // 2. Modo
    const modo = g.addFolder('Modo')
    const mode = { get narrativa() { return !runtime.sandbox }, set narrativa(v) { runtime.sandbox = !v } }
    modo.add(mode, 'narrativa').name('Narrativa automática').listen()
    add(modo, { 'Jugar la historia completa (sin debug)': () => { location.href = location.pathname } })

    // 3. Mapas
    const maps = g.addFolder('Mapas')
    const go = (id) => () => actions.jumpTo(id)
    add(maps, {
        '1 · Cuarto (antes del sismo)': go('HOUSE_PRE'),
        '2 · Cocina y sala (antes del sismo)': go('HOME_PRE'),
        '3 · Calle (antes del sismo)': go('STREET_PRE'),
        '4 · Interior del MIO (viaje normal)': go('MIO_PRE'),
        '5 · Terremoto (en el MIO)': go('TERREMOTO'),
        '6 · Una semana después': go('ANNOUNCEMENT'),
        '7 · Cuarto (después del sismo)': go('HOUSE_POST'),
        '8 · Cocina y sala (después del sismo)': go('HOME_POST'),
        '9 · Calle (después del sismo)': go('STREET_POST'),
        '10 · Interior del MIO (ansiedad)': go('MIO_POST'),
        '11 · Cerca de la universidad': go('UNIVERSIDAD'),
        'Final positivo': go('ENDING_GOOD'),
        'Final negativo': go('ENDING_BAD')
    })

    // 4. Minijuegos: jugar uno concreto ahora (en la calle) y ajustar sus valores
    const mini = g.addFolder('Minijuegos')
    add(mini, Object.fromEntries(TECHS.map(t => [`▶ ${t.name}`, () => actions.playGame(t.id)])))
    add(mini, { 'Ver los tutoriales otra vez': () => actions.resetTutorials() })
    mini.add(CONFIG.breathing, 'pass', .3, 1, .01).name('respiración: % de timing para pasar'); mini.add(CONFIG.breathing, 'grace', 0, 1.5, .1).name('respiración: margen al cambiar (s)'); mini.add(CONFIG.breathing, 'tol', .05, .5, .01).name('respiración: franja gris (visual)'); mini.add(CONFIG.breathing, 'rate', .1, 1, .01).name('respiración: vel. de la barra al sostener')
    mini.add(CONFIG.earth, 'need', 2, 20, 1).name('earthing: s sobre el pasto'); mini.add(CONFIG.earth, 'timeout', 10, 90, 1).name('earthing: tiempo límite (s)'); mini.add(CONFIG.earth, 'relief', 0, .3, .01).name('earthing: alivio por s')

    // 5. Ajustes de crisis: solo se notan con la narrativa automática activada
    const dif = f('Ajustes de crisis')
    dif.add(CONFIG, 'maxFailures', 1, 10, 1).name('fallos seguidos para perder')
    dif.add(CONFIG.crisis, 'first', 1, 40, 1).name('1.ª crisis (s)'); dif.add(CONFIG.crisis, 'min', 2, 40, 1).name('crisis mín (s)'); dif.add(CONFIG.crisis, 'max', 2, 60, 1).name('crisis máx (s)')
    dif.add(CONFIG.crisis, 'startAnxiety', .3, 1, .01).name('ansiedad al iniciar crisis'); dif.add(CONFIG.anxiety, 'failPenalty', 0, .5, .01).name('castigo por fallar')
    dif.add(CONFIG.street, 'crisisMin', 2, 40, 1).name('calle: crisis mín (s)'); dif.add(CONFIG.street, 'crisisMax', 2, 60, 1).name('calle: crisis máx (s)')
    dif.add(CONFIG.bus, 'crisisMin', 2, 30, 1).name('MIO: crisis mín (s)'); dif.add(CONFIG.bus, 'crisisMax', 2, 40, 1).name('MIO: crisis máx (s)')

    // 6. Ansiedad, calle eterna y escenario
    const an = g.addFolder('Ansiedad'); an.add(runtime, 'anxiety', 0, 1, .01).listen(); an.add(runtime, 'failStreak', 0, 3, 1).name('nivel de ansiedad (0 a 3)').onChange(v => { runtime.glitch = v }).listen(); an.add(runtime, 'glitch', 0, 4, 1).name('nivel de falla (1: fallas · 2: personas que no existen)').listen(); an.add(CONFIG.anxiety, 'shakeMax', 0, .5, .01).name('camera shake')
    an.add(CONFIG.anxiety, 'satMin', 0, 1, .01).name('saturation min'); an.add(CONFIG.anxiety, 'postQuakeSat', 0, 1, .01).name('post-quake saturation'); an.add(CONFIG.anxiety, 'blurMax', 0, 10, .1).name('blur'); an.add(CONFIG.anxiety, 'vignetteMax', 0, 1, .01).name('vignette'); an.add(CONFIG.anxiety, 'distort', 0, 2, .05).name('city distortion')
    const ce = f('Calle eterna'); ce.add(CONFIG.street, 'from', 0, 1, .01).name('empieza con ansiedad'); ce.add(CONFIG.street, 'full', 0, 1, .01).name('máxima con ansiedad'); ce.add(CONFIG.street, 'endless', 0, 60, 1).name('cuánto se alarga'); ce.add(CONFIG.street, 'slow', 0, .9, .01).name('cuánto frena el paso')
    const en = f('Escenario'); en.add(runtime, 'envProgress', 0, 1, .01).name('environment progress').listen(); en.add(CONFIG.env, 'light', 0, 3, .05).name('light intensity')
    // Cámara: alejarla para revisar el mapa completo (la cámara sigue a Gabriela; muévela con WASD para recorrer)
    const cam = g.addFolder('Cámara'); cam.add(CONFIG.camera, 'zoom', 0.05, 2.5, 0.01).name('zoom').listen() // menos = más lejos
    add(cam, { 'Vista general del mapa': () => { CONFIG.camera.zoom = 0.12 }, 'Zoom normal': () => { CONFIG.camera.zoom = 1 } })
    // la calle entera vista desde arriba (como un plano): la cámara mira hacia abajo, centrada en todo el recorrido y con el zoom justo para
    // que quepa. "Cámara normal" la devuelve a como estaba (también el ángulo)
    let antes = null
    add(cam, {
        'Calle desde arriba (plano)': () => {
            if (runtime.space !== 'STREET') actions.jumpTo('STREET_PRE')
            const c = CONFIG.camera; antes ||= { elevation: c.elevation, azimuth: c.azimuth, zoom: c.zoom }
            const xs = SEGS.flatMap(s => [s.x0, s.x1]), zs = SEGS.flatMap(s => [s.z0, s.z1])
            const x0 = Math.min(...xs) - 14, x1 = Math.max(...xs) + 14, z0 = Math.min(...zs) - 14, z1 = Math.max(...zs) + 14
            const a = innerWidth / innerHeight, v = c.view * Math.max(1, 1.4 / a)
            const libre = 1 - g.domElement.offsetWidth / innerWidth // la parte de la pantalla que no tapa este panel (a la derecha)
            c.elevation = 89.5; c.azimuth = 0; c.zoom = Math.min(v * a * libre / (x1 - x0), v / (z1 - z0))
            const ancho = v * a / c.zoom // ancho visible (en metros): el plano se centra en la parte libre, a la izquierda del panel
            runtime.vistaMapa = { x: (x0 + x1) / 2 + ancho * (1 - libre) / 2, z: (z0 + z1) / 2 }
        },
        'Cámara normal': () => { runtime.vistaMapa = null; if (antes) Object.assign(CONFIG.camera, antes); antes = null }
    })
    cam.add(CONFIG.player, 'speed', 1, 30, 0.5).name('velocidad') // (nombre corto: con el largo, la barra quedaba casi sin espacio)

    // Protagonista: sus animaciones en un espacio aparte (visor.js), sin el resto del juego, con cámara libre y los huesos a la vista
    const prota = g.addFolder('Protagonista')
    add(prota, { 'Abrir visor de animaciones (con huesos)': () => import('./visor.js').then(m => m.abrirVisor()) })
    // Expresiones: deja la cara fija en una (sin parpadear) para revisarla; "Automática" vuelve a la del juego
    const cara = { expresion: 'Automática' }
    prota.add(cara, 'expresion', ['Automática', ...Object.keys(EXPRESIONES)]).name('expresión').onChange(v => player.prota.fijarCara(v === 'Automática' ? null : v))

    // 7. Pruebas
    add(g.addFolder('Pruebas'), {
        'Reiniciar': () => location.reload(),
        'Forzar crisis': () => actions.forceCrisis(),
        'Forzar fallo': () => sm.go('FAILURE')
    })
}