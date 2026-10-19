import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEaPlayStyles, eaPlayStyleIcon } from './eaPlayStyles.ts';
test('PlayStyle: EA normal ve + simgeleri ayrı; geliştirilmiş tarz iki kez sayılmaz', () => {
  const styles = normalizeEaPlayStyles([{ id: 1, name: 'Power Shot', isPlus: false, description: null }, { id: 1, name: 'Power Shot', isPlus: true, description: 'Geliştirilmiş' }]);
  assert.equal(styles.length, 1); assert.equal(styles[0].isPlus, true);
  assert.match(eaPlayStyleIcon(styles[0]), /\/icontrait1\.png$/);
  assert.match(eaPlayStyleIcon({ id: 1, isPlus: false }), /\/basetrait1\.png$/);
  assert.equal(eaPlayStyleIcon({ id: -1, isPlus: false }), '');
  assert.throws(() => normalizeEaPlayStyles([{ id: '../secret', name: 'Bad', isPlus: true, description: null }]));
  assert.ok(!JSON.stringify(normalizeEaPlayStyles([{ id: 1, name: '', isPlus: false, description: null, token: 'private-secret' }])).includes('private-secret'));
});
