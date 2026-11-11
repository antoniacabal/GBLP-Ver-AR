// Indice
    // 0. Imports
    // 1. Constantes y estado
    // 2. Rutina del día
    // 3. Cambio de espacio
    // 4. Vestirse y desayuno con mamá
    // 5. El MIO
    // 6. Interacción
    // 7. Explicación de los minijuegos
    // 8. Máquina de estados
    // 9. Eventos de respiración
    // 10. Modo ?debug (sin narrativa)
    // 11. Bucle principal
    // 12. Inicio

// 0. Imports
import gsap from 'gsap'
import * as THREE from 'three'
import { CONFIG, runtime } from './config.js'
import { sm } from './stateMachine.js'
import { renderer, scene, canvas, renderSharp } from './scene.js'
import { camera, updateCamera } from './camera.js'
import { DINING_SEAT, setDesayuno } from './environment.js'
import { modelosListos, updateEnvironment, props, uniBus, resetProps, marker, setSpace, SEATS, SEGS, atUniversity, nearUniversity, endless, HOME_DOOR, STREET_X0, ROUTE_LEN, routePoint, nearestSeg, scareBuilding, DOORS, SPAWN, BED_LIE, BUS_DOORS, busExits } from './environment.js'
import { player } from './player.js'
import { breathing } from './breathing.js'
import { updateAnxiety } from './anxiety.js'
import { audio } from './audio.js'
import { ui } from './ui.js'
import { initDebug } from './debug.js'
import { updateNpcs, npcState, mom } from './npcs.js'
import { haptics } from './haptics.js'
import { INSTRUCCIONES } from './instrucciones.js'
import { crearOclusion, conOclusion } from './oclusion.js'
import './touch.js'
import { dibujarMR, elegirModo, mr } from './mr/index.js' // realidad mixta: la maqueta en las gafas (o su vista previa)

// 1. Constantes y estado
document.documentElement.classList.add('sin-scroll')
const W = CONFIG.world, C = CONFIG.crisis, B = CONFIG.bus, HX = W.homeX
const auto = () => !runtime.sandbox // false en ?debug: la historia no avanza sola
const initAudio = () => audio.init() // el audio arranca con el primer gesto del usuario (el navegador no permite sonido antes)

// 2. Rutina del día: se repite antes y después del sismo
// Orden: levantarse → vestirse (armario) → recoger celular y maleta (en el orden que quieras) → bajar → mamá (saludo) → desayunar
//        → mamá se despide (después del sismo te consuela) → salir por la puerta principal → (antes del sismo) subir al MIO
const ITEMS = ['celular', 'maleta'], NAMES = { celular: 'el celular', maleta: 'la maleta' }
// Lo que toca hacer no se dice con texto (rompía la inmersión): el objetivo brilla y una flecha guía hacia él (sección 11)
const TASK_SPACE = { cama: 'HOUSE', armario: 'HOUSE', items: 'HOUSE', puerta: 'HOUSE', mama: 'HOME', desayuno: 'HOME', salida: 'HOME', bus: 'STREET' }
let up = false, dressed = false, down = false, momDone = false, ate = false, out = false, got = new Set(), busy = false, arrived = false, busAsked = false
const rand = (a, b) => a + Math.random() * (b - a)
const dist = (id) => { // distancia del personaje al objeto (el MIO se mide contra su huella en planta)
    const p = props[id], r = p.rect
    if (r) return Math.hypot(Math.max(r[0] - player.x, 0, player.x - r[1]), Math.max(r[2] - player.z, 0, player.z - r[3]))
    return Math.hypot(player.x - p.pos.x, player.z - p.pos.z)
}
const nearBus = (r = CONFIG.player.reach) => runtime.space === 'STREET' && dist('bus') < r
const pending = () => ITEMS.filter(i => !got.has(i))
const current = () => !up ? 'cama' : !dressed ? 'armario' : pending().length ? 'items' : !down ? 'puerta' : !momDone ? 'mama' : !ate ? 'desayuno' : !out ? 'salida' : !runtime.postQuake ? 'bus' : null

function startRoutine(post) {
    resetProps(); resetBreakfast()
    up = dressed = down = momDone = ate = out = arrived = busy = busAsked = braked = busDone = false; got.clear(); resetScare(); player.setBackpack(false); player.setPijama(true) // cada día empieza en pijama
    introEarth = false; progressMax = 0; runtime.asustada = false; runtime.postQuake = post; runtime.healed = false; runtime.envProgress = post ? 0 : 1; runtime.anxiety = post ? 0.08 : 0; runtime.stress = 0
    houseCrisis = ['armario', ...ITEMS][Math.floor(Math.random() * 3)]; earthRun = 0; momAsked.clear(); houseT = 0
    setSpace('HOUSE'); runtime.nextCrisis = C.first; player.lieDown(); CONFIG.camera.x = W.houseCenterX; CONFIG.camera.z = 0
}

// 3. Cambio de espacio: cuarto, planta baja, calle e interior del MIO con un fundido
const streetCam = (x, z) => { // la cámara mira hacia donde avanza el tramo de la calle y se centra un poco sobre ella
    const L = CONFIG.camera.lead, s = nearestSeg(x, z)
    return s.axis === 'x' ? [x + L * s.dir, s.z0 + (z - s.z0) * 0.4] : [s.x0 + (x - s.x0) * 0.4, z + L * s.dir]
}
let armed = false // las flechas del piso solo cambian de espacio después de salir de la flecha por la que llegaste
function goTo(space, x, z, camX, camZ = 0) { player.unsit(); setSpace(space); armed = false; runtime.busMoving = false; player.x = x; player.z = z; CONFIG.camera.x = camX; CONFIG.camera.z = camZ } // el MIO no arranca hasta que te sientes
const goStreet = (x, z) => goTo('STREET', x, z, ...streetCam(x, z))
function transition(fn) {
    busy = true; player.setMode('stop')
    ui.fade(1, 0.5, () => { fn(); ui.fade(0, 0.6, () => { busy = false; if (runtime.state === 'EXPLORATION') player.setMode('free') }) })
}
// apareces en el caminito, frente a la puerta de la casa. Después del sismo, la primera crisis en la calle llega enseguida y siempre es
// el Earthing (presenta la mecánica); de ahí en adelante los minijuegos salen al azar
let introEarth = false
const exitHouse = () => transition(() => { const first = !out; out = true; goStreet(HOME_DOOR.x, HOME_DOOR.z + 2); if (runtime.postQuake && first) { introEarth = true; runtime.nextCrisis = 3 } })
// Volver a entrar: de la calle a la planta baja (por la puerta de la casa) y de la planta baja al cuarto (por la flecha que sube).
// Al llegar, Gabriela aparece junto a la flecha por la que entró
const goHome = () => transition(() => goTo('HOME', SPAWN.calle.x, SPAWN.calle.z, HX))
const goUp = () => transition(() => { goTo('HOUSE', SPAWN.cuarto.x, SPAWN.cuarto.z, W.houseCenterX); player.group.rotation.y = Math.PI }) // sobre la flecha de salida, mirando hacia adentro del cuarto
const goDown = () => transition(() => { down = true; runtime.nextCrisis = rand(C.min, C.max); goTo('HOME', SPAWN.subir.x, SPAWN.subir.z, HX) })  // bajas a la planta baja: cocina, comedor y sala
// Cámara enfocada: se acerca a un punto (al despertar después del sismo) o al personaje (antes de los finales)
let focus = null
const focusOn = (x, z, zoom) => { focus = { x, z }; CONFIG.camera.x = x; CONFIG.camera.z = z; CONFIG.camera.zoom = zoom }
// Toma final (al ganar o perder): Gabriela se voltea hacia la cámara y la cámara se acerca hasta casi solo ella
const finalShot = (cb) => {
    if (player.sitting) player.unsit()
    const r = player.group.rotation, want = THREE.MathUtils.degToRad(CONFIG.camera.azimuth) // la cámara está hacia (sin az, cos az)
    gsap.to(r, { y: r.y + Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)), duration: 0.8, ease: 'power2.inOut' })
    focus = 'player'; gsap.to(CONFIG.camera, { zoom: 3.6, duration: 3, ease: 'power2.inOut', onComplete: cb })
}
const resetFocus = () => { focus = null; gsap.killTweensOf(CONFIG.camera); CONFIG.camera.zoom = 1 }

