// Indice
    // 0. Imports y utilidades de dibujo
    // 1. Dónde van: a los lados de la maqueta (controles a la izquierda, bitácora a la derecha)
    // 2. Panel de controles (izquierda)
    // 3. La bitácora (derecha): un diario abierto con pestañas, como el de Phasmophobia pero con los colores del juego
    //    3.1 Contenido: índice, minijuegos, respiración y grounding
    //    3.2 Páginas de minijuegos: se van llenando a medida que aparecen
    // 4. Señalar y hacer CLICK sobre la bitácora (rayo de la mano o del control)
    // 5. Sistema (IWSDK)

// En las gafas, a los dos lados de la maqueta (que sigue en el centro) flotan dos paneles, de frente a quien juega:
//   [ CONTROLES ] — [ MAQUETA ] — [ BITÁCORA ]
// · Controles: referencia permanente de cómo se juega, con CLICK bien explicado (apuntar con la línea de luz y juntar índice y pulgar).
// · Bitácora: un diario abierto (dos páginas de papel cuadriculado, pestañas arriba y esquinas para pasar la página). Tiene el índice,
//   los tutoriales de los minijuegos (cada uno aparece cuando Gabriela lo vive por primera vez; quedan guardados para consultarlos), la
//   respiración guiada (los tiempos de la respiración cuadrada de la página: 4 · 4 · 4 · 4) y el grounding. No son minijuegos: se
//   consultan cuando se quiera, sin puntos.
// Se navega con la línea de luz (xr/panel.js) y CLICK: pellizco o gatillo del control.
// Todo se dibuja en lienzos (texturas): se redibujan solo cuando algo cambia (la respiración se anima mientras está a la vista).

// 0. Imports y utilidades
import * as THREE from 'three'
import { createSystem } from '@iwsdk/core'
import { runtime } from '../game/config.js'
import { breathing } from '../game/breathing.js'
import { INSTRUCCIONES, INSTRUCCIONES_GAFAS } from '../game/instrucciones.js'
import { plataforma } from './maqueta.js'
import { colocacion } from './colocacion.js'
import { ajustes, alternarEfectos, alternarSonido, moverMaqueta } from './ajustes.js'
import { sonido } from './sonidos.js'

const COL = { tinta: '#201826', tinta2: '#482642', papel: '#F4EAD8', papel2: '#E6D6BC', cuadro: 'rgba(113,112,138,0.22)', oro: '#F2C063', rojo: '#580213', lila: '#A6869B', menta: '#3E8F7C', tapa: '#2A2033' }
const MANO = 'Dongle, Outfit, sans-serif', TITULO = '"Luckiest Guy", Outfit, sans-serif', LETRA = 'Outfit, sans-serif'
function lienzo(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return { c, g: c.getContext('2d'), t }
}
// texto en varios renglones dentro de un ancho; devuelve dónde terminó
function parrafo(g, texto, x, y, ancho, alto) {
    let l = '', yy = y
    for (const p of texto.split(/\s+/)) {
        const t = l ? l + ' ' + p : p
        if (g.measureText(t).width > ancho && l) { g.fillText(l, x, yy); yy += alto; l = p } else l = t
    }
    if (l) { g.fillText(l, x, yy); yy += alto }
    return yy
}
const redondo = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r) }
// la mano haciendo CLICK: índice y pulgar que se juntan, con la línea de luz saliendo hacia adelante
function dibujoClick(g, x, y, s, colorLinea = COL.oro) {
    g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round'
    g.strokeStyle = colorLinea; g.lineWidth = 6; g.setLineDash([14, 10]); g.beginPath(); g.moveTo(92, 34); g.lineTo(200, 0); g.stroke(); g.setLineDash([])
    g.fillStyle = '#F2CBB0'; g.strokeStyle = COL.tinta; g.lineWidth = 5
    g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(-6, 70, 26, 52); g.quadraticCurveTo(52, 20, 86, 26); g.quadraticCurveTo(100, 30, 92, 44) // índice
    g.quadraticCurveTo(70, 52, 74, 62); g.quadraticCurveTo(94, 70, 80, 84); g.quadraticCurveTo(54, 96, 50, 120); g.closePath(); g.fill(); g.stroke()
    g.beginPath(); g.moveTo(40, 92); g.quadraticCurveTo(60, 70, 88, 46); g.stroke() // el pulgar que sube hasta la punta del índice
    g.fillStyle = colorLinea; g.beginPath(); g.arc(90, 42, 9, 0, Math.PI * 2); g.fill() // el punto donde se tocan
    g.restore()
}

// 1. Dónde van. Un grupo con el giro de los controles de la mesa (la plataforma está girada 45°: así +z apunta a quien juega).
//    A cada lado, a 62 cm del centro y apoyados 3 cm sobre la mesa; cada cuadro giran (solo de lado) hacia la cabeza de quien juega
const lados = new THREE.Group(); lados.name = 'lados'; lados.rotation.y = Math.PI / 4; plataforma.add(lados)
const LADO_X = 0.74 // (la plataforma mide 68 cm: los paneles quedan a su lado sin taparla)
function plano(ancho, alto, textura) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto).translate(0, alto / 2, 0), new THREE.MeshBasicMaterial({ map: textura, transparent: true, toneMapped: false }))
    const soporte = new THREE.Group(); soporte.add(m); m.rotation.x = -0.12 // (un poco inclinado hacia atrás, como un atril)
    lados.add(soporte); return { m, soporte }
}

