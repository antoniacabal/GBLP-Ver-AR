// Indice
    // 0. Imports
    // 1. Colores del archivo
    // 2. Esqueleto
    // 3. Poses (de pie, caminar / correr, sentada, acostada, miedo, sobresalto, feliz, coger, comer)
    // 4. Exportación
    // 5. Extras (NPC)

// Protagonista (assets/protagonista/Personaje.fbx): lo usan el juego (player.js) y la muestra del index (script.js).
// El archivo no trae huesos ni animaciones (está en pose de T): aquí se le arma un esqueleto sencillo y cada vértice se pega
// al hueso de su zona (pelo → cabeza, mangas → brazos, medias → piernas...). Las poses giran esos huesos

// 0. Imports
import * as THREE from 'three'
import { CargadorModelos } from './modelos.js' // (los FBX se publican como GLB con Draco)
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// 1. Colores del archivo: Blender guarda los colores en lineal y el cargador de FBX los lee como si fueran sRGB, así que se veían
//    mucho más oscuros (pelo casi negro, piel rojiza). Se leen otra vez como lineales: quedan como en Blender
const comoEnBlender = (c) => { const crudo = {}; c.getRGB(crudo, THREE.SRGBColorSpace); return new THREE.Color().setRGB(crudo.r, crudo.g, crudo.b, THREE.LinearSRGBColorSpace) }
export const materialDe = (m) => new THREE.MeshStandardMaterial({ color: comoEnBlender(m.color), roughness: 0.8, side: THREE.DoubleSide })

