// Indice
    // 0. Imports
    // 1. Modelo del personaje
    // 2. Poses (caminar, sentada, acostada, miedo)
    // 3. Controles
    // 4. API pública (player)

// 0. Imports
import * as THREE from 'three'
import { crearPersonaje, saltoSusto, SALTO } from './personaje.js'
import { scene } from './scene.js'
import { CONFIG, runtime, CAPA_PROTA } from './config.js'
import { walkable, pullBack, endless, BED_LIE, SEAT_Y, bagModel, sueloCalle } from './environment.js'
let seatY = SEAT_Y, enMesa = false, conMaleta = false // altura del asiento (bancas del MIO o silla del comedor) · sentada a la mesa · lleva la maleta

// 1. Modelo del personaje: assets/protagonista/Personaje.fbx (y Personaje_Oscuro.fbx para el nivel 3 de ansiedad), con el
//    esqueleto y las poses de personaje.js
const group = new THREE.Group()
const ALTO = 1.8 // alto del personaje en el juego
// Mientras carga el modelo se ve una figura simple (lo mismo que había antes)
const temp = new THREE.Group()
{
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x8296b7 })); body.position.y = 0.6
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe3d0b5 })); head.position.y = 1.5
    temp.add(body, head)
}
// Maleta a la espalda: aparece cuando la recoges en el cuarto (el frente del personaje es su +z, la espalda su -z).
// Es la misma maleta del modelo del cuarto (Cuarto.fbx), centrada y un poco más pequeña; las correas pasan por los hombros
const backpack = new THREE.Group(); backpack.visible = false
const correas = [] // las correas (se esconden cuando la maleta va sobre las piernas)
{
    // Correas: tubos que salen de arriba de la maleta, pasan por encima del hombro, bajan por el pecho y vuelven por debajo del brazo
    // hasta la base de la maleta (antes eran dos palitos rectos)
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x4f5f54, roughness: 0.9 })
    ;[-1, 1].forEach(l => {
        const x = 0.115 * l
        const curva = new THREE.CatmullRomCurve3([
            [x * 0.9, 0.98, -0.26], [x * 0.95, 1.05, -0.12], [x, 1.07, 0.0], [x * 1.05, 1.0, 0.115], [x * 1.15, 0.88, 0.125], [x * 1.45, 0.78, 0.09], [x * 1.65, 0.73, -0.02], [x * 1.55, 0.7, -0.16], [x * 1.25, 0.68, -0.26]
        ].map(([px, py, pz]) => new THREE.Vector3(px, py, pz)))
        const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 40, 0.017, 6, false), strapMat) // más delgadas y a ras del cuerpo
        backpack.add(tubo); correas.push(tubo)
    })
    bagModel.then(({ geometry, material }) => {
        const g = geometry.clone(); g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z)
        const grado = THREE.MathUtils.degToRad; g.rotateY(grado(13)); g.rotateX(grado(3)); g.rotateZ(grado(-2)) // en el cuarto la maleta está un poco girada sobre la cama: derecha, no se ve ladeada en la espalda
        const m = new THREE.Mesh(g, material); m.scale.set(1.05, 0.72, 0.85); m.position.set(0, 0.8, -0.38); m.rotation.y = Math.PI; m.layers.set(CAPA_PROTA); backpack.add(m) // más ancha que alta (antes se veía muy flaquita) · el bolsillo mira hacia afuera
    })
}
group.add(temp, backpack); scene.add(group)
group.traverse(o => o.layers.set(CAPA_PROTA)) // capa propia: en el nivel 3 de ansiedad se dibuja nítida sobre el mundo borroso
group.position.set(CONFIG.player.startX, 0, CONFIG.player.startZ)