// 2. Panel de controles (izquierda): 30 × 42 cm
const CW = 900, CH = 1260
const ctrl = lienzo(CW, CH)
const panelCtrl = plano(0.3, 0.42, ctrl.t); panelCtrl.soporte.position.set(-LADO_X, 0.03, 0.02); panelCtrl.m.name = 'panel-controles'
const FILAS = [
    ['Joystick', 'A la izquierda de la mesa: agárralo con la mano cerrada y empújalo para caminar.'],
    ['Botón rojo', 'A la derecha: húndelo con el dedo para interactuar y avanzar.'],
    ['Puño', 'Ciérralo para inhalar y sostener; abre la mano para exhalar.'],
    ['Salida rápida', 'El botón blanco de la mesa (o las dos palmas hacia adelante).']
]
function dibujarControles() {
    const g = ctrl.g; g.clearRect(0, 0, CW, CH)
    redondo(g, 6, 6, CW - 12, CH - 12, 36); g.fillStyle = 'rgba(32,24,38,0.94)'; g.fill(); g.lineWidth = 5; g.strokeStyle = COL.oro; g.stroke()
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#E4FFFF'; g.font = `64px ${TITULO}`; g.fillText('Controles', CW / 2, 104)
    // CLICK, lo primero y lo más grande
    redondo(g, 40, 140, CW - 80, 400, 28); g.fillStyle = COL.oro; g.fill()
    g.fillStyle = COL.tinta; g.font = `76px ${TITULO}`; g.fillText('CLICK', CW / 2, 228)
    g.font = `600 36px ${LETRA}`; g.fillText('para elegir o interactuar', CW / 2, 274)
    dibujoClick(g, 150, 300, 1.45, COL.tinta2)
    g.textAlign = 'left'; g.font = `600 33px ${LETRA}`
    const y2 = parrafo(g, '1. Apunta con la línea de luz.', 470, 340, 380, 40)
    parrafo(g, '2. Junta el índice y el pulgar, como un pellizco.', 470, y2 + 14, 380, 40)
    // las demás, en filas
    let y = 600
    for (const [k, txt] of FILAS) {
        g.font = `600 30px ${LETRA}`; const w = g.measureText(k).width + 40
        redondo(g, 40, y - 38, w, 54, 12); g.fillStyle = '#E4FFFF'; g.fill()
        g.fillStyle = COL.tinta; g.fillText(k, 60, y - 2)
        g.fillStyle = '#E4FFFF'; g.font = `32px ${LETRA}`
        y = parrafo(g, txt, 40, y + 56, CW - 80, 42) + 34
    }
    ctrl.t.needsUpdate = true
}

// 3. La bitácora (derecha): 58 × 38 cm, dos páginas
const BW = 2048, BH = 1342
const libroL = lienzo(BW, BH)
const libro = plano(0.58, 0.38, libroL.t); libro.soporte.position.set(LADO_X, 0.03, 0.02); libro.m.name = 'bitacora'
export const superficies = [libro.m, panelCtrl.m] // (xr/panel.js: la línea de luz llega hasta aquí)
const PAG = [{ x: 60, y: 130, w: 940, h: 1150 }, { x: 1048, y: 130, w: 940, h: 1150 }]
// tres pestañas; cada sección tiene sus páginas (se pasan con las esquinas): la técnica y, después, los tutoriales de sus minijuegos.
// 'guiada' y 'presente' son las páginas de las técnicas; las demás, la de cada minijuego (MINIS)
// cuatro pestañas: Minijuegos (los cinco tutoriales), Grounding (las técnicas para recuperar la calma) y Ajustes (efectos, sonido y mover
// la maqueta). 'presente' y 'guiada' son las páginas de las técnicas; las demás, la de cada minijuego (MINIS)
const PESTANAS = [['indice', 'Índice'], ['minijuegos', 'Minijuegos'], ['grounding', 'Saber más'], ['ajustes', 'Ajustes']] // ("Grounding" se confundía con el minijuego)
const SECCION = { minijuegos: ['hold', 'earth', 'gravedad', 'foco', 'conteo'], grounding: ['anclaje', 'caminar', 'sentidos', 'guiada', 'respira1', 'respira2'], ajustes: ['ajustes'] }
const seccionDe = () => 'minijuegos'
export const estado = { tab: 'indice', pag: 0, hover: -1, nueva: '' } // nueva: la pestaña con una página recién escrita (exportado para las pruebas)
let zonas = [] // { x, y, w, h, fn } en píxeles del lienzo

