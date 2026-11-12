// Indice
    // 0. Imports
    // 1. Panel de la interfaz, fundido y viñeta (en 3D)
    // 2. Cabeza: en las gafas (pose real) o en la vista previa (mouse)
    // 3. Hacia dónde está quien juega (para que "adelante" sea hacia el fondo de la maqueta)
    // 4. Recorte de la calle (solo se dibuja lo que cae en el recuadro)
    // 5. Dibujar
    // 6. Colocar la maqueta
    // 7. Entrar y salir (sesión WebXR o vista previa)
    // 8. Pantalla de inicio (elegir cómo jugar)

// Realidad mixta: el juego en unas gafas (Meta Quest 3 / 3S, Pico, Android con ARCore) como una maqueta sobre una mesa real.
// main.js sigue siendo el juego; este módulo solo cambia cómo se ve y cómo se controla:
//   · la cámara es la cabeza de quien juega (el juego ya no la mueve ni la hace temblar)
//   · el mundo se recorta en un recuadro alrededor de Gabriela y el mapa se mueve debajo de ella (diorama.js)
//   · las gafas detectan las superficies y muebles del cuarto (entorno.js)
//   · la interfaz HTML se copia en un panel 3D (espejo.js) y los controles hacen clic en ella (controles.js)
// Sin gafas hay una vista previa en el computador con lo mismo (la maqueta en una mesa virtual, el panel y el mouse como rayo)

// 0. Imports
import * as THREE from 'three'
import gsap from 'gsap'
import { renderer, scene, canvas } from '../scene.js'
import { CONFIG, runtime } from '../config.js'
import { audio } from '../audio.js'
import { player } from '../player.js'
import { breathing } from '../breathing.js'
import { spaces, modelosListos } from '../environment.js'
import { mr, COMODIDAD } from './estado.js'
import { escenaMR, rig, camaraMR, planos, actualizarDiorama, olvidarCajas, recuadro } from './diorama.js'
import { espejo, textura } from './espejo.js'
import { entorno, prepararHitTest } from './entorno.js'
import { controles, registrarPanel, usarAtrapador } from './controles.js'
export { mr }

// 1. Panel: la interfaz del juego, como una pantalla grande y transparente a 1 m (se acomoda despacio hacia donde miras)
const ANCHO_PANEL = 1.0, DIST_PANEL = 1.05
const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
panel.renderOrder = 10; panel.visible = false; rig.add(panel, controles.puntoPanel); registrarPanel(panel)
const tamPanel = () => panel.scale.set(ANCHO_PANEL, ANCHO_PANEL * innerHeight / innerWidth, 1)
tamPanel(); addEventListener('resize', tamPanel)
// Fundido a negro (y el destello blanco del sismo): una esfera alrededor de la cabeza. En realidad mixta nunca tapa del todo el cuarto real
const fundido = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }))
fundido.renderOrder = 5; fundido.frustumCulled = false; camaraMR.add(fundido)
// Viñeta de la ansiedad: los bordes de la vista se oscurecen (como en la pantalla). Ayuda además a no marearse
const vineta = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')
    const g = x.createRadialGradient(128, 128, 40, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,1)')
    x.fillStyle = g; x.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthTest: false, depthWrite: false }))
    m.position.z = -0.25; m.renderOrder = 6; m.frustumCulled = false; camaraMR.add(m); return m
})()
// Fondo morado oscuro (el de la interfaz del juego, #201826) con los textos: cuando sale una tarjeta, un diálogo, un pop-up, una frase sobre negro o el anuncio de un minijuego, todo lo
// de alrededor (el cuarto real) se oscurece y solo quedan la maqueta y el texto: así quien juega entra en la escena.
// Es una esfera grande alrededor de la cabeza que sí respeta la profundidad: la maqueta está más cerca, así que no la tapa
const velo = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), new THREE.MeshBasicMaterial({ color: 0x201826, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false }))
velo.renderOrder = 4; velo.frustumCulled = false; velo.visible = false; camaraMR.add(velo)
const TEXTOS = '.gx-card:not([hidden]), .gx-talk:not([hidden]), .gx-modal:not([hidden]), .gx-anuncio:not([hidden]), .gx-aviso:not([hidden])'
const elSusurro = document.querySelector('.gx-whisper')
const hayTexto = () => !!document.querySelector(TEXTOS) || (!!elSusurro.textContent.trim() && parseFloat(getComputedStyle(elSusurro).opacity) > 0.05)
let veloT = 0
function oscurecer(dt) {
    const quiere = hayTexto() ? 0.9 : 0
    veloT += (quiere - veloT) * Math.min(1, dt * 3) // entra y sale con un fundido corto (sin golpes de luz)
    velo.material.opacity = veloT; velo.visible = veloT > 0.01
}
const elFundido = document.querySelector('.gx-fade'), elVineta = document.querySelector('.gx-vignette')
const colorFundido = new THREE.Color()
function fundidos() {
    const cs = getComputedStyle(elFundido), o = parseFloat(cs.opacity) || 0
    fundido.material.opacity = Math.min(o, mr.modo === 'ar' ? COMODIDAD.fundidoAR : 1); fundido.visible = o > 0.003
    colorFundido.setStyle(cs.backgroundColor || '#000'); fundido.material.color.copy(colorFundido)
    const v = parseFloat(elVineta.style.opacity) || 0
    vineta.material.opacity = Math.min(0.75, v * (mr.modo === 'ar' ? 0.7 : 1)); vineta.visible = v > 0.01
}

