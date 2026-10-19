import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { readEaPlayerEvolutions } from './src/eaEvolutionAdapter.ts';
import { normalizeEaEvolutions, validEaEvolutionId, EaEvolutionDataError } from '../src/services/eaEvolutions.ts';
function fixture() {
  const calls: string[] = [];
  const observable = (data: any) => ({ observe: (_: any, callback: any) => queueMicrotask(() => callback(null, { success: true, data })), unobserve() {} });
  const item: any = { id: 123456, definitionId: 16777217, rating: 78, databaseId: 1, isPlayer: () => true, isGK: () => false, concept: false };
  const rule = { attribute: 0, scope: 0, targets: [80], isValid: true, meetsRequirements: (p: any) => p.rating <= 80 };
  const slot: any = { id: 59, slotName: 'Canlı Evolution', hidden: false, isAvailable: () => true, isStarted: () => false, hasEnrollmentExpired: () => false, hasEndTimeExpired: () => false, isOnCooldown: () => false, isMultiChoice: false, eligibilityRequirements: [rule], endTimePurchaseVisibility: Math.floor(Date.now() / 1000) + 3600, getPrice: () => 0, levels: [{ id: 1, awards: [{ type: 9, value: 4, maxValue: 80 }] }, { id: 2, awards: [{ type: 9, value: 10, maxValue: 83 }] }] };
  const g: any = { GAME_NAME: 'fc27', AcademyStatEnum: { OVR: 9 }, AcademyEligibilityAttribute: { 0: 'OVR' }, AcademyEligibilityScope: { 0: 'MAX' }, GameCurrency: { COINS: 'COINS', POINTS: 'POINTS' }, UTAcademySlotSearchCriteriaDTO: class {}, services: {
    Squad: { requestSquadList: () => observable({ activeSquadId: 1 }), requestSquadById: () => observable({ squad: { getPlayers: () => [{ isValid: () => true, getItem: () => item }] } }) },
    Academy: { requestAcademyHub: () => { calls.push('hub'); return observable({ slots: [slot], availableSlotsCount: 1, categories: [{ id: 3 }] }); }, requestSlotsByCategory: (criteria: any) => { calls.push(`category:${criteria.categoryId}:${criteria.offset}`); return observable({ slots: [slot] }); }, getSlotPreview: (slotId: string | number, playerId: number) => { assert.equal(slotId, slot.id); assert.equal(playerId, item.id); calls.push('preview'); return observable({ updatedSlot: { levels: [{ id: 2, boostedPlayer: { rating: 83, databaseId: 1, isPlayer: () => true, getAttributes: () => [80, 79, 78, 77, 76, 75], getPlayStyles: () => [{ traitId: 17, isIcon: true }] } }] } }); } }
  } };
  return { g, item, slot, rule, calls };
}
async function readData(g: any) { const result = await readEaPlayerEvolutions('123456', undefined, g); assert.ok(result.ok); return normalizeEaEvolutions(result.evolutions); }
test('EA EVO: güncel kart şartları yerel tahmin yerine EA kuralıyla denetlenir; seviye tavanları korunur', async () => {
  const { g, calls } = fixture(), result = await readEaPlayerEvolutions('123456', undefined, g);
  assert.equal(result.ok, true); const data = normalizeEaEvolutions(result.evolutions);
  assert.equal(data.programs.length, 1); assert.equal(data.programs[0].eligible, true); assert.equal(data.programs[0].finalRating, 83);
  assert.deepEqual(calls, ['hub', 'category:3:0']); assert.equal(data.rating, 78); assert.equal(data.definitionId, 16777217);
  assert.ok(!JSON.stringify(data).includes('services'));
});
test('EA EVO: önizleme yalnız uygun ve sahip olunan kartta çalışır; son EA özellikleri alınır', async () => {
  const mock = fixture(), result = await readEaPlayerEvolutions('123456', '59', mock.g);
  assert.ok(result.ok); const data = normalizeEaEvolutions(result.evolutions); assert.equal(data.preview?.rating, 83); assert.equal(data.preview?.stats?.[0], 80); assert.deepEqual(data.preview?.playStyles, ['PS 17+']);
  mock.item.rating = 81; assert.equal((await readEaPlayerEvolutions('123456', '59', mock.g)).ok, false);
  assert.equal(mock.calls.filter(c => c === 'preview').length, 1);
  mock.item.concept = true; assert.equal((await readEaPlayerEvolutions('123456', undefined, mock.g)).ok, false);
  assert.equal((await readEaPlayerEvolutions('654321', undefined, mock.g)).ok, false);
});
test('EA EVO: süresi dolmuş, aktif ve beklemedeki programlar önerilmez; bilinmeyen kural uygun sayılmaz', async () => {
  for (const change of [(s: any) => s.hidden = true, (s: any) => s.hasEnrollmentExpired = () => true, (s: any) => s.isStarted = () => true, (s: any) => s.isOnCooldown = () => true]) {
    const mock = fixture(); change(mock.slot); const data = await readData(mock.g); assert.equal(data.programs.length, 0);
  }
  const mock = fixture(); mock.rule.isValid = false; mock.slot.isMultiChoice = true;
  const data = await readData(mock.g);
  assert.equal(data.programs[0].eligible, null); assert.equal(data.programs[0].finalRating, null);
});
test('EA EVO: kategori taraması sınırlıdır ve kısmi sonuç tam kapsam diye sunulmaz', async () => {
  const mock = fixture();
  mock.g.services.Academy.requestSlotsByCategory = () => { mock.calls.push('page'); return { observe: (_: any, cb: any) => queueMicrotask(() => cb(null, { success: true, data: { slots: Array(20).fill(mock.slot) } })), unobserve() {} }; };
  const data = await readData(mock.g);
  assert.equal(mock.calls.filter(c => c === 'page').length, 12); assert.equal(data.partial, true);
});
test('EA EVO: derlenmiş MAIN okuyucusu dış yardımcı olmadan çalışır; ek özel alanlar ayıklanır', async () => {
  const compiled = await build({ entryPoints: ['extension/src/eaEvolutionAdapter.ts'], bundle: true, write: false, format: 'iife', globalName: 'adapter', target: 'chrome120' });
  const first: any = {}; runInNewContext(compiled.outputFiles[0].text, first);
  const mock = fixture(), injected = runInNewContext(`(${first.adapter.readEaPlayerEvolutions.toString()})`, { window: mock.g, setTimeout, clearTimeout });
  const result = await injected('123456'); result.evolutions.secret = 'private-secret';
  const data = normalizeEaEvolutions(result.evolutions); assert.ok(!JSON.stringify(data).includes('private-secret'));
  const bad = structuredClone(data); bad.programs[0].checks[0].satisfied = false;
  assert.throws(() => normalizeEaEvolutions(bad));
});

