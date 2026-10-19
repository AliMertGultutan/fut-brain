import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { readEaItemScores } from './src/eaItemScoreAdapter.ts';
import { normalizeItemScoreData } from '../src/services/itemScore.ts';
function fixture() {
  const calls: string[] = [], nativeSet = { id: 29, name: 'Johan Manzambi', hasExpired: () => false };
  const task: any = { name: 'Johan Manzambi', scoreRequirement: 5000, submittedScore: 700, eligibilityRequirements: [], eligibilityOperation: 0, hasExpired: () => false };
  const observable = (result: any) => ({ observe: (_: any, cb: any) => queueMicrotask(() => cb(null, { success: true, ...result })), unobserve() {} });
  const cards = [{ key: 'provider:41', name: 'Jóhan Test', commonName: 'Test', rating: 80 }];
  const catalog: any[] = [{ id: 12345, firstName: 'Johan', lastName: 'Test', rating: 80 }];
  const items: any[] = [{ definitionId: 12345, rating: 80, concept: true, isPlayer: () => true, isSpecial: () => false, sbsScore: 321 }];
  const g: any = { GAME_NAME: 'fc27', UTSearchCriteriaDTO: class {}, SearchType: { PLAYER: 'player' }, SBCEligibilityOperation: { AND: 0, OR: 1 }, SBCEligibilityKey: { PLAYER_MIN_OVR: 1, PLAYER_MAX_OVR: 2, PLAYER_EXACT_OVR: 3 }, repositories: { Item: { getStaticData: () => catalog } }, services: {
    SBC: { requestSets: () => { calls.push('sets'); return observable({ data: { sets: [nativeSet] } }); }, requestChallengesForSet: (set: any) => { assert.equal(set, nativeSet); calls.push('tasks'); return observable({ data: { challenges: [task] } }); } },
    Item: { searchConceptItems: (criteria: any) => { assert.equal(criteria.type, 'player'); assert.deepEqual(Array.from(criteria.defId), [12345]); calls.push('concept'); return observable({ response: { items, endOfList: true } }); },
      buy: () => assert.fail('Satın alma çağrılmamalı'), submit: () => assert.fail('Teslim çağrılmamalı') }
  } };
  return { g, task, cards, catalog, items, calls, request: { setName: 'Johan Manzambi', segmentName: 'Johan Manzambi', cards } };
}
test('EA Item Score: gerçek görev ilerlemesi ve konsept puanı okunur; sağlayıcı kart kimliği EA kimliği sanılmaz', async () => {
  const mock = fixture(), result = await readEaItemScores(mock.request, mock.g);
  assert.ok(result.ok); const data = normalizeItemScoreData(result.itemScores);
  assert.equal(data.target, 5000); assert.equal(data.submitted, 700); assert.equal(data.cards[0].score, 321); assert.equal(data.cards[0].definitionId, 12345);
  assert.deepEqual(mock.calls, ['sets', 'tasks', 'concept']);
});
test('EA Item Score: sayısal metin koşul anahtarı okunur; belirsiz ve desteklenmeyen koşullar atlanmaz', async () => {
  const mock = fixture();
  const rule = (key: string, value: number) => ({ keys: () => [key], getValue: () => [value], getFirstValue: () => value });
  mock.task.eligibilityRequirements = [rule('1', 81)];
  const ineligible = await readEaItemScores(mock.request, mock.g); assert.ok(ineligible.ok); assert.equal(ineligible.itemScores?.cards.length, 0); assert.ok(!mock.calls.includes('concept'));
  mock.task.eligibilityRequirements = [rule('1', 80)]; const eligible = await readEaItemScores(mock.request, mock.g); assert.ok(eligible.ok); assert.equal(eligible.itemScores.cards.length, 1);
  mock.task.eligibilityRequirements = [rule('99', 80)]; assert.equal((await readEaItemScores(mock.request, mock.g)).ok, false);
  mock.task.eligibilityRequirements = [rule('1', 80), rule('2', 85)]; mock.task.eligibilityOperation = 1; assert.equal((await readEaItemScores(mock.request, mock.g)).ok, false);
  mock.task.eligibilityRequirements = undefined; assert.equal((await readEaItemScores(mock.request, mock.g)).ok, false);
});
test('EA Item Score: sıfır puan, özel kart ve belirsiz oyuncu için reytingden puan uydurulmaz', async () => {
  for (const edit of [(m: any) => m.items[0].sbsScore = 0, (m: any) => m.items[0].isSpecial = () => true, (m: any) => m.catalog.push({ ...m.catalog[0], id: 54321 }), (m: any) => m.items[0].rating = 81]) {
    const mock = fixture(); edit(mock); const result = await readEaItemScores(mock.request, mock.g);
    assert.ok(result.ok); assert.equal(result.itemScores?.cards.length, 0); assert.equal(result.itemScores?.unmatched, 1);
  }
  const mock = fixture(); delete mock.task.submittedScore; assert.equal((await readEaItemScores(mock.request, mock.g)).ok, false);
});
test('EA Item Score: MAIN okuyucusu dış yardımcı olmadan çalışır; oturum hataları yanıta taşınmaz', async () => {
  const compiled = await build({ entryPoints: ['extension/src/eaItemScoreAdapter.ts'], bundle: true, write: false, format: 'iife', globalName: 'adapter', target: 'chrome120' });
  const first: any = {}; runInNewContext(compiled.outputFiles[0].text, first);
  const mock = fixture(), injected = runInNewContext(`(${first.adapter.readEaItemScores.toString()})`, { window: mock.g, setTimeout, clearTimeout });
  const result = await injected(mock.request); assert.ok(result.ok); assert.equal(result.itemScores.cards[0].score, 321);
  mock.g.services.SBC.requestSets = () => { throw new Error('private-secret'); };
  const failed = await injected(mock.request); assert.equal(failed.ok, false); assert.ok(!JSON.stringify(failed).includes('private-secret'));
});
