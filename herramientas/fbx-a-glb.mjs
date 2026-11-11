// Convierte los modelos FBX de static/assets a GLB comprimido con Draco (lo que carga el juego: ver src/game/modelos.js)
//   npm run modelos            → convierte los FBX que no tienen GLB o que cambiaron después de él
//   npm run modelos -- --todos → los convierte todos otra vez
//
// Por qué así: los FBX de Blender pesaban 37 MB y se descargaban enteros. El GLB guarda lo mismo que lee el FBXLoader (mismas piezas,
// nombres, materiales y posiciones), y Draco comprime la geometría. El juego sigue leyendo los modelos como antes: modelos.js devuelve el
// mismo objeto que daba el FBXLoader. Los FBX se quedan en la carpeta como fuente (no se publican: ver vite.config.js)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// El FBXLoader y el GLTFExporter de three.js esperan un navegador: con esto basta para leer y escribir sin texturas
globalThis.self = globalThis
globalThis.window = { innerWidth: 1920, innerHeight: 1080 } // (las cámaras que trae el archivo lo piden; igual se quitan)
const avisar = console.warn; console.warn = (m, ...r) => { if (!String(m).includes('MeshStandardMaterial')) avisar(m, ...r) } // (el juego cambia los materiales al cargar)
globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onload?.({ target: this }); this.onloadend?.({ target: this }) }) }
    readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onload?.({ target: this }); this.onloadend?.({ target: this }) }) }
}

const THREE = await import('three')
const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js')
const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
const { NodeIO } = await import('@gltf-transform/core')
const { KHRDracoMeshCompression } = await import('@gltf-transform/extensions')
const { draco } = await import('@gltf-transform/functions')
const draco3d = (await import('draco3dgltf')).default

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../static/assets')
const todos = process.argv.includes('--todos')
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule() })

const buscar = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? buscar(path.join(dir, e.name)) : e.name.toLowerCase().endsWith('.fbx') ? [path.join(dir, e.name)] : [])

// Lo que el GLB no guarda igual y el juego necesita se anota en userData (viaja como "extras" del glTF y modelos.js lo devuelve a su sitio):
//   nombre: el nombre de cada pieza (el GLTFLoader cambia espacios y puntos)
//   multi: la malla tenía varios materiales (en el GLB se parte en una malla por material; modelos.js las vuelve a juntar)
function preparar(o) {
    const fuera = []; o.traverse(c => { if (c.isLight || c.isCamera) fuera.push(c) }); fuera.forEach(c => c.removeFromParent()) // (el juego también las quitaba al cargar)
    o.traverse(c => {
        c.userData = { nombre: c.name }
        if (!c.isMesh) return
        // colores por vértice y UV extra (uv1-uv3): Blender los exporta, pero el juego pone sus propios materiales y solo usa la primera UV
        ;['color', 'uv1', 'uv2', 'uv3'].forEach(n => c.geometry.deleteAttribute(n))
        if (!Array.isArray(c.material)) return
        // varios materiales sin decir qué parte lleva cada uno (el delantal de la mamá): el juego usa el primero
        if (!c.geometry.groups.length) c.material = c.material[0]
        else { c.userData.multi = true; juntarGrupos(c.geometry) }
    })
}
// El FBX parte la malla en un grupo cada vez que cambia el material (un edificio traía 357): en el GLB cada grupo es una pieza aparte y
// pesaba más que el FBX. Se reordenan los triángulos para que quede un solo grupo por material (se ve igual)
function juntarGrupos(g) {
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()])
    const viejo = g.index.array, porMat = new Map()
    g.groups.forEach(gr => { const l = porMat.get(gr.materialIndex) || []; for (let i = gr.start; i < gr.start + gr.count; i++) l.push(viejo[i]); porMat.set(gr.materialIndex, l) })
    const indices = new Uint32Array(viejo.length), grupos = []; let n = 0
    ;[...porMat.keys()].sort((a, b) => a - b).forEach(m => { const l = porMat.get(m); grupos.push({ start: n, count: l.length, materialIndex: m }); indices.set(l, n); n += l.length })
    g.setIndex(new THREE.BufferAttribute(indices.subarray(0, n), 1)); g.clearGroups(); grupos.forEach(gr => g.addGroup(gr.start, gr.count, gr.materialIndex))
}

const exportar = (o) => new Promise((ok, mal) => new GLTFExporter().parse(o, ok, mal, { binary: true, onlyVisible: false }))

let antes = 0, despues = 0
for (const fbx of buscar(raiz)) {
    const glb = fbx.replace(/\.fbx$/i, '.glb')
    const tam = fs.statSync(fbx).size
    if (!todos && fs.existsSync(glb) && fs.statSync(glb).mtimeMs > fs.statSync(fbx).mtimeMs) { antes += tam; despues += fs.statSync(glb).size; continue }
    const datos = fs.readFileSync(fbx)
    const o = new FBXLoader().parse(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength), path.dirname(fbx) + '/')
    preparar(o)
    const doc = await io.readBinary(new Uint8Array(await exportar(o)))
    await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 12 }))
    fs.writeFileSync(glb, await io.writeBinary(doc))
    const nuevo = fs.statSync(glb).size; antes += tam; despues += nuevo
    console.log(`${path.relative(raiz, fbx).padEnd(58)} ${(tam / 1024).toFixed(0).padStart(6)} KB → ${(nuevo / 1024).toFixed(0).padStart(5)} KB`)
}
console.log(`\nTotal: ${(antes / 1048576).toFixed(1)} MB en FBX → ${(despues / 1048576).toFixed(1)} MB en GLB`)
