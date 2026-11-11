// Indice
    // 0. Imports y lienzo
    // 1. Recorrido de la interfaz (qué se ve y dónde)
    // 2. Cómo se dibuja cada cosa (cajas, textos, imágenes, SVG)
    // 3. API pública (espejo)

// Espejo de la interfaz: en las gafas la página HTML no se ve, así que la interfaz del juego (mensajes, diálogos, tarjetas, pop-ups,
// el medidor de respiración y los minijuegos) se copia en un lienzo que se pone en un panel 3D frente a quien juega.
// La interfaz sigue siendo la misma de narrativa.html y ui.js (no hay que mantener dos): el navegador la sigue acomodando aunque no
// se vea, y aquí se lee dónde quedó cada cosa (getBoundingClientRect) y se pinta igual. Los clics del panel vuelven a la página como
// eventos de puntero en ese mismo punto (controles.js), así que los botones, el dial y los números funcionan sin cambiar nada.

// 0. Imports y lienzo
import * as THREE from 'three'

const raiz = document.querySelector('.gx')
const SALTAR = '.gx-vignette, .gx-fade, .gx-touch' // la viñeta y el fundido se hacen en 3D (index.js); los controles táctiles no van en las gafas
const ANCHO = 1440 // píxeles del lienzo (el alto sigue la proporción de la ventana)
const lienzo = document.createElement('canvas'), ctx = lienzo.getContext('2d')
export const textura = new THREE.CanvasTexture(lienzo)
textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 4
let escala = 1
const medir = () => { escala = ANCHO / innerWidth; lienzo.width = ANCHO; lienzo.height = Math.round(innerHeight * escala) }
medir(); addEventListener('resize', () => { medir(); firma = '' })

// 1. Recorrido: cada elemento visible se anota como una operación de dibujo; con la firma (lo que se ve) se sabe si algo cambió
let ops = [], firma = '', partes = []
const visible = (el, cs) => !el.hidden && cs.display !== 'none'
function recorrer(el, alfa) {
    for (const h of el.children) {
        if (h.matches(SALTAR)) continue
        const cs = getComputedStyle(h)
        if (!visible(h, cs)) continue
        const a = alfa * parseFloat(cs.opacity || 1)
        if (a < 0.02) continue
        const r = h.getBoundingClientRect()
        if (r.width < 1 && r.height < 1 && !h.children.length) continue
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
        const ver = cs.visibility !== 'hidden'
        if (ver) caja(h, cs, r, a)
        if (h.tagName === 'svg' || h instanceof SVGSVGElement) { if (ver) svg(h, r, a); continue }
        if (ver && (h.tagName === 'IMG' || h.tagName === 'CANVAS')) imagen(h, r, a)
        if (ver) textos(h, cs, a)
        recorrer(h, a)
    }
}