// Susto en la calle (después del sismo): un edificio cercano empieza a temblar y a inclinarse, y eso dispara la crisis
let scared = null, scareCalm = false, lastScare = -999 // lastScare: cuándo fue el último susto (hay un mínimo de tiempo entre uno y otro)
function scare(t) {
    if (t - lastScare < CONFIG.street.scareGap) return false
    const e = scareBuilding(player.x, player.z); if (!e) return false
    scared = e; lastScare = t; busy = true; player.setMode('agitated'); player.sobresalto(e.x, e.g.position.z); ui.say('Ese edificio... ¿se está moviendo?') // da un salto hacia atrás, mirándolo
    gsap.to(e, { sh: 0.45, duration: 0.5 }); gsap.to(e, { tilt: 0.07, sink: 0.12, duration: 2.2, delay: 0.5, ease: 'power2.in' }) // sutil: tiembla y se ladea apenas
    haptics.buzz([120, 80, 120, 80, 200, 60, 300])
    gsap.to({}, { duration: 0.22, repeat: 8, onRepeat: () => !runtime.paused && audio.blip(40 + Math.random() * 25, 0.25, 0.07, 'sawtooth') })
    gsap.to(runtime, { anxiety: Math.max(runtime.anxiety, 0.55), duration: 2 })
    gsap.delayedCall(2.8, () => { busy = false; if (runtime.state === 'EXPLORATION') sm.go('ANXIETY') })
    return true
}
// Susto adentro (la casa y el MIO, después del sismo): un temblor fantasma sacude todo un momento y Gabriela salta hacia atrás como en la
// calle; si estaba sentada en el MIO, primero se para. Después llega la crisis. Sale en la mitad de las crisis de adentro
function sustoAdentro(t) {
    if (t - lastScare < CONFIG.street.scareGap) return sm.go('ANXIETY')
    lastScare = t; busy = true; player.setMode('agitated'); const bus = runtime.space === 'BUS'
    if (player.sitting) player.unsit()
    ui.say(bus ? 'El MIO se sacude... ¿otra vez?' : '¿Eso... se movió?')
    const p = player.group.position; player.sobresalto(p.x + (Math.random() - 0.5), p.z - 1.2) // salta hacia atrás, alejándose de la sacudida
    haptics.buzz([120, 80, 200, 60, 260])
    gsap.timeline().to(runtime, { quake: 0.3, duration: 0.2 }).to(runtime, { quake: 0.1, duration: 0.3, yoyo: true, repeat: 3 }).to(runtime, { quake: 0, duration: 0.4 })
    gsap.to({}, { duration: 0.22, repeat: 6, onRepeat: () => !runtime.paused && audio.blip(45 + Math.random() * 20, 0.25, 0.08, 'sawtooth') })
    gsap.to(runtime, { anxiety: Math.max(runtime.anxiety, 0.55), duration: 1.5 })
    gsap.delayedCall(2.6, () => { busy = false; if (runtime.state === 'EXPLORATION') sm.go('ANXIETY') })
}
const crisisAdentro = (t) => Math.random() < 0.5 ? sustoAdentro(t) : sm.go('ANXIETY')
function settleScare(ok) { // después de la crisis, el edificio vuelve despacio a su lugar (nunca se cayó)
    if (!scared) return
    gsap.to(scared, { sh: 0, tilt: 0, sink: 0, duration: 2.5, ease: 'power2.out' }); scared = null; scareCalm = ok
}
const resetScare = () => { if (scared) { gsap.killTweensOf(scared); Object.assign(scared, { sh: 0, tilt: 0, sink: 0 }); scared = null } scareCalm = false }

function getUp() { player.standUp(props.cama.pos.x, props.cama.pos.z); up = true }
// Levantarse es una escena, no una interacción: Gabriela se queda un rato acostada y se para sola (después del sismo le cuesta más)
function wakeUp(delay) {
    busy = true; player.setMode('stop')
    gsap.delayedCall(delay, () => {
        if (!runtime.postQuake) { busy = false; getUp(); return player.setMode('free') }
        ui.say('Tardas más en levantarte...'); gsap.to(runtime, { anxiety: Math.max(runtime.anxiety, 0.15), duration: 2 })
        gsap.delayedCall(1.6, () => { busy = false; getUp(); if (runtime.state === 'EXPLORATION') player.setMode('free') })
    })
}
// Después del sismo, la primera crisis en el cuarto llega al hacer una de estas tres cosas (al azar): vestirse, coger el celular o la maleta
let houseCrisis = null
function maybeHouseCrisis(id) {
    if (!runtime.postQuake || !auto() || houseCrisis !== id) return
    houseCrisis = null; gsap.delayedCall(0.9, () => { if (runtime.state === 'EXPLORATION') crisisAdentro(juegoT) })
}

