// Arranque de narrativa.html: crea el mundo de IWSDK, carga el juego dentro y espera a que quien juega elija cómo entrar.
//   1. World.create (xr/mundo.js) con src/iwsdk.config.json
//   2. el juego (src/game/main.js) y la maqueta (xr/maqueta.js), que corren como un sistema de IWSDK
//   3. pantalla de inicio: "Entrar en realidad aumentada" (mundo.launchXR, necesita el clic) o verlo en esta pantalla (en el
//      computador, con el emulador IWER de IWSDK en desarrollo)

import { crearMundo, sistemaJuego } from './mundo.js'
import { ponerMundo } from './estado.js'

export async function arrancar() {
    const mundo = await crearMundo(document.getElementById('escena-xr'))
    ponerMundo(mundo)
    mundo.renderer.domElement.classList.add('webgl', 'webgl--narrativa') // (los estilos y touch.js buscan el lienzo con esta clase)
    const juego = await import('../game/main.js')
    const { audio } = await import('../game/audio.js')
    const { actualizarMaqueta, mostrarFuera } = await import('./maqueta.js')
    const { SistemaColocacion } = await import('./colocacion.js') // colocar la plataforma sobre la mesa real (etapa 2)
    const { SistemaPanel } = await import('./panel.js') // la interfaz del juego en un panel pegado a la plataforma (etapa 3)
    mundo.registerSystem(sistemaJuego({ antes: mostrarFuera, paso: (dt, t) => { juego.cuadroJuego(dt); actualizarMaqueta(dt, t) } }))
    mundo.registerSystem(SistemaColocacion)
    mundo.registerSystem(SistemaPanel)
    const { SistemaJoystick } = await import('./joystick.js') // el joystick de la mesa: caminar con la mano (etapa 4)
    mundo.registerSystem(SistemaJoystick)
    const { SistemaBoton } = await import('./boton.js') // el botón de la mesa: interactuar con el índice (etapa 5)
    mundo.registerSystem(SistemaBoton)
    const { SistemaGestos } = await import('./gestos.js') // respirar, minijuegos y salida rápida con las manos (etapa 6)
    mundo.registerSystem(SistemaGestos)
    // ?debug: para revisar la realidad aumentada desde la consola (y las pruebas automáticas con el emulador)
    if (window.juego) Object.assign(window.juego, { mundo, xr: { colocacion: (await import('./colocacion.js')).colocacion, plataforma: (await import('./maqueta.js')).plataforma, mesa: (await import('./joystick.js')).mesa, manos: (await import('./gestos.js')).manos } })
    await elegir(mundo, audio)
    juego.empezarJuego()
}

// Pantalla de inicio (narrativa.html, .mr-inicio)
function elegir(mundo, audio) {
    const el = document.querySelector('.mr-inicio')
    if (!el) return Promise.resolve()
    const estado = el.querySelector('.mr-estado'), bAR = el.querySelector('[data-mr="ar"]'), bPantalla = el.querySelector('[data-mr="sim"]')
    el.querySelector('[data-mr="vr"]')?.remove()
    ;(navigator.xr?.isSessionSupported('immersive-ar') ?? Promise.resolve(false)).catch(() => false).then((ar) => {
        bAR.hidden = !ar
        estado.textContent = ar ? 'Tus gafas pueden mostrar el juego sobre tu mesa real.' : !window.isSecureContext ? 'Para usar las gafas, la página tiene que abrirse con https.' : 'Este navegador no tiene realidad aumentada: puedes verlo en esta pantalla.'
        el.classList.add('mr-inicio--listo')
    })
    return new Promise((listo) => {
        const salir = () => { el.hidden = true; listo() }
        bAR.addEventListener('click', () => { audio.init(); mundo.launchXR(); salir() }) // (el sonido y la sesión XR necesitan el clic)
        bPantalla.addEventListener('click', () => { audio.init(); salir() })
    })
}
