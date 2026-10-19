import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { importEaConcept } from './src/eaAdapter.ts';
import { fixturePlan, eaRuntime } from './fixtures.ts';
import { validateEaPlan } from '../src/services/eaBridgeProtocol.ts';

test('EA: farklı kaynak kimliklerini eşler, tek toplu arama ve tek taslak kaydı yapar', async () => {
  const plan = fixturePlan(), { g, stats, slots } = eaRuntime(plan);
  const result = await importEaConcept(plan, false, g);
  assert.equal(result.ok, true); assert.equal(result.saved, true); assert.equal(result.rating, 65); assert.equal(result.chemistry, 21);
  assert.equal(stats.searches, 1); assert.equal(stats.saves, 1); assert.equal(stats.opened, 1);
  assert.ok(slots.slice(0, 11).every(s => s.item.concept && s.item.definitionId >= 2000));
});
test('EA: zaten kurulmuş aynı konsept kadro için tekrar arama/kaydetme yapmaz', async () => {
  const plan = fixturePlan(), { g, stats, slots, cards } = eaRuntime(plan); slots.slice(0, 11).forEach((s, i) => { s.item = cards[i]; });
  const result = await importEaConcept(plan, false, g);
  assert.equal(result.alreadyPlaced, true); assert.equal(stats.saves, 0); assert.equal(stats.searches, 0); assert.equal(stats.mutations, 0);
});
test('EA: mevcut gerçek kartı izinsiz değiştirmez; açık onayla yalnızca saha slotlarını değiştirir', async () => {
  const plan = fixturePlan(), { g, stats, slots } = eaRuntime(plan), owned = { id: 123, definitionId: 777, concept: false };
  slots[0].item = owned; slots[15].item = owned;
  assert.equal((await importEaConcept(plan, false, g)).requiresOverwrite, true); assert.equal(stats.mutations, 0); assert.equal(stats.searches, 0);
  assert.equal((await importEaConcept(plan, true, g)).ok, true); assert.equal(slots[15].item, owned); assert.equal(stats.saves, 1);
});
test('EA: eşleşmeyen/tekil olmayan kart, özel sürüm, yanlış oyun ve diziliş yazmayı engeller', async () => {
  for (const scenario of ['missing', 'ambiguous', 'special', 'owned', 'year', 'formation', 'requirements', 'locked']) {
    const plan = fixturePlan(), { g, stats, cards, catalog, squad, slots } = eaRuntime(plan);
    if (scenario === 'missing') catalog.pop();
    if (scenario === 'ambiguous') catalog.push({ ...catalog[0], id: 9999 });
    if (scenario === 'special') cards[0].isSpecial = () => true;
    if (scenario === 'owned') cards[0].concept = false;
    if (scenario === 'year') g.GAME_NAME = 'fc26';
    if (scenario === 'formation') squad.getFormation = () => ({ name: '4-4-2' });
    if (scenario === 'requirements') stats.conditions = false;
    if (scenario === 'locked') slots[0].isBrick = () => true;
    assert.equal((await importEaConcept(plan, false, g)).ok, false, scenario); assert.equal(stats.saves, 0, scenario);
    assert.ok(slots.every(s => !s.item), scenario);
  }
});
test('EA: arama sırasında kullanıcı kadroyu değiştirirse yazmaz', async () => {
  const plan = fixturePlan(), { g, stats, slots } = eaRuntime(plan), owned = { id: 1, concept: false };
  stats.searchHook = () => { slots[0].item = owned; };
  assert.equal((await importEaConcept(plan, false, g)).code, 'EA_DRAFT_CHANGED'); assert.equal(stats.saves, 0); assert.equal(slots[0].item, owned);
});
test('EA: kaydetme hatasında belirsizliği bildirir, yerel taslağı geri alır ve otomatik tekrar yapmaz', async () => {
  const plan = fixturePlan(), { g, stats, slots } = eaRuntime(plan); stats.saveFails = true;
  const result = await importEaConcept(plan, false, g);
  assert.equal(result.ok, false); assert.equal(result.mayHaveSaved, true); assert.equal(stats.saves, 1); assert.ok(slots.every(s => !s.item));
});
test('EA: başka aktarımın kilidini kaldırmaz', async () => {
  const { g } = eaRuntime(); g.__futBrainImportBusy = true;
  assert.equal((await importEaConcept(fixturePlan(), false, g)).code, 'EA_BUSY'); assert.equal(g.__futBrainImportBusy, true);
});
test('EA: enjekte edilen fonksiyon dış modül yardımcıları olmadan çalışır', async () => {
  const plan = fixturePlan(), { g, stats } = eaRuntime(plan);
  const fn = runInNewContext(`(${importEaConcept.toString()})`, { window: g, setTimeout, clearTimeout });
  assert.equal((await fn(plan)).ok, true); assert.equal(stats.saves, 1);
});

test('EA: 10 altın kartı açık slotlara kurar, kilitli slotu ve yedekleri korur', async () => {
  const original = fixturePlan(); original.players.forEach(p => { p.rating += 20; });
  const mock = eaRuntime(original), brick = { id: 987, definitionId: 0 }, bench = { id: 777, definitionId: 555 };
  mock.slots[5].isBrick = () => true; mock.slots[5].item = brick; mock.slots[15].item = bench;
  const plan = validateEaPlan({ ...original, placement: 'OPEN_SLOTS', platform: 'pc', formation: 'EA', players: original.players.slice(0, 10).map(p => ({ ...p, slot: 'AUTO' })) });
  const result = await importEaConcept(plan, false, mock.g);
  assert.equal(result.ok, true); assert.equal(result.playerCount, 10); assert.equal(mock.stats.saves, 1);
  assert.equal(mock.slots[5].item, brick); assert.equal(mock.slots[15].item, bench);
});
test('EA: ücretsiz katalog seçimi 10 tekil standart altın kart kurar; yanlış açık slot sayısında yazmaz', async () => {
  const original = fixturePlan(); original.players.forEach(p => { p.rating += 20; });
  const plan = validateEaPlan({ ...original, placement: 'OPEN_SLOTS', catalogGold: true, formation: 'EA', players: [] });
  const mock = eaRuntime(original); mock.slots[5].isBrick = () => true;
  assert.equal((await importEaConcept(plan, false, mock.g)).ok, true); assert.equal(mock.stats.saves, 1);
  const invalid = eaRuntime(original); assert.equal((await importEaConcept(plan, false, invalid.g)).code, 'EA_LOCKED_SLOTS'); assert.equal(invalid.stats.mutations, 0);
});
test('EA: gerçek setPlayers boş değerleri atladığında hata geri alımı yeni kartları temizler', async () => {
  const plan = fixturePlan(), mock = eaRuntime(plan); mock.stats.conditions = false;
  mock.squad.setPlayers = (items: any[]) => { mock.stats.mutations++; mock.slots.forEach((slot, i) => { if (items[i] && !slot.isBrick()) slot.item = items[i]; }); };
  assert.equal((await importEaConcept(plan, false, mock.g)).code, 'EA_REQUIREMENTS_FAILED');
  assert.ok(mock.slots.every(s => !s.item)); assert.equal(mock.stats.saves, 0);
});
