import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSquadRating, calculateSquadChemistry, evaluateSbcRequirements, solveClubAndTokenSbc, solveNormalSbc } from './sbcSolver.ts';
import { INITIAL_PLAYERS, SBC_CHALLENGES } from '../data/mockData.ts';
import type { Player, SbcChallenge, SbcRequirement, SbcSlot, TokenInventory } from '../types/index.ts';

const player = (id: string, rating = 87, price = 1000, extra: Partial<Player> = {}): Player => ({
  id, name: id, commonName: id, rating, position: 'CM', league: 'Lig A', nation: 'Ülke A', club: 'Kulüp A', nationCode: 'A', clubCode: 'A',
  cardType: 'GOLD_RARE', isSpecial: false, isUntradeable: false, inClub: false, price, priceSource: 'Test', priceStatus: 'MANUAL',
  priceUpdatedAt: '2026-10-18T12:00:00Z', stats: { pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 80, physical: 80 }, playStyles: [], ...extra,
});
const challenge = (requirements: Partial<SbcRequirement> = {}, extra: Partial<SbcChallenge> = {}): SbcChallenge => ({
  id: 'test', name: 'Test SBC', group: '', segmentTitle: '', segmentIndex: 1, segmentTotal: 1, expiresDays: 1, rewardTitle: '', rewardValueEstimated: 0, marketPriceBench: 0,
  requirements: { playerCount: 2, minSquadRating: 85, ...requirements }, ...extra,
});
const slot = (p: Player | null, id = p?.id || 'empty'): SbcSlot => ({ slotId: id, position: 'CM', player: p, isFromClub: Boolean(p?.inClub), isToken: false, isUntradeable: false, cost: p?.inClub ? 0 : p?.price || 0 });
const inventory = (extra: Partial<TokenInventory> = {}): TokenInventory => ({ tokens87Plus: 0, tokens88Plus: 0, tokens89Plus: 0, fragments: 0, ...extra });
const rules = { allowedRatings: [87, 88, 89], chemistry: 0, fragmentCost: 10, fragmentTokenRating: 88 as const, source: 'DEMO' as const };
const clubOptions = { useClubPlayers: true, prioritizeUntradeables: true, includeTokens: true };

