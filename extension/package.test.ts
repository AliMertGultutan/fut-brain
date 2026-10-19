import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fixturePlan, eaRuntime } from './fixtures.ts';

test('Paket: MV3, sınırlı izinler ve MAIN içine taşınabilen derlenmiş fonksiyon', async () => {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 3); assert.deepEqual(manifest.permissions, ['storage', 'scripting']);
  assert.deepEqual(manifest.host_permissions, ['https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*']);
  assert.ok(!manifest.externally_connectable); assert.equal(manifest.content_scripts.length, 2);
  const compiled = await build({ entryPoints: ['extension/src/background.ts'], bundle: true, write: false, format: 'esm', target: 'chrome120' });
  const source = compiled.outputFiles[0].text;
  assert.ok(!source.includes('PARSE_API_KEY')); assert.ok(!source.includes('submitChallenge(')); assert.ok(!source.includes('chrome.cookies'));
  const context: any = { chrome: { runtime: { onMessage: { addListener: () => undefined } } }, setTimeout, clearTimeout, URL, crypto };
  runInNewContext(source + '\nglobalThis.adapter = importEaConcept;', context);
  const { g, stats } = eaRuntime(), plan = fixturePlan();
  // Gerçek enjeksiyondaki gibi fonksiyon tekrar başka çalışma ortamına kopyalanır.
  const injected = runInNewContext(`(${context.adapter.toString()})`, { window: g, setTimeout, clearTimeout });
  assert.equal((await injected(plan)).ok, true); assert.equal(stats.saves, 1);
});