// 2. Esqueleto (en unidades del archivo: pies en y = 0, frente hacia +z, brazos estirados en x). x > 0 = lado "I", x < 0 = lado "D"
export const MODELO = 140 // alto del archivo
const JOINTS = {
    raiz: [null, 0, 0, 0], cadera: ['raiz', 0, 42, 0], espalda: ['cadera', 0, 56, 0], cabeza: ['espalda', 0, 81, 0],
    brazoI: ['espalda', 14, 75, 0], antebrazoI: ['brazoI', 33, 74, 0], brazoD: ['espalda', -14, 75, 0], antebrazoD: ['brazoD', -33, 74, 0], // hombro arriba del brazo y codo a la mitad: al bajar el brazo no se abre un hueco en el hombro
    // codos de ayuda: en el mismo lugar que el antebrazo, giran la mitad que él (ver codos). La manga del codo se pega a ellos: así al doblar
    // el brazo se curva en vez de aplastarse
    codoI: ['brazoI', 33, 74, 0], codoD: ['brazoD', -33, 74, 0],
    musloI: ['cadera', 8, 40, 0], piernaI: ['musloI', 8, 20, 0], musloD: ['cadera', -8, 40, 0], piernaD: ['musloD', -8, 20, 0],
    // manos (medidas sobre el modelo: la muñeca en |x| 47, la palma hasta 55 con el pulgar hacia adelante, los dedos hasta 64)
    // los dedos tienen dos partes (nudillos y la mitad del dedo): con las dos dobladas la mano cierra el puño
    manoI: ['antebrazoI', 47, 74, -3], dedosI: ['manoI', 55, 74, -4], dedos2I: ['dedosI', 59.5, 74, -4], pulgarI: ['manoI', 49, 73, 1],
    manoD: ['antebrazoD', -47, 74, -3], dedosD: ['manoD', -55, 74, -4], dedos2D: ['dedosD', -59.5, 74, -4], pulgarD: ['manoD', -49, 73, 1],
    // pies (el tobillo a 8 de alto, el zapato va del talón en z -15 a la punta en z +13)
    pieI: ['piernaI', 8, 8, -2], puntaI: ['pieI', 8, 3, 5], pieD: ['piernaD', -8, 8, -2], puntaD: ['pieD', -8, 3, 5],
    // puntas (sin peso): solo marcan dónde termina cada hueso (el visor del debug dibuja la línea hasta aquí)
    dedosFinI: ['dedos2I', 64, 74, -4], pulgarFinI: ['pulgarI', 53, 73, 7], dedosFinD: ['dedos2D', -64, 74, -4], pulgarFinD: ['pulgarD', -53, 73, 7],
    puntaFinI: ['puntaI', 8, 2, 13], puntaFinD: ['puntaD', -8, 2, 13], coronilla: ['cabeza', 0, 128, 0]
}
const NAMES = Object.keys(JOINTS)
// Otro modelo con el mismo cuerpo base pero otras proporciones (la mamá: más alta, con las piernas y el torso más largos) usa este mismo
// esqueleto: pares [y del archivo, y de Gabriela], de abajo hacia arriba. Los huesos se ubican donde quedan en ese archivo y los pesos se
// calculan como si fuera Gabriela (aGabriela), así sirven todas las reglas de abajo. Fuera de los pares sigue el último tramo
function tramos(pares) {
    const f = (a, b) => (y) => {
        let i = 1; while (i < pares.length - 1 && y > pares[i][a]) i++
        const p = pares[i - 1], q = pares[i]; return p[b] + (y - p[a]) * (q[b] - p[b]) / (q[a] - p[a])
    }
    return { aGabriela: f(0, 1), aArchivo: f(1, 0) }
}
const igual = { aGabriela: (y) => y, aArchivo: (y) => y }
const paso =(a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) } // 0 → 1 suave entre a y b
// los codos de ayuda giran la mitad que el antebrazo (se llama después de cada pose)
const codos = (meta) => { meta.codoI.copy(meta.antebrazoI).multiplyScalar(0.5); meta.codoD.copy(meta.antebrazoD).multiplyScalar(0.5) }
// A qué huesos pertenece un vértice (con mezcla en las articulaciones, para que no se rompa la malla al doblarse).
// Escribe directo en idx / w (hasta 4 huesos por vértice), sin crear arreglos: la falda tiene ~100 000 vértices
const B = Object.fromEntries(Object.keys(JOINTS).map((n, i) => [n, i]))
function pesos(malla, x, y, z, idx, w, o) {
    const I = x >= 0, ax = Math.abs(x)
    const pon = (k, b, v) => { idx[o + k] = b; w[o + k] = v }
    if (/^\d+$/.test(malla) || malla === 'Bollo' || malla === 'Calva') return pon(0, B.cabeza, 1) // pelo (la mamá: mechones, moño y la parte de atrás)
    if (malla === 'Falda' || (malla === 'Delantal' && y < 50)) return pon(0, B.cadera, 1)          // (el delantal de la mamá: de la cintura para abajo va con la falda)
    const pie = () => { // tobillo (de y 11 a 7) y punta del pie (z > 2): zapatos, medias y piel
        const a = 1 - paso(7, 11, y), t = paso(2, 6, z)
        pon(0, I ? B.piernaI : B.piernaD, 1 - a); pon(1, I ? B.pieI : B.pieD, a * (1 - t)); pon(2, I ? B.puntaI : B.puntaD, a * t)
    }
    if (malla === 'Zapatos') return pie()
    if (malla !== 'Medias' && y < 86 && ((y > 64 && ax > 12) || (y > 58 && ax > 16))) { // mangas y brazos (en pose de T, horizontales): el hombro empieza en |x| 12 por arriba;
        const h = paso(12, 20, ax)                                                          // por debajo de la axila el costado del torso (|x| < 16) no es brazo
        if (ax > 44) { // mano: muñeca (|x| 44 a 48), pulgar (adelante, z > 1) y dedos (|x| > 55, la segunda parte desde |x| 59)
            const m = paso(44, 48, ax), t = ax < 58 ? paso(0.5, 3, z) : 0, d = paso(53, 57, ax) * (1 - t), d2 = paso(58, 61, ax)
            if (ax < 48) { pon(0, I ? B.antebrazoI : B.antebrazoD, 1 - m); pon(1, I ? B.manoI : B.manoD, m * (1 - t)); pon(2, I ? B.pulgarI : B.pulgarD, m * t); return }
            pon(0, I ? B.manoI : B.manoD, 1 - t - d); pon(1, I ? B.pulgarI : B.pulgarD, t); pon(2, I ? B.dedosI : B.dedosD, d * (1 - d2)); pon(3, I ? B.dedos2I : B.dedos2D, d * d2); return
        }
        // el codo pasa del brazo al codo de ayuda (|x| 27 a 31) y de él al antebrazo (|x| 35 a 39)
        const c1 = paso(27, 31, ax), c2 = paso(35, 39, ax)
        pon(0, y >= 62 ? B.espalda : B.cadera, 1 - h); pon(1, I ? B.brazoI : B.brazoD, h * (1 - c1)); pon(2, I ? B.codoI : B.codoD, h * c1 * (1 - c2)); pon(3, I ? B.antebrazoI : B.antebrazoD, h * c2); return
    }
    if (y < 12) return pie()
    if (y < 44) { // piernas (la piel y las medias)
        const p = 1 - paso(17, 23, y), m = paso(36, 44, y)
        pon(0, I ? B.piernaI : B.piernaD, p); pon(1, I ? B.musloI : B.musloD, (1 - p) * (1 - m)); pon(2, B.cadera, m); return
    }
    const e = paso(52, 60, y), k = paso(78, 85, y)
    pon(0, B.cadera, 1 - e); pon(1, B.espalda, e * (1 - k)); pon(2, B.cabeza, e * k)
}
// 2.1 Cara: los ojos son un dibujo 2D (assets/protagonista/Caras-transparente…png), como en el video de referencia: una sola hoja con
//     todas las expresiones y la cara muestra un pedazo u otro (se corre la textura). La hoja es una cuadrícula de 3 × 4; cada expresión
//     ocupa 210 × 140 px (las cejas y los dos ojos)
export const EXPRESIONES = { // [fila, columna] en la hoja
    normal: [0, 0], parpadeo: [0, 1], parpadeo2: [0, 2],                       // antes del sismo y final bueno · parpadeo · ojos cerrados tranquilos (dormida, feliz)
    normalPost: [1, 0], susto: [1, 1], parpadeoLagrimas: [1, 2],             // después del sismo · susto y minijuegos (con lágrimas) · su parpadeo
    nivel1: [2, 0], nivel2: [2, 1], nivel3: [2, 2],                          // ansiedad 1, 2 y 3 (la 3, con los ojos en espiral)
    parpadeoAnsioso1: [3, 0], parpadeoAnsioso2: [3, 1]
}
// hojaDe(url, ancho, alto de la imagen, ancho y alto de cada expresión, { nombre: [x, y] de su esquina de arriba a la izquierda, en px })
export function hojaDe(url, w, h, cw, ch, celdas) {
    const tex = new THREE.TextureLoader().load(encodeURI(url))
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.repeat.set(cw / w, ch / h)
    return { tex, w, h, cw, ch, celdas }
}
const HOJA_GABRIELA = hojaDe('assets/protagonista/Caras-transparente_Mesa de trabajo 1.png', 840, 842, 210, 140,
    Object.fromEntries(Object.entries(EXPRESIONES).map(([n, [f, c]]) => [n, [2 + c * 313.5, 32 + f * 214.5]]))) // cuadrícula de 3 × 4
