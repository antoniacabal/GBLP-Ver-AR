// Carga de modelos: los FBX de Blender se publican como GLB comprimido con Draco (herramientas/fbx-a-glb.mjs, npm run modelos).
// CargadorModelos se usa igual que el FBXLoader de antes (load y loadAsync con la ruta del .fbx) y entrega el mismo objeto: las mismas
// piezas con sus nombres, materiales y posiciones. Así el resto del juego no cambió. Pasaron de 37 MB a unos 5 MB en la página del juego
//   new CargadorModelos().load('assets/casa/sala/Sala.fbx', (o) => { ... })

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// el decodificador de Draco (static/draco, copiado de three/examples/jsm/libs/draco): uno solo para todos los modelos
const draco = new DRACOLoader().setDecoderPath('draco/')
const gltf = new GLTFLoader().setDRACOLoader(draco)
const aGlb = (url) => url.replace(/\.fbx$/i, '.glb')

// Lo que el GLB guarda distinto vuelve a quedar como lo daba el FBXLoader (el conversor lo anota en userData):
//   · una malla con varios materiales llega partida en una malla por material (userData.multi): se vuelve a juntar, con un grupo por material
//   · los nombres de las piezas (userData.nombre): el GLTFLoader les cambia los espacios y los puntos
function rearmar(escena) {
    const o = escena.children.length === 1 ? escena.children[0] : escena
    o.removeFromParent()
    const partidas = []; o.traverse(c => { if (c.userData.multi && !c.isMesh) partidas.push(c) })
    partidas.forEach(gr => {
        const partes = gr.children.filter(c => c.isMesh)
        const g = partes.length && mergeGeometries(partes.map(p => p.geometry), true)
        if (!g) return // (no se pudieron juntar: se queda partida, igual se ve bien)
        const m = new THREE.Mesh(g, partes.map(p => p.material))
        m.position.copy(gr.position); m.quaternion.copy(gr.quaternion); m.scale.copy(gr.scale); m.userData = gr.userData
        gr.children.filter(c => !c.isMesh).forEach(c => m.add(c))
        const padre = gr.parent; padre.children.splice(padre.children.indexOf(gr), 1, m); m.parent = padre; gr.parent = null
    })
    o.traverse(c => { if (c.userData.nombre !== undefined) c.name = c.userData.nombre })
    return o
}

export class CargadorModelos {
    load(url, alCargar, alAvanzar, alFallar) { gltf.load(aGlb(url), (g) => alCargar(rearmar(g.scene)), alAvanzar, alFallar) }
    loadAsync(url) { return gltf.loadAsync(aGlb(url)).then(g => rearmar(g.scene)) }
}
