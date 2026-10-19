import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoins, normalizePlayer, normalizeQuote, normalizePlayers, normalizeDetail, normalizeEvolutions, ageMarketPlayers, parsePositions, validFutbinId } from './parseAdapter.ts';
import { evaluateSbcRequirements, solveNormalSbc } from './sbcSolver.ts';
import { SBC_CHALLENGES } from '../data/mockData.ts';

const now = new Date().toISOString();
const meta = { fetchedAt: now, cached: false, credits: 1 };
const card = { id: '21748', name: 'Erling Haaland', rating: '96', position: 'ST++', version: 'TOTY', league: 'Premier League', nation: 'Norway', club: 'Manchester City', price_pc: '90K', price_ps: '77.5K', stats: { PAC: '93', SHO: '96', PAS: '83', DRI: '90', DEF: '54', PHY: '93' } };

test('Birleştirilmiş veya ayrılmış ana/alternatif mevkiler kartı elemez', () => {
  for (const value of ['CAM++RWRMST', 'CAM ++ RW RM ST', 'CAM++,RW/RM;ST']) assert.deepEqual(parsePositions(value), ['CAM', 'RW', 'RM', 'ST']);
  assert.deepEqual(parsePositions('RW++ST'), ['RW', 'ST']);
  assert.deepEqual(parsePositions('ST Advanced Forward'), []);
  const player = normalizePlayer({ ...card, name: 'Lionel Messi', position: 'CAM++RWRMST', secondary_positions: ['ST', 'CAM'] }, '27', 'pc', now)!;
  assert.equal(player.position, 'CAM'); assert.deepEqual(player.secondaryPositions, ['RW', 'RM', 'ST']);
});
test('Güvenli Evolution kart kimlikleri korunur; yol ve sorgu enjeksiyonu reddedilir', () => {
  assert.equal(validFutbinId('17441_47_53_47'), true);
  for (const id of ['../1', '1?x=2', '', '1__2', '0', '1/key']) assert.equal(validFutbinId(id), false);
  assert.equal(normalizePlayer({ ...card, id: '17441_47_53_47' }, '26', 'pc', now)?.futbinId, '17441_47_53_47');
});

