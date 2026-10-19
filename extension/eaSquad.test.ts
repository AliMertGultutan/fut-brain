import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readEaActiveSquad } from './src/eaSquadAdapter.ts';
import { normalizeEaSquad, eaSquadPlayers, eaPitchRows, officialEaImage } from '../src/services/eaSquad.ts';
import { fixturePlan } from './fixtures.ts';
function runtime() {
  let reads = 0;
  const observable = (data: any) => ({ observe: (_: any, callback: any) => queueMicrotask(() => callback(null, { success: true, data })), unobserve: () => undefined });
  const players = fixturePlan().players;
  const cards = players.map((p, i) => ({ id: 1000 + i, definitionId: 2000 + i, databaseId: 2000 + i, getAssetId: () => 0, rating: p.rating, preferredPosition: p.slot, possiblePositions: [p.slot], concept: false, isPlayer: () => true, getStaticData: () => ({ name: p.name }), getAttributes: () => [70, 65, 60, 64, 60, 70], getMetaData: () => ({ baseTraits: [], iconTraits: [] }), getPlayStyles: () => [], isTradeable: () => false, isSpecial: () => false }));
  const slots = cards.map((item, i) => ({ getIndex: () => i, getGeneralPositionName: () => players[i].slot, isValid: () => true, getItem: () => item }));
  const squad = { getFieldPlayers: () => slots, getPlayers: () => slots, getName: () => 'Ana Kadrom', getFormation: () => ({ getDisplayName: () => '4-3-3' }), getRating: () => 80, getChemistry: () => 31 };
  const g: any = { GAME_NAME: 'fc27', services: { Squad: { requestSquadList: () => { reads++; return observable({ activeSquadId: 12 }); }, requestSquadById: (id: number) => { reads++; assert.equal(id, 12); return observable({ squad }); } } }, repositories: { Squad: { getPosition: (id: string) => ({ getTypeName: () => id }) } } };
  return { g, cards, slots, squad, reads: () => reads };
}
test('EA kadro: aktif kadro, gerçek diziliş ve kart sürümleri yalnızca iki okumayla alınır', async () => {
  const mock = runtime(), result = await readEaActiveSquad(mock.g);
  assert.equal(result.ok, true); assert.equal(mock.reads(), 2);
  const squad = normalizeEaSquad(result.squad); assert.equal(squad.formation, '4-3-3'); assert.equal(squad.slots.length, 11); assert.equal(squad.chemistry, 31);
  assert.equal('assetId' in mock.cards[0], false); assert.equal(squad.slots[0].player!.assetId, mock.cards[0].databaseId); assert.equal(mock.cards[0].getAssetId(), 0);
  assert.deepEqual(eaPitchRows(squad).map(row => row.length), [3, 3, 4, 1]); assert.equal(eaSquadPlayers(squad).length, 11); assert.equal(eaSquadPlayers(squad)[0].statsKnown, false);
  assert.ok(!JSON.stringify(squad).includes('selectedPersona')); assert.ok(!JSON.stringify(squad).includes('cookie'));
});
test('EA kadro: envanter kimliği 0 olan farklı konsept kartlar çakışmaz ve sahiplik üretmez', async () => {
  const mock = runtime(); mock.cards[0].concept = true; mock.cards[0].id = 0; mock.cards[1].concept = true; mock.cards[1].id = 0;
  const result = await readEaActiveSquad(mock.g); assert.equal(result.ok, true);
  const squad = normalizeEaSquad(result.squad); assert.equal(squad.slots[0].player!.id, 'concept:2000'); assert.equal(squad.slots[1].player!.id, 'concept:2001'); assert.equal(eaSquadPlayers(squad).length, 9);
  assert.deepEqual(normalizeEaSquad(squad), squad);
});
test('EA kadro: boş statik isim gerçek EA kataloğundan tamamlanır; tam ad korunur', async () => {
  const mock = runtime(); mock.cards[0].getStaticData = () => ({ name: '' }); mock.cards[1].getStaticData = () => ({ name: 'Soyad', getFullName: () => 'Ad Soyad' });
  mock.g.repositories.Item = { getStaticDataByDefId: (id: number) => id === 2000 ? { name: 'Katalog Oyuncusu' } : undefined };
  const result = await readEaActiveSquad(mock.g); assert.equal(result.ok, true);
  const squad = normalizeEaSquad(result.squad); assert.equal(squad.slots[0].player!.name, 'Katalog Oyuncusu'); assert.equal(squad.slots[1].player!.name, 'Ad Soyad');
});

