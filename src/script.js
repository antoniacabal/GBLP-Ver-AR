/* Indice

    0. Imports
    1. Menu desplegable (y desplazamiento suave a las secciones)
    2. Ventana de advertencia (index.html)
    3. Muestra 3D del juego (index.html)
        3.1 Canvas
        3.2 Escena
        3.3 Luces
        3.4 Objetos: cuarto de prueba (Cuarto-prueba.fbx) y protagonista (Personaje.fbx, con su esqueleto y su pose)
        3.5 Tamaños
        3.6 Camara
        3.7 Controles
        3.8 Render
        3.9 Animacion
    4. Color del scroll
    5. Juego
    6. Mapa de apoyo (quitado en la versión MR)
    7. Techo que se derrumba
    7.1 Flecha hacia abajo (index.html)
    8. Inicio

*/

// 0. Imports -----------------
import './style.css'


// 1. Menu desplegable -----------------
function iniciarMenu() {
    var boton = document.querySelector('.menu-boton');
    var panel = document.getElementById('menu-panel');
    if (!boton || !panel) return;

    function abrir(valor) {
        panel.hidden = !valor;
        boton.setAttribute('aria-expanded', String(valor));
        boton.classList.toggle('menu-boton--abierto', valor);
    }

    boton.addEventListener('click', function () {
        abrir(panel.hidden);
    });

    // Cerrar al hacer clic fuera del menú
    document.addEventListener('click', function (e) {
        if (!panel.hidden && !e.target.closest('.menu')) abrir(false);
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) {
            abrir(false);
            boton.focus();
        }
    });

    // Cerrar al elegir un enlace
    panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) abrir(false);
    });
}

function iniciarDesplazamientoSuave() {
    var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('click', function (e) {
        var enlace = e.target.closest('a[href*="#"]');
        if (!enlace || enlace.target === '_blank') return;
        var url = new URL(enlace.href, location.href);
        if (url.pathname !== location.pathname || !url.hash) return; // solo enlaces a esta misma página
        var destino = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (!destino) return;
        e.preventDefault();
        destino.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth' });
        history.pushState(null, '', url.hash);
    });
}

// 2. Ventana de advertencia -----------------
    // (index.html)
function iniciarAdvertencia() {
    const dialogo = document.getElementById('advertencia')
    const botonIniciar = document.getElementById('boton-iniciar')

    if (dialogo && botonIniciar) {
        const botonVolver = dialogo.querySelector('[data-volver]')
        const animacionesAviso = ['advertencia-sacudida', 'advertencia-destello']

        // Sacude la caja para recordar que hay que elegir una opción
        const sacudir = () => {
            dialogo.classList.remove('sacudir')
            void dialogo.offsetWidth
            dialogo.classList.add('sacudir')
        }

        dialogo.addEventListener('animationend', (evento) => {
            if (animacionesAviso.includes(evento.animationName)) {
                dialogo.classList.remove('sacudir')
            }
        })

        botonIniciar.addEventListener('click', () => {
            dialogo.classList.remove('sacudir')
            dialogo.showModal()
            document.documentElement.classList.add('modal-abierto')
        })

        // Volver
        botonVolver.addEventListener('click', () => dialogo.close())

        // No cierra y se sacude
        dialogo.addEventListener('pointerdown', (evento) => {
            if (evento.target === dialogo) sacudir()
        })

        // Tecla Esc: tampoco cierra
        dialogo.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape') {
                evento.preventDefault()
                sacudir()
            }
        })

        dialogo.addEventListener('cancel', (evento) => {
            evento.preventDefault()
            sacudir()
        })

        // Se dispara al cerrar
        dialogo.addEventListener('close', () => {
            document.documentElement.classList.remove('modal-abierto')
        })
    }
}

// 3. Muestra 3D del juego -----------------
    //  (index.html)