// 4. Vestirse y desayuno con mamá
function dress() { // la acción no se ve: la pantalla funde a negro mientras te cambias
    busy = true; player.setMode('stop')
    ui.fade(1, 0.5, () => {
        ui.say(runtime.postQuake ? 'Te cuesta decidir qué ponerte...' : 'Te vistes para ir a la universidad.'); player.setPijama(false) // (con la pantalla en negro: al volver ya tiene la ropa del día)
        gsap.delayedCall(runtime.postQuake ? 1.8 : 0.9, () => ui.fade(0, 0.5, () => { busy = false; dressed = true; if (runtime.state === 'EXPLORATION') player.setMode('free'); maybeHouseCrisis('armario') }))
    })
}
// Frases: un texto lo dice mamá; [quién, texto] lo dice otra persona. hello = al llegar a la cocina · bye = después de desayunar
const ME = 'Gabriela'
const MOM_LINES = {
    pre: {
        hello: ['¡Buenos días, mi amor! ¿Dormiste bien?', 'Te preparé el desayuno: arepa con huevito y chocolate. Está ahí en la isla, cómetelo antes de irte.'],
        bye: ['¡Eso, te lo comiste todito!', 'Que te vaya muy bien hoy. ¡Mucha suerte en la universidad!']
    },
    post: {
        hello: ['Buenos días, hija... ¿Pudiste dormir algo anoche?', [ME, 'Casi nada...'], 'Te dejé el desayuno listo en la isla. Come aunque sea un poquito, ¿sí?'],
        bye: [ // después del sismo mamá intenta que te sientas mejor y que quieras salir
            [ME, 'No quiero salir, mamá. ¿Y si vuelve a temblar?'],
            'Lo sé, mi amor. A mí también me cuesta. Si se te acelera el pecho, respira despacito.',
            [ME, '...Bueno. Lo voy a intentar.'],
            'Y si se pone difícil, me llamas y voy por ti.'
        ]
    }
}
const momLines = () => runtime.postQuake ? MOM_LINES.post : MOM_LINES.pre
const freeAgain = () => { busy = false; if (runtime.state === 'EXPLORATION') player.setMode('free') }
// Gabriela gira hacia un punto (por el lado más corto): hacia mamá cuando hablan y hacia el edificio que parece moverse
function faceTo(x, z) {
    const r = player.group.rotation, want = Math.atan2(x - player.x, z - player.z)
    gsap.to(r, { y: r.y + Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)), duration: 0.4, ease: 'power2.out' })
}
const faceMom = () => faceTo(mom.g.position.x, mom.g.position.z)
function talkToMom() {
    busy = true; player.setMode('stop'); ui.say(''); mom.setTalking(true); faceMom()
    ui.talk('Mamá', momLines().hello, { onEnd: () => { mom.setTalking(false); momDone = true; freeAgain() } })
}
// Al despedirse (después del desayuno, antes de salir) se abrazan: Gabriela camina hasta mamá, se quedan abrazadas un momento (las dos con los
// ojos cerrados) y vuelve caminando a donde estaba (si se quedaba ahí, quedaba dentro del espacio de mamá y no se podía mover; y un paso atrás
// cualquiera podía meterla en una silla o en el mesón). Se pone al lado de mamá, de perfil a la cámara (del lado donde ya estaba): si llegaba
// de frente, su espalda tapaba a mamá
function hugMom(alFinal) {
    const g = player.group.position, m = mom.g.position, x0 = g.x, z0 = g.z, CERCA = 0.46 // distancia entre los dos centros, abrazadas
    const az = THREE.MathUtils.degToRad(CONFIG.camera.azimuth); let ux = Math.cos(az), uz = -Math.sin(az) // (de lado respecto a la cámara: camera.js)
    if ((x0 - m.x) * ux + (z0 - m.z) * uz < 0) { ux = -ux; uz = -uz }
    const ax = m.x + ux * CERCA, azz = m.z + uz * CERCA, d = Math.hypot(ax - x0, azz - z0), paso = Math.max(0.4, d / 1.6)
    const mirar = (x, z) => { player.group.rotation.y = Math.atan2(x, z) }
    mirar(ax - x0, azz - z0); player.paseo(true) // camina hasta ella
    gsap.timeline({ onComplete: alFinal })
        .to(g, { x: ax, z: azz, duration: paso, ease: 'none' })
        .add(() => { player.paseo(false); mirar(-ux, -uz); player.abrazar(true); mom.setAbrazo(true) })
        .add(() => { player.abrazar(false); mom.setAbrazo(false) }, '+=2.3')
        .add(() => { mirar(x0 - ax, z0 - azz); player.paseo(true) }, '+=0.35')
        .to(g, { x: x0, z: z0, duration: paso, ease: 'none' })
        .add(() => player.paseo(false))
}
// Después del sismo mamá está pendiente: si te quedas mucho rato en el cuarto, te pregunta desde abajo si estás bien (una vez por día).
// Hablar con ella te baja un nivel de ansiedad. (En la sala, al perder un minijuego, ya no pregunta)
const MOM_CHECK = {
    cuarto: { who: 'Mamá', lines: ['Gabriela, mi amor... ¿estás bien? Llevas un buen rato allá arriba.', [ME, 'Sí, ma... es que hoy me está costando un poquito.'], 'Tranquila, sin afán. Aquí te espero; baja cuando estés lista.'] }
}
let momAsked = new Set(), houseT = 0 // houseT: cuánto llevas en el cuarto (después de levantarte)
function momCheck(kind, tries = 0) {
    if (!runtime.postQuake || momAsked.has(kind) || runtime.sandbox) return
    if (busy || runtime.state !== 'EXPLORATION') { if (tries < 8) gsap.delayedCall(1, () => momCheck(kind, tries + 1)); return } // espera a que termine lo que estás haciendo
    momAsked.add(kind); busy = true; player.setMode('stop'); ui.say('')
    ui.talk(MOM_CHECK[kind].who, MOM_CHECK[kind].lines, { onEnd: () => {
        runtime.failStreak = Math.max(0, (runtime.failStreak || 0) - 1); runtime.glitch = runtime.failStreak // un nivel menos de ansiedad
        gsap.to(runtime, { anxiety: C.baseline + 0.2 * runtime.failStreak, stress: 0, duration: 4 })
        freeAgain()
    } })
}
function resetBreakfast() { setDesayuno('lleno') }
// Desayunar: Gabriela se sienta en la silla frente al plato (con un fundido corto) y se ve cómo la comida va desapareciendo a mordiscos;
// después del sismo solo come un poco. Al terminar se para detrás de la silla y mamá se despide. Es su propia escena: Saltar (en los
// diálogos) no la adelanta
function eat() {
    busy = true; player.setMode('stop'); ui.cancelSkip()
    const post = runtime.postQuake
    ui.fade(1, 0.35, () => {
        player.sit(DINING_SEAT, true); player.comer(true) // la mano lleva bocados a la boca y mastica (personaje.js, pose comerSentada)
        ui.fade(0, 0.4, () => {
            ui.say(post ? 'Te cuesta tragar... comes despacio.' : 'Comes tu desayuno.')
            gsap.timeline({ onComplete: () => {
                ate = true; ui.say(post ? 'Solo logras comer un poco.' : 'Te comiste todo el desayuno.')
                gsap.delayedCall(0.8, () => { player.comer(false); player.unsit({ x: DINING_SEAT.x + 0.65, z: DINING_SEAT.z }); player.group.rotation.y = Math.PI / 2; gsap.delayedCall(0.6, momBye) }) // se para al lado de la silla (del lado de la punta de la mesa)
            } }) // el plato se va vaciando (los tres modelos del desayuno); después del sismo se queda a medio comer
                .call(() => setDesayuno('medio'), null, post ? 2.6 : 1.6)
                .call(() => setDesayuno(post ? 'medio' : 'vacio'), null, post ? 3.4 : 3.2)
        })
    })
}
function momBye() {
    const post = runtime.postQuake; mom.setTalking(true); ui.say(''); faceMom() // después de comer se voltea de nuevo hacia ella
    if (post) gsap.to(runtime, { anxiety: C.baseline, stress: 0, duration: 12 }) // mientras mamá te habla, la ansiedad baja poco a poco
    ui.talk('Mamá', momLines().bye, { onEnd: () => { mom.setTalking(false); hugMom(() => { if (post) runtime.nextCrisis = C.first; freeAgain() }) } }) // y se abrazan antes de salir
}

// 5. El MIO: antes del sismo es el viaje normal (el sismo llega durante el trayecto).
//    Después es opcional y es un atajo: un frenón te devuelve a ese día y después llegan más crisis. Si pierdes un minijuego
//    sigues en el MIO; si aguantas todo el viaje, el MIO te deja frente a la universidad
let busRide = 0, busTraumaAt = 0, braked = false, busDone = false, earthRun = 0, busWins = 0, busGoal = 6 // busWins: minijuegos ganados en este viaje (con busGoal te deja en la universidad) · earthRun: Earthings seguidos (nunca más de dos)
let busAway = false // después de decir que no al MIO, hay que alejarse antes de que tocarlo te suba
const askBus = () => { busAsked = true; busAway = false; sm.go('CHOICE') }
function boardBus() {
    ui.hideChoice(); if (runtime.state === 'CHOICE') sm.go('EXPLORATION')
    const post = runtime.postQuake
    const board = () => transition(() => {
        runtime.rideLeft = post ? B.time : B.calmRide; runtime.nextCrisis = rand(B.crisisMin, B.crisisMax); busRide = 0; braked = false; busWins = 0; busGoal = B.goal[Math.floor(Math.random() * B.goal.length)]; busTraumaAt = rand(B.traumaMin, B.traumaMax)
        if (post) runtime.anxiety = Math.max(runtime.anxiety, B.startAnxiety)
        goTo('BUS', W.busStartX, 0, W.busInteriorX)
    })
    if (!post) return board()
    busy = true; player.setMode('stop'); ui.say('Te tiemblan las piernas frente a la puerta del MIO...') // la aprehensión antes de subir
    gsap.to(runtime, { anxiety: Math.max(runtime.anxiety, B.startAnxiety), duration: 1.6 })
    gsap.delayedCall(2, board)
}
function declineBus() { ui.hideChoice(); sm.go('EXPLORATION'); ui.say('Sigues a pie.') }
function busTrauma() { // el MIO frena de golpe y todo vibra: el cuerpo lo vive como el sismo
    busy = true; braked = true; player.setMode('stop'); ui.say('El MIO frena de golpe... todo vibra como ese día.') // sigue sentada: del MIO solo se baja eligiendo hacerlo
    haptics.buzz([350, 60, 250, 60, 250, 60, 400])
    const shake = gsap.timeline().to(runtime, { quake: 0.45, duration: 0.25 }).to(runtime, { quake: 0.15, duration: 0.35, yoyo: true, repeat: 3 }).to(runtime, { quake: 0, duration: 0.5 })
    gsap.to({}, { duration: 0.2, repeat: 8, onRepeat: () => !runtime.paused && audio.blip(45 + Math.random() * 20, 0.25, 0.14, 'sawtooth') })
    gsap.to(runtime, { anxiety: Math.max(runtime.anxiety, 0.7), duration: 1.5 })
    shake.eventCallback('onComplete', () => { busy = false; sm.go('ANXIETY') })
}
function busLostChoice() { // perdiste un minijuego dentro del MIO: sigues en el MIO (antes te podía dejar en la calle; perder nunca te saca del bus)
    ui.say('Perdiste el ritmo. El MIO sigue avanzando: sigue respirando.')
    runtime.nextCrisis = rand(B.crisisMin, B.crisisMax); sm.go('EXPLORATION')
}
// Earthing dentro del MIO: tú decides si bajarte a buscar pasto o quedarte (y entonces la ansiedad sube un nivel)
function busEarthChoice() {
    player.setMode('stop')
    ui.choice('Necesitas aire', 'El cuerpo te pide bajar a pisar el pasto. Si te quedas en el MIO, la ansiedad va a subir un nivel.', [
        { label: 'Quedarme', dir: 'left', fn: () => {
            ui.hideChoice(); gsap.to(runtime, { anxiety: Math.min(1, runtime.anxiety + B.stayAnxiety), duration: 1.2 })
            // sube un nivel completo (como perder un minijuego), pero como mucho hasta el 2: quedarse nunca te lleva al final negativo
            runtime.failStreak = Math.min(2, (runtime.failStreak || 0) + 1); runtime.glitch = runtime.failStreak
            runtime.nextCrisis = rand(B.crisisMin, B.crisisMax); ui.say('Te quedas. El pecho se aprieta más...'); sm.go('EXPLORATION')
        } },
        { label: 'Bajarme', dir: 'right', fn: () => {
            ui.hideChoice(); busDone = true; busy = true
            ui.say('Bajas del MIO a buscar pasto.'); ui.fade(1, 0.4, () => { leaveBus(); ui.fade(0, 0.5, () => { busy = false; sm.go('BREATHING') }) })
        } }])
}
const BUS_D0 = W.busX + 3 - STREET_X0 // dónde queda el paradero del MIO en el recorrido (metros desde la valla)
// Bajarse del MIO: aparece en la calle a la altura del trayecto recorrido (a la derecha de la calle, en el tramo que toque)
const leaveBus = () => {
    const p = Math.min(1, busWins / busGoal) // qué tanto avanzó el MIO: según los minijuegos ganados
    const [x, z, s] = routePoint(BUS_D0 + p * (ROUTE_LEN - BUS_D0 - 10))
    s.axis === 'x' ? goStreet(x, z + 1.5) : goStreet(x + 1.5, z)
    runtime.nextCrisis = rand(CONFIG.street.crisisMin, CONFIG.street.crisisMax) // ya en la calle: su ritmo, no el del MIO
}
const rideEnd = () => transition(() => { // aguantaste el viaje: el MIO te deja frente a la universidad (y ya no está en el paradero de la casa)
    busDone = true; props.bus.mesh.visible = false; uniBus.visible = true
    goStreet(W.uniX - 1, W.uniGateZ + 4); ui.say('El MIO te deja frente a la universidad.')
})
function startRide() { if (runtime.busMoving) return; runtime.busMoving = true; haptics.buzz(120) } // el MIO arranca cuando te sientas por primera vez

