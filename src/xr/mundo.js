// El mundo de IWSDK (Meta Immersive Web SDK): una sola sesión XR, un solo renderer y un solo ciclo de dibujo para todo.
// La configuración (modo realidad aumentada, seguimiento de manos, anclas, detección de planos y mallas, hit-test, colocación sobre
// superficies reales) vive en src/iwsdk.config.json; el plugin de Vite la entrega como "virtual:iwsdk-project".
//
// El juego corre como un sistema de IWSDK (ECS: entidades con datos y sistemas que corren cada cuadro). En cada cuadro IWSDK
//   1. corre sus sistemas (manos, agarre, colocación...) y el del juego, en orden de prioridad
//   2. dibuja su escena una vez (en las gafas, una por ojo)

import { World, createSystem } from '@iwsdk/core'
import projectOptions from 'virtual:iwsdk-project'
import gsap from 'gsap'
import { CAPA_PROTA } from '../game/config.js'

export async function crearMundo(contenedor) {
    const mundo = await World.create(contenedor, projectOptions)
    mundo.camera.layers.enable(CAPA_PROTA) // Gabriela vive en su propia capa (config.js)
    // GSAP mueve todos los tiempos del juego (tarjetas, diálogos, sustos...). Su reloj usa requestAnimationFrame de la página, que en
    // la sesión inmersiva deja de llegar (por eso el juego se quedaba en "10 de agosto"). Se apaga su reloj y lo mueve el de IWSDK
    gsap.ticker.sleep()
    return mundo
}

// Sistema del juego: en cada cuadro de IWSDK avanza GSAP y da un paso del juego (paso: main.js → cuadroJuego, xr/maqueta.js...)
export const sistemaJuego = ({ antes, paso }) => class SistemaJuego extends createSystem({}) {
    update(delta, tiempo) {
        antes?.() // (lo que se escondió para dibujar el cuadro anterior vuelve antes de que corra el juego)
        gsap.ticker.tick()
        paso(delta, tiempo)
    }
}
