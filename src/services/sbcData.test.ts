import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSbcPage, parseSbcRules, toSolverChallenge } from './sbcData.ts';
import { evaluateSbcRequirements, solveNormalSbc } from './sbcSolver.ts';
import { normalizePlayer } from './parseAdapter.ts';
import type { SbcRequirement } from '../types/index.ts';

const meta = { fetchedAt: new Date().toISOString(), cached: false, credits: 10 };
const set = { id: '15', name: 'Madrid Dreams', url: 'https://www.futbin.com/27/squad-building-challenge/15', expires: '2 days', squads_required: '1', cost_pc: '2K', cost_ps: '2.05K', challenges: [{ id: '32', name: 'Madrid Dreams', reward: 'Giant Gold Pack (Untradeable)', requirements: ['Same League Count: Max 4', 'Same Club Count: Min 3', '# of players in squad: 10'] }], challenges_error: null };

test('Belgelenmiş Madrid Dreams koşulları eksiksiz ve sayısal okunur', () => {
  const page = normalizeSbcPage({ page: 1, sbcs: [set] }, '27', true, true, meta);
  assert.equal(page.sets[0].costPc, 2000); assert.equal(page.sets[0].costConsole, 2050);
  const rules = page.sets[0].segments[0].rules;
  assert.equal(rules.supported, true); assert.equal(rules.kind, 'SQUAD');
  assert.deepEqual(rules.requirements, { playerCount: 10, minSquadRating: 0, maxPerLeague: 4, minSameClub: 3 });
  const challenge = toSolverChallenge(page.sets[0], page.sets[0].segments[0], page, 'pc')!;
  assert.equal(challenge.source, 'PARSE'); assert.equal(challenge.gameYear, '27'); assert.equal(challenge.tokenRules, undefined);
  assert.deepEqual(challenge.rawRequirements, set.challenges[0].requirements);
});
test('Nadirlik, kart seviyesi ve tanınmayan koşullar sessizce atlanmaz', () => {
  for (const line of ['Player Level: Exactly Bronze', 'Rare: Min 3', '# of players from France: Min 1', 'Unrecognised: Min 4']) {
    const rules = parseSbcRules([line, '# of players in squad: 11']);
    assert.equal(rules.supported, false); assert.ok(rules.unsupported.includes(line)); assert.ok(rules.raw.includes(line));
  }
});
test('Item Score görevleri kadro formülüne veya reyting jetonuna çevrilmez', () => {
  const rules = parseSbcRules(['Item Score: Min 100', '# of players in squad: 11']);
  assert.equal(rules.kind, 'POINTS'); assert.equal(rules.requirements, null); assert.equal(rules.supported, false);
});
test('Kaynakta kimliği boş olan Squad Score görevleri kaybolmadan listelenir', () => {
  const page = normalizeSbcPage({ sbcs: [{ ...set, challenges: [{ id: '', name: 'Ligue 1 POTM September', requirements: ['Required Squad Score: 150'] }] }] }, '27', true, true, meta);
  const group = page.sets[0], segment = group.segments[0];
  assert.equal(group.detailsError, null); assert.equal(group.segments.length, 1);
  assert.equal(segment.rules.kind, 'POINTS'); assert.equal(segment.identityVerified, false);
  assert.deepEqual(segment.rules.raw, ['Required Squad Score: 150']);
  assert.equal(toSolverChallenge(group, segment, meta, 'pc'), null);
});
test('Kimliği eksik klasik görev görüntülenir ama otomatik çözüme aktarılmaz', () => {
  const page = normalizeSbcPage({ sbcs: [{ ...set, challenges: [{ id: '', name: 'Unnamed ID', requirements: ['# of players in squad: 11'] }] }] }, '27', true, true, meta);
  assert.equal(page.sets[0].segments.length, 1); assert.equal(page.sets[0].segments[0].rules.supported, false);
});
test('Kimya isteyen görev gerçek slot dizilişi gelmeden otomatik çözülmez', () => {
  const rules = parseSbcRules(['Team Chemistry: Min 18', 'Squad Rating: Min 75', '# of players in squad: 11']);
  assert.equal(rules.kind, 'SQUAD'); assert.equal(rules.requirements?.minChemistry, 18); assert.equal(rules.supported, false);
});
test('Eksik oyuncu sayısı, boş koşullar ve çelişkiler çözüm üretmez', () => {
  assert.equal(parseSbcRules([]).supported, false);
  assert.equal(parseSbcRules(['Squad Rating: Min 87']).supported, false);
  assert.equal(parseSbcRules(['# of players in squad: 11', '# of players in squad: 10']).supported, false);
  assert.equal(parseSbcRules(['# of players in squad: 20']).supported, false);
});
test('Oyun yılı ve kaynak kimliği doğrulanır; boş liste ile bozuk yanıt ayrılır', () => {
  assert.equal(normalizeSbcPage({ sbcs: [] }, '27', false, true, meta).sets.length, 0);
  assert.throws(() => normalizeSbcPage({ sbcs: [set] }, '26', true, true, meta));
  assert.throws(() => normalizeSbcPage({ sbcs: [{ ...set, url: 'https://evil.example/27/squad-building-challenge/15' }] }, '27', true, true, meta));
  assert.throws(() => normalizeSbcPage({ sbcs: [{ ...set, id: '16' }] }, '27', true, true, meta));
  assert.throws(() => normalizeSbcPage({ other: [] }, '27', true, true, meta));
});
test('Hafif liste, eksik alt görevler ve süresi geçmiş görevler çözücüye aktarılmaz', () => {
  const light = normalizeSbcPage({ sbcs: [{ id: set.id, name: set.name, url: set.url, expires: set.expires }] }, '27', false, true, meta).sets[0];
  assert.equal(light.detailsLoaded, false); assert.equal(light.segments.length, 0);
  const failed = normalizeSbcPage({ sbcs: [{ ...set, challenges_error: 'site failure' }] }, '27', true, true, meta).sets[0];
  assert.ok(failed.detailsError); assert.equal(toSolverChallenge(failed, failed.segments[0], meta, 'pc'), null);
  const expired = normalizeSbcPage({ sbcs: [{ ...set, expires: 'Expired' }] }, '27', true, false, meta).sets[0];
  assert.equal(toSolverChallenge(expired, expired.segments[0], meta, 'pc'), null);
  assert.equal(normalizeSbcPage({ sbcs: [{ ...set, expires: 'Expired' }] }, '27', true, true, meta).sets.length, 0);
});
test('Yeni lig, ülke ve kulüp sayısı şartları bağımsız olarak denetlenir', () => {
  const players = Array.from({ length: 4 }, (_, i) => normalizePlayer({ id: String(i + 1), name: 'Player ' + i, rating: 85, position: 'ST', league: 'L' + (i % 2), nation: 'N' + i, club: i < 3 ? 'Club A' : 'Club B', price_pc: 1000 }, '27', 'pc', meta.fetchedAt)!);
  const slots = players.map((p, i) => ({ slotId: String(i), player: p, position: 'ST' as const, isFromClub: false, isUntradeable: false, isToken: false, cost: 1000 }));
  const evaluate = (extra: Partial<SbcRequirement>) => evaluateSbcRequirements(slots, { playerCount: 4, minSquadRating: 0, ...extra }, 85, 0).isFeasible;
  assert.equal(evaluate({ maxPerLeague: 2, minSameClub: 3, minClubs: 2, maxNations: 4, maxLeagues: 2 }), true);
  for (const req of [{ maxPerLeague: 1 }, { minSameClub: 4 }, { maxClubs: 1 }, { maxNations: 3 }, { maxPerClub: 0 }]) assert.equal(evaluate(req), false);
  slots[0].player.league = 'Bilinmiyor'; assert.equal(evaluate({ maxPerLeague: 4 }), false);
});
test('Canlı görevde demo/yanlış yıl kartı ve değiştirilmiş kaynak koşulu kabul edilmez', () => {
  const data = normalizeSbcPage({ sbcs: [{ ...set, challenges: [{ ...set.challenges[0], requirements: ['Squad Rating: Min 85', '# of players in squad: 1'] }] }] }, '27', true, true, meta);
  const challenge = toSolverChallenge(data.sets[0], data.sets[0].segments[0], meta, 'pc')!;
  const player = normalizePlayer({ id: '1', name: 'Test', rating: 85, position: 'ST', price_pc: 1000 }, '27', 'pc', meta.fetchedAt)!;
  assert.equal(solveNormalSbc(challenge, [player]).isFeasible, true);
  assert.equal(solveNormalSbc(challenge, [{ ...player, priceStatus: 'DEMO' }]).isFeasible, false);
  assert.equal(solveNormalSbc(challenge, [{ ...player, gameYear: '26' }]).isFeasible, false);
  const changed = solveNormalSbc({ ...challenge, requirements: { playerCount: 1, minSquadRating: 1 } }, [player]);
  assert.equal(changed.isFeasible, false); assert.equal(changed.searchStatus, 'INVALID_INPUT');
});