// 6. Interacción: clic (o el botón táctil Interactuar)
function interact() {
    if (runtime.paused || runtime.state !== 'EXPLORATION' || busy || runtime.tambaleo !== undefined) return // (durante Reconstruir la gravedad no te puedes sentar)
    if (runtime.space === 'BUS') { // sentarse / levantarse en las bancas del MIO
        if (player.sitting) { if (!player.seatLocked) player.unsit(); return } // después del sismo puedes pararte (y bajarte por las puertas) cuando quieras; antes, el viaje sigue hasta el sismo
        const s = SEATS.filter(s => !s.taken).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0]
        if (s && Math.hypot(s.x - player.x, s.z - player.z) < 2.2) { player.sit(s, !runtime.postQuake); return startRide() }
    }
    if (runtime.postQuake && !current() && nearBus()) return busDone ? ui.say('No te sientes capaz de volver a subir al MIO. Sigues a pie.') : askBus() // pulsar E junto al MIO vuelve a abrir la opción
    const c = current(); if (!c || c === 'cama' || TASK_SPACE[c] !== runtime.space) return // la cama no se usa: levantarse es una escena (wakeUp)
    if (c === 'items') { // cualquier objeto pendiente, en el orden que quieras: se recoge el más cercano
        const aObjeto = (i) => { const m = props[i].mark; return Math.hypot(m.x - player.x, m.z - player.z) } // el celular está en el escritorio y la maleta en la cama: cuenta dónde está cada uno
        const [id, d] = pending().map(i => [i, aObjeto(i)]).sort((x, y) => x[1] - y[1])[0]
        if (d > CONFIG.player.reach) return
        busy = true; player.setMode('stop')
        const m = props[id].mark
        player.coger(m.x, m.z, () => { props[id].mesh.visible = false; got.add(id); if (id === 'maleta') player.setBackpack(true) }, // la mano llega: el objeto desaparece (la maleta pasa a la espalda)
            () => { freeAgain(); maybeHouseCrisis(id) })
        return
    }
    const plato = props.desayuno.mark, lejos = c === 'desayuno' ? Math.hypot(player.x - plato.x, player.z - plato.z) > 1.25 : dist(c) > (c === 'mama' ? 2.4 : CONFIG.player.reach)
    if (lejos) return // lejos: no pasa nada (el desayuno se mide contra el plato: antes bastaba estar cerca de cualquier borde de la mesa y se podía comer desde la otra punta)
    if (c === 'armario') return dress()
    if (c === 'puerta') return goDown()
    if (c === 'mama') return talkToMom()
    if (c === 'desayuno') return eat()
    if (c === 'salida') return exitHouse()
    if (c === 'bus') return boardBus()
}
let rumble = 0, doorMsgT = -9, endlessSaid = false
addEventListener('keydown', (e) => e.code === 'KeyE' && !e.isTrusted && !e.repeat && interact()); canvas.addEventListener('pointerdown', interact) // E: solo la del botón táctil Interactuar (la del teclado no está en los controles)

// 7. Explicación de los minijuegos: sale la primera vez que aparece cada tipo (se reinicia al recargar la página)
const seenTutorials = new Set()
// Tres imágenes con una frase corta por minijuego (instrucciones.js); el botón "?" las muestra otra vez
const tutorialFor = (tech) => { const mech = tech.game || 'hold'; return { sub: mech === 'hold' ? 'Ejercicios de respiración' : tech.name, steps: INSTRUCCIONES[mech], page: tech.page } }