async function iniciarMuestra() {
    const canvas = document.querySelector('.escena-canvas canvas.webgl')
    if (!canvas) return

    const THREE = await import('three')

    // 3.1 Canvas -----------------
    const contenedor = canvas.parentElement

    // Calidad según el equipo: en celulares y equipos con poca memoria o pocos núcleos la muestra va más liviana (resolución 1, sin
    // antialias, 30 cuadros por segundo y sin los contornos del glitch). Si aun así se pone lenta, baja la resolución sola (ver 3.9)
    const nav = navigator
    // (antes cualquier equipo con 4 núcleos o 4 GB contaba como liviano e iba a 24 cuadros: se veía lenta. Ahora solo celulares y equipos muy justos;
    // en computador va a 60 y en liviano a 30)
    const liviano = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) || window.matchMedia('(pointer: coarse)').matches
    let resolucion = liviano ? 1 : 1.5, fps = liviano ? 30 : 60
    const pixeles = () => Math.min(window.devicePixelRatio || 1, resolucion)
    // si no hay WebGL (o se pierde), queda la imagen de respaldo (index.html: .muestra-respaldo)
    const sin3d = (v) => contenedor.classList.toggle('muestra-sin-3d', v)

    // 3.2 Escena -----------------
    const scene = new THREE.Scene()

    // 3.3 Luces -----------------
    // la misma luz del juego en la mañana (scene.js + environment.js con la paleta normal): cálida, ambiente 0.7 y sol 1.3.
    // Antes era fría y más débil (ambiente azulado 0.9, sol blanco 0.9) y la muestra se veía más oscura y dura que el juego
    const CALIDA = 0xffd9a0, FRIA = 0x8899bb
    const luzAmbiente = new THREE.AmbientLight(CALIDA, 0.7)
    scene.add(luzAmbiente)

    const luzSol = new THREE.DirectionalLight(CALIDA, 1.3) // (se mueve con la cámara: ver 3.7)
    luzSol.position.set(5, 10, 4)
    scene.add(luzSol)

    // Luz roja: solo se enciende en el glitch de ansiedad (3.9)
    const luzTension = new THREE.PointLight(0xff3a2a, 0, 12)
    luzTension.position.set(0, 3, 0)
    scene.add(luzTension)

    // 3.4 Objetos: cuarto de prueba y protagonista -----------------
    let cargados = 0 // cuando los dos archivos están (el cuarto y Gabriela), la muestra reemplaza a la imagen de respaldo
        // El cuarto de Gabriela sin paredes (Cuarto-prueba.fbx) como piso de la muestra, con ella de pie en medio, ansiosa.
        // Misma escala y colores del juego (environment.js), para que la muestra se vea como el juego
        const { CargadorModelos } = await import('./game/modelos.js') // (los FBX se publican como GLB con Draco)
        const { toCreasedNormals } = await import('three/addons/utils/BufferGeometryUtils.js')
        const SH = 0.0065 // escala del cuarto en el juego
        const COLORES = { Pared: '#A6869B', suelo: '#BF895A', Suelo: '#BF895A', Cafe: '#A16A49', 'Cafe claro': '#BF895A', Naranja: '#BF4E24', Colchon: '#A6869B', Cortina: '#F2C063', Amarillo: '#F2C063', Material: '#799180', Salida: '#71708A', Pantalla: '#D8C8AE' }
        // pareja de ansiedad de cada color (la misma de environment.js): en el glitch el cuarto cambia a estos colores
        const TENSOS = { '#A6869B': '#482642', '#BF895A': '#580213', '#A16A49': '#201826', '#BF4E24': '#580213', '#F2C063': '#580213', '#799180': '#482642', '#71708A': '#201826', '#D8C8AE': '#71708A' }
        const pintura = {}, tonos = []
        const pintar = (m) => {
            if (pintura[m.name]) return pintura[m.name]
            const calma = COLORES[m.name] || '#A16A49', mat = new THREE.MeshStandardMaterial({ color: calma })
            tonos.push({ mat, calma: new THREE.Color(calma), tenso: new THREE.Color(TENSOS[calma] || '#201826') })
            return pintura[m.name] = mat
        }
        const paleta = (k) => tonos.forEach(({ mat, calma, tenso }) => mat.color.copy(calma).lerp(tenso, k)) // 0: calma · 1: ansiedad
        const cuarto = new THREE.Group()
        scene.add(cuarto)
        const contornoMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), contornos = []
        // si el glitch está pasando (lo cambia la animación, 3.9). Los contornos se arman de a poco y pueden llegar antes de que exista tick:
        // preguntarle a tick ahí lanzaba un error que cortaba el armado y quedaban muebles sin contorno
        let enGlitch = false
        const siluetaMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.85 }) // (ver silueta, más abajo)
        // piso más grueso: una losa debajo del piso del modelo, del mismo color (también cambia en el glitch)
        // del mismo tamaño que la base del modelo (en el archivo va de x -371.4 a 369.4 y de z -329.5 a 328.9) y justo debajo de ella: al ras
        const losa = new THREE.Mesh(new THREE.BoxGeometry(740.8 * SH, 0.34, 658.4 * SH), pintar({ name: 'suelo' }))
        losa.position.set((-1 + 19) * SH, -22 * SH - 0.17, (-0.3 + 5) * SH); cuarto.add(losa)
        // contorno de la losa: las aristas de los lados y de abajo, no las de arriba (esas coinciden con la base y se veía una raya).
        // Corridas 1.5 cm hacia afuera: justo sobre las caras de la losa, en celulares (con menos precisión de profundidad) se peleaban con
        // ellas y la línea se veía punteada
        const afuera = (v, d = 0.015) => v + Math.sign(v) * d
        const losaContorno = (() => {
            const p = new THREE.EdgesGeometry(losa.geometry).attributes.position, quedan = []
            for (let i = 0; i < p.count; i += 2) if (!(p.getY(i) > 0.1 && p.getY(i + 1) > 0.1)) quedan.push(afuera(p.getX(i)), afuera(p.getY(i)), afuera(p.getZ(i)), afuera(p.getX(i + 1)), afuera(p.getY(i + 1)), afuera(p.getZ(i + 1)))
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(quedan, 3)); return new THREE.LineSegments(g, contornoMat)
        })()
        losaContorno.visible = false; losa.add(losaContorno); contornos.push(losaContorno)
        // el celular sobre el escritorio (Cel.fbx), en el mismo lugar, tamaño y colores que en el juego (environment.js: R0.x - 290 · SH, sobre
        // la tabla, a -0.25; aquí el cuarto está corrido 19 · SH y 5 · SH). Sus materiales se pintan con los de la paleta (por nombre)
        const DEL_CELULAR = { Material: 'Naranja', 'Material.001': 'Pantalla', 'Material.002': 'Cafe claro' }
        new CargadorModelos().load('assets/casa/celular/Cel.fbx', (o) => {
            o.traverse(c => {
                if (!c.isMesh) return
                c.material = [c.material].flat().map(m => pintar({ name: DEL_CELULAR[m.name] || 'Naranja' })); if (c.material.length === 1) c.material = c.material[0]
                const l = new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry, 35), contornoMat); l.scale.setScalar(1.04); l.visible = enGlitch; c.add(l); contornos.push(l)
            })
            o.scale.setScalar(0.00036); o.position.set((-290 + 19) * SH, 0.995 + 39 * 0.00036, -0.25 + 5 * SH); cuarto.add(o)
            // prendido (como en el juego): la pantalla tiene luz propia y una luz pequeña encima ilumina un poco el escritorio
            pintura.Pantalla?.emissive.set('#E4FFFF')
            luzCelular = new THREE.PointLight('#E4FFFF', 0.6, 1.5, 2); luzCelular.position.copy(o.position).y += 0.25; cuarto.add(luzCelular)
            prenderCelular(!enGlitch)
        })
        // en el glitch el celular se apaga (la pantalla deja de brillar y su luz se va); al volver a la calma se prende otra vez
        let luzCelular = null
        const prenderCelular = (si) => { if (pintura.Pantalla) pintura.Pantalla.emissiveIntensity = si ? 0.35 : 0; if (luzCelular) luzCelular.intensity = si ? 0.6 : 0 }
        new CargadorModelos().load('assets/casa/cuarto/Cuarto-prueba.fbx', (o) => {
            cargados++
            const sobra = []; o.traverse(c => { if (c.isLight || c.isCamera) sobra.push(c) }); sobra.forEach(c => c.removeFromParent()) // luces y cámaras de Blender
            // bordes nítidos solo en las piezas en forma de caja (armario, libros, colchón, estructura de la cama, base): el archivo trae las
            // normales promediadas y el sombreado suave les "redondeaba" las esquinas, con manchas en los costados. Lo redondeado de verdad
            // (escritorio, cojines, silla, juguetes) sigue suave
            const CAJAS = /^(Armario|Books2?|Colchon|Patas_cama|Pared)$/
            o.traverse(c => { if (c.isMesh && CAJAS.test(c.name)) c.geometry = toCreasedNormals(c.geometry, Math.PI / 5) }) // (también las de varios materiales: conserva sus grupos)
            o.traverse(c => { if (c.isMesh) c.material = Array.isArray(c.material) ? c.material.map(pintar) : pintar(c.material) })
            o.scale.setScalar(SH)
            o.position.set(19 * SH, -24 * SH, 5 * SH) // centrado (el archivo va de x -407 a 369 y de z -340 a 329) y con el piso (y = 24) en 0
            cuarto.add(o)
            // contorno blanco de cada mueble: solo se ve en el glitch (los colores de ansiedad son muy oscuros y el cuarto se perdía en el fondo)
            o.updateMatrixWorld(true)
            // (sin los bordes de abajo de la base: ahí se junta con la losa y quedaba una raya blanca en medio del piso)
            const aArchivo = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), inversa = o.matrixWorld.clone().invert()
            // el escritorio (Tabla) tiene los bordes biselados (varias caras pequeñas en cada borde): marcando bordes salía sin contorno (35°)
            // o con muchas líneas juntas (10°). Para él se dibuja solo la silueta: una copia un poco inflada, blanca y por detrás
            const silueta = (c) => {
                // 2.2 unidades del archivo hacia afuera (la pieza puede traer su propia escala: se convierte a sus unidades)
                const escala = new THREE.Vector3().setFromMatrixScale(aArchivo.multiplyMatrices(inversa, c.matrixWorld)), k = 2.2 / ((Math.abs(escala.x) + Math.abs(escala.y) + Math.abs(escala.z)) / 3)
                const g = c.geometry.clone(), p = g.attributes.position, n = g.attributes.normal
                for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k)
                const m = new THREE.Mesh(g, siluetaMat); m.visible = enGlitch; c.add(m); contornos.push(m)
            }
            const contornoDe = (c) => {
                if (c.name === 'Tabla') return silueta(c)
                const bordes = new THREE.EdgesGeometry(c.geometry, c.name === 'pc' ? 20 : 35), p = bordes.attributes.position, quedan = []
                aArchivo.multiplyMatrices(inversa, c.matrixWorld)
                for (let i = 0; i < p.count; i += 2) {
                    v1.fromBufferAttribute(p, i).applyMatrix4(aArchivo); v2.fromBufferAttribute(p, i + 1).applyMatrix4(aArchivo)
                    if (v1.y < 4 && v2.y < 4) continue // borde de abajo de la base (y = 2 en el archivo)
                    quedan.push(p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1))
                }
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(quedan, 3))
                const l = new THREE.LineSegments(g, contornoMat); l.visible = enGlitch; c.add(l); contornos.push(l)
            }
            // de a poco, en los ratos libres del navegador (el glitch tarda unos segundos en llegar; si llega antes, se ven los que ya estén)
            const pendientes = []; if (!liviano) o.traverse(c => { if (c.isMesh) pendientes.push(c) }) // (en equipos livianos el glitch va sin contornos)
            const ocioso = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 60))
            const seguir = (plazo) => { while (pendientes.length && plazo.timeRemaining() > 3) contornoDe(pendientes.shift()); if (pendientes.length) ocioso(seguir) }
            ocioso(seguir)
        })

        // Gabriela (assets/protagonista/Personaje.fbx). MUESTRA: es una copia del armado del juego (game/personaje.js), para que la
        // muestra no dependa de los archivos del juego. El archivo no trae huesos (está en pose de T): se le arma un esqueleto
        // y cada vértice se pega al hueso de su zona. Si cambia el modelo, actualizar las dos copias
        const comoEnBlender = (c) => { const crudo = {}; c.getRGB(crudo, THREE.SRGBColorSpace); return new THREE.Color().setRGB(crudo.r, crudo.g, crudo.b, THREE.LinearSRGBColorSpace) }
        const materialDe = (m) => new THREE.MeshStandardMaterial({ color: comoEnBlender(m.color), roughness: 0.8, side: THREE.DoubleSide })

        // Esqueleto (en unidades del archivo: pies en y = 0, frente hacia +z, brazos estirados en x). x > 0 = lado "I", x < 0 = lado "D"
        const MODELO = 140 // alto del archivo
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
        const paso = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) } // 0 → 1 suave entre a y b
        // los codos de ayuda giran la mitad que el antebrazo (se llama después de cada pose)
        const codos = (meta) => { meta.codoI.copy(meta.antebrazoI).multiplyScalar(0.5); meta.codoD.copy(meta.antebrazoD).multiplyScalar(0.5) }
        // A qué huesos pertenece un vértice (con mezcla en las articulaciones, para que no se rompa la malla al doblarse).
        // Escribe directo en idx / w (hasta 4 huesos por vértice), sin crear arreglos: la falda tiene ~100 000 vértices
        const B = Object.fromEntries(Object.keys(JOINTS).map((n, i) => [n, i]))
        function pesos(malla, x, y, z, idx, w, o) {
            const I = x >= 0, ax = Math.abs(x)
            const pon = (k, b, v) => { idx[o + k] = b; w[o + k] = v }
            if (/^\d+$/.test(malla)) return pon(0, B.cabeza, 1)                                  // pelo
            if (malla === 'Falda') return pon(0, B.cadera, 1)
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
        // Cara (la misma de game/personaje.js): los ojos dibujados de la hoja de expresiones, pegados a la forma de la cabeza (el pelo queda encima).
        // En su bailecito, con los ojos cerrados de contenta (el parpadeo normal, fijo); en el glitch de ansiedad, la de después del sismo nivel 3 (espiral)
        const HOJA = { w: 840, h: 842, x0: 2, y0: 32, dx: 313.5, dy: 214.5, cw: 210, ch: 140 }
        const EXPRESIONES = { parpadeo: [0, 1], nivel3: [2, 2] }
        const hojaCaras = new THREE.TextureLoader().load(encodeURI('assets/protagonista/Caras-transparente_Mesa de trabajo 1.png'))
        hojaCaras.colorSpace = THREE.SRGBColorSpace; hojaCaras.anisotropy = 4; hojaCaras.repeat.set(HOJA.cw / HOJA.w, HOJA.ch / HOJA.h)
        const mostrarCara = (nombre) => { const [fi, co] = EXPRESIONES[nombre]; hojaCaras.offset.set((HOJA.x0 + co * HOJA.dx) / HOJA.w, 1 - (HOJA.y0 + fi * HOJA.dy + HOJA.ch) / HOJA.h) }
        mostrarCara('parpadeo')
        const matCara = new THREE.MeshStandardMaterial({ map: hojaCaras, emissiveMap: hojaCaras, emissive: 0x555555, transparent: true, alphaTest: 0.08, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
        function armarCara(mallas, cabeza) {
            const tri = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
            mallas.filter(m => m.name === 'Chibi').forEach(m => { // solo la piel: el pelo queda encima de la cara
                const g0 = m.geometry.clone().applyMatrix4(m.matrixWorld), g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position
                for (let i = 0; i < p.count; i += 3) {
                    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2)
                    if (Math.min(a.y, b.y, c.y) > 80 && Math.max(a.y, b.y, c.y) < 122 && Math.min(a.z, b.z, c.z) > 0) tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
                }
            })
            const sup = new THREE.BufferGeometry(); sup.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
            const blanco = new THREE.Mesh(sup, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
            const g = new THREE.PlaneGeometry(36, 36 * HOJA.ch / HOJA.cw, 24, 16), p = g.attributes.position
            const rayo = new THREE.Raycaster(), desde = new THREE.Vector3(), haciaAtras = new THREE.Vector3(0, 0, -1)
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), y = p.getY(i) + 106
                rayo.set(desde.set(x, y, 60), haciaAtras)
                p.setXYZ(i, x, y - JOINTS.cabeza[2], (rayo.intersectObject(blanco)[0]?.point.z ?? 15) + 0.35)
            }
            g.computeVertexNormals()
            const m = new THREE.Mesh(g, matCara); m.renderOrder = 2; cabeza.add(m)
        }
        let caraAhora = 'parpadeo'
        const cara = (asustada) => { const quiere = asustada ? 'nivel3' : 'parpadeo'; if (quiere !== caraAhora) { caraAhora = quiere; mostrarCara(quiere) } }
        function armar(fbx, escala) {
            const cont = new THREE.Group(), bones = {}, suela = []
            NAMES.forEach(n => { const [p, x, y, z] = JOINTS[n], b = new THREE.Bone(); b.name = n; const q = p ? JOINTS[p] : [0, 0, 0, 0]; b.position.set(x - q[1], y - q[2], z - q[3]); bones[n] = b; if (p) bones[p].add(b) })
            cont.add(bones.raiz); cont.updateMatrixWorld(true)
            const skeleton = new THREE.Skeleton(NAMES.map(n => bones[n]))
            fbx.updateMatrixWorld(true)
            const mallas = []; fbx.traverse(c => { if (c.isMesh) mallas.push(c) })
            mallas.forEach(c => {
                const g = c.geometry.clone().applyMatrix4(c.matrixWorld), pos = g.attributes.position, n = pos.count
                // Piezas reflejadas en Blender (escala negativa, como un mechón del pelo): al pasarlas al modelo quedan con las caras al revés y
                // se iluminaban por dentro (se veían más oscuras). Se invierte el orden de sus triángulos
                if (c.matrixWorld.determinant() < 0) {
                    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t } g.index.needsUpdate = true }
                    else Object.values(g.attributes).forEach(at => { const k = at.itemSize, a = at.array; for (let i = 0; i < at.count; i += 3) for (let j = 0; j < k; j++) { const t = a[(i + 1) * k + j]; a[(i + 1) * k + j] = a[(i + 2) * k + j]; a[(i + 2) * k + j] = t } at.needsUpdate = true })
                }
                const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4)
                for (let i = 0; i < n; i++) pesos(c.name, pos.getX(i), pos.getY(i), pos.getZ(i), idx, w, i * 4)
                g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4))
                const sm = new THREE.SkinnedMesh(g, Array.isArray(c.material) ? c.material.map(materialDe) : materialDe(c.material))
                sm.frustumCulled = false; sm.bind(skeleton, new THREE.Matrix4()); cont.add(sm)
                // suela: unos cuantos vértices de la base de los zapatos (repartidos), para saber dónde queda el pie en cada pose (ver piso)
                if (c.name === 'Zapatos') { const v = []; for (let i = 0; i < n; i++) if (pos.getY(i) < 1.5) v.push(i); const paso = Math.max(1, Math.floor(v.length / 80)); suela.push(...v.filter((_, k) => k % paso === 0).map(i => [sm, i])) }
            })
            // enagua: un disco oscuro dentro de la falda, un poco arriba del borde, pegado a la cadera. Sin él, por debajo de la falda
            // se veía su interior claro (y a través de ella)
            const enagua = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 15.5, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x15111c, roughness: 1 }))
            enagua.scale.set(1.05, 1, 0.82); enagua.position.set(0, 37.5 - 42, -4.3); bones.cadera.add(enagua)
            armarCara(mallas, bones.cabeza)
            cont.scale.setScalar(escala)
            return { cont, bones, suela }
        }

        const personaje = new THREE.Group()
        personaje.position.set(0.15, 0.015, 1.0) // al frente del cuarto: el armario no la tapa cuando la muestra gira · 0.015: los zapatos sobre el piso
        personaje.rotation.y = 0.6 // mira un poco hacia la cámara
        cuarto.add(personaje)
        let prota = null
        const ALTO_MUESTRA = 2.15 // un poco más alta que en el juego (1.8): en la muestra se veía muy pequeña al lado de los muebles
        new CargadorModelos().load('assets/protagonista/Personaje.fbx', (o) => {
            cargados++
            try { prota = armar(o, ALTO_MUESTRA / MODELO); personaje.add(prota.cont) }
            catch (error) { // si armar el esqueleto falla, igual se ve (quieta, con sus colores)
                console.error('Muestra: no se pudo animar a la protagonista', error)
                o.traverse(c => { if (c.isMesh) c.material = Array.isArray(c.material) ? c.material.map(materialDe) : materialDe(c.material) })
                o.scale.setScalar(ALTO_MUESTRA / MODELO); personaje.add(o)
            }
        }, undefined, (error) => console.error('Muestra: no se pudo cargar Personaje.fbx', error))

        // dedos: k = 0 abiertos, 0.35 relajados, 1.5 puño cerrado (los dedos se doblan hacia la palma y el pulgar se cierra encima)
        function mano(meta, k) {
            meta.dedosI.z = -k; meta.dedosD.z = k
            meta.dedos2I.z = -0.9 * k; meta.dedos2D.z = 0.9 * k                                   // la segunda parte del dedo se dobla casi igual
            meta.pulgarI.y = 0.4 * k; meta.pulgarD.y = -0.4 * k
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
        const alturaFeliz = (t) => { const f = 0.12 + 0.12 * (1 - Math.cos(t * 4.4)) / 2, v = PIERNA * (Math.cos(f) + Math.cos(f) - 2); return v * 1.8 / MODELO }

        // Sobresalto (player.sobresalto y el visor): dura SALTO s; atras = qué fracción del salto hacia atrás lleva, y = altura (unidades del juego)
        const SALTO = 0.8
        const saltoSusto = (p) => { const a = Math.min(1, Math.max(0, (p - 0.12) / 0.48)); return { atras: paso(0.12, 0.6, p), y: 0.32 * Math.sin(Math.PI * a) - 0.07 * (paso(0, 0.1, p) * (1 - paso(0.1, 0.2, p)) + paso(0.6, 0.66, p) * (1 - paso(0.78, 1, p))) } }

        // Poses de la muestra (cada hueso va suave hacia su giro):
        //   feliz: el idle contento de arriba (posarFeliz, la misma pose del visor del debug)
        //   miedo: durante el glitch se tapa las mejillas con las dos manos, encogida, temblando
        const giro = Object.fromEntries(NAMES.map(n => [n, new THREE.Vector3()])), meta = Object.fromEntries(NAMES.map(n => [n, new THREE.Vector3()]))
        const BRAZO_ABAJO = 1.25
        const posar = (t, modo, dt, rapido = 10) => {
            NAMES.forEach(n => meta[n].set(0, 0, 0))
            meta.brazoI.z = -BRAZO_ABAJO; meta.brazoD.z = BRAZO_ABAJO
            mano(meta, 0.35) // manos relajadas
            let y = 0
            if (modo === 'feliz') {
                y = posarFeliz(meta, t) // idle contento: respira rebotando, pasa el peso de un pie al otro, codos afuera y cada tanto se mece o sube los hombros
            } else if (modo === 'miedo') {
                // la misma pose de miedo del juego (personaje.js): se tapa las mejillas con las dos manos, encogida, temblando y moviendo la cabeza
                const tr = (v) => Math.sin(t * v) * 0.04                       // temblor
                const mece = Math.sin(t * 1.1), niega = Math.sin(t * 1.7)
                meta.cadera.y = 0.12 * mece; meta.cadera.x = 0.05
                meta.espalda.x = 0.25 + tr(31); meta.espalda.y = 0.1 * mece
                meta.cabeza.x = 0.15 + tr(27); meta.cabeza.y = 0.22 * niega + tr(23); meta.cabeza.z = 0.06 * niega
                meta.brazoI.set(-1.0 + tr(29), -0.28, -BRAZO_ABAJO + 0.02); meta.brazoD.set(-1.0 + tr(29), 0.28, BRAZO_ABAJO - 0.02) // codos abajo, al frente
                meta.antebrazoI.set(-0.04, -2.01, 0.03); meta.antebrazoD.set(-0.04, 2.01, -0.03)           // manos a la cara
                meta.manoI.set(-0.95, -0.2, 0.62); meta.manoD.set(-0.95, 0.2, -0.62)                       // las palmas (no el dorso) contra las mejillas
                meta.musloI.x = meta.musloD.x = -0.32; meta.piernaI.x = meta.piernaD.x = 0.6; meta.pieI.x = meta.pieD.x = -0.28
                meta.musloI.y = 0.2; meta.musloD.y = -0.2                                                  // rodillas hacia adentro
                mano(meta, 0.55)                                                                           // los dedos sueltos sobre la cara
                y = -0.03                                                                                  // al encogerse baja lo que se acortan las piernas
            }
            codos(meta) // los codos de ayuda giran la mitad que el antebrazo
            cara(modo === 'miedo')
            const f = Math.min(1, dt * rapido)
            NAMES.forEach(n => { giro[n].lerp(meta[n], f); prota?.bones[n].rotation.set(giro[n].x, giro[n].y, giro[n].z) })
            // los pies sobre el piso: el cuerpo se apoya en la suela más baja de la pose de este cuadro (como prota.piso() en el juego).
            // Antes la altura salía de una fórmula y los zapatos se metían un poco en el piso
            if (prota?.suela?.length) {
                personaje.updateMatrixWorld(true); inversa.copy(personaje.matrixWorld).invert()
                let min = Infinity; for (const [sm, i] of prota.suela) { sm.getVertexPosition(i, punto); punto.applyMatrix4(sm.matrixWorld).applyMatrix4(inversa); if (punto.y < min) min = punto.y }
                personaje.position.y = 0.004 - min
            } else personaje.position.y += (0.015 + y - personaje.position.y) * f
        }
        const punto = new THREE.Vector3(), inversa = new THREE.Matrix4()

    // 3.5 Tamaños -----------------
    const sizes = {
        width: contenedor.clientWidth,
        height: contenedor.clientHeight
    }

    // 3.6 Cámara -----------------
        const radioCuarto = 3.3 // el cuarto mide unos 5 × 5: así se ve más grande
        // margen alrededor del cuarto: en el canvas angosto del celular (casi cuadrado) el cuarto, al mecerse, se salía por los lados y se
        // cortaba: ahí lleva más margen
        const margen = (relacion) => relacion < 1.4 ? 1.22 : 1.05
        const anchoMinimo = (relacion) => radioCuarto * 2 * margen(relacion)   // ancho visible necesario (~9.1 en computador)
        const altoMinimo = 5.6                         // alto visible necesario

        const calcularVista = (relacion) => Math.max(altoMinimo, anchoMinimo(relacion) / relacion)

        let aspecto = sizes.width / sizes.height
        let vista = calcularVista(aspecto)
        const camera = new THREE.OrthographicCamera(-vista * aspecto / 2, vista * aspecto / 2, vista / 2, -vista / 2, -50, 100)
        scene.add(camera)


    // 3.7 Giro -----------------
    // Sin controles: cámara isométrica fija (la misma del juego: 45° de lado y 35.26° de alto) que se mece despacio alrededor del cuarto,
    // así la muestra gira sola. Con "reducir movimiento" en el sistema igual gira (antes se quedaba quieta y parecía rota), pero más despacio
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ELEVACION = Math.atan(1 / Math.SQRT2), DISTANCIA = 14, CENTRO = new THREE.Vector3(0, 0.9, 0)
    const VUELTA = sinMovimiento ? 60 : 30 // segundos por ida y vuelta
    const girarCamara = (t) =>
    {
        // se mece de un lado a otro (±35°) alrededor de la vista del juego, sin dar la vuelta completa: por detrás se veían las espaldas de
        // los muebles (el armario, el escritorio), que en el juego nunca se ven y quedaban oscuras y raras
        const az = Math.PI / 4 + 0.6 * Math.sin(t * Math.PI * 2 / VUELTA)
        camera.position.set(CENTRO.x + DISTANCIA * Math.cos(ELEVACION) * Math.sin(az), CENTRO.y + DISTANCIA * Math.sin(ELEVACION), CENTRO.z + DISTANCIA * Math.cos(ELEVACION) * Math.cos(az))
        camera.lookAt(CENTRO)
        // el sol gira con la cámara, un poco a su derecha y desde arriba, como en el juego (scene.js: la luz viene casi desde donde mira la cámara).
        // Con el sol quieto, al girar se veían las caras de atrás del armario y de la cama muy oscuras y con manchas
        luzSol.position.set(CENTRO.x + 10 * Math.sin(az + 0.14), 14, CENTRO.z + 10 * Math.cos(az + 0.14)) // (la misma altura que en el juego)
    }
    girarCamara(0)

    // 3.8 Render -----------------
    // si el navegador pierde el WebGL (pasa en celulares con poca memoria), se ve la imagen de respaldo hasta que lo devuelva
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sin3d(true) }) // preventDefault: permite que el navegador lo devuelva
    canvas.addEventListener('webglcontextrestored', () => sin3d(false))
    let renderer
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !liviano, powerPreference: liviano ? 'low-power' : 'default' }) }
    catch { return sin3d(true) } // sin WebGL: se queda la imagen
    renderer.setPixelRatio(pixeles())
    renderer.setSize(sizes.width, sizes.height, false)
    // oclusión ambiental (game/oclusion.js, la misma del juego): los rincones y donde se juntan los muebles con el piso y la pared quedan un
    // poco más oscuros. Solo en equipos que no son livianos (en celulares cuesta demasiado)
    const oclusion = liviano ? null : (await import('./game/oclusion.js')).crearOclusion(renderer, scene, camera, { radio: 0.35, intensidad: 0.75 })

    const resizeObserver = new ResizeObserver(() =>
    {
        sizes.width = contenedor.clientWidth
        sizes.height = contenedor.clientHeight

        if (sizes.width === 0 || sizes.height === 0) return

        // Actualizar Camara
        aspecto = sizes.width / sizes.height
        vista = calcularVista(aspecto)
        camera.left = -vista * aspecto / 2
        camera.right = vista * aspecto / 2
        camera.top = vista / 2
        camera.bottom = -vista / 2
        camera.updateProjectionMatrix()

        // Actualizar renderizador (también la resolución: si cambia el zoom del navegador o la pantalla, no queda pixelado)
        renderer.setPixelRatio(pixeles())
        renderer.setSize(sizes.width, sizes.height, false); oclusion?.tamano(sizes.width, sizes.height)
    })
    resizeObserver.observe(contenedor)
    window.addEventListener('resize', () => renderer.setPixelRatio(pixeles())) // el zoom del navegador puede no cambiar el tamaño del contenedor

    // 3.9 Animación -----------------
    const clock = new THREE.Clock()

    // fuera de la pantalla no se dibuja: así no le quita fuerza al derrumbe que viene debajo (antes se trababa a veces)
    let aLaVista = true
    new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting; tick.dibujado = undefined }).observe(contenedor)
    const medida = { suma: 0, n: 0 }
    const tick = () =>
    {
        if (!aLaVista) { tick.antes = undefined; return void window.requestAnimationFrame(tick) }
        const tiempo = clock.getElapsedTime()
        if (tiempo - (tick.dibujado ?? -1) < 1 / (fps + 4)) return void window.requestAnimationFrame(tick) // (máximo 60 o 30 por segundo)
        // si los cuadros tardan mucho más de lo esperado (el equipo no da abasto), baja la resolución (los cuadros por segundo se quedan:
        // bajarlos era lo que la hacía ver a saltos)
        if (tick.dibujado !== undefined && tiempo - tick.dibujado < 1) { medida.suma += tiempo - tick.dibujado; medida.n++ }
        if (medida.n >= 45) {
            if (medida.suma / medida.n > 1.6 / fps && resolucion > 0.75) { resolucion = Math.max(0.75, resolucion - 0.25); renderer.setPixelRatio(pixeles()); renderer.setSize(sizes.width, sizes.height, false); oclusion?.tamano(sizes.width, sizes.height) }
            medida.suma = medida.n = 0
        }
        tick.dibujado = tiempo

        // Glitch de ansiedad: casi siempre el cuarto se ve normal y Gabriela está contenta, pero cada tanto, por un segundo, la imagen
        // "falla": se enciende la luz roja, el cuarto toma los colores de la ansiedad (los del juego) y ella se tapa la cara con miedo.
        // Entra y sale con parpadeos, como una señal que se corta. Con "reducir movimiento" en el sistema igual pasa (antes no había nada y la
        // muestra parecía rota), pero sin parpadeos ni sacudidas: solo cambian los colores y la pose
        const dt = Math.min(0.1, tiempo - (tick.antes ?? tiempo)); tick.antes = tiempo
        const ciclo = tiempo % 7, dentro = ciclo > 5.2 && ciclo < 6.3                      // un segundo de cada siete
        const borde = ciclo < 5.45 || ciclo > 6.05, parpadeo = borde && Math.sin(tiempo * 60) > 0 // al entrar y al salir parpadea
        const glitch = dentro && (sinMovimiento || !parpadeo)
        if (glitch !== tick.glitch) { tick.glitch = enGlitch = glitch; paleta(glitch ? 1 : 0); luzAmbiente.intensity = glitch ? 0.5 : 0.7; luzAmbiente.color.setHex(glitch ? FRIA : CALIDA); luzSol.color.setHex(glitch ? FRIA : CALIDA); contornos.forEach(l => { l.visible = glitch }); prenderCelular(!glitch) }
        luzTension.intensity = glitch ? 2.6 + Math.sin(tiempo * 40) * 0.8 : 0
        canvas.style.transform = glitch && !sinMovimiento ? `translate(${(Math.random() * 6 - 3).toFixed(1)}px, ${(Math.random() * 2 - 1).toFixed(1)}px)` : ''
        canvas.style.filter = glitch ? 'contrast(1.15) saturate(1.2)' : ''
        posar(tiempo, glitch || (dentro && tick.glitchVisto) ? "miedo" : "feliz", dt, glitch ? 12 : 8) // (más suave: con 22 las manos saltaban y se trababan)
        tick.glitchVisto = dentro

        girarCamara(tiempo)

        oclusion ? oclusion.render() : renderer.render(scene, camera)
        if (cargados >= 2 && !tick.lista) { tick.lista = true; contenedor.classList.add('muestra-lista') } // ya está todo: se cambia la imagen por la muestra

        window.requestAnimationFrame(tick)
    }
    tick()
}

