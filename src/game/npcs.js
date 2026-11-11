// Indice
    // 0. Imports
    // 1. Estado y modelo del NPC
    // 2. Creación de NPCs
    // 3. Mamá
        // 3.1 Personas que no existen (glitch)
    // 4. Movimiento y choques

// 0. Imports
import * as THREE from 'three'
import { spaces, walkableIn, SEATS, SEAT_Y, MOM_SPOT, DRIVER_SEAT, STREET_X0, SEGS, ROUTE_LEN, routePoint, GHOSTS } from './environment.js'
import { CONFIG, runtime } from './config.js'
import { player } from './player.js'
import { crearExtras, alturaPaso, crearPersonaje, hojaDe } from './personaje.js'

// 1. Estado y modelo del NPC
export const npcState = { near: 0, bumps: 0, calms: 0 } // near = gente cerca del personaje · bumps = choques acumulados · calms = alucinaciones tocadas
const bodyG = new THREE.ConeGeometry(0.42, 1.3, 12), headG = new THREE.SphereGeometry(0.38, 14, 10), eyeG = new THREE.SphereGeometry(0.075, 8, 6)
// Las personas son los modelos de assets/npc (tres variantes: Extra1, Extra2 y Extra3), siluetas negras con el mismo cuerpo de Gabriela
// y su mismo esqueleto (personaje.js, crearExtras): caminan, esperan de pie o van sentadas con las mismas poses que ella.
// g.userData.head: el giro extra de la cabeza (en el sismo la mueven de un lado a otro; después del sismo te miran). Se suma al hueso
// de la cabeza después de la pose. Mientras cargan los modelos no se ve nadie (cargan al abrir la página, antes de llegar a la calle)
const EXTRAS = crearExtras(1.8, ['assets/npc/Extra1.fbx', 'assets/npc/Extra2.fbx', 'assets/npc/Extra3.fbx'])
let variante = 0
const make = () => {
    const g = new THREE.Group(), v = variante++ % 3; g.userData.head = new THREE.Object3D()
    EXTRAS.listo.then(() => { const rig = EXTRAS.nueva(v); if (!rig) return; g.add(rig.cont); g.userData.rig = rig })
    return g
}

