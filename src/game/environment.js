// Indice
    // 0. Imports
    // 1. Paleta y materiales
    // 2. Espacios
    // 3. Colisiones
    // 4. Utilidades de decoración
    // 5. Deformación de la ciudad y pasto
    // 6. Capas de la ciudad
    // 7. Cuarto (segundo piso)
    // 8. Planta baja: cocina, escaleras, comedor y sala
    // 9. Calle (en L: sale de la casa y gira hacia la universidad)
    // 10. Interior del MIO
    // 11. Objetos interactivos
    // 12. Fondo y tema de color
    // 13. Calle eterna
    // 14. Actualización por cuadro

// 0. Imports
import * as THREE from 'three'
import { CargadorModelos } from './modelos.js' // (los FBX se publican como GLB con Draco)
import { scene, ambient, sun } from './scene.js'
import { CONFIG, runtime } from './config.js'
const W = CONFIG.world, HX = W.homeX

// 1. Paleta y materiales: cada objeto tiene un color en calma y otro en tensión
const themed = []
const mat = (calm, tense, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: calm, ...o })
    themed.push({ m, a: new THREE.Color(calm), b: new THREE.Color(tense) }); return m
}

// TEMP_*: sustituir cada capa por las ilustraciones/modelos definitivos
const root = new THREE.Group(); scene.add(root)

// 2. Espacios: el cuarto, la planta baja, la calle y el interior del MIO son espacios independientes (setSpace muestra el actual)
const GROUPS = { HOUSE: new THREE.Group(), HOME: new THREE.Group(), STREET: new THREE.Group(), BUS: new THREE.Group() }
root.add(...Object.values(GROUPS))
export const spaces = GROUPS
export const SEATS = [] // asientos del MIO donde se puede sentar el personaje (los NPCs ocupan algunos)
let curName = 'HOUSE', cur = GROUPS.HOUSE
const into = (name) => { curName = name; cur = GROUPS[name] }
export function setSpace(name) { // desde la calle, la casa de Gabriela es una más de la fila (se construye en la sección 9)
    runtime.space = name; Object.entries(GROUPS).forEach(([k, g]) => g.visible = k === name)
}

const box = (w, h, d, x, y, z, calm, tense, parent = cur) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(calm, tense)); m.position.set(x, y, z); parent.add(m); return m }

// 3. Colisiones: por espacio. Cada rectángulo es [x0, x1, z0, z1]
// Recorrido de la calle en Z (como en el plano): eje de la calle desde la valla hasta la puerta de la universidad.
// Tramos: 1) derecha, frente a la casa y el paradero · 2) arriba · 3) derecha · 4) arriba hasta la universidad
export const STREET_X0 = -30 // la calle 1 sigue hacia la izquierda de la casa de Gabriela hasta una valla de obra
const UX = W.uniX, GATE = W.uniGateZ, HW = 3 // HW = media calle
export const ROUTE = [[STREET_X0, 0], [W.turn1X, 0], [W.turn1X, W.turn2Z], [UX, W.turn2Z], [UX, GATE]]
export const SEGS = ROUTE.slice(1).map(([x1, z1], i) => { // tramos: eje, dirección de avance y largo
    const [x0, z0] = ROUTE[i], axis = z1 === z0 ? 'x' : 'z'
    return { x0, z0, x1, z1, axis, dir: Math.sign(axis === 'x' ? x1 - x0 : z1 - z0), len: Math.hypot(x1 - x0, z1 - z0) }
})
export const ROUTE_LEN = SEGS.reduce((s, g) => s + g.len, 0)
const segRect = (s, pad) => [Math.min(s.x0, s.x1) - pad, Math.max(s.x0, s.x1) + pad, Math.min(s.z0, s.z1) - pad, Math.max(s.z0, s.z1) + pad]
const ROADS = SEGS.map(s => segRect(s, HW)); ROADS[0][0] = STREET_X0; ROADS[ROADS.length - 1][2] = GATE // la calle se corta en la valla y en la puerta
// Calles cerradas en las esquinas: en cada giro la calle sigue un poco en los dos sentidos que no se usan y una valla de obra la corta.
// Solo decoración (no se camina): da la ilusión de que la ciudad es más grande y las esquinas no quedan peladas
const STUB_LEN = 15, STUBS = []
const stubAt = (cx, cz, axis, sg) => { // una calle cerrada que sale del punto (cx, cz) hacia sg en el eje axis
    const c = axis === 'x' ? cx : cz, a = c + sg * HW, b = c + sg * (HW + STUB_LEN)
    STUBS.push({ r: axis === 'x' ? [Math.min(a, b), Math.max(a, b), cz - HW, cz + HW] : [cx - HW, cx + HW, Math.min(a, b), Math.max(a, b)], axis, sg, cx, cz })
}
ROUTE.slice(1, -1).forEach(([cx, cz], k) => {
    const sIn = SEGS[k], sOut = SEGS[k + 1]
    // una sola calle cerrada por esquina: en la 1.ª y la 3.ª sigue derecho; en la 2.ª, hacia atrás de la calle que sale
    if (k === 1) stubAt(cx, cz, sOut.axis, -sOut.dir)
    else stubAt(cx, cz, sIn.axis, sIn.dir)
})
stubAt(UX, GATE + HW, 'x', 1) // junto a la universidad: una calle sale hacia un lado justo frente a la entrada (la universidad queda en la esquina)
// Jardineras de las calles cerradas (solo decoración, no cuentan para el Earthing): angostas, junto al bordillo, en los dos andenes
const STUB_PLANTERS = []
STUBS.forEach(({ axis, sg, cx, cz }) => [-1, 1].forEach(side => {
    for (let t = HW + 2; t + 3 < HW + STUB_LEN; t += 7) {
        const u0 = (axis === 'x' ? cx : cz) + sg * t, u1 = u0 + sg * 3, [lo, hi] = [Math.min(u0, u1), Math.max(u0, u1)]
        const c = axis === 'x' ? cz : cx, [v0, v1] = side < 0 ? [c - HW - 2.1, c - HW - 0.3] : [c + HW + 0.3, c + HW + 2.1]
        STUB_PLANTERS.push(axis === 'x' ? [lo, hi, v0, v1] : [v0, v1, lo, hi])
    }
}))
const BLOCKED = ROADS.concat(STUBS.map(o => o.r)) // calles de verdad + calles cerradas: ahí no van casas ni árboles
const EXT = [UX - HW, UX + HW, GATE, GATE] // tramo extra de la calle eterna (crece con la ansiedad)
export const HOME_DOOR = { x: -3.5, z: -8 } // casa de Gabriela en la fila de casas de la calle 1 (su puerta mira a la calle)
const PATH = [HOME_DOOR.x - 0.7, HOME_DOOR.x + 0.7, HOME_DOOR.z + 1.6, -3]  // caminito de la puerta al andén
const RECTS = {
    HOUSE: [[-8.4, -0.15, -3.05, 3.05], [-5.7, -4.3, 2.9, 3.7]],                 // cuarto + hueco de la puerta (pared invisible del frente)
    HOME: [[HX - 6.4, HX + 6.2, -3.9, 3.9], [HX + 6.0, HX + 6.9, -0.85, 0.85]],  // planta baja + puerta principal (pared invisible de la derecha)
    STREET: [...ROADS, EXT, PATH],                                                // los cuatro tramos + calle eterna + caminito de la casa
    BUS: [[W.busInteriorX - 5.2, W.busInteriorX + 5.0, -1.35, 1.2]] // pasillo del modelo del MIO, por dentro de las paredes (las puertas se suman abajo, con BUS_DOORS)
}
// Punto del eje a una distancia d desde la valla, y el tramo más cercano a un punto (la cámara mira hacia donde avanza la calle)
export function routePoint(d) {
    for (const s of SEGS) { if (d <= s.len) { const k = d / s.len; return [s.x0 + (s.x1 - s.x0) * k, s.z0 + (s.z1 - s.z0) * k, s] } d -= s.len }
    const s = SEGS[SEGS.length - 1]; return [s.x1, s.z1, s]
}
export function nearestSeg(x, z) {
    let best = SEGS[0], bd = Infinity
    SEGS.forEach(s => { const r = segRect(s, 0), d = Math.hypot(x - Math.min(r[1], Math.max(r[0], x)), z - Math.min(r[3], Math.max(r[2], z))); if (d < bd) { bd = d; best = s } })
    return best
}
const PAD = 0.3, SOLIDS = []
const solid = (w, d, x, z, active, space = curName) => SOLIDS.push({ space, x, z, hw: w / 2 + PAD, hd: d / 2 + PAD, active })
const furn = (w, h, d, x, y, z, calm, tense, active) => { solid(w, d, x, z, active); return box(w, h, d, x, y, z, calm, tense) }
// Pasto a los lados de cada tramo (3.5 de ancho): solo se puede pisar durante el minijuego del Earthing.
// far = lado lejano a la cámara (arriba o a la izquierda en pantalla): ahí el personaje nunca queda tapado
const GW = 3.5, GRASS = []
const trim = (rect, axis, i) => { // en las esquinas, la franja de pasto se corta donde empieza la calle del otro tramo
    const r = rect.slice(), [a, b, c, d] = axis === 'x' ? [0, 1, 2, 3] : [2, 3, 0, 1]
    ROADS.forEach((o, j) => {
        if (j === i || o[c] >= r[d] || o[d] <= r[c]) return
        if (o[a] <= r[a] && r[a] < o[b]) r[a] = o[b]
        if (o[a] < r[b] && r[b] <= o[b]) r[b] = o[a]
    })
    return r
}
SEGS.forEach((s, i) => {
    const r = segRect(s, 0)
    const sides = (s.axis === 'x' ? [[r[0], r[1], r[2] - HW - GW, r[2] - HW, true], [r[0], r[1], r[3] + HW, r[3] + HW + GW, false]]
                                  : [[r[0] - HW - GW, r[0] - HW, r[2], r[3], true], [r[1] + HW, r[1] + HW + GW, r[2], r[3], false]])
        .map(([x0, x1, z0, z1, far]) => [...trim([x0, x1, z0, z1], s.axis, i), far])
    sides.forEach(([x0, x1, z0, z1, far]) => {
        if (x1 - x0 < 1 || z1 - z0 < 1) return // franja que quedó sin espacio después del recorte
        const add = (r) => GRASS.push({ r, far, axis: s.axis })
        if (z1 > PATH[2] && z0 < PATH[3] && x0 < PATH[1] && x1 > PATH[0]) { add([x0, PATH[0], z0, z1]); add([PATH[1], x1, z0, z1]); return } // el caminito de la casa parte el pasto
        add([x0, x1, z0, z1])
    })
})
const GRASS_STRIPS = GRASS.map(g => g.r)
// Andén: las franjas de los lados de la calle son de concreto, con pedazos de pasto cada tanto (como un andén de ciudad).
// SECTIONS = esos pedazos de pasto: en el Earthing solo cuenta pararse sobre uno de ellos
// Más difícil: cada lado tiene una cada SEC_GAP, los dos lados van alternados (nunca una frente a otra) y ninguna queda a menos de SEC_MIN de otra
const SEC_L = 4, SEC_GAP = 22, SEC_MIN = 13, SECTIONS = []
const secCenter = (r) => [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2]
GRASS.forEach(({ r: [x0, x1, z0, z1], far, axis }) => {
    const [a0, a1] = axis === 'x' ? [x0, x1] : [z0, z1]
    for (let c = a0 + 1.5 + (far ? 0 : SEC_GAP / 2); c + SEC_L < a1 - 0.5; c += SEC_GAP) {
        const [b0, b1] = axis === 'x' ? (far ? [z1 - 2.1, z1 - 0.3] : [z0 + 0.3, z0 + 2.1]) : (far ? [x1 - 2.1, x1 - 0.3] : [x0 + 0.3, x0 + 2.1]) // jardinera angosta junto a la calle; el resto del andén queda libre
        const r = axis === 'x' ? [c, c + SEC_L, b0, b1] : [b0, b1, c, c + SEC_L]
        const [cx, cz] = secCenter(r)
        const underStub = STUBS.some(o => r[0] < o.r[1] && r[1] > o.r[0] && r[2] < o.r[3] && r[3] > o.r[2]) // no debajo de una calle cerrada
        if (!underStub && SECTIONS.every(o => { const [ox, oz] = secCenter(o.r); return Math.hypot(ox - cx, oz - cz) >= SEC_MIN })) SECTIONS.push({ r, far })
    }
})
// (el pasto del andén, GRASS_STRIPS, siempre se puede pisar; antes solo durante el Earthing)
const inRect = ([x0, x1, z0, z1], x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1
const grow = ([x0, x1, z0, z1], p) => [x0 - p, x1 + p, z0 - p, z1 + p]
// npc = true: los peatones no pisan el caminito de la casa ni el andén. Antes un empujón los metía en el caminito,
// ahí no podían avanzar y daban la vuelta en cada cuadro (se veían titilar sobre el andén)
export const walkableIn = (sp, x, z, npc = false) => { // se puede preguntar por cualquier espacio (los NPCs lo usan)
    return (RECTS[sp].some(r => inRect(r, x, z) && !(npc && r === PATH)) || (!npc && sp === 'STREET' && GRASS_STRIPS.some(r => inRect(r, x, z)))) &&
        !SOLIDS.some(s => s.space === sp && (!s.active || s.active()) && Math.abs(x - s.x) < s.hw && Math.abs(z - s.z) < s.hd)
}
export const walkable = (x, z) => walkableIn(runtime.space, x, z)
// Altura del piso de la calle donde se para Gabriela (medida en las cajas de abajo): el asfalto en y = 0 (con manchas de 2 cm), los bordillos en 0.03 y el
// andén, el pasto y los lotes en -0.09. Antes era 0.05 en el asfalto y 0.03 en lo demás: sobre los bordillos (más altos) los pies se metían
const enBordillo = (lista, x, z) => lista.some(([cx, , cz, largo, , , ry]) => ry ? Math.abs(cx - x) < 0.17 && Math.abs(cz - z) < largo / 2 : Math.abs(cx - x) < largo / 2 && Math.abs(cz - z) < 0.17) // (cada bordillo es una caja de su largo)
export const sueloCalle = (x, z) => enBordillo(curbs, x, z) || enBordillo(stubCurbs, x, z) ? BORDILLO + 0.005
    : ROADS.some(r => inRect(r, x, z)) || STUBS.some(o => inRect(o.r, x, z)) ? 0.02 : inRect(PATH, x, z) ? -0.04 : -0.09 // (0.02 en el asfalto: encima de sus manchas)
// pisando uno de los pedazos de pasto del andén (con un margen pequeño: pararse en el borde ya cuenta)
const GRASS_EDGE = 0.3
// (también los pedazos de pasto al final de las calles cerradas: se ven igual y antes no contaban para el Earthing)
let pastos = null; const PASTOS = () => pastos ||= SECTIONS.concat(STUB_PLANTERS.map(r => ({ r, far: true })))
export const onGrass = (x, z) => runtime.space === 'STREET' && PASTOS().some(p => inRect(grow(p.r, GRASS_EDGE), x, z)) &&
    !ROADS.some(r => inRect(grow(r, -GRASS_EDGE), x, z)) && !inRect(PATH, x, z)
const nearestIn = (rects, x, z) => {
    let best = null, bd = Infinity
    rects.forEach(([x0, x1, z0, z1]) => { const px = Math.min(x1, Math.max(x0, x)), pz = Math.min(z1, Math.max(z0, z)), d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = { x: px, z: pz } } })
    return best
}
const clear = (x, z, tx, tz) => { for (let i = 1; i <= 12; i++) { const k = i / 12; if (!walkable(x + (tx - x) * k, z + (tz - z) * k)) return false } return true } // camino recto sin obstáculos (p. ej. el MIO)
export const nearestGrass = (x, z) => { // el pedazo de pasto alcanzable más cercano, prefiriendo el lado lejano a la cámara (en el cercano lo tapan casas y árboles)
    const opts = PASTOS().map(g => { const p = nearestIn([grow(g.r, -0.6)], x, z); return { ...p, cost: Math.hypot(p.x - x, p.z - z) + (g.far ? 0 : 4) } }).sort((a, b) => a.cost - b.cost)
    const p = opts.find(o => clear(x, z, o.x, o.z)) || opts[0]; return [p.x, p.z]
}
export const pullBack = (x, z) => {
    const sp = runtime.space, rects = RECTS[sp].concat(sp === 'STREET' ? GRASS_STRIPS : [])
    if (rects.some(r => inRect(r, x, z))) return null
    return nearestIn(rects, x, z)
}
export function setGrass(v) { runtime.grassGreen = v } // Earthing: todo el pasto se satura de verde (el pasto del andén ahora siempre se puede pisar)