// 2. Cómo se dibuja cada cosa
const radio = (v, w) => v.endsWith('%') ? parseFloat(v) / 100 * w : parseFloat(v) || 0
const primerColor = (img) => (img.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i) || [])[0]
function caja(el, cs, r, a) { // fondo y borde
    let fondo = cs.backgroundColor
    if ((!fondo || fondo === 'rgba(0, 0, 0, 0)' || fondo === 'transparent') && cs.backgroundImage.includes('gradient')) fondo = primerColor(cs.backgroundImage)
    const conFondo = fondo && fondo !== 'rgba(0, 0, 0, 0)' && fondo !== 'transparent'
    const bw = parseFloat(cs.borderTopWidth) || 0, conBorde = bw > 0 && cs.borderTopStyle !== 'none' && cs.borderTopColor !== 'rgba(0, 0, 0, 0)'
    if (!conFondo && !conBorde) return
    // el fondo de los pop-ups oscurece toda la pantalla: en el panel tapaba la maqueta, así que va mucho más suave
    const k = el.classList.contains('gx-modal') ? 0.35 : 1
    const rr = Math.min(r.width / 2, r.height / 2, radio(cs.borderTopLeftRadius, r.width))
    partes.push('c', r.left | 0, r.top | 0, r.width | 0, r.height | 0, fondo, (a * 20) | 0)
    ops.push(() => {
        ctx.globalAlpha = a * k; ctx.beginPath(); ctx.roundRect(r.left, r.top, r.width, r.height, rr)
        if (conFondo) { ctx.fillStyle = fondo; ctx.fill() }
        if (conBorde) { ctx.lineWidth = bw; ctx.strokeStyle = cs.borderTopColor; ctx.stroke() }
    })
}
function imagen(el, r, a) {
    if (el.tagName === 'IMG' && !(el.complete && el.naturalWidth)) return
    partes.push('i', el.currentSrc || el.id, r.left | 0, r.top | 0, r.width | 0, (a * 20) | 0, el.tagName === 'CANVAS' ? performance.now() | 0 : 0)
    ops.push(() => { ctx.globalAlpha = a; try { ctx.drawImage(el, r.left, r.top, r.width, r.height) } catch { /* imagen de otro origen */ } })
}
// Textos: cada renglón se pinta donde el navegador lo puso (se mide palabra por palabra con un Range), con la misma fuente y color.
// Llevan un contorno oscuro suave: en realidad mixta detrás del texto puede estar el cuarto real, que a veces es claro
const rango = document.createRange()
function renglones(nodo) {
    const t = nodo.textContent, out = [], re = /\S+/g
    let m, l = null
    while ((m = re.exec(t))) {
        rango.setStart(nodo, m.index); rango.setEnd(nodo, m.index + m[0].length)
        const rs = rango.getClientRects(); if (!rs.length) continue
        const r = rs[0]
        if (l && Math.abs(r.top - l.top) < r.height * 0.5) { l.fin = m.index + m[0].length; l.der = rs[rs.length - 1].right }
        else { if (l) out.push(l); l = { ini: m.index, fin: m.index + m[0].length, izq: r.left, der: rs[rs.length - 1].right, top: r.top, bottom: r.bottom } }
    }
    if (l) out.push(l)
    return out.map(l => ({ s: t.slice(l.ini, l.fin), x: l.izq, y: (l.top + l.bottom) / 2, w: l.der - l.izq }))
}
const transformar = (s, tt) => tt === 'uppercase' ? s.toUpperCase() : tt === 'lowercase' ? s.toLowerCase() : s
function textos(el, cs, a) {
    for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue
        const ls = renglones(n); if (!ls.length) continue
        const fuente = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, color = cs.color, esp = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing, tt = cs.textTransform
        const tam = parseFloat(cs.fontSize)
        ls.forEach(l => partes.push('t', l.s, l.x | 0, l.y | 0, color, (a * 20) | 0))
        ops.push(() => {
            ctx.globalAlpha = a; ctx.font = fuente; ctx.letterSpacing = esp; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
            ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, tam * 0.14); ctx.strokeStyle = 'rgba(16,10,22,0.55)'; ctx.fillStyle = color
            ls.forEach(l => { const s = transformar(l.s, tt), w = l.w * 1.04 + 2; ctx.strokeText(s, l.x, l.y, w); ctx.fillText(s, l.x, l.y, w) })
        })
    }
}
// SVG (íconos, el círculo de la respiración, la gota del foco): círculos, rectángulos y trazos con los colores que les da el CSS
const RELLENO_URL = '#bfe0d4' // los degradados de los SVG (el círculo que respira) se pintan de un solo color
function svg(el, r, a) {
    const vb = el.viewBox?.baseVal; if (!vb || !vb.width || !r.width) return
    const sc = Math.min(r.width / vb.width, r.height / vb.height), ox = r.left + (r.width - vb.width * sc) / 2 - vb.x * sc, oy = r.top + (r.height - vb.height * sc) / 2 - vb.y * sc
    const figuras = []
    el.querySelectorAll('path, circle, rect, ellipse, polygon, polyline, line').forEach(f => {
        if (f.closest('defs, clipPath, mask')) return
        const cs = getComputedStyle(f); if (cs.display === 'none' || cs.visibility === 'hidden') return
        let p
        const n = (prop, attr) => parseFloat(cs[prop]) || f[attr]?.baseVal?.value || 0
        if (f.tagName === 'circle') { p = new Path2D(); p.arc(n('cx', 'cx'), n('cy', 'cy'), n('r', 'r'), 0, Math.PI * 2) }
        else if (f.tagName === 'ellipse') { p = new Path2D(); p.ellipse(n('cx', 'cx'), n('cy', 'cy'), n('rx', 'rx'), n('ry', 'ry'), 0, 0, Math.PI * 2) }
        else if (f.tagName === 'rect') { p = new Path2D(); p.roundRect(n('x', 'x'), n('y', 'y'), n('width', 'width'), n('height', 'height'), n('rx', 'rx')) }
        else if (f.tagName === 'line') { p = new Path2D(); p.moveTo(f.x1.baseVal.value, f.y1.baseVal.value); p.lineTo(f.x2.baseVal.value, f.y2.baseVal.value) }
        else if (f.tagName === 'path') p = new Path2D(f.getAttribute('d') || '')
        else { const pts = f.getAttribute('points') || ''; p = new Path2D('M' + pts.trim().replace(/\s+/g, ' L') + (f.tagName === 'polygon' ? 'Z' : '')) }
        const relleno = cs.fill.startsWith('url') ? RELLENO_URL : cs.fill, trazo = cs.stroke.startsWith('url') ? RELLENO_URL : cs.stroke
        figuras.push({ p, relleno, trazo, ancho: parseFloat(cs.strokeWidth) || 1, op: parseFloat(cs.opacity || 1), opR: parseFloat(cs.fillOpacity || 1), opT: parseFloat(cs.strokeOpacity || 1), cap: cs.strokeLinecap, join: cs.strokeLinejoin })
        partes.push('s', f.getAttribute('d')?.length || 0, cs.r, relleno, trazo, cs.opacity)
    })
    partes.push('v', r.left | 0, r.top | 0, r.width | 0, (a * 20) | 0)
    ops.push(() => {
        ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc)
        figuras.forEach(f => {
            if (f.relleno && f.relleno !== 'none') { ctx.globalAlpha = a * f.op * f.opR; ctx.fillStyle = f.relleno; ctx.fill(f.p) }
            if (f.trazo && f.trazo !== 'none') { ctx.globalAlpha = a * f.op * f.opT; ctx.strokeStyle = f.trazo; ctx.lineWidth = f.ancho; ctx.lineCap = f.cap; ctx.lineJoin = f.join; ctx.stroke(f.p) }
        })
        ctx.restore()
    })
}