// 2. Cabeza: dónde está y hacia dónde mira (en el espacio real)
mr.cabezaQ = new THREE.Quaternion()
const sim = { az: 0, el: THREE.MathUtils.degToRad(42), dist: 1.2, arrastre: null }
function cabezaSim() { // vista previa: la cámara mira la mesa desde donde la ponga el mouse (clic derecho y arrastrar; rueda para acercar)
    const A = mr.ancla.p, ce = Math.cos(sim.el)
    camaraMR.position.set(A.x + Math.sin(sim.az) * ce * sim.dist, A.y + Math.sin(sim.el) * sim.dist, A.z + Math.cos(sim.az) * ce * sim.dist)
    const m = new THREE.Matrix4().lookAt(camaraMR.position, new THREE.Vector3(A.x, A.y + 0.02, A.z), new THREE.Vector3(0, 1, 0))
    camaraMR.quaternion.setFromRotationMatrix(m)
    mr.cabeza.copy(camaraMR.position); mr.cabezaQ.copy(camaraMR.quaternion)
}
function cabezaXR(frame) {
    const pose = frame?.getViewerPose(mr.espacio); if (!pose) return false
    const p = pose.transform.position, o = pose.transform.orientation
    mr.cabeza.set(p.x, p.y, p.z); mr.cabezaQ.set(o.x, o.y, o.z, o.w); return true
}

// 3. Hacia dónde está quien juega, en el mundo del juego. player.js mueve el joystick relativo a CONFIG.camera.azimuth (en la pantalla
//    es la cámara isométrica): aquí es la cabeza, así el stick hacia adelante siempre lleva a Gabriela lejos de ti. También sirve para
//    que las casas que la tapan se vuelvan transparentes desde donde estás y para que en los finales mire hacia ti
const adelante = new THREE.Vector3(), aCabeza = new THREE.Vector3()
function azimut() {
    adelante.set(0, 0, -1).applyQuaternion(mr.cabezaQ).applyQuaternion(rig.quaternion); adelante.y = 0
    aCabeza.copy(mr.cabeza).applyMatrix4(rig.matrixWorld).sub(player.group.position); aCabeza.y = 0
    const v = adelante.lengthSq() > 0.04 ? adelante.negate() : aCabeza // (mirando justo hacia abajo: hacia donde está la cabeza)
    if (v.lengthSq() > 1e-6) CONFIG.camera.azimuth = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z))
}

// 4. Recorte de la calle: lo que queda fuera del recuadro no se dibuja (las gafas tienen que dibujar todo dos veces, una por ojo).
//    Se esconde solo mientras se dibuja y se vuelve a mostrar enseguida: el juego nunca lo nota
let piezas = null
const esfera = new THREE.Sphere(), escondidas = []
function prepararPiezas() {
    piezas = []
    spaces.STREET.traverse(o => {
        if (!o.isMesh || !o.geometry) return
        if (o.isInstancedMesh) { o.computeBoundingSphere(); piezas.push({ o, s: o.boundingSphere.clone() }); return }
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
        piezas.push({ o, s: o.geometry.boundingSphere.clone() })
    })
}
function esconderFuera() {
    if (runtime.space !== 'STREET' || !piezas) return
    const r = recuadro
    for (const { o, s } of piezas) {
        if (!o.visible) continue
        esfera.copy(s).applyMatrix4(o.matrixWorld)
        const dx = Math.max(Math.abs(esfera.center.x - r.x) - r.hx, 0), dz = Math.max(Math.abs(esfera.center.z - r.z) - r.hz, 0)
        if (Math.hypot(dx, dz) > esfera.radius + 0.5) { o.visible = false; escondidas.push(o) }
    }
}
const mostrarFuera = () => { while (escondidas.length) escondidas.pop().visible = true }
modelosListos.then(() => { olvidarCajas(); prepararPiezas() })

