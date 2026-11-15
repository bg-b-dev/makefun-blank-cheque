import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const dir = new URL('.', import.meta.url);
const svg = readFileSync(new URL('logo.svg', dir), 'utf8');

for (const size of [1024, 128]) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { fontFiles: ['/System/Library/Fonts/Supplemental/Arial Black.ttf'], loadSystemFonts: false, defaultFontFamily: 'Arial Black' },
  }).render().asPng();
  writeFileSync(new URL(size === 1024 ? 'logo.png' : 'thumb-128.png', dir), png);
}