// 2. Creación de NPCs: peatones (en las dos calles), gente en el paradero, pasajeros sentados y conductor
const r = (a, b) => a + Math.random() * (b - a)
const npcs = [], R = 0.85 // R = distancia mínima entre centros
export const npcList = npcs // (solo para revisar desde la consola con ?debug)
const add = (o) => { o.g.userData.n = o; o.parent.add(o.g); npcs.push({ vx: 0, vz: 0, cool: 0, t: 0, state: 'walk', ...o }) }
const ROUTES = SEGS.map((s, i) => { // uno por tramo de la calle · axis = eje por el que caminan · lanes = carriles · min/max = tramo que recorren
    const c = s.axis === 'x' ? s.z0 : s.x0, [a, b] = s.axis === 'x' ? [Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)] : [Math.min(s.z0, s.z1), Math.max(s.z0, s.z1)]
    return { axis: s.axis, lanes: [c - 2.0, c - 1.0, c + 1.0, c + 2.0], // carriles lejos del borde: contra el borde no podían separarse y se fusionaban
             min: (i === 0 ? STREET_X0 : a) + 2, max: b - 2 }
})
const BUS_X = CONFIG.world.busX
for (let i = 0; i < CONFIG.npcs.street; i++) {
    const u = (i + 0.5) / CONFIG.npcs.street, d = (1 - (1 - u) ** 1.8) * ROUTE_LEN, si = SEGS.indexOf(routePoint(d)[2]) // repartidos por todo el recorrido, más apretados cerca de la universidad
    let route = ROUTES[si]
    if (si === 0 && route.lanes[i % 4] < 0) route = d < BUS_X - STREET_X0 ? { ...route, max: BUS_X - 3.5 } : { ...route, min: BUS_X + 8.5 } // del lado del MIO no lo cruzan: así no te encierran contra el bus
    let x = 0, z = 0
    for (let k = 0; k < 80; k++) { // busca un lugar libre y lejos de los demás, para que dos NPC nunca nazcan fusionados
        const along = r(route.min, route.max), lane = route.lanes[i % 4] + r(-.1, .1)
        ;[x, z] = route.axis === 'x' ? [along, lane] : [lane, along]
        if (walkableIn('STREET', x, z, true) && npcs.every(n => n.sp !== 'STREET' || Math.hypot(n.g.position.x - x, n.g.position.z - z) > 4)) break
    }
    const g = make(); g.position.set(x, 0, z)
    add({ g, parent: spaces.STREET, sp: 'STREET', kind: 'walker', route, dir: Math.random() < 0.5 ? 1 : -1, speed: r(0.7, 1.4), ph: r(0, 6) })
}
;[[-2.4, -3.6], [-1.2, -3.75]].forEach(([dx, z]) => { const g = make(); g.position.set(BUS_X + dx, 0, z); add({ g, parent: spaces.STREET, sp: 'STREET', kind: 'idle', ph: r(0, 6), y: 0 }) }) // esperando el MIO bajo el techo del paradero (fuera de la calle, para no bloquear el paso)
const BX = CONFIG.world.busInteriorX
SEATS.sort(() => Math.random() - 0.5).slice(0, CONFIG.npcs.bus).forEach(s => {
    // un poco hacia el frente del cojín (como Gabriela al sentarse): en el centro, el cuerpo atravesaba el espaldar de las bancas largas
    s.taken = true; const g = make(); const ad = s.adelante ?? 0.1; g.position.set(s.x + Math.sin(s.face) * ad, s.y ?? SEAT_Y, s.z + Math.cos(s.face) * ad); g.rotation.y = s.face
    add({ g, parent: spaces.BUS, sp: 'BUS', kind: 'seated', ph: r(0, 6), y: (s.y ?? SEAT_Y) - 0.46, suelta: Math.random() < 0.8 }) // (como Gabriela sentada: la cadera queda sobre el cojín)
})
{ const g = make(); g.position.set(DRIVER_SEAT.x, SEAT_Y, DRIVER_SEAT.z); g.rotation.y = Math.PI / 2; add({ g, parent: spaces.BUS, sp: 'BUS', kind: 'driver', ph: 0, y: SEAT_Y - 0.46 }) } // conductor, sentado en su puesto del modelo

// 3. Mamá: en la cocina, te mira cuando estás cerca y al hablar asiente y mueve la mano (su colisión está en environment.js).
// Es su modelo (assets/casa/madre) con el esqueleto de Gabriela (personaje.js): el mismo cuerpo base, pero más alta (las piernas y el torso
// más largos; los pares de alturas la ajustan). Sus ojos son un dibujo como los de Gabriela, de su propia hoja: abiertos, parpadeo y
// cerrados (sonriendo: al empezar a hablar antes del sismo). En el nivel más alto de ansiedad cambia a su versión oscura, como todo
const CARAS_MAMA = hojaDe('assets/casa/madre/Caras-madre_Mesa de trabajo 1 copia 3.png', 419, 632, 240, 160, { normal: [90, 18], parpadeo: [90, 234], cerrados: [90, 458] })
export const mom = (() => {
    const g = new THREE.Group()
    const rig = crearPersonaje(1.8, { normal: 'assets/casa/madre/Mama.fbx', oscuro: 'assets/casa/madre/MamaOsc.fbx' }, null, {
        proporciones: [[0, 0], [38, 42], [90, 74], [100, 81], [104, 84], [150, 128]], hoja: CARAS_MAMA, anchoCara: 41 })
    rig.cargar('normal'); g.add(rig.grupo); g.position.set(MOM_SPOT.x, 0, MOM_SPOT.z); spaces.HOME.add(g)
    let talking = false, sonrie = 0, abrazando = false, abrazo = 0 // abrazo: 0 → 1 (suave al entrar y al salir)
    return {
        g,
        setTalking(v) { if (v && !talking && !runtime.postQuake) sonrie = 1.4; talking = v },
        setAbrazo(v) { abrazando = v }, // abrazo con Gabriela (main.js, al despedirse antes de salir)
        update(dt, t) {
            abrazo += ((abrazando ? 1 : 0) - abrazo) * Math.min(1, dt * 4)
            if (abrazo > 0.01) rig.pose('abrazar', t, abrazo, 0.6); else rig.pose(talking ? 'hablar' : 'quieta', t) // (0.6: inclina la cabeza hacia Gabriela, que es más bajita)
            rig.aplicar(dt) // (también fuera de la cocina: el archivo está en T y, si no, al llegar se la veía bajando los brazos)
            if (runtime.space !== 'HOME') return
            const want = Math.atan2(player.x - g.position.x, player.z - g.position.z)
            let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 4)
            sonrie -= dt; const cerrados = sonrie > 0 || abrazo > 0.3 // sonriendo o abrazando: los ojos cerrados
            rig.expresion(cerrados ? 'cerrados' : 'normal', cerrados ? null : 'parpadeo')
            const nivel = runtime.levelVis ?? -1; if (nivel > 2) rig.cargar('oscuro') // como Gabriela (player.js): se prepara un poco antes
            const { normal, oscuro } = rig.versiones; if (normal && oscuro) { normal.visible = nivel <= 2.75; oscuro.visible = nivel > 2.75 }
            rig.grupo.position.y = 0.002 - rig.piso() // apoyada en la suela más baja
        }
    }
})()

