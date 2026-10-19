import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evolutionEligibility } from './evolutionEligibility.ts';
import { fc27EvolutionSnapshot } from '../data/evolutionsSnapshot.ts';
import { normalizePlayer, normalizeDetail } from './parseAdapter.ts';
const card = () => normalizePlayer({ id: '123', name: 'Test CB', rating: 80, position: 'CB', positions: ['CB'], playstyles: [], face_stats: { pace: 75, shooting: 50, passing: 60, dribbling: 60, defending: 70, physical: 70 } }, '27', 'pc', new Date().toISOString())!;
test('EVO: sınırdaki uygun kart geçer; reyting, hız ve yasak alternatif mevki ayrı denetlenir', () => {
  const evo = fc27EvolutionSnapshot[0]; assert.equal(evolutionEligibility(evo, card()).status, 'ELIGIBLE');
  for (const modify of [(p: any) => p.rating = 81, (p: any) => p.stats.pace = 76, (p: any) => p.secondaryPositions = ['CDM'], (p: any) => p.gameYear = '26']) { const p = card(); modify(p); assert.equal(evolutionEligibility(evo, p).status, 'INELIGIBLE'); }
});
test('EVO: eksik özellik, PlayStyle, alternatif mevki veya tanınmayan kural uygun sayılmaz', () => {
  const evo = fc27EvolutionSnapshot[0];
  for (const modify of [(p: any) => p.statsKnown = false, (p: any) => p.playStylesKnown = false, (p: any) => p.positionsKnown = false]) { const p = card(); modify(p); assert.equal(evolutionEligibility(evo, p).status, 'UNKNOWN'); }
  assert.equal(evolutionEligibility({ ...evo, requirements: { Mystery: 'Max 3' } }, card()).status, 'UNKNOWN');
  assert.equal(evolutionEligibility({ ...evo, requirements: {} }, card()).status, 'UNKNOWN');
  assert.equal(evolutionEligibility({ ...evo, status: 'expired' }, card()).status, 'INELIGIBLE');
});
test('EVO: ayrıntı yanıtında eksik alan mevcut alternatif mevkileri ve PlayStyle bilgisini silmez', () => {
  const p = card(); p.secondaryPositions = ['RB'];
  const detail = normalizeDetail({ id: '123', position: 'CB' }, '123', '27', 'pc', { fetchedAt: new Date().toISOString(), cached: false, credits: 1 });
  const merged = { ...p, ...detail }; assert.deepEqual(merged.secondaryPositions, ['RB']); assert.equal(merged.playStylesKnown, true);
});
