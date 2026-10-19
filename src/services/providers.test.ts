import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ClubDataProvider, ItemTokenProvider, SettingsProvider, SquadProvider, EvolutionTrackingProvider, parseCsv } from './providers.ts';
import { squadSlots, optimizeSquadPositions, createInitialSquad } from './squad.ts';
import { calculateSquadChemistry } from './sbcSolver.ts';
import { INITIAL_PLAYERS } from '../data/mockData.ts';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
} });
beforeEach(() => memory.clear());
const rules = { allowedRatings: [87, 88, 89], chemistry: 0, fragmentCost: 7, fragmentTokenRating: 87 as const, source: 'MANUAL' as const };

test('CSV tırnaklı virgül, tırnak kaçışı ve çok satırlı hücreleri korur', () => {
  assert.deepEqual(parseCsv('name,rating,position\n"Ali, Mert",87,CM\n"A ""B""",85,ST'), [['name', 'rating', 'position'], ['Ali, Mert', '87', 'CM'], ['A "B"', '85', 'ST']]);
  assert.throws(() => parseCsv('name\n"a'));
});
test('İçe aktarma gerçek alanları korur, eksik istatistik üretmez ve demo kartları ayırır', () => {
  const result = ClubDataProvider.importData(JSON.stringify([{ id: 'custom', name: 'Test', rating: 88, position: 'CM', league: 'L', nation: 'N', club: 'C', inClub: false, price: 1200 }]), 'json');
  assert.equal(result.success, true);
  assert.equal(result.updatedPlayers.length, 1);
  assert.equal(result.updatedPlayers[0].priceStatus, 'MANUAL');
  assert.equal(result.updatedPlayers[0].inClub, false);
  assert.equal(result.updatedPlayers[0].statsKnown, false);
  assert.equal(result.updatedPlayers[0].league, 'L');
});
test('Eksik fiyat canlı ya da ücretsiz olarak etiketlenmez', () => {
  const result = ClubDataProvider.importData('name,rating,position\nTest,87,CM', 'csv');
  assert.equal(result.success, true);
  assert.equal(result.updatedPlayers[0].priceStatus, 'UNAVAILABLE');
  assert.equal(result.updatedPlayers[0].nation, '');
});
test('Geçersiz reyting, mevki, negatif fiyat ve JSON null reddedilir', () => {
  for (const item of [null, { name: 'A', rating: 100, position: 'CM' }, { name: 'A', rating: 87, position: 'BAD' }, { name: 'A', rating: 87, position: 'CM', price: -1 }]) {
    assert.equal(ClubDataProvider.importData(JSON.stringify(item), 'json').success, false);
  }
  assert.equal(ClubDataProvider.importData('{bad', 'json').success, false);
});
test('Tekrar içe aktarma kayıt çoğaltmaz; kart versiyonları ayrı kimlikle korunur', () => {
  const text = JSON.stringify([{ id: 'one', basePlayerId: 'same', name: 'A', rating: 87, position: 'CM' }, { id: 'two', basePlayerId: 'same', name: 'A', rating: 88, position: 'CM' }]);
  ClubDataProvider.importData(text, 'json');
  const second = ClubDataProvider.importData(text, 'json');
  assert.equal(second.updatedPlayers.length, 2);
});
test('Aynı dosyada tekrarlanan kimlik ve hatalı satır açıklanır', () => {
  const result = ClubDataProvider.importData('[{"id":"a","name":"A","rating":87,"position":"CM"},{"id":"a","name":"A","rating":87,"position":"CM"},null]', 'json');
  assert.equal(result.importedCount, 1); assert.equal(result.errorCount, 2);
});
test('Parça dönüşümü yalnızca yapılandırılmış oranı uygular ve 87 jetonunu günceller', () => {
  const inventory = { tokens87Plus: 0, tokens88Plus: 0, tokens89Plus: 0, fragments: 8 };
  const converted = ItemTokenProvider.convertFragments(inventory, rules);
  assert.equal(converted.success, true); assert.equal(converted.updated.fragments, 1); assert.equal(converted.updated.tokens87Plus, 1);
  assert.equal(inventory.fragments, 8);
  assert.equal(ItemTokenProvider.getInventory().fragments, 1);
});
test('Dönüşüm kuralı, stok ve oran hataları envanteri değiştirmez', () => {
  const inventory = { tokens87Plus: 0, tokens88Plus: 0, tokens89Plus: 0, fragments: 6 };
  for (const invalid of [undefined, { ...rules, fragmentCost: 0 }, rules]) assert.equal(ItemTokenProvider.convertFragments(inventory, invalid).success, false);
  assert.throws(() => ItemTokenProvider.saveInventory({ ...inventory, fragments: -1 }));
  assert.equal(memory.has('fut_brain_tokens'), false);
});
test('Kadro kaydı tekrar okunabilir ve tekrarlanan oyuncuyu reddeder', () => {
  const saved = { formation: '4-4-2', ids: { lf: 'p_haaland', st: 'p_mbappe' }, savedAt: '2026-10-18T12:00:00Z' };
  SquadProvider.save(saved); assert.deepEqual(SquadProvider.getSaved(), saved);
  assert.throws(() => SquadProvider.save({ ...saved, ids: { lf: 'same', st: 'same' } }));
});
test('Varsayılan oyuncu kulüpte yoksa başlangıç kadrosu aynı oyuncuyu iki kez seçmez', () => {
  const owned = INITIAL_PLAYERS.filter(p => p.inClub);
  const ids = Object.values(createInitialSquad(owned)).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => owned.some(p => p.id === id)));
});
test('Farklı dizilişler gerçek slot pozisyonlarını değiştirir; eşleme kimyayı düşürmez', () => {
  const ids = { lf: 'p_haaland', st: 'p_mbappe', rf: 'p_salah', lcm: 'p_rodri', cm: 'p_bellingham', rcm: 'p_debruyne', lb: 'p_theo', lcb: 'p_vandijk', rcb: 'p_saliba', rb: 'p_walker', gk: 'p_alisson' };
  const a = squadSlots(ids, '4-4-2', INITIAL_PLAYERS), b = squadSlots(ids, '3-5-2', INITIAL_PLAYERS);
  assert.notDeepEqual(a.map(s => s.position), b.map(s => s.position));
  assert.ok(calculateSquadChemistry(optimizeSquadPositions(a)).totalChemistry >= calculateSquadChemistry(a).totalChemistry);
});
test('Evolution takibi kalıcıdır ve aynı kaydı çoğaltmaz', () => {
  const entry = { programId: 'evo', playerId: 'p', playerName: 'A', programName: 'B', savedAt: '2026-10-18T12:00:00Z' };
  EvolutionTrackingProvider.add(entry); EvolutionTrackingProvider.add(entry);
  assert.deepEqual(EvolutionTrackingProvider.getAll(), [entry]);
});
test('Eski simülasyon ayarı ve eski canlı fiyat etiketleri canlı bağlantı üretmez', () => {
  memory.set('fut_brain_settings', JSON.stringify({ dataSourceMode: 'LIVE_SIMULATED', marketApiStatus: 'CONNECTED' }));
  assert.equal(SettingsProvider.getSettings().marketApiStatus, 'DISCONNECTED');
  memory.set('fut_brain_players', JSON.stringify([{ ...INITIAL_PLAYERS[0], priceStatus: 'LIVE' }]));
  assert.equal(ClubDataProvider.getPlayers()[0].priceStatus, 'DEMO');
});
test('Depolama hatası sahte başarılı kayıt döndürmez', () => {
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('Depolama dolu.'); };
  try {
    assert.throws(() => SquadProvider.save({ formation: '4-4-2', ids: {}, savedAt: '' }));
    const result = ItemTokenProvider.convertFragments({ tokens87Plus: 0, tokens88Plus: 0, tokens89Plus: 0, fragments: 10 }, rules);
    assert.equal(result.success, false);
  } finally { globalThis.localStorage.setItem = original; }
});