test('Reyting: on adet 84 ve bir 90, temkinli modelde 85 eder', () => {
  const result = calculateSquadRating([...Array(10).fill(84), 90]);
  assert.equal(result.effectiveRatingRounded, 85);
  assert.ok(Math.abs(result.average - 84.54545454545455) < 1e-9);
  assert.ok(Math.abs(result.excess - 5.454545454545453) < 1e-9);
});
test('Reyting: eski sabit kalibrasyon bölgesinde oyuncu yükseltmek sonucu düşürmez', () => {
  const ratings = [88, 88, 88, 88, 87, 87, 87, 87, 87, 87, 87], upgraded = [...ratings];
  upgraded[4]++;
  assert.ok(calculateSquadRating(upgraded).effectiveRatingExact >= calculateSquadRating(ratings).effectiveRatingExact);
});
test('Reyting: 300 farklı kadroda her oyuncu yükseltmesi monoton kalır', () => {
  for (let seed = 0; seed < 300; seed++) {
    const ratings = Array.from({ length: 11 }, (_, i) => 50 + (seed * 17 + i * 13) % 45);
    const before = calculateSquadRating(ratings).effectiveRatingExact;
    for (let i = 0; i < 11; i++) {
      const after = [...ratings]; after[i]++;
      assert.ok(calculateSquadRating(after).effectiveRatingExact + 1e-9 >= before);
    }
  }
});
test('Reyting: boş ve eşit kadro sınırları; geçersiz reyting reddedilir', () => {
  assert.equal(calculateSquadRating([]).effectiveRatingRounded, 0);
  assert.equal(calculateSquadRating(Array(11).fill(87)).effectiveRatingRounded, 87);
  for (const bad of [NaN, Infinity, -1, 100, 87.5]) assert.throws(() => calculateSquadRating([bad]));
});
test('Boş slotlar oyuncu sayısı şartını karşılamaz', () => {
  const blank = Array.from({ length: 11 }, (_, i) => slot(null, String(i)));
  assert.equal(evaluateSbcRequirements(blank, { playerCount: 11, minSquadRating: 0 }, 0, 0).isFeasible, false);
});
test('Ülke, lig, kulüp, özel kart, benzersiz ülke/lig ve aynı ülke/lig şartları denetlenir', () => {
  const slots = [slot(player('a')), slot(player('b', 87, 1000, { nation: 'Ülke B', league: 'Lig B', club: 'Kulüp B' }))];
  for (const requirement of [{ exactNation: 'Yok' }, { exactLeague: 'Yok' }, { exactClub: 'Yok' }, { minSpecial: 1 }, { minTotw: 1 }, { minNations: 3 }, { minLeagues: 3 }, { minSameNation: 2 }, { minSameLeague: 2 }]) {
    assert.equal(evaluateSbcRequirements(slots, { playerCount: 2, minSquadRating: 85, ...requirement }, 87, 0).isFeasible, false, JSON.stringify(requirement));
  }
  assert.equal(evaluateSbcRequirements(slots, { playerCount: 2, minSquadRating: 85, minNations: 2, minLeagues: 2, exactClub: 'Kulüp B' }, 87, 0).isFeasible, true);
});
test('Aynı kulüp üst sınırı ve kimya şartı denetlenir', () => {
  const slots = [slot(player('a')), slot(player('b'))];
  assert.equal(evaluateSbcRequirements(slots, { playerCount: 2, minSquadRating: 0, maxPerClub: 1 }, 87, 0).isFeasible, false);
  assert.equal(evaluateSbcRequirements(slots, { playerCount: 2, minSquadRating: 0, minChemistry: 3 }, 87, 2).isFeasible, false);
});
test('Geçersiz veya desteklenmeyen gereksinim sessizce atlanmaz', () => {
  for (const req of [{ playerCount: 0 }, { playerCount: 12 }, { minSquadRating: NaN }, { minSquadRating: 100 }, { minChemistry: 34 }, { minTotw: -1 }, { minSpecial: '1' }, { unknownRule: 1 }]) {
    const c = challenge(req as Partial<SbcRequirement>);
    assert.equal(solveNormalSbc(c, [player('a'), player('b')]).searchStatus, 'INVALID_INPUT');
  }
});
test('Tekrarlanan slot ve aynı oyuncunun farklı kart versiyonları reddedilir', () => {
  const a = player('a', 87, 1000, { basePlayerId: 'footballer' }), b = player('b', 88, 1000, { basePlayerId: 'footballer' });
  assert.equal(evaluateSbcRequirements([slot(a), slot(b)], { playerCount: 2, minSquadRating: 0 }, 87, 0).isFeasible, false);
  assert.equal(evaluateSbcRequirements([slot(player('a'), 'same'), slot(player('b'), 'same')], { playerCount: 2, minSquadRating: 0 }, 87, 0).isFeasible, false);
});
test('Kimya: yanlış mevkideki oyuncu ve jeton kimya üretmez', () => {
  const wrong = { ...slot(player('a')), position: 'ST' as const };
  const token = { ...slot(null, 'token'), isToken: true, tokenRating: 89 };
  assert.equal(calculateSquadChemistry([wrong, token]).totalChemistry, 0);
});
test('Kimya: alternatif mevki, kulüp ve ülke eşikleri uygulanır', () => {
  const a = slot(player('a', 87, 1000, { position: 'ST', secondaryPositions: ['CM'] })), b = slot(player('b'));
  const result = calculateSquadChemistry([a, b]);
  assert.equal(result.totalChemistry, 4);
  assert.equal(result.slotChemistry.a, 2);
});
test('Kimya: kahraman lig katkısı ve ikon ülke/lig katkısı temel profile dahil', () => {
  const hero = player('hero', 87, 1000, { cardType: 'HERO' }), ordinary = player('ordinary', 87, 1000, { nation: 'Ülke B', club: 'Kulüp B' });
  assert.equal(calculateSquadChemistry([slot(hero), slot(ordinary)]).slotChemistry.ordinary, 1);
  const icon = player('icon', 87, 1000, { cardType: 'ICON', league: 'Icons', club: 'Icons' });
  assert.equal(calculateSquadChemistry([slot(icon), slot(ordinary)]).slotChemistry.icon, 3);
});
test('Kimya: bilinmeyen kulüp/ülke/lig sahte bağlantı üretmez', () => {
  const pool = Array.from({ length: 3 }, (_, i) => slot(player(String(i), 87, 1000, { league: '', club: 'Bilinmiyor', nation: '' })));
  assert.equal(calculateSquadChemistry(pool).totalChemistry, 0);
});
test('Normal çözüm: istenen oyuncu sayısını aynen uygular ve en düşük maliyeti bulur', () => {
  const pool = [player('a', 81, 1), player('b', 85, 2), player('c', 87, 10), player('d', 88, 11)];
  const s = solveNormalSbc(challenge({ playerCount: 2, minSquadRating: 86 }), pool);
  assert.equal(s.isFeasible, true); assert.equal(s.slots.length, 2); assert.equal(s.totalCoinCost, 12); assert.equal(s.searchStatus, 'OPTIMAL');
  assert.equal(solveNormalSbc(challenge({ playerCount: 1, minSquadRating: 0 }), pool).slots.length, 1);
});
test('Normal çözüm maliyeti bağımsız tüm kombinasyon taramasıyla eşleşir', () => {
  const pool = Array.from({ length: 7 }, (_, i) => player(String(i), 81 + i, 300 + ((i * 17) % 8) * 100));
  let expected = Infinity;
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++) {
    const picked = [pool[a], pool[b], pool[c]], ratings = picked.map(p => p.rating), total = ratings.reduce((x, y) => x + y, 0), avg = total / 3;
    const result = Math.floor((total + ratings.reduce((n, r) => n + Math.max(0, r - avg), 0)) / 3 + 1e-9);
    if (result >= 85) expected = Math.min(expected, picked.reduce((n, p) => n + p.price, 0));
  }
  const solution = solveNormalSbc(challenge({ playerCount: 3, minSquadRating: 85 }), pool);
  assert.equal(solution.totalCoinCost, expected); assert.equal(solution.searchStatus, 'OPTIMAL');
});
test('Bütçe sıfır ve negatif/NaN bütçe doğru yönetilir', () => {
  const pool = [player('a'), player('b')];
  assert.equal(solveNormalSbc(challenge(), pool, { budgetLimit: 0 }).isFeasible, false);
  for (const budgetLimit of [-1, NaN]) assert.equal(solveNormalSbc(challenge(), pool, { budgetLimit }).searchStatus, 'INVALID_INPUT');
});
test('Fiyatı bilinmeyen oyuncu ücretsiz satın alma olarak seçilmez', () => {
  const s = solveNormalSbc(challenge(), [player('a', 87, 0, { priceStatus: 'UNAVAILABLE' }), player('b')]);
  assert.equal(s.isFeasible, false); assert.equal(s.missingPriceCount, 1); assert.equal(s.slots.some(s => s.player?.id === 'a'), false);
});
test('Kilitli oyuncu tekrarı, havuz dışı oyuncu ve eksik fiyat geçerli sayılmaz', () => {
  const pool = [player('a'), player('b')];
  for (const lockedSlots of ([{ pos_lw: pool[0], pos_st: pool[0] }, { pos_lw: player('outside') }, { pos_lw: player('a', 87, 0, { priceStatus: 'UNAVAILABLE' }) }] as Record<string, Player>[])) {
    const candidatePool = 'pos_st' in lockedSlots || lockedSlots.pos_lw.id === 'outside' ? pool : [lockedSlots.pos_lw, pool[1]];
    assert.equal(solveNormalSbc(challenge(), candidatePool, { lockedSlots }).searchStatus, 'INVALID_INPUT');
  }
});
test('Kulüp oyuncularının piyasa değeri yeni coin maliyetine eklenmez', () => {
  const own = player('own', 87, 50000, { inClub: true });
  const s = solveClubAndTokenSbc(challenge(), [own], [player('market')], inventory(), { ...clubOptions, includeTokens: false });
  assert.equal(s.isFeasible, true); assert.equal(s.totalCoinCost, 1000); assert.equal(s.untradeableValueUsed, 50000);
});
test('Kulüp kullanmama, yalnızca kulüp ve hariç tutulan oyuncu seçenekleri uygulanır', () => {
  const own = player('own', 87, 50000, { inClub: true }), market = [player('m1'), player('m2')];
  assert.equal(solveClubAndTokenSbc(challenge(), [own], market, inventory(), { ...clubOptions, useClubPlayers: false }).clubPlayersCount, 0);
  assert.equal(solveClubAndTokenSbc(challenge(), [own], market, inventory(), { ...clubOptions, onlyClub: true }).isFeasible, false);
  const excluded = solveClubAndTokenSbc(challenge(), [own], market, inventory(), { ...clubOptions, excludedPlayerIds: ['own'] });
  assert.equal(excluded.slots.some(s => s.player?.id === 'own'), false);
});
test('Jeton kuralı yoksa stok bulunsa da jeton kullanılmaz', () => {
  const s = solveClubAndTokenSbc(challenge(), [], [], inventory({ tokens89Plus: 10 }), clubOptions);
  assert.equal(s.tokensCount, 0); assert.equal(s.isFeasible, false);
});
test('Eski varsayılan SBC kimliği sıfır stokla jeton üretemez', () => {
  const s = solveClubAndTokenSbc(SBC_CHALLENGES[0], INITIAL_PLAYERS.filter(p => p.inClub), INITIAL_PLAYERS.filter(p => !p.inClub), inventory(), { ...clubOptions, maxNodes: 100 });
  assert.equal(s.tokensCount, 0);
});
test('87/88/89 jetonları gerçek stokla sınırlanır; kilitli jeton stoktan düşülür', () => {
  for (const rating of [87, 88, 89]) {
    const key = ('tokens' + rating + 'Plus') as keyof TokenInventory;
    const s = solveClubAndTokenSbc(challenge({ playerCount: 2, minSquadRating: 87 }, { tokenRules: rules }), [], [player('m')], inventory({ [key]: 1 }), { ...clubOptions, lockedSlots: { pos_lw: { isToken: true, tokenRating: rating } } });
    assert.equal(s.isFeasible, true); assert.equal(s.tokensCount, 1); assert.equal(s.tokenUsage[rating], 1);
  }
});
test('Stok aşan kilitli jeton ve kapalı jeton seçeneği reddedilir', () => {
  const c = challenge({}, { tokenRules: rules });
  const locks = { pos_lw: { isToken: true, tokenRating: 88 }, pos_st: { isToken: true, tokenRating: 88 } };
  assert.equal(solveClubAndTokenSbc(c, [], [], inventory({ tokens88Plus: 1 }), { ...clubOptions, lockedSlots: locks }).searchStatus, 'INVALID_INPUT');
  assert.equal(solveClubAndTokenSbc(c, [], [], inventory({ tokens88Plus: 2 }), { ...clubOptions, includeTokens: false, lockedSlots: locks }).searchStatus, 'INVALID_INPUT');
});
test('Stratejiler hedefi değiştirir: kulüp önceliği ve jeton tasarrufu', () => {
  const c = challenge({ playerCount: 1, minSquadRating: 87 }, { tokenRules: rules }), own = player('own', 87, 5000, { inClub: true });
  const s = solveClubAndTokenSbc(c, [own], [], inventory({ tokens89Plus: 1 }), { ...clubOptions, strategy: 'CLUB_FIRST' });
  assert.equal(s.clubPlayersCount, 1);
  const t = solveClubAndTokenSbc(c, [], [player('m')], inventory({ tokens89Plus: 1 }), { ...clubOptions, strategy: 'TOKEN_OPTIMIZED' });
  assert.equal(t.tokensCount, 0); assert.equal(t.totalCoinCost, 1000);
});
test('Arama sınırı optimum veya imkânsızlık iddiası üretmez', () => {
  const pool = Array.from({ length: 8 }, (_, i) => player(String(i)));
  const s = solveNormalSbc(challenge(), pool, { maxNodes: 1 });
  assert.equal(s.searchStatus, 'LIMIT_REACHED'); assert.equal(s.isFeasible, true); assert.ok(s.warnings.some(w => w.includes('kanıtlanmadı')));
  const none = solveNormalSbc(challenge({ minSquadRating: 99 }), pool, { maxNodes: 1 });
  assert.equal(none.searchStatus, 'LIMIT_REACHED'); assert.equal(none.isFeasible, false); assert.ok(none.warnings.some(w => w.includes('imkânsız')));
});
test('Normal mod kulüp ve jeton stoklarını değiştirmez; demo fiyatlar demo kalır', () => {
  const pool = [player('a', 87, 1000, { priceStatus: 'DEMO' }), player('b')], snapshot = JSON.stringify(pool);
  const s = solveNormalSbc(challenge(), pool);
  assert.equal(s.clubPlayersCount, 0); assert.equal(s.tokensCount, 0); assert.equal(s.dataStatus, 'DEMO'); assert.equal(JSON.stringify(pool), snapshot);
});