// 3.1 Personas que no existen: desde el nivel de falla 2 (dos minijuegos perdidos sin ganar en medio) aparecen siluetas "glitcheadas" alrededor de Gabriela.
//     Titilan, tienen un eco rojo desfasado, se quedan mirándola y desaparecen cuando se acerca (para reaparecer en otro lado)
const phantoms = []
const phantomMats = () => ({ body: new THREE.MeshBasicMaterial({ color: 0x0d0d10, transparent: true, opacity: 0.85 }), eye: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), echo: new THREE.MeshBasicMaterial({ color: 0xd01f2a, transparent: true, opacity: 0.2, depthWrite: false }) })
for (let i = 0; i < 8; i++) {
    const m = phantomMats(), g = new THREE.Group(), hg = new THREE.Group()
    const b = new THREE.Mesh(bodyG, m.body); b.position.y = 0.65; hg.position.y = 1.5; hg.add(new THREE.Mesh(headG, m.body))
    ;[-0.14, 0.14].forEach(x => { const e = new THREE.Mesh(eyeG, m.eye); e.scale.set(1, 1.4, 0.5); e.position.set(x, 0.05, 0.34); hg.add(e) })
    const echo = new THREE.Group(), eb = new THREE.Mesh(bodyG, m.echo), eh = new THREE.Mesh(headG, m.echo); eb.position.y = 0.65; eh.position.y = 1.5; echo.add(eb, eh) // copia roja corrida, como una imagen mal sincronizada
    g.add(b, hg, echo); g.visible = false
    phantoms.push({ g, echo, m, t: 0, space: '' })
}
const phantomCount = () => runtime.postQuake && runtime.glitch >= 2 ? Math.min(phantoms.length, 2 + runtime.glitch * 2) : 0 // nivel de falla 2 o más: más nivel, más personas que no existen (ganar un minijuego baja el nivel)
function placePhantom(p, sp) {
    for (let k = 0; k < 25; k++) { // lejos de Gabriela pero no tanto: en el borde de lo que ve
        const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 5, x = player.x + Math.cos(a) * d, z = player.z + Math.sin(a) * d
        if (!walkableIn(sp, x, z)) continue
        if (p.space !== sp) { spaces[sp].add(p.g); p.space = sp }
        p.g.position.set(x, 0, z); p.t = 2 + Math.random() * 4; return true
    }
    return false
}
// Mecánica secreta: tocar una alucinación (una persona que no existe o una falla de la ciudad) baja un poco la ansiedad: comprobar que no es
// real ayuda a volver al presente. main.js muestra una frase cuando cambia npcState.calms
let calmCool = 0
function calmar() {
    if (calmCool > 0 || runtime.paused) return
    calmCool = 1.5; runtime.anxiety = Math.max(0, runtime.anxiety - 0.1); npcState.calms++
}
function touchGhosts(dt, sp) {
    calmCool = Math.max(0, calmCool - dt)
    for (const g of GHOSTS) {
        if (g.space !== sp || !g.on) continue
        const p = g.m.position, w = g.m.geometry.parameters, rot = Math.abs(g.m.rotation.y) > 0.1, hw = (rot ? w.depth : w.width) / 2 + 0.35, hd = (rot ? w.width : w.depth) / 2 + 0.35
        if (Math.abs(player.x - p.x) < hw && Math.abs(player.z - p.z) < hd) { calmar(); g.calm = performance.now() + 9000; g.on = false; g.m.visible = false }
    }
}
function updatePhantoms(dt, t, sp) {
    touchGhosts(dt, sp)
    const n = sp === 'BUS' ? 0 : phantomCount(); let near = 0
    phantoms.forEach((p, i) => {
        if (i >= n) { p.g.visible = false; return }
        const pos = p.g.position, d = Math.hypot(pos.x - player.x, pos.z - player.z)
        if (d < 0.8 && p.g.visible) calmar() // mecánica secreta: si llegas a tocarla, no había nadie (te calma un poco)
        if (p.space !== sp || (p.t -= dt) <= 0 || d < 0.8) { if (!placePhantom(p, sp)) { p.g.visible = false; return } } // si la tocas, desaparece (antes se iba apenas te acercabas a 2.2 m: no se podía tocar)
        p.g.visible = Math.random() > 0.08                                                     // titila
        p.g.rotation.y = Math.atan2(player.x - pos.x, player.z - pos.z)                       // te mira fijo
        p.echo.position.set(0.22 + Math.sin(t * 31 + i) * 0.12, 0.04, Math.cos(t * 23 + i) * 0.1) // eco desfasado (corrido hacia un lado)
        p.g.scale.y = Math.random() < 0.04 ? 0.6 + Math.random() * 0.8 : 1                    // a veces se estira
        p.m.body.opacity = 0.55 + Math.random() * 0.35
        if (d < 3.5) near++                                                                    // el cuerpo reacciona como si fueran reales
    })
    return near
}

