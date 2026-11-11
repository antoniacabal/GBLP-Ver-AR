// Oclusión ambiental (GTAO de three.js): oscurece un poco las esquinas, los rincones y donde dos cosas se juntan (los muebles contra la
// pared, los pies contra el piso, las casas contra el andén). Da más volumen sin cambiar la luz. Lo usan el juego (main.js) y la muestra
// del index (script.js). Es un efecto de pantalla (cuesta), así que en celulares no se usa: ahí se dibuja como siempre
//   crearOclusion(renderer, escena, camara, { radio, intensidad }) → { render(), tamano(ancho, alto) }

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export const conOclusion = () => !matchMedia('(pointer: coarse)').matches && (navigator.hardwareConcurrency || 8) > 2

export function crearOclusion(renderer, escena, camara, { radio = 0.5, intensidad = 0.7 } = {}) {
    const tam = renderer.getSize(new THREE.Vector2())
    // con antialias (4 muestras), como el lienzo normal: sin él los bordes se veían dentados y los contornos blancos de la muestra (líneas
    // justo sobre las aristas de los muebles) se perdían contra las caras y solo quedaban los de la losa y el celular
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: 4 }))
    composer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.5)) // (a más resolución, mucho más caro: 1.5 ya se ve nítido)
    composer.setSize(tam.x, tam.y)
    composer.addPass(new RenderPass(escena, camara))
    const ao = new GTAOPass(escena, camara, tam.x, tam.y)
    ao.updateGtaoMaterial({ radius: radio, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 })
    ao.blendIntensity = intensidad
    // lo transparente (brillos, la cara de Gabriela, las casas que se desvanecen, las fallas) no cuenta: si no, dejaba sombras donde no hay nada
    ao.overrideVisibility = function () {
        const cache = this._visibilityCache
        this.scene.traverse(o => {
            cache.set(o, o.visible)
            if (o.isPoints || o.isLine || (o.material && [o.material].flat().some(m => m.transparent || !m.depthWrite))) o.visible = false
        })
    }
    composer.addPass(ao)
    composer.addPass(new OutputPass())
    return {
        render() { composer.render() },
        tamano(ancho, alto) { composer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.5)); composer.setSize(ancho, alto) }
    }
}
