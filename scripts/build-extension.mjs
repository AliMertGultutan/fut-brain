import { build } from 'esbuild';
import { zipSync } from 'fflate';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const outdir = path.join(root, 'extension/dist');
await mkdir(outdir, { recursive: true });
// MAIN dünyasına kopyalanan fonksiyonun dış yardımcılara ihtiyacı olmaması için modern hedef kullanılır.
for (const [source, output, format] of [['background', 'background', 'esm'], ['siteContent', 'site-content', 'iife'], ['eaContent', 'ea-content', 'iife']]) {
  await build({ entryPoints: [path.join(root, `extension/src/${source}.ts`)], outfile: path.join(outdir, `${output}.js`), bundle: true, format, target: 'chrome120', charset: 'utf8', legalComments: 'none', sourcemap: false });
}
await writeFile(path.join(outdir, 'manifest.json'), await readFile(path.join(root, 'extension/manifest.json')));
const files = {};
for (const name of ['manifest.json', 'background.js', 'site-content.js', 'ea-content.js']) files[name] = new Uint8Array(await readFile(path.join(outdir, name)));
await writeFile(path.join(root, 'extension/fut-brain-extension.zip'), zipSync(files, { level: 9 }));
console.log('FUT Brain eklentisi ve kurulum ZIP dosyası hazır.');