const mostrar = (tex, hoja, nombre) => { const [x0, y0] = hoja.celdas[nombre] ?? hoja.celdas.normal; tex.offset.set(x0 / hoja.w, 1 - (y0 + hoja.ch) / hoja.h) }
// La cara se pega a la forma de la cabeza: una malla de 24 × 16 que se proyecta desde el frente sobre la piel, un poquito por fuera. El pelo
// queda encima (tapa las cejas y el borde de arriba de los ojos, como en los dibujos). Va en el hueso de la cabeza
const CARA_ANCHO = 36, CARA_Y = 106 // en unidades del archivo: los ojos de lado a lado y su centro (la cabeza va de y 84 a 126). Antes 32 y 98.5: quedaban donde iría la boca
// (en otro modelo, con sus proporciones: el centro y la franja de la cabeza se pasan a su archivo; el ancho lo da su hoja)
function armarCara(mallas, cabeza, material, hoja, ancho = CARA_ANCHO, prop = igual) {
    const caraY = prop.aArchivo(CARA_Y), y0 = prop.aArchivo(80), y1 = prop.aArchivo(122)
    // solo los triángulos del frente de la cabeza (así los rayos son rápidos: el cuerpo entero tiene más de 100 000)
    const tri = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    mallas.filter(m => m.name === 'Chibi').forEach(m => { // solo la piel: el pelo queda por encima de la cara (antes iba sobre el flequillo y parecía una calcomanía)
        const g0 = m.geometry.clone().applyMatrix4(m.matrixWorld), g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position
        for (let i = 0; i < p.count; i += 3) {
            a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2)
            if (Math.min(a.y, b.y, c.y) > y0 && Math.max(a.y, b.y, c.y) < y1 && Math.min(a.z, b.z, c.z) > 0) tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
        }
    })
    const sup = new THREE.BufferGeometry(); sup.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
    const blanco = new THREE.Mesh(sup, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    const g = new THREE.PlaneGeometry(ancho, ancho * hoja.ch / hoja.cw, 24, 16), p = g.attributes.position
    const rayo = new THREE.Raycaster(), desde = new THREE.Vector3(), haciaAtras = new THREE.Vector3(0, 0, -1)
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i) + caraY
        rayo.set(desde.set(x, y, 60), haciaAtras)
        const z = rayo.intersectObject(blanco)[0]?.point.z ?? 15
        p.setXYZ(i, x, y - prop.aArchivo(JOINTS.cabeza[2]), z + 0.35) // (relativo al hueso de la cabeza, que en Gabriela está en y 81)
    }
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, material); m.renderOrder = 2; cabeza.add(m)
    return m
}
// los huesos (en la pose del archivo) dentro de cont
function esqueleto(cont, prop = igual) {
    const bones = {}, Y = (j) => j ? prop.aArchivo(j[2]) : 0
    NAMES.forEach(n => { const [p, x, , z] = JOINTS[n], b = new THREE.Bone(); b.name = n; const q = p ? JOINTS[p] : [0, 0, 0, 0]; b.position.set(x - q[1], Y(JOINTS[n]) - Y(p && q), z - q[3]); bones[n] = b; if (p) bones[p].add(b) })
    cont.add(bones.raiz); cont.updateMatrixWorld(true)
    return { bones, skeleton: new THREE.Skeleton(NAMES.map(n => bones[n])) }
}
// la geometría de una malla del archivo, en unidades del archivo y con sus pesos (a qué huesos se pega cada vértice)
function pesada(c, prop = igual) {
    const g = c.geometry.clone().applyMatrix4(c.matrixWorld), pos = g.attributes.position, n = pos.count
    // Piezas reflejadas en Blender (escala negativa, como un mechón del pelo): al pasarlas al modelo quedan con las caras al revés y
    // se iluminaban por dentro (se veían más oscuras). Se invierte el orden de sus triángulos
    if (c.matrixWorld.determinant() < 0) {
        if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t } g.index.needsUpdate = true }
        else Object.values(g.attributes).forEach(at => { const k = at.itemSize, a = at.array; for (let i = 0; i < at.count; i += 3) for (let j = 0; j < k; j++) { const t = a[(i + 1) * k + j]; a[(i + 1) * k + j] = a[(i + 2) * k + j]; a[(i + 2) * k + j] = t } at.needsUpdate = true })
    }
    const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) pesos(c.name, pos.getX(i), prop.aGabriela(pos.getY(i)), pos.getZ(i), idx, w, i * 4)
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4))
    return g
}
function armar(fbx, escala, matCara, cuerpo) {
    const prop = cuerpo.prop, cont = new THREE.Group(), { bones, skeleton } = esqueleto(cont, prop), suela = []
    fbx.updateMatrixWorld(true)
    const mallas = []; fbx.traverse(c => { if (c.isMesh) mallas.push(c) })
    mallas.forEach(c => {
        const g = pesada(c, prop), pos = g.attributes.position, n = pos.count
        // (una malla con varios materiales pero sin decir qué parte lleva cada uno, como el delantal de la mamá, no se dibujaba: va con el primero)
        const varios = Array.isArray(c.material) && g.groups.length, m = Array.isArray(c.material) && !varios ? c.material[0] : c.material
        const sm = new THREE.SkinnedMesh(g, varios ? m.map(materialDe) : materialDe(m))
        sm.frustumCulled = false; sm.bind(skeleton, new THREE.Matrix4()); cont.add(sm)
        // suela: unos cuantos vértices de la base de los zapatos (repartidos), para saber dónde queda el pie en cada pose (ver piso)
        if (c.name === 'Zapatos') { const v = []; for (let i = 0; i < n; i++) if (pos.getY(i) < 1.5) v.push(i); const paso = Math.max(1, Math.floor(v.length / 80)); suela.push(...v.filter((_, k) => k % paso === 0).map(i => [sm, i])) }
    })
    // enagua: un disco oscuro dentro de la falda, un poco arriba del borde, pegado a la cadera. Sin él, por debajo de la falda
    // se veía su interior claro (y a través de ella)
    const enagua = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 15.5, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x15111c, roughness: 1 }))
    enagua.scale.set(1.05, 1, 0.82); enagua.position.set(0, 37.5 - 42, -4.3)
    const falda = mallas.find(c => c.name === 'Falda')
    if (falda && prop !== igual) { // otra falda (la de la mamá, más larga y más ancha): el disco se ajusta a su borde de abajo
        const b = new THREE.Box3().setFromObject(falda), r = (b.max.x - b.min.x) / 2 * 0.91
        enagua.scale.set(r / 15.5 * 1.05, 1, (b.max.z - b.min.z) / (b.max.x - b.min.x) * 1.03 * r / 15.5); enagua.position.set(0, b.min.y + 2.5 - prop.aArchivo(JOINTS.cadera[2]), (b.min.z + b.max.z) / 2)
    }
    if (falda) bones.cadera.add(enagua) // (solo con falda: los NPC con pantalón no la llevan)
    if (matCara) armarCara(mallas, bones.cabeza, matCara, cuerpo.hoja, cuerpo.ancho, prop)
    cont.scale.setScalar(escala)
    return { cont, bones, suela }
}

