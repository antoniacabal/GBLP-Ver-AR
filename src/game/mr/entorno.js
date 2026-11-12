// Indice
    // 0. Imports
    // 1. Superficies detectadas (planos: mesas, piso, paredes, muebles)
    // 2. Malla del cuarto (mesh-detection)
    // 3. Retícula y colocación de la maqueta (hit-test + anclas)
    // 4. Seguridad: avisar si hay una pared o un mueble muy cerca
    // 5. API pública (entorno)

// El entorno real: las gafas detectan lo que hay alrededor (WebXR: plane-detection, mesh-detection, hit-test y anchors).
//   · Se dibuja el contorno de las superficies que encuentran (con su nombre: mesa, piso, pared...), sobre todo mientras se busca dónde
//     poner la maqueta
//   · La maqueta se pone sobre una superficie real apuntando con el control (o mirando) y pulsando el gatillo; queda anclada ahí
//   · Si quien juega se acerca mucho a una pared o a un mueble, sale un aviso (el juego se juega quieto, pero en el miedo uno se mueve)
// Todo es opcional: si el navegador no da alguna de estas funciones, la maqueta igual se puede poner (frente a quien juega)

// 0. Imports
import * as THREE from 'three'
import { rig } from './diorama.js'
import { mr } from './estado.js'

const grupo = new THREE.Group(); rig.add(grupo) // (en el espacio real: el rig lo lleva al mundo)
const NOMBRES = { table: 'Mesa', desk: 'Escritorio', floor: 'Piso', wall: 'Pared', ceiling: 'Techo', couch: 'Sofá', bed: 'Cama', door: 'Puerta', window: 'Ventana', shelf: 'Estante', screen: 'Pantalla', storage: 'Mueble', lamp: 'Lámpara', plant: 'Planta', other: 'Objeto', 'wall art': 'Cuadro', global_mesh: 'Cuarto' }
const COLORES = { table: 0xf2c063, desk: 0xf2c063, floor: 0x9ff0de, wall: 0xa6869b, ceiling: 0x71708a }
const color = (l) => COLORES[l] ?? 0xd8c8ae
const horizontalBuena = (l) => !l || l === 'table' || l === 'desk' || l === 'floor' || l === 'couch' || l === 'bed' || l === 'other' || l === 'storage' // donde tiene sentido poner la maqueta

// Etiqueta con el nombre de lo detectado (un sprite pequeño)
function etiqueta(texto, col) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d')
    x.fillStyle = 'rgba(32,24,38,.85)'; x.beginPath(); x.roundRect(4, 8, 248, 48, 14); x.fill()
    x.strokeStyle = '#' + col.toString(16).padStart(6, '0'); x.lineWidth = 3; x.stroke()
    x.fillStyle = '#E4FFFF'; x.font = '600 28px Outfit, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(texto, 128, 33)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(0.16, 0.04, 1)
    return s
}

// 1. Superficies detectadas: un contorno por plano, que se actualiza cuando las gafas lo cambian
const planos = new Map() // XRPlane → { obj, linea, lbl, t, label, orient, poly }
function verPlano(plane, pose) {
    let p = planos.get(plane)
    if (!p) {
        const label = plane.semanticLabel || '', col = color(label)
        const linea = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.8 }))
        const relleno = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }))
        const obj = new THREE.Group(); obj.matrixAutoUpdate = false; obj.add(relleno, linea)
        const lbl = etiqueta(NOMBRES[label] || 'Superficie', col); obj.add(lbl)
        grupo.add(obj); p = { obj, linea, relleno, lbl, t: -1, label, orient: plane.orientation }; planos.set(plane, p)
    }
    if (p.t !== plane.lastChangedTime) { // el contorno cambió (las gafas lo afinan con el tiempo)
        p.t = plane.lastChangedTime
        const pts = plane.polygon.map(v => new THREE.Vector3(v.x, 0.002, v.z))
        p.linea.geometry.dispose(); p.linea.geometry = new THREE.BufferGeometry().setFromPoints(pts)
        const forma = new THREE.Shape(pts.map(v => new THREE.Vector2(v.x, -v.z)))
        const g = new THREE.ShapeGeometry(forma); g.rotateX(-Math.PI / 2); p.relleno.geometry.dispose(); p.relleno.geometry = g
        const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, pts.length)); p.lbl.position.set(c.x, 0.05, c.z)
        p.poly = plane.polygon.map(v => [v.x, v.z])
    }
    p.obj.matrix.fromArray(pose.transform.matrix); p.obj.matrixWorldNeedsUpdate = true
    p.mundo = p.obj.matrix // (en el espacio real)
}

