import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';

test('HTTP SBC: kayıtlı koşullar ücretsiz okunur; hafif liste veya kota koşulları silmez', async () => {
  let calls = 0;
  const detailed = { page: 1, sbcs: [{ id: '45', name: 'Marquee Matchups', url: 'https://www.futbin.com/27/squad-building-challenge/45', expires: '4 days', challenges: [{ id: '79', name: 'Bayern v Leipzig', requirements: ['# of players in squad: 11'] }] }] };
  const { app, client } = createApp({ keyOverride: () => 'test-only-key', transport: async url => {
    calls++; const data = String(url).includes('get_fc27_sbcs_list') ? { ...detailed, sbcs: detailed.sbcs.map(({ challenges, ...set }) => set) } : detailed;
    return new Response(JSON.stringify({ status: 'success', data }));
  } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/parse/`;
  const post = (route: string, body: unknown, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await (await fetch(base + 'sbcs/saved?year=27')).json()).page, null); assert.equal(calls, 0);
    assert.equal((await post('sbcs', { year: '27', detailed: true })).status, 200);
    const detail = client.peekSaved('get_fc27_sbcs', { page: '1', active_only: 'true' })!;
    detail.expires = 0; detail.fetchedAt = new Date(Date.now() - 600000).toISOString();
    const list = await (await post('sbcs', { year: '27', detailed: false })).json();
    assert.equal(list.sets[0].segments[0].id, '79'); assert.equal(list.sets[0].detailsFetchedAt, detail.fetchedAt); assert.equal(list.credits, 1);
    client.creditsAttempted = 20;
    const saved = (await (await fetch(base + 'sbcs/saved?year=27')).json()).page;
    assert.equal(saved.credits, 0); assert.equal(saved.cached, true); assert.equal(saved.sets[0].segments[0].id, '79'); assert.equal(calls, 2);
    assert.equal((await post('sbcs', { year: '27', detailed: true })).status, 429); assert.equal(calls, 2);
    assert.equal((await fetch(base + 'sbcs/saved?year=29')).status, 400);
    assert.equal((await fetch(base + 'sbcs/saved?year=27', { headers: { Origin: 'https://evil.example' } })).status, 403);
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
});

test('HTTP bütçe: sınırı değiştirmek çağrı yapmaz ve kullanımı sıfırlamaz', async () => {
  let calls = 0;
  const { app, client } = createApp({ keyOverride: () => 'test-only-key', transport: async () => { calls++; throw new Error('Çağrı olmamalı'); } });
  client.creditsAttempted = 16;
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/parse/budget`;
  const post = (body: unknown, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    for (const creditLimit of [0, 19, 1001, 20.5, '100', null]) assert.equal((await post({ creditLimit })).status, 400);
    assert.equal((await post({ creditLimit: 100 }, { Origin: 'https://evil.example' })).status, 403);
    const status = await (await post({ creditLimit: 60 })).json();
    assert.equal(status.sessionCreditLimit, 60); assert.equal(status.creditsAttempted, 16); assert.equal(calls, 0);
    client.pending.set('test', Promise.resolve()); assert.equal((await post({ creditLimit: 80 })).status, 409); assert.equal(client.sessionCreditLimit, 60);
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }
});
