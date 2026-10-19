import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { BRIDGE_CHANNEL, EA_WEB_URL } from '../src/services/eaBridgeProtocol.ts';
import { sendRuntimeMessage } from './src/runtimeMessaging.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
async function script(name: string) {
  return (await build({ entryPoints: [`extension/src/${name}.ts`], bundle: true, write: false, format: 'iife', target: 'chrome120' })).outputFiles[0].text;
}
function surface(url: string) {
  const listeners = new Map<string, Set<any>>(), posts: any[] = [], runtimeListeners = new Set<any>();
  let calls = 0, mode = 'valid';
  const runtime: any = { id: 'test-extension', onMessage: { addListener: (fn: any) => runtimeListeners.add(fn), removeListener: (fn: any) => runtimeListeners.delete(fn) }, sendMessage: () => {
    calls++;
    if (mode === 'sync') throw new Error('Extension context invalidated.');
    if (mode === 'async') return Promise.reject(new Error('Extension context invalidated.'));
    if (mode === 'temporary') return Promise.reject(new Error('private-secret'));
    return Promise.resolve({ ok: true, installed: true, version: '0.2.2' });
  } };
  const win: any = { addEventListener: (type: string, fn: any) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(fn); }, removeEventListener: (type: string, fn: any) => listeners.get(type)?.delete(fn), postMessage: (data: any, origin: string) => posts.push({ data, origin }) };
  win.top = win;
  const location = new URL(url);
  const send = (type = 'PING', extra = {}) => {
    const event = { source: win, origin: location.origin, data: { channel: BRIDGE_CHANNEL, direction: 'SITE_TO_EXTENSION', requestId: 'request-123', type }, ...extra };
    for (const listener of listeners.get('message') || []) listener(event);
  };
  return { win, location, runtime, posts, listeners, runtimeListeners, send, calls: () => calls, mode: (next: string) => { mode = next; } };
}

for (const mode of ['sync', 'async']) test(`Site köprüsü: ${mode} bağlam hatası yakalanır, eski bağlantı tekrar işlem göndermez`, async () => {
  const mock = surface('http://127.0.0.1:3000/');
  runInNewContext(await script('siteContent'), { window: mock.win, location: mock.location, chrome: { runtime: mock.runtime }, URL });
  mock.send(); await flush(); assert.equal(mock.posts.at(-1).data.reply.installed, true);
  mock.mode(mode); assert.doesNotThrow(() => mock.send('QUEUE')); await flush();
  assert.equal(mock.posts.at(-1).data.reply.installed, false); assert.match(mock.posts.at(-1).data.reply.message, /sekmelerini yenileyerek/);
  assert.equal(mock.runtimeListeners.size, 0);
  const previous = mock.calls(); mock.send('QUEUE'); mock.send(); await flush(); assert.equal(mock.calls(), previous);
});

test('Site köprüsü: geçici hata bağlantıyı kapatmaz; dış mesajlar iletilmez ve hata ayrıntısı sızmaz', async () => {
  const mock = surface('http://127.0.0.1:3000/');
  runInNewContext(await script('siteContent'), { window: mock.win, location: mock.location, chrome: { runtime: mock.runtime }, URL });
  mock.send('PING', { origin: 'https://evil.example' }); assert.equal(mock.calls(), 0);
  mock.mode('temporary'); mock.send(); await flush(); assert.equal(mock.runtimeListeners.size, 1); assert.ok(!JSON.stringify(mock.posts).includes('private-secret'));
  mock.mode('valid'); mock.send(); await flush(); assert.equal(mock.posts.at(-1).data.reply.installed, true);
});

test('Köprü: runtime kimliği kaybolursa API çağrılmadan bağlantı kapatılır', async () => {
  let retired = 0, calls = 0;
  const api: any = { runtime: { sendMessage: () => { calls++; } } };
  const reply = await sendRuntimeMessage(api, { type: 'PING' }, () => retired++);
  assert.equal(reply.installed, false); assert.equal(retired, 1); assert.equal(calls, 0);
});

test('EA köprüsü: eklenti yenilendiğinde zamanlayıcı ve odak dinleyicisi durur; aktarım tekrarlanmaz', async () => {
  const mock = surface(EA_WEB_URL), timers = new Set<any>();
  const element = () => ({ id: '', style: {}, attachShadow: () => ({ append: () => undefined }), setAttribute: () => undefined });
  runInNewContext(await script('eaContent'), { window: mock.win, location: mock.location, chrome: { runtime: mock.runtime }, URL, document: { hidden: false, createElement: element }, setInterval: (fn: any) => { timers.add(fn); return fn; }, clearInterval: (fn: any) => timers.delete(fn) });
  await flush(); assert.equal(timers.size, 1); assert.equal(mock.listeners.get('focus')?.size, 1);
  mock.mode('sync'); const timer = [...timers][0]; assert.doesNotThrow(timer); await flush();
  assert.equal(timers.size, 0); assert.equal(mock.listeners.get('focus')?.size, 0);
  const previous = mock.calls(); timer(); await flush(); assert.equal(mock.calls(), previous);
});