// 2. Malla del cuarto (Quest 3: mesh-detection). Se dibuja como una red tenue mientras se coloca la maqueta y sirve para la seguridad
const mallas = new Map() // XRMesh → { obj, t, caja }
function verMalla(mesh, pose) {
    let m = mallas.get(mesh)
    if (!m) {
        const obj = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: color(mesh.semanticLabel), wireframe: true, transparent: true, opacity: 0.12, depthWrite: false }))
        obj.matrixAutoUpdate = false; grupo.add(obj); m = { obj, t: -1, label: mesh.semanticLabel || '' }; mallas.set(mesh, m)
    }
    if (m.t !== mesh.lastChangedTime) {
        m.t = mesh.lastChangedTime
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.vertices), 3)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.indices), 1))
        g.computeBoundingBox(); m.obj.geometry.dispose(); m.obj.geometry = g; m.caja = g.boundingBox
    }
    m.obj.matrix.fromArray(pose.transform.matrix); m.obj.matrixWorldNeedsUpdate = true
}
const limpiar = (mapa, vivos) => { for (const [k, v] of mapa) if (!vivos.has(k)) { grupo.remove(v.obj); mapa.delete(k) } }

// 3. Retícula: un aro dorado donde caería la maqueta. El gatillo la pone ahí, de frente a quien juega
const reticula = new THREE.Group(); reticula.visible = false; rig.add(reticula)
{
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.085, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c063, transparent: true, opacity: 0.95, depthTest: false }))
    const marco = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x * 0.33, 0.003, z * 0.33))), new THREE.LineBasicMaterial({ color: 0xf2c063, transparent: true, opacity: 0.6 }))
    aro.renderOrder = 30; reticula.add(aro, marco)
}
let fuenteVista = null, fuentesControl = new Map(), ultimoHit = null, ultimoBueno = false
export async function prepararHitTest(sesion) {
    fuenteVista = null; fuentesControl.clear()
    if (!sesion.requestHitTestSource) return
    try { fuenteVista = await sesion.requestHitTestSource({ space: await sesion.requestReferenceSpace('viewer') }) } catch { /* sin hit-test */ }
}
async function fuenteDe(src) { // hit-test desde el rayo de cada control (apuntar es más cómodo que mirar)
    if (fuentesControl.has(src) || !mr.sesion?.requestHitTestSource) return
    fuentesControl.set(src, null)
    try { fuentesControl.set(src, await mr.sesion.requestHitTestSource({ space: src.targetRaySpace })) } catch { /* sin hit-test */ }
}
const Yup = new THREE.Vector3(), mtx = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), esc = new THREE.Vector3()
function buscarSuperficie(frame, ref) {
    ultimoHit = null
    const prob = [...fuentesControl.values()].filter(Boolean)
    if (fuenteVista) prob.push(fuenteVista)
    for (const f of prob) {
        const r = frame.getHitTestResults(f)[0]; if (!r) continue
        const pose = r.getPose(ref); if (!pose) continue
        mtx.fromArray(pose.transform.matrix); mtx.decompose(pos, quat, esc); Yup.set(0, 1, 0).applyQuaternion(quat)
        ultimoHit = { r, p: pos.clone(), horizontal: Yup.y > 0.85 }; break
    }
    // ¿sobre qué cayó? (si las gafas detectaron planos: el más cercano debajo de la retícula)
    let sobre = ''
    if (ultimoHit) for (const p of planos.values()) if (p.orient === 'horizontal' && p.poly && dentro(p, ultimoHit.p)) { sobre = p.label; break }
    ultimoBueno = !!ultimoHit && ultimoHit.horizontal && horizontalBuena(sobre)
    reticula.visible = !!ultimoHit && mr.colocando
    if (ultimoHit) { reticula.position.copy(ultimoHit.p); reticula.rotation.set(0, yawHacia(ultimoHit.p), 0); reticula.children.forEach(c => c.material.color.setHex(ultimoBueno ? 0xf2c063 : 0xa6869b)) }
    return sobre
}
const local = new THREE.Vector3(), inv = new THREE.Matrix4()
function dentro(p, v) { // ¿v (espacio real) está sobre el polígono del plano? (cerca de su altura)
    inv.copy(p.obj.matrix).invert(); local.copy(v).applyMatrix4(inv)
    if (Math.abs(local.y) > 0.06) return false
    let d = false; const P = p.poly
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > local.z) !== (P[j][1] > local.z) && local.x < (P[j][0] - P[i][0]) * (local.z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) d = !d
    return d
}
const yawHacia = (p) => Math.atan2(mr.cabeza.x - p.x, mr.cabeza.z - p.z) // la bandeja mira hacia quien juega

// La maqueta queda girada para que, al ponerla, quien juega la vea como en la pantalla (la cámara isométrica: 45°)
function poner(p) {
    const a = Math.atan2(mr.cabeza.x - p.x, mr.cabeza.z - p.z)
    mr.ancla.p.copy(p); mr.ancla.yaw = THREE.MathUtils.degToRad(45) - a; mr.giro = 0; mr.ancla.puesta = true
}
async function anclar(hit) { // ancla real (si las gafas la dan): la maqueta no se corre aunque el seguimiento se reajuste
    mr.ancla.xrAnchor?.delete?.(); mr.ancla.xrAnchor = null
    try { if (hit.r.createAnchor) mr.ancla.xrAnchor = await hit.r.createAnchor() } catch { /* sin anclas */ }
}