// Modelos finales (FBX): cada uno tiene su versión oscura, que reemplaza a la normal cuando la ansiedad llega a lo más alto (ver updateEnvironment)
// Paleta: los colores que traen los archivos de Blender no se usan tal cual. Cada material (por su nombre) toma un color de la paleta
// del juego, con su pareja de tensión (como todo lo demás en mat()): así los modelos se ven como el resto del mundo y SOLO cambian
// con el nivel de ansiedad (applyTheme). Un material que no esté en la lista toma el color de la paleta más parecido
const PAIRS = { '#F2C063': '#580213', '#BF895A': '#580213', '#D8C8AE': '#71708A', '#A6869B': '#482642', '#A16A49': '#201826', '#799180': '#482642',
    '#8296B7': '#201826', '#BF4E24': '#580213', '#E4FFFF': '#71708A', '#71708A': '#201826' }
const MODEL_COLORS = {
    Pared: '#A6869B', suelo: '#BF895A', Suelo: '#BF895A', Cafe: '#A16A49', 'Cafe claro': '#BF895A', Naranja: '#BF4E24', Colchon: '#A6869B', Cortina: '#F2C063',
    Amarillo: '#F2C063', Alfombra: '#799180', Material: '#799180', 'Material.001': '#799180', Salida: '#71708A', 'Señaladores': '#71708A', // casa (Material: la maleta)
    'Azul 1': '#8296B7', 'Azul 2': '#71708A', 'Azul 3': '#D8C8AE', Violeta: '#A16A49', Violeta2: '#BF895A'                                       // interior del MIO (sillas cafés de la paleta: las verdes se confundían con la camiseta y la maleta de Gabriela)
}
const nearestPal = (c) => { let best = '#71708A', bd = Infinity; Object.keys(PAIRS).forEach(k => { const d = new THREE.Color(k).sub(c); const e = d.r * d.r * 3 + d.g * d.g * 4 + d.b * d.b * 2; if (e < bd) { bd = e; best = k } }); return best }
const fbx = new CargadorModelos(), MODELS = []
// modelosListos: se cumple cuando terminaron de cargar todos los FBX (main.js espera esto antes de la tarjeta "10 de agosto": si cargaban
// mientras la tarjeta aparecía, el fundido se trababa). Con un tope de 12 s por si alguno no llega
let pendientes = 0, avisarListos = () => {}
export const modelosListos = new Promise(r => { avisarListos = r; setTimeout(r, 12000) })
// Flechas del piso de la casa (Salida, Señaladores): guían por dónde se entra y se sale. Brillan siempre (laten en updateEnvironment)
export const ARROW = new THREE.MeshBasicMaterial({ color: 0xf2c063, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
const ARROWS = /^(Salida|Se\{alador|Señalador_entrada)$/
// shell: una copia de la malla un poco más grande, por detrás (BackSide): un brillo con la forma del objeto (no una caja)
function shell(mesh, k = 1.1, m = OUTLINE) {
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); g.computeBoundingBox()
    const c = g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z).scale(k, k, k).translate(c.x, c.y, c.z)
    return new THREE.Mesh(g, m)
}
// colors: colores propios de este archivo (si un nombre se repite con otro sentido) · onLoad(o, dark): para buscar piezas del modelo ya ubicado
function model(path, darkPath, parent, scale, x, y, z, { colors = {}, onLoad } = {}) {
    const pair = { normal: null, dark: null }, cache = {}
    const paint = (m) => { // material de la paleta (uno por nombre en cada modelo)
        const calm = colors[m.name] || MODEL_COLORS[m.name] || nearestPal(m.color)
        return cache[m.name] ||= mat(calm, PAIRS[calm] || '#201826', { flatShading: false, name: m.name }) // (conserva el nombre: onLoad puede buscar una pieza por material)
    }
    const put = (o, dark) => {
        const extra = []; o.traverse(c => { if (c.isLight || c.isCamera) extra.push(c) }); extra.forEach(c => c.removeFromParent()) // luces y cámaras que trae el archivo de Blender (la de la parada quemaba la escena)
        o.traverse(c => { if (!c.isMesh) return; c.material = ARROWS.test(c.name) ? ARROW : Array.isArray(c.material) ? c.material.map(paint) : paint(c.material) })
        o.scale.setScalar(scale); o.position.set(x, y, z); o.visible = !dark; parent.add(o); o.updateMatrixWorld(true); pair[dark ? 'dark' : 'normal'] = o
        onLoad?.(o, dark)
    }
    pendientes += 2; const listo = () => { if (--pendientes === 0) avisarListos() }
    fbx.load(path, o => { put(o, false); listo() }, undefined, listo); fbx.load(darkPath, o => { put(o, true); listo() }, undefined, listo)
    MODELS.push(pair); return pair
}
// Objeto interactivo que es una pieza del modelo (armario, maleta): se esconde en las dos versiones (normal y oscura) y brilla con su forma
function piece(names) {
    const o = { meshes: [], v: true, userData: { outline: new THREE.Group() } }
    o.userData.outline.visible = false
    Object.defineProperty(o, 'visible', { get: () => o.v, set: (v) => { o.v = v; o.meshes.forEach(m => m.visible = v) } })
    o.grab = (model, dark) => model.traverse(c => { if (!c.isMesh || !names.test(c.name)) return; o.meshes.push(c); c.visible = o.v; if (!dark) o.userData.outline.add(shell(c, 1.08)) })
    return o
}

// 4. Utilidades de decoración: aleatorio con semilla: el mapa es igual en cada carga
const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(7)
const rr = (a, b) => a + rng() * (b - a)
const scatter = (geo, calm, tense, pts, parent = cur) => { // muchas copias de una forma en un solo draw call: [x, y, z, sx, sy, sz, rotY]
    const im = new THREE.InstancedMesh(geo, mat(calm, tense), pts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    pts.forEach(([x, y, z, sx = 1, sy = 1, sz = 1, ry = 0], i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, ry, 0)), new THREE.Vector3(sx, sy, sz))))
    im.frustumCulled = false; parent.add(im); return im
}
// Brillo amarillo (--color-principal) de lo que toca hacer ahora: delineado en los objetos y un panel en las puertas.
// main.js enciende solo el del objetivo actual (en vez de decirlo con texto)
export const OUTLINE = new THREE.MeshBasicMaterial({ color: 0xf2c063, side: THREE.BackSide, transparent: true, depthWrite: false })
export const SOFT = new THREE.MeshBasicMaterial({ color: 0xf2c063, side: THREE.BackSide, transparent: true, depthWrite: false }) // brillo suave: el MIO después del sismo y las bancas libres
const outlined = (mesh, w, h, d, pad = 0.14, y = 0, m = OUTLINE) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w + pad, h + pad, d + pad), m); o.position.y = y; o.visible = false; mesh.add(o); mesh.userData.outline = o; return mesh }
// Decoración de la calle con modelos (assets/calle/decoraciones): los archivos traen la escena entera del paquete; de cada uno sirve una pieza
// (raiz: su nombre; sin nombre, todo el archivo). piezasDe la deja parada en el origen, con la base en y = 0 y 1 de alto (así la escala es el
// alto en metros). Las hojas toman el verde de la paleta y lo demás el café de los troncos. Cada pieza se dibuja como copias (InstancedMesh):
// un solo dibujo para todos los árboles o todas las matas
const trunkMat = mat('#A16A49', '#201826'), leafMat = mat('#799180', '#482642')
const HOJAS = /^_0(77|14)/
function piezasDe(url, raiz) {
    pendientes++ // (también cuentan para modelosListos)
    return fbx.loadAsync(url).then(o => {
        o.updateMatrixWorld(true)
        const r = raiz ? o.getObjectByName(raiz) : o, inv = r.matrixWorld.clone().invert(), partes = [], b = new THREE.Box3()
        r.traverse(c => { if (!c.isMesh) return; const g = c.geometry.clone().applyMatrix4(inv.clone().multiply(c.matrixWorld)); g.computeBoundingBox(); b.union(g.boundingBox); partes.push({ g, hoja: HOJAS.test([c.material].flat()[0].name) }) })
        const c = b.getCenter(new THREE.Vector3()), h = b.max.y - b.min.y
        partes.forEach(p => { p.g.translate(-c.x, -b.min.y, -c.z).scale(1 / h, 1 / h, 1 / h); p.g.computeVertexNormals() })
        return partes
    }).catch(() => []).finally(() => { if (--pendientes === 0) avisarListos() })
}
// copias: [x, y, z, alto, giro] de cada una
function copias(partes, lista, parent, mats = { hoja: leafMat, resto: trunkMat }) {
    if (!lista.length) return []
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3()
    return partes.map(({ g, hoja }) => {
        const im = new THREE.InstancedMesh(g, hoja ? mats.hoja : mats.resto, lista.length)
        lista.forEach(([x, y, z, alto, ry], i) => im.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), s.setScalar(alto))))
        im.frustumCulled = false; parent.add(im); return im
    })
}
// Árboles (calle): los de copa (arbol1, arbol3 y arbol4, turnándose) y, uno de cada cuatro, el seco (arbol2). tree() anota dónde va cada uno;
// se arman al cargar. (Pide al azar lo mismo que los árboles de antes: dos números. Si pidiera más, se correría todo lo que se ubica
// después: casas, árboles…)
const D = 'assets/calle/decoraciones/'
const TIPOS_ARBOL = [ // archivo, pieza (los primeros traían la escena entera del paquete), alto en metros
    ['arbol1', 'scene002', 3.8], ['arbol2', null, 4.2], ['arbol3', null, 3.9], ['arbol4', null, 4.6]]
const ARBOLES = TIPOS_ARBOL.map(() => []); let nArboles = 0
const tree = (x, z) => {
    const n = nArboles++, k = n % 4 === 3 ? 1 : [0, 2, 3][n % 3], t = [x, -0.15, z, TIPOS_ARBOL[k][2] * rr(0.85, 1.25), rr(0, 6)]
    t.ok = true; ARBOLES[k].push(t)
    solid(0.35, 0.35, x, z, () => t.ok) // el tronco: no se puede atravesar (antes Gabriela pasaba por dentro del árbol) · solo si el árbol quedó (ver abajo)
}
// Los árboles que se meterían en un edificio (la copa contra una fachada o encima de uno de los de cartón del fondo) no se ponen. Se revisa
// cuando ya está todo el mapa armado (los edificios de cartón se arman después que los árboles); los números al azar ya se pidieron
const COPA = 1.1 // cuánto se abre la copa alrededor del tronco (m)
const tapado = (x, z) => SOLIDS.some(s => s.edificio && s.space === 'STREET' && Math.abs(x - s.x) < s.hw - PAD + COPA && Math.abs(z - s.z) < s.hd - PAD + COPA)
    || mid.concat(cerca).some(([bx, bz, w, , d]) => Math.abs(x - bx) < w / 2 + COPA && Math.abs(z - bz) < d / 2 + COPA)
