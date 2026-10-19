import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeWorker, publicResult } from './src/bridgeWorker.ts';
import { fixturePlan } from './fixtures.ts';
import { validateEaPlan, isEaUrl, isSiteUrl, BRIDGE_TTL, EA_WEB_URL } from '../src/services/eaBridgeProtocol.ts';

test('Köprü: sadece tanımlı yerel adresleri ve resmi EA yolunu kabul eder', () => {
  assert.equal(isSiteUrl('http://127.0.0.1:3000/#sbc-solver'), true);
  for (const url of ['http://localhost:4000', 'http://localhost.evil:3000', 'https://localhost:3000', 'https://evil.example']) assert.equal(isSiteUrl(url), false);
  assert.equal(isEaUrl(EA_WEB_URL), true); assert.equal(isEaUrl('https://www.ea.com.evil/ea-sports-fc/ultimate-team/web-app/'), false); assert.equal(isEaUrl('https://www.ea.com/other'), false);
});
test('Köprü: geçersiz, eski, özel, eksik ve tekrarlı kadroları reddeder; ek alanları taşımaz', () => {
  const plan: any = fixturePlan(); plan.apiKey = 'fake-secret'; plan.players[0].token = 'fake-token';
  assert.ok(!JSON.stringify(validateEaPlan(plan)).includes('fake-'));
  for (const edit of [(p: any) => p.players.pop(), (p: any) => p.players[0].cardVersion = 'TOTW', (p: any) => p.createdAt -= BRIDGE_TTL + 1, (p: any) => p.createdAt += 120000, (p: any) => p.players[1].futbinId = p.players[0].futbinId, (p: any) => p.mode = 'SUBMIT', (p: any) => p.platform = 'pc']) {
    const bad = fixturePlan(); edit(bad); assert.throws(() => validateEaPlan(bad));
  }
  assert.deepEqual(publicResult({ ok: true, code: 'PLACED', message: 'Hazır', token: 'fake' }), { ok: true, code: 'PLACED', message: 'Hazır' });
});
function workerFixture() {
  const storage: any = {}, messages: any[] = [], executions: any[] = [];
  const site: any = { id: 'test-extension', frameId: 0, url: 'http://127.0.0.1:3000/', tab: { id: 3, url: 'http://127.0.0.1:3000/' } };
  const ea: any = { id: 'test-extension', frameId: 0, url: EA_WEB_URL, tab: { id: 6, url: EA_WEB_URL } };
  const api: any = { runtime: { id: 'test-extension', getManifest: () => ({ version: '0.1.0' }) }, storage: { session: { get: async () => storage, set: async (v: any) => Object.assign(storage, structuredClone(v)) } }, tabs: { query: async () => [ea.tab], get: async () => site.tab, sendMessage: async (id: number, message: any) => { messages.push({ id, message }); }, update: async () => undefined, create: async () => ea.tab }, scripting: { executeScript: async (args: any) => { executions.push(args); return [{ result: { ok: true, code: 'PLACED', message: 'Hazır', saved: true, playerCount: 11, rating: 65, chemistry: 21 } }]; } } };
  return { handle: createBridgeWorker(api), site, ea, api, storage, messages, executions };
}
test('Köprü: dış sekme ve iframe mesajları reddedilir; yalnız bağlı EA sekmesi çalıştırabilir', async () => {
  const { handle, site, ea, executions } = workerFixture();
  for (const sender of [{ ...site, frameId: 2 }, { ...site, id: 'other' }, { ...site, url: 'https://evil.example' }]) assert.equal((await handle({ type: 'PING' }, sender)).ok, false);
  assert.equal((await handle({ type: 'PING' }, site)).installed, true);
  assert.equal((await handle({ type: 'QUEUE', requestId: 'request-123', plan: fixturePlan() }, site)).queued, true);
  assert.equal((await handle({ type: 'EA_RUN', jobId: 'bad' }, ea)).ok, false);
  assert.equal((await handle({ type: 'EA_RUN', jobId: 'bad' }, site)).ok, false); assert.equal(executions.length, 0);
});
test('Köprü: çift gönderim tek işe dönüşür; aynı iş iki kez kaydedilmez ve son durum siteye döner', async () => {
  const { handle, site, ea, executions, messages, storage } = workerFixture(); const request = { type: 'QUEUE', requestId: 'request-123', plan: fixturePlan() };
  await Promise.all([handle(request, site), handle(request, site)]);
  assert.equal(messages.filter(m => m.message.type === 'SHOW_PLAN').length, 1);
  const jobId = storage.futBrainConceptJob.id;
  await Promise.all([handle({ type: 'EA_RUN', jobId }, ea), handle({ type: 'EA_RUN', jobId }, ea)]);
  assert.equal(executions.length, 1); assert.equal(executions[0].world, 'MAIN'); assert.equal(executions[0].args[1], false);
  assert.equal(messages.find(m => m.message.type === 'EA_RESULT').message.requestId, request.requestId);
});
test('Köprü: taslak değişimi EA tarafında açık onay ister, süre dolunca çalışmaz', async () => {
  const { handle, site, ea, api, executions, storage } = workerFixture();
  api.scripting.executeScript = async (args: any) => { executions.push(args); return [{ result: { ok: false, code: 'EA_DRAFT_EXISTS', message: 'Onay gerekli', requiresOverwrite: true } }]; };
  await handle({ type: 'QUEUE', requestId: 'request-123', plan: fixturePlan() }, site);
  const jobId = storage.futBrainConceptJob.id; await handle({ type: 'EA_RUN', jobId }, ea);
  assert.equal((await handle({ type: 'EA_RUN', jobId, replaceDraft: false }, ea)).ok, false); assert.equal(executions.length, 1);
  await handle({ type: 'EA_RUN', jobId, replaceDraft: true }, ea); assert.equal(executions[1].args[1], true);
  storage.futBrainConceptJob.plan.createdAt -= BRIDGE_TTL + 1;
  assert.equal((await handle({ type: 'EA_RUN', jobId, replaceDraft: true }, ea)).expired, true); assert.equal(executions.length, 2);
});
test('Köprü: tarayıcı çalışan işten dönerse otomatik yeniden yazma başlatmaz', async () => {
  const { handle, site, ea, storage, api, executions } = workerFixture();
  await handle({ type: 'QUEUE', requestId: 'request-123', plan: fixturePlan() }, site);
  storage.futBrainConceptJob.phase = 'working'; const restarted = createBridgeWorker(api);
  assert.equal((await restarted({ type: 'EA_READY' }, ea)).working, true);
  assert.equal((await restarted({ type: 'EA_RUN', jobId: storage.futBrainConceptJob.id }, ea)).ok, false); assert.equal(executions.length, 0);
});
test('Köprü: EA kadro okuması yalnız yerel siteye gider; özel ek alanlar saklanmaz', async () => {
  const { handle, site, ea, api, storage, messages, executions } = workerFixture();
  const card = { id: '1', definitionId: 2000, assetId: 2000, name: 'Test Player', rating: 80, position: 'GK', secondaryPositions: [], positionsKnown: true, concept: false, untradeable: true, special: false, club: '', league: '', nation: '', stats: null, playStyles: [], playStylesKnown: false, token: 'private-secret' };
  const squad = { version: 1, year: '27', squadId: '1', name: 'Ana Kadrom', formation: '4-3-3', observedAt: new Date().toISOString(), rating: 80, chemistry: 20, slots: fixturePlan().players.map((p, i) => ({ index: i, position: p.slot, player: i === 0 ? card : null })), bench: [], email: 'private-secret' };
  api.tabs.query = async ({ url }: any) => typeof url === 'string' ? [ea.tab] : [site.tab, { id: 7, url: 'http://localhost:4000/' }];
  api.scripting.executeScript = async (args: any) => { executions.push(args); return [{ result: { ok: true, squad } }]; };
  const reply = await handle({ type: 'SQUAD_GET' }, site); assert.equal(reply.squad?.formation, '4-3-3'); assert.equal(executions.length, 1);
  assert.ok(!JSON.stringify(storage).includes('private-secret')); assert.ok(messages.some(m => m.id === 3 && m.message.type === 'SQUAD_SYNC')); assert.ok(messages.every(m => m.id !== 7));
  await handle({ type: 'EA_SYNC' }, ea); assert.equal(executions.length, 1);
  assert.equal((await handle({ type: 'EA_SYNC' }, { ...ea, frameId: 1 })).ok, false);
});
test('Köprü: kart doğrulama ve sayfa erişim hataları genel bağlantı mesajında kaybolmaz', async () => {
  const { handle, site, api } = workerFixture();
  const validHeader = { version: 1, year: '27', squadId: '1', name: 'Kadrom', formation: '4-3-3', observedAt: new Date().toISOString(), rating: 80, chemistry: 20, slots: fixturePlan().players.map((p, i) => ({ index: i, position: p.slot, player: i === 0 ? { id: '1', definitionId: 2, assetId: undefined } : null })), bench: [] };
  api.scripting.executeScript = async () => [{ result: { ok: true, squad: validHeader } }];
  const invalid = await handle({ type: 'SQUAD_GET' }, site); assert.equal(invalid.ok, false); assert.match(invalid.message!, /kart kimliği/);
  api.scripting.executeScript = async () => { throw new Error('private-secret'); };
  const unavailable = await handle({ type: 'SQUAD_GET' }, site); assert.equal(unavailable.ok, false); assert.match(unavailable.message!, /okuması başlatılamadı/); assert.ok(!JSON.stringify(unavailable).includes('private-secret'));
});