// 4. Color del scroll -----------------
function iniciarScroll() {
    if (!document.querySelector('.escena, .footer')) return
    const oscuras = () => document.querySelectorAll('.escena, .derrumbe-espacio, .footer') // (el espacio del derrumbe lo crea la sección 7)

    let pendiente = false

    const revisar = () => {
        pendiente = false
        const alto = window.innerHeight
        let cubierto = 0

        oscuras().forEach((zona) => {
            const caja = zona.getBoundingClientRect()
            cubierto += Math.max(0, Math.min(caja.bottom, alto) - Math.max(caja.top, 0))
        })

        document.documentElement.classList.toggle('scroll-oscuro', cubierto > alto / 2)
    }

    const pedirRevision = () => {
        if (pendiente) return
        pendiente = true
        window.requestAnimationFrame(revisar)
    }

    window.addEventListener('scroll', pedirRevision, { passive: true })
    window.addEventListener('resize', pedirRevision)
    revisar()
}

// 5. Juego -----------------
    // (narrativa.html)
async function iniciarJuego() {
    if (!document.querySelector('canvas.webgl--narrativa')) return

    await import('./game/game.css')
    await import('./game/main.js')
}

// 6. Mapa de apoyo -----------------
    // (en la versión de realidad aumentada no hay mapa de apoyo: se quitó del index junto con src/mapa/)

