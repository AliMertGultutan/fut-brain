import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayerExtras, playerDetailHash, readPlayerRoute } from './playerDetails.ts';
import { normalizeDetail } from './parseAdapter.ts';

test('Oyuncu detay adresleri kulüp ve pazar kartını ayırır; eski bağlantı ve hatalı adresler güvenle okunur', () => {
  for (const source of ['market', 'club'] as const) {
    const id = source === 'club' ? 'ea:1234' : 'futbin:27:17441_47';
    assert.deepEqual(readPlayerRoute(playerDetailHash(id, source)), { id, source });
    assert.deepEqual(readPlayerRoute(playerDetailHash(id, source).replace('fut-players', 'fut-gallery')), { id, source });
  }
  for (const hash of ['#fut-players', '#fut-gallery', '#clubs/market/123', '#fut-players/other/123', '#fut-players/market/%E0%A4', '#fut-players/market/123/456']) {
    assert.equal(readPlayerRoute(hash).id, '');
  }
});

test('Detay ekranı için gerçek alt özellikler okunur; ana puanlar alt özelliklere kopyalanmaz', () => {
  assert.deepEqual(normalizePlayerExtras({ detailed_stats: { Pace: '80', Acceleration: '79', 'Sprint Speed': '81', 'Short Passing': '74', Dribbling: 84, Stamina: 0, Strength: 100, Vision: true, Balance: null, Reactions: '' } }), {
    detailedStats: { acceleration: 79, sprintSpeed: 81, shortPassing: 74, stamina: 0 },
  });
  assert.deepEqual(normalizePlayerExtras({ detailed_stats: { Pace: 80, Dribbling: 82 } }), {});
  assert.deepEqual(normalizePlayerExtras({ detailed_stats: { Pace: { Acceleration: 88, 'Sprint Speed': 90 }, Dribbling: { Agility: 81, Dribbling: 84 } } }), {
    detailedStats: { acceleration: 88, sprintSpeed: 90, agility: 81, dribbling: 84 },
  });
});

test('Eksik detay yenilemesi eski değerleri silmez; doğrulanmış EA görseli korunur', () => {
  const meta = { cached: true, fetchedAt: new Date().toISOString(), credits: 0 };
  const result = normalizeDetail({ id: '15', detailed_stats: { 'Shot Power': 88 }, portrait_url: 'https://www.ea.com/images/15.png' }, '15', '27', 'pc', meta);
  assert.deepEqual(result.detailedStats, { shotPower: 88 });
  assert.equal(result.imageUrl, 'https://www.ea.com/images/15.png');
  assert.equal(result.statsKnown, undefined);
  assert.equal(normalizeDetail({ id: '15' }, '15', '27', 'pc', meta).detailedStats, undefined);
  for (const url of ['javascript:alert(1)', 'https://ea.com.evil.test/a.png', 'https://www.ea.com/a.png?token=123']) {
    assert.equal(normalizePlayerExtras({ image_url: url }).imageUrl, undefined);
  }
});
