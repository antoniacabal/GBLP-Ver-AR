// Estado compartido de la realidad mixta (lo leen y escriben los módulos de mr/: así no se importan entre sí en círculo)
//   modo: '' (todavía no se eligió) · 'ar' realidad mixta (passthrough) · 'vr' realidad virtual · 'sim' vista previa en el computador
//   ancla: dónde está la maqueta en el espacio real (metros, en el espacio de referencia de la sesión) y hacia dónde mira

import * as THREE from 'three'

export const mr = {
    modo: '',
    get xr() { return this.modo === 'ar' || this.modo === 'vr' }, // hay una sesión WebXR abierta (las gafas)
    get vista() { return this.modo !== '' }, // se dibuja la maqueta (en las gafas o simulada)
    domOverlay: false, // celular en modo AR: la interfaz HTML se ve encima de la cámara (no hace falta el panel 3D)
    sesion: null, espacio: null, frame: null, // XRSession, XRReferenceSpace y el XRFrame del cuadro actual
    ancla: { p: new THREE.Vector3(0, 0.75, -0.6), yaw: 0, puesta: false, xrAnchor: null },
    giro: 0, // giro extra de la maqueta (stick derecho), en radianes
    zoom: 1, // acercar / alejar la maqueta (stick derecho)
    colocando: false, // buscando una superficie para poner la maqueta
    aviso: '', // aviso de seguridad (una pared o un mueble muy cerca), lo dibuja el panel
    cabeza: new THREE.Vector3(), // posición de la cabeza en el espacio real (para la seguridad y el panel)
}

// Comodidad: para que nadie se maree. La cabeza nunca la mueve el juego (en las gafas solo la mueve quien juega).
// Los temblores se ven en la maqueta (no en la vista) y mucho más suaves que en la pantalla
export const COMODIDAD = {
    temblor: 0.18, // cuánto del sismo se ve en la maqueta (1 = como en la pantalla)
    temblorMax: 0.05, // tope del desplazamiento de la maqueta (unidades del juego)
    seguir: 7, // qué tan rápido el mapa sigue a Gabriela (más = más pegado; sin saltos)
    giroPaso: Math.PI / 6, // giro de la maqueta por cada toque del stick (30°, por pasos: girar suave marea)
    fundidoAR: 0.9, // en realidad mixta el fundido a negro no tapa del todo: siempre se alcanza a ver el cuarto real
}