// 3.1 Minijuegos: los cinco tutoriales que ya tiene el juego (los mismos dibujos y, en las gafas, las frases de las manos)
const MINIS = [
    { id: 'hold', nombre: 'Ejercicios de respiración', manos: 'Pon una mano frente a ti. Ciérrala en un puño para inhalar y sostener el aire; ábrela para exhalar. Sigue el aro del círculo' },
    { id: 'earth', nombre: 'Earthing físico', manos: 'Camina con el joystick hasta el pasto y quédate ahí' },
    { id: 'gravedad', nombre: 'Reconstruir la gravedad', manos: 'Abre las dos manos como una balanza (palmas hacia abajo) y sube la del lado contrario a la caída. También sirve pellizcar con las dos, como una barra' },
    { id: 'foco', nombre: 'Foco entre el ruido', manos: 'Gira la mano en el aire, como una perilla' },
    { id: 'conteo', nombre: 'Conteo de grounding', manos: 'Levanta tu mano y muestra los mismos dedos que la mano del dibujo (de 0 a 5)' }
]
const CLAVE = 'gblp-bitacora'
const vistos = new Set((() => { try { return JSON.parse(localStorage.getItem(CLAVE)) || [] } catch { return [] } })())
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify([...vistos])) } catch { /* sin almacenamiento */ } }
const sinEtiquetas = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
// (en las gafas un paso puede cambiar su frase, o su dibujo y su frase: { img, txt })
const pasos = (id) => INSTRUCCIONES[id].map((p, i) => {
    const g = INSTRUCCIONES_GAFAS[id]?.[i], o = typeof g === 'string' ? { txt: g } : g || {}
    return { img: o.img || p.img, txt: o.txt || sinEtiquetas(p.txt.replace(/<span class="gx-solo-tactil">[\s\S]*?<\/span>/g, '')) }
})
// los dibujos (SVG en texto) se vuelven imágenes; las partes del mouse y del celular no van (en las gafas no se usan)
const imagenes = new Map()
function imagen(html) {
    if (imagenes.has(html)) return imagenes.get(html)
    const img = new Image()
    const src = html.match(/<img[^>]*src="([^"]+)"/)?.[1]
    if (src) img.src = src
    else img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(html.replace(/<g class="gx-solo-(teclado|tactil)">[\s\S]*?<\/g>/g, '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" '))
    img.onload = () => { sucio = true }
    imagenes.set(html, img); return img
}
// una "foto" pegada con cinta, como las de la bitácora: el dibujo sobre fondo oscuro (los dibujos son claros)
function foto(g, html, x, y, w, h, giro = 0) {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(giro)
    g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 12; g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20); g.shadowBlur = 0
    g.fillStyle = COL.tapa; g.fillRect(-w / 2, -h / 2, w, h)
    const img = imagen(html); if (img.complete && img.naturalWidth) { const k = Math.min(w / img.naturalWidth, h / img.naturalHeight); g.drawImage(img, -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k) }
    g.fillStyle = 'rgba(242,192,99,0.75)'; g.fillRect(-46, -h / 2 - 24, 92, 30) // la cinta
    g.restore()
}

// 3.2 Dibujar la bitácora
let sucio = true
function hoja(g, p) { // una página: papel cuadriculado, con sombra hacia el lomo
    g.fillStyle = COL.papel; g.fillRect(p.x, p.y, p.w, p.h)
    g.strokeStyle = COL.cuadro; g.lineWidth = 2; g.beginPath()
    for (let x = p.x + 40; x < p.x + p.w; x += 40) { g.moveTo(x, p.y); g.lineTo(x, p.y + p.h) }
    for (let y = p.y + 40; y < p.y + p.h; y += 40) { g.moveTo(p.x, y); g.lineTo(p.x + p.w, y) }
    g.stroke()
    const lomo = p.x < BW / 2 ? p.x + p.w : p.x, gr = g.createLinearGradient(lomo, 0, lomo + (p.x < BW / 2 ? -90 : 90), 0)
    gr.addColorStop(0, 'rgba(32,24,38,0.28)'); gr.addColorStop(1, 'rgba(32,24,38,0)'); g.fillStyle = gr; g.fillRect(Math.min(lomo, lomo + (p.x < BW / 2 ? -90 : 90)), p.y, 90, p.h)
}
const zona = (x, y, w, h, fn) => { zonas.push({ x, y, w, h, fn }); return zonas.length - 1 }
function titulo(g, p, t, sub) {
    g.textAlign = 'left'; g.fillStyle = COL.tinta
    let tam = 66; do { g.font = `${tam}px ${TITULO}` } while (g.measureText(t).width > p.w - 120 && (tam -= 4) > 30) // (se achica hasta caber)
    g.fillText(t, p.x + 60, p.y + 110)
    g.strokeStyle = COL.tinta; g.lineWidth = 4; g.beginPath(); g.moveTo(p.x + 60, p.y + 134); g.lineTo(p.x + p.w - 60, p.y + 134); g.stroke()
    if (sub) { g.font = `64px ${MANO}`; g.fillStyle = COL.tinta2; g.fillText(sub, p.x + 60, p.y + 196) }
}
function casilla(g, x, y, marcada, hover) {
    g.lineWidth = 4; g.strokeStyle = COL.tinta; g.fillStyle = hover ? 'rgba(242,192,99,0.5)' : 'transparent'; g.fillRect(x, y, 44, 44); g.strokeRect(x, y, 44, 44)
    if (marcada) { g.lineWidth = 6; g.beginPath(); g.moveTo(x + 6, y + 6); g.lineTo(x + 38, y + 38); g.moveTo(x + 38, y + 6); g.lineTo(x + 6, y + 38); g.stroke() }
}
function esquina(g, derecha, activa) { // la esquina doblada de abajo: pasar la página
    const p = PAG[derecha ? 1 : 0], s = 130, x = derecha ? p.x + p.w : p.x, y = p.y + p.h
    const i = zona(derecha ? x - s : x, y - s, s, s, () => { if (activa) pasar(derecha ? 1 : -1) })
    const dx = derecha ? -s : s, sobre = estado.hover === i && activa
    g.fillStyle = COL.tapa; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x, y); g.lineTo(x + dx, y); g.closePath(); g.fill() // (debajo de la punta: la tapa)
    g.fillStyle = sobre ? COL.oro : COL.papel2; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + dx, y - s); g.lineTo(x + dx, y); g.closePath(); g.fill() // la punta doblada
    g.strokeStyle = COL.tinta; g.lineWidth = 3; g.stroke()
    g.fillStyle = COL.tinta; g.font = `72px ${TITULO}`; g.textAlign = 'center'; g.fillText(derecha ? '›' : '‹', x + dx * 0.66, y - s * 0.5)
}
function pasar(d) { const l = SECCION[estado.tab]; if (l) { estado.pag = (estado.pag + d + l.length) % l.length; sucio = true } }
const ir = (tab, pag = 0) => { estado.tab = tab; estado.pag = pag; if (estado.nueva === tab) estado.nueva = ''; sucio = true }

