import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParseClient } from './parseClient.ts';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const success = () => new Response(JSON.stringify({ status: 'success', data: { players: [] } }));
const valid = (data: any) => { assert.ok(Array.isArray(data.players)); };

test('Önbellek ve kredi sayacı yeniden başlatmada korunur, anahtar diske sızmaz', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fut-brain-cache-test-')), file = path.join(root, 'cache.json');
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; return success(); };
  try {
    const first = new ParseClient(() => 'test-secret-987654', transport, file);
    await first.request('get_players', { page: '1' }, valid);
    assert.ok(!readFileSync(file, 'utf8').includes('test-secret-987654'));
    const restored = new ParseClient(() => 'test-secret-987654', transport, file);
    assert.equal(restored.status().creditsAttempted, 1); assert.equal(restored.status().connected, true);
    assert.equal((await restored.request('get_players', { page: '1' }, valid)).cached, true); assert.equal(calls, 1);
    restored.setCreditLimit(60);
    const configured = new ParseClient(() => 'test-secret-987654', transport, file, 50);
    assert.equal(configured.sessionCreditLimit, 60); assert.equal(configured.creditsAttempted, 1); assert.equal(calls, 1);
    restored.setCreditLimit(20);
    restored.creditsAttempted = 20; restored.persist();
    const capped = new ParseClient(() => 'test-secret-987654', transport, file);
    await assert.rejects(capped.request('get_players', { page: '2' }, valid), /20 kredilik/); assert.equal(calls, 1);
    const changed = new ParseClient(() => 'different-key', transport, file);
    assert.equal(changed.cache.size, 0); assert.equal(changed.status().creditsAttempted, 0);
    capped.budgetStartedAt = Date.now() - 86400001;
    assert.equal(capped.status().creditsAttempted, 0);
  } finally { assert.ok(root.startsWith(path.join(tmpdir(), 'fut-brain-cache-test-'))); rmSync(root, { recursive: true, force: true }); }
});

test('Süresi dolan kayıt 24 saatlik arşivde korunur; taze önbellek sayılmaz', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fut-brain-cache-test-')), file = path.join(root, 'cache.json');
  let calls = 0; const transport: typeof fetch = async () => { calls++; return success(); };
  try {
    const client = new ParseClient(() => 'archive-key', transport, file);
    await client.request('get_players', { page: '1' }, valid);
    for (const value of client.cache.values()) { value.expires = 0; value.fetchedAt = new Date(Date.now() - 600000).toISOString(); }
    client.persist(); const restored = new ParseClient(() => 'archive-key', transport, file);
    assert.equal(restored.peek('get_players', { page: '1' }), null); assert.ok(restored.peekSaved('get_players', { page: '1' })); assert.equal(calls, 1);
    for (const value of restored.cache.values()) value.fetchedAt = new Date(Date.now() - 86400001).toISOString();
    assert.equal(restored.peekSaved('get_players', { page: '1' }), null);
  } finally { assert.ok(root.startsWith(path.join(tmpdir(), 'fut-brain-cache-test-'))); rmSync(root, { recursive: true, force: true }); }
});

test('Anahtar yokken dış çağrı yapılmaz ve bağlı görünmez', async () => {
  let calls = 0;
  const client = new ParseClient(() => '', async () => { calls++; return success(); });
  await assert.rejects(client.request('get_players', {}, valid), /anahtarını ekleyin/);
  assert.equal(calls, 0); assert.equal(client.status().connected, false); assert.equal(client.status().creditsAttempted, 0);
});
test('Anahtar yalnızca başlıkta; eşzamanlı aynı istek birleştirilir ve önbellek kredi harcamaz', async () => {
  let calls = 0;
  const client = new ParseClient(() => 'test-secret', async (url, init) => {
    calls++; assert.equal(new URL(String(url)).hostname, 'api.parse.bot'); assert.ok(!String(url).includes('test-secret'));
    assert.equal((init?.headers as Record<string, string>)['X-API-Key'], 'test-secret');
    await new Promise(resolve => setTimeout(resolve, 5)); return success();
  });
  await Promise.all([client.request('get_players', { page: '1' }, valid), client.request('get_players', { page: '1' }, valid)]);
  assert.equal(calls, 1); assert.equal(client.status().creditsAttempted, 1);
  const cached = await client.request('get_players', { page: '1' }, valid);
  assert.equal(cached.cached, true); assert.equal(cached.credits, 0); assert.equal(client.status().connected, true);
});
test('Bozuk başarı, kota ve yetki hatalarında örnek başarı üretilmez; hata gövdesi gizlenir', async () => {
  for (const response of [new Response('test-secret', { status: 401 }), new Response('test-secret', { status: 429 }), new Response('{broken'), new Response(JSON.stringify({ status: 'error', data: { players: [] }, error: 'test-secret' }))]) {
    const client = new ParseClient(() => 'test-secret', async () => response);
    await assert.rejects(client.request('get_players', {}, valid), e => !String(e).includes('test-secret'));
    assert.equal(client.cache.size, 0); assert.equal(client.status().connected, false);
  }
});
test('Dakikalık istek ve sunucu oturumu kredi sınırı uygulanır', async () => {
  let calls = 0;
  const client = new ParseClient(() => 'key', async () => { calls++; return success(); });
  for (let i = 0; i < 5; i++) await client.request('get_players', { page: String(i + 1) }, valid);
  await assert.rejects(client.request('get_players', { page: '6' }, valid), /Dakikada 5/);
  assert.equal(calls, 5);
  client.requests = []; client.creditsAttempted = 19;
  await assert.rejects(client.request('search_players_fc27', { query: 'Haaland' }, valid), /20 kredilik/);
  assert.equal(calls, 5);
});
test('İzin verilmeyen uç nokta ve zaman aşımı otomatik tekrarlanmaz', async () => {
  let calls = 0;
  const client = new ParseClient(() => 'key', async () => { calls++; throw new DOMException('test-secret', 'TimeoutError'); });
  await assert.rejects(client.request('../other', {}, valid), /desteklenmiyor/);
  await assert.rejects(client.request('__proto__', {}, valid), /desteklenmiyor/);
  await assert.rejects(client.request('get_players', {}, valid), /zaman aşımına/);
  assert.equal(calls, 1);
});
test('Anahtar değiştirilince eski önbellek ve doğrulama temizlenir', async () => {
  let key = 'first';
  const client = new ParseClient(() => key, async () => success());
  await client.request('get_players', {}, valid);
  key = 'second'; client.resetConnection();
  assert.equal(client.cache.size, 0); assert.equal(client.status().connected, false);
});
test('Aynı başarısız isteğin hızlı tekrarı yeniden kredi tüketmez', async () => {
  let calls = 0;
  const client = new ParseClient(() => 'key', async () => { calls++; return new Response('{}', { status: 503 }); });
  await assert.rejects(client.request('search_players_fc27', { query: 'Messi' }, valid));
  await assert.rejects(client.request('search_players_fc27', { query: 'Messi' }, valid), /yeni ücretli çağrı yapılmayacak/);
  assert.equal(calls, 1); assert.equal(client.creditsAttempted, 3);
});