// 8. Máquina de estados
sm.on('INTRO', () => {
    startRoutine(false); player.setMode('stop'); ui.hud(false)
    // primero se carga todo con la pantalla en negro (los modelos y la protagonista): así la tarjeta no se traba
    ui.cargando(true)
    Promise.all([modelosListos, player.cargarModelo()]).then(() => setTimeout(() => { ui.cargando(false); intro() }, 80)) // (un respiro para que se dibuje lo recién cargado)
})
function intro() {
    ui.card('10 de agosto', '6:00 a. m.')
    // antes de poder moverte: pop-up con los controles (en celular no: sobra, los botones están a la vista); después Gabriela se levanta sola
    ui.hud(false) // los botones de arriba y la línea de tiempo aparecen después del pop-up de controles
    const start = () => { ui.hud(true); sm.go('EXPLORATION'); wakeUp(0.6) }
    gsap.delayedCall(3, () => { ui.card(); ui.fade(0, 1.5, () => document.body.classList.contains('gx-touch-on') && !mr.vista ? start() : ui.controls(start)) }) // (en las gafas sí: los controles son otros)
}
sm.on('EXPLORATION', () => { player.setMode('free') })
// Saltar durante el sismo (y su explicación) lleva directo a "Una semana después": se corta todo lo que estaba pasando
function skipQuake() {
    gsap.globalTimeline.clear(); clearInterval(rumble); haptics.stop()
    quakeSnd?.stop(); quakeSnd = null; sirenSnd?.stop(); sirenSnd = null
    runtime.quake = 0; ui.cortarEscena(); ui.fade(1, 0.3, weekLater)
}
sm.on('QUAKE', () => {
    player.setMode('stop'); ui.say(''); ui.card('07:34 a. m.')
    if (!runtime.sandbox) ui.setSkip(skipQuake)
    gsap.delayedCall(2.5, () => {
        ui.card(); clearInterval(rumble)
        quakeSnd?.stop(); quakeSnd = audio.playFile('audios/sonido-terremoto.mp3', { volume: 0.22 }) // sonido grabado del terremoto
        rumble = setInterval(() => { if (runtime.paused) return; haptics.buzz(Math.round(60 + 160 * runtime.quake)) }, 220) // la vibración crece con el sismo
        // la línea de tiempo también lo vive: tiembla "Ir a la Universidad", después toda la barra, y al final se parte en pedazos
        gsap.delayedCall(1.4, () => ui.lineaSismo(1)); gsap.delayedCall(3.8, () => ui.lineaSismo(2)); gsap.delayedCall(5.2, () => ui.lineaRompe()) // cae y se rompe antes del destello
        gsap.to(runtime, { quake: 0.55, anxiety: 0.8, duration: 7.5, ease: 'power1.in', onComplete: () => { // 7.5 s (antes 5): se escucha más del audio del sismo · hasta 0.55 (antes 1: temblaba demasiado)
            clearInterval(rumble)
            quakeSnd?.fade(1.2); if (runtime.sandbox) return void gsap.to(runtime, { quake: 0, anxiety: 0.1, duration: 1.5, onComplete: () => { ui.lineaRestaurar(); sm.go('EXPLORATION') } }) // debug: el sismo se puede repetir sin seguir la historia
            // el golpe: destello blanco, corte a negro y la sirena de alerta (suena durante "Todo se movió" y se apaga con un fundido antes de la explicación del sismo)
            ui.flash(); sirenSnd?.stop(); sirenSnd = audio.playFile('audios/sonido-sirena-alarma.mp3', { volume: 0.2, ahogado: true }); runtime.quake = 0; haptics.buzz(500) // (dura 27 s: no hace falta repetirla) · ahogada: como si sonara lejos o Gabriela estuviera bajo el agua (más volumen: el filtro le quita mucho)
            gsap.delayedCall(1.8, () => ui.whisper(['Todo se movió.', 'Y después... silencio.'], () => { sirenSnd?.fade(2.5); sirenSnd = null; gsap.delayedCall(2.6, () => sm.go('ANNOUNCEMENT')) }))
        } })
    })
})
sm.on('ANNOUNCEMENT', () => {
    ui.card('Sismo en Colombia', 'Durante la mañana del 10 de agosto, un fuerte sismo sacudió diferentes zonas del país. El movimiento provocó alteraciones en la rutina de miles de personas y dejó a muchas comunidades enfrentando sus consecuencias. Aunque el movimiento terminó, sus efectos no necesariamente desaparecen cuando la tierra deja de temblar.', { type: true, onContinue: weekLater })
})
// "Una semana después": empieza la parte de después del sismo (también se vuelve aquí desde el final malo)
let quakeSnd = null, sirenSnd = null // sonidos grabados del sismo (audio.playFile)
function weekLater() {
    ui.setSkip(null) // (el salto del sismo ya no aplica)
    sirenSnd?.fade(1.5); sirenSnd = null // (por si acaso: la sirena ya se apagó antes de la explicación del sismo)
    ui.card('Una semana después', '6:00 a. m.')
    gsap.delayedCall(3, () => { // la casa aparece despacio, con la cámara cerca de la cama, y se va abriendo
        ui.card(); runtime.quake = 0; ui.lineaRestaurar(); startRoutine(true)
        focusOn(BED_LIE.x, -0.7, 1.35); ui.fade(0, 3) // la cámara empieza cerca de la cama...
        const tl = gsap.timeline({ delay: 1.2, onComplete: () => { focus = null; wakeUp(0.3) } }) // ...y vuelve en un solo movimiento a la cámara normal del cuarto (zoom y posición a la vez)
        tl.to(CONFIG.camera, { zoom: 1, duration: 4.5, ease: 'power2.inOut' }, 0).to(focus, { x: W.houseCenterX, z: 0, duration: 4.5, ease: 'power2.inOut' }, 0)
        sm.go('EXPLORATION'); busy = true; player.setMode('stop') // sigue acostada mientras la cámara se abre
    })
}
// Final malo: no se reinicia todo, vuelves a la semana después del sismo. Solo el final bueno reinicia el juego completo
function retryPostQuake() {
    ui.hideEnding(); gsap.globalTimeline.clear(); clearInterval(rumble); breathing.stop(); ui.showBreath(false); ui.hideChoice(); ui.closeTalk(); mom.setTalking(false); resetFocus(); resetScare()
    Object.assign(runtime, { quake: 0, failures: 0, failStreak: 0, successful: 0, glitch: 0, stress: 0 })
    ui.fade(1, 0.8, weekLater)
}
sm.on('CHOICE', () => {
    player.setMode('stop')
    ui.choice('Llegó el MIO', 'Puedes subirte o seguir caminando hasta la universidad. Tú decides.', [
        { label: 'Subir al MIO', dir: 'right', fn: boardBus }, { label: 'Seguir caminando', dir: 'left', fn: declineBus }],
        runtime.postQuake ? 'Aviso: el MIO es un espacio cerrado y lleno, como el lugar donde viviste el sismo. Si subes, vas a sufrir varias crisis seguidas por el trauma. Si las aguantas, llegas más rápido a la universidad.' : '')
})
sm.on('ANXIETY', () => {
    if (introEarth && runtime.space === 'STREET') { introEarth = false; breathing.force('earth') } // primera crisis en la calle: Earthing
    runtime.asustada = true // la pose de miedo sigue hasta ganar el minijuego (player.js)
    player.setMode('stop'); ui.say('Algo dentro no se calma...'); breathing.pick(runtime.space, earthRun >= 2) // el Earthing nunca sale más de dos veces seguidas
    earthRun = runtime.techId === 'earth' ? earthRun + 1 : 0
    gsap.to(runtime, { anxiety: Math.max(runtime.anxiety, C.startAnxiety), duration: 1 })
    if (runtime.techId === 'earth' && runtime.space === 'BUS') return void gsap.delayedCall(1.2, () => runtime.state === 'ANXIETY' && sm.go('BUS_EARTH')) // en el MIO: ¿bajarse o quedarse?
    gsap.delayedCall(1.5, () => runtime.state === 'ANXIETY' && sm.go('BREATHING'))
})
sm.on('BUS_EARTH', busEarthChoice)
sm.on('BUS_LOST', busLostChoice)
sm.on('BREATHING', () => {
    player.setMode('guided'); ui.say('')
    const tech = breathing.prepare(), mech = tech.game || 'hold' // todas las respiraciones se juegan igual (mantener y soltar)
    ui.onHelp(() => ui.tutorial(tutorialFor(tech))) // botón "?": vuelve a ver cómo se juega (el juego queda en pausa mientras)
    const begin = () => { breathing.start(); ui.showBreath(true); if (tech.game === 'earth') player.setMode('free') }
    const go = () => { if (runtime.state !== 'BREATHING') return; if (seenTutorials.has(mech)) return begin(); seenTutorials.add(mech); ui.tutorial(tutorialFor(tech), begin) } // primera vez: explica y espera
    ui.announce(tech.name, go) // primero el anuncio grande con el nombre de la técnica
})
sm.on('CALM', () => { // transitorio: la crisis pasó y la rutina continúa
    player.setMode('calm'); ui.say(scareCalm ? 'El edificio sigue en su lugar. Estás aquí. Ahora.' : runtime.techId === 'conteo' ? 'El suelo está quieto otra vez.' : runtime.techId === 'gravedad' ? 'El suelo está derecho. Respiras hondo.' : runtime.techId === 'foco' ? 'Escuchas la gota, constante. El ruido se aleja.' : 'Estás aquí. Ahora.'); scareCalm = false
    gsap.delayedCall(2.5, () => { if (runtime.state === 'CALM') sm.go('EXPLORATION') })
})
// Finales: antes de la escena final Gabriela mira a la cámara y la cámara se acerca despacio a ella
sm.on('FAILURE', () => {
    breathing.stop(); ui.showBreath(false); player.setMode('agitated'); ui.say('Todo se desborda...')
    gsap.to(runtime, { anxiety: 1, duration: 2 }); finalShot(() => gsap.delayedCall(1, () => sm.go('ENDING_BAD')))
})
sm.on('ARRIVAL', () => {
    arrived = true; runtime.healed = true; runtime.asustada = false; player.setMode('calm'); breathing.stop(); // healed: el mundo vuelve al nivel -1 (colores normales, sin blur)
    // ganaste: se acaba todo lo de la ansiedad (sin temblor, sin fallas ni fantasmas, música tranquila: la música sigue a la ansiedad)
    runtime.failStreak = 0; runtime.glitch = 0; runtime.quake = 0; resetScare(); gsap.killTweensOf(runtime, 'anxiety,stress'); runtime.stress = 0
    ui.showBreath(false); ui.say('Llegaste a la universidad.')
    gsap.to(runtime, { anxiety: 0, duration: 1.5 }); gsap.to(runtime, { envProgress: 1, duration: 4 }); finalShot(() => gsap.delayedCall(1.2, () => sm.go('ENDING_GOOD')))
})
sm.on('ENDING_GOOD', () => ui.ending('Final positivo', 'El miedo no desapareció de un momento a otro. Pero aprendiste a volver al presente.')) // volver a jugar: desde el principio
sm.on('ENDING_BAD', () => ui.ending('Final negativo', 'A veces volver a sentirse seguro toma tiempo. Pedir ayuda también puede ser parte del proceso.', retryPostQuake)) // volver a intentarlo: desde la semana después del sismo