// 3. Poses: cada hueso guarda su giro actual y va hacia el de la pose que toca (así una pose pasa a la otra sin saltos).
//    Los brazos del archivo están en T: en todas las poses bajan a los lados
const BRAZO_ABAJO = 1.25
// dedos: k = 0 abiertos, 0.35 relajados, 1.5 puño cerrado (los dedos se doblan hacia la palma y el pulgar se cierra encima)
function mano(meta, k) {
    meta.dedosI.z = -k; meta.dedosD.z = k
    meta.dedos2I.z = -0.9 * k; meta.dedos2D.z = 0.9 * k                                   // la segunda parte del dedo se dobla casi igual
    meta.pulgarI.y = 0.4 * k; meta.pulgarD.y = -0.4 * k
}
function metaDe(meta, nombre, t, k, r = 0) { // k: 0 → 1 (al caminar, cuánto camina; con miedo, cuánto; al coger, el avance) · r: cuánto corre
    NAMES.forEach(n => meta[n].set(0, 0, 0))
    if (nombre === 'ninguna') return // sin animación: la pose del archivo (en T)
    meta.brazoI.z = -BRAZO_ABAJO; meta.brazoD.z = BRAZO_ABAJO
    mano(meta, 0.35)                                                                        // manos relajadas: los dedos un poco doblados
    if (nombre === 'caminar') {
        // t = fase del paso (player.js la acumula según la velocidad) · k = cuánto camina (0 → 1) · r = cuánto corre (0: caminar, 1: apurada por la ansiedad).
        // Ciclo como en la referencia: pie apoyado (abajo, piernas abiertas) → paso (arriba, piernas juntas) → pie apoyado. La rodilla se dobla
        // cuando la pierna va hacia adelante (no al empujar), los brazos van al revés que las piernas, la cadera gira con el paso y el pecho al revés.
        // Corriendo: más zancada, rodillas altas, inclinada hacia adelante y los codos doblados a 90°, como en una carrera
        const sf = Math.sin(t), cf = Math.cos(t), mez = (w, c) => (w + (c - w) * r) * k
        const A = mez(0.45, 0.85)
        meta.musloI.x = A * sf; meta.musloD.x = -A * sf
        meta.piernaI.x = mez(0.06, 0.25) + mez(0.75, 1.55) * Math.max(0, -cf); meta.piernaD.x = mez(0.06, 0.25) + mez(0.75, 1.55) * Math.max(0, cf)
        meta.brazoI.x = -mez(0.32, 0.9) * sf; meta.brazoD.x = mez(0.32, 0.9) * sf
        meta.brazoI.z += mez(0.06, 0.12); meta.brazoD.z -= mez(0.06, 0.12)
        meta.antebrazoI.y = -mez(0.28, 1.5); meta.antebrazoD.y = mez(0.28, 1.5)
        meta.cadera.y = mez(0.1, 0.16) * sf; meta.cadera.x = mez(0, 0.1)
        meta.espalda.y = -mez(0.12, 0.2) * sf; meta.espalda.x = mez(0.05, 0.28)
        meta.cabeza.x = -mez(0.02, 0.18); meta.cabeza.y = mez(0.05, 0.04) * sf
        // pies: apoya el talón al llegar adelante (punta arriba) y despega con la punta al quedar atrás
        meta.pieI.x = k * (0.35 * sf - 0.1); meta.pieD.x = k * (-0.35 * sf - 0.1)
        meta.puntaI.x = -k * 0.4 * Math.max(0, sf); meta.puntaD.x = -k * 0.4 * Math.max(0, -sf)
        if (r > 0.3) mano(meta, 0.35 + 1.1 * (r - 0.3) / 0.7)                                // corriendo cierra los puños
    } else if (nombre === 'sentada') {
        // recostada en el espaldar, los muslos un poco hacia abajo y los pies hacia adelante (las rodillas pasan el borde del cojín),
        // las manos sobre las piernas; respira y mueve la cabeza despacio
        meta.cadera.x = -0.12; meta.espalda.x = -0.05 + 0.02 * Math.sin(t * 1.4)
        meta.musloI.x = -Math.PI / 2 + 0.28; meta.musloD.x = -Math.PI / 2 + 0.22
        meta.musloI.y = -0.08; meta.musloD.y = 0.1
        meta.piernaI.x = Math.PI / 2 - 0.55; meta.piernaD.x = Math.PI / 2 - 0.4
        meta.brazoI.z = -BRAZO_ABAJO - 0.08; meta.brazoD.z = BRAZO_ABAJO + 0.08            // brazos pegados al cuerpo
        meta.brazoI.x = meta.brazoD.x = -0.5; meta.antebrazoI.y = -1.0; meta.antebrazoD.y = 0.95 // y las manos sobre las piernas
        meta.cabeza.x = 0.1 + 0.04 * Math.sin(t * 0.7); meta.cabeza.y = 0.12 * Math.sin(t * 0.35)
        meta.pieI.x = meta.pieD.x = 0.35                                                      // los pies cuelgan relajados
        // sentada suelta (la mayoría de los pasajeros): los brazos caen a los lados y las manos descansan junto a los muslos, sin
        // llevarlas al frente (así no parece que cogieran algo)
        if (k === 'suelta') {
            meta.brazoI.z = -BRAZO_ABAJO - 0.2; meta.brazoD.z = BRAZO_ABAJO + 0.2
            meta.brazoI.x = meta.brazoD.x = -0.12; meta.antebrazoI.y = -0.3; meta.antebrazoD.y = 0.3
            mano(meta, 0.5)
        }
    } else if (nombre === 'acostada') {
        // de lado (el lado "I" queda abajo, ver player.lieDown), encogida pero suelta, como alguien dormido: la espalda curva, la cabeza un
        // poco hacia el pecho, las rodillas dobladas (la de arriba más adelante), las manos juntas frente a la cara y los pies estirados
        const resp = Math.sin(t * 1.3)
        meta.cadera.x = 0.12; meta.espalda.x = 0.3 + 0.025 * resp; meta.cabeza.x = 0.22 + 0.01 * resp; meta.cabeza.z = 0.05
        meta.musloI.x = -1.05; meta.piernaI.x = 1.4; meta.musloI.z = -0.14                        // piernas juntas: las rodillas una sobre la otra
        meta.musloD.x = -1.12; meta.piernaD.x = 1.45; meta.musloD.z = 0.2                         // (la de arriba descansa sobre la de abajo)
        meta.pieI.x = meta.pieD.x = 0.45
        meta.brazoI.z = -BRAZO_ABAJO + 0.12; meta.brazoI.x = -0.55; meta.antebrazoI.y = -2.3        // las manos recogidas contra el pecho
        meta.brazoD.z = BRAZO_ABAJO - 0.05; meta.brazoD.x = -0.5; meta.antebrazoD.y = 2.25
        meta.manoI.z = -0.25; meta.manoD.z = 0.2
        mano(meta, 0.6)
    } else if (nombre === 'miedo') {
        // se tapa las mejillas con las dos manos (como en la referencia de la niña asustada): las palmas contra la cara, los dedos hacia arriba y
        // los codos abajo; encogida, con las rodillas hacia adentro; la cabeza gacha se mueve de lado a lado y todo el cuerpo tiembla
        const tr = (v) => Math.sin(t * v) * 0.03 * k
        const mece = Math.sin(t * 1.1), niega = Math.sin(t * 1.7)
        meta.cadera.y = 0.12 * k * mece; meta.cadera.x = 0.05 * k
        meta.espalda.x = 0.25 * k + tr(31); meta.espalda.y = 0.1 * k * mece
        meta.cabeza.x = 0.15 * k + tr(27); meta.cabeza.y = 0.22 * k * niega + tr(23); meta.cabeza.z = 0.06 * k * niega
        meta.brazoI.set(-1.0 * k + tr(29), -0.28 * k, -BRAZO_ABAJO + 0.02 * k); meta.brazoD.set(-1.0 * k + tr(29), 0.28 * k, BRAZO_ABAJO - 0.02 * k) // codos abajo, al frente
        meta.antebrazoI.set(-0.04 * k, -2.01 * k, 0.03 * k); meta.antebrazoD.set(-0.04 * k, 2.01 * k, -0.03 * k) // manos a la cara
        meta.manoI.set(-0.95 * k, -0.2 * k, 0.62 * k); meta.manoD.set(-0.95 * k, 0.2 * k, -0.62 * k)           // las palmas (no el dorso) contra las mejillas
        meta.musloI.x = meta.musloD.x = -0.32 * k; meta.piernaI.x = meta.piernaD.x = 0.6 * k
        meta.pieI.x = meta.pieD.x = -0.28 * k                                                    // el pie queda plano
        meta.musloI.y = 0.2 * k; meta.musloD.y = -0.2 * k                                        // rodillas hacia adentro
        mano(meta, 0.35 + 0.2 * k)                                                               // los dedos sueltos sobre la cara
    } else if (nombre === 'sobresalto') {
        // k: 0 → 1 a lo largo del salto (player.sobresalto). Como un gato asustado: se agacha de golpe, salta hacia atrás alejándose de lo que
        // la asustó (el cuerpo echado para atrás, una rodilla arriba y los puños junto al mentón) y cae doblando las rodillas
        const p = Math.min(1, Math.max(0, k))
        const agacha = paso(0, 0.1, p) * (1 - paso(0.1, 0.2, p)), aire = paso(0.1, 0.22, p) * (1 - paso(0.55, 0.68, p)), cae = paso(0.55, 0.66, p) * (1 - paso(0.78, 1, p))
        const dobla = 0.5 * agacha + 0.45 * cae                                              // rodillas dobladas al tomar impulso y al caer
        meta.musloI.x = -dobla - 0.3 * aire; meta.piernaI.x = 2 * dobla + 0.55 * aire; meta.pieI.x = -dobla + 0.25 * aire
        meta.musloD.x = -dobla - 1.25 * aire; meta.piernaD.x = 2 * dobla + 1.6 * aire; meta.pieD.x = -dobla + 0.3 * aire // la rodilla D sube
        meta.musloI.y = 0.12 * aire; meta.musloD.y = -0.2 * aire
        meta.espalda.x = 0.25 * agacha - 0.28 * aire + 0.15 * cae; meta.cadera.x = -0.1 * aire  // en el aire se echa para atrás
        meta.cabeza.x = 0.1 * agacha + 0.15 * aire + 0.05 * cae                              // la cabeza hacia el frente: no le quita la vista
        const sube = Math.max(aire, cae * 0.7, agacha * 0.5)                                  // los puños suben al mentón
        meta.brazoI.z = -BRAZO_ABAJO + 0.2 * sube; meta.brazoD.z = BRAZO_ABAJO - 0.2 * sube
        meta.brazoI.x = meta.brazoD.x = -0.95 * sube
        meta.antebrazoI.y = -2.25 * sube; meta.antebrazoD.y = 2.25 * sube
        mano(meta, 0.35 + sube)
    } else if (nombre === 'feliz') { // idle contento de la muestra (script.js 3.4 tiene la misma pose): ver posarFeliz
        posarFeliz(meta, t)
    } else if (nombre === 'coger') {
        // k: 0 → 1 a lo largo del gesto. Estira la mano derecha abierta hacia el objeto (hasta 0.45), la cierra al tocarlo (0.45 a 0.55),
        // lo trae hacia el pecho mirándolo (hasta 0.85) y baja la mano (como en la referencia de los Sims)
        const p = Math.min(1, Math.max(0, k)), estira = paso(0, 0.45, p) * (1 - paso(0.5, 0.75, p)), trae = paso(0.5, 0.75, p) * (1 - paso(0.85, 1, p))
        const cierra = paso(0.42, 0.55, p) * (1 - paso(0.9, 1, p))
        meta.brazoI.z += 0.06; meta.antebrazoI.y = -0.25
        meta.brazoD.z = BRAZO_ABAJO - 0.25 * estira - 0.1 * trae; meta.brazoD.x = -1.15 * estira - 0.55 * trae; meta.brazoD.y = 0.2 * estira
        meta.antebrazoD.y = 0.15 + 0.1 * (1 - estira) + 1.5 * trae
        meta.manoD.z = 0.25 * estira; meta.manoD.y = 0.2 * trae
        meta.dedosD.z = 0.1 + 1.45 * cierra; meta.pulgarD.y = -0.2 - 0.6 * cierra             // abre la mano y la cierra sobre el objeto
        meta.espalda.x = 0.32 * estira + 0.05 * trae; meta.cabeza.x = 0.22 * estira + 0.25 * trae; meta.espalda.y = -0.12 * estira
        meta.musloI.x = meta.musloD.x = -0.22 * estira; meta.piernaI.x = meta.piernaD.x = 0.4 * estira // dobla un poco las rodillas
    } else if (nombre === 'tambaleo') {
        // k: -1 → 1 hacia dónde se está cayendo (positivo: hacia su lado I). Perdiendo el equilibrio, como en la referencia: la cadera se
        // va hacia ese lado, la pierna del otro lado se levanta y se abre, el brazo de arriba (el del otro lado) sube por encima de la cabeza y
        // el de abajo se abre hacia afuera; los dos manotean buscando el equilibrio. Cerca de 0 casi no se mueve (ya está derecha)
        const L = Math.max(-1, Math.min(1, k)), a = Math.abs(L), s = Math.sign(L) || 1
        const manoteo = (f, fase) => Math.sin(t * f + fase) * (0.15 + 0.35 * a)
        meta.cadera.z = -0.3 * L; meta.espalda.z = -0.12 * L + 0.04 * Math.sin(t * 5)
        meta.cabeza.z = 0.22 * L; meta.cabeza.x = 0.08 * a                                  // la cabeza busca quedar derecha
        // piernas: la del lado de la caída sostiene (el pie queda debajo); la otra se levanta un poco y se abre
        const apoyo = s > 0 ? 'I' : 'D', libre = s > 0 ? 'D' : 'I', lado = (l) => l === 'I' ? 1 : -1
        meta['muslo' + apoyo].z = 0.3 * L; meta['muslo' + apoyo].x = -0.1 * a; meta['pierna' + apoyo].x = 0.2 * a
        meta['muslo' + libre].z = lado(libre) * 0.45 * a; meta['muslo' + libre].x = -0.45 * a; meta['pierna' + libre].x = 0.6 * a
        meta['pie' + apoyo].x = -0.1 * a; meta['pie' + libre].x = 0.25 * a
        // brazos: el de arriba (lado libre) sube por encima de la cabeza; el de abajo (lado de la caída) se abre hacia afuera
        const arriba = libre, abajo = apoyo, z = (l, v) => lado(l) > 0 ? -v : v // en el lado D el giro va al revés
        meta['brazo' + arriba].z = z(arriba, BRAZO_ABAJO - (BRAZO_ABAJO + 1.15) * a); meta['brazo' + arriba].x = manoteo(6, 0)
        meta['brazo' + abajo].z = z(abajo, BRAZO_ABAJO - (BRAZO_ABAJO - 0.2) * a); meta['brazo' + abajo].x = manoteo(5, 1.7) - 0.2 * a
        meta['antebrazo' + arriba].y = -lado(arriba) * (0.25 + 0.5 * a * (0.5 + 0.5 * Math.sin(t * 7))) // los codos se doblan y estiran
        meta['antebrazo' + abajo].y = -lado(abajo) * (0.2 + 0.4 * a * (0.5 + 0.5 * Math.sin(t * 6 + 1)))
        mano(meta, 0.1)                                                                         // manos abiertas
    } else if (nombre === 'comerSentada') { // sentada a la mesa: las piernas de "sentada" con los brazos y la cabeza de "comer"
        metaDe(meta, 'sentada', t, k)
        const piernas = ['cadera', 'musloI', 'musloD', 'piernaI', 'piernaD', 'pieI', 'pieD', 'puntaI', 'puntaD'].map(n => [n, meta[n].clone()])
        metaDe(meta, 'comer', t, k); piernas.forEach(([n, v]) => meta[n].copy(v))
    } else if (nombre === 'comer') {
        // sentada o de pie frente a la mesa: la mano derecha lleva la comida a la boca una y otra vez (cada 1.8 s) y mastica;
        // la izquierda descansa al frente. Sencilla: lo más probable es que se vea de espaldas
        const c = (t % 1.8) / 1.8, sube = paso(0.1, 0.35, c) * (1 - paso(0.55, 0.85, c)), masca = Math.sin(t * 12) * 0.04 * (1 - sube)
        meta.espalda.x = 0.12; meta.cabeza.x = 0.18 - 0.1 * sube + masca
        meta.brazoI.z = -BRAZO_ABAJO + 0.15; meta.brazoI.x = -0.55; meta.antebrazoI.y = -1.0
        meta.brazoD.z = BRAZO_ABAJO - 0.15 - 0.15 * sube; meta.brazoD.x = -0.55 - 0.45 * sube; meta.antebrazoD.y = 1.0 + 1.25 * sube
        meta.dedosD.z = 1.0; meta.pulgarD.y = -0.6                                            // la mano agarra el bocado
    } else if (nombre === 'hablar') { // de pie hablando (la mamá): asiente con la cabeza y acompaña con la mano derecha
        meta.espalda.x = 0.02 * Math.sin(t * 1.6); meta.antebrazoI.y = -0.2; meta.brazoI.z += 0.06
        meta.cabeza.x = 0.06 * Math.sin(t * 7); meta.cabeza.y = 0.08 * Math.sin(t * 0.9)
        meta.brazoD.z -= 0.1; meta.brazoD.x = -0.35; meta.antebrazoD.y = 0.7 + 0.35 * Math.sin(t * 3.2); meta.manoD.z = 0.2
    } else if (nombre === 'abrazar') { // abrazo (Gabriela y la mamá, main.js): los brazos al frente rodean al otro y la cabeza se ladea y se
        // apoya; k: cuánto (0 → 1, para entrar y salir suave) · r: hacia dónde mira la cabeza (positivo: hacia abajo, la mamá mira a Gabriela)
        const a = paso(0, 1, k), resp = 0.02 * Math.sin(t * 1.4)
        meta.brazoI.z = -BRAZO_ABAJO + 0.25 * a; meta.brazoD.z = BRAZO_ABAJO - 0.25 * a     // los brazos se abren un poco hacia los lados…
        meta.brazoI.x = meta.brazoD.x = -1.15 * a                                             // …y van al frente
        meta.antebrazoI.y = -1.5 * a; meta.antebrazoD.y = 1.5 * a                             // y se doblan hacia adentro: rodean
        mano(meta, 0.35 + 0.3 * a)
        meta.espalda.x = (0.06 + 0.1 * r) * a + resp; meta.cabeza.x = (0.08 + 0.3 * r) * a; meta.cabeza.y = 0.35 * a; meta.cabeza.z = -0.12 * a
    } else { // de pie: respira despacio, con los brazos sueltos
        meta.espalda.x = 0.02 * Math.sin(t * 1.6); meta.antebrazoI.y = -0.2; meta.antebrazoD.y = 0.2
        meta.brazoI.z += 0.06; meta.brazoD.z -= 0.06; meta.cabeza.y = 0.06 * Math.sin(t * 0.5)
    }
}

