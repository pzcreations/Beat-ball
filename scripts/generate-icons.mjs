// Gera os ícones PNG do PWA a partir do símbolo vetorial.
// Uso: npm run icons   (requer Playwright com Chromium disponível)
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const GLYPH =
  '<path d="M22 46V18h12.2c6.3 0 10.3 3.4 10.3 8.9 0 4.1-2.3 7-6 8.2L45 46h-6.6l-6-10.3H27.8V46H22Zm5.8-15.2h6c3 0 4.8-1.5 4.8-4s-1.8-3.9-4.8-3.9h-6v7.9Z" fill="#fff"/><rect x="22" y="50" width="23" height="3" rx="1.5" fill="#a8c8ec"/>';

// "any": cantos arredondados com fundo transparente.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#0b2545"/>${GLYPH}</svg>`;
// "maskable"/Apple: fundo cheio; símbolo reduzido para caber na área segura.
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0b2545"/><g transform="translate(32 34) scale(${scale}) translate(-33.5 -35.5)">${GLYPH}</g></svg>`;

const targets = [
  { file: "icon-192.png", size: 192, svg: rounded },
  { file: "icon-512.png", size: 512, svg: rounded },
  { file: "maskable-512.png", size: 512, svg: fullBleed(0.78) },
  { file: "apple-touch-icon.png", size: 180, svg: fullBleed(0.92) },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${t.svg.replace("<svg ", `<svg width="${t.size}" height="${t.size}" `)}</body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(path.join(out, t.file), buf);
  console.log("gerado", t.file);
}
await browser.close();
