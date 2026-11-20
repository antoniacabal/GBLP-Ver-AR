// Indice
    // 0. Imports
    // 1. El globo: un lienzo con la forma de un globo de cómic (la cola abajo a la izquierda)
    // 2. Dibujar el nombre y el texto
    // 3. Encima de quién habla
    // 4. Sistema de los globos (IWSDK)

// Globos de diálogo (en las gafas). Cuando un personaje habla (ui.talk: mamá o Gabriela), lo que dice aparece en un globo de cómic
// encima de su cabeza, dentro de la maqueta, en vez de la caja de abajo del panel. El globo siempre mira hacia quien juega y la cola
// apunta a quien habla. Si quien habla no está a la vista (mamá llama desde abajo), el globo flota sobre el centro de la maqueta.
// Para seguir: pellizcar apuntando al globo, o tocar el botón de la mesa (lo mismo que "Continuar").
// El texto es el mismo de la caja del diálogo (narrativa.html .gx-talk), que en las gafas queda escondida (game.css).

// 0. Imports
import * as THREE from 'three'
import { createSystem } from '@iwsdk/core'
import { player } from '../game/player.js'
import { mom } from '../game/npcs.js'
import { runtime } from '../game/config.js'
import { plataforma } from './maqueta.js'
import { mundo } from './estado.js'

// 1. El globo. Lienzo de 1024 × 512: la cola termina abajo a la izquierda (PUNTA) y ese punto queda sobre la cabeza de quien habla
const W = 1024, H = 512, PUNTA = [70, 500], BASE = 410, ANCHO = 0.2 // ANCHO: metros
const lienzo = document.createElement('canvas'); lienzo.width = W; lienzo.height = H
const ctx = lienzo.getContext('2d'), textura = new THREE.CanvasTexture(lienzo)
textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 4
const geo = new THREE.PlaneGeometry(1, H / W).translate(0.5 - PUNTA[0] / W, (PUNTA[1] / H - 0.5) * H / W, 0) // (el origen en la punta)
const globo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))
globo.name = 'globo'; globo.renderOrder = 11; globo.visible = false; globo.scale.setScalar(ANCHO); globo.frustumCulled = false
mundo.scene.add(globo)

// 2. Dibujar: el cuerpo crece hacia arriba según cuántos renglones tenga el texto (la cola siempre en el mismo lugar)
const TINTA = '#201826', PAPEL = '#FFFDF8', NOMBRE = '#580213', PISTA = '#71708A'
function renglones(texto, max) {
    ctx.font = '500 46px Outfit, sans-serif'
    const out = []; let l = ''
    for (const p of texto.split(/\s+/).filter(Boolean)) {
        const t = l ? l + ' ' + p : p
        if (ctx.measureText(t).width > max && l) { out.push(l); l = p } else l = t
    }
    if (l) out.push(l)
    return out.slice(0, 6)
}
function dibujar(nombre, texto, ultima) {
    const ls = renglones(texto, W - 150), alto = 40 + 50 + Math.max(1, ls.length) * 58 + 62, arriba = BASE - alto
    ctx.clearRect(0, 0, W, H)
    // cuerpo (una píldora) y cola, con el borde oscuro de un solo trazo
    const x0 = 24, x1 = W - 24, r = Math.min(110, alto / 2)
    ctx.beginPath()
    ctx.moveTo(x0 + r, arriba); ctx.lineTo(x1 - r, arriba); ctx.quadraticCurveTo(x1, arriba, x1, arriba + r)
    ctx.lineTo(x1, BASE - r); ctx.quadraticCurveTo(x1, BASE, x1 - r, BASE)
    ctx.lineTo(220, BASE) // hasta donde nace la cola
    ctx.quadraticCurveTo(160, PUNTA[1] - 20, PUNTA[0], PUNTA[1]) // la cola baja curva hasta la punta...
    ctx.quadraticCurveTo(PUNTA[0] - 14, PUNTA[1] - 8, PUNTA[0] - 4, PUNTA[1] - 18)
    ctx.quadraticCurveTo(122, BASE + 40, 118, BASE - 2) // ...y vuelve a subir al cuerpo
    ctx.quadraticCurveTo(x0, BASE - 20, x0, BASE - r); ctx.lineTo(x0, arriba + r); ctx.quadraticCurveTo(x0, arriba, x0 + r, arriba)
    ctx.closePath()
    ctx.fillStyle = PAPEL; ctx.fill(); ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.strokeStyle = TINTA; ctx.stroke()
    // nombre, texto y la pista de cómo seguir
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = NOMBRE; ctx.font = '700 40px Outfit, sans-serif'; ctx.fillText(nombre, 78, arriba + 40 + 30)
    ctx.fillStyle = TINTA; ctx.font = '500 46px Outfit, sans-serif'
    ls.forEach((l, i) => ctx.fillText(l, 78, arriba + 40 + 50 + 40 + i * 58))
    ctx.textAlign = 'right'; ctx.fillStyle = PISTA; ctx.font = '400 28px Outfit, sans-serif'
    ctx.fillText(ultima ? 'Pellizca el globo o toca el botón para cerrar ›' : 'Pellizca el globo o toca el botón para seguir ›', x1 - 60, BASE - 22)
    textura.needsUpdate = true
}