// Idle contento (la muestra del index), como un idle alegre de anime: rebota suave doblando las rodillas, con el peso en una pierna y la
// otra suelta (rodilla adelante y un poco hacia adentro, el talón levantado que sube y baja, apoyada en la punta). Los pies no se
// despegan del piso: el tobillo compensa lo que se doblan la rodilla y el muslo. Los puños sueltos cerca del mentón, los codos abajo y
// pegados, rebotando con el cuerpo; cada tanto mira alrededor o pasa el peso a la otra pierna
const PIERNA = 20 // largo del muslo y de la pierna (unidades del archivo)
function posarFeliz(meta, t) {
    const w = paso(-0.25, 0.25, Math.sin(t * 0.35)) * 2 - 1        // 1: peso en la pierna I · -1: en la D (cambia cada ~9 s)
    const rebote = (1 - Math.cos(t * 4.4)) / 2                     // 0 → 1 → 0, unas 0.7 veces por segundo
    const resp = Math.sin(t * 1.8)
    meta.cadera.z = 0.07 * w; meta.espalda.z = -0.06 * w + 0.02 * Math.sin(t * 2.6); meta.espalda.x = -0.03 - 0.03 * rebote
    // piernas: la de apoyo dobla un poco la rodilla al rebotar y el pie queda plano; la libre adelante, con el talón arriba
    const pierna = (lado, libre) => {
        const f = 0.12 + 0.12 * rebote                              // flexión de la rodilla de apoyo
        const talon = libre * (0.35 + 0.25 * Math.max(0, Math.sin(t * 2.6)))  // la pierna libre sube y baja el talón
        const mx = -f - 0.22 * libre, px = 2 * f + 0.25 * libre
        meta['muslo' + lado].x = mx; meta['pierna' + lado].x = px
        meta['pie' + lado].x = -(mx + px) + talon                   // el tobillo deja el pie plano (y en la libre, apoyado en la punta)
        meta['punta' + lado].x = -talon                             // los dedos del pie siguen en el piso
        meta['muslo' + lado].y = (lado === 'I' ? 0.15 : -0.15) * libre // rodilla libre un poco hacia adentro
    }
    const libreI = paso(-1, 1, -w)
    pierna('I', libreI); pierna('D', 1 - libreI)
    meta.musloI.z = meta.musloD.z = -0.07 * w
    // brazos: puños sueltos cerca del mentón, codos abajo y pegados; rebotan con el cuerpo, un poco desfasados entre sí
    meta.brazoI.z = -BRAZO_ABAJO - 0.12; meta.brazoD.z = BRAZO_ABAJO + 0.12
    meta.brazoI.x = -0.72 - 0.1 * Math.sin(t * 4.4 + 0.4); meta.brazoD.x = -0.72 - 0.1 * Math.sin(t * 4.4)
    meta.antebrazoI.y = -2.3; meta.antebrazoD.y = 2.3
    meta.manoI.z = -0.35; meta.manoD.z = 0.35; meta.manoI.x = meta.manoD.x = -0.2
    mano(meta, 1.5)                                                  // puños cerrados
    // cabeza: ladeada siguiendo el rebote, y mira alrededor de vez en cuando
    const mira = paso(-0.2, 0.2, Math.sin(t * 0.23 + 1)) * 2 - 1
    meta.cabeza.y = 0.3 * mira; meta.cabeza.z = 0.08 * Math.sin(t * 2.6 - 0.5) - 0.04 * w; meta.cabeza.x = -0.06 + 0.04 * rebote + 0.015 * resp
    return alturaFeliz(t)
}
// cuánto baja el cuerpo al doblar la rodilla de apoyo (en unidades del juego para alto 1.8): así los pies no se meten en el piso
export const alturaFeliz = (t) => { const f = 0.12 + 0.12 * (1 - Math.cos(t * 4.4)) / 2, v = PIERNA * (Math.cos(f) + Math.cos(f) - 2); return v * 1.8 / MODELO }