test('EA EVO: UUID program kimliği liste ve önizlemede değişmeden taşınır; yol enjeksiyonu reddedilir', async () => {
  const mock = fixture(), id = 'c44c3c89-41e9-4e98-a13a-e4c432d221ab'; mock.slot.id = id;
  const result = await readEaPlayerEvolutions('123456', id, mock.g); assert.ok(result.ok);
  const data = normalizeEaEvolutions(result.evolutions); assert.equal(data.programs[0].id, id); assert.equal(data.preview?.programId, id);
  for (const bad of ['../secret', 'x?token=a', 'x/y', '', 'x'.repeat(81), 'a%2fb']) {
    assert.equal(validEaEvolutionId(bad), false); assert.equal((await readEaPlayerEvolutions('123456', bad, mock.g)).ok, false);
  }
  const invalid = structuredClone(data); invalid.programs[0].id = '../secret';
  assert.throws(() => normalizeEaEvolutions(invalid), error => error instanceof EaEvolutionDataError && error.message.includes('EVO-DATA-02'));
});

test('EA EVO: başarısız hizmet hangi aşamada durduğunu bildirir; ham hata veya oturum verisi dönmez', async () => {
  const mock = fixture(); mock.g.services.Academy.requestAcademyHub = () => { throw new Error('private-secret'); };
  const result = await readEaPlayerEvolutions('123456', undefined, mock.g); assert.ok(!result.ok); assert.match(result.message, /EVO-HUB/); assert.ok(!JSON.stringify(result).includes('private-secret'));
});