function indice(g) {
    const [a, b] = PAG
    titulo(g, a, 'Bitácora', 'Lo que Gabriela va aprendiendo')
    g.font = `58px ${MANO}`; g.fillStyle = COL.tinta
    let y = parrafo(g, 'Aquí quedan las técnicas para recuperar la calma y cómo se juega cada minijuego que vas encontrando. Puedes volver a leerlas cuando quieras.', a.x + 60, a.y + 290, a.w - 120, 60)
    // cómo se usa: CLICK
    redondo(g, a.x + 50, y + 30, a.w - 100, 380, 24); g.fillStyle = 'rgba(242,192,99,0.35)'; g.fill(); g.strokeStyle = COL.tinta; g.lineWidth = 3; g.stroke()
    dibujoClick(g, a.x + 90, y + 120, 1.2, COL.tinta2)
    g.fillStyle = COL.tinta; g.font = `52px ${TITULO}`; g.textAlign = 'left'; g.fillText('CLICK', a.x + 440, y + 120)
    g.font = `52px ${MANO}`; parrafo(g, 'Apunta con la línea de luz y junta el índice y el pulgar sobre una pestaña o una esquina.', a.x + 440, y + 180, a.w - 520, 52)
    // índice con casillas, como la lista de pruebas
    titulo(g, b, 'Índice')
    y = b.y + 220; g.font = `58px ${MANO}`
    const fila = (txt, marcada, fn, sangria = 0) => {
        const i = zona(b.x + 50 + sangria, y - 50, b.w - 100 - sangria, 66, fn)
        casilla(g, b.x + 60 + sangria, y - 40, marcada, estado.hover === i)
        g.fillStyle = estado.hover === i ? COL.rojo : COL.tinta; g.textAlign = 'left'; g.fillText(txt, b.x + 130 + sangria, y); y += 62
    }
    const NOMBRE = { anclaje: 'Anclaje al presente', caminar: 'Earthing y gravedad', sentidos: 'Foco y contar lo que ves', guiada: 'Respiración cuadrada guiada', respira1: 'Pausa y respira', respira2: 'Más respiraciones', ajustes: 'Efectos, sonido y mover la maqueta' }
    for (const [tab, titulo2] of [['minijuegos', 'Minijuegos'], ['grounding', 'Saber más: técnicas de calma'], ['ajustes', 'Ajustes']]) {
        g.font = `40px ${TITULO}`; g.fillStyle = COL.tinta2; g.textAlign = 'left'; g.fillText(titulo2, b.x + 60, y); y += 60
        g.font = `50px ${MANO}`
        SECCION[tab].forEach((id, i) => {
            const tecnica = !!NOMBRE[id], visto = tecnica || vistos.has(id)
            fila(tecnica ? NOMBRE[id] : visto ? MINIS.find(m => m.id === id).nombre : '? ? ?', visto, () => ir(tab, i), 30)
        })
        y += 6
    }
}
function minijuego(g, id) {
    const [a, b] = PAG, m = MINIS.find(x => x.id === id), visto = vistos.has(m.id), donde = `Minijuego ${SECCION.minijuegos.indexOf(id) + 1} de ${SECCION.minijuegos.length}`
    if (!visto) {
        titulo(g, a, '? ? ?', 'Página en blanco')
        g.font = `60px ${MANO}`; g.fillStyle = COL.tinta2
        parrafo(g, 'Este minijuego aparecerá cuando Gabriela lo necesite. Entonces su explicación quedará escrita aquí.', a.x + 60, a.y + 300, a.w - 120, 62)
        return
    }
    const ps = pasos(m.id)
    titulo(g, a, m.nombre, donde)
    // tres pasos: dos en la página izquierda, uno en la derecha (cada uno, su foto y su frase)
    const paso = (p, i, x, y) => {
        foto(g, p.img, x, y, 330, 248, (i % 2 ? 1 : -1) * 0.03)
        g.fillStyle = COL.tinta; g.font = `46px ${TITULO}`; g.textAlign = 'left'; g.fillText(`${i + 1}.`, x + 380, y + 50)
        g.font = `58px ${MANO}`; parrafo(g, p.txt, x + 380, y + 110, 470, 56)
    }
    paso(ps[0], 0, a.x + 70, a.y + 260); paso(ps[1], 1, a.x + 70, a.y + 640)
    titulo(g, b, 'Cómo se juega')
    paso(ps[2], 2, b.x + 70, b.y + 230)
    // (la letra se achica hasta que el texto quepa en el recuadro; antes se salía por abajo)
    let tam = 62; g.font = tam + 'px ' + MANO
    while (tam > 40 && medirParrafo(g, m.manos, b.w - 180, tam, 0) > 360) { tam -= 4; g.font = tam + 'px ' + MANO }
    const altoCaja = Math.max(330, 130 + medirParrafo(g, m.manos, b.w - 180, tam, 0) + 30)
    redondo(g, b.x + 50, b.y + 620, b.w - 100, altoCaja, 24); g.fillStyle = 'rgba(242,192,99,0.35)'; g.fill(); g.strokeStyle = COL.tinta; g.lineWidth = 3; g.stroke()
    g.fillStyle = COL.tinta; g.font = `46px ${TITULO}`; g.fillText('Con las manos', b.x + 90, b.y + 700)
    g.font = tam + 'px ' + MANO; parrafo(g, m.manos, b.x + 90, b.y + 780, b.w - 180, tam)
}
// respiración guiada: la respiración cuadrada de la página (inhalar 4 s, retener 4 s, exhalar 4 s, pausa en vacío 4 s) y un círculo que
// crece al inhalar, se queda al retener y se encoge al exhalar (como el medidor del juego)
const FASES = [['INHALAR', 'Inhala lentamente por la nariz.'], ['MANTENER', 'Mantén los pulmones llenos de aire.'], ['EXHALAR', 'Suelta el aire pausadamente por la boca.'], ['REPETIR', 'Mantén los pulmones vacíos y vuelve a empezar.']]
let tResp = 0
function respiracion(g) {
    const [a, b] = PAG
    titulo(g, a, 'Respiración cuadrada', 'Paso a paso: 4 · 4 · 4 · 4')
    let y = a.y + 300
    FASES.forEach(([f, txt], i) => {
        g.fillStyle = [COL.menta, COL.oro, COL.lila, COL.tinta2][i]; g.beginPath(); g.arc(a.x + 100, y - 18, 34, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#fff'; g.font = `44px ${TITULO}`; g.textAlign = 'center'; g.fillText(i + 1, a.x + 100, y)
        g.textAlign = 'left'; g.fillStyle = COL.tinta; g.font = `46px ${TITULO}`; g.fillText(f, a.x + 160, y - 4)
        g.font = `30px ${LETRA}`; g.fillStyle = COL.tinta2; g.fillText('4 segundos', a.x + 600, y - 6)
        g.font = `56px ${MANO}`; g.fillStyle = COL.tinta; y = parrafo(g, txt, a.x + 160, y + 58, a.w - 230, 54) + 50
    })
    g.font = `52px ${MANO}`; g.fillStyle = COL.tinta2
    parrafo(g, 'En el juego: cierra el puño para inhalar y sostener; abre la mano para exhalar.', a.x + 60, a.y + a.h - 130, a.w - 120, 52)
    // el círculo que respira
    titulo(g, b, 'Sigue el círculo')
    const t = tResp % 16, f = Math.floor(t / 4), k = (t % 4) / 4, ease = (x) => 0.5 - Math.cos(x * Math.PI) / 2
    const r = 120 + 200 * (f === 0 ? ease(k) : f === 1 ? 1 : f === 2 ? 1 - ease(k) : 0), cx = b.x + b.w / 2, cy = b.y + 560
    g.strokeStyle = COL.tinta; g.globalAlpha = 0.25; g.lineWidth = 4; g.setLineDash([10, 12]); g.beginPath(); g.arc(cx, cy, 320, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1
    g.fillStyle = ['#9ff0de', COL.oro, '#d9bdf2', '#cfc4d6'][f]; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = COL.tinta; g.lineWidth = 5; g.stroke()
    g.fillStyle = COL.tinta; g.textAlign = 'center'; g.font = `72px ${TITULO}`; g.fillText(FASES[f][0], cx, cy + 24)
    g.font = `60px ${MANO}`; g.fillText(`${4 - Math.floor(t % 4)}`, cx, cy + 96)
    // las cuatro fases debajo, la actual marcada
    FASES.forEach(([n], i) => { g.globalAlpha = i === f ? 1 : 0.35; g.font = `40px ${TITULO}`; g.fillText(n, b.x + 140 + i * 220, b.y + 980) })
    g.globalAlpha = 1
}
// Las técnicas de verdad: los textos de la página "Técnicas de respiración" (respiracion-consciente.html), tal cual, en páginas de dos
// lados. Cada lado: un título, un subtítulo opcional y sus bloques (un nombre y su texto)
const TECNICAS = {
    anclaje: { izq: { titulo: 'Anclaje al presente', sub: 'Vuelve a pisar tierra firme', bloques: [{ t: '', txt: "El grounding (o enraizamiento) reúne un conjunto de técnicas psicológicas de anclaje de la atención que permiten redirigir la mente hacia el momento presente e interrumpir el ruido mental o los estados de pánico. Al enfocar deliberadamente los sentidos y el cuerpo en estímulos concretos del entorno, ayudamos al sistema nervioso a salir del estado de alarma y recuperar estabilidad." }] },
        der: { titulo: 'Formas de anclarte', bloques: [{ t: 'Anclaje postural y propioceptivo', txt: "Siéntate de forma erguida o ponte de pie manteniendo ambos pies firmemente plantados sobre el suelo, distanciados a la anchura de las caderas, y activa levemente la musculatura de las piernas para sentir el peso y la estabilidad de la tierra bajo tu cuerpo. También resulta efectivo presionar los muslos contra la silla o caminar descalzo percibiendo de manera consciente las distintas texturas del piso." }, { t: 'Earthing físico y anclaje plantar', txt: "El contacto directo del cuerpo con la superficie es una de las herramientas de estabilización propioceptiva más potentes." }, { t: 'Observación de objetos ancla', txt: "Tomar un objeto cercano (como una piedra, una llave o una taza) y describir mentalmente o en voz alta su peso, temperatura, forma y rugosidad. Mantener la atención en características tangibles ayuda al cerebro a verificar que la amenaza del temblor ha pasado y que el entorno actual es seguro." }] } },
    caminar: { izq: { titulo: 'Earthing en movimiento', sub: 'Meditación caminando', bloques: [{ t: '', txt: "El earthing también se puede hacer caminando: avanza muy despacio, sintiendo cómo cada parte del pie toca el suelo (talón, planta, dedos) y acompaña cada paso con la respiración. Si puedes, hazlo descalzo sobre pasto o tierra. Es una buena opción cuando quedarse quieto se hace difícil y el cuerpo pide moverse." }] },
        der: { titulo: 'Reconstruir la gravedad', bloques: [{ t: 'Para qué sirve', txt: "Para la sensación de que el suelo sigue temblando o de que todo está inclinado (el mareo pos-sismo). Calibrar el equilibrio con una referencia física le recuerda al oído interno dónde está la vertical." }, { t: 'Cómo practicarlo', txt: "Busca una línea recta y firme (el marco de una puerta, la esquina de una pared). Ponte de pie con los pies separados, mira la línea y alinea tu cuerpo con ella. Si sientes que te vas hacia un lado, haz una fuerza suave hacia el lado contrario hasta sentirte derecho, y quédate ahí respirando lento unos segundos." }] } },
    sentidos: { izq: { titulo: 'Foco entre el ruido', bloques: [{ t: 'Para qué sirve', txt: "Para la sobrecarga de sonidos después del sismo (sirenas, alarmas, retumbos, zumbido en los oídos) que no deja pensar. Escoger un solo sonido seguro y constante entre el caos le da a la atención un lugar donde descansar." }, { t: 'Cómo practicarlo', txt: "Cierra los ojos y busca un sonido que se repita de forma tranquila: un reloj, una gota, el viento, tu propia respiración. Síguelo con toda la atención; cuando la mente se vaya a otro ruido, vuelve a ese sonido sin juzgarte. Poco a poco el resto queda de fondo." }] },
        der: { titulo: 'Contar lo que ves', bloques: [{ t: 'Para qué sirve', txt: "Para los momentos en que el entorno se siente lejano o irreal (disociación). Contar estímulos concretos obliga a la mente a mirar lo que de verdad está pasando ahora." }, { t: 'Cómo practicarlo', txt: "Cuenta en voz alta cosas que tengas delante: tus dedos uno por uno, cinco objetos de un color, las patas de una silla. Hazlo despacio y nombra cada cosa. Si te ayuda, combínalo con la regla 5-4-3-2-1 (cinco cosas que ves, cuatro que tocas, tres que oyes, dos que hueles, una que saboreas)." }] } },
    respira1: { izq: { titulo: 'Pausa y respira', sub: 'Tu temporizador de calma', bloques: [{ t: '', txt: "El control de la respiración genera una respuesta biológica directa sobre el sistema nervioso parasimpático: al alargar la exhalación más que la inhalación, disminuye la frecuencia cardíaca y se regula la sobreactivación fisiológica del pánico." }, { t: 'Respiración diafragmática (abdominal)', txt: "Inhala lentamente por la nariz entre 3 y 4 segundos, dirigiendo el aire hacia el abdomen para que se expanda la barriga sin mover el pecho, y suelta el aire por la boca entre 4 y 6 segundos sintiendo cómo se vacía." }] },
        der: { titulo: 'Respiraciones', bloques: [{ t: 'Respiración cuadrada (box breathing)', txt: "Un ciclo estructurado en 4 tiempos iguales: inhala por la nariz en 4 segundos, retén el aire 4 segundos, exhala por la boca en 4 segundos y mantén los pulmones vacíos 4 segundos. Repite por varios minutos." }, { t: 'Exhalación prolongada (ritmo 4-6 u 4-8)', txt: "Inhala por la nariz contando mentalmente hasta 4 y exhala despacio por la boca contando hasta 6 o 8 segundos. Esta exhalación extendida es una de las vías más rápidas para inducir la calma." }, { t: 'Respiración con labios fruncidos', txt: "Ayuda a bajar la frecuencia respiratoria y a manejar la falta de aire o la ansiedad. Inhala suavemente por la nariz contando hasta 2, frunce los labios como si fueras a soplar una vela y exhala despacio por la boca contando hasta 4 (el doble de lo que duró la inhalación)." }] } },
    respira2: { izq: { titulo: 'Más respiraciones', bloques: [{ t: 'Respiración igualitaria (4-4)', txt: "Inhala 4 segundos y exhala 4 segundos. Es sencilla y uniforme, ideal para principiantes, descansos cortos o meditación: equilibra cuerpo y mente y se puede practicar en cualquier lugar." }, { t: 'Relajación profunda (4-4-6-2)', txt: "Inhala 4 segundos, mantén el aire 4, exhala en 6 y haz una pausa de 2. Su ritmo suave y calmante sirve en descansos del trabajo o para aliviar el estrés: activa la respuesta de relajación y reduce la tensión." }] },
        der: { titulo: 'Para calmarse rápido', bloques: [{ t: 'Técnica 4-7-8 (respiración relajante)', txt: "Pensada para provocar una relajación profunda y facilitar el sueño. Inhala por la nariz en 4 segundos llevando el aire al abdomen, sostén la respiración 7 segundos y exhala por la boca durante 8 segundos con un soplido suave. Haz de 4 a 8 repeticiones." }, { t: 'Suspiro fisiológico', txt: "Una técnica rápida para bajar el estrés del momento y reajustar el dióxido de carbono en los pulmones. Inhala profundo por la nariz llenando el abdomen; sin soltar el aire, toma un segundo sorbo corto por la nariz para terminar de llenar los pulmones y exhala muy despacio por la boca." }] } }
}
// una página de técnica: el texto se achica lo justo para caber en el papel (en la letra de la página, legible)
function paginaTecnica(g, id) {
    const pg = TECNICAS[id]
    ;[[PAG[0], pg.izq], [PAG[1], pg.der]].forEach(([p, lado]) => {
        titulo(g, p, lado.titulo, lado.sub)
        const y0 = p.y + (lado.sub ? 270 : 220), limite = p.y + p.h - 170
        for (let tam = 46; tam >= 30; tam -= 2) {
            // primero se mide (sin dibujar) y, si cabe, se dibuja
            const medir = (dibujar) => {
                let y = y0
                for (const b of lado.bloques) {
                    if (b.t) { g.font = (tam + 4) + 'px ' + TITULO; if (dibujar) { g.fillStyle = COL.tinta2; g.textAlign = 'left'; g.fillText(b.t, p.x + 60, y, p.w - 120) } y += tam + 22 }
                    g.font = '500 ' + tam + 'px ' + LETRA; g.fillStyle = COL.tinta; g.textAlign = 'left'
                    y = dibujar ? parrafo(g, b.txt, p.x + 60, y, p.w - 120, tam * 1.32) : medirParrafo(g, b.txt, p.w - 120, tam * 1.32, y)
                    y += tam * 0.7
                }
                return y
            }
            if (medir(false) <= limite || tam === 30) { medir(true); break }
        }
    })
}
function medirParrafo(g, texto, ancho, alto, y) {
    let l = ''
    for (const p of texto.split(/\s+/)) { const t = l ? l + ' ' + p : p; if (g.measureText(t).width > ancho && l) { y += alto; l = p } else l = t }
    return l ? y + alto : y
}
// Ajustes: tres botones grandes (se activan con CLICK como todo en la bitácora) y, en la otra página, qué hace cada uno
function paginaAjustes(g) {
    const [a, b] = PAG
    titulo(g, a, 'Ajustes', 'Haz CLICK en un botón')
    const boton = (y, texto, encendido, fn) => {
        const i = zona(a.x + 60, y, a.w - 120, 190, () => { fn(); sucio = true })
        redondo(g, a.x + 60, y, a.w - 120, 190, 28)
        g.fillStyle = estado.hover === i ? COL.oro : encendido === false ? COL.papel2 : 'rgba(242,192,99,0.45)'; g.fill(); g.lineWidth = 5; g.strokeStyle = COL.tinta; g.stroke()
        g.fillStyle = COL.tinta; g.textAlign = 'left'; g.font = '54px ' + TITULO; g.fillText(texto, a.x + 110, y + 90)
        if (encendido !== undefined) { g.font = '58px ' + MANO; g.fillStyle = encendido ? COL.menta : COL.rojo; g.fillText(encendido ? 'Encendido' : 'Apagado', a.x + 110, y + 150) }
    }
    boton(a.y + 280, 'Efectos visuales', ajustes.efectos, alternarEfectos)
    boton(a.y + 520, 'Sonido', ajustes.sonido, alternarSonido)
    boton(a.y + 760, 'Mover la maqueta', undefined, moverMaqueta)
    titulo(g, b, 'Qué hace cada uno')
    g.textAlign = 'left'; g.fillStyle = COL.tinta
    const nota = (y, t, txt) => { g.font = '44px ' + TITULO; g.fillText(t, b.x + 60, y); g.font = '56px ' + MANO; return parrafo(g, txt, b.x + 60, y + 64, b.w - 120, 56) }
    let y = nota(b.y + 260, 'Efectos visuales', 'Los temblores de la maqueta, los edificios que se deforman y la sombra alrededor de la vista. Sin ellos todo se ve más tranquilo.')
    y = nota(y + 40, 'Sonido', 'La música y los efectos de sonido.')
    nota(y + 40, 'Mover la maqueta', 'Vuelve a colocarla en otra mesa o sobre un libro: apoya las manos donde la quieras.')
}
function dibujarLibro() {
    const g = libroL.g; zonas = []
    g.clearRect(0, 0, BW, BH)
    // tapas (morado oscuro con borde dorado) y lomo
    redondo(g, 20, 90, BW - 40, BH - 110, 34); g.fillStyle = COL.tapa; g.fill(); g.lineWidth = 6; g.strokeStyle = COL.oro; g.stroke()
    // pestañas arriba de la página izquierda; la activa es del color del papel
    PESTANAS.forEach(([id, n], i) => {
        const x = 70 + i * 236, w = 226, activa = estado.tab === id
        const z = zona(x, 14, w, 120, () => ir(id))
        g.fillStyle = activa ? COL.papel : estado.hover === z ? '#f7d99b' : COL.papel2
        g.beginPath(); g.moveTo(x, 132); g.lineTo(x + 10, 30); g.quadraticCurveTo(x + 14, 16, x + 30, 16); g.lineTo(x + w - 30, 16); g.quadraticCurveTo(x + w - 14, 16, x + w - 10, 30); g.lineTo(x + w, 132); g.closePath(); g.fill()
        g.strokeStyle = COL.tinta; g.lineWidth = 3; g.stroke()
        g.fillStyle = COL.tinta; g.font = `${activa ? 58 : 54}px ${MANO}`; g.textAlign = 'center'; g.fillText(n, x + w / 2, 96)
        if (estado.nueva === id) { g.fillStyle = COL.rojo; g.beginPath(); g.arc(x + w - 26, 40, 14, 0, Math.PI * 2); g.fill() } // página nueva
    })
    PAG.forEach(p => hoja(g, p))
    g.fillStyle = COL.tinta2; g.fillRect(BW / 2 - 6, PAG[0].y, 12, PAG[0].h) // el lomo
    const pagina = SECCION[estado.tab]?.[estado.pag]
    if (!pagina) indice(g)
    else if (pagina === 'ajustes') paginaAjustes(g)
    else { if (pagina === 'guiada') respiracion(g); else if (TECNICAS[pagina]) paginaTecnica(g, pagina); else minijuego(g, pagina); esquina(g, false, true); esquina(g, true, true) }
    // número de página (el índice, luego los minijuegos, el grounding y los ajustes)
    const antes = { minijuegos: 0, grounding: SECCION.minijuegos.length, ajustes: SECCION.minijuegos.length + SECCION.grounding.length }
    const n = !pagina ? 1 : 3 + 2 * (antes[estado.tab] + estado.pag)
    g.fillStyle = COL.tinta2; g.font = `44px ${MANO}`; g.textAlign = 'center'; g.fillText(n, PAG[0].x + PAG[0].w / 2, PAG[0].y + PAG[0].h - 30); g.fillText(n + 1, PAG[1].x + PAG[1].w / 2, PAG[1].y + PAG[1].h - 30)
    libroL.t.needsUpdate = true; sucio = false
}
dibujarControles(); dibujarLibro()
export const lienzos = { libro: libroL.c, controles: ctrl.c } // (para las pruebas)
export const irA = (tab, pag = 0) => ir(tab, pag) // (para las pruebas)
document.fonts?.ready.then(() => { dibujarControles(); sucio = true })

// 4. Señalar y hacer CLICK: el rayo de cada mano (o control) contra la bitácora; el punto se pasa a píxeles del lienzo
const raycaster = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3()
function tocado(rayo) {
    rayo.updateWorldMatrix(true, false); o.setFromMatrixPosition(rayo.matrixWorld); d.set(0, 0, -1).transformDirection(rayo.matrixWorld)
    raycaster.set(o.addScaledVector(d, -0.2), d)
    const h = raycaster.intersectObject(libro.m, false)[0]
    if (!h) return -1
    const x = h.uv.x * BW, y = (1 - h.uv.y) * BH
    return zonas.findIndex(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h)
}

// 5. Sistema
const cab = new THREE.Vector3(), aqui = new THREE.Vector3()
const MECH = (id) => ['earth', 'gravedad', 'foco', 'conteo'].includes(id) ? id : 'hold'
export class SistemaBitacora extends createSystem({}) {
    update(delta) {
        const activo = !!this.world.session && colocacion.puesta && !colocacion.colocando && plataforma.visible
        lados.visible = activo
        if (!activo) return
        // la bitácora aparece después del sismo (antes, la mañana de Gabriela va sin ella); el panel de controles está siempre
        libro.soporte.visible = !!runtime.postQuake
        // un minijuego empieza: la bitácora se abre en su página (para consultarla mientras se juega). La primera vez además se escribe
        // (y la pestaña lo avisa). Antes solo cambiaba de página la primera vez y podía quedarse en otra página en blanco
        // (también apenas se abre su "Cómo se juega": la bitácora ya muestra la página mientras se lee el aviso)
        const tut = document.querySelector('.gx-tutorial:not([hidden]) .gx-sub')?.textContent.trim()
        const delAviso = tut ? (tut === 'Ejercicios de respiración' ? 'hold' : MINIS.find(m => m.nombre === tut)?.id) : null
        const jugando = delAviso || (breathing.active && runtime.techId ? MECH(runtime.techId) : null)
        if (jugando && jugando !== this.jugando) {
            const tab = seccionDe(jugando)
            if (!vistos.has(jugando)) { vistos.add(jugando); guardar() }
            ir(tab, SECCION[tab].indexOf(jugando))
        }
        this.jugando = jugando
        // de frente a quien juega (solo de lado)
        this.world.camera.getWorldPosition(cab)
        for (const s of [panelCtrl.soporte, libro.soporte]) {
            s.getWorldPosition(aqui); const local = lados.worldToLocal(cab.clone())
            s.rotation.y = Math.atan2(local.x - s.position.x, local.z - s.position.z)
        }
        // rayos: lo que se señala se resalta; CLICK (pellizco o gatillo) lo activa
        const xr = this.world.input?.xr, rayos = this.world.playerSpaceEntities?.raySpaces
        let hover = -1
        for (const lado of ['left', 'right']) {
            const rayo = rayos?.[lado]?.object3D
            if (!rayo || !(xr?.isPrimary?.('hand', lado) || xr?.isPrimary?.('controller', lado))) continue
            const i = tocado(rayo); if (i >= 0) hover = i
            if (i >= 0 && xr.getSelectState(lado).start) { sonido.pagina(); zonas[i]?.fn() }
        }
        if (hover !== estado.hover) { estado.hover = hover; sucio = true }
        if (SECCION[estado.tab]?.[estado.pag] === 'guiada') { tResp += delta; if ((this.tAnim = (this.tAnim || 0) - delta) <= 0) { this.tAnim = 1 / 20; sucio = true } }
        if (sucio) dibujarLibro()
    }
}
