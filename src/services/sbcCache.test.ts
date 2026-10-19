import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSbcPage, normalizeSbcPage, toSolverChallenge } from './sbcData.ts';

function pages() {
  const now = Date.now(), oldTime = new Date(now - 600000).toISOString();
  const source = { page: 1, sbcs: [{ id: '45', name: 'Marquee Matchups', url: 'https://www.futbin.com/27/squad-building-challenge/45', expires: '4 days', squads_required: 1, challenges: [{ id: '79', name: 'Bayern v Leipzig', requirements: ['# of players in squad: 11', 'Squad Rating: Min 65'] }] }] };
  const old = normalizeSbcPage(source, '27', true, true, { fetchedAt: oldTime, cached: false, credits: 10 });
  const list = normalizeSbcPage({ ...source, sbcs: source.sbcs.map(({ challenges, ...set }) => set) }, '27', false, true, { fetchedAt: new Date(now).toISOString(), cached: false, credits: 1 });
  return { now, old, list, oldTime };
}
test('SBC kayıtları: hafif yenileme koşulları ve gerçek koşul tarihini korur', () => {
  const { old, list, oldTime } = pages(), merged = mergeSbcPage(old, list);
  assert.equal(merged.detailed, true); assert.equal(merged.sets[0].segments.length, 1); assert.equal(merged.credits, 1); assert.equal(merged.fetchedAt, list.fetchedAt);
  assert.equal(merged.sets[0].detailsFetchedAt, oldTime); assert.equal(toSolverChallenge(merged.sets[0], merged.sets[0].segments[0], merged, 'pc')?.sourceFetchedAt, oldTime);
  assert.equal(list.sets[0].detailsLoaded, false);
});
test('SBC kayıtları: yıl, sayfa, filtre, görev kimliği ve ad değişince eski koşullar karışmaz', () => {
  for (const edit of [(p: any) => p.year = '26', (p: any) => p.page = 2, (p: any) => p.activeOnly = false, (p: any) => p.sets[0].name = 'New SBC', (p: any) => p.sets[0].id = '46', (p: any) => p.sets[0].expired = true]) {
    const { old, list } = pages(); edit(list); assert.equal(mergeSbcPage(old, list).sets[0].detailsLoaded, false);
  }
});
test('SBC kayıtları: 24 saati aşmış koşullar, başarısız koşullar ve silinen görevler geri gelmez', () => {
  const { old, list, now } = pages();
  assert.equal(mergeSbcPage(old, list, now + 86400001).sets[0].detailsLoaded, false);
  old.sets[0].detailsError = 'Kaynak hatası'; assert.equal(mergeSbcPage(old, list).sets[0].detailsLoaded, false);
  assert.equal(mergeSbcPage(old, { ...list, sets: [] }).sets.length, 0);
});