// 5. Dibujar (main.js llama a dibujarMR en vez de dibujar con la cámara isométrica)
const reloj = new THREE.Clock()
let tEspejo = 0, panelYaw = null, panelY = 1.5
function ponerPanel(dt) {
    if (mr.modo === 'sim') { // en la vista previa, el panel va pegado a la vista (como la interfaz de la pantalla)
        panel.position.copy(mr.cabeza).add(new THREE.Vector3(0, 0, -DIST_PANEL * 0.94).applyQuaternion(mr.cabezaQ)); panel.quaternion.copy(mr.cabezaQ); return
    }
    // en las gafas: se queda quieto mientras miras la maqueta y solo te sigue si giras mucho la cabeza (sin moverse con cada gesto)
    adelante.set(0, 0, -1).applyQuaternion(mr.cabezaQ)
    const yaw = Math.atan2(-adelante.x, -adelante.z)
    if (panelYaw === null) { panelYaw = yaw; panelY = mr.cabeza.y }
    const d = Math.atan2(Math.sin(yaw - panelYaw), Math.cos(yaw - panelYaw))
    if (Math.abs(d) > THREE.MathUtils.degToRad(32)) panelYaw += d * Math.min(1, dt * 2.5)
    panelY += (mr.cabeza.y - 0.02 - panelY) * Math.min(1, dt * 1.5)
    panel.position.set(mr.cabeza.x - Math.sin(panelYaw) * DIST_PANEL, panelY, mr.cabeza.z - Math.cos(panelYaw) * DIST_PANEL)
    panel.rotation.set(0, panelYaw, 0)
}
export function dibujarMR() {
    // En las gafas la página deja de recibir requestAnimationFrame (solo corren los cuadros de la sesión WebXR). GSAP mueve todos los
    // tiempos del juego con ese reloj: sin esto se congelaba todo (se quedaba en la tarjeta "10 de agosto"). Aquí se le da cada cuadro
    if (mr.xr) gsap.ticker.tick()
    const dt = Math.min(reloj.getDelta(), 0.1), t = reloj.elapsedTime
    const frame = mr.xr ? renderer.xr.getFrame() : null
    if (mr.xr) {
        cabezaXR(frame)
        entorno.actualizar(frame, mr.espacio, dt, controles.fuentes)
        if (!mr.ancla.puesta && !mr.colocando && mr.cabeza.lengthSq()) entorno.ponerFrente()
    } else cabezaSim()
    actualizarDiorama(dt, t) // (con la pose de la maqueta del cuadro: los rayos y el panel ya la usan)
    controles.actualizar(dt)
    azimut(); ponerPanel(dt); fundidos(); oscurecer(dt)
    if (mr.modo === 'sim') controles.mando() // (vista previa en el navegador de las gafas: los controles llegan como un mando)
    // la interfaz se vuelve a copiar unas 24 veces por segundo (40 en los minijuegos, que se mueven más)
    if ((tEspejo -= dt) <= 0) {
        tEspejo = breathing.active ? 1 / 40 : 1 / 24
        if (espejo.actualizar(mr.aviso) && mr.aviso) espejo.aviso(mr.aviso)
        panel.visible = !espejo.vacio && !mr.domOverlay
    }
    // el juego, recortado al recuadro; después lo de la realidad mixta (bandeja, panel, controles) encima
    const fondo = scene.background
    if (mr.modo === 'ar') scene.background = null // (se ve el cuarto real detrás)
    esconderFuera()
    renderer.clippingPlanes = mr.ancla.puesta || !mr.xr ? planos : fueraDeVista
    renderer.render(scene, camaraMR)
    mostrarFuera()
    renderer.clippingPlanes = []
    const ac = renderer.autoClear; renderer.autoClear = false
    renderer.render(escenaMR, camaraMR)
    renderer.autoClear = ac
    scene.background = fondo
}
const fueraDeVista = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -1e6)] // (mientras no hay maqueta puesta, el juego no se dibuja)