// El modelo se carga cuando main.js lo pide (player.cargarModelo): armarlo toma un momento y, si pasaba al abrir la página, trababa la
// tarjeta de "10 de agosto". La versión oscura se carga solo cuando hace falta (nivel 3 de ansiedad). La de pijama (main.js: desde que se
// despierta hasta que se viste en el armario) se carga con la normal: el día empieza con ella
const prota = crearPersonaje(ALTO, { normal: 'assets/protagonista/Personaje.fbx', oscuro: 'assets/protagonista/Personaje_Oscuro.fbx', pijama: 'assets/protagonista/Personaje_pijama.fbx' }, (clave, cont) => {
    cont.traverse(o => o.layers.set(CAPA_PROTA)); if (clave === 'normal') temp.visible = false
})
group.add(prota.grupo)

// 2. Poses: ver personaje.js (de pie, caminar, sentada, acostada, miedo)
let susto = 0, andar = 0, correr = 0, fase = 0 // cuánto susto, cuánto camina y cuánto corre (0 → 1, suavizados) · fase del paso
let gesto = null // coger algo: { t, dur, alMedio, alFinal } (player.coger)
let comiendo = false // desayunando (player.comer)
let salto = null // sobresalto: { t, x0, z0, dx, dz } (player.sobresalto)
let trasSalto = 0 // después de caer se queda quieta un momento (mirando) antes de la pose de miedo
let quieta = 0; const DEMORA = 20 // segundos sin moverse (explorando): si te demoras mucho, se le salen las lágrimas
const PISO = { HOUSE: 0.03, HOME: 0.02, BUS: 0.005, STREET: 0 } // altura del piso de cada espacio (medida en los modelos): antes se hundía en el cuarto y la sala

// Acostada sobre la cama (la cama está contra la pared del fondo; la cabeza va hacia la almohada)
const LIE = BED_LIE

// 3. Controles: WASD o el joystick táctil (touch.js lo escribe en runtime.joyX / joyY)
const keys = new Set()
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear())
const down = (...c) => c.some(k => keys.has(k))