TIPOS_ARBOL.forEach(([archivo, pieza], k) => piezasDe(D + archivo + '.fbx', pieza).then(p => {
    ARBOLES[k].forEach(t => { t.ok = !tapado(t[0], t[2]) })
    copias(p, ARBOLES[k].filter(t => t.ok), GROUPS.STREET)
}))

// 5. Deformación de la ciudad y pasto: la ciudad se deforma con la ansiedad; el pasto se pinta de verde en el Earthing
const warp = []
const warpable = (g, ph, building = false) => { const e = { g, x: g.position.x, y: g.position.y, ry: g.rotation.y, ph, building, sh: 0, tilt: 0, sink: 0, dx: 0, dz: 1 }; g.userData.warp = e; warp.push(e); return g }
// Susto en la calle: el edificio más cercano empieza a temblar y a inclinarse hacia el personaje (main.js anima sh / tilt / sink)
export function scareBuilding(px, pz) {
    let best = null, bd = 16
    warp.forEach(e => { if (!e.building || e.home || !e.g.parent?.visible) return; const d = Math.hypot(e.x - px, e.g.position.z - pz); if (d < bd) { bd = d; best = e } })
    if (best) { const dx = px - best.x, dz = pz - best.g.position.z, n = Math.hypot(dx, dz) || 1; best.dx = dx / n; best.dz = dz / n }
    return best
}
const tiltAxis = new THREE.Vector3(), tiltQ = new THREE.Quaternion()
const grass = [] // en el Earthing todo el pasto se satura de verde
const grassOf = (mesh, calm, tense, green) => grass.push({ m: mesh.material, a: new THREE.Color(calm), b: new THREE.Color(tense), g: new THREE.Color(green) })

// 6. Capas de la ciudad: plano medio, infraestructura y elementos frontales (versión destruida / reconstruida)
const RESTORED = [['#F2C063', '#482642'], ['#BF895A', '#580213'], ['#D8C8AE', '#71708A']]
const sets = []
function makeLayer(name, items) {
    const mk = (destroyed) => {
        const g = new THREE.Group(); g.name = name + (destroyed ? '_DESTROYED' : '_RESTORED')
        const ms = items.map(([x, z, w, h, d], i) => {
            const [c, t] = destroyed ? ['#71708A', '#201826'] : RESTORED[i % 3]
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, t)) // opaco: las dos versiones translúcidas a la vez se dibujaban mal (cajas fantasma sobre el pasto)
            m.position.set(x, 0, z); m.userData.h = destroyed ? h * 0.7 : h; m.userData.base = destroyed ? 0.7 : 1
            if (destroyed) m.rotation.z = (i % 2 ? 1 : -1) * 0.1
            m.userData.lift = destroyed ? Math.sin(0.1) * w / 2 : 0 // la esquina inclinada no se mete en el piso
            g.add(m); return m
        }); cur.add(g); return ms
    }
    const d = mk(true), r = mk(false)
    items.forEach((_, i) => sets.push({ d: d[i], r: r[i], th: (i * 0.618034) % 1, k: 1 })) // th: con cuánto progreso se reconstruye cada pieza (en desorden)
}
// Cada pieza cambia sola cuando el progreso pasa su umbral: lo destruido se encoge hacia el suelo y lo reconstruido crece desde el suelo
// (antes las capas enteras se hundían en el piso y se veían cortadas a medio camino)
const growFrom = (m, k) => { m.visible = k > 0.01; m.scale.y = Math.max(0.001, k) * (m.userData.base ?? 1); m.position.y = m.userData.h * k / 2 + m.userData.lift * k }
const row = (n, x0, dx, f) => Array.from({ length: n }, (_, i) => f(x0 + i * dx, i))

// 7. Cuarto (segundo piso) y 8. planta baja: modelos finales de la carpeta casa (Cuarto.fbx y Sala.fbx, con sus versiones oscuras).
//    Las medidas de abajo están en unidades del archivo (cm de Blender) y se pasan al juego con SH. Las flechas del piso marcan
//    por dónde se entra y se sale (ya no hay puertas): pisarlas cambia de espacio
const SH = 0.0065                                        // escala de los dos modelos (los muebles quedan del tamaño de Gabriela)
const R0 = { x: W.houseCenterX, y: -24 * SH, z: 0 }      // dónde queda el origen del cuarto (el piso del archivo está en y = 24)
const S0 = { x: HX - 120 * SH, y: -35 * SH, z: 0.12 }    // y el de la sala (piso en y = 35; así la sala queda centrada en HX)
const raw = (o, x0, x1, z0, z1) => [o.x + x0 * SH, o.x + x1 * SH, o.z + z0 * SH, o.z + z1 * SH] // rectángulo del archivo → [x0, x1, z0, z1] del juego
const rawSolid = (o, r, space) => { const [x0, x1, z0, z1] = raw(o, ...r); solid(x1 - x0 - 0.2, z1 - z0 - 0.2, (x0 + x1) / 2, (z0 + z1) / 2, undefined, space) } // margen más angosto que el general: los pasillos entre muebles quedan más anchos
const mid2 = (r) => [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2]
// La sala es más honda hacia el frente (hacia la cámara) que en el modelo: más espacio para moverse alrededor del comedor y del sofá.
// Se corren hacia adelante los vértices del borde del frente (piso y pared izquierda) y la flecha de la entrada
const SALA_EXTRA = 170 // unidades del archivo (≈ 1.1 m)
function alargarSala(o) {
    const raiz = o.matrixWorld.clone().invert(), v = new THREE.Vector3()
    o.traverse(c => {
        const flecha = /^Se.alador$/.test(c.name)
        if (!c.isMesh || !(flecha || c.name === 'Pared')) return
        const a = raiz.clone().multiply(c.matrixWorld), b = a.clone().invert(), pos = c.geometry.attributes.position
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(a) // al espacio del modelo
            if (flecha || v.z > 450) { v.z += SALA_EXTRA; v.applyMatrix4(b); pos.setXYZ(i, v.x, v.y, v.z) }
        }
        pos.needsUpdate = true; c.geometry.computeBoundingBox(); c.geometry.computeBoundingSphere()
    })
}
// Flechas del piso (rectángulos del juego) y dónde aparece Gabriela al llegar por cada una (un paso adentro, fuera de la flecha)
export const DOORS = {
    cuarto: raw(R0, 120, 353, 234, 329),               // flecha "Salida" del cuarto: baja a la sala
    subir: raw(S0, 930, 1038, -480, -247),             // flecha de la sala que apunta hacia adentro: por ahí llegas del cuarto (y vuelves a subir)
    calle: raw(S0, 751, 984, 391 + SALA_EXTRA, 509 + SALA_EXTRA) // flecha del frente, que apunta hacia afuera: la entrada de la casa (sale a la calle)
}
// cuarto: al volver de la sala aparece sobre la flecha de salida (por donde se entra), no en medio del cuarto
export const SPAWN = { cuarto: { x: R0.x + 236 * SH, z: 281 * SH }, subir: { x: S0.x + 880 * SH, z: -2.3 }, calle: { x: S0.x + 860 * SH, z: 2.42 + SALA_EXTRA * SH } } // siempre fuera de los muebles y de la flecha
export const SPACE_ZOOM = { HOUSE: 1.45, HOME: 0.89 }   // el cuarto es pequeño: la cámara se acerca · la sala es ancha: se aleja un poco para que no se corte
export const BED_LIE = { x: R0.x + 242 * SH, y: 1.05, z: -0.3 }  // acostada sobre el colchón, con la cabeza en las almohadas (hacia -z)

into('HOUSE')
const wardrobe = piece(/^Armario$/), bag = piece(/^Maleta/)
cur.add(wardrobe.userData.outline, bag.userData.outline)
let bagReady = null; export const bagModel = new Promise(r => { bagReady = r }) // la maleta del modelo también es la que Gabriela lleva a la espalda (player.js)
model('assets/casa/cuarto/Cuarto.fbx', 'assets/casa/cuarto/Cuarto_Oscuro.fbx', cur, SH, R0.x, R0.y, R0.z, {
    onLoad: (o, dark) => {
        wardrobe.grab(o, dark); bag.grab(o, dark)
        if (!dark) { const m = o.getObjectByName('Maleta'); if (m) bagReady({ geometry: m.geometry.clone().applyMatrix4(m.matrixWorld), material: m.material }) }
    }
})
;[[-371, -224, 47, 252], [-371, -205, -327, 39], [-201, -38, -269, -109], [122, 362, -325, 100]].forEach(r => rawSolid(R0, r)) // armario · escritorio · silla · cama
solid(1.4, 0, R0.x - 0.2, -1.9) // frente a la ventana: el alféizar sale de la pared a la altura de la cara y le atravesaba la cabeza al pegarse a ella (margen justo: no más de lo necesario)
// Objeto suelto con modelo (celular, desayuno): el modelo y su versión oscura van dentro de un grupo (esconder el grupo esconde las dos) y el
// brillo tiene su forma (shell), pasado a las coordenadas del grupo para que se mueva y se esconda con él
function suelto(grupo, archivos, escala, colors, brillan = /./, alCargar) {
    const brillo = new THREE.Group(); brillo.visible = false; grupo.add(brillo); grupo.userData.outline = brillo
    archivos.forEach(([normal, oscuro], i) => {
        const g = new THREE.Group(); g.visible = i === 0; grupo.add(g)
        model(normal, oscuro, g, escala, 0, 0, 0, { colors, onLoad: (o, dark) => {
            alCargar?.(o, dark)
            if (dark || i > 0) return
            grupo.updateMatrixWorld(true); const a = grupo.matrixWorld.clone().invert()
            o.traverse(c => { if (c.isMesh && brillan.test(c.name)) { const s = shell(c, 1.12); s.geometry.applyMatrix4(a); brillo.add(s) } })
        } })
    })
    return grupo
}
// celular sobre el escritorio (Cel.fbx): ~28 × 50 cm, de pie sobre la tabla (el archivo está centrado en su alto)
const phone = new THREE.Group(); phone.position.set(R0.x - 290 * SH, 0.995 + 39 * 0.00036, -0.25); cur.add(phone)
// prendido: la pantalla (Material.001, la cara de arriba) tiene luz propia y una luz pequeña encima ilumina un poco el escritorio alrededor.
// Se va con el celular cuando Gabriela lo coge (es parte del grupo)
const PANTALLA = '#E4FFFF'
suelto(phone, [['assets/casa/celular/Cel.fbx', 'assets/casa/celular/CelOsc.fbx']], 0.00036, { Material: '#BF4E24', 'Material.001': '#D8C8AE', 'Material.002': '#BF895A' }, /./,
    (o) => o.traverse(c => { if (c.isMesh) [c.material].flat().forEach(m => { if (m.name === 'Material.001') { m.emissive.set(PANTALLA); m.emissiveIntensity = 0.35 } }) }))
{ const luz = new THREE.PointLight(PANTALLA, 0.6, 1.5, 2); luz.position.set(0, 0.25, 0); phone.add(luz) }

// 8. Planta baja: cocina al fondo, comedor a la izquierda, sala con sofá y televisor a la derecha
into('HOME')
const TELE = mat('#482642', '#201826', { flatShading: false }) // el televisor, morado oscuro como las llantas del MIO
model('assets/casa/sala/Sala.fbx', 'assets/casa/sala/Sala_Oscura.fbx', cur, SH, S0.x, S0.y, S0.z, { onLoad: (o) => { alargarSala(o); o.traverse(c => { if (c.isMesh && c.name === 'Tele') c.material = Array.isArray(c.material) ? c.material.map(() => TELE) : TELE }) } })
;[[-763, -296, -512, -361], [-294, -74, -514, -355], [-71, 159, -512, -352],     // mesones y nevera
  [-446, -95, -92, 289],                                                           // sillas del comedor (por atrás pegado a los espaldares: si no, el paso entre la mesa y la cocina quedaba muy angosto)
  [550, 699, -204, -60], [806, 911, -144, 282]                                      // banquito · mueble del televisor
].forEach(r => rawSolid(S0, r))
{ const [x0, x1, z0, z1] = raw(S0, 275, 522, -127, 298); solid(x1 - x0 + 0.1, z1 - z0 + 0.1, (x0 + x1) / 2, (z0 + z1) / 2) } // sofá: un poco más de margen que los demás muebles (Gabriela se metía en él)
export const TABLE = raw(S0, -507, -33, -14, 178) // mesa del comedor: el desayuno se come estando cerca de cualquier borde
// la mesa con un margen de 0.12 m (solid suma PAD = 0.3; por eso se le restan 0.36 al ancho y al fondo)
// (con más margen no se podía pasar entre la punta de la mesa y el sofá)
solid(TABLE[1] - TABLE[0] - 0.36, TABLE[3] - TABLE[2] - 0.36, (TABLE[0] + TABLE[1]) / 2, (TABLE[2] + TABLE[3]) / 2)
// mamá, en la cocina: más adelante y lejos de la nevera, a la derecha de la fila de sillas del comedor (antes en HX - 2.0, -1.8: al ir a
// abrazarla, Gabriela atravesaba el espaldar de una silla; en HX - 1.2 todavía la rozaba): así va casi derecho desde su puesto en el comedor
export const MOM_SPOT = { x: HX - 0.6, z: -1.5 }
// silla del comedor donde Gabriela se sienta a comer (la de atrás a la derecha: mira hacia la mesa y hacia la cámara). y: altura del asiento (medida en el modelo)
export const DINING_SEAT = { x: S0.x - 0.945, z: -0.265, face: 0, y: 0.775, mesa: true }
// desayuno en la mesa, frente a esa silla (assets/casa/desayuno): el plato cerca de Gabriela y la taza hacia el centro de la mesa. Tres modelos:
// lleno, a medio comer y vacío; setDesayuno elige cuál se ve (main.js: se va vaciando mientras come). Brilla solo cuando toca comer
const breakfast = new THREE.Group(); breakfast.position.set(DINING_SEAT.x, 0.96, TABLE[2] + 0.4); breakfast.rotation.y = Math.PI; cur.add(breakfast)
suelto(breakfast, [['Desayunolleno', 'Desyunolleno_osc'], ['Desyunomediolleno', 'Desyunomediolleno_osc'], ['DesyunoVacio', 'DesyunoVacio_osc']].map(p => p.map(n => `assets/casa/desayuno/${n}.fbx`)),
    0.00107, { Loza: '#E4FFFF', Clara: '#E4FFFF', Yema: '#F2C063', Arepa: '#D8C8AE', Cafe: '#A16A49', Material: '#A16A49', Salchicha: '#BF4E24' }, /^(Plato|Taza)$/)
