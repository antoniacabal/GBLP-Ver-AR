// Lectura de las manos: cada cuadro, las articulaciones que importan del seguimiento de manos de las gafas (WebXR Hand Input), en metros,
// en el espacio de referencia de la sesión. La usan la colocación (las manos apoyadas en la mesa), el joystick (agarrarlo con la mano
// cerrada) y los gestos. IWSDK no reconoce gestos: se calculan aquí con las articulaciones.
import * as THREE from 'three'

const V = () => new THREE.Vector3()
const ART = ['wrist', 'thumb-tip', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-tip', 'middle-finger-phalanx-proximal', 'middle-finger-tip',
    'ring-finger-phalanx-proximal', 'ring-finger-tip', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-tip']
const crearMano = () => ({ ok: false, libre: false, p: Object.fromEntries(ART.map(n => [n, V()])), pellizco: false, puno: false, abierta: false, dedos: 0 })
export const manos = { left: crearMano(), right: crearMano() }
export const cabeza = { p: V(), q: new THREE.Quaternion() }

export function leer(frame, ref, sesion) {
    manos.left.ok = manos.right.ok = false
    const vista = frame.getViewerPose(ref)
    if (vista) { const t = vista.transform; cabeza.p.set(t.position.x, t.position.y, t.position.z); cabeza.q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w) }
    for (const src of sesion.inputSources) {
        const m = src.hand && manos[src.handedness]; if (!m) continue
        let ok = true
        for (const n of ART) {
            const j = src.hand.get(n), pose = j && frame.getJointPose?.(j, ref)
            if (!pose) { ok = false; break }
            const t = pose.transform.position; m.p[n].set(t.x, t.y, t.z)
        }
        m.ok = ok; if (!ok) continue
        const P = m.p, d = (a, b) => P[a].distanceTo(P[b])
        const pz = d('thumb-tip', 'index-finger-tip'); m.pellizco = m.pellizco ? pz < 0.045 : pz < 0.025 // (con histéresis: no parpadea)
        const puntas = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'].reduce((s, n) => s + d(n, 'wrist'), 0) / 4
        m.puno = m.puno ? puntas < 0.11 : puntas < 0.085 // las cuatro puntas cerca de la muñeca
        m.abierta = puntas > 0.145
        const larga = (f) => d(f + '-tip', 'wrist') > d(f + '-phalanx-proximal', 'wrist') + 0.04 // la punta bastante más lejos que su nudillo
        m.dedos = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].filter(larga).length + (d('thumb-tip', 'pinky-finger-metacarpal') > 0.085 ? 1 : 0)
    }
}

// hacia dónde mira la palma (sale de la palma, hacia afuera): en la mano izquierda el orden del producto cruz se invierte
const a = V(), b = V()
export function normalPalma(m, lado, out = V()) {
    a.subVectors(m.p['index-finger-metacarpal'], m.p.wrist); b.subVectors(m.p['pinky-finger-metacarpal'], m.p.wrist)
    return (lado === 'left' ? out.crossVectors(b, a) : out.crossVectors(a, b)).normalize()
}
// el centro de la palma (entre la muñeca y los nudillos)
export const centroPalma = (m, out = V()) => out.copy(m.p.wrist).add(m.p['middle-finger-phalanx-proximal']).multiplyScalar(0.5)
// el hueco de la mano cerrada (donde quedaría el palito del joystick): entre el nudillo y la punta del índice y la punta del pulgar
export const huecoMano = (m, out = V()) => out.copy(m.p['index-finger-phalanx-proximal']).add(m.p['index-finger-tip']).add(m.p['thumb-tip']).multiplyScalar(1 / 3)
