import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localGoldConcept, supportsLocalGold, goldCatalogPlan } from './localGoldConcept.ts';
import { normalizePlayer } from './parseAdapter.ts';
import { normalizeSbcPage } from './sbcData.ts';
import { createEaPlan, validateEaPlan, isCurrentBridgeVersion } from './eaBridgeProtocol.ts';
function task() {
  const page = normalizeSbcPage({ sbcs: [{ id: '63', name: '3× 79+ Upgrade', url: 'https://www.futbin.com/27/squad-building-challenge/63', expires: '1 days', challenges: [{ id: '99', name: '3× 79+ Upgrade', requirements: ['Player Level: Exactly Gold', '# of players in squad: 10'] }] }] }, '27', true, true, { cached: true, credits: 0, fetchedAt: new Date().toISOString() });
  return { set: page.sets[0], segment: page.sets[0].segments[0] };
}
const pool = () => Array.from({ length: 12 }, (_, i) => normalizePlayer({ id: String(100 + i), name: `Gold ${i}`, rating: 75 + i, position: 'CM', version: 'Normal', price_pc: 500 + i * 100, price_ps: 999999 }, '27', 'pc', new Date().toISOString())!);
test('10 altın: yalnız iki doğrulanmış koşulda çalışır, PC fiyatından 10 ucuz tekil kart seçer', () => {
  const { set, segment } = task(); assert.equal(supportsLocalGold(set, segment), true);
  const result = localGoldConcept(set, segment, pool(), 'pc'); assert.equal(result.players.length, 10); assert.equal(result.totalCost, 9500); assert.equal(result.platform, 'pc'); assert.equal(result.rating, null); assert.equal(result.chemistry, null);
  assert.equal(createEaPlan(result).placement, 'OPEN_SLOTS'); assert.equal(createEaPlan(result).players.length, 10);
  const changed = structuredClone(segment); changed.rules.raw.push('Team Chemistry: Min 10'); assert.equal(supportsLocalGold(set, changed), false);
});
test('10 altın: eksik, özel, yanlış platform, sahip olunan ve fiyatı bilinmeyen kartlarla çözüm uydurulmaz', () => {
  const { set, segment } = task();
  for (const modify of [(p: any[]) => p.splice(0, 3), (p: any[]) => p.forEach(c => c.isSpecial = true), (p: any[]) => p.forEach(c => c.inClub = true), (p: any[]) => p.forEach(c => c.price = 0), (p: any[]) => p.forEach(c => c.pricePlatform = 'ps')]) { const cards = pool(); modify(cards); assert.throws(() => localGoldConcept(set, segment, cards, 'pc')); }
});
test('10 altın: EA kataloğu planı ücret veya kaynak kart kimliği uydurmaz', () => {
  const { set, segment } = task(), plan = goldCatalogPlan(set, segment, 'pc');
  assert.equal(plan.catalogGold, true); assert.deepEqual(plan.players, []); assert.equal(plan.formation, 'EA');
  assert.throws(() => validateEaPlan({ ...plan, placement: undefined }));
  assert.equal(isCurrentBridgeVersion('0.1.0'), false); assert.equal(isCurrentBridgeVersion('0.2.0'), false); assert.equal(isCurrentBridgeVersion('0.2.1'), false); assert.equal(isCurrentBridgeVersion('0.2.2'), false); assert.equal(isCurrentBridgeVersion('0.3.0'), false); assert.equal(isCurrentBridgeVersion('0.3.1'), false); assert.equal(isCurrentBridgeVersion('0.3.2'), false); assert.equal(isCurrentBridgeVersion('0.3.3'), false); assert.equal(isCurrentBridgeVersion('0.3.4'), true); assert.equal(isCurrentBridgeVersion('1.0.0'), true);
});
