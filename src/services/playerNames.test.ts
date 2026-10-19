import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestPlayerNames, uniquePlayerNames } from './playerNames.ts';

test('Kısmi ad ve soyad önerileri yeni API çağrısı gerektirmez', () => {
  assert.ok(suggestPlayerNames('gre').includes('Mason Greenwood'));
  assert.ok(suggestPlayerNames('messi').includes('Lionel Messi'));
  assert.ok(suggestPlayerNames('green wood').includes('Mason Greenwood'));
  assert.deepEqual(suggestPlayerNames('g'), []);
});
test('Türkçe harfler, aksanlar ve özel Latin harfleri eşleşir', () => {
  assert.ok(suggestPlayerNames('arda guler').includes('Arda Güler'));
  assert.ok(suggestPlayerNames('mbappe').includes('Kylian Mbappé'));
  assert.ok(suggestPlayerNames('hojlund').includes('Rasmus Højlund'));
  assert.ok(suggestPlayerNames('YILDIZ').includes('Kenan Yıldız'));
});
test('Kart sürümleri aynı isimde çoğalmaz; tam eşleşme ve sonuç sınırı korunur', () => {
  assert.deepEqual(uniquePlayerNames([' Lionel Messi ', 'Lionel Messi', 'Kylian Mbappé', 'Kylian Mbappe', null]), ['Lionel Messi', 'Kylian Mbappé']);
  assert.equal(suggestPlayerNames('Messi', ['Rayane Messi', 'Messi'])[0], 'Messi');
  assert.equal(suggestPlayerNames('Messi', ['Messiah Bright', 'Lionel Messi'])[0], 'Lionel Messi');
  assert.equal(suggestPlayerNames('green', [], 2).length, 2);
  assert.deepEqual(suggestPlayerNames('abcdefghijk'), []);
});
