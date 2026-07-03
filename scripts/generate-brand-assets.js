/*
 * Gerador dos assets da marca "nitin".
 * Letterforms: traços com stroke-linecap round, reproduzindo o wordmark
 * (n i t i n) e o motivo do ícone ("n" com dois pontos de equilíbrio).
 * Paleta: Abyss #02040C · Midnight #0330B0 · Sapphire #0A3FD4 · Electric #1D60F5 · White #FFFFFF
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
if (!OUT) throw new Error('uso: node generate.js <pasta-do-projeto>');

const ABYSS = '#02040C';
const MIDNIGHT = '#0330B0';
const SAPPHIRE = '#0A3FD4';
const ELECTRIC = '#1D60F5';
const WHITE = '#FFFFFF';

// ---------- wordmark "nitin" ----------
// viewBox 0 0 1160 700 — baseline 620, x-height 300..620, dots em y=170
const SW = 78; // stroke width
// "pontinha" do n: a haste esquerda sobe ACIMA do arco, com topo arredondado
// (round cap); o encontro do cap com o arco externo forma o pequeno cusp da marca.
// Retorna dois subpaths: haste alta + arco com haste direita.
function letterN(lx) {
  const rx = lx + 200;
  const R = 100;
  const ty = 300; // topo do x-height (arco parte de ty+R)
  return [
    `M ${lx} 620 L ${lx} 285`, // haste esquerda, topo acima do ápice do arco
    `M ${lx} ${ty + R} A ${R} ${R} 0 0 1 ${rx} ${ty + R} L ${rx} 620`,
  ];
}
function wordmarkSvg({ text, dots }) {
  // n(100..300) i(470) t(640, barra 580..700) i(810) n(980..1180)
  const strokes = [
    ...letterN(100),
    'M 470 300 L 470 620', // i1
    'M 640 175 L 640 620', // t haste
    'M 580 330 L 700 330', // t barra
    'M 810 300 L 810 620', // i2
    ...letterN(980),
  ].map((d) => `<path d="${d}" fill="none" stroke="${text}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const dotEls = [470, 810].map((x) => `<circle cx="${x}" cy="170" r="56" fill="${dots}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 700">${strokes.join('')}${dotEls.join('')}</svg>`;
}

// ---------- motivo do ícone: "n" + dois pontos ----------
// viewBox 0 0 512 512, n central
// haste esquerda alta (topo arredondado acima do arco = "pontinha" da marca)
const MARK_N = [
  'M 166 420 L 166 208',
  'M 166 306 A 90 90 0 0 1 346 306 L 346 420',
];

function markSvg({ stroke, leftDot, rightDot, sw = 58 }) {
  const paths = MARK_N.map(
    (d) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    ${paths}
    <circle cx="166" cy="128" r="42" fill="${leftDot}"/>
    <circle cx="346" cy="128" r="42" fill="${rightDot}"/>
  </svg>`;
}

function iconSvg(size, { rounded }) {
  // fundo em gradiente Midnight -> Electric, motivo branco + ponto esquerdo lavanda
  const rectAttrs = rounded ? `rx="${size * 0.22}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${MIDNIGHT}"/>
        <stop offset="1" stop-color="${ELECTRIC}"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" ${rectAttrs} fill="url(#bg)"/>
    <g>
      ${MARK_N.map((d) => `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="58" stroke-linecap="round"/>`).join('')}
      <circle cx="166" cy="128" r="42" fill="#9FAEDD"/>
      <circle cx="346" cy="128" r="42" fill="${WHITE}"/>
    </g>
  </svg>`;
}

// adaptive icon: só o motivo, branco, transparente, dentro da safe zone (66%)
function adaptiveSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="translate(256 256) scale(0.62) translate(-256 -256)">
      ${MARK_N.map((d) => `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="58" stroke-linecap="round"/>`).join('')}
      <circle cx="166" cy="128" r="42" fill="#9FAEDD"/>
      <circle cx="346" cy="128" r="42" fill="${WHITE}"/>
    </g>
  </svg>`;
}

async function render(svg, file, width, height) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
  console.log('ok', path.relative(OUT, file));
}

(async () => {
  const assets = path.join(OUT, 'assets');
  const brand = path.join(assets, 'brand');
  fs.mkdirSync(brand, { recursive: true });

  // ícone do app (quadrado full-bleed; o SO aplica a máscara)
  await render(iconSvg(1024, { rounded: false }), path.join(assets, 'icon.png'), 1024, 1024);
  // adaptive icon android (foreground transparente)
  await render(adaptiveSvg(), path.join(assets, 'adaptive-icon.png'), 1024, 1024);
  // favicon (com cantos arredondados baked-in)
  await render(iconSvg(64, { rounded: true }), path.join(assets, 'favicon.png'), 64, 64);
  // splash: wordmark branco + pontos Electric (fundo Abyss vem do app.json)
  await render(wordmarkSvg({ text: WHITE, dots: ELECTRIC }), path.join(assets, 'splash-icon.png'), 1040, 700);
  // wordmarks para uso in-app
  await render(wordmarkSvg({ text: WHITE, dots: ELECTRIC }), path.join(brand, 'wordmark-dark.png'), 1040, 700);
  await render(wordmarkSvg({ text: ABYSS, dots: SAPPHIRE }), path.join(brand, 'wordmark-light.png'), 1040, 700);
  // marca isolada (ñ) para telas internas
  await render(markSvg({ stroke: ABYSS, leftDot: SAPPHIRE, rightDot: SAPPHIRE }), path.join(brand, 'mark-light.png'), 512, 512);
  await render(markSvg({ stroke: WHITE, leftDot: ELECTRIC, rightDot: ELECTRIC }), path.join(brand, 'mark-dark.png'), 512, 512);
})();