// 9. Eventos de respiración: cada evento es UN solo ciclo
breathing.init({
    onPhase: (p) => audio.breathCue(p),
    onCycle: (ok) => {
        const bus = runtime.space === 'BUS'
        runtime.stress = 0 // los choques de antes de la crisis ya no cuentan para la siguiente
        ui.showBreath(false); audio.result(ok); runtime.nextCrisis = bus ? rand(B.crisisMin, B.crisisMax) : runtime.space === 'STREET' ? rand(CONFIG.street.crisisMin, CONFIG.street.crisisMax) : rand(C.min, C.max) // la calle tiene su propio ritmo (más espaciado)
        settleScare(ok) // el edificio del susto vuelve a su lugar
        if (runtime.sandbox) { // debug: el resultado no cuenta para la historia (ni fallos ni final negativo)
            if (ok) runtime.asustada = false
            ui.say(ok ? 'Minijuego superado (debug).' : 'Minijuego no superado (debug).')
            gsap.to(runtime, { anxiety: bus ? B.baseline : C.baseline, duration: 1.5 })
            return void gsap.delayedCall(2, () => { if (runtime.state === 'BREATHING') sm.go('EXPLORATION') })
        }
        if (ok) {
            // Niveles de ansiedad (failStreak = glitch): -1 antes del sismo y tras el final bueno · 0 después del sismo · 1 alucinaciones (edificios que caen, cosas que no existen)
            // · 2 personas fantasma · 3 final negativo. Perder sube un nivel; ganar baja SOLO uno (si ibas en 2, quedas en 1, no en 0)
            runtime.successful++; runtime.failStreak = Math.max(0, (runtime.failStreak || 0) - 1); runtime.glitch = runtime.failStreak; runtime.asustada = false
            gsap.to(runtime, { anxiety: (bus ? B.baseline : C.baseline) + 0.2 * runtime.failStreak, duration: 1.5 }) // con nivel 1 o 2 la ansiedad no vuelve del todo a la calma
            gsap.to(runtime, { envProgress: Math.min(1, runtime.envProgress + CONFIG.env.successGain), duration: 3 })
            if (bus && runtime.postQuake && ++busWins >= busGoal) { sm.go('CALM'); return void gsap.delayedCall(2, () => runtime.space === 'BUS' && rideEnd()) } // aguantaste lo suficiente: el MIO llega a la universidad
            return sm.go('CALM')
        }
        runtime.failures++; runtime.failStreak = (runtime.failStreak || 0) + 1; runtime.glitch = runtime.failStreak; runtime.anxiety = Math.min(1, runtime.anxiety + CONFIG.anxiety.failPenalty); ui.say('Perdiste el ritmo. Sigue, sin prisa.')
        if (runtime.failStreak >= CONFIG.maxFailures) return sm.go('FAILURE')
        if (bus && runtime.postQuake) return void gsap.delayedCall(1.6, () => { if (runtime.state === 'BREATHING') sm.go('BUS_LOST') }) // en el MIO: sigues en el MIO
        gsap.delayedCall(2, () => { if (runtime.state === 'BREATHING') sm.go('EXPLORATION') })
    }
})

// 10. Modo ?debug (sin narrativa): saltar directo a cada mapa con todo lo anterior ya hecho
function jumpTo(map) {
    gsap.globalTimeline.clear(); ui.say(''); ui.hud(true); clearInterval(rumble); breathing.stop(); ui.showBreath(false); ui.hideChoice(); ui.hideEnding(); ui.card(); ui.closeTalk(); mom.setTalking(false); resetFocus(); resetScare()
    runtime.quake = 0; runtime.failures = 0; runtime.failStreak = 0; runtime.successful = 0; runtime.glitch = 0; ui.lineaRestaurar()
    if (map === 'ANNOUNCEMENT') return sm.go('ANNOUNCEMENT')
    if (map === 'ENDING_GOOD' || map === 'ENDING_BAD') return sm.go(map)
    const post = map.endsWith('_POST') || map === 'UNIVERSIDAD'
    startRoutine(post); sm.go('EXPLORATION'); ui.fade(0, 0.3)
    if (map.startsWith('HOUSE')) return wakeUp(0.6)
    // los demás mapas empiezan de pie, vestido y con las cosas recogidas
    skipRoom(); player.standUp(0, 0)
    if (map.startsWith('HOME')) { down = true; return goTo('HOME', SPAWN.subir.x, SPAWN.subir.z, HX) }
    down = momDone = ate = out = true; props.desayuno.mesh.visible = false
    if (map.startsWith('STREET')) goStreet(HOME_DOOR.x, HOME_DOOR.z + 2)
    else if (map === 'UNIVERSIDAD') { busAsked = true; goStreet(W.uniX, W.uniGateZ + 12) }
    else { // dentro del MIO (y el terremoto, que en la historia pasa durante el viaje)
        runtime.rideLeft = post ? B.time : B.calmRide; runtime.nextCrisis = rand(3, 5); busRide = 0; busWins = 0; busTraumaAt = rand(B.traumaMin, B.traumaMax)
        if (post) runtime.anxiety = Math.max(runtime.anxiety, B.startAnxiety)
        goTo('BUS', W.busStartX, 0, W.busInteriorX); runtime.busMoving = true // en modo debug el MIO ya va en marcha
        if (map === 'TERREMOTO') sm.go('QUAKE')
    }
}
function playGame(id) { jumpTo('STREET_POST'); breathing.force(id); sm.go('ANXIETY') } // jugar un minijuego concreto (en la calle, para que también sirva el Earthing)
function forceCrisis() { if (runtime.state === 'EXPLORATION') sm.go('ANXIETY') }
initDebug({ jumpTo, playGame, forceCrisis, resetTutorials: () => seenTutorials.clear() })