test('EA kadro: kart türü 0 olsa da databaseId korunur, özel kart sürümü oyuncu kimliğiyle karışmaz', async () => {
  const mock = runtime(); mock.cards[1].definitionId = 16779217;
  const result = await readEaActiveSquad(mock.g); assert.equal(result.ok, true);
  const squad = normalizeEaSquad(result.squad), player = squad.slots[1].player!;
  assert.equal(player.assetId, 2001); assert.equal(player.definitionId, 16779217);
  assert.equal(eaSquadPlayers(squad)[1].basePlayerId, 'ea:2001');
  for (const [field, code] of [['id', 'EA-ID-01'], ['definitionId', 'EA-ID-02'], ['assetId', 'EA-ID-03']]) {
    const invalid = structuredClone(squad); (invalid.slots[1].player as any)[field] = field === 'id' ? '0' : 0;
    assert.throws(() => normalizeEaSquad(invalid), new RegExp(code));
  }
});
test('EA kadro: konsept kart sahiplik sayılmaz; eksik metadata uydurulmaz', async () => {
  const mock = runtime(); mock.cards[0].concept = true; mock.cards[1].getMetaData = () => null as any;
  const result = await readEaActiveSquad(mock.g); if (!result.ok) throw new Error(result.message);
  const squad = normalizeEaSquad(result.squad);
  assert.equal(eaSquadPlayers(squad).length, 10); assert.equal(squad.slots[1].player!.playStylesKnown, false);
  assert.throws(() => normalizeEaSquad({ ...squad, slots: [...squad.slots.slice(0, 10), squad.slots[0]] }));
});
test('EA kadro: giriş yapılmamışsa açık hata; MAIN fonksiyonu dış yardımcı olmadan çalışır', async () => {
  assert.equal((await readEaActiveSquad({ GAME_NAME: 'fc26' })).ok, false);
  const mock = runtime(), fn = runInNewContext(`(${readEaActiveSquad.toString()})`, { window: mock.g, setTimeout, clearTimeout });
  assert.equal((await fn()).ok, true); assert.equal(mock.reads(), 2);
});

test('EA saha: sol-sağ yerleşimi EA slot sırasından gelir; kimya ve resmi görsel korunur', async () => {
  const mock = runtime();
  (mock.slots[1] as any).getChemistry = () => 2; (mock.slots[1] as any).getUniquePositionName = () => 'RST';
  mock.g.AssetLocationUtils = { getPortraitImageUri: (id: number) => `https://media.contentapi.ea.com/players/${id}.png`, getShellUri: () => 'https://www.ea.com/cards/gold.png' };
  const result = await readEaActiveSquad(mock.g); assert.ok(result.ok); const data = normalizeEaSquad(result.squad);
  assert.equal(data.slots[1].chemistry, 2); assert.equal(data.slots[1].uniquePosition, 'RST'); assert.equal(data.slots[0].chemistry, null);
  assert.equal(data.slots[1].player!.portraitUrl, 'https://media.contentapi.ea.com/players/2001.png');
  const eaPositions = ['GK','RB','CB','CB','LB','CM','CM','CM','CAM','ST','ST'];
  data.formation = '4-3-1-2'; data.slots = data.slots.map((s, i) => ({ ...s, position: eaPositions[i] }));
  assert.deepEqual(eaPitchRows(data).map(row => row.map(s => s.index)), [[10,9],[8],[7,6,5],[4,3,2,1],[0]]);
  for (const url of ['', 'javascript:alert(1)', 'https://ea.com.evil.example/photo.png', 'https://www.ea.com/photo.png?token=secret', 'https://user:pass@www.ea.com/photo.png']) assert.equal(officialEaImage(url), '');
});

test('EA PlayStyle: yerelleştirilmiş gerçek ad, normal/+ ayrımı ve doğru EA açıklaması alınır', async () => {
  const mock = runtime();
  (mock.cards[1] as any).getPlayStyles = () => [{ traitId: 1, isIcon: false }, { traitId: 21, isIcon: true }];
  const messages: Record<string, string> = { 'extendedPlayerInfo.signatureAbility.name.1': 'Power Shot', 'extendedPlayerInfo.signatureAbility.desc.1.baseTrait': 'EA normal güç şutu açıklaması', 'extendedPlayerInfo.signatureAbility.name.21': 'Rapid', 'extendedPlayerInfo.signatureAbility.desc.21.iconTrait': 'EA geliştirilmiş hız açıklaması' };
  mock.g.services.Localization = { localize: (key: string) => messages[key] || key };
  const result = await readEaActiveSquad(mock.g); assert.ok(result.ok);
  const card = normalizeEaSquad(result.squad).slots[1].player!;
  assert.deepEqual(card.playStyles, ['Power Shot', 'Rapid+']);
  assert.deepEqual(card.playStyleDetails, [{ id: 1, name: 'Power Shot', isPlus: false, description: 'EA normal güç şutu açıklaması' }, { id: 21, name: 'Rapid', isPlus: true, description: 'EA geliştirilmiş hız açıklaması' }]);
  assert.deepEqual(normalizeEaSquad(normalizeEaSquad(result.squad)), normalizeEaSquad(result.squad));
});

test('EA bakiye: yalnız coin okunur; sıfır bakiye korunur, eksik ve geçersiz bakiye uydurulmaz', async () => {
  const mock = runtime(); mock.g.GameCurrency = { COINS: 'COINS', POINTS: 'POINTS' };
  let balance: any = 17704;
  mock.g.services.User = { getUser: () => ({ getCurrencies: () => [{ type: 'POINTS', amount: 9999 }, { type: 'COINS', amount: balance }], email: 'private-secret' }) };
  for (const [source, expected] of [[17704, 17704], [0, 0], [-1, null], [undefined, null], ['123', null]]) {
    balance = source; const result = await readEaActiveSquad(mock.g); assert.ok(result.ok);
    const squad = normalizeEaSquad(result.squad); assert.equal(squad.coinsBalance, expected); assert.ok(!JSON.stringify(squad).includes('private-secret'));
  }
});