// Sobresalto (player.sobresalto y el visor): dura SALTO s; atras = qué fracción del salto hacia atrás lleva, y = altura (unidades del juego)
export const SALTO = 0.8
export const saltoSusto = (p) => { const a = Math.min(1, Math.max(0, (p - 0.12) / 0.48)); return { atras: paso(0.12, 0.6, p), y: 0.32 * Math.sin(Math.PI * a) - 0.07 * (paso(0, 0.1, p) * (1 - paso(0.1, 0.2, p)) + paso(0.6, 0.66, p) * (1 - paso(0.78, 1, p))) } }
// Altura del cuerpo al caminar (en unidades del juego para alto 1.8): abajo con el pie apoyado, arriba al pasar la pierna (dos veces por ciclo)
export const alturaPaso = (fase, k, r = 0) => k * (0.025 + 0.045 * r) * (Math.cos(2 * fase) + 1) / 2

// 4. Exportación: crearPersonaje(alto, archivos) → { grupo, versiones, cargar(clave), pose(nombre, t, k, r), aplicar(dt, rapido) }
//    archivos: { normal: url, oscuro?: url } · cargar('normal') la carga (no se carga sola) · versiones.normal / .oscuro: el contenedor de cada modelo
//    cara: false para los que no llevan los ojos dibujados (los NPC)
//    proporciones, hoja, anchoCara: para otro modelo con el mismo cuerpo base (la mamá): sus pares de alturas (ver tramos), su hoja de
//    caras (hojaDe) y el ancho de los ojos en unidades de su archivo. alto es el de Gabriela: un archivo más alto queda más alto
//    expresion(base, parpadeo): la cara de ahora y con cuál parpadea (cada 2.5 a 6 s, a veces dos seguidos) · fijarCara(nombre): la deja
//    quieta en una expresión, sin parpadear (el debug); null la suelta
export function crearPersonaje(alto, archivos, alCargar, { cara = true, proporciones = null, hoja = HOJA_GABRIELA, anchoCara } = {}) {
    const grupo = new THREE.Group(), versiones = {}, rigs = [], escala = alto / MODELO
    const cuerpo = { prop: proporciones ? tramos(proporciones) : igual, hoja, ancho: anchoCara }
    const giro = Object.fromEntries(NAMES.map(n => [n, new THREE.Vector3()])), meta = Object.fromEntries(NAMES.map(n => [n, new THREE.Vector3()]))
    const fbx = new CargadorModelos(), pedidas = {}, punto = new THREE.Vector3(), inv = new THREE.Matrix4()
    // la cara: una copia de la hoja para cada personaje (comparten la imagen, pero cada uno muestra su propia expresión)
    const tex = cara ? hoja.tex.clone() : null
    const matCara = cara ? new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x555555, transparent: true, alphaTest: 0.08, depthWrite: false, roughness: 0.8, // (un poco de brillo propio: con la luz se veían muy oscuros)
         polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) : null
    let expr = 'normal', parp = 'parpadeo', fija = null, proximo = 2 + Math.random() * 3, cerrada = 0, mostrada = '', cual = '' // cual: el parpadeo de esta vez (si hay varios posibles, uno al azar)
    const cargar = (clave) => { // cada versión se carga una sola vez, cuando se pide · devuelve una promesa que se cumple al estar lista
        if (!archivos[clave]) return Promise.resolve()
        return pedidas[clave] ||= new Promise((listo) => fbx.load(archivos[clave], (o) => {
            const r = armar(o, escala, matCara, cuerpo); versiones[clave] = r.cont; rigs.push(r); grupo.add(r.cont)
            if (clave !== 'normal') r.cont.visible = false
            alCargar?.(clave, r.cont); listo()
        }, undefined, () => listo()))
    }
    return {
        grupo, versiones, cargar,
        pose(nombre, t, k = 1, r = 0) { metaDe(meta, nombre, t, k, r); codos(meta) },
        // piso(): qué tan abajo del origen del grupo queda la suela más baja con la pose actual (en unidades del juego; negativo = bajo el origen).
        // Con esto el cuerpo se sube justo lo necesario para que los pies no se metan en el piso al caminar, agacharse o saltar
        piso() {
            const r = rigs.find(r => r.suela.length); if (!r) return 0 // (de una versión con zapatos: el pijama no trae, pero todas comparten la pose)
            grupo.updateMatrixWorld(true); inv.copy(grupo.matrixWorld).invert()
            let min = Infinity; for (const [sm, i] of r.suela) { sm.getVertexPosition(i, punto); punto.applyMatrix4(sm.matrixWorld).applyMatrix4(inv); if (punto.y < min) min = punto.y }
            return min
        },
        expresion(base, parpadeo = null) { expr = base; parp = parpadeo },
        fijarCara(nombre) { fija = nombre },
        get cara() { return mostrada },
        aplicar(dt, rapido = 10) { // rapido: qué tan rápido va cada hueso hacia su pose (más alto = más brusco)
            const f = Math.min(1, dt * rapido)
            NAMES.forEach(n => giro[n].lerp(meta[n], f))
            rigs.forEach(r => NAMES.forEach(n => r.bones[n].rotation.set(giro[n].x, giro[n].y, giro[n].z)))
            if (!tex) return
            // parpadeo: los ojos se cierran 0.13 s; a veces parpadea dos veces seguidas
            if ((proximo -= dt) <= 0) { cerrada = 0.13; cual = Array.isArray(parp) ? parp[Math.floor(Math.random() * parp.length)] : parp; proximo = Math.random() < 0.2 ? 0.28 : 2.5 + Math.random() * 3.5 }
            cerrada -= dt
            const ahora = fija ?? (cerrada > 0 && parp ? cual : expr)
            if (ahora !== mostrada) { mostrada = ahora; mostrar(tex, hoja, ahora) }
        }
    }
}