export const ESTADOS_DESAYUNO = ['lleno', 'medio', 'vacio']
export function setDesayuno(estado) { const i = ESTADOS_DESAYUNO.indexOf(estado); breakfast.children.slice(1).forEach((g, k) => { g.visible = k === i }) }
// ventanas de la sala: el marco y el alféizar salen de la pared, y Gabriela se metía en ellas (la del fondo, entre las cortinas, y la de la pared izquierda)
solid(3.3, 0.3, S0.x + 3.43, -3.0); solid(0.3, 1.5, S0.x - 4.62, 0.85)
solid(0.4, 0.4, MOM_SPOT.x, MOM_SPOT.z)                              // mamá (el modelo vive en npcs.js): solo su cuerpo, para no cerrar el paso entre la mesa y la cocina
RECTS.HOUSE = [raw(R0, -350, 360, -310, 325)]; RECTS.HOME = [raw(S0, -740, 1030, -490, 505 + SALA_EXTRA)] // piso caminable (adentro de las paredes)

// 9. Calle: isla flotante con campo. Sale de la casa de Gabriela y avanza en Z hasta la universidad (como en el plano)
into('STREET')
const RB = ROUTE.reduce((b, [x, z]) => [Math.min(b[0], x), Math.max(b[1], x), Math.min(b[2], z), Math.max(b[3], z)], [Infinity, -Infinity, Infinity, -Infinity])
const FX0 = RB[0] - 12, FX1 = RB[1] + 36, FZ0 = RB[2] - 22, FZ1 = RB[3] + 22 // el campo llega lejos de la calle: nunca se ve el vacío
// el pasto se extiende ORILLA m más allá en cada lado: en el celular de pie la cámara se aleja (camera.js) y junto a la casa se veía el vacío
// (solo cambia el tamaño del campo: FX0… siguen marcando dónde va la calle y los árboles sueltos)
const ORILLA = 30
const field = box(FX1 - FX0 + 2 * ORILLA, 0.5, FZ1 - FZ0 + 2 * ORILLA, (FX0 + FX1) / 2, -0.4, (FZ0 + FZ1) / 2, '#799180', '#482642') // campo (superficie y = -0.15)
box(FX1 - FX0 + 2 * ORILLA - 1.4, 0.9, FZ1 - FZ0 + 2 * ORILLA - 1.4, (FX0 + FX1) / 2, -1.1, (FZ0 + FZ1) / 2, '#A16A49', '#201826') // base de tierra flotante
// Piso de la calle: baldosas (assets/calle/decoraciones/floor_tiles_18, copias de 1k: las de 2k pesaban 9 MB). La textura se repite cada
// BALDOSA metros, medida sobre el mundo (cada caja ajusta sus coordenadas a su tamaño): así no se estira en los tramos largos. El color
// del material la tiñe: blanco en calma (sus colores tal cual) y el de tensión de la calle con la ansiedad
const BALDOSA = 6, texCalle = (n, srgb) => { const t = new THREE.TextureLoader().load(`assets/calle/decoraciones/floor_tiles_18_2k/floor_tiles_18_${n}_1k.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t }
// (versión suave de la textura: 6 % de ella sobre el beige de la calle (antes 35 % y 15 %: todavía se veía fuera de lugar), y sin relieve: así no se ve tan marcada y queda plana como el resto
// del juego. Antes iba completa, con su mapa de normales y aclarada: se veía muy distinta al resto)
const pisoCalle = mat('#FFFFFF', '#71708A', { map: texCalle('suave', true), roughness: 0.9 })
// Las coordenadas de la textura salen de la posición en el mundo (x, z), no de cada caja: donde se juntan dos tramos la textura sigue igual.
// Por eso todos los tramos (y las calles cerradas) van a la misma altura: donde se montan se dibuja lo mismo y no se nota la unión (antes
// cada uno estaba 2 mm más arriba que el anterior y en cada esquina quedaba una raya)
const baldosas = (m) => {
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + m.position.x) / BALDOSA, -(pos.getZ(i) + m.position.z) / BALDOSA)
    m.material = pisoCalle; return m
}
SEGS.forEach((s, i) => { // los cuatro tramos (el primero sigue detrás de la valla hasta el borde del campo)
    const r = ROADS[i].slice(); if (i === 0) r[0] = FX0 + 1
    baldosas(box(r[1] - r[0], 0.1, r[3] - r[2], (r[0] + r[1]) / 2, -0.05, (r[2] + r[3]) / 2, '#D8C8AE', '#71708A'))
})
// tramo de la calle eterna: se estira a lo largo (escala en z), así que lleva su propia copia de la textura y la repite según lo estirado
const pisoExt = mat('#FFFFFF', '#71708A', { map: texCalle('suave', true), roughness: 0.9 })
const roadExt = baldosas(box(6, 0.1, 1, UX, -0.04, GATE, '#D8C8AE', '#71708A')); roadExt.material = pisoExt; roadExt.visible = false
baldosas(box(PATH[1] - PATH[0], 0.06, PATH[3] - PATH[2], HOME_DOOR.x, -0.07, (PATH[2] + PATH[3]) / 2, '#D8C8AE', '#71708A')) // caminito de la casa de Gabriela
// Andén de concreto a los lados de la calle, con pedazos de pasto cada tanto (SECTIONS: los que sirven para el Earthing)
GRASS_STRIPS.forEach(([x0, x1, z0, z1]) => box(x1 - x0, 0.06, z1 - z0, (x0 + x1) / 2, -0.12, (z0 + z1) / 2, '#ABA397', '#4A4452'))
// Detrás del andén, donde están las casas y edificios: lotes de concreto (entre los edificios no hay pasto)
GRASS.forEach(({ r: [x0, x1, z0, z1], far, axis }, i) => {
    const L = 12, r = axis === 'x' ? (far ? [x0, x1, z0 - L, z0] : [x0, x1, z1, z1 + L]) : (far ? [x0 - L, x0, z0, z1] : [x1, x1 + L, z0, z1]) // L: hasta bien atrás de las casas (antes 4.2: detrás se veía pasto)
    box(r[1] - r[0], 0.06, r[3] - r[2], (r[0] + r[1]) / 2, -0.125 + (i % 4) * 0.0015, (r[2] + r[3]) / 2, '#968E81', '#3F3A47') // alturas apenas distintas: donde se cruzan no parpadean
})
const sectionMesh = scatter(new THREE.BoxGeometry(1, 0.07, 1), '#799180', '#482642', SECTIONS.map(({ r: [x0, x1, z0, z1] }) => [(x0 + x1) / 2, -0.115, (z0 + z1) / 2, x1 - x0, 1, z1 - z0]))

// Bordillos: una línea continua a cada lado (una caja por pedazo de línea), a 3.15 del eje. Se corta solo donde se abre otra calle, una calle
// cerrada o el caminito de la casa, justo en el borde de esa calle: ahí empieza su bordillo, así que las dos líneas se tocan. En cada esquina
// la línea se alarga CURB_D más allá del asfalto para cruzarse con la del otro tramo (antes eran cajitas de 0.8 m que no llegaban a las
// esquinas: quedaban huecos y escalones)
const curbs = [], stains = [], BORDILLO = 0.03, CURB_D = 0.34, CURB_C = HW + 0.15 // altura de la cara de arriba · grosor · distancia al eje
const CORTES = ROADS.concat(STUBS.map(o => o.r), [grow(PATH, 0.15)])
function bordillo(lista, axis, c, a0, a1, propio) { // c: coordenada fija · [a0, a1]: de dónde a dónde, a lo largo · propio: su calle (no la corta)
    let tramos = [[a0, a1]]
    CORTES.forEach(r => {
        if (r === propio) return
        const [u0, u1, v0, v1] = axis === 'x' ? r : [r[2], r[3], r[0], r[1]] // u: a lo largo de la línea · v: a lo ancho
        if (c + CURB_D / 2 <= v0 || c - CURB_D / 2 >= v1) return
        tramos = tramos.flatMap(([p, q]) => q <= u0 || p >= u1 ? [[p, q]] : [[p, Math.min(q, u0)], [Math.max(p, u1), q]].filter(([m, n]) => n - m > 0.05))
    })
    tramos.forEach(([p, q]) => lista.push(axis === 'x' ? [(p + q) / 2, BORDILLO - 0.03, c, q - p, 1, 1, 0] : [c, BORDILLO - 0.03, (p + q) / 2, q - p, 1, 1, Math.PI / 2]))
}
SEGS.forEach((s, i) => {
    const R = ROADS[i], [a0, a1] = s.axis === 'x' ? [R[0], R[1]] : [R[2], R[3]] // de punta a punta del asfalto: la esquina exterior también lleva andén
    const e0 = i > 0 ? CURB_D : 0, e1 = i < SEGS.length - 1 ? CURB_D : 0 // en las esquinas se alarga (en la valla y en la universidad, no)
    const [lo, hi] = s.dir > 0 ? [a0 - e0, a1 + e1] : [a0 - e1, a1 + e0]
    ;[-1, 1].forEach(side => bordillo(curbs, s.axis, (s.axis === 'x' ? s.z0 : s.x0) + side * CURB_C, lo, hi, R))
    for (let k = 0; k < s.len * 1.1; k++) stains.push(s.axis === 'x' // manchas del camino
        ? [rr(Math.max(R[0], STREET_X0) + 1, R[1] - 1), 0.01, rr(s.z0 - 2.6, s.z0 + 2.6), 1, 1, 1, rr(-.2, .2)]
        : [rr(s.x0 - 2.6, s.x0 + 2.6), 0.01, rr(R[2] + 1, R[3] - 1), 1, 1, 1, Math.PI / 2 + rr(-.2, .2)])
})
scatter(new THREE.BoxGeometry(1, 0.06, CURB_D), '#A16A49', '#201826', curbs) // bordillos: bajitos (6 cm, antes 16); cada caja se estira a su largo
// (las manchas del camino ya no se dibujan: las baldosas traen las suyas. Se siguen calculando para no correr lo que se ubica al azar después)

// Valla de obra donde se cierra la calle 1 (después del sismo): dos burros con franjas y una señal
{
    const VX = STREET_X0 - 0.3
    ;[-1.5, 1.5].forEach(dz => {
        box(0.12, 1.1, 0.12, VX, 0.45, dz - 1.2, '#A16A49', '#201826'); box(0.12, 1.1, 0.12, VX, 0.45, dz + 1.2, '#A16A49', '#201826') // patas
        for (let k = 0; k < 5; k++) box(0.14, 0.32, 0.5, VX, 0.8, dz - 1 + k * 0.5, k % 2 ? '#E4FFFF' : '#BF4E24', k % 2 ? '#71708A' : '#580213') // tabla con franjas
    })
    box(0.1, 1.9, 0.1, VX - 0.6, 0.8, -2.6, '#71708A', '#201826'); box(0.08, 0.8, 0.8, VX - 0.6, 1.9, -2.6, '#F2C063', '#580213') // señal de "calle cerrada"
}
// Calles cerradas de las esquinas: asfalto, andenes y la misma valla de obra atravesada justo después del cruce
const valla = (x, z, axis) => { // axis: hacia dónde va la calle (la valla queda atravesada)
    const bx = (w, h, d, u, y, v, c, t) => axis === 'x' ? box(w, h, d, x + u, y, z + v, c, t) : box(d, h, w, x + v, y, z + u, c, t) // u: a lo largo · v: a lo ancho
    ;[-1.5, 1.5].forEach(dv => {
        bx(0.12, 1.1, 0.12, 0, 0.45, dv - 1.2, '#A16A49', '#201826'); bx(0.12, 1.1, 0.12, 0, 0.45, dv + 1.2, '#A16A49', '#201826')
        for (let k = 0; k < 5; k++) bx(0.14, 0.32, 0.5, 0, 0.8, dv - 1 + k * 0.5, k % 2 ? '#E4FFFF' : '#BF4E24', k % 2 ? '#71708A' : '#580213')
    })
}
const stubCurbs = []
// a los lados de cada calle cerrada: andén gris claro (3.5) y lote de concreto (como en las calles de verdad); alturas un pelo distintas para que no parpadeen
STUBS.forEach(({ r, axis }, i) => [-1, 1].forEach(side => {
    const band = (d0, d1, y, c, t) => {
        const [x0, x1, z0, z1] = axis === 'x' ? [r[0], r[1], side < 0 ? r[2] - d1 : r[3] + d0, side < 0 ? r[2] - d0 : r[3] + d1] : [side < 0 ? r[0] - d1 : r[1] + d0, side < 0 ? r[0] - d0 : r[1] + d1, r[2], r[3]]
        box(x1 - x0, 0.06, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, c, t)
    }
    band(0, GW, -0.1185 + i * 0.0003, '#ABA397', '#4A4452'); band(GW, GW + 12, -0.1235 + i * 0.0003, '#968E81', '#3F3A47')
}))
STUBS.forEach(({ r, axis, sg, cx, cz }) => {
    baldosas(box(r[1] - r[0], 0.1, r[3] - r[2], (r[0] + r[1]) / 2, -0.05, (r[2] + r[3]) / 2, '#D8C8AE', '#71708A')) // (a la misma altura que la calle: ver baldosas)
    valla(axis === 'x' ? cx + sg * (HW + 5) : cx, axis === 'x' ? cz : cz + sg * (HW + 5), axis) // un poco adentro de la calle cerrada, no pegada al cruce
    // bordillos continuos desde el borde de la calle principal (ahí empieza su bordillo: se tocan) hasta el final de la calle cerrada
    const c0 = (axis === 'x' ? cx : cz) + sg * HW, c1 = c0 + sg * STUB_LEN
    ;[-1, 1].forEach(side => bordillo(stubCurbs, axis, (axis === 'x' ? cz : cx) + side * CURB_C, Math.min(c0, c1), Math.max(c0, c1), r))
})
scatter(new THREE.BoxGeometry(1, 0.06, CURB_D), '#A16A49', '#201826', stubCurbs)
// el andén gris claro también da la vuelta en las cuatro esquinas de cada cruce (antes quedaba un pedazo sin andén)
new Set(STUBS.map(o => o.cx + ',' + o.cz)).forEach(k => { const [cx, cz] = k.split(',').map(Number)
    ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => box(GW, 0.06, GW, cx + sx * (HW + GW / 2), -0.1182, cz + sz * (HW + GW / 2), '#ABA397', '#4A4452')) })
// y en los lados de cada esquina por donde no sale ninguna calle, el andén cruza de punta a punta (si no, quedaba un pedazo sin gris claro)
const roadAt = (x, z) => BLOCKED.some(r => inRect(r, x, z))
ROUTE.slice(1, -1).forEach(([cx, cz]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
    if (roadAt(cx + dx * (HW + 1), cz + dz * (HW + 1))) return
    const w = dx ? GW : HW * 2, d = dx ? HW * 2 : GW
    box(w, 0.06, d, cx + dx * (HW + GW / 2), -0.1181, cz + dz * (HW + GW / 2), '#ABA397', '#4A4452')
}))
const stubPlanterMesh = scatter(new THREE.BoxGeometry(1, 0.07, 1), '#799180', '#482642', STUB_PLANTERS.map(([x0, x1, z0, z1]) => [(x0 + x1) / 2, -0.115, (z0 + z1) / 2, x1 - x0, 1, z1 - z0]))

// Casas y edificios: cada uno es un grupo con su base en el origen y la puerta en su +z local (rotY la gira hacia la calle).
// Su planta no se puede atravesar (antes se podía caminar por dentro de las esquinas)
const plantaSolida = (w, d, x, z, ry) => { const giro = Math.abs(Math.sin(ry)) > 0.5; solid(giro ? d : w, giro ? w : d, x, z); SOLIDS[SOLIDS.length - 1].edificio = true } // (edificio: los árboles no se ponen encima, ver tree)
// Modelos de la calle (assets/calle/edificios): cinco casas y edificios, cada uno con su versión oscura (nivel 3 de ansiedad). Los cinco
// archivos traen los mismos cinco edificios en fila, así que se carga uno normal y uno oscuro y se separan por malla. En el archivo la
// fachada mira hacia +x: se giran para que la puerta quede en el +z del grupo, como las casas de antes, con el frente donde estaba el de
// ellas (z +1.7) y el resto hacia atrás. Medidas en unidades del archivo (ancho: a lo largo de la calle · fondo · alto) · pared: el material de
// su pared principal · puerta: cuánto está corrida la puerta del centro de la fachada (hacia la derecha, mirándola)
const EDIFICIOS = {
    casita: { malla: 'Edificio1', ancho: 480, fondo: 277, alto: 225, pared: 'Pared 1' },
    casa: { malla: 'Cubo001', ancho: 517, fondo: 322, alto: 310, pared: 'Cadera clara', puerta: 135 }, // (puerta medida en el modelo: de z -179 a -90; con 79 quedaba corrida del caminito)
    tienda: { malla: 'Cubo002', ancho: 751, fondo: 344, alto: 416, pared: 'Pared 1' },     // la del toldo
    edificio: { malla: 'Cubo', ancho: 420, fondo: 420, alto: 515, pared: 'Cadera clara' },
    torre: { malla: 'Cubo003', ancho: 419, fondo: 420, alto: 806, pared: 'Edificio1' }
}
const ESCALA_EDIF = 0.0129, ANCHO_EDIF = 6.6, FRENTE = 1.7 // escala de Gabriela (1.8 m = 140 unidades) · ancho máximo de un lote · dónde queda la fachada
// alto: tope de altura (los del lado cercano a la cámara son bajitos: no tapan la calle). La tienda es muy ancha: se achica para caber en su lote
const escalaEdif = (e, alto = Infinity) => Math.min(ESCALA_EDIF, ANCHO_EDIF / e.ancho, alto / e.alto)
const fachadas = [] // grupos que esperan su modelo
let nFachada = 0
// opciones: alto (tope de altura) · frente (dónde queda la fachada) · centrarPuerta (la puerta en el centro del grupo, para la casa de Gabriela) ·
// solido: false si la planta sólida se pone aparte
// cerca: del lado cercano a la cámara (se desvanece cuando Gabriela pasa detrás, ver transparentar)
const fachada = (x, z, tipo, ry = 0, { alto, frente = FRENTE, centrarPuerta = false, solido = true, cerca = false } = {}) => {
    const e = EDIFICIOS[tipo], k = escalaEdif(e, alto), d = e.fondo * k, g = new THREE.Group()
    g.position.set(x, -0.15, z); g.rotation.y = ry
    const c = frente - d / 2 // la planta sólida: del frente hacia atrás
    // si el edificio se mete más de medio metro en lo que se camina (la calle o el andén; p. ej. en una esquina, el andén de la calle que cruza), ese lote
    // queda vacío: Gabriela se atoraba contra él y quedaba escondida detrás. (Normalmente la fachada pisa 0.2 m del andén: eso está bien)
    if (solido) {
        const cx = x + Math.sin(ry) * c, cz = z + Math.cos(ry) * c, giro = Math.abs(Math.sin(ry)) > 0.5, hw = (giro ? d : e.ancho * k) / 2, hd = (giro ? e.ancho * k : d) / 2
        if (RECTS.STREET.concat(GRASS_STRIPS).some(r => cx - hw < r[1] - 0.5 && cx + hw > r[0] + 0.5 && cz - hd < r[3] - 0.5 && cz + hd > r[2] + 0.5)) return null
        plantaSolida(e.ancho * k - 0.3, d - 0.3, cx, cz, ry)
    }
    fachadas.push({ g, e, k, frente, dx: centrarPuerta ? -(e.puerta || 0) * k : 0, v: nFachada++, cerca }); cur.add(g); return warpable(g, x * 1.7 + z, true)
}
// cada edificio: la malla del archivo centrada (en x y z) con la base en y = 0
const plantillas = (o) => {
    o.updateMatrixWorld(true); const out = {}, caja = new THREE.Box3(), centro = new THREE.Vector3()
    o.traverse(m => {
        if (!m.isMesh) return
        caja.setFromObject(m).getCenter(centro)
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld).translate(-centro.x, -caja.min.y, -centro.z)
        out[m.name] = { g, mats: m.material }
    })
    return out
}
// Casas del lado cercano: tapan casi la mitad del andén desde la cámara y Gabriela se perdía detrás de ellas (parecía atorada). Cuando pasa
// por detrás de una (a menos de 5 m y con la casa entre ella y la cámara), la casa se vuelve casi transparente; al alejarse, vuelve
const transparentes = [], camDir = new THREE.Vector2()
function transparentar(dt, px, pz) {
    if (runtime.space !== 'STREET' || px === undefined) return
    const az = THREE.MathUtils.degToRad(CONFIG.camera.azimuth); camDir.set(Math.sin(az), Math.cos(az)) // hacia dónde está la cámara (en el piso)
    for (const fa of transparentes) {
        const gx = fa.g.position.x - px, gz = fa.g.position.z - pz
        const tapa = Math.hypot(gx, gz) < 5 && gx * camDir.x + gz * camDir.y > 0.5
        const quiere = tapa ? 0.22 : 1; fa.o ??= 1
        if (Math.abs(fa.o - quiere) < 0.005) continue
        fa.o += (quiere - fa.o) * Math.min(1, dt * 6); if (Math.abs(fa.o - quiere) < 0.01) fa.o = quiere
        fa.mats.forEach(m => { m.opacity = fa.o; m.depthWrite = fa.o > 0.99 })
    }
}
// Colores: cada edificio toma su pared principal y sus detalles (techo, marcos) de la paleta del juego, cada uno con su pareja de ansiedad:
// así no hay dos vecinos iguales y todos cambian con el nivel de ansiedad como el resto del mundo. La madera y las ventanas son las de siempre
const MUROS = [['#D8C8AE', '#71708A'], ['#A6869B', '#482642'], ['#BF895A', '#580213'], ['#F2C063', '#580213'], ['#8296B7', '#201826'], ['#A16A49', '#201826']]
const PAREDES = ['Pared 1', 'Edificio1', 'Cadera clara']
{
    const cache = {}
    // (los del lado cercano llevan materiales propios: se desvanecen cada uno por su cuenta)
    const tono = ([calm, tense], propio) => propio ? mat(calm, tense, { flatShading: false, transparent: true }) : cache[calm + tense] ||= mat(calm, tense, { flatShading: false })
    const pintor = (e, v, propio) => (m) => {
        if (PAREDES.includes(m.name)) return tono(MUROS[m.name === e.pared ? v % MUROS.length : (v * 3 + 2) % MUROS.length], propio) // la principal y los detalles, de colores distintos
        const calm = MODEL_COLORS[m.name] || nearestPal(m.color); return tono([calm, PAIRS[calm] || '#201826'], propio)
    }
    const cargar = (url) => new Promise(res => { pendientes++; fbx.load(url, o => { res(plantillas(o)); if (--pendientes === 0) avisarListos() }, undefined, () => { res(null); if (--pendientes === 0) avisarListos() }) })
    Promise.all([cargar('assets/calle/edificios/Edificio-1.fbx'), cargar('assets/calle/edificios/Edificios_oscuros-1.fbx')]).then(([normal, oscuro]) => {
        fachadas.forEach((fa) => {
            const { g, e, k, frente, dx, v, cerca } = fa
            const pair = { normal: null, dark: null }, paint = pintor(e, v, cerca)
            ;[[normal, 'normal'], [oscuro, 'dark']].forEach(([pl, clave]) => {
                const p = pl?.[e.malla]; if (!p) return
                const m = new THREE.Mesh(p.g, Array.isArray(p.mats) ? p.mats.map(paint) : paint(p.mats))
                m.scale.setScalar(k); m.rotation.y = -Math.PI / 2; m.position.set(dx, 0, frente - e.fondo * k / 2); m.visible = clave === 'normal'
                g.add(m); pair[clave] = m
                if (cerca) (fa.mats ||= []).push(...[m.material].flat())
            })
            MODELS.push(pair)
            if (cerca) transparentes.push(fa)
        })
    })
}
// casa de Gabriela: la casa del modelo con su puerta justo al final del caminito (no se mueve en los sustos). Su planta sólida es la de antes
// (el frente en z + 1.55): así se sigue llegando a la puerta
fachada(HOME_DOOR.x, HOME_DOOR.z, 'casa', 0, { frente: 1.55, centrarPuerta: true, solido: false }).userData.warp.home = true
plantaSolida(5.7, 2.5, HOME_DOOR.x, HOME_DOOR.z, 0)
const placed = [[HOME_DOOR.x, HOME_DOOR.z]]
const put = (f, x, z, ...a) => { placed.push([x, z]); f(x, z, ...a) }
const casa = (x, z, k, ry = 0) => { rr(5.5, 7); fachada(x, z, k % 3 ? 'casa' : 'tienda', ry) }  // (rr: el ancho que sorteaba la casa de antes; se sigue sorteando para que lo demás del mapa no cambie)
const alto = (x, z, h, ry = 0) => fachada(x, z, h > 9.5 ? 'torre' : 'edificio', ry)
// lado cercano a la cámara (se le ve la espalda): casas y tiendas bajitas (2.2 m como mucho), más juntas y no todas iguales. La casita gris no:
// su espalda se veía como una caja
const BAJAS = ['casa', 'tienda']
const bajita = (x, z, ry, k) => { rr(5.5, 7); fachada(x, z, BAJAS[k % 2], ry, { alto: 2.2, cerca: true }) }
;[5, 12, 19, 26, 33, 40, 47].forEach((x, i) => { const h = i % 2 ? rr(8, 11) : rr(3.6, 5); i % 2 ? put(alto, x, -8, h) : put(casa, x, -8, i) }) // fila de casas sobre la calle 1 (como en el plano)
;[-10.5, -17.5, -24.5].forEach((x, i) => { const h = i % 2 ? rr(3.6, 5) : rr(8, 11); i % 2 ? put(casa, x, -8, i + 2) : put(alto, x, -8, h) }) // la fila sigue a la izquierda de la casa de Gabriela
rr(3.6, 5); put(casa, -34, -8, 0); put(alto, -36, -17, rr(8, 11))                                       // detrás de la valla: la ciudad continúa
// Todos los tramos (también el resto de la calle 1 y su lado cercano): casas y edificios a los dos lados. Lado lejano a la cámara (arriba / izquierda en pantalla): altos.
// Lado cercano: casas bajas, para que nunca tapen la calle ni al personaje
const nearUni = (x, z) => Math.abs(x - UX) < 11 && z < GATE + 5
const freeLot = (x, z, gap = 6.8) => !BLOCKED.some(r => inRect(grow(r, 4.6), x, z)) && !placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < gap) && !nearUni(x, z)
SEGS.forEach(s => {
    const r = segRect(s, 0), [a0, a1] = s.axis === 'x' ? [r[0], r[1]] : [r[2], r[3]]
    ;[-1, 1].forEach(side => {
        for (let t = a0 + rr(1, 3); t < a1; t += side > 0 ? rr(4.4, 5.2) : rr(6.8, 8)) { // (del lado cercano, más seguidas: son más pequeñas)
            const [x, z] = s.axis === 'x' ? [t, s.z0 + side * 8] : [s.x0 + side * 8, t]
            if (!freeLot(x, z, side > 0 ? 4.2 : 6.8)) continue
            const ry = s.axis === 'x' ? (side < 0 ? 0 : Math.PI) : (side < 0 ? Math.PI / 2 : -Math.PI / 2), k = placed.length
            if (side > 0) { rr(2.4, 3.2); put(bajita, x, z, ry, k) }
            else if (k % 2) put(alto, x, z, rr(8, 11), ry)
            else { rr(3.6, 5); put(casa, x, z, k, ry) }
        }
    })
})

// Calles cerradas: también con casas y edificios a los dos lados (altos del lado lejano a la cámara, bajos del cercano) y árboles en el andén
STUBS.forEach(({ axis, sg, cx, cz }) => {
    ;[-1, 1].forEach(side => {
        for (let t = HW + 4.5; t < HW + STUB_LEN + 3; t += side > 0 ? 4.8 : 7.2) {
            const u = (axis === 'x' ? cx : cz) + sg * t, [x, z] = axis === 'x' ? [u, cz + side * 8] : [cx + side * 8, u]
            if (!freeLot(x, z, side > 0 ? 4.2 : 6.8)) continue
            const ry = axis === 'x' ? (side < 0 ? 0 : Math.PI) : (side < 0 ? Math.PI / 2 : -Math.PI / 2), k = placed.length
            if (side > 0) { rr(2.4, 3.2); put(bajita, x, z, ry, k) }
            else if (k % 2) put(alto, x, z, rr(8, 11), ry)
            else { rr(3.6, 5); put(casa, x, z, k, ry) }
        }
    })
    for (let t = HW + 3.5; t < HW + STUB_LEN; t += 7) { const u = (axis === 'x' ? cx : cz) + sg * t, [x, z] = axis === 'x' ? [u, cz - 5.4] : [cx - 5.4, u]; if (!nearUni(x, z) && !inRect([UX - 9, UX + 9, GATE - 10, GATE], x, z)) tree(x, z) } // (ninguno metido en la universidad)
})

// Vegetación: juncos y flores en el pasto de los lados de la calle y detrás de la valla
// las esquinas también son de concreto (antes eran pasto): una losa en cada cuadrante (queda debajo de la calle, los andenes y los lotes)
ROUTE.slice(1, -1).forEach(([cx, cz]) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => box(18.5, 0.06, 18.5, cx + sx * 9.25, -0.128, cz + sz * 5.35, '#968E81', '#3F3A47')))
const DECOR = SECTIONS.map(s => grow(s.r, -0.4)).concat(STUB_PLANTERS.map(r => grow(r, -0.4)), [[-41, STREET_X0 - 1.5, -12, 12]])
const pick = () => { const a = DECOR[Math.floor(rng() * DECOR.length)]; return [rr(a[0], a[1]), rr(a[2], a[3])] }
// matas de pasto (pasto.fbx): de a tres juntas, de 30 a 60 cm, del beige de los juncos de antes (sobre el verde de las jardineras se ven)
const matas = []; for (let k = 0; k < 260; k++) { const [x, z] = pick(); for (let j = 0; j < 3; j++) { const a = rr(0.3, 0.6); matas.push([x + rr(-.25, .25), -0.12, z + rr(-.25, .25), a, a * 47]) } } // (tres números por mata, como los juncos: el giro sale del alto)
const pastoMat = mat('#D8C8AE', '#71708A')
piezasDe(D + 'pasto.fbx', 'scene001').then(p => copias(p, matas, GROUPS.STREET, { hoja: pastoMat, resto: pastoMat }))
grassOf(field, '#799180', '#482642', '#6FA86B'); grassOf({ material: pastoMat }, '#D8C8AE', '#71708A', '#8DBE7A'); grassOf(sectionMesh, '#799180', '#482642', '#5FB04F'); grassOf(stubPlanterMesh, '#799180', '#482642', '#5FB04F') // en el Earthing el pasto se satura de verde
scatter(new THREE.SphereGeometry(0.09, 6, 4), '#F2C063', '#790A0E', Array.from({ length: 420 }, () => { const [x, z] = pick(); return [x, -0.08, z] }))
// Árboles: los de la calle 1 a mano; en los otros tramos, entre las casas del lado lejano; y otros sueltos por el campo
;[[9, -5], [16, -5.4], [30, -5.2], [37, -5.6], [44, -5.4], [51, -5], // (los del lado cercano se quitaron: ahí ahora hay casas)
  [-9, -5.4], [-21, -5.6], [-27.5, -5.2],
  [-34, -4], [-37, 3], [-35, 9], [-39, -9], [-33, -13], [-38, 15], [-29, 14], [-18, 15], [-6, 14], [8, 15], [24, 14],
  [-14, -15], [-27, -14], [-21, -19], [-7, -16]].forEach(([x, z]) => tree(x + rr(-.5, .5), z))
SEGS.slice(1).forEach(s => {
    const r = segRect(s, 0), [a0, a1] = s.axis === 'x' ? [r[0], r[1]] : [r[2], r[3]]
    for (let t = a0 + rr(2, 5); t < a1; t += rr(7, 11)) {
        const [x, z] = s.axis === 'x' ? [t, s.z0 - 5.4] : [s.x0 - 5.4, t]
        if (!BLOCKED.some(o => inRect(grow(o, 0.5), x, z)) && !nearUni(x, z)) tree(x, z)
    }
})
for (let k = 0, n = 0; k < 400 && n < 35; k++) { // árboles sueltos detrás de las casas: solo en la franja que alcanza a ver la cámara (más lejos no se ven y solo pesaban)
    const x = rr(FX0 + 3, FX1 - 3), z = rr(FZ0 + 3, FZ1 - 3)
    if (!BLOCKED.some(r => inRect(grow(r, 18), x, z))) continue
    if (BLOCKED.some(r => inRect(grow(r, 9), x, z)) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 6) || nearUni(x, z) || (x < STREET_X0 && Math.abs(z) < 4)) continue
    tree(x, z); n++
}

// Paradero del MIO (la marca roja del plano)
model('assets/bus/parada/parada-mio.fbx', 'assets/bus/parada/parada-mio-oscuro.fbx', cur, 0.012, W.busX - 1.8, -0.09, -4.3) // modelo final del paradero
// el paradero es sólido de punta a punta (banca, pared de atrás y todo lo que cubre el techo, hasta los postes del frente): antes se
// podía caminar debajo del techo y la prota quedaba tapada por él
solid(3.85, 1.3, W.busX - 1.8, -4.1)

// Universidad al final del último tramo (se aleja cuando la calle se vuelve eterna)
const UNI_Z = GATE - 5, uniG = new THREE.Group(); uniG.position.set(UX, -0.15, UNI_Z); cur.add(uniG)
box(14, 7, 8, 0, 3.5, 0, '#799180', '#8296B7', uniG); box(15, 0.4, 9, 0, 7.2, 0, '#A16A49', '#201826', uniG)
box(4, 3, 0.2, 0, 1.5, 4.05, '#A16A49', '#201826', uniG); box(6, 0.8, 0.15, 0, 5.6, 4.1, '#F2C063', '#580213', uniG)
;[-5, -3, 3, 5].forEach(dx => box(0.6, 6.6, 0.6, dx, 3.3, 4.2, '#D8C8AE', '#71708A', uniG))
box(6, 0.3, 1.4, 0, 0.15, 4.75, '#D8C8AE', '#71708A', uniG)
box(0.3, 1.2, 9, -8.5, 0.6, 0, '#A16A49', '#201826', uniG); box(0.3, 1.2, 9, 8.5, 0.6, 0, '#A16A49', '#201826', uniG) // muros del campus
scatter(new THREE.BoxGeometry(0.9, 1, 0.1), '#8296B7', '#201826', [-6, -1.8, 1.8, 6].flatMap(x => [[x, 4.3, 4.05], [x, 6.3, 4.05]]).filter(([x, y]) => Math.abs(x) > 2.1 || y > 5), uniG)

// Capas destruida / reconstruida: edificios del fondo (lado lejano), postes junto al andén y escombros del lado cercano de la calle 1
const mid = [], posts = [] // (posts: los postes del andén, que ya no se dibujan)
SEGS.forEach((s, i) => {
    const r = segRect(s, 0), [a0, a1] = s.axis === 'x' ? [Math.max(r[0], STREET_X0), r[1]] : [r[2], r[3]]
    for (let t = a0 + 4, j = 0; t < a1 - 2; t += 9, j++) {
        const [x, z] = s.axis === 'x' ? [t, s.z0 - 16] : [s.x0 - 16, t]
        const it = s.axis === 'x' ? [x, z, 6, 6 + (j * 3) % 5, 4] : [x, z, 4, 6 + (j * 3) % 5, 6]
        // en las esquinas, los del tramo en x y los del tramo en z quedaban encimados (con una cara en el mismo plano: las texturas titilaban)
        const choca = mid.some(([mx, mz, mw, , md]) => Math.abs(mx - x) < (mw + it[2]) / 2 + 0.6 && Math.abs(mz - z) < (md + it[4]) / 2 + 0.6)
        if (!BLOCKED.some(o => inRect(grow(o, 8), x, z)) && !nearUni(x, z) && !choca) mid.push(it)
    }
    for (let t = a0 + 6; t < a1 - 3; t += rr(9, 12)) {
        const [x, z] = s.axis === 'x' ? [t, s.z0 - 3.5] : [s.x0 - 3.5, t]
        if (!ROADS.some((o, j) => j !== i && inRect(grow(o, 1), x, z)) && Math.abs(x - (W.busX - 1.8)) > 4 && !inRect(grow(PATH, 1.5), x, z)) posts.push([x, z, 0.3, 3.5, 0.3])
    }
})
makeLayer('MID', mid)
// Del lado cercano, detrás de las casas que muestran su espalda: más edificios "falsos" como los del fondo (cajas que se ven destruidas y se
// reconstruyen con el progreso), pero bajitos para no tapar la calle. Antes ahí solo se veía el lote vacío
const cerca = [], ATRAS = 12.5 // qué tan lejos del centro de la calle (las casas están a 8)
const cajaCerca = (x, z, alongX, j) => {
    const h = j % 3 === 1 ? 3 + (j * 5) % 3 * 0.4 : 1.4 + (j * 7) % 4 * 0.3 // casi todos de 1.4 a 2.3 m (no más altos que las casas de adelante); uno de cada tres, de 3 a 3.8 m
    const it = alongX ? [x, z, 4, h, 3.4] : [x, z, 3.4, h, 4]
    const choca = cerca.some(([mx, mz, mw, , md]) => Math.abs(mx - x) < (mw + it[2]) / 2 + 0.4 && Math.abs(mz - z) < (md + it[4]) / 2 + 0.4)
    if (!BLOCKED.some(o => inRect(grow(o, 5.5), x, z)) && !nearUni(x, z) && !choca) cerca.push(it)
}
SEGS.forEach(s => {
    const r = segRect(s, 0), [a0, a1] = s.axis === 'x' ? [Math.max(r[0], STREET_X0), r[1]] : [r[2], r[3]]
    for (let t = a0 + 2, j = 0; t < a1 - 1; t += 4.8, j++) cajaCerca(...(s.axis === 'x' ? [t, s.z0 + ATRAS] : [s.x0 + ATRAS, t]), s.axis === 'x', j)
})
STUBS.forEach(({ axis, sg, cx, cz }) => {
    for (let t = HW + 7, j = 0; t < HW + STUB_LEN + 3; t += 4.8, j++) { const u = (axis === 'x' ? cx : cz) + sg * t; cajaCerca(...(axis === 'x' ? [u, cz + ATRAS] : [cx + ATRAS, u]), axis === 'x', j + 1) }
})
makeLayer('CERCA', cerca)
// (los postes del andén ya no se dibujan: sobraban. Se siguen calculando para no correr lo que se ubica al azar después)
// (sin capa de escombros al frente de la calle 1: ahora ahí hay casas)

// Fallas de la ansiedad (desde el nivel de falla 1: sube al perder un minijuego y baja al ganar uno): copias translúcidas de postes, muros y pedazos de edificio que titilan y
// saltan de lugar, como si la ciudad no terminara de "cargar". Mientras más ansiedad, más aparecen (ver updateGhosts)
const ghosts = [], GHOST_COLS = ['#F2C063', '#BF895A', '#D8C8AE', '#A6869B']
const GHOST_KINDS = [[0.3, 3.5, 0.3], [0.3, 2.6, 0.3], [1.4, 2.4, 0.9], [2.2, 4.5, 1.6], [3.2, 1.2, 0.5]] // poste alto · poste · bloque · pedazo de edificio · muro bajo
function makeGhost(space, x, z, k) {
    const [w, h, d] = GHOST_KINDS[k % GHOST_KINDS.length]
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: GHOST_COLS[k % GHOST_COLS.length], transparent: true, opacity: 0, depthWrite: false }))
    m.position.set(x, h / 2 - 0.15, z); m.rotation.y = rr(0, 1) < 0.5 ? 0 : Math.PI / 2; m.visible = false; GROUPS[space].add(m)
    ghosts.push({ m, space, x, z, h, rank: rr(0.05, 1), on: false, off: [0, 0] }) // rank: a partir de qué ansiedad aparece
}
for (let d = 6; d < ROUTE_LEN - 4; d += rr(3, 5.5)) { // a los lados de la calle, sobre el pasto y frente a las casas
    const [x, z, s] = routePoint(d), side = rr(0, 1) < 0.5 ? -1 : 1, off = side * rr(3.8, 7.5)
    makeGhost('STREET', s.axis === 'x' ? x + rr(-1, 1) : x + off, s.axis === 'x' ? z + off : z + rr(-1, 1), Math.floor(rr(0, 10)))
}
;[[-5.2, 1.8], [-4.0, -1.8], [-2.3, 1.6], [-6.2, -0.6], [-3.6, 0.4], [-4.9, -0.2]].forEach(([x, z], i) => makeGhost('HOUSE', x, z, i))               // cuarto
;[[HX - 4.5, -1.6], [HX - 0.5, 2.8], [HX + 3.4, -2.6], [HX + 5.2, 1.0], [HX - 5.2, 2.6], [HX + 0.2, -1.2]].forEach(([x, z], i) => makeGhost('HOME', x, z, i + 2)) // planta baja
export const GHOSTS = ghosts // (npcs.js: tocarlas calma un poco, ver la mecánica secreta)
function updateGhosts() {
    const k = runtime.postQuake && runtime.glitch >= 1 ? Math.min(1, Math.max(0, (runtime.anxiety - 0.3) / 0.55)) : 0 // nivel de falla 1 o más (sube al perder un minijuego y baja al ganar) · 0 = nada · 1 = todas las fallas
    ghosts.forEach(g => {
        if (g.space !== runtime.space) return
        const want = g.rank < k && !(g.calm > performance.now()) // una falla que tocaste no vuelve por un rato
        if (!want) { if (g.on) { g.on = false; g.m.visible = false } return }
        if (!g.on || Math.random() < 0.04) g.off = [rr(-0.6, 0.6), rr(-0.6, 0.6)] // de vez en cuando salta a otro lado
        g.on = true
        g.m.visible = Math.random() > 0.06                                               // titila
        g.m.material.opacity = (0.18 + 0.3 * Math.random()) * Math.min(1, (k - g.rank) * 4 + 0.3)
        g.m.position.set(g.x + g.off[0], g.h / 2 - 0.15 - (Math.random() < 0.05 ? rr(0, 0.6) : 0), g.z + g.off[1])
        g.m.scale.y = Math.random() < 0.05 ? rr(0.7, 1.4) : 1                            // a veces se estira, como una imagen mal cargada
    })
}

// 10. Interior del MIO: otro espacio flotando en el vacío (entras y sales por la puerta)
into('BUS')
const BX = W.busInteriorX
box(150, 0.5, 40, BX, -1.35, 0, '#799180', '#482642')             // campo bajo el MIO (ya no flota en el vacío)
box(150, 0.1, 5.2, BX, -1.07, 0, '#71708A', '#201826')             // calle por la que avanza el MIO (las ruedas del modelo la tocan)
// El interior es el modelo final (bus.fbx), escalado al tamaño del MIO del juego: el piso queda en y = 0 y el frente (conductor) hacia +x
const BUS_S = 0.016, BUS_X = BX + 0.128 // 0.128: el modelo no está centrado en su origen
// Asientos del modelo (medidos sobre el FBX, en unidades del archivo): malla, centro del cojín (x, z) y hacia dónde mira quien se sienta.
// El espaldar de casi todos queda atrás (-x): miran hacia el conductor. Las dos bancas largas se miran entre sí (una hacia +z y otra hacia -z)
const SEAT_DEFS = [['Cube005', -244, -64, 0], ['Cube006', -149.5, -64, 0], ['Cube007', -47.5, -64, 0], ['Cube008', 49, -64, 0], // dobles junto a las ventanas
    ['Cube009', -175, 76, 0], ['Cube011', -94, 76, 0],                                                                          // sencillos del lado de la cámara
    ['Cube014', 153.5, -74, 1], ['Cube003', 139.5, 72.5, 2], ['Cube013', -328.5, 0.5, 0]]                                      // bancas largas y la del fondo
export const SEAT_Y = 94 * BUS_S - 1.024 // altura del cojín (ahí se apoya quien se sienta)
SEAT_DEFS.forEach(([name, x, z, f]) => { // brillo suave alrededor de cada asiento libre, con la forma de la silla (main.js lo enciende mientras estás de pie)
    const glow = new THREE.Group(); glow.visible = false; cur.add(glow)
    // adelante: cuánto más al frente del cojín se sienta (en las bancas largas el espaldar es más grueso: con 0.1 se metía en él; en la del
    // fondo, Cube013, se metía en la pared de atrás del MIO)
    SEATS.push({ name, x: BUS_X + x * BUS_S, z: z * BUS_S, face: [Math.PI / 2, 0, Math.PI][f], taken: false, glow, adelante: name === 'Cube013' ? 0.4 : f ? 0.3 : 0.1 })
})
const LLANTA = mat('#482642', '#201826', { flatShading: false })
model('assets/bus/interior/bus.fbx', 'assets/bus/interior/bus_Oscuro.fbx', cur, BUS_S, BUS_X, -1.024, 0, {
    colors: { 'Azul 1': '#2F7DAA' }, // el mismo azul del MIO por fuera (props.bus)
    onLoad: (o, dark) => {
        o.traverse(c => { if (c.isMesh && /^Cilindro/.test(c.name)) c.material = LLANTA }) // llantas morado oscuro (compartían el material de la carrocería)
        if (dark) return
        SEATS.forEach(s => {
            const m = o.getObjectByName(s.name); if (!m) return
            s.glow.add(shell(m, 1.12, SOFT))
            // la silla también es un obstáculo: antes Gabriela podía pararse dentro de las bancas (y quedaba metida hasta la cintura).
            // Margen pequeño (solid suma PAD = 0.3; aquí queda 0.1) para no cerrar el pasillo. Sentarse no cambia: se hace desde el pasillo
            const b = new THREE.Box3().setFromObject(m)
            solid(b.max.x - b.min.x - 0.4, b.max.z - b.min.z - 0.4, (b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, undefined, 'BUS')
        })
    }
})
solid(1.4, 1.4, BUS_X + 4.41, -1.0) // puesto del conductor: no se puede pasar
{ // volante frente al conductor (el modelo no lo trae): aro inclinado, tres rayos y la columna que baja al piso
    const wheel = new THREE.Group(), rim = mat('#D8C8AE', '#71708A'); wheel.position.set(BUS_X + 5.1, 1.0, -1.0); wheel.rotation.set(0, Math.PI / 2, 0); cur.add(wheel)
    const tilt = new THREE.Group(); tilt.rotation.x = -0.5; wheel.add(tilt)
    tilt.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 24), rim))
    ;[0, 2.1, 4.2].forEach(a => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), rim); s.position.set(Math.sin(a) * 0.16, Math.cos(a) * 0.16, 0); s.rotation.z = -a; tilt.add(s) })
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 1.0, 8), mat('#A16A49', '#201826')); col.position.set(BUS_X + 5.32, 0.5, -1.0); col.rotation.z = 0.35; cur.add(col)
}
export const DRIVER_SEAT = { x: BUS_X + 278 * BUS_S, z: -62.5 * BUS_S }
// Puertas del MIO (donde el piso del modelo baja en escalón, del lado de la cámara): después del sismo te puedes parar y bajarte por cualquiera.
// Cada una lleva una flecha brillante en el piso (como las de la casa) que main.js muestra mientras estás de pie
export const BUS_DOORS = [[-283, -198], [-49, 44], [251, 337]].map(([a, b]) => [BUS_X + a * BUS_S, BUS_X + b * BUS_S])
// las puertas: solo ahí se puede bajar el escalón hasta la salida. Antes todo el lado de las puertas era caminable hasta afuera y,
// pasando por un escalón, se podía caminar por fuera de las paredes (y hasta encima de las llantas)
BUS_DOORS.forEach(([x0, x1]) => RECTS.BUS.push([x0 + 0.1, x1 - 0.1, 1.0, 1.9]))
export const busExits = new THREE.Group(); busExits.visible = false; cur.add(busExits)
{
    const tri = new THREE.Shape(); tri.moveTo(-0.38, 0); tri.lineTo(0.38, 0); tri.lineTo(0, 0.5); tri.closePath() // punta hacia afuera del MIO (+z)
    const geo = new THREE.ShapeGeometry(tri); geo.rotateX(Math.PI / 2)
    BUS_DOORS.forEach(([x0, x1]) => { const m = new THREE.Mesh(geo, ARROW); m.position.set((x0 + x1) / 2, 0.03, 1.05); busExits.add(m) })
}

// Ciudad que se ve por las ventanas del MIO: se desplaza para dar sensación de viaje
const CITY_P = 48, cityG = new THREE.Group(); cur.add(cityG)
box(96, 0.4, 14, BX, -0.35, -10.8, '#799180', '#482642')                 // suelo detrás del MIO
box(96, 0.05, 2.4, BX, -0.12, -4.9, '#D8C8AE', '#71708A')             // calle
const cityMats = [['#A6869B', '#482642'], ['#BF895A', '#580213'], ['#D8C8AE', '#71708A'], ['#799180', '#201826']].map(([c, t]) => mat(c, t))
// los edificios son los mismos modelos de la calle (casas, tiendas, edificios y torres, con sus colores y su versión oscura), uno al lado
// del otro con la fachada hacia el MIO. Antes eran cajas. CIUDAD: [centro a lo largo de la calle, fondo (z), tipo, escala, color]
const CIUDAD = [], TIPOS_CIUDAD = ['casa', 'edificio', 'tienda', 'torre', 'casa', 'edificio']
for (let x = 0.3, i = 0; ; i++) {
    const tipo = TIPOS_CIUDAD[i % TIPOS_CIUDAD.length], e = EDIFICIOS[tipo], k = escalaEdif(e), w = e.ancho * k
    if (x + w > CITY_P - 0.3) break // (lo que sobra al final queda como espacio entre la copia y la siguiente)
    CIUDAD.push([x + w / 2, rr(-7.6, -6.6), tipo, k, nFachada++]); x += w + rr(0.3, 1.2)
}
;[0, CITY_P].forEach(off => { // dos copias seguidas: al desplazarse nunca quedan huecos
    const g = new THREE.Group(); g.position.x = off
    for (let x = 0; x < CITY_P; x += 6) { const d = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.02, 0.2), cityMats[2]); d.position.set(BX - 28 + x, -1.19, 0); g.add(d) } // rayas de la calle
    CIUDAD.forEach(([x, z, tipo, k, v]) => {
        const b = new THREE.Group(); b.position.set(BX - 28 + x, -0.15, z)
        fachadas.push({ g: b, e: EDIFICIOS[tipo], k, frente: FRENTE, dx: 0, v, cerca: false }) // (el modelo se le pone al cargar, como a los de la calle)
        g.add(b); warpable(b, x * 1.3 + z)
    })
    cityG.add(g)
})

// 11. Objetos interactivos: pos = donde se para el personaje · mark = dónde flota la flecha del objetivo · glow = lo que brilla cuando es el objetivo
const V = (x, z) => new THREE.Vector3(x, 0, z)
const S = GROUPS.STREET
const BUS_K = 1.25 // escala del MIO por fuera
export const props = {
    cama: { pos: V(-3.93, -1.1), mesh: null, mark: { x: -2.63, y: 2.1, z: -0.7 } },  // pos: donde queda de pie al levantarse (junto a la cabecera, entre la cama y la silla del escritorio)
    armario: { pos: V(-5.1, 0.97), mesh: wardrobe, mark: { x: -6.13, y: 3.2, z: 0.97 } },
    celular: { pos: V(-4.95, 0.0), mesh: phone, mark: { x: -6.09, y: 1.65, z: -0.25 } },
    maleta: { pos: V(-2.68, 1.25), mesh: bag, mark: { x: -2.68, y: 1.8, z: 0.24 } },   // la maleta está sobre la cama, a los pies
    puerta: { pos: V(...mid2(DOORS.cuarto)), mesh: null, mark: { x: mid2(DOORS.cuarto)[0], y: 1.4, z: mid2(DOORS.cuarto)[1] } }, // flecha del piso que baja a la sala
    mama: { pos: V(MOM_SPOT.x, MOM_SPOT.z), mesh: null, mark: { x: MOM_SPOT.x, y: 2.7, z: MOM_SPOT.z } }, // mamá no brilla: solo la flecha encima
    desayuno: { pos: V(DINING_SEAT.x + 0.7, DINING_SEAT.z - 0.4), mesh: breakfast, rect: TABLE, mark: { x: breakfast.position.x, y: 1.9, z: breakfast.position.z } }, // rect: se come estando cerca de la mesa (no en un punto exacto)
    salida: { pos: V(...mid2(DOORS.calle)), mesh: null, mark: { x: mid2(DOORS.calle)[0], y: 1.4, z: mid2(DOORS.calle)[1] } },   // flecha de la entrada
    // MIO por fuera (temporal). rect = huella en planta (para medir la cercanía)
    // (todo el MIO va a escala BUS_K: con la caja de 6 m se veía enano al lado de Gabriela. El centro sube para que las llantas sigan en el piso)
    bus: { pos: V(W.busX, 1), mesh: outlined(box(6, 2, 2.2, W.busX + 4, BUS_K, -1.8, '#2F7DAA', '#482642', S), 6, 2, 2.2, 0.2, 0, SOFT),
        rect: [W.busX + 4 - 3 * BUS_K, W.busX + 4 + 3 * BUS_K, -1.8 - 1.1 * BUS_K, -1.8 + 1.1 * BUS_K], mark: { x: W.busX + 4, y: 2 * BUS_K + 1.1, z: -1.8 } }
}
props.bus.mesh.scale.setScalar(BUS_K)
Object.values(props).forEach(p => { p.glow ||= p.mesh?.userData.outline })
// El MIO frente a la universidad: solo aparece si aguantaste el viaje completo (y entonces desaparece el del paradero)
export const uniBus = props.bus.mesh.clone(); uniBus.rotation.y = Math.PI / 2; uniBus.position.set(UX + 1.9, BUS_K, GATE + 10); uniBus.visible = false; S.add(uniBus)
uniBus.children.forEach(c => { if (c.material === SOFT) c.visible = false })
// El MIO por fuera: el modelo assets/bus/exterior/bus-calle.fbx (la caja de antes queda invisible: sigue siendo su huella, su brillo y su
// colisión). Los colores del archivo no se usan: el azul del MIO y vidrios oscuros, como el de la foto de referencia. Los materiales del
// archivo vienen con nombres cruzados (el parabrisas se llama "Rims"), así que se pinta por lo que es cada parte (medido en el modelo)
{
    const PARTES = {
        'Material.017': ['#2F7DAA', '#482642'],                                       // carrocería
        'Material.034': ['#1E2A3A', '#120d16'], 'Rims.004': ['#1E2A3A', '#120d16'],   // ventanas, puerta y parabrisas: vidrio oscuro
        'Material.020': ['#E4FFFF', '#71708A'], 'Material.018': ['#D8C8AE', '#71708A'], // franja lateral clara · defensa de adelante
        'Window.002': ['#2B2B33', '#201826'],                                         // faldón de abajo, oscuro como el frente del de la foto
        'Material.021': ['#E4FFFF', '#71708A'], 'Material.019': ['#D01F2A', '#580213'], 'Material.024': ['#F2C063', '#580213'] // luces de adelante · de atrás
    }
    const llanta = mat('#1D1D24', '#120d16'), rin = mat('#D8C8AE', '#71708A'), cache = {}
    const pintar = (m) => m.name.startsWith('Accordion') ? rin : PARTES[m.name] ? (cache[m.name] ||= mat(...PARTES[m.name])) : llanta // (las demás: las llantas)
    ;[props.bus.mesh, uniBus].forEach(b => { b.material = b.material.clone(); b.material.visible = false }) // la caja ya no se ve (solo sus hijos: el modelo)
    // brillo: en vez de la caja translúcida de antes, una copia del bus un poco más grande y por detrás (como el brillo de los objetos de la
    // casa): se ve como un borde dorado con la forma del MIO
    const brillo = new THREE.Group(); brillo.visible = false; props.bus.mesh.add(brillo); props.bus.glow = brillo
    props.bus.mesh.userData.outline.removeFromParent()
    pendientes++
    const fin = () => { if (--pendientes === 0) avisarListos() }
    fbx.load('assets/bus/exterior/bus-calle.fbx', (o) => {
        o.traverse(c => { if (c.isMesh) c.material = Array.isArray(c.material) ? c.material.map(pintar) : pintar(c.material) })
        // 8.5 m de largo en el archivo → 6.4 (el largo de la caja), con la base en el piso y el frente hacia +x (hacia donde arranca)
        o.scale.set(0.755, 0.78, 0.88); o.position.set(0.17, -1, -0.08)
        props.bus.mesh.add(o); uniBus.add(o.clone())
        o.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), caja = new THREE.Box3().setFromObject(o), centro = caja.getCenter(new THREE.Vector3()).applyMatrix4(inv)
        const capa = new THREE.Group(); capa.position.copy(o.position); capa.scale.copy(o.scale); brillo.add(capa)
        o.traverse(m => { if (!m.isMesh) return
            const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)) // en el espacio del modelo
            g.translate(-centro.x, -centro.y, -centro.z).scale(1.05, 1.11, 1.2).translate(centro.x, centro.y, centro.z) // un poco más grande desde el centro del bus
            capa.add(new THREE.Mesh(g, SOFT)) })
        fin()
    }, undefined, fin)
}
solid(6 * BUS_K, 2.2 * BUS_K, W.busX + 4, -1.8, () => props.bus.mesh.visible, 'STREET')
solid(2.2 * BUS_K, 6 * BUS_K, UX + 1.9, GATE + 10, () => uniBus.visible, 'STREET')
export function resetProps() { Object.values(props).forEach(p => { if (p.mesh) p.mesh.visible = true }); uniBus.visible = false }

// Marcador del objetivo actual
export const marker = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xf2c063 }))
marker.rotation.x = Math.PI; root.add(marker)

// 12. Fondo y tema de color: parte del --color-soporte-claro y se oscurece con la ansiedad
const bgClear = new THREE.Color('#8296B7'), bgDark = new THREE.Color('#201826')
const bgPost = new THREE.Color(), bgAzul = new THREE.Color('#56668A') // después del sismo el cielo se apaga a un azul oscuro (antes quedaba gris)
const bgAzulCasa = new THREE.Color('#8592B0') // dentro de la casa, más claro: con el azul oscuro de afuera el cuarto y la sala se veían muy oscuros
let cssRead = false, lastA = -1
const readCss = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-soporte-claro').trim()
    if (v) { bgClear.set(v); cssRead = true }
}
function applyTheme(a) {
    if (!cssRead) readCss()
    themed.forEach(({ m, a: c0, b: c1 }) => m.color.copy(c0).lerp(c1, a))
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color()
    let base = bgClear
    const dull = Math.min(1, Math.max(0, (runtime.levelVis ?? -1) + 1)) // nivel -1: cielo normal · nivel 0 o más: apagado (el final bueno lo devuelve)
    const casa = runtime.space === 'HOUSE' || runtime.space === 'HOME'
    if (dull > 0) { bgPost.copy(bgClear).lerp(casa ? bgAzulCasa : bgAzul, dull); base = bgPost }
    scene.background.copy(base).lerp(bgDark, a * (casa ? 0.3 : 0.45)) // con la paleta de ansiedad se oscurece hacia el morado, sin perder del todo el azul
}

// 13. Calle eterna: con mucha ansiedad la universidad se aleja, la calle se alarga, la niebla se traga el final y el paso rinde menos
scene.fog = new THREE.Fog(0x201826, 1e4, 2e4)
let endK = 0, ext = 0
export const endless = () => endK // 0 = calle normal · 1 = calle eterna
export const atUniversity = (x, z) => runtime.space === 'STREET' && Math.abs(x - UX) < 3.2 && z < GATE - ext + 1.5
export const nearUniversity = (x, z) => runtime.space === 'STREET' && x > UX - 4 && z < GATE - ext + 8
function updateEndless(dt) {
    const E = CONFIG.street, a = runtime.anxiety
    const k = 0 // desactivada: la universidad que se alejaba con la ansiedad se veía rara (antes: según a entre E.from y E.full)
    endK += (k - endK) * Math.min(1, dt * 0.8)
    ext = E.endless * endK
    uniG.position.z = UNI_Z - ext
    roadExt.visible = ext > 0.05; roadExt.scale.z = Math.max(0.001, ext); roadExt.position.z = GATE - ext / 2; pisoExt.map.repeat.y = Math.max(0.001, ext)
    EXT[2] = GATE - ext
    if (scene.background instanceof THREE.Color) scene.fog.color.copy(scene.background)
    if (endK > 0.01) { scene.fog.near = 26 + 40 * (1 - endK); scene.fog.far = scene.fog.near + 12 + 40 * (1 - endK) }
    else { scene.fog.near = 1e4; scene.fog.far = 2e4 }
}

// 14. Actualización por cuadro: deformación, pasto, ciudad del MIO, calle eterna y luces
const cold = new THREE.Color(0x8899bb), warm = new THREE.Color(0xffd9a0)
let T = 0, cityOff = 0, grassK = 0, grassWas = false
export function updateEnvironment(dt = 0, px, pz) { // px / pz: dónde está Gabriela (para desvanecer las casas que la tapan)
    const p = runtime.envProgress, a = runtime.anxiety
    transparentar(dt, px, pz)
    T += dt; OUTLINE.opacity = 0.7 + 0.3 * Math.sin(T * 5); SOFT.opacity = 0.28 + 0.14 * Math.sin(T * 3); ARROW.opacity = 0.7 + 0.3 * Math.sin(T * 4) // las flechas del piso de la casa laten
    if (runtime.space === 'BUS') { // el MIO solo avanza cuando te sientas y va frenando mientras el sismo crece
        if (runtime.busMoving) cityOff = (cityOff + dt * (2.5 + a * 3) * (1 - Math.min(1, runtime.quake * 1.8))) % CITY_P
        cityG.position.x = -cityOff
    }

    const va = runtime.visAnx ?? a, d = va * va * CONFIG.anxiety.distort, q = runtime.quake // los edificios se deforman con la ansiedad visible (suave), no con la del instante
    warp.forEach(e => {
        const { g, x, y, ph } = e, sq = q + e.sh // un edificio asustado tiembla como en el sismo
        g.rotation.set(Math.sin(T * 0.6 + ph * 1.7) * 0.12 * d, e.ry, Math.sin(T * 0.8 + ph) * 0.26 * d + Math.sin(T * 21 + ph) * 0.06 * sq) // el giro en Y se repone: la inclinación lo altera
        g.scale.y = 1 + Math.sin(T * 0.7 + ph * 1.3) * 0.38 * d
        g.scale.x = 1 + Math.sin(T * 0.9 + ph * 0.7) * 0.15 * d
        g.position.x = x + Math.sin(T * 33 + ph) * 0.1 * sq
        g.position.y = y + Math.abs(Math.sin(T * 27 + ph)) * 0.06 * sq - e.sink
        if (e.tilt) { tiltAxis.set(e.dz, 0, -e.dx); g.quaternion.premultiply(tiltQ.setFromAxisAngle(tiltAxis, e.tilt)) } // se inclina hacia el personaje
    })
    updateGhosts()
    sets.forEach(s => { // cada pieza: primero se encoge lo destruido y después crece lo reconstruido (rápido, desde el suelo)
        const want = p > s.th + 0.001 || p >= 1 ? 1 : 0
        if (s.k !== want) s.k += Math.sign(want - s.k) * Math.min(Math.abs(want - s.k), dt * 2.5)
        growFrom(s.d, Math.max(0, 1 - s.k * 2)); growFrom(s.r, Math.max(0, s.k * 2 - 1))
    })
    const pal = runtime.palette ?? a, key = pal + (runtime.levelVis ?? -1) * 10 // la paleta sigue el nivel de ansiedad (anxiety.js), no solo la crisis del momento
    if (Math.abs(key - lastA) > 0.002) { lastA = key; applyTheme(pal) }
    const dark = (runtime.levelVis ?? -1) > 2.75 // en el nivel más alto de ansiedad (3), los modelos finales cambian a su versión oscura
    MODELS.forEach(m => { if (m.normal) m.normal.visible = !dark; if (m.dark) m.dark.visible = dark })
    updateEndless(dt)

    const gt = runtime.grassGreen ? 1 : 0 // en el Earthing el pasto se pone más verde, pero sin pasarse de la saturación del nivel de ansiedad (antes quedaba más vivo que el resto)
    if (grassK !== gt) grassK += Math.sign(gt - grassK) * Math.min(Math.abs(gt - grassK), dt * 1.5)
    if (grassK > 0 || grassWas) { grass.forEach(({ m, a: c0, b: c1, g: cg }) => m.color.copy(c0).lerp(c1, pal).lerp(cg, grassK * 0.45)); grassWas = grassK > 0 }
    ambient.color.copy(cold).lerp(warm, p); sun.color.copy(cold).lerp(warm, p)
    sun.intensity = CONFIG.env.light * (0.8 + 0.5 * p)
}

setSpace('HOUSE')