// 6. Colocar la maqueta: el juego se pausa mientras tanto
let pausadoAqui = false
function empezarColocacion() {
    if (!mr.xr) return
    mr.colocando = true; mr.ancla.puesta = false; controles.soltarTodo()
    if (!runtime.paused) { pausadoAqui = true; runtime.paused = true; gsap.globalTimeline.pause(); audio.setPaused?.(true) }
}
function terminarColocacion() {
    mr.colocando = false; mr.aviso = ''
    if (pausadoAqui) { pausadoAqui = false; runtime.paused = false; gsap.globalTimeline.resume(); audio.setPaused?.(false) }
}
mr.alColocar = async () => { if (await entorno.poner()) terminarColocacion() }
mr.alRecolocar = () => { if (!mr.colocando) empezarColocacion() }
entorno.alAviso = () => { try { controles.fuentes.forEach(s => s.gamepad?.hapticActuators?.[0]?.pulse(0.6, 120)) } catch { /* sin vibración */ } }

// 7. Entrar y salir
const ua = navigator.userAgent, enCelular = /Android|iPhone|iPad/.test(ua) && !/OculusBrowser|Quest|Pico/.test(ua)
function sesionInit(tipo, completo) {
    const opcional = ['local-floor', 'hand-tracking']
    if (tipo === 'ar' && completo) opcional.push('hit-test', 'plane-detection', 'mesh-detection', 'anchors', 'depth-sensing')
    else if (tipo === 'ar') opcional.push('hit-test', 'anchors')
    const init = { optionalFeatures: opcional }
    if (opcional.includes('depth-sensing')) init.depthSensing = { usagePreference: ['gpu-optimized', 'cpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32', 'unsigned-short'] } // (three.js lo usa para que tus manos reales tapen la maqueta)
    if (tipo === 'ar' && enCelular) { opcional.push('dom-overlay'); init.domOverlay = { root: document.body } } // en el celular la interfaz HTML se ve encima de la cámara
    return init
}
function modoCuerpo() {
    document.body.classList.toggle('gx-mr-on', mr.vista && !mr.domOverlay)
    document.body.classList.toggle('gx-mr-sim', mr.modo === 'sim')
    CONFIG.player.screenRelative = mr.vista // WASD (en la vista previa) relativo a la vista, como el stick
    dispatchEvent(new Event('resize')) // touch.js vuelve a decidir si muestra el joystick (en la vista previa siempre)
}
async function entrarXR(tipo) {
    const modo = tipo === 'ar' ? 'immersive-ar' : 'immersive-vr'
    let sesion
    try { sesion = await navigator.xr.requestSession(modo, sesionInit(tipo, true)) }
    catch { sesion = await navigator.xr.requestSession(modo, sesionInit(tipo, false)) } // (algún navegador rechaza la lista completa)
    const f = sesion.enabledFeatures
    mr.pisoReal = !f || f.includes('local-floor')
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType(mr.pisoReal ? 'local-floor' : 'local')
    if (tipo === 'ar') renderer.setClearColor(0x000000, 0)
    await renderer.xr.setSession(sesion)
    mr.sesion = sesion; mr.espacio = renderer.xr.getReferenceSpace(); mr.modo = tipo
    mr.domOverlay = sesion.domOverlayState?.type === 'screen'
    if (mr.domOverlay) document.querySelectorAll('.gx, .gx-touch').forEach(el => el.addEventListener('beforexrselect', (e) => e.preventDefault())) // tocar la interfaz no cuenta como gatillo
    panelYaw = null; mr.ancla.puesta = false
    if (tipo === 'ar') { await prepararHitTest(sesion); empezarColocacion() }
    modoCuerpo()
    sesion.addEventListener('end', () => { // al quitarte las gafas (o salir desde el menú) el juego sigue en la vista previa
        controles.soltarTodo(); entorno.reiniciar(); mr.sesion = null; mr.espacio = null; terminarColocacion()
        renderer.setClearColor(0x000000, 1); entrarSim()
    })
}
let atrapador = null
function entrarSim() {
    camaraMR.fov = 50; camaraMR.aspect = innerWidth / innerHeight; camaraMR.updateProjectionMatrix() // (las gafas dejan su propia proyección)
    mr.modo = 'sim'; mr.domOverlay = false; mr.ancla.p.set(0, 0.75, 0); mr.ancla.yaw = THREE.MathUtils.degToRad(45) - sim.az; mr.giro = 0; mr.ancla.puesta = true
    modoCuerpo()
    if (window.juego) Object.assign(window.juego, { mr, recuadro, rig, spaces }) // (?debug: para revisar desde la consola)
    if (atrapador) return
    // una capa transparente encima de la página: el mouse apunta al panel 3D (como el rayo de un control)
    atrapador = document.createElement('div'); atrapador.className = 'mr-atrapador'; document.body.append(atrapador); usarAtrapador(atrapador)
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    const sobrePanel = (e) => {
        ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); rig.updateMatrixWorld(true); camaraMR.updateMatrixWorld(true)
        ray.setFromCamera(ndc, camaraMR); const h = panel.visible && ray.intersectObject(panel, false)[0]
        return h ? [h.uv.x * innerWidth, (1 - h.uv.y) * innerHeight] : []
    }
    atrapador.addEventListener('contextmenu', (e) => e.preventDefault())
    atrapador.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); audio.init()
        try { atrapador.setPointerCapture(e.pointerId) } catch { /* nada */ }
        if (e.button === 2 || e.button === 1) { sim.arrastre = { x: e.clientX, y: e.clientY, az: sim.az, el: sim.el }; return }
        controles.simular('down', ...sobrePanel(e))
    })
    atrapador.addEventListener('pointermove', (e) => {
        e.stopPropagation()
        if (sim.arrastre) { // girar alrededor de la mesa (como caminar alrededor de ella con las gafas)
            sim.az = sim.arrastre.az - (e.clientX - sim.arrastre.x) * 0.006
            sim.el = Math.min(1.35, Math.max(0.25, sim.arrastre.el + (e.clientY - sim.arrastre.y) * 0.004)); return
        }
        controles.simular('move', ...sobrePanel(e))
    })
    atrapador.addEventListener('pointerup', (e) => { e.stopPropagation(); if (sim.arrastre) { sim.arrastre = null; return } controles.simular('up', ...sobrePanel(e)) })
    atrapador.addEventListener('wheel', (e) => { e.preventDefault(); sim.dist = Math.min(2, Math.max(0.35, sim.dist * Math.exp(e.deltaY * 0.001))) }, { passive: false })
}

