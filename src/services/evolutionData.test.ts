import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evolutionDataForYear, fc27EvolutionSnapshot, evoSnapshotCheckedAt } from '../data/evolutionsSnapshot.ts';
import type { EvolutionPage } from './parseAdapter.ts';

test('FC 26 Parse verisi FC 27 diye sunulmaz; tarihli FC 27 kaydı ayrı kaynak olarak korunur', () => {
  const old = { ...fc27EvolutionSnapshot[0], year: '26' as const, url: 'https://www.futbin.com/26/evolutions/1/test' };
  const page: EvolutionPage = { evolutions: [old], fetchedAt: new Date().toISOString(), cached: false, credits: 1 };
  const current = evolutionDataForYear(page, '27');
  assert.equal(current.kind, 'SNAPSHOT'); assert.equal(current.fetchedAt, evoSnapshotCheckedAt);
  assert.equal(current.evolutions.length, 7); assert.ok(current.evolutions.every(e => e.year === '27' && e.url.includes('/27/evolutions/')));
  assert.equal(evolutionDataForYear(page, '26').kind, 'PARSE'); assert.equal(evolutionDataForYear(null, '26').kind, 'EMPTY');
});
test('Sağlayıcı FC 27 kapsamına geçtiğinde yeni kaynak, tarihli kaydın yerine kullanılır', () => {
  const live = { ...fc27EvolutionSnapshot[0], name: 'New FC 27 Evolution' };
  const page: EvolutionPage = { evolutions: [live], fetchedAt: new Date().toISOString(), cached: false, credits: 1 };
  const current = evolutionDataForYear(page, '27');
  assert.equal(current.kind, 'PARSE'); assert.equal(current.fetchedAt, page.fetchedAt); assert.deepEqual(current.evolutions, [live]);
});
