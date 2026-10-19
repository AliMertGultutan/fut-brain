import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.ts';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';

test('Yerel HTTP: yapılandırma, doğrulama, arama, fiyat ayrıntısı ve güvenlik', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fut-brain-parse-test-'));
  const calls: URL[] = [];
  const { app } = createApp({ root, transport: async (url, init) => {
    const u = new URL(String(url)); calls.push(u);
    assert.equal((init?.headers as Record<string, string>)['X-API-Key'], 'test_key_123456789');
    const data = u.pathname.endsWith('get_evos') ? { evos: [{ name: 'Test Evolution', url: 'https://www.futbin.com/26/evolutions/1/test', requirements: { Overall: 'Max 85' } }] } :
      u.pathname.endsWith('get_player_details') ? { id: '1', prices: { pc: { price: '9000', updated: '54 secs ago' } } } :
      { page: Number(u.searchParams.get('page')), results: [{ id: '1', name: 'Test Card', rating: '90', position: 'ST', price_pc: '10K', price_ps: '20K', version: 'Gold Rare' }], has_more: false };
    return new Response(JSON.stringify({ status: 'success', data }));
  } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/parse/`;
  const post = (route: string, data: unknown, headers: Record<string, string> = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  try {
    assert.equal((await (await fetch(base + 'status')).json()).configured, false);
    assert.equal((await post('players', { year: '27', platform: 'pc' })).status, 503);
    assert.equal(calls.length, 0);
    assert.equal((await post('config', { apiKey: 'test_key_123456789' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('config', { apiKey: 'bad\nOTHER=value' })).status, 400);
    const config = await (await post('config', { apiKey: 'test_key_123456789' })).json();
    assert.equal(config.configured, true); assert.equal(config.connected, false);
    assert.ok(!JSON.stringify(config).includes('test_key_123456789'));
    assert.ok(readFileSync(path.join(root, '.env.local'), 'utf8').includes('test_key_123456789'));
    assert.equal((await post('details', { year: '27', platform: 'pc' })).status, 400);
    assert.equal((await post('players', { year: '28', platform: 'pc' })).status, 400);
    assert.equal(calls.length, 0);
    const page = await (await post('players', { year: '27', platform: 'pc', query: 'Test' })).json();
    assert.equal(page.players[0].price, 10000); assert.equal(page.players[0].inClub, false); assert.equal(page.players[0].priceStatus, 'STALE');
    assert.ok(!JSON.stringify(page).includes('test_key_123456789')); assert.ok(!page.data);
    assert.ok(calls[0].pathname.endsWith('search_players_fc27')); assert.equal(calls[0].searchParams.get('query'), 'Test');
    const xbox = await (await post('players', { year: '27', platform: 'xbox', query: 'Test' })).json();
    assert.equal(xbox.players[0].priceStatus, 'UNAVAILABLE'); assert.equal(xbox.cached, true); assert.equal(calls.length, 1);
    const detail = await (await post('details', { year: '27', platform: 'pc', playerId: '1' })).json();
    assert.equal(detail.player.priceStatus, 'LIVE'); assert.equal(detail.player.price, 9000);
    assert.equal(calls[1].searchParams.get('year'), '27'); assert.equal(calls[1].searchParams.get('player_id'), '1');
    const evos = await (await post('evolutions', {})).json(); assert.equal(evos.evolutions[0].year, '26');
    const catalog = await (await post('players', { year: '26', platform: 'ps', minRating: 85 })).json();
    assert.equal(catalog.players[0].price, 20000); assert.equal(calls[3].searchParams.get('fc26_only'), 'true'); assert.equal(calls[3].searchParams.has('fc27_only'), false);
    const statusText = await (await fetch(base + 'status')).text(); assert.ok(!statusText.includes('test_key_123456789')); assert.equal(JSON.parse(statusText).connected, true);
    const blockedHost = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(base + 'status', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(blockedHost, 403);
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); });
    // Yalnızca bu testin oluşturduğu, doğrulanmış geçici klasör temizlenir.
    assert.ok(root.startsWith(path.join(tmpdir(), 'fut-brain-parse-test-')));
    rmSync(root, { recursive: true, force: true });
  }
});