// 4. Seguridad: la distancia de la cabeza a las paredes y muebles detectados
const AVISO_CERCA = 0.4
function distanciaSegura() {
    let min = Infinity, que = ''
    for (const p of planos.values()) {
        if (p.orient !== 'vertical' || !p.poly) continue
        inv.copy(p.obj.matrix).invert(); local.copy(mr.cabeza).applyMatrix4(inv)
        const xs = p.poly.map(v => v[0]), zs = p.poly.map(v => v[1])
        const dx = Math.max(Math.min(...xs) - local.x, 0, local.x - Math.max(...xs)), dz = Math.max(Math.min(...zs) - local.z, 0, local.z - Math.max(...zs))
        const d = Math.hypot(local.y, dx, dz); if (d < min) { min = d; que = p.label || 'wall' }
    }
    for (const m of mallas.values()) {
        if (!m.caja || m.label === 'global_mesh' || m.label === 'floor' || m.label === 'ceiling') continue
        inv.copy(m.obj.matrix).invert(); local.copy(mr.cabeza).applyMatrix4(inv)
        const d = m.caja.distanceToPoint(local); if (d < min) { min = d; que = m.label || 'other' }
    }
    return { min, que }
}

// 5. API pública
let tAviso = 0
export const entorno = {
    // mientras se coloca la maqueta las superficies se ven claras; después casi no (no distraen del juego)
    actualizar(frame, ref, dt, controles) {
        if (!frame) { reticula.visible = false; return }
        const vivosP = new Set(), vivosM = new Set()
        frame.detectedPlanes?.forEach(pl => { const pose = frame.getPose(pl.planeSpace, ref); if (pose) { verPlano(pl, pose); vivosP.add(pl) } })
        frame.detectedMeshes?.forEach(me => { const pose = frame.getPose(me.meshSpace, ref); if (pose) { verMalla(me, pose); vivosM.add(me) } })
        limpiar(planos, vivosP); limpiar(mallas, vivosM)
        const fuerte = mr.colocando
        planos.forEach(p => { p.linea.material.opacity = fuerte ? 0.85 : 0.18; p.relleno.material.opacity = fuerte ? 0.1 : 0; p.lbl.visible = fuerte })
        mallas.forEach(m => { m.obj.visible = fuerte })
        // el ancla real puede reajustarse: la maqueta la sigue
        if (mr.ancla.xrAnchor && !mr.colocando) { const pose = frame.getPose(mr.ancla.xrAnchor.anchorSpace, ref); if (pose) mr.ancla.p.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z) }
        controles?.forEach(src => fuenteDe(src))
        const sobre = mr.colocando ? buscarSuperficie(frame, ref) : (reticula.visible = false, '')
        // seguridad: aviso si la cabeza queda a menos de 40 cm de una pared o un mueble (se repite cada tanto mientras siga cerca)
        const { min, que } = distanciaSegura()
        tAviso = Math.max(0, tAviso - dt)
        if (min < AVISO_CERCA) { mr.aviso = `Cuidado: tienes ${que === 'wall' ? 'una pared' : 'un mueble'} muy cerca`; if (!tAviso) { tAviso = 2; this.alAviso?.() } }
        else if (mr.colocando) mr.aviso = ultimoHit ? (ultimoBueno ? `${NOMBRES[sobre] ? NOMBRES[sobre] + ' detectada' + (sobre === 'floor' ? 'o' : '') + ' · ' : ''}Pellizca (o pulsa el gatillo) para poner la maqueta aquí` : 'Apunta a una superficie plana (una mesa o el piso)') : 'Buscando superficies… mira o apunta a una mesa o al piso'
        else mr.aviso = ''
    },
    get puedePoner() { return !!ultimoHit && ultimoBueno },
    // gatillo mientras se coloca: pone la maqueta en la retícula (o, sin hit-test, frente a quien juega a la altura de una mesa)
    async poner() {
        if (ultimoHit && ultimoBueno) { poner(ultimoHit.p); await anclar(ultimoHit); return true }
        if (fuenteVista || fuentesControl.size) return false // hay hit-test pero no se encontró una superficie buena
        this.ponerFrente(); return true
    },
    ponerFrente() { // sin detección de superficies: 55 cm adelante y 70 cm debajo de los ojos (o a 75 cm del piso)
        const d = new THREE.Vector3(0, 0, -1).applyQuaternion(mr.cabezaQ || new THREE.Quaternion()); d.y = 0; if (d.lengthSq() < 0.01) d.set(0, 0, -1); d.normalize()
        const p = mr.cabeza.clone().addScaledVector(d, 0.55); p.y = mr.pisoReal ? 0.75 : mr.cabeza.y - 0.7
        poner(p)
    },
    reiniciar() { planos.forEach(p => grupo.remove(p.obj)); planos.clear(); mallas.forEach(m => grupo.remove(m.obj)); mallas.clear(); fuenteVista = null; fuentesControl.clear(); reticula.visible = false },
    alAviso: null
}