// 8. Pantalla de inicio: elegir cómo jugar. Entrar a las gafas necesita un clic (el navegador no deja abrirlas solo)
export function elegirModo() {
    const el = document.querySelector('.mr-inicio')
    if (!el) { entrarSim(); return Promise.resolve('sim') }
    const estado = el.querySelector('.mr-estado'), bAR = el.querySelector('[data-mr="ar"]'), bVR = el.querySelector('[data-mr="vr"]'), bSim = el.querySelector('[data-mr="sim"]')
    controles.preparar(renderer)
    const soporta = (m) => navigator.xr?.isSessionSupported(m).catch(() => false) ?? Promise.resolve(false)
    Promise.all([soporta('immersive-ar'), soporta('immersive-vr')]).then(([ar, vr]) => {
        bAR.hidden = !ar; bVR.hidden = !vr || ar
        estado.textContent = ar ? 'Tus gafas pueden mostrar el juego sobre tu cuarto real (realidad aumentada).' : vr ? 'Este dispositivo tiene realidad virtual (sin ver tu cuarto real).'
            : !window.isSecureContext ? 'Para usar las gafas, la página tiene que abrirse con https.' : 'Este navegador no tiene realidad aumentada: puedes ver la vista previa.'
        el.classList.add('mr-inicio--listo')
    })
    return new Promise((listo) => {
        const salir = (modo) => { el.hidden = true; listo(modo) }
        const xr = (tipo) => {
            audio.init() // (el sonido también necesita el clic)
            estado.textContent = 'Abriendo las gafas…'
            entrarXR(tipo).then(() => salir(tipo)).catch((e) => { console.error(e); estado.textContent = 'No se pudo abrir la sesión: ' + (e.message || e) })
        }
        bAR.addEventListener('click', () => xr('ar')); bVR.addEventListener('click', () => xr('vr'))
        bSim.addEventListener('click', () => { audio.init(); entrarSim(); salir('sim') })
    })
}