// 3. API pública
let vacio = true
export const espejo = {
    lienzo,
    get vacio() { return vacio }, // no hay nada que mostrar (el panel se esconde)
    // vuelve a leer la interfaz; devuelve true si cambió algo (y la textura ya está marcada para subirse)
    actualizar(extra = '') {
        ops = []; partes = [extra]
        recorrer(raiz, 1)
        const f = partes.join('|')
        if (f === firma) return false
        firma = f; vacio = ops.length === 0
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, lienzo.width, lienzo.height)
        ctx.setTransform(escala, 0, 0, escala, 0, 0)
        ops.forEach(o => o())
        ctx.globalAlpha = 1
        textura.needsUpdate = true
        return true
    },
    // dibuja encima un aviso propio de la realidad mixta (seguridad, cómo poner la maqueta): una franja arriba al centro
    aviso(texto) {
        if (!texto) return
        ctx.setTransform(escala, 0, 0, escala, 0, 0)
        ctx.font = '600 20px Outfit, sans-serif'; ctx.letterSpacing = '0px'
        const w = Math.min(innerWidth * 0.8, ctx.measureText(texto).width + 48), x = (innerWidth - w) / 2, y = innerHeight * 0.26
        ctx.globalAlpha = 0.94; ctx.fillStyle = '#580213'; ctx.beginPath(); ctx.roundRect(x, y, w, 46, 12); ctx.fill()
        ctx.strokeStyle = '#F2C063'; ctx.lineWidth = 2; ctx.stroke()
        ctx.globalAlpha = 1; ctx.fillStyle = '#E4FFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, innerWidth / 2, y + 23, w - 24)
        textura.needsUpdate = true; vacio = false
    }
}