// 7. Techo que se derrumba -----------------
    // (index.html) Debajo de la muestra del juego la página sigue oscura, como un techo de concreto morado.
    // Al bajar, el techo tiembla, se agrieta y se cae a pedazos (con gravedad, piedritas y polvo), como un derrumbe,
    // y debajo aparece el contenido. Arriba queda el borde roto del techo. Va con el scroll: al subir, los pedazos vuelven a su lugar.
    // Se dibuja en un canvas fijo encima de la página, así los pedazos que caen no agrandan la página ni crean scroll
function iniciarDerrumbe() {
    const escena = document.querySelector('.pagina-inicio .escena'), contenido = document.querySelector('.pagina-inicio .contenido')
    if (!escena || !contenido) return // (también con "reducir movimiento": va con el scroll, lo maneja la persona; antes no salía y la página parecía rota)
    const raiz = document.documentElement

    // Espacio oscuro extra entre la muestra y los recursos: ahí ocurre el derrumbe
    const espacio = document.createElement('div'); espacio.className = 'derrumbe-espacio'; espacio.setAttribute('aria-hidden', 'true')
    contenido.before(espacio)
    const lienzo = document.createElement('canvas'); lienzo.className = 'derrumbe'; lienzo.setAttribute('aria-hidden', 'true')
    document.body.append(lienzo)
    const ctx = lienzo.getContext('2d')
    raiz.classList.add('derrumbe-activo')

    const lim = (v) => Math.min(1, Math.max(0, v))
    const tramo = (p, a, b) => lim((p - a) / (b - a)) // 0 → 1 mientras p va de a a b
    const rnd = (a, b) => a + Math.random() * (b - a)
    const GRAVEDAD = 2400 // px/s²
    // el techo es del mismo color de la escena (--color-escena, leído del CSS: en celular es un poco más claro): no se nota dónde empieza
    let ARRIBA = [10, 5, 14], ABAJO = ARRIBA
    const leerColor = () => { const m = getComputedStyle(document.body).getPropertyValue('--color-escena').match(/\d+/g); if (m?.length >= 3) { ARRIBA = ABAJO = m.slice(0, 3).map(Number); LADO = `rgb(${ARRIBA.map(c => Math.round(c * 0.4)).join(',')})` } }
    const color = (y, luz = 0) => { const k = lim(y / alto); return `rgb(${ARRIBA.map((c, i) => Math.round(c + (ABAJO[i] - c) * k + luz)).join(',')})` }
    let LADO = '#040207' // grosor de los pedazos (más oscuro que el techo; ver leerColor)
    const CREMA = '227, 208, 181' // --color-acento: el crema del fondo de los recursos (las grietas)

    let W = 0, vh = 0, alto = 0, altoEspacio = 0, banda = 0, dpr = 1 // banda: alto de la parte de arriba que no se cae (sigue la escena)
    let piezas = [], bordes = [], polvo = [], origen = [0, 0], alcance = 1
    let inicial = true

    // Arma el techo: una malla de puntos movidos al azar; cada celda (o media celda) es un pedazo.
    // Las coordenadas son relativas al borde de arriba del espacio oscuro
    function armar() {
        leerColor(); vh = window.innerHeight; W = raiz.clientWidth; dpr = Math.min(window.devicePixelRatio || 1, 1.25) // formas planas: con 1.25 se ve igual que con 2 y son la mitad de píxeles
        lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(vh * dpr)
        lienzo.style.width = W + 'px'; lienzo.style.height = vh + 'px'
        espacio.style.height = ''; altoEspacio = espacio.offsetHeight // el alto lo decide el CSS (.derrumbe-espacio)
        alto = altoEspacio // el techo ocupa solo el espacio oscuro: los pedazos caen sobre los recursos, pero nunca los tapan quietos
        piezas = []; bordes = []; polvo = []; inicial = true; medido = -1e9; ultimaClave = '' // (vuelve a medir dónde está el techo)

        const x0 = -30, ancho = W + 60, y0 = -40 // más grande que la pantalla y 40 px montado sobre la escena: al temblar no se ven los bordes ni la unión
        const tam = Math.min(68, Math.max(38, W / 24)) // pedazos más pequeños (antes hasta 105 px): se ve más como escombro
        const cols = Math.ceil(ancho / tam), filas = Math.ceil((alto - y0) / tam)
        const cw = ancho / cols, ch = (alto - y0) / filas
        const P = []
        for (let i = 0; i <= filas; i++) {
            P.push([])
            for (let j = 0; j <= cols; j++) {
                const dentroX = j > 0 && j < cols, dentroY = i > 0 && i < filas
                P[i].push([x0 + j * cw + (dentroX ? rnd(-0.38, 0.38) * cw : 0), y0 + i * ch + (dentroY ? rnd(-0.38, 0.38) * ch : 0)])
            }
        }
        // Cuántas filas de arriba quedan pegadas en cada columna (el borde roto del techo)
        const base = Math.max(1, Math.round((altoEspacio * 0.82 - y0) / ch)) // (antes 0.65: quedaba mucho espacio claro antes de los recursos) la parte de arriba se queda: solo se rompe lo de abajo, cerca de los recursos
        banda = y0 + base * ch
        // detrás del techo que no se cae, el espacio también es del color de la escena: aunque el dibujo se corra un pixel, no asoma nada claro
        espacio.style.background = `linear-gradient(to bottom, var(--color-escena) ${Math.max(0, banda - ch * 0.5).toFixed(0)}px, transparent ${Math.max(0, banda - ch * 0.5).toFixed(0)}px)`
        const fijas = Array.from({ length: cols }, () => base + (Math.random() < 0.45 ? 1 : 0))

        const mapaBordes = new Map()
        const agregarBorde = (a, b, pieza) => {
            const clave = a < b ? a + '|' + b : b + '|' + a
            let borde = mapaBordes.get(clave)
            if (!borde) { borde = { a: llave[a], b: llave[b], piezas: [] }; mapaBordes.set(clave, borde); bordes.push(borde) }
            borde.piezas.push(pieza)
        }
        const llave = {}
        const id = (i, j) => { const k = i + ',' + j; llave[k] = P[i][j]; return k }
        const crear = (ids, fija) => {
            const pts = ids.map(k => llave[k])
            const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
            const pieza = {
                pts: pts.map(([x, y]) => [x - cx, y - cy]), cx, cy, fija, estado: 'puesta', alfa: 1,
                abajo: (cy - banda) / (alto - banda) > 0.55, // los de la orilla de abajo se caen apenas entran en pantalla (aunque el derrumbe no haya empezado): el borde de abajo nunca se ve entero
                limite: rnd(0.45, 0.75) + 0.7 * lim((cy - banda) / (alto - banda)) ** 2, // se cae cuando su centro sube hasta esta altura de la pantalla…
                tarde: rnd(0.6, 0.9),          // …o cuando el derrumbe ya va por aquí
                dx: 0, dy: 0, vx: 0, vy: 0, ang: 0, va: 0, luz: rnd(4, 10)
            }
            pieza.col = color(cy); pieza.colLuz = color(cy, pieza.luz) // (los colores se calculan una vez: antes se armaba el texto en cada cuadro)
            pieza.camino = camino(pieza.pts); pieza.radio = Math.max(...pieza.pts.map(([x, y]) => Math.hypot(x, y))) + 10 // (el camino también: antes se rearmaba en cada cuadro)
            piezas.push(pieza)
            ids.forEach((k, n) => agregarBorde(k, ids[(n + 1) % ids.length], pieza))
        }
        for (let i = 0; i < filas; i++) {
            for (let j = 0; j < cols; j++) {
                const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j + 1), d = id(i + 1, j)
                const fija = i < fijas[j]
                if (!fija && Math.random() < 0.5) { // algunas celdas se parten en dos triángulos
                    if (Math.random() < 0.5) { crear([a, b, c], false); crear([a, c, d], false) }
                    else { crear([a, b, d], false); crear([b, c, d], false) }
                } else crear([a, b, c, d], fija)
            }
        }
        // Las grietas salen de un punto del techo y se extienden hacia todos lados
        origen = [W * rnd(0.3, 0.7), banda + (alto - banda) * 0.25] // las grietas salen de la parte que se rompe
        const dist = (p) => Math.hypot(p[0] - origen[0], p[1] - origen[1])
        bordes.forEach(b => {
            b.d = dist([(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2]) + rnd(-25, 25)
            b.fuerte = Math.random() < 0.35 // unas grietas se marcan más que otras
            const largo = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) || 1, nx = -(b.b[1] - b.a[1]) / largo, ny = (b.b[0] - b.a[0]) / largo
            b.zig = [0.3, 0.55, 0.8].map(k => { const o = rnd(-3.5, 3.5); return [b.a[0] + (b.b[0] - b.a[0]) * k + nx * o, b.a[1] + (b.b[1] - b.a[1]) * k + ny * o] }) // la grieta no es recta
        })
        piezas.forEach(p => { p.d = dist([p.cx, p.cy]) })
        alcance = Math.max(...bordes.map(b => b.d)) + 30
    }

    // Piedritas y polvo que salen cuando un pedazo se cae
    function soltar(pieza, yTecho) {
        const radio = Math.max(...pieza.pts.map(([x, y]) => Math.hypot(x, y)))
        for (let n = 0; n < 5 + Math.random() * 6; n++) {
            const r = rnd(3, Math.min(11, radio * 0.25)), lados = 3 + Math.floor(Math.random() * 3)
            polvo.push({
                tipo: 'piedra', x: pieza.cx + rnd(-0.6, 0.6) * radio, y: yTecho + pieza.cy + rnd(-0.4, 0.6) * radio,
                vx: rnd(-90, 90), vy: rnd(-120, 40), ang: rnd(0, 6), va: rnd(-8, 8), vida: 4,
                pts: Array.from({ length: lados }, (_, k) => { const a = k / lados * Math.PI * 2 + rnd(-0.3, 0.3), rr = r * rnd(0.6, 1); return [Math.cos(a) * rr, Math.sin(a) * rr] }),
                color: color(pieza.cy, pieza.luz)
            })
        }
        for (let n = 0; n < 2; n++) {
            polvo.push({
                tipo: 'nube', x: pieza.cx + rnd(-0.5, 0.5) * radio, y: yTecho + pieza.cy + rnd(-0.3, 0.5) * radio,
                vx: rnd(-20, 20), vy: rnd(10, 50), r: rnd(16, 30), crece: rnd(25, 45), vida: rnd(0.9, 1.5), edad: 0
            })
        }
    }

    // p = 0 cuando la parte que se rompe llega al 62 % de la pantalla (la muestra del juego ya casi salió) · p = 1 cuando ya subió hasta arriba.
    // Así nada tiembla mientras se ve la muestra del juego: el temblor empieza ya en el pedazo de la animación
    const progreso = (yTecho) => lim((vh * 0.62 - (yTecho + banda - window.scrollY)) / (vh * 0.4 + alto - banda))

    let anterior = performance.now(), activo = false, pMax = 0, yTechoMedido = 0, medido = -1e9, ultimaClave = ''
    // lo que tiembla: el contenido de la escena (texto y muestra) y los recursos, cada uno por dentro. El fondo oscuro de la escena se queda quieto:
    // si se movía todo el main, por los bordes asomaba el fondo claro de la página
    const sacudibles = [...escena.children, contenido]
    function cuadro(ahora) {
        const dt = Math.min(0.05, (ahora - anterior) / 1000); anterior = ahora
        // posición del techo en la página: se mide cada medio segundo (medirla en cada cuadro obligaba al navegador a recalcular la página)
        if (!(ahora - medido < 500)) { yTechoMedido = espacio.getBoundingClientRect().top + window.scrollY; medido = ahora }
        const yTecho = yTechoMedido
        const sy = window.scrollY
        const p = pMax = Math.max(pMax, progreso(yTecho)) // el derrumbe pasa una sola vez: al subir no se rearma (vuelve al recargar o al regresar a la página)
        const grieta = tramo(p, 0.06, 0.42) * alcance // hasta dónde llegaron las grietas
        const temblor = tramo(p, 0.04, 0.14) * (1 - tramo(p, 0.4, 0.6))
        const t = ahora / 1000
        const tx = (Math.sin(t * 53) * 2.5 + Math.sin(t * 31) * 1.5) * temblor, ty = Math.cos(t * 47) * 1.5 * temblor

        // Todo tiembla junto: la escena y el contenido (main) y el techo (más abajo se dibuja con tx, ty)
        const sacudir = temblor > 0.01 ? `${tx.toFixed(1)}px ${ty.toFixed(1)}px` : ''
        sacudibles.forEach(el => {
            if (el.style.translate === sacudir) return
            el.style.translate = sacudir; el.style.willChange = sacudir ? 'translate' : '' // mientras tiembla va en su propia capa: moverlo no repinta la página entera
        })

        // ¿Qué pedazos se caen? (una vez que se cae, ya no vuelve)
        piezas.forEach(pz => {
            if (pz.fija) return
            const yPantalla = yTecho + pz.cy - sy
            const cae = (pz.abajo && yPantalla < vh * pz.limite) || (p > 0.12 && grieta > pz.d + 20 && (yPantalla < vh * pz.limite || p > pz.tarde))
            if (cae && pz.estado === 'puesta') {
                const fuera = inicial || yPantalla > vh + 150 || yPantalla < -150
                pz.estado = fuera ? 'fuera' : 'suelta' // suelta: tiembla un momento en su lugar antes de caer (así no cae todo junto)
                pz.retraso = rnd(0.05, 0.5); pz.alfa = 1 // (si estaba reapareciendo, vuelve a ser sólido)
                pz.dx = pz.dy = pz.ang = 0
                pz.vx = rnd(-50, 50) + (pz.cx - W / 2) * 0.06; pz.vy = rnd(40, 220); pz.va = rnd(-1.8, 1.8)
            }
        })
        inicial = false

        // Física
        piezas.forEach(pz => {
            if (pz.estado === 'puesta' && pz.alfa < 1) pz.alfa = Math.min(1, pz.alfa + dt * 4)
            if (pz.estado === 'suelta' && (pz.retraso -= dt) <= 0) { pz.estado = 'cayendo'; soltar(pz, yTecho) }
            if (pz.estado !== 'cayendo') return
            pz.vy += GRAVEDAD * dt; pz.dx += pz.vx * dt; pz.dy += pz.vy * dt; pz.ang += pz.va * dt
            if (yTecho + pz.cy + pz.dy - sy > vh + 200) pz.estado = 'fuera'
        })
        // Polvillo que se desprende de las grietas mientras tiembla
        if (temblor > 0.2 && Math.random() < temblor * 0.6) {
            const b = bordes[Math.floor(Math.random() * bordes.length)]
            if (b.d < grieta && b.piezas.some(pz => pz.estado === 'puesta')) {
                const k = Math.random()
                polvo.push({ tipo: 'piedra', x: b.a[0] + (b.b[0] - b.a[0]) * k, y: yTecho + b.a[1] + (b.b[1] - b.a[1]) * k, vx: rnd(-15, 15), vy: rnd(0, 40), ang: 0, va: rnd(-5, 5), vida: 3,
                    pts: [[-1.5, -1], [1.8, -0.6], [0.8, 1.6], [-1.2, 1.2]], color: '#5a4566' })
            }
        }
        polvo.forEach(q => {
            if (q.tipo === 'piedra') { q.vy += GRAVEDAD * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.ang += q.va * dt; q.vida -= dt; if (q.y - sy > vh + 50) q.vida = 0 }
            else { q.edad += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy *= 0.97; q.r += q.crece * dt }
        })
        polvo = polvo.filter(q => q.tipo === 'piedra' ? q.vida > 0 : q.edad < q.vida)

        // Dibujo (en coordenadas de la página, corridas por el scroll)
        const arriba = yTecho - sy
        const visible = arriba < vh && arriba + alto > 0
        let cayendo = false, sueltas = false, apareciendo = false
        for (const pz of piezas) { if (pz.estado === 'cayendo') cayendo = true; else if (pz.estado === 'suelta') sueltas = true; else if (pz.alfa < 1) apareciendo = true }
        // si nada se mueve (sin temblor, nada cayendo, sin polvo) y el scroll y el avance son los mismos que en el cuadro anterior, el
        // dibujo sería idéntico: no se redibuja y la animación descansa hasta el próximo scroll (antes redibujaba todo en cada cuadro)
        const quieto = temblor <= 0.01 && !cayendo && !sueltas && !apareciendo && polvo.length === 0
        const clave = sy + '|' + p.toFixed(4) + '|' + vh + '|' + W
        if (quieto && clave === ultimaClave) { activo = false; return }
        ultimaClave = clave
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, W, vh)
        // dibuja un camino ya armado (Path2D) en x, y (coordenadas de pantalla) con un giro: sin save / restore por pedazo
        const enPantalla = (x, y, ang = 0) => { const c = Math.cos(ang) * dpr, sn = Math.sin(ang) * dpr; ctx.setTransform(c, sn, -sn, c, x * dpr, y * dpr) }
        if (visible) {
            ctx.lineJoin = 'round'; ctx.lineWidth = 1
            // pedazos en su lugar (solo los que se ven: el resto queda fuera de la pantalla)
            for (const pz of piezas) {
                if (pz.estado !== 'puesta' && pz.estado !== 'suelta') continue
                const y = arriba + pz.cy
                if (y < -pz.radio || y > vh + pz.radio) continue
                const sacude = pz.estado === 'suelta' ? 1.5 : 0
                ctx.globalAlpha = pz.alfa
                enPantalla(pz.cx + tx + (sacude && rnd(-sacude, sacude)), y + ty + (sacude && rnd(-sacude, sacude)))
                ctx.fillStyle = pz.col; ctx.fill(pz.camino)
                ctx.strokeStyle = pz.col; ctx.stroke(pz.camino) // tapa las rayitas entre pedazos
            }
            ctx.globalAlpha = 1
            // grietas entre dos pedazos en su lugar · borde roto (con grosor) donde ya se cayó el vecino
            ctx.setTransform(dpr, 0, 0, dpr, 0, arriba * dpr)
            for (const b of bordes) {
                const ya = arriba + b.a[1]
                if (ya < -20 || ya > vh + 20) continue // fuera de la pantalla
                let n = 0, p0 = null, p1 = null // piezas de este borde que siguen en su lugar (sin crear listas nuevas en cada cuadro)
                for (const pz of b.piezas) if (pz.estado === 'puesta' || pz.estado === 'suelta') { if (n++) p1 = pz; else p0 = pz }
                if (!n) continue
                const ax = b.a[0] + tx, ay = b.a[1] + ty, bx = b.b[0] + tx, by = b.b[1] + ty
                if (n === 2) {
                    if (b.d > grieta || p0.fija || p1.fija) continue // la parte de arriba (que no se cae) no se agrieta: si no, entre la escena y el derrumbe quedaba una raya
                    const a = lim((grieta - b.d) / 60), k = b.fuerte ? 1 : 0.45
                    ctx.beginPath(); ctx.moveTo(ax, ay); for (const [x, y] of b.zig) ctx.lineTo(x + tx, y + ty); ctx.lineTo(bx, by)
                    ctx.strokeStyle = 'rgba(' + CREMA + ', ' + (0.95 * a * k).toFixed(3) + ')'; ctx.lineWidth = b.fuerte ? 2 : 1.1; ctx.stroke() // grietas color crema (el fondo de los recursos: como si se viera a través)
                } else if (b.piezas.length === 2) {
                    const otra = b.piezas[0] === p0 ? b.piezas[1] : b.piezas[0]
                    if (otra.cy > p0.cy) { // el hueco queda abajo: se ve el grosor del techo
                        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by + 8); ctx.lineTo(ax, ay + 8); ctx.closePath()
                        ctx.fillStyle = LADO; ctx.fill()
                    }
                }
            }
        }
        // pedazos cayendo (con grosor, girando)
        for (const pz of piezas) {
            if (pz.estado !== 'cayendo') continue
            enPantalla(pz.cx + pz.dx, yTecho + pz.cy + pz.dy - sy, pz.ang)
            ctx.translate(0, 7); ctx.fillStyle = LADO; ctx.fill(pz.camino); ctx.translate(0, -7)
            ctx.fillStyle = pz.colLuz; ctx.fill(pz.camino)
        }
        for (const q of polvo) {
            if (q.tipo === 'piedra') {
                enPantalla(q.x, q.y - sy, q.ang); ctx.fillStyle = q.color; ctx.fill(q.camino ||= camino(q.pts))
            } else { // nube: una imagen de polvo ya dibujada, estirada y cada vez más transparente (antes un degradado nuevo en cada cuadro)
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1 - q.edad / q.vida
                ctx.drawImage(NUBE, q.x - q.r, q.y - sy - q.r, q.r * 2, q.r * 2); ctx.globalAlpha = 1
            }
        }

        // Sigue animando mientras el techo se ve o algo cae; si no, descansa hasta el próximo scroll
        activo = visible || cayendo || polvo.length > 0 || apareciendo
        if (activo) requestAnimationFrame(cuadro)
    }
    // camino de un pedazo o una piedra (relativo a su centro), armado una sola vez
    function camino(pts) { const c = new Path2D(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); return c }
    // polvo: un círculo con degradado dibujado una vez (64 px) que se reutiliza para todas las nubes
    const NUBE = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 64
        const g = c.getContext('2d'), d = g.createRadialGradient(32, 32, 0, 32, 32, 32)
        d.addColorStop(0, 'rgba(80, 64, 92, 0.16)'); d.addColorStop(1, 'rgba(80, 64, 92, 0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64)
        return c
    })()
    const despertar = () => { if (activo) return; activo = true; anterior = performance.now(); requestAnimationFrame(cuadro) }

    armar(); despertar()
    window.addEventListener('pageshow', (e) => { if (e.persisted) { pMax = 0; armar(); despertar() } }) // al volver con "atrás" (por ejemplo, desde los recursos) el techo está entero otra vez
    window.addEventListener('scroll', despertar, { passive: true })
    let ancho = window.innerWidth
    window.addEventListener('resize', () => {
        if (window.innerWidth === ancho) { vh = window.innerHeight; lienzo.height = Math.round(vh * dpr); lienzo.style.height = vh + 'px'; return despertar() } // (en celular la barra del navegador cambia el alto: no se rearma por eso)
        ancho = window.innerWidth; armar(); despertar()
    })
}

