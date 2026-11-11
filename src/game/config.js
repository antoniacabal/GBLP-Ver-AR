// Parámetros centralizados (lil-gui los modifica en tiempo real)
const DEBUG = new URLSearchParams(location.search).has('debug') // ?debug: modo de pruebas (sin narrativa automática)
export const CONFIG = {
    maxFailures: 3, // minijuegos perdidos SEGUIDOS para el final negativo (ganar uno reinicia la cuenta)
    breathing: { rate: 0.25, tol: 0.18, pass: 0.8, grace: 0.3, lead: 3 }, // rate: velocidad de la barra en las retenciones · tol: ancho de la franja gris (solo visual) · pass: % del tiempo con el timing correcto para pasar · grace: margen al empezar cada fase (s) · lead: cuenta regresiva (3, 2, 1) antes de que arranque el aro
    crisis: { first: 9, min: 10, max: 18, startAnxiety: 0.6, baseline: 0.12, drift: 0.009, driftMax: 0.3 }, // segundos / ansiedad
    anxiety: { failPenalty: 0.12, shakeMax: 0.12, blurMax: 3, satMin: 0.5, postQuakeSat: 0.85, vignetteMax: 0.85, distort: 1 }, // distort: cuánto se deforma la ciudad con la ansiedad (0 = nada)
    camera: { azimuth: 45, elevation: 35.264, distance: 24, zoom: 1, view: 12, x: -4, y: 1, z: 0, follow: 3, lead: 3 }, // follow: suavidad · lead: cuánto mira por delante del personaje en la calle
    env: { light: 1, successGain: 0.15 },
    gravedad: { timeout: 22 }, foco: { timeout: 22 }, // (antes 30 y 35: se hacían largos) reconstruir la gravedad y foco entre el ruido: segundos para lograrlo
    conteo: { timeout: 15 }, // (antes 25: muy largo) conteo de grounding: segundos para los 5 aciertos (equivocarse no quita tiempo)
    earth: { need: 7, timeout: 15, drain: 1.2, relief: 0.1 }, npcs: { street: 50, bus: 3 }, // earthing: s sobre el pasto · tiempo límite real · cuánto se pierde por s fuera del pasto · NPCs
    player: { speed: 3.5, anxSpeed: 0.6, startX: -1.6, startZ: 0, reach: 1.8, screenRelative: false }, // screenRelative false: el teclado sigue las calles del mapa (W = arriba-derecha, D = abajo-derecha, S = abajo-izquierda, A = arriba-izquierda)
    bus: { calmRide: 7, time: 120, goal: [6, 7], traumaMin: 4, traumaMax: 6, crisisMin: 3, crisisMax: 5, closed: 1.5, stayAnxiety: 0.25, startAnxiety: 0.4, baseline: 0.25, drift: 0.014, driftMax: 0.7 }, // viaje en el MIO: mucha más ansiedad · trauma = a los cuántos s llega el frenón · time = segundos de viaje para llegar a la universidad (después del sismo) · closed = crisis más seguidas por ser un espacio cerrado donde viviste el sismo · stayAnxiety = lo que sube la ansiedad si no te bajas en un Earthing
    street: { endless: 28, from: 0.45, full: 0.85, slow: 0.2, scareChance: 0.25, scareGap: 60, crisisMin: 26, crisisMax: 40, multMax: 1.5 }, // crisisMin/Max: segundos entre crisis en la calle (menos seguidas que en la casa y el MIO; antes 16 a 26 y multMax 1.8: salían muy seguido) · multMax: cuánto pueden acelerarlas la gente y la ansiedad · calle eterna: cuánto se aleja la universidad, desde/hasta qué ansiedad y cuánto se frena el paso · susto del edificio: probabilidad por crisis y segundos mínimos entre sustos
    world: { houseCenterX: -4.2, homeX: -30, busX: 20, turn1X: 95, turn2Z: -60, uniX: 170, uniGateZ: -140, busInteriorX: 106, busStartX: 102.0 }, // calle más larga (al principio era 56 · -30 · 100 · -66): el juego duraba menos de 4 min · la calle va en Z: derecha → arriba (turn1X) → derecha (turn2Z) → arriba hasta la universidad
    exitUrl: 'index.html'
}
// Capa de la protagonista: se puede dibujar aparte (nítida, en el nivel 3 de ansiedad). Antes era la 1, pero en las gafas (WebXR) three.js
// usa las capas 1 y 2 para el ojo izquierdo y el derecho: en la capa 1 Gabriela solo se veía con el ojo izquierdo
export const CAPA_PROTA = 4
export const STATES = ['INTRO', 'EXPLORATION', 'QUAKE', 'ANNOUNCEMENT', 'ANXIETY', 'CHOICE', 'BREATHING', 'CALM', 'FAILURE', 'ARRIVAL', 'ENDING_GOOD', 'ENDING_BAD']
export const runtime = { state: 'INTRO', sandbox: DEBUG, anxiety: 0, envProgress: 1, quake: 0, postQuake: false, taskIndex: 0, nextCrisis: 0, successful: 0, failures: 0, failStreak: 0, glitch: 0, breathProgress: 0, stress: 0, techIndex: 0, techId: '', techName: '', techHelp: '', prompt: '', action: '', level: 0, target: 0, stepFill: 0, phase: '', space: 'HOUSE', rideLeft: 0, paused: false, busMoving: false, grassGreen: false, joyX: 0, joyY: 0 } // joyX / joyY: joystick táctil (-1 a 1)