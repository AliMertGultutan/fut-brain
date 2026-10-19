import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';
test('HTTP eklenti: eksik pakete açık hata; mevcut pakete ZIP indirmesi ve kaynak sınırı', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fut-brain-extension-test-'));
  const { app } = createApp({ root, keyOverride: () => '' }); const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/extension/download`;
  try {
    assert.equal((await fetch(url)).status, 503);
    mkdirSync(path.join(root, 'extension')); writeFileSync(path.join(root, 'extension/fut-brain-extension.zip'), new Uint8Array([80, 75, 3, 4]));
    assert.equal((await fetch(url, { headers: { Origin: 'https://evil.example' } })).status, 403);
    const response = await fetch(url); assert.equal(response.status, 200); assert.ok(response.headers.get('content-disposition')?.includes('fut-brain-extension.zip'));
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [80, 75, 3, 4]);
  } finally {
    await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    assert.ok(root.startsWith(path.join(tmpdir(), 'fut-brain-extension-test-'))); rmSync(root, { recursive: true, force: true });
  }
});