// 11. Bucle principal
const clock = new THREE.Clock()
// dibujar: con oclusión ambiental en computador (oclusion.js: rincones y uniones un poco más oscuros); en celular, como siempre
const oclusion = conOclusion() ? crearOclusion(renderer, scene, camera, { radio: 0.6, intensidad: 0.7 }) : null
// en realidad mixta (o su vista previa) se dibuja la maqueta con la cabeza de quien juega como cámara (mr/index.js)
const dibujar = () => mr.vista ? dibujarMR() : oclusion ? oclusion.render() : renderer.render(scene, camera)
const nitida = () => renderSharp(camera, runtime.sharpPlayer && !mr.vista) // (en las gafas no hay segundo lienzo)
if (oclusion) addEventListener('resize', () => oclusion.tamano(innerWidth, innerHeight))
// Más gente cerca, más ansiedad y choques con NPCs = más probabilidad de crisis (el temporizador corre más rápido)
let lastBumps = 0, lastCalms = 0, crowdSaid = -99, crowdHits = 0 // lastCalms: alucinaciones tocadas · crowdHits: choques con gente desde el último "nivel" de ansiedad
const CALMAS = ['Lo tocas... y no hay nada. Estás aquí.', 'No era real. Respiras un poco mejor.', 'Ahí no hay nadie. Tu cuerpo lo entiende.'] // frases al tocar una alucinación
const fragile = () => (runtime.failStreak || 0) >= 2 // con dos minijuegos perdidos seguidos, chocar con alguien basta para una crisis
const crisisMult = () => Math.min(2.5, 1 + npcState.near * 0.35 + runtime.anxiety * 1.5 + (fragile() ? runtime.stress * 2 : 0)) // con tope: si no, rodeada de gente las crisis se encadenaban sin pausa · los choques solo aceleran la crisis si estás frágil
let lastState = '', stateT = 0, breathIdle = 0 // breathIdle: segundos en BREATHING con el minijuego ya terminado (no desde que empezó)
const blockMsg = (t, text) => { if (t - doorMsgT > 2.5) { doorMsgT = t; ui.say(text) } }
function skipRoom() { // ?debug: lo que faltaba en el cuarto se da por hecho
    up = dressed = true; ITEMS.forEach(i => { got.add(i); props[i].mesh.visible = false }); player.setBackpack(true); player.setPijama(false)
}
const onArrow = (r) => player.x > r[0] - 0.15 && player.x < r[1] + 0.15 && player.z > r[2] - 0.15 && player.z < r[3] + 0.15
function doors(t) { // flechas del piso (y el caminito de la calle): pisarlas cambia de espacio si ya hiciste lo necesario; si no, no te deja pasar (en ?debug siempre se puede)
    const sp = runtime.space, here = sp === 'HOUSE' ? [DOORS.cuarto] : sp === 'HOME' ? [DOORS.subir, DOORS.calle] : []
    if (!armed) { armed = !here.some(onArrow); return } // recién llegada: primero tiene que bajarse de la flecha
    if (sp === 'HOUSE' && up && onArrow(DOORS.cuarto)) {
        if (current() === 'puerta' || down) goDown() // (también si vuelves a subir: ya se puede bajar)
        else if (runtime.sandbox) { skipRoom(); goDown() }
        else { armed = false; blockMsg(t, !dressed ? 'Todavía estás en pijama.' : `Te falta ${pending().map(i => NAMES[i]).join(' y ')}.`) } // lo que piensa Gabriela, no una orden
    }
    if (sp === 'HOME' && onArrow(DOORS.calle)) {
        if (current() === 'salida' || out) exitHouse()
        else if (runtime.sandbox) { momDone = ate = true; props.desayuno.mesh.visible = false; exitHouse() }
        else { armed = false; if (t - doorMsgT > 2.5) { doorMsgT = t; ui.aviso(!momDone ? 'Primero saluda a mamá: te está esperando en la cocina.' : !ate ? 'No has desayunado.' : 'No te has despedido de mamá.') } } // (aviso enano, como un diálogo chiquito)
    }
    if (sp === 'HOME' && down && onArrow(DOORS.subir)) goUp() // la flecha de la sala que sube al cuarto
    if (sp === 'STREET' && out && player.z < HOME_DOOR.z + 1.75 && Math.abs(player.x - HOME_DOOR.x) < 0.8) goHome() // al final del caminito: entras a la casa
}
function street(t, dt) {
    const k = endless() // calle eterna
    if (k > 0.6 && !endlessSaid) { endlessSaid = true; ui.say('La calle parece no terminar nunca...') } else if (k < 0.3) endlessSaid = false
    if (!runtime.postQuake) { if (!busy && current() === 'bus' && nearBus(0.9)) boardBus(); return } // caminar hasta el MIO te sube (también en el modo debug)
    if (!auto()) { if (atUniversity(player.x, player.z)) blockMsg(t, 'Llegaste a la universidad (modo debug: el final no se activa).'); return }
    if (runtime.anxiety < C.driftMax) runtime.anxiety += C.drift * dt // incomodidad que va creciendo
    if (!busy && !nearUniversity(player.x, player.z) && (runtime.nextCrisis -= dt * Math.min(CONFIG.street.multMax, crisisMult())) <= 0) { // crisis esporádicas (en la calle se aceleran menos con la gente): a veces empiezan con un edificio que parece moverse
        if (Math.random() < CONFIG.street.scareChance && scare(t)) return
        return sm.go('ANXIETY')
    }
    if (!arrived && atUniversity(player.x, player.z)) return sm.go('ARRIVAL')
    // tocar el MIO: la primera vez pregunta si subir; si dijiste que no, alejarte y volver a caminar hacia él te sube
    if (!nearBus(2)) busAway = true
    if (!busy && !current() && !busDone && !arrived && nearBus(0.9)) { if (!busAsked) askBus(); else if (busAway) { busAway = false; boardBus() } }
}
// Flecha guía: una punta dorada que flota a la altura del pecho de Gabriela y señala hacia el objetivo (en la calle, hacia la universidad).
// Reemplaza los textos de "ve a...": solo aparece cuando el objetivo está lejos. Antes iba pegada al piso y parecía hundirse en el pasto
const guide = new THREE.Group(), guideTip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 12), new THREE.MeshBasicMaterial({ color: 0xf2c063, transparent: true }))
guideTip.rotation.x = Math.PI / 2; guideTip.position.set(0, 1.0, 1.0); guide.add(guideTip); guide.visible = false; scene.add(guide)
function routeDist(x, z) { // cuántos metros del recorrido lleva el personaje (desde la valla del principio)
    let acc = 0, best = Infinity, d = 0
    SEGS.forEach(s => {
        const k = Math.min(s.len, Math.max(0, s.axis === 'x' ? (x - s.x0) * s.dir : (z - s.z0) * s.dir))
        const px = s.axis === 'x' ? s.x0 + k * s.dir : s.x0, pz = s.axis === 'x' ? s.z0 : s.z0 + k * s.dir, e = Math.hypot(x - px, z - pz)
        if (e < best) { best = e; d = acc + k }
        acc += s.len
    })
    return d
}
function routeAhead(x, z, ahead) { // el punto del recorrido que está "ahead" metros por delante de la posición del personaje
    const d = routeDist(x, z)
    return d + ahead >= ROUTE_LEN ? [W.uniX, W.uniGateZ - 10] : routePoint(d + ahead)
}
function guideTarget(c) { // solo en la calle: dentro de la casa bastan la flecha sobre el objetivo y los brillos
    if (runtime.space !== 'STREET') return null
    if (c && c !== 'items' && runtime.space === TASK_SPACE[c]) { const p = props[c], m = p.mark || p.pos; return [m.x, m.z] }
    if (!c && runtime.space === 'STREET' && runtime.postQuake && !arrived) return routeAhead(player.x, player.z, 7)
    return null
}
function updateGuide(c, canAct) {
    const tg = canAct && !player.lying && !player.sitting ? guideTarget(c) : null
    const far = tg && Math.hypot(tg[0] - player.x, tg[1] - player.z) > 3.2
    guide.visible = !!far
    if (!far) return
    guide.position.set(player.x, 0, player.z); guide.rotation.y = Math.atan2(tg[0] - player.x, tg[1] - player.z)
    guideTip.position.z = 1.0 + 0.12 * Math.sin(clock.elapsedTime * 4) // se mueve un poco hacia adelante, como empujando
    guideTip.material.opacity = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 4)
}

// Barra de progreso (solo después del sismo, ya fuera de la casa): cuánto del camino a la universidad llevas, a pie o en el MIO.
// Nunca baja: volver a la casa no le quita lo avanzado
let progressMax = 0, routeStart = null
function updateProgress() {
    if (!runtime.postQuake || !out) { progressMax = 0; return ui.progress(null) }
    routeStart ??= routeDist(HOME_DOOR.x, HOME_DOOR.z + 2) // el camino empieza en la puerta de la casa
    const span = ROUTE_LEN - routeStart, along = (d) => Math.min(1, Math.max(0, (d - routeStart) / span))
    let p = 0
    if (arrived) p = 1
    else if (runtime.space === 'BUS') p = along(BUS_D0 + Math.min(1, busWins / busGoal) * (ROUTE_LEN - BUS_D0 - 10))
    else if (runtime.space === 'STREET') p = along(routeDist(player.x, player.z))
    progressMax = Math.max(progressMax, p)
    ui.progress(progressMax)
}

const extraMarks = [0, 1, 2].map(() => { const m = marker.clone(); m.visible = false; marker.parent.add(m); return m }) // flechitas extra (mismo dibujo que el marcador)

