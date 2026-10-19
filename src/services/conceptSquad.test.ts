import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConcept, canRequestConcept, conceptCsv } from './conceptSquad.ts';
import { conceptFixture } from '../../server/fixtures/concept.ts';

test('Klasik tokensız konsept: doğrulanan tüm kartlar ve gerçek PS maliyeti korunur', () => {
  const { data, set, segment, meta } = conceptFixture();
  const result = normalizeConcept(data, set, segment, 60, meta);
  assert.equal(result.totalCost, 5500); assert.equal(result.players.length, 11); assert.equal(result.platform, 'ps');
  assert.equal(result.chemistry, 11); assert.equal(result.formation, '4-4-2'); assert.equal(result.checks.length, 3); assert.equal(result.optimalWithinPool, false);
  assert.ok(!JSON.stringify(result).includes('X-API-Key')); assert.equal(result.players[0].updatedAt, new Date(data.timestamp - 65000).toISOString());
});
test('Eksik slotlu 10 kartlık SBC gerçek 11 slot dizilişiyle kabul edilir', () => {
  const { data, set, segment, meta } = conceptFixture(10);
  assert.equal(normalizeConcept(data, set, segment, 60, meta).players.length, 10);
});
test('Yanlış yıl, görev, platform, eksik koşul, sahiplik ve sahte optimum reddedilir', () => {
  const fixture = conceptFixture();
  const { set, segment, meta } = fixture;
  const changes: ((data: any) => void)[] = [
    d => { d.year = '26'; }, d => { d.platform = 'pc'; }, d => { d.challenge_name = 'Başka görev'; }, d => { d.sbc_name = 'Başka grup'; },
    d => { d.requirements.pop(); }, d => { d.verification.requirements.pop(); }, d => { d.verification.requirements[0].satisfied = false; },
    d => { d.locked_players.count = 1; }, d => { d.players[0].locked = true; }, d => { d.solution_status = 'no_solution_in_covered_pool'; },
  ];
  for (const change of changes) { const data = structuredClone(fixture.data); change(data); assert.throws(() => normalizeConcept(data, set, segment, 60, meta)); }
  const misleading = { ...fixture.data, proven_optimal: true };
  assert.equal(normalizeConcept(misleading, set, segment, 60, meta).optimalWithinPool, false);
});
test('Oyuncu, toplam fiyat, kart seviyesi ve fiyat tazeliği tutarsızlıkları reddedilir', () => {
  const fixture = conceptFixture();
  const changes: ((data: any) => void)[] = [d => { d.players.pop(); }, d => { d.players[1].player_id = 1; }, d => { d.players[1].name = d.players[0].name; },
    d => { d.players[0].main_price = 0; }, d => { d.players[0].current_price = 200; }, d => { d.total_cost = 100; }, d => { d.verification.team_chemistry = 20; },
    d => { d.players[0].rating = 64; }, d => { d.players[0].page_verified = false; }, d => { d.players[0].effective_age_seconds = 4000; },
    d => { d.players[0].updated_age_seconds = null; }, d => { d.verification.freshness.effective_within_limit = false; }, d => { d.max_age_minutes = null; },
    d => { d.timestamp -= 600000; }, d => { d.formation = ''; }, d => { d.players[0].in_position = false; }];
  for (const change of changes) { const data = structuredClone(fixture.data); change(data); assert.throws(() => normalizeConcept(data, fixture.set, fixture.segment, 60, fixture.meta)); }
});
test('Puanlı, tokenlı, süresi dolmuş veya kimliği eksik görev için öneri açılmaz', () => {
  const { set, segment } = conceptFixture();
  assert.equal(canRequestConcept(set, segment), true);
  for (const changed of [{ ...set, expired: true }, { ...set, year: '26' as const }, { ...set, detailsLoaded: false }]) assert.equal(canRequestConcept(changed, segment), false);
  assert.equal(canRequestConcept(set, { ...segment, identityVerified: false }), false);
  assert.equal(canRequestConcept(set, { ...segment, rules: { ...segment.rules, kind: 'POINTS' } }), false);
  assert.equal(canRequestConcept(set, { ...segment, rules: { ...segment.rules, raw: [...segment.rules.raw, 'Tokens: Min 1'] } }), false);
  assert.equal(canRequestConcept(set, { ...segment, rules: { ...segment.rules, raw: [...segment.rules.raw, 'Token: Min 1'] } }), false);
});
test('Çözüm bulunamadı sonucu kadro veya kesin yapılamaz iddiası üretmez', () => {
  const f = conceptFixture();
  const data = { ...f.data, found: false, solution_found: false, players: [], total_cost: null, verification: null, solution_status: 'search_incomplete_no_solution' };
  const result = normalizeConcept(data, f.set, f.segment, 60, f.meta);
  assert.equal(result.found, false); assert.equal(result.searchComplete, false); assert.equal(result.totalCost, null); assert.equal(result.players.length, 0);
});
test('CSV aktarımı kart sürümü, PS platformu, slot ve fiyat zamanını korur; formülleri kaçırır', () => {
  const f = conceptFixture(); f.data.players[0].name = '=Test, "Name"';
  const csv = conceptCsv(normalizeConcept(f.data, f.set, f.segment, 60, f.meta));
  assert.match(csv, /PlayStation/); assert.match(csv, /Normal/); assert.match(csv, /Fiyat güncellemesi/); assert.ok(csv.includes('"\'=Test, ""Name"""'));
});
