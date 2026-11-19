import { iwsdkDev } from '@iwsdk/vite-plugin-dev'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const pagina = (archivo) => fileURLToPath(new URL('./src/' + archivo, import.meta.url))

// Los FBX son la fuente de los modelos (el juego carga sus GLB con Draco: npm run modelos). No se publican: pesaban 51 MB
const sinFbx = {
    name: 'sin-fbx',
    closeBundle() {
        const borrar = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
            const p = path.join(dir, e.name)
            if (e.isDirectory()) borrar(p)
            else if (e.name.toLowerCase().endsWith('.fbx')) fs.rmSync(p)
        })
        borrar(fileURLToPath(new URL('./dist/assets', import.meta.url)))
    }
}

// IWSDK (Meta Immersive Web SDK): la configuración del mundo XR vive en src/iwsdk.config.json (la raíz de Vite es src/).
// En desarrollo, el plugin carga el emulador IWER (una Quest 3 simulada en el navegador) y sirve con https
export default {
    root: 'src/',
    publicDir: 'public', // (src/public: así lo espera IWSDK, que guarda ahí sus escenas)
    base: './', // rutas relativas: funciona dentro de usuario.github.io/GBLP-Ver-AR/
    server: { host: true, port: 5173 },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true,
        target: 'esnext',
        rollupOptions: {
            input: { // las 4 páginas del sitio
                index: pagina('index.html'),
                narrativa: pagina('narrativa.html'),
                respiracion: pagina('respiracion-consciente.html'),
                prevencion: pagina('herramientas-prevencion.html')
            }
        }
    },
    esbuild: { target: 'esnext' },
    // una sola copia de Three.js: IWSDK trae la suya (super-three) y el juego la usa también (package.json: three → super-three)
    resolve: { dedupe: ['three', '@pmndrs/uikit'] },
    optimizeDeps: {
        exclude: ['@babylonjs/havok'],
        include: ['three', '@pmndrs/uikit', '@drawcall/uikitml'],
        esbuildOptions: { target: 'esnext' }
    },
    plugins: [iwsdkDev(), sinFbx]
}
