import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItemScoreData, normalizeItemScoreRequest, scorePricePool, scoreCandidates, solveItemScore } from './itemScore.ts';
import type { Player } from '../types/index.ts';
import type { ItemScoreData } from './itemScore.ts';
const now = Date.now();
function player(id: string, price: number, rating = 80): Player {
  return { id, name: id, commonName: id, rating, price, gameYear: '27', pricePlatform: 'pc', priceStatus: 'LIVE', priceUpdatedAt: new Date(now).toISOString(), cardType: 'BASE', isSpecial: false, inClub: false } as Player;
}
function data(target: number, points: number[], submitted = 0): ItemScoreData {
  // Bunlar algoritma örnekleridir; gerçek oyunun puan tablosu değildir.
  return { target, submitted, observedAt: new Date(now).toISOString(), setName: 'Johan Manzambi', unmatched: 0, cards: points.map((score, i) => ({ key: String(i), definitionId: 100 + i, rating: 80, score })) };
}
test('Item Score: şema sınırları, tekil kartlar ve özel alanların ayıklanması', () => {
  const sample: any = data(5000, [500, 900]); sample.secret = 'private'; sample.cards[0].secret = 'private';
  assert.ok(!JSON.stringify(normalizeItemScoreData(sample)).includes('private'));
  for (const mutate of [(s: any) => s.target = 100001, (s: any) => s.submitted = -1, (s: any) => s.submitted = Number.MAX_VALUE, (s: any) => s.cards[0].score = 0, (s: any) => s.cards[1].key = s.cards[0].key, (s: any) => s.unmatched = 61, (s: any) => s.observedAt = 123]) {
    const bad = structuredClone(sample); mutate(bad); assert.throws(() => normalizeItemScoreData(bad));
  }
  const request: any = { setName: 'Manzambi', segmentName: 'Manzambi', secret: 'private', cards: [{ key: '1', name: 'Player', commonName: '', rating: 80, secret: 'private' }] };
  assert.ok(!JSON.stringify(normalizeItemScoreRequest(request)).includes('private'));
  request.cards.push(request.cards[0]); assert.throws(() => normalizeItemScoreRequest(request));
});
test('Item Score: eski, yanlış platform/yıl, özel ve kulüp kartları öneri havuzuna girmez', () => {
  const good = player('good', 700), excluded = [
    { ...good, id: 'ps', pricePlatform: 'ps' }, { ...good, id: 'old-year', gameYear: '26' },
    { ...good, id: 'old', priceUpdatedAt: new Date(now - 31 * 60000).toISOString() },
    { ...good, id: 'future', priceUpdatedAt: new Date(now + 120000).toISOString() },
    { ...good, id: 'free', price: 0 }, { ...good, id: 'demo', priceStatus: 'DEMO' },
    { ...good, id: 'special', isSpecial: true }, { ...good, id: 'club', inClub: true },
  ] as Player[];
  assert.deepEqual(scorePricePool([good, ...excluded], '27', 'pc', now).map(p => p.id), ['good']);
  const candidates = scoreCandidates(Array.from({ length: 80 }, (_, i) => player(String(i), 500 + i, 75 + Math.floor(i / 5))));
  assert.ok(candidates.some(p => p.rating === 90)); assert.ok(candidates.length <= 60);
  for (const rating of new Set(candidates.map(p => p.rating))) assert.ok(candidates.filter(p => p.rating === rating).length <= 3);
  const mixed = scoreCandidates([player('c1', 400), player('c2', 450), player('c3', 500), { ...player('rare', 600), cardType: 'GOLD_RARE' }]);
  assert.ok(mixed.some(p => p.id === 'rare'));
});
test('Item Score: 5.000 puan, kısmi teslim ve puan aşımı en ucuz doğrulanmış sepetle çözülür', () => {
  const pool = [player('0', 700), player('1', 1100), player('2', 650)];
  const plan = solveItemScore(data(5000, [500, 900, 500]), pool)!;
  assert.equal(plan.coins, 6150); assert.equal(plan.score, 5000);
  assert.ok(plan.rows.every(r => r.player.id !== '0'));
  const partial = solveItemScore(data(5000, [500, 900, 500], 4500), pool)!;
  assert.equal(partial.coins, 650); assert.equal(partial.score, 500);
  const overshoot = solveItemScore(data(501, [500, 900, 500]), pool)!;
  assert.equal(overshoot.coins, 1100); assert.equal(overshoot.score, 900);
  assert.equal(solveItemScore(data(5000, []), pool), null);
  assert.equal(solveItemScore(data(5000, [], 5000), pool)?.coins, 0);
});
test('Item Score: küçük havuzda dinamik çözüm tüm adet kombinasyonlarıyla aynı en düşük maliyeti verir', () => {
  for (let target = 1; target <= 36; target++) {
    const scores = [3, 7, 11], prices = [5, 9, 16], pool = prices.map((p, i) => player(String(i), p));
    let expected = Infinity;
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 6; b++) for (let c = 0; c <= 4; c++) if (a * 3 + b * 7 + c * 11 >= target) expected = Math.min(expected, a * 5 + b * 9 + c * 16);
    const plan = solveItemScore(data(target, scores), pool)!;
    assert.equal(plan.coins, expected, String(target)); assert.ok(plan.score >= target);
    assert.equal(plan.coins, plan.rows.reduce((n, r) => n + r.player.price * r.quantity, 0));
  }
});