test('K/M ve tam sayı fiyatları doğru çevrilir; eksik fiyat ücretsiz değildir', () => {
  assert.equal(parseCoins('77.5K'), 77500); assert.equal(parseCoins('1.09M'), 1090000);
  assert.equal(parseCoins('1,971,000'), 1971000);
  for (const value of [null, '—', 'Free', 'NaN', -1, Infinity, '0']) assert.equal(parseCoins(value), 0);
});
test('Yıl, platform, kart kimliği ve rol eki ayrıştırılır; sahiplik uydurulmaz', () => {
  const p = normalizePlayer(card, '27', 'pc', now)!;
  assert.equal(p.id, 'futbin:27:21748'); assert.equal(p.position, 'ST'); assert.equal(p.price, 90000);
  assert.equal(p.inClub, false); assert.equal(p.cardType, 'SPECIAL'); assert.equal(p.stats.pace, 93);
  assert.equal(p.priceStatus, 'STALE'); assert.equal(p.priceUpdatedAt, '');
  assert.equal(normalizePlayer({ ...card, year: '26' }, '27', 'pc', now), null);
});
test('Xbox fiyatı yoksa PlayStation fiyatı kullanılmaz', () => {
  const p = normalizePlayer(card, '27', 'xbox', now)!;
  assert.equal(p.price, 0); assert.equal(p.priceStatus, 'UNAVAILABLE');
});
test('Okuma zamanı, kaynak fiyatının güncelleme zamanı yerine geçmez', () => {
  const q = normalizeQuote({ prices: { pc: { price: '2,000', updated: '54 secs ago' } } }, 'pc', now);
  assert.equal(q.priceStatus, 'LIVE'); assert.equal(Date.parse(now) - Date.parse(q.priceUpdatedAt), 54000);
  assert.equal(normalizeQuote({ prices: { pc: { price: 2000, updated: '2 hours ago' } } }, 'pc', now).priceStatus, 'STALE');
  assert.equal(normalizeQuote({ prices: { pc: { price: 2000 } } }, 'pc', now).priceStatus, 'STALE');
  assert.equal(normalizeQuote({ prices: { pc: { price: 2000, updated: '1 min ago' } } }, 'pc', now, true).priceStatus, 'CACHED');
});
test('Kullanılamayan fiyat ve eski önbellek doğru etiketlenir', () => {
  assert.equal(normalizeQuote({ prices: { pc: { price: 2000, available: false } } }, 'pc', now).priceStatus, 'UNAVAILABLE');
  const old = new Date(Date.now() - 3600000).toISOString();
  assert.equal(normalizeQuote({ prices: { pc: { price: 2000, updated: '1 sec ago' } } }, 'pc', old, true).priceStatus, 'STALE');
  const p = normalizePlayer(card, '27', 'pc', now)!;
  assert.equal(ageMarketPlayers([{ ...p, priceStatus: 'LIVE', priceUpdatedAt: old }])[0].priceStatus, 'STALE');
});
test('Kaleci özellikleri saha oyuncusu istatistiği yapılmaz; kilitli PlayStyle eklenmez', () => {
  const p = normalizePlayer({ ...card, position: 'GK', stats: { DIV: 99, HAN: 99 }, playstyles: { plus: [{ name: 'Rush Out' }], basic: [{ name: 'Footwork' }], locked: [{ name: 'Far Reach' }] } }, '26', 'ps', now)!;
  assert.equal(p.statsKnown, false); assert.equal(p.stats.pace, 0); assert.deepEqual(p.playStyles, ['Rush Out+', 'Footwork']);
});
test('Standart altın, gümüş, bronz kartlar özel kart şartını sağlamaz', () => {
  for (const version of ['Gold', 'Silver Rare', 'Bronze Common', 'Rare']) {
    const p = normalizePlayer({ ...card, version }, '27', 'pc', now)!;
    assert.equal(p.isSpecial, false); assert.equal(p.cardType, 'BASE');
    const result = evaluateSbcRequirements([{ slotId: 'a', position: 'ST', player: p, cost: p.price, isFromClub: false, isToken: false, isUntradeable: false }], { playerCount: 1, minSquadRating: 1, minSpecial: 1 }, 96, 0);
    assert.equal(result.checklist.find(v => v.id === 'req_special')?.satisfied, false);
  }
});
test('Boş arama geçerli; bozuk dolu yanıt sessizce kabul edilmez', () => {
  assert.equal(normalizePlayers({ results: [], page: 2, has_more: false }, '27', 'pc', meta).players.length, 0);
  assert.throws(() => normalizePlayers({ players: [{ ...card, rating: '???' }] }, '27', 'pc', meta));
  assert.throws(() => normalizePlayers({ unexpected: [] }, '27', 'pc', meta));
  assert.equal(normalizePlayers({ players: [card] }, '27', 'pc', meta).paginationKnown, false);
});
test('Ayrıntı yanıtı eksik kimlik/reyting ile kataloğu bozmaz; yanlış kimlik reddedilir', () => {
  const detail = normalizeDetail({ id: '21748', rating: '', position: '', prices: { pc: { price: '2000', updated: '1 sec ago' } }, detailed_stats: { Pace: '93', Shooting: '96', Passing: '83', Dribbling: '90', Defending: '54', Physical: '93' } }, '21748', '27', 'pc', meta);
  assert.equal(detail.rating, undefined); assert.equal(detail.position, undefined); assert.equal(detail.price, 2000); assert.equal(detail.stats?.pace, 93);
  assert.throws(() => normalizeDetail({ id: '1' }, '21748', '27', 'pc', meta));
});
test('Evolution gerçek yılını URL’den alır; belirsiz yıl FC27 varsayılmaz', () => {
  const result = normalizeEvolutions({ evos: [{ name: 'Wall of Fame', url: 'https://www.futbin.com/26/evolutions/1261/wall-of-fame', requirements: { Overall: 'Max 96' }, stat_boosts: { Diving: '+30 | 97' } }, { name: 'Unknown', url: 'javascript:alert(1)' }] }, meta);
  assert.equal(result.evolutions[0].year, '26'); assert.equal(result.evolutions[1].year, null); assert.equal(result.evolutions[1].url, '');
});
test('Parse kartı çözücüye fiyatı ve kaynak etiketiyle girer; fiyat yoksa kullanılmaz', () => {
  const player = normalizePlayer(card, '27', 'pc', now)!;
  const challenge = { ...SBC_CHALLENGES[0], requirements: { playerCount: 1, minSquadRating: 85 } };
  const result = solveNormalSbc(challenge, [player]);
  assert.equal(result.totalCoinCost, 90000); assert.equal(result.dataStatus, 'PARSE'); assert.equal(result.isFeasible, true);
  assert.equal(solveNormalSbc(challenge, [normalizePlayer(card, '27', 'xbox', now)!]).isFeasible, false);
});