test('EVO köprüsü: yalnız yerel ana sekme okuyabilir; kimlik eşleşmesi ve kısa önbellek korunur', async () => {
  const { handle, site, ea, api, executions } = workerFixture();
  const data = { version: 1, playerId: '123', definitionId: 2000, rating: 78, observedAt: new Date().toISOString(), partial: false, programs: [], secret: 'private-secret' };
  api.scripting.executeScript = async (args: any) => { executions.push(args); return [{ result: { ok: true, evolutions: data } }]; };
  const request = { type: 'EVO_GET', playerId: '123' };
  assert.equal((await handle(request, ea)).ok, false); assert.equal((await handle(request, { ...site, frameId: 1 })).ok, false);
  assert.equal((await handle({ ...request, playerId: '../secret' }, site)).ok, false); assert.equal(executions.length, 0);
  const reply = await handle(request, site); assert.equal(reply.ok, true); assert.ok(!JSON.stringify(reply).includes('private-secret'));
  assert.deepEqual(executions[0].args, ['123']); assert.equal(executions[0].world, 'MAIN');
  await handle(request, site); assert.equal(executions.length, 1);
  assert.equal((await handle({ ...request, playerId: '124' }, site)).ok, false);
});

test('EVO taşıması: liste çağrısının MAIN argümanları Chrome JSON taşımasına uygun olmalı', async () => {
  const { handle, site, api } = workerFixture();
  api.scripting.executeScript = async ({ args }: any) => {
    // Chrome args içindeki undefined değerini kabul etmez; JSON.stringify bunu gizleyebilir.
    if (args.some((value: any) => value === undefined)) throw new TypeError('Value is unserializable');
    return [{ result: { ok: true, evolutions: { version: 1, playerId: args[0], definitionId: 2000, rating: 78, observedAt: new Date().toISOString(), partial: false, programs: [] } } }];
  };
  assert.equal((await handle({ type: 'EVO_GET', playerId: '123' }, site)).ok, true);
});