// 3. Encima de quién habla: la cabeza (en unidades del juego, sobre sus pies) pasada al mundo de las gafas
const CABEZA = { Gabriela: 2.0, 'Mamá': 2.3 }
const quien = (nombre) => nombre === 'Mamá' ? mom.g : nombre === 'Gabriela' ? player.group : null
const seVe = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
const punto = new THREE.Vector3(), cab = new THREE.Vector3()
function dondeVa(nombre, out) {
    const o = quien(nombre)
    if (o && seVe(o)) return o.localToWorld(out.set(0, CABEZA[nombre] || 2, 0))
    return plataforma.localToWorld(out.set(-0.06, 0.3, 0)) // (no está a la vista: sobre el centro de la maqueta)
}

// 4. Sistema de los globos
const talkEl = document.querySelector('.gx-talk'), talkName = document.querySelector('.gx-talk-name'), talkText = document.querySelector('.gx-talk-text')
const talkNext = document.querySelector('.gx-talk [data-act="talk-next"]')
const raycaster = new THREE.Raycaster(), mtx = new THREE.Matrix4()
let firma = ''
export class SistemaGlobos extends createSystem({}) {
    update() {
        const hay = !!this.world.session && plataforma.visible && !talkEl.hidden && !runtime.paused
        globo.visible = hay
        if (!hay) { firma = ''; return }
        const nombre = talkName.textContent.trim(), texto = talkText.textContent, ultima = talkNext?.textContent.includes('Cerrar')
        const f = nombre + '|' + texto + '|' + ultima
        if (f !== firma) { firma = f; dibujar(nombre, texto, ultima) } // (el texto se escribe letra por letra: se redibuja al cambiar)
        // sobre la cabeza, siempre de frente a quien juega
        dondeVa(nombre, punto); this.world.camera.getWorldPosition(cab)
        globo.position.copy(punto); globo.lookAt(cab)
        // pellizcar apuntando al globo = "Continuar" (solo las manos: los controles de Meta no tocan la actividad)
        const xr = this.world.input?.xr, rayos = this.world.playerSpaceEntities?.raySpaces
        for (const lado of ['left', 'right']) {
            const rayo = rayos?.[lado]?.object3D
            if (!xr?.isPrimary?.('hand', lado) || !rayo || !xr.getSelectState(lado).start) continue
            rayo.updateWorldMatrix(true, false); mtx.identity().extractRotation(rayo.matrixWorld)
            raycaster.ray.origin.setFromMatrixPosition(rayo.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(mtx).normalize()
            raycaster.ray.origin.addScaledVector(raycaster.ray.direction, -0.3)
            if (raycaster.intersectObject(globo, false).length) { talkNext?.click(); break }
        }
    }
}