// 7.1 Flecha hacia abajo -----------------
    // (index.html) Si la persona se queda quieta un rato antes de llegar al derrumbe (9 s), aparece abajo
    // una flecha que da un saltito y la página entera salta con ella: hay más información más abajo. Se va al hacer scroll; al tocarla baja hasta los recursos.
    // Una vez que la persona llegó hasta donde empieza el derrumbe, no vuelve a salir
// 7.2 Header del index -----------------
    // (index.html) Arriba no hay header (la escena ocupa la pantalla), pero cuando la escena sale de la vista vuelve el título y el menú,
    // fijos arriba (style.css: .cabecera-ver)
function iniciarCabecera() {
    const escena = document.querySelector('.pagina-inicio .escena')
    if (!escena) return
    new IntersectionObserver(([e]) => document.body.classList.toggle('cabecera-ver', !e.isIntersecting)).observe(escena)
}

function iniciarFlecha() {
    const recursos = document.getElementById('como-jugar')
    if (!document.body.classList.contains('pagina-inicio') || !recursos) return
    const flecha = document.createElement('button')
    flecha.type = 'button'; flecha.className = 'flecha-abajo'; flecha.setAttribute('aria-label', 'Hay más información abajo: cómo jugar con gafas')
    flecha.innerHTML = '<span>Cómo jugar abajo</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9 L12 16 L19 9"/></svg>'
    document.body.append(flecha)
    let espera = null, llego = false
    const espacio = () => document.querySelector('.derrumbe-espacio') // donde empieza la animación del derrumbe (sección 7)
    const falta = () => {
        if (llego) return false
        const e = espacio(), arriba = e ? e.getBoundingClientRect().top : recursos.getBoundingClientRect().top
        if (arriba < window.innerHeight * 0.4 || recursos.getBoundingClientRect().top < window.innerHeight * 0.6) llego = true // ya bajó hasta la animación: la flecha no sale más
        return !llego
    }
    const programar = () => {
        flecha.classList.remove('flecha-abajo--ver'); clearTimeout(espera)
        document.body.classList.remove('pagina-salta')
        if (falta()) espera = setTimeout(() => { if (falta()) { flecha.classList.add('flecha-abajo--ver'); document.body.classList.add('pagina-salta') } }, 4500) // 4.5 s quieta antes del derrumbe (antes 9: salía muy tarde)
    }
    window.addEventListener('scroll', programar, { passive: true })
    flecha.addEventListener('click', () => {
        flecha.classList.remove('flecha-abajo--ver'); document.body.classList.remove('pagina-salta')
        recursos.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
    programar()
}

// 8. Inicio -----------------
iniciarMenu()
iniciarDesplazamientoSuave()
iniciarAdvertencia()
iniciarScroll()
// iniciarDerrumbe() (versión AR: sin la animación del techo que se rompe: debajo de la escena solo quedan los patrocinadores)
iniciarFlecha()
iniciarCabecera()
;(window.requestIdleCallback || ((fn) => setTimeout(fn, 300)))(() => iniciarMuestra(), { timeout: 1500 }) // la muestra empieza cuando el navegador está libre (máximo 1.5 s)
iniciarJuego()