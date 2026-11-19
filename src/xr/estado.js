// Estado compartido de la realidad aumentada. Lo llenan xr/arranque.js y xr/mundo.js antes de cargar el juego, para que el juego
// (src/game/) pueda usar el mundo de IWSDK sin importarlo directamente (y sin dependencias en círculo)
//   mundo: el World de IWSDK (su renderer, su escena, su cámara y la sesión XR)
export let mundo = null
export const ponerMundo = (w) => { mundo = w }