// 4. Movimiento y choques: se llama en cada cuadro
const free = (n, x, z) => walkableIn(n.sp, x, z, true) // los peatones no se salen de la calle (ni al caminito de la casa ni al pasto)
const shove = (n, dx, dz) => { const p = n.g.position; if (!free(n, p.x + dx, p.z + dz)) return false; p.x += dx; p.z += dz; return true }
function cambiarCarril(n, otro) { // pasa al carril libre más cercano que quede lejos del otro (y del personaje)
    const p = n.g.position, ro = n.route; if (!ro) return
    const alongX = ro.axis === 'x', c = alongX ? p.z : p.x, op = otro.g.position
    const lejos = (x, z) => Math.hypot(op.x - x, op.z - z) > R * 1.1 && Math.hypot(player.x - x, player.z - z) > R * 1.1
    const lane = ro.lanes.slice().sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).find(l => { const [x, z] = alongX ? [p.x, l] : [l, p.z]; return free(n, x, z) && lejos(x, z) })
    if (lane !== undefined) alongX ? p.z = lane : p.x = lane
}
export function updateNpcs(dt, t) {
    mom.update(dt, t)
    const sp = runtime.space, q = runtime.quake; let near = 0
    // finales: nadie se mueve. Si perdiste, todos se voltean a mirar a Gabriela (antes de que la cámara se acerque)
    const fin = ['FAILURE', 'ARRIVAL', 'ENDING_GOOD', 'ENDING_BAD'].includes(runtime.state), mirar = runtime.state === 'FAILURE' || runtime.state === 'ENDING_BAD'
    for (const n of npcs) {
        const p = n.g.position; n.cool = Math.max(0, n.cool - dt); n.stareCool = Math.max(0, (n.stareCool || 0) - dt)
        if (fin) {
            if (mirar && n.sp === sp) { const want = Math.atan2(player.x - p.x, player.z - p.z), r = n.g.rotation; r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)) * Math.min(1, dt * 6); n.g.userData.head.rotation.y *= 0.8 }
            if (n.kind === 'walker') p.y = 0
            continue
        }
        if (q > 0.001 || n.shaking) { // terremoto: mueven la cabeza de un lado a otro y se sacuden
            const hd = n.g.userData.head, ph = n.ph || 0
            hd.rotation.x = Math.sin(t * 11 + ph) * 0.25 * q; hd.rotation.y = Math.sin(t * 14 + ph) * 0.8 * q; hd.rotation.z = Math.sin(t * 19 + ph * 1.3) * 0.35 * q
            n.g.rotation.z = Math.sin(t * 23 + ph) * 0.06 * q; n.shaking = q > 0.001
        }
        if (n.kind === 'walker') {
            if (n.state === 'stare') { n.t -= dt; n.g.rotation.y = Math.atan2(player.x - p.x, player.z - p.z); if (n.t <= 0) n.state = 'walk' } // se detiene y te mira
            else {
                const ro = n.route, alongX = ro.axis === 'x'
                if (!free(n, p.x, p.z)) { // quedó fuera de la calle (p. ej. un empujón): vuelve al carril libre más cercano en vez de quedarse girando en el sitio
                    const c = alongX ? p.z : p.x, lane = ro.lanes.slice().sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).find(l => alongX ? free(n, p.x, l) : free(n, l, p.z))
                    if (lane !== undefined) alongX ? p.z = lane : p.x = lane
                }
                const v = (alongX ? p.x : p.z) + n.dir * n.speed * dt
                const nx = alongX ? v : p.x, nz = alongX ? p.z : v
                // alguien justo delante (en el mismo sentido o de frente): no se le mete encima, da la vuelta. Antes seguía caminando contra el otro
                // y los dos quedaban fusionados. turnCool evita que gire en cada cuadro si queda encerrado entre dos (se queda quieto un momento)
                const close = (o) => Math.hypot(o.g.position.x - nx, o.g.position.z - nz), blocked = npcs.some(o => o !== n && o.sp === n.sp && close(o) < R * 1.2 && close(o) < Math.hypot(o.g.position.x - p.x, o.g.position.z - p.z))
                n.turnCool = Math.max(0, (n.turnCool || 0) - dt)
                if (blocked) { if (!n.turnCool) { n.dir *= -1; n.turnCool = 0.8 } }
                else if (free(n, nx, nz) && v > ro.min && v < ro.max) { p.x = nx; p.z = nz } else n.dir *= -1 // el escenario lo frena: da la vuelta
                n.g.rotation.y = alongX ? (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (n.dir > 0 ? 0 : Math.PI)
                n.fase = (n.fase ?? n.ph) + dt * n.speed * 5.5 // el paso va con la velocidad de cada uno
                p.y = alturaPaso(n.fase, 1)
            }
            if (n.vx || n.vz) { shove(n, n.vx * dt, n.vz * dt); n.vx *= Math.max(0, 1 - dt * 4); n.vz *= Math.max(0, 1 - dt * 4); if (Math.hypot(n.vx, n.vz) < 0.05) n.vx = n.vz = 0 }
        } else p.y = n.y + (n.kind === 'seated' ? Math.sin(t * 1.5 + n.ph) * 0.015 : 0)
    }
    for (const n of npcs) { // poses: caminando, sentados o de pie (el conductor también va sentado)
        const rig = n.g.userData.rig; if (!rig || n.sp !== sp) continue
        const camina = n.kind === 'walker' && n.state !== 'stare' && !fin
        // sentados: la mayoría con los brazos sueltos (n.suelta); el conductor y unos pocos, con las manos al frente
        rig.pose(n.kind === 'seated' || n.kind === 'driver' ? 'sentada' : camina ? 'caminar' : 'quieta', camina ? n.fase ?? 0 : t + (n.ph || 0), n.suelta ? 'suelta' : 1)
        rig.aplicar(dt)
        const hd = n.g.userData.head.rotation; rig.cabeza.rotation.x += hd.x; rig.cabeza.rotation.y += hd.y; rig.cabeza.rotation.z += hd.z
    }
    if (fin) { npcState.near = 0; return }
    for (let i = 0; i < npcs.length; i++) for (let j = i + 1; j < npcs.length; j++) { // entre NPCs: no se atraviesan
        const a = npcs[i], b = npcs[j]; if (a.sp !== b.sp) continue
        let dx = b.g.position.x - a.g.position.x, dz = b.g.position.z - a.g.position.z, d = Math.hypot(dx, dz)
        if (d < R) {
            if (d < 1e-3) { const an = Math.random() * 6.28; dx = Math.cos(an); dz = Math.sin(an); d = 1 }
            const o = (R - Math.min(d, R)) / 2 + 0.02, ux = dx / d, uz = dz / d
            // de frente por el mismo carril: uno se hace a un lado (perpendicular a su calle, también en los tramos que van en Z)
            const ax = (a.route || b.route)?.axis || 'x', across = ax === 'x' ? Math.abs(dz) : Math.abs(dx)
            const side = across < 0.3 ? (i % 2 ? 1 : -1) * o * 0.6 : 0, [sx, sz] = ax === 'x' ? [0, side] : [side, 0]
            const okA = a.kind === 'walker' && shove(a, -ux * o - sx, -uz * o - sz), okB = b.kind === 'walker' && shove(b, ux * o + sx, uz * o + sz)
            const okB2 = !okA && b.kind === 'walker' && shove(b, ux * o * 2 + sx, uz * o * 2 + sz) // si uno quedó contra el borde, el otro se aparta el doble
            const okA2 = !okB && a.kind === 'walker' && shove(a, -ux * o * 2 - sx, -uz * o * 2 - sz)
            // ninguno pudo moverse (los dos contra el borde, o uno sentado / quieto): uno se pasa a otro carril libre. Si no, quedaban fusionados
            if (!okA && !okB && !okB2 && !okA2) { const w = b.kind === 'walker' ? b : a.kind === 'walker' ? a : null; if (w) cambiarCarril(w, w === a ? b : a) }
        }
    }
    for (const n of npcs) { // con el personaje
        if (n.sp !== sp) continue
        const p = n.g.position, dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz)
        if (d < 3.5) near++
        const hd = n.g.userData.head // después del sismo, la gente cercana gira la cabeza y se queda mirándote
        if (q <= 0.001 && n.kind !== 'driver') {
            let want = 0
            if (runtime.postQuake && d < 4.5) { want = Math.atan2(-dx, -dz) - n.g.rotation.y; want = Math.max(-1.5, Math.min(1.5, Math.atan2(Math.sin(want), Math.cos(want)))) }
            hd.rotation.y += (want - hd.rotation.y) * Math.min(1, dt * 5)
        }
        if (d > 0 && d < R) {
            const ux = dx / d, uz = dz / d, o = R - d
            if (n.cool <= 0) { // chocar = parar y mirar (una sola vez cada tanto: si no, al seguir tocándolo se quedaba quieto para siempre y te encerraba)
                n.cool = 2; npcState.bumps++
                if (runtime.postQuake && n.kind === 'walker' && n.state !== 'stare' && !(n.stareCool > 0)) { n.state = 'stare'; n.t = 2.5; n.stareCool = 9 } // antes del sismo nadie se detiene a mirarte
            }
            if (n.kind === 'walker') shove(n, ux * o * 0.6, uz * o * 0.6)
            const k = n.kind === 'walker' ? 0.4 : 1, px = player.x - ux * o * k, pz = player.z - uz * o * k
            if (walkableIn(sp, px, pz)) { player.x = px; player.z = pz }
        }
    }
    npcState.near = near + updatePhantoms(dt, t, sp)
}