// Instrucciones con imágenes: para cada minijuego, tres dibujos con una frase corta debajo (el pop-up "Cómo se juega" de ui.js).
// Antes eran párrafos de texto; así se entiende de un vistazo. Los dibujos son SVG con los colores del juego

const C = { fondo: '#2A2033', linea: '#E4FFFF', oro: '#F2C063', menta: '#9ff0de', lila: '#d9bdf2', pasto: '#799180', piel: '#F2CBB0', cafe: '#A16A49', rojo: '#D01F2A' }
const svg = (dentro) => `<svg viewBox="0 0 120 90" aria-hidden="true">${dentro}</svg>`
const raton = (x, y, presionado) => `<rect x="${x}" y="${y}" width="22" height="32" rx="11" fill="none" stroke="${C.linea}" stroke-width="2.5"/><path d="M${x + 11} ${y} V${y + 13}" stroke="${C.linea}" stroke-width="2"/>${presionado ? `<path d="M${x + 2} ${y + 10} Q${x + 2} ${y + 1} ${x + 11} ${y + 1} V${y + 13} H${x + 2} Z" fill="${C.oro}"/>` : ''}`
// el botón Interactuar del celular (en vez del mouse): redondo, como en pantalla; presionado se llena de dorado
const boton = (x, y, presionado) => `<circle cx="${x + 11}" cy="${y + 16}" r="14" fill="${presionado ? C.oro : 'rgba(228,255,255,.12)'}" stroke="${C.linea}" stroke-width="2"/><path d="M${x + 5} ${y + 16} h12 M${x + 13} ${y + 12} l4 4 l-4 4" fill="none" stroke="${presionado ? '#201826' : C.linea}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
// la parte que cambia entre computador (mouse, clic) y celular (botón Interactuar)
const segun = (pc, tactil) => `<g class="gx-solo-teclado">${pc}</g><g class="gx-solo-tactil">${tactil}</g>`
const ruido = (x, y) => `<path d="M${x} ${y} l5 -12 l5 22 l5 -30 l5 34 l5 -24 l5 18 l5 -10" fill="none" stroke="${C.rojo}" stroke-width="2.5" stroke-linejoin="round"/>`
const gota = (x, y, s = 1, c = C.menta) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -12 C0 -12 -8 -1 -8 4 a8 8 0 0 0 16 0 C8 -1 0 -12 0 -12 Z" fill="${c}"/>`
// las flechas en pantalla del celular (en vez de A / D): un botón redondo con un chevrón
const flecha = (x, y, izq, on) => `<circle cx="${x + 11}" cy="${y + 11}" r="11" fill="${on ? C.oro : 'rgba(228,255,255,.15)'}" stroke="${C.linea}" stroke-opacity=".5" stroke-width="1.5"/><path d="${izq ? `M${x + 13} ${y + 6} L${x + 8} ${y + 11} L${x + 13} ${y + 16}` : `M${x + 9} ${y + 6} L${x + 14} ${y + 11} L${x + 9} ${y + 16}`}" fill="none" stroke="${on ? '#201826' : C.linea}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
const persona = (x, y, giro = 0) => `<g transform="translate(${x} ${y}) rotate(${giro})"><circle cx="0" cy="-30" r="9" fill="#5a3f33"/><rect x="-7" y="-21" width="14" height="18" rx="5" fill="#3E6656"/><rect x="-6" y="-4" width="5" height="14" rx="2" fill="#E4E4EA"/><rect x="1" y="-4" width="5" height="14" rx="2" fill="#E4E4EA"/></g>`

export const INSTRUCCIONES = {
    hold: [
        { img: svg(`<circle cx="45" cy="45" r="30" fill="none" stroke="${C.linea}" stroke-opacity=".35" stroke-width="2"/><circle cx="45" cy="45" r="24" fill="${C.menta}"/>${segun(raton(86, 30, true), boton(84, 29, true))}<path d="M45 12 v-6 M45 6 l-4 4 M45 6 l4 4" stroke="${C.menta}" stroke-width="2.5" stroke-linecap="round"/>`), txt: 'Mantén <span class="gx-solo-teclado">el clic</span><span class="gx-solo-tactil">Interactuar</span> para inhalar' },
        { img: svg(`<circle cx="60" cy="45" r="32" fill="none" stroke="${C.linea}" stroke-opacity=".25" stroke-width="12"/><circle cx="60" cy="45" r="32" fill="none" stroke="${C.linea}" stroke-width="2.5"/><circle cx="60" cy="45" r="30" fill="${C.oro}" fill-opacity=".85"/>`), txt: 'Tu círculo sigue al aro' },
        { img: svg(`<circle cx="45" cy="45" r="30" fill="none" stroke="${C.linea}" stroke-opacity=".35" stroke-width="2"/><circle cx="45" cy="45" r="12" fill="${C.lila}"/>${segun(raton(86, 30, false), boton(84, 29, false))}<path d="M45 22 v8 M45 30 l-4 -4 M45 30 l4 -4" stroke="${C.lila}" stroke-width="2.5" stroke-linecap="round"/>`), txt: 'Suelta para exhalar' }
    ],
    earth: [
        { img: svg(`<rect x="62" y="52" width="46" height="22" rx="4" fill="${C.pasto}"/>${persona(28, 62)}<path d="M40 44 L60 54" stroke="${C.oro}" stroke-width="3" stroke-linecap="round"/><path d="M60 54 l-8 -1 M60 54 l-4 -7" stroke="${C.oro}" stroke-width="3" stroke-linecap="round"/>`), txt: 'Camina hasta el pasto' },
        { img: svg(`<rect x="22" y="56" width="76" height="24" rx="4" fill="${C.pasto}"/>${persona(60, 64)}`), txt: 'Quédate encima' },
        { img: svg(`<rect x="14" y="36" width="92" height="18" rx="9" fill="none" stroke="${C.linea}" stroke-width="2.5"/><rect x="18" y="40" width="62" height="10" rx="5" fill="${C.menta}"/>`), txt: 'Llena la barra' }
    ],
    gravedad: [
        { img: svg(`<path d="M10 78 H110" stroke="${C.linea}" stroke-opacity=".4" stroke-width="2"/>${persona(60, 66, 18)}<path d="M84 30 q8 8 0 16 M90 24 q12 14 0 28" fill="none" stroke="${C.oro}" stroke-width="2.5" stroke-linecap="round"/>`), txt: 'Gabriela se va de lado' },
        { img: svg(`${persona(60, 66, 18)}<path d="M36 40 H14 M14 40 l7 -6 M14 40 l7 6" stroke="${C.menta}" stroke-width="3.5" stroke-linecap="round"/><g class="gx-solo-teclado"><text x="22" y="66" font-family="Outfit,sans-serif" font-size="14" font-weight="700" fill="${C.linea}">A</text><text x="88" y="66" font-family="Outfit,sans-serif" font-size="14" font-weight="700" fill="${C.linea}" fill-opacity=".4">D</text></g><g class="gx-solo-tactil">${flecha(14, 56, true, true)}${flecha(84, 56, false, false)}</g>`), txt: 'Empuja hacia el otro lado' },
        { img: svg(`${persona(60, 60)}<rect x="22" y="72" width="76" height="12" rx="6" fill="none" stroke="${C.linea}" stroke-width="2"/><ellipse cx="60" cy="78" rx="7" ry="4" fill="${C.menta}"/>`), txt: 'Sostenla derecha' }
    ],
    foco: [
        { img: svg(`${ruido(10, 45)}${ruido(62, 40)}<circle cx="60" cy="72" r="5" fill="${C.linea}" fill-opacity=".3"/>`), txt: 'Todo suena a la vez' },
        { img: svg(`<circle cx="60" cy="45" r="28" fill="#482642" stroke="#A6869B" stroke-width="3"/><circle cx="60" cy="45" r="20" fill="#71708A"/><rect x="57" y="25" width="6" height="16" rx="3" fill="${C.oro}"/><path d="M98 30 a40 40 0 0 1 -6 38" fill="none" stroke="${C.menta}" stroke-width="3" stroke-linecap="round"/><path d="M92 68 l-1 -9 M92 68 l8 -4" stroke="${C.menta}" stroke-width="3" stroke-linecap="round"/>`), txt: 'Gira el dial' },
        { img: svg(`${gota(60, 40, 1.6)}<path d="M36 74 q24 -10 48 0" fill="none" stroke="${C.menta}" stroke-width="2.5" stroke-linecap="round" stroke-opacity=".6"/>`), txt: 'Quédate con la gota' }
    ],
    conteo: [
        { img: `<img src="assets/minijuego/mano3.png" alt="">`, txt: 'Cuenta los dedos' },
        { img: svg(`<rect x="10" y="28" width="28" height="30" rx="7" fill="#E4FFFF"/><rect x="46" y="28" width="28" height="30" rx="7" fill="${C.menta}"/><rect x="82" y="28" width="28" height="30" rx="7" fill="#E4FFFF"/><text x="24" y="50" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" font-weight="700" fill="#201826">2</text><text x="60" y="50" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" font-weight="700" fill="#201826">3</text><text x="96" y="50" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" font-weight="700" fill="#201826">5</text>`), txt: 'Toca el número' },
        { img: svg([0, 1, 2, 3, 4].map(i => `<circle cx="${20 + i * 20}" cy="34" r="8" fill="${C.oro}"/>`).join('') + [0, 1, 2].map(i => `<circle cx="${44 + i * 16}" cy="66" r="5.5" fill="${i ? 'rgba(255,255,255,.35)' : C.rojo}" stroke="#fff" stroke-width="1.5"/>`).join('')), txt: '5 aciertos; 3 errores y no pasa' }
    ]
}