const tick = () => {
    // (setAnimationLoop: el mismo bucle sirve en la pantalla y en las gafas, que piden los cuadros a su propio ritmo)
    try { frame() } catch (e) { console.error(e) }
}
let juegoT = 0 // tiempo del juego (no corre en pausa)
const frame = () => {
    // en pausa (salida rápida o un pop-up) TODO se detiene: solo se vuelve a dibujar el mismo cuadro. Antes el reloj seguía y Gabriela,
    // la gente, las fallas y el temblor de la cámara se seguían moviendo (el audio y GSAP ya se pausaban en ui.js)
    if (runtime.paused) { clock.getDelta(); ui.updateOverlay(); dibujar(); nitida(); return }
    const dt = Math.min(clock.getDelta(), 0.1)
    if (runtime.postQuake && up && runtime.space === 'HOUSE' && runtime.state === 'EXPLORATION' && !busy && (houseT += dt) > 35) momCheck('cuarto') // 35 s en el cuarto: mamá pregunta desde abajo
    const t = (juegoT += dt), sp = runtime.space, explore = dt > 0 && runtime.state === 'EXPLORATION'
    // Gente cerca (después del sismo): la ansiedad sube mientras estés rodeada y cada choque la dispara y sacude la cámara
    const crowd = runtime.postQuake && auto() && explore && !busy && (sp === 'STREET' || sp === 'BUS')
    // mecánica secreta: tocaste una alucinación y no había nada (npcs.js ya bajó un poco la ansiedad)
    if (npcState.calms !== lastCalms) { lastCalms = npcState.calms; ui.say(CALMAS[npcState.calms % CALMAS.length]); audio.blip(523, 0.4, 0.05) }
    if (npcState.bumps !== lastBumps) {
        lastBumps = npcState.bumps
        if (crowd) {
            runtime.stress = Math.min(1, runtime.stress + 0.5); runtime.anxiety = Math.min(1, runtime.anxiety + 0.08); audio.blip(90, 0.2, 0.12, 'square'); haptics.buzz(60)
            if (fragile() && !busy && stateT > 6) sm.go('ANXIETY') // frágil (2 perdidos seguidos): el choque dispara la crisis en el acto
            else if (++crowdHits >= 7) { // siete choques: sube un nivel de ansiedad, como al perder un minijuego (pero no cuenta para el final negativo)
                crowdHits = 0; if (runtime.failStreak < 2) { runtime.failStreak++; runtime.glitch = runtime.failStreak } // sube un nivel, pero los choques nunca llevan al final negativo
                runtime.anxiety = Math.min(1, runtime.anxiety + CONFIG.anxiety.failPenalty); haptics.buzz([120, 60, 200])
                ui.say('Demasiados golpes... el cuerpo se pone en alerta.')
            }
        }
    }
    if (crowd && npcState.near >= 2) {
        runtime.anxiety = Math.min(0.9, runtime.anxiety + 0.02 * npcState.near * dt)
        if (npcState.near >= 3 && t - crowdSaid > 14) { crowdSaid = t; ui.say('Hay demasiada gente cerca... se te acelera el pecho.') }
    }
    runtime.stress = Math.max(0, runtime.stress - 0.08 * dt)
    if (explore && !busy) doors(t)
    if (explore && runtime.space === sp) {
        if (sp === 'BUS') {
            if (!busy) {
                if (!runtime.postQuake) { if (auto() && runtime.busMoving && (runtime.rideLeft -= dt) <= 0) sm.go('QUAKE') } // viaje normal: el sismo llega durante el trayecto
                // bajarse por una de las puertas (flechas del piso): salir del MIO alivia. La ansiedad que había subido en el viaje vuelve a la de la
                // calle (detrás del fundido): si no, la paleta de ansiedad hacía que la calle se viera de otro color al bajarse
                else if (!player.sitting && player.z > 1.45 && BUS_DOORS.some(([a, b]) => player.x > a && player.x < b)) { busDone = true; transition(() => { leaveBus(); gsap.killTweensOf(runtime, 'anxiety'); runtime.anxiety = runtime.visAnx = Math.min(runtime.anxiety, 0.1) }) }
                else if (runtime.busMoving && auto()) { // viaje con ansiedad: primero el frenón y después crisis seguidas hasta llegar (o hasta perder una)
                    if (runtime.anxiety < B.driftMax) runtime.anxiety += B.drift * dt
                    runtime.rideLeft -= dt
                    if (!braked) { if ((busRide += dt) >= busTraumaAt) busTrauma() }
                    else if (runtime.rideLeft <= 0) rideEnd() // (respaldo: el viaje termina normalmente al ganar busGoal minijuegos)
                    else if ((runtime.nextCrisis -= dt * Math.min(2.2, crisisMult() * B.closed)) <= 0) crisisAdentro(t)
                }
            }
        } else if (sp === 'HOUSE' || sp === 'HOME') { // en el cuarto la crisis la dispara una acción al azar (maybeHouseCrisis); en la planta baja, el tiempo
            if (runtime.postQuake && up && !busy && auto()) { if (runtime.anxiety < C.driftMax) runtime.anxiety += C.drift * dt; if (sp === 'HOME' && (runtime.nextCrisis -= dt * crisisMult()) <= 0) crisisAdentro(t) }
        } else if (sp === 'STREET') street(t, dt)
    }
    // Objetivo: brilla, tiene el marcador encima y la flecha guía apunta hacia él
    const c = current(), target = c && c !== 'items' && c !== 'cama' ? props[c] : null, canAct = runtime.state === 'EXPLORATION' && !busy
    marker.visible = canAct && !!target && runtime.space === TASK_SPACE[c]
    if (target) { const m = target.mark || { x: target.pos.x, y: 2.6, z: target.pos.z }; marker.position.set(m.x, m.y + Math.sin(t * 4) * 0.15, m.z) }
    const glowing = (id) => canAct && (c === id ? runtime.space === TASK_SPACE[c] : c === 'items' && runtime.space === 'HOUSE' && pending().includes(id))
    for (const id in props) if (props[id].glow) props[id].glow.visible = glowing(id)
    // después del sismo el MIO brilla suave cuando pasas cerca (es opcional: puedes subirte)
    if (runtime.postQuake && !current()) props.bus.glow.visible = canAct && runtime.space === 'STREET' && !busDone && props.bus.mesh.visible && dist('bus') < 5
    SEATS.forEach(s => { s.glow.visible = canAct && runtime.space === 'BUS' && !player.sitting && !s.taken }) // bancas libres: te puedes sentar
    busExits.visible = canAct && runtime.space === 'BUS' && runtime.postQuake && !player.sitting && runtime.busMoving // de pie después del sismo: las puertas por donde bajarte
    // flechita encima de todo lo que brilla (además del objetivo principal, que ya tiene la suya): celular, maleta, el MIO...
    let em = 0
    for (const id in props) { const p = props[id]; if (id === c || !p.glow?.visible || !p.mark) continue
        const m = extraMarks[em++]; if (!m) break; m.visible = true; m.position.set(p.mark.x, p.mark.y + Math.sin(t * 4 + em) * 0.15, p.mark.z) }
    for (; em < extraMarks.length; em++) extraMarks[em].visible = false
    updateGuide(c, canAct)
    updateProgress()
    // Línea de tiempo: Despertar → Vestirse → Coger tus cosas → Desayunar → Salir → (antes del sismo) Coger MIO → Ir a la Universidad
    const STEP = { cama: 0, armario: 1, items: 2, puerta: 3, mama: 3, desayuno: 3, salida: 4, bus: 5 }, pre = !runtime.postQuake
    const steps = ['Despertar', 'Vestirse', 'Coger tus cosas', 'Desayunar', 'Salir', ...(pre ? ['Coger MIO'] : []), 'Ir a la Universidad']
    ui.timeline(steps, arrived ? steps.length : pre && runtime.space === 'BUS' ? 6 : c ? STEP[c] : steps.length - 1)
    if (runtime.space === 'BUS' && !runtime.busMoving && !player.sitting && runtime.state === 'EXPLORATION' && !busy) { // guía: la banca libre más cercana
        const s = SEATS.filter(s => !s.taken).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0]
        if (s) { marker.visible = true; marker.position.set(s.x, 2.1 + Math.sin(t * 4) * 0.15, s.z) }
    }
    breathing.update(dt); player.update(dt, t); updateNpcs(dt, t); updateAnxiety(dt); updateEnvironment(dt, player.x, player.z)
    // Cámara: fija dentro de la casa y del MIO; en la calle sigue al personaje (también cuando la calle gira)
    const s2 = runtime.space
    if (runtime.vistaMapa) updateCamera(t, dt, runtime.vistaMapa.x, runtime.vistaMapa.z) // (debug: la calle entera vista desde arriba)
    else if (focus === 'player' || runtime.zoomJugador) updateCamera(t, dt, player.x, player.z) // (zoomJugador: Reconstruir la gravedad se acerca a Gabriela)
    else if (focus) updateCamera(t, dt, focus.x, focus.z)
    else if (s2 === 'STREET' && breathing.active && runtime.techId === 'earth') updateCamera(t, dt, player.x + 1.8, player.z + 1.8) // Earthing: Gabriela queda arriba del medidor y nunca la tapa
    else if (s2 === 'HOUSE') updateCamera(t, dt, W.houseCenterX, 0)
    else if (s2 === 'HOME') updateCamera(t, dt, HX - 0.9, -0.55) // un poco hacia el fondo: así la pared de atrás no se corta arriba (y el frente, más hondo, tampoco abajo)
    else if (s2 === 'BUS') updateCamera(t, dt, W.busInteriorX, 0)
    else updateCamera(t, dt, ...streetCam(player.x, player.z))
    ui.updateBreath(); ui.updateOverlay(); audio.update(dt, runtime.anxiety)
    dibujar(); nitida()
    // Seguro anti-trabas: si un estado transitorio se queda pegado, se recupera solo
    if (runtime.state !== lastState) { lastState = runtime.state; stateT = 0 } else stateT += dt
    breathIdle = runtime.state === 'BREATHING' && !breathing.active ? breathIdle + dt : 0
    if (breathIdle > 4) sm.go('EXPLORATION')
    if (runtime.state === 'ANXIETY' && stateT > 4) sm.go(runtime.techId === 'earth' && runtime.space === 'BUS' ? 'BUS_EARTH' : 'BREATHING')
    if (runtime.state === 'CALM' && stateT > 5) sm.go('EXPLORATION')
    if (runtime.state === 'FAILURE' && stateT > 6) sm.go('ENDING_BAD')
}

// 12. Inicio: con ?debug se entra directo al cuarto sin la historia; si no, empieza la narrativa
addEventListener('pointerdown', initAudio, { once: true }); addEventListener('keydown', initAudio, { once: true })
// primero se elige cómo jugar (gafas o vista previa): entrar a las gafas necesita un clic
elegirModo().then(() => { if (runtime.sandbox) { player.cargarModelo(); jumpTo('HOUSE_PRE') } else sm.go('INTRO') })
renderer.setAnimationLoop(tick)