// 4. API pública (player)
let mode = 'free' // free | stop | agitated | guided | calm
let lying = false, sitting = false, seatLocked = false // seatLocked: antes del sismo, una vez sentada en el MIO no se levanta
let enPijama = true
let abrazando = false, abrazo = 0 // abrazo con mamá: 0 → 1 (suave al entrar y al salir)
let paseando = false
export const player = {
    group,
    setMode(m) { mode = m },
    setBackpack(v) { conMaleta = v; backpack.visible = v }, // maleta a la espalda
    cargarModelo() { return Promise.all([prota.cargar('normal'), prota.cargar('pijama')]) }, // devuelve una promesa (main.js espera el modelo antes de la tarjeta "10 de agosto")
    setPijama(v) { enPijama = v }, // con pijama (antes de vestirse) o con la ropa del día
    abrazar(v) { abrazando = v }, // abrazo con mamá (main.js, al despedirse antes de salir)
    paseo(v) { paseando = v }, // camina sin que la mueva el teclado (main.js mueve su posición)
    // gesto de coger algo en (x, z): se voltea hacia el objeto, estira la mano y lo recoge. alMedio: cuando la mano llega · alFinal: al terminar
    coger(x, z, alMedio, alFinal) {
        const r = group.rotation, want = Math.atan2(x - group.position.x, z - group.position.z)
        r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y))
        gesto = { t: 0, dur: 1.1, medio: false, alMedio, alFinal }
    },
    get cogiendo() { return !!gesto },
    // sobresalto: algo se movió en (x, z) (un edificio en la calle). Como un gato asustado, da un salto hacia atrás para alejarse, sin dejar de
    // mirarlo. Salta lo que deje el piso (hasta 1.1 m): si atrás hay un muro, salta menos
    sobresalto(x, z) {
        const p = group.position; let dx = p.x - x, dz = p.z - z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n
        group.rotation.y = Math.atan2(-dx, -dz)
        let d = 1.1; while (d > 0.2 && !walkable(p.x + dx * d, p.z + dz * d)) d -= 0.15
        salto = { t: 0, x0: p.x, z0: p.z, dx: dx * Math.max(0, d), dz: dz * Math.max(0, d), y: 0 }
    },
    get saltando() { return !!salto },
    comer(v) { comiendo = v }, // la animación de comer (mientras dura el desayuno)
    prota, // (debug: el visor de la protagonista usa sus poses)
    // acostada de lado (encogida), con la cabeza en la almohada (-z) y mirando hacia +x: donde iría la pared junto a la cama.
    // Orden ZYX: primero se acuesta boca arriba (giro en x) y después rueda sobre su costado (giro en z)
    lieDown() { lying = true; sitting = false; group.rotation.set(-Math.PI / 2, 0, -Math.PI / 2, 'ZYX'); group.position.set(LIE.x, LIE.y, LIE.z) },
    // sentada: un poco hacia el frente del cojín, para que las rodillas pasen el borde y las piernas no se metan en la silla
    sit(s, lock = false) { sitting = true; seatLocked = lock; seatY = s.y ?? SEAT_Y; enMesa = !!s.mesa; group.rotation.set(0, s.face, 0, 'XYZ'); const ad = s.adelante ?? 0.1; group.position.set(s.x + Math.sin(s.face) * ad, seatY, s.z + Math.cos(s.face) * ad) },
    unsit(a) { if (!sitting) return; sitting = false; seatLocked = false; a ? group.position.set(a.x, 0, a.z) : group.position.set(group.position.x, 0, 0.25) }, // queda de pie donde se diga (o en el pasillo del MIO, frente al asiento)
    get seatLocked() { return seatLocked },
    get sitting() { return sitting },
    standUp(x, z) { lying = false; group.rotation.set(0, 0, 0, 'XYZ'); group.position.set(x, 0, z) },
    get lying() { return lying },
    get x() { return group.position.x }, set x(v) { group.position.x = v },
    get z() { return group.position.z }, set z(v) { group.position.z = v },
    update(dt, t) {
        let s = 1, moving = paseando // (paseando: main.js la lleva caminando, p. ej. hasta mamá para abrazarla)
        let ix = (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0) // solo WASD (las flechas no: no están en los controles)
        let iy = (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0), push = 1
        const jm = Math.hypot(runtime.joyX, runtime.joyY) // joystick táctil: la dirección es libre y empujarlo poco camina más lento
        if (jm > 0.2) { ix = runtime.joyX; iy = runtime.joyY; push = Math.min(1, 0.35 + jm * 0.9) }
        if (sitting && !seatLocked && (ix || iy)) this.unsit() // al moverte te levantas (salvo en el viaje de antes del sismo)
        if (sitting && runtime.tambaleo !== undefined) this.unsit() // Reconstruir la gravedad se juega de pie (en el MIO se quedaba sentada)
        if (mode === 'free' && !lying && !sitting) {
            if (ix || iy) {
                const n = Math.hypot(ix, iy), a = THREE.MathUtils.degToRad(CONFIG.camera.azimuth)
                // teclado: alineado con las calles (una tecla = una calle, sin tener que apretar dos) · joystick: relativo a la pantalla (arrastrar hacia arriba = subir en la pantalla)
                const rel = jm > 0.2 || CONFIG.player.screenRelative
                const vx = rel ? (ix * Math.cos(a) - iy * Math.sin(a)) / n : ix / n
                const vz = rel ? (-ix * Math.sin(a) - iy * Math.cos(a)) / n : -iy / n
                // calle eterna: con mucha ansiedad caminas igual, pero avanzas menos
                const slow = runtime.space === 'STREET' ? 1 - CONFIG.street.slow * endless() : 1
                const fast = 1 + CONFIG.player.anxSpeed * (runtime.visAnx ?? runtime.anxiety) // con más ansiedad camina más rápido (apurada)
                const sp = CONFIG.player.speed * slow * fast * push * dt, p = group.position
                if (walkable(p.x + vx * sp, p.z + vz * sp)) { p.x += vx * sp; p.z += vz * sp }
                else if (walkable(p.x + vx * sp, p.z)) p.x += vx * sp
                else if (walkable(p.x, p.z + vz * sp)) p.z += vz * sp
                group.rotation.y = Math.atan2(vx, vz)
                moving = true
            }
        }
        // Pose: acostada · sentada · caminando · asustada (en la crisis, al fallar o con mucha ansiedad) · de pie
        andar += ((moving ? 1 : 0) - andar) * Math.min(1, dt * 8)
        // con ansiedad camina apurada, casi corriendo (como en la referencia de carrera): de ansiedad 0.4 a 0.85
        const apuro = Math.min(1, Math.max(0, ((runtime.visAnx ?? runtime.anxiety) - 0.4) / 0.45))
        correr += ((moving ? apuro : 0) - correr) * Math.min(1, dt * 3)
        if (moving) fase += dt * (8.5 + 4 * correr) // el paso se acelera con la carrera
        // coger algo: el gesto dura gesto.dur s; a la mitad (cuando la mano llega) pasa alMedio
        if (gesto) {
            gesto.t += dt
            if (!gesto.medio && gesto.t >= gesto.dur * 0.5) { gesto.medio = true; gesto.alMedio?.() }
            if (gesto.t >= gesto.dur) { const fin = gesto.alFinal; gesto = null; fin?.() }
        }
        // asustada: desde que empieza la crisis hasta que se gana el minijuego (runtime.asustada lo maneja main.js), con un susto o con mucha ansiedad
        const asustada = !lying && !sitting && !moving && !salto && !(trasSalto > 0) && (runtime.asustada || mode === 'agitated' || runtime.state === 'FAILURE' || (mode !== 'calm' && runtime.anxiety > 0.75))
        susto += ((asustada ? 1 : 0) - susto) * Math.min(1, dt * 5)
        if (salto) { // sobresalto: el cuerpo va hacia atrás y sube y baja con el salto
            salto.t += dt; const p = salto.t / SALTO, j = saltoSusto(p)
            group.position.x = salto.x0 + salto.dx * j.atras; group.position.z = salto.z0 + salto.dz * j.atras; salto.y = j.y
            prota.pose('sobresalto', t, p)
            if (p >= 1) { salto = null; trasSalto = 0.7 }
        } else if (trasSalto > 0) { trasSalto -= dt; prota.pose('quieta', t) } // la pausa: quieta, todavía mirando lo que la asustó
        else if (runtime.tambaleo !== undefined && !lying && !sitting) { // Reconstruir la gravedad (gravedad.js): de frente a la cámara, tambaleándose hacia donde se cae
            group.rotation.y = THREE.MathUtils.degToRad(CONFIG.camera.azimuth); group.rotation.z = -runtime.tambaleo * 0.15
            prota.pose('tambaleo', t, runtime.tambaleo)
        }
        else if ((abrazo += ((abrazando ? 1 : 0) - abrazo) * Math.min(1, dt * 4)) > 0.01) prota.pose('abrazar', t, abrazo)
        else if (gesto) prota.pose('coger', t, gesto.t / gesto.dur)
        else if (comiendo) prota.pose(sitting ? 'comerSentada' : 'comer', t) // en la mesa come sentada
        else prota.pose(lying ? 'acostada' : sitting ? 'sentada' : andar > 0.05 ? 'caminar' : susto > 0.05 ? 'miedo' : 'quieta', andar > 0.05 ? fase : t, andar > 0.05 ? andar : susto, correr)
        if (runtime.tambaleo === undefined && !lying && group.rotation.z !== 0) group.rotation.z = 0 // terminó el tambaleo: vuelve a quedar derecha
        // Cara (personaje.js, EXPRESIONES): acostada, siempre con los ojos cerrados (antes del sismo tranquila; después, con lágrimas) · con un
        // susto, en un minijuego o al fallar, asustada (parpadea con los parpadeos ansiosos 1 y 2) · si te demoras mucho quieta, con lágrimas ·
        // antes del sismo y en el final bueno, la normal · después del sismo, según el nivel de ansiedad (0, 1, 2 o 3, el de la espiral)
        const nivel = runtime.levelVis ?? -1
        quieta = moving || runtime.state !== 'EXPLORATION' ? 0 : quieta + dt
        if (lying || abrazo > 0.3) prota.expresion(runtime.postQuake ? 'parpadeoLagrimas' : 'parpadeo2') // (abrazando a mamá también cierra los ojos)
        else if (salto || susto > 0.5 || ['BREATHING', 'FAILURE', 'QUAKE'].includes(runtime.state)) prota.expresion('susto', ['parpadeoAnsioso1', 'parpadeoAnsioso2'])
        else if (quieta > DEMORA) prota.expresion('susto', 'parpadeoLagrimas')
        else if (nivel < 0) prota.expresion('normal', 'parpadeo')
        else if (nivel < 0.75) prota.expresion('normalPost', 'parpadeo')
        else if (nivel < 1.75) prota.expresion('nivel1', 'parpadeoAnsioso1')
        else if (nivel < 2.75) prota.expresion('nivel2', 'parpadeoAnsioso2')
        else prota.expresion('nivel3', 'parpadeoAnsioso2')
        prota.aplicar(dt, salto ? 22 : 10) // el salto es rápido: los huesos siguen la pose sin retraso
        const oscuro = (runtime.levelVis ?? -1) > 2.75 // nivel 3 de ansiedad: la versión oscura del modelo (como el resto de los modelos)
        if ((runtime.levelVis ?? -1) > 2) prota.cargar('oscuro') // se prepara un poco antes de necesitarla
        const { normal, oscuro: osc, pijama } = prota.versiones, cual = oscuro && osc ? osc : enPijama && pijama ? pijama : normal // (con pijama también; la oscura gana en el nivel 3)
        ;[normal, osc, pijama].forEach(v => { if (v) v.visible = v === cual })
        if (!lying && !sitting) {
            const q = group.position, f = pullBack(q.x, q.z)
            if (f) { const dx = f.x - q.x, dz = f.z - q.z, d = Math.hypot(dx, dz), st = Math.min(d, 4 * dt); if (d > 1e-6) { q.x += dx / d * st; q.z += dz / d * st } }
        }
        if (mode === 'guided') s = 1 + runtime.breathProgress * 0.06 // en la respiración el cuerpo se infla un poco al inhalar (el temblor de la ansiedad ahora es la pose asustada)
        else if (mode === 'calm') s = 1 + Math.sin(t * 1.5) * 0.015
        group.scale.setScalar(s)
        if (lying) group.position.set(LIE.x - 0.05, LIE.y + 0.2 + Math.sin(t * 1.5) * 0.008, LIE.z) // (+0.2: de lado, el hombro queda sobre el colchón, no metido en él)
        else if (sitting) group.position.y = seatY - 0.46 // la cadera queda sobre el cojín (las piernas, dobladas hacia el frente)
        // de pie, caminando, con miedo o saltando: el cuerpo se apoya en la suela más baja de la pose de este cuadro (prota.piso). Antes era una
        // fórmula fija del paso (alturaPaso) y al caminar los zapatos se metían hasta 4 cm en el piso. En el salto se suma el arco del aire
        else group.position.y = (runtime.space === 'STREET' ? sueloCalle(group.position.x, group.position.z) : PISO[runtime.space] ?? 0) + 0.002 - prota.piso() + Math.max(0, salto?.y ?? 0)
        // sentada, la maleta va sobre las piernas (en la espalda atravesaba el espaldar de la silla)
        backpack.position.set(0, sitting ? -0.14 : 0, sitting ? 0.66 : 0); correas.forEach(c => { c.visible = !sitting })
        backpack.visible = conMaleta && !(sitting && enMesa) // sentada a la mesa no tiene la maleta en las piernas (en el MIO sí)
    }
}