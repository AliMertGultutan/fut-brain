import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';
import { conceptFixture } from './fixtures/concept.ts';

test('HTTP konsept: doğrulanmış kaynak zorunlu; PS görevi ve 10 kredi çağrısı sunucuda sınırlandırılır', async () => {
  const fixture = conceptFixture(), urls: URL[] = [];
  const { app, client } = createApp({ keyOverride: () => 'test-secret', transport: async url => {
    const parsed = new URL(String(url)); urls.push(parsed);
    return new Response(JSON.stringify({ status: 'success', data: parsed.pathname.endsWith('get_fc27_sbcs') ? fixture.source : fixture.data }));
  } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/parse/`;
  const post = (route: string, body: unknown) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const body = { year: '27', platform: 'ps', setId: '1', segmentId: '10', page: 1, maxAgeMinutes: 60 };
  try {
    assert.equal((await post('concept', body)).status, 409); assert.equal(urls.length, 0);
    assert.equal((await post('sbcs', { year: '27', detailed: true })).status, 200);
    for (const invalid of [{ ...body, platform: 'pc' }, { ...body, maxAgeMinutes: 0 }, { ...body, segmentId: 'source-missing-1' }, { ...body, setId: '3' }]) assert.equal((await post('concept', invalid)).status, 400);
    assert.equal(urls.length, 1);
    const response = await post('concept', { ...body, players_required: '123', endpoint: 'https://evil.example' });
    assert.equal(response.status, 200); const squad = await response.json(); assert.equal(squad.totalCost, 5500); assert.equal(squad.platform, 'ps');
    assert.ok(urls[1].pathname.endsWith('fc27_sbc_solver')); assert.equal(urls[1].searchParams.get('sbc_name'), fixture.segment.name);
    assert.equal(urls[1].searchParams.get('max_age_minutes'), '60'); assert.equal(urls[1].searchParams.has('players_required'), false);
    assert.equal(client.status().creditsAttempted, 20);
    assert.equal((await (await post('concept', body)).json()).cached, true); assert.equal(urls.length, 2);
    const source = client.peekSaved('get_fc27_sbcs', { page: '1', active_only: 'true' })!;
    source.expires = 0;
    assert.equal((await post('concept', body)).status, 200); assert.equal(urls.length, 2);
    source.fetchedAt = new Date(Date.now() - 86400001).toISOString();
    assert.equal((await post('concept', body)).status, 409); assert.equal(urls.length, 2);
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
});