// 5. Extras (los NPC de assets/npc): el mismo cuerpo base de Gabriela con otra ropa, todo negro (siluetas). Son muchos, así que cada archivo
//    se carga y se pesa UNA vez y todas sus copias comparten la geometría (juntada en una sola malla: un solo dibujo por persona); cada
//    copia solo tiene su propio esqueleto, para poder caminar o sentarse por su cuenta. Llevan los ojos blancos de las siluetas de antes
//    crearExtras(alto, urls) → { listo: promesa, nueva(i) → { cont, pose(nombre, t, k, r), aplicar(dt), cabeza } } (i: cuál archivo)
const negro = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.9 }), blanco = new THREE.MeshBasicMaterial({ color: 0xffffff })
const ojoExtra = new THREE.SphereGeometry(1, 10, 8)
export function crearExtras(alto, urls) {
    const escala = alto / MODELO, formas = []
    const listo = Promise.all(urls.map((u, i) => new CargadorModelos().loadAsync(u).then(o => {
        o.updateMatrixWorld(true)
        const partes = []; o.traverse(c => { if (!c.isMesh) return; let g = pesada(c); if (g.index) g = g.toNonIndexed(); Object.keys(g.attributes).forEach(k => { if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k) }); g.clearGroups(); partes.push(g) })
        formas[i] = mergeGeometries(partes)
    }).catch(() => {})))
    return {
        listo,
        nueva(i) {
            const forma = formas[i % formas.length] ?? formas.find(Boolean); if (!forma) return null
            const cont = new THREE.Group(), { bones, skeleton } = esqueleto(cont)
            const sm = new THREE.SkinnedMesh(forma, negro); sm.bind(skeleton, new THREE.Matrix4()); cont.add(sm)
            sm.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 70, 0), 95) // (fija: calcularla con los huesos en cada cuadro es caro) · así los que no se ven no se dibujan
            ;[-1, 1].forEach(s => { const e = new THREE.Mesh(ojoExtra, blanco); e.scale.set(2.4, 4.8, 1.2); e.position.set(s * 8, 103.5 - JOINTS.cabeza[2], 19.4); bones.cabeza.add(e) }) // ojos blancos: óvalos largos (antes puntitos), a la altura de los de Gabriela
            cont.scale.setScalar(escala)
            const giro = Object.fromEntries(NAMES.map(n => [n, new THREE.Vector3()])), meta = Object.fromEntries(NAMES.map(n => [n, new THREE.Vector3()]))
            return {
                cont, cabeza: bones.cabeza,
                pose(nombre, t, k = 1, r = 0) { metaDe(meta, nombre, t, k, r); codos(meta) },
                aplicar(dt, rapido = 10) { const f = Math.min(1, dt * rapido); NAMES.forEach(n => { giro[n].lerp(meta[n], f); bones[n].rotation.set(giro[n].x, giro[n].y, giro[n].z) }) }
            }
        }
    }
}