test('Puan köprüsü: görev ve kart eşleşir; özel alanlar MAIN’e ve yanıtına taşınmaz', async () => {
  const { handle, site, ea, api, executions } = workerFixture();
  const scoreRequest: any = { setName: 'Johan Manzambi', segmentName: 'Johan Manzambi', secret: 'private-secret', cards: [{ key: '41', name: 'Player', commonName: '', rating: 80, secret: 'private-secret' }] };
  const itemScores: any = { setName: 'Johan Manzambi', target: 5000, submitted: 0, unmatched: 0, observedAt: new Date().toISOString(), secret: 'private-secret', cards: [{ key: '41', definitionId: 12345, rating: 80, score: 321 }] };
  api.scripting.executeScript = async (args: any) => { executions.push(args); return [{ result: { ok: true, itemScores } }]; };
  const request = { type: 'SCORE_GET', scoreRequest };
  assert.equal((await handle(request, ea)).ok, false);
  assert.equal((await handle(request, { ...site, frameId: 1 })).ok, false); assert.equal(executions.length, 0);
  const reply = await handle(request, site); assert.ok(reply.ok);
  assert.equal(executions[0].world, 'MAIN'); assert.equal(executions[0].args.length, 1);
  assert.ok(!JSON.stringify(executions[0].args).includes('private-secret')); assert.ok(!JSON.stringify(reply).includes('private-secret'));
  itemScores.cards[0].key = 'other'; assert.equal((await handle(request, site)).ok, false);
  itemScores.cards[0].key = '41'; itemScores.setName = 'Other SBC'; assert.equal((await handle(request, site)).ok, false);
  scoreRequest.cards.push(scoreRequest.cards[0]); const before = executions.length;
  assert.equal((await handle(request, site)).ok, false); assert.equal(executions.length, before);
});
