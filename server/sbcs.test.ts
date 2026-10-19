import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';
import type { AddressInfo } from 'node:net';

test('SBC HTTP uç noktası doğru yılı, liste/ayrıntı maliyetini ve önbelleği korur', async () => {
  const urls: URL[] = [];
  const { app, client } = createApp({ keyOverride: () => 'test_key', transport: async input => {
    const url = new URL(String(input)); urls.push(url);
    const year = url.pathname.endsWith('get_sbcs') ? '26' : '27';
    const detailed = !url.pathname.endsWith('_list');
    return new Response(JSON.stringify({ status: 'success', data: { page: Number(url.searchParams.get('page')), sbcs: [{ id: '15', name: 'Test SBC', url: `https://www.futbin.com/${year}/squad-building-challenge/15`, expires: '2 days', ...(detailed ? { challenges: [{ id: '32', name: 'Test segment', requirements: ['# of players in squad: 1'] }], challenges_error: null } : {}) }], has_more: true } }));
  } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/parse/sbcs`;
  const post = (body: unknown) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    for (const body of [{ year: '25' }, { year: '27', page: 0 }, { year: '27', detailed: 'true' }, { year: '27', activeOnly: 'false' }]) assert.equal((await post(body)).status, 400);
    assert.equal(urls.length, 0);
    const list = await (await post({ year: '27' })).json();
    assert.equal(list.credits, 1); assert.equal(list.detailed, false); assert.equal(list.sets[0].segments.length, 0);
    assert.ok(urls[0].pathname.endsWith('get_fc27_sbcs_list')); assert.equal(urls[0].searchParams.get('active_only'), 'true');
    const details = await (await post({ year: '27', detailed: true })).json();
    assert.equal(details.credits, 10); assert.equal(details.sets[0].segments[0].rules.supported, true); assert.equal(client.creditsAttempted, 11);
    assert.ok(urls[1].pathname.endsWith('get_fc27_sbcs'));
    const cached = await (await post({ year: '27', detailed: true })).json();
    assert.equal(cached.cached, true); assert.equal(cached.credits, 0); assert.equal(urls.length, 2);
    const fc26 = await (await post({ year: '26' })).json(); assert.equal(fc26.detailed, true); assert.equal(fc26.credits, 1); assert.equal(fc26.year, '26');
    assert.equal(client.creditsAttempted, 12);
    assert.equal((await post({ year: '27', page: 2, detailed: true })).status, 429); assert.equal(urls.length, 3);
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
});
