import restart from 'vite-plugin-restart'
import basicSsl from '@vitejs/plugin-basic-ssl'
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

// npm run dev:gafas: el servidor con https (con un certificado propio). Las gafas solo abren la realidad mixta en páginas seguras:
// en la red local se entra desde el navegador de las gafas a https://<ip-del-computador>:5173 y se acepta el aviso del certificado
export default ({ mode }) => ({
    root: 'src/', // Sources files (typically where index.html is)
    publicDir: '../static/', // Path from "root" to static assets (files that are served as they are)
    base: './', // Rutas relativas: la página funciona en cualquier carpeta (por ejemplo usuario.github.io/grietas-bajo-la-piel/)
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true, // Add sourcemap
        rollupOptions:
        {
            input: // las 4 páginas del sitio (sin esto solo se compilaba index.html)
            {
                index: pagina('index.html'),
                narrativa: pagina('narrativa.html'),
                respiracion: pagina('respiracion-consciente.html'),
                prevencion: pagina('herramientas-prevencion.html')
            }
        }
    },
    plugins:
    [
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        sinFbx,
        mode === 'gafas' && basicSsl()
    ],
})
