import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
test('Ürün ekranı: EVO detayında kendi oyuncu araması bulunur; dış kaynak bağlantısı gösterilmez', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { LiveEvolutionsView } from './src/components/views/LiveEvolutionsView.tsx';
    import { EaTransferPanel } from './src/components/EaTransferPanel.tsx';
    const market = { year: '27', platform: 'pc', evolutionPage: null, players: [], busy: false, status: { configured: true }, setContext() {}, loadEvolutions() {}, loadPlayers() {} };
    const evo = renderToStaticMarkup(React.createElement(LiveEvolutionsView, { market }));
    const plan = { version: 1, mode: 'CONCEPT_ONLY', year: '27', platform: 'pc', placement: 'OPEN_SLOTS', catalogGold: true, createdAt: Date.now(), setName: '3x Upgrade', challengeName: '3x Upgrade', formation: 'EA', sourceFetchedAt: new Date().toISOString(), expectedRating: 0, expectedChemistry: 0, estimatedCoins: 0, players: [] };
    module.exports = { evo, gold: renderToStaticMarkup(React.createElement(EaTransferPanel, { goldPlan: plan })) };
  `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node24', external: ['react', 'react/*', 'react-dom/*'] });
  const context: any = { require: createRequire(import.meta.url), module: { exports: {} }, location: { hash: '#evolutions/27/59' } };
  runInNewContext(compiled.outputFiles[0].text, context);
  const { evo, gold } = context.module.exports;
  assert.ok(evo.includes('Speed Bump')); assert.ok(evo.includes('Bu EVO’ya oyuncu uygun mu?')); assert.ok(evo.includes('Oyuncu Ara')); assert.ok(!/futbin/i.test(evo));
  assert.ok(gold.includes('10 altın konsept kart')); assert.ok(gold.includes('Piyasa fiyatı taranmaz')); assert.ok(!gold.includes('0 coins'));
});

test('EA kadro ekranı: gerçek diziliş ve kimya gösterilir; kartlar klavyeyle seçilebilir ve sahte fotoğraf yoktur', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { EaActiveSquadPanel } from './src/components/EaActiveSquadPanel.tsx';
    const positions = ['GK','RB','CB','CB','LB','CM','CM','CM','CAM','ST','ST'];
    const squad = { name: 'FENERBAHCE', formation: '4-3-1-2', rating: 84, chemistry: 31, observedAt: new Date().toISOString(), slots: positions.map((position, index) => ({ index, position, chemistry: 2, player: { id: String(index + 1), name: 'Player ' + position + index, rating: 82, concept: false, portraitUrl: 'https://media.contentapi.ea.com/player/' + index + '.png' } })), bench: [] };
    module.exports = renderToStaticMarkup(React.createElement(EaActiveSquadPanel, { bridge: { squad, message: 'EA verisi', busy: false, installed: true, refresh() {} } }));
  `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node24', external: ['react', 'react/*', 'react-dom/*'] });
  const context: any = { require: createRequire(import.meta.url), module: { exports: {} } };
  runInNewContext(compiled.outputFiles[0].text, context); const html = context.module.exports;
  assert.ok(html.includes('4-3-1-2')); assert.ok(html.includes('31/33 kimya')); assert.ok(html.includes('2/3'));
  assert.equal((html.match(/aria-pressed="false"/g) || []).length, 11);
  assert.ok(html.indexOf('Player LB4') < html.indexOf('Player RB1')); assert.ok(!html.includes('lh3.googleusercontent.com')); assert.ok(!html.includes('FC25'));
  assert.ok(html.includes('Oyuncunu seç')); assert.ok(html.includes('focus-visible'));
});

test('PlayStyle ekranı: gerçek simgeler, okunabilir adlar, açıklamalar ve + ayrımı gösterilir', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { EaPlayStylesPanel } from './src/components/EaPlayStylesPanel.tsx';
    const styles = [{ id: 1, name: 'Power Shot', isPlus: false, description: 'Normal etki' }, { id: 21, name: 'Rapid', isPlus: true, description: 'Geliştirilmiş etki' }];
    module.exports = { filled: renderToStaticMarkup(React.createElement(EaPlayStylesPanel, { styles, known: true })), missing: renderToStaticMarkup(React.createElement(EaPlayStylesPanel, { known: false })), old: renderToStaticMarkup(React.createElement(EaPlayStylesPanel, { known: true, legacyCount: 5 })) };
  `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node24', external: ['react', 'react/*', 'react-dom/*'] });
  const context: any = { require: createRequire(import.meta.url), module: { exports: {} } }; runInNewContext(compiled.outputFiles[0].text, context);
  const { filled, missing, old } = context.module.exports;
  for (const text of ['Power Shot', 'Rapid', 'Normal etki', 'Geliştirilmiş etki', 'basetrait1.png', 'icontrait21.png', 'PlayStyle+']) assert.ok(filled.includes(text));
  assert.ok(!filled.includes('PS 1')); assert.ok(!filled.includes('sprint')); assert.ok(missing.includes('verisi okunamadı')); assert.ok(old.includes('Ad ve simgeleri almak'));
});

test('Clubs ekranı: boş durumda canlı veri uydurulmaz; oyuncu sıralaması ve maç ayrıntıları okunabilir', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ClubsView, ClubsMembers, ClubsMatches } from './src/components/views/ClubsView.tsx';
    const members = [{ name: 'Test Player', proName: 'Test Pro', position: 'forward', games: 4, goals: 0, assists: 2, rating: 8.2, passRate: 81, tackleRate: null, motm: 1 }];
    const matches = [{ id: '1', type: 'friendlyMatch', playedAt: '2026-10-19T01:00:00Z', opponent: 'Test Rakip', goals: 2, conceded: 1, result: 'win', dnf: false, players: [{ id: '2', name: 'Test Player', rating: 8.2, goals: 2, assists: 0, passes: 4, passAttempts: 5, tackles: 1, motm: true }] }];
    module.exports = { empty: renderToStaticMarkup(React.createElement(ClubsView)), members: renderToStaticMarkup(React.createElement(ClubsMembers, { members })), matches: renderToStaticMarkup(React.createElement(ClubsMatches, { matches })) };
  `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node24', external: ['react', 'react/*', 'react-dom/*'] });
  const context: any = { require: createRequire(import.meta.url), module: { exports: {} }, location: { hash: '#clubs' }, localStorage: { getItem: () => null } };
  runInNewContext(compiled.outputFiles[0].text, context); const html = context.module.exports;
  assert.ok(html.empty.includes('Önce kulübünü seç')); assert.ok(html.empty.includes('Kulüp Ara')); assert.ok(!html.empty.includes('EA’DAN ALINDI')); assert.ok(!html.empty.includes('173'));
  assert.ok(html.members.includes('Test Player')); assert.ok(html.members.includes('aria-sort="descending"')); assert.ok(html.members.includes('81%')); assert.ok(html.members.includes('0</td>'));
  assert.ok(html.matches.includes('Test Rakip')); assert.ok(html.matches.includes('2–1')); assert.ok(html.matches.includes('Galibiyet')); assert.ok(html.matches.includes('Maçın oyuncusu')); assert.ok(html.matches.includes('<summary'));
});

test('Kompakt katalog: tek tablo, gelişmiş filtreler, bilinen özellikler ve ücretsiz inceleme ayrı gösterilir', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { PlayerCatalogView } from './src/components/PlayerCatalogView.tsx';
    import { PlayerDetailView } from './src/components/PlayerDetailView.tsx';
    const card = { id: 'futbin:27:1', futbinId: '1', gameYear: '27', pricePlatform: 'pc', name: 'Test Card', commonName: 'Test', rating: 85, position: 'CM', secondaryPositions: ['CAM'], club: 'Test Club', league: 'Test League', nation: 'Türkiye', cardType: 'BASE', cardVersion: 'Normal', isSpecial: false, inClub: false, price: 1200, priceSource: 'Test', priceStatus: 'LIVE', priceUpdatedAt: new Date().toISOString(), statsKnown: true, stats: { pace: 80, shooting: 81, passing: 82, dribbling: 83, defending: 84, physical: 85 }, playStylesKnown: true, playStyles: ['Rapid+'] };
    const unknown = { ...card, id: 'futbin:27:2', name: 'Unknown Stats', price: 0, priceStatus: 'UNAVAILABLE', statsKnown: false, playStylesKnown: false, stats: { pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0 } };
    const market = { players: [card,unknown], page: { players: [card,unknown], page: 1, paginationKnown: true, hasMore: true }, status: { configured: true, creditsAttempted: 1, sessionCreditLimit: 50 }, year: '27', platform: 'pc', busy: false, lastQuery: '', setContext() {}, loadPlayers() { throw new Error('Kendiliğinden kaynak çağrısı olmamalı'); } };
    module.exports = { renderRoute(hash) { globalThis.location = { hash }; return renderToStaticMarkup(React.createElement(PlayerCatalogView, { market, clubPlayers: [{...card, id:'ea:12', inClub:true}] })); }, page: renderToStaticMarkup(React.createElement(PlayerCatalogView, { market })), detail: renderToStaticMarkup(React.createElement(PlayerDetailView, { player: {...card, detailedStats: { acceleration: 79, sprintSpeed: 81 }}, market, owned: false, onBack() {} })), unknown: renderToStaticMarkup(React.createElement(PlayerDetailView, { player: unknown, market, owned: false, onBack() {} })), keeper: renderToStaticMarkup(React.createElement(PlayerDetailView, { player: {...card, position: 'GK'}, market, owned: true, onBack() {} })) };
  `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', target: 'node24', external: ['react', 'react/*', 'react-dom/*'] });
  const context: any = { require: createRequire(import.meta.url), module: { exports: {} }, localStorage: { getItem: () => null } };
  runInNewContext(compiled.outputFiles[0].text, context); const { page,detail,unknown,keeper,renderRoute } = context.module.exports;
  assert.equal((page.match(/<table/g)||[]).length,1);
  for(const label of ['Mevki','Kart sürümü','Lig','Ülke','Kulüp','Oyun tarzı','Fiyat (coins)','En düşük HIZ','Yüklenen tüm pazar kartları','Kompakt satırlar'])assert.ok(page.includes(label),label);
  assert.ok(page.includes('filterleme') || page.includes('filtreleme ücretsiz'));assert.ok(page.includes('Unknown Stats'));assert.ok(page.includes('Fiyat yok'));assert.ok(page.includes('İncele'));assert.ok(page.includes('aria-sort="descending"'));
  assert.ok(!page.includes('Premier League Özel Kartları'));assert.ok(!page.includes('lh3.googleusercontent.com'));assert.ok(!page.includes('PS 1'));
  assert.ok(page.includes('Fut Players'));assert.ok(!page.includes('FUT Gallery'));assert.ok(!page.includes('colSpan="13"'));
  for (const text of ['Fut Players’a dön','Test Club','Test League','Türkiye','PC','Oyuncu özellikleri','Hızlanma','Sprint hızı','Rapid+','En fazla 1 kredi','79','81']) {
    assert.ok(detail.includes(text),text);
  }
  assert.ok(!detail.includes('<table'));assert.ok(!detail.includes('aria-expanded'));assert.ok(!detail.includes('Parse / FUTBIN'));
  assert.ok(unknown.includes('Bu kartın oyun tarzları henüz alınmadı'));assert.ok(!unknown.includes('>0</strong>'));assert.ok(!unknown.includes('>0</dd>'));assert.ok(unknown.includes('Fiyat bilgisi henüz alınmadı'));
  for(const route of ['#fut-players/market/futbin%3A27%3A1','#fut-gallery/market/futbin%3A27%3A1']) {
    const selected = renderRoute(route); assert.ok(selected.includes('Test Card oyuncu detayları'));assert.ok(!selected.includes('<table'));
  }
  assert.ok(renderRoute('#fut-players/club/ea%3A12').includes('Kulübündeki kart'));
  assert.ok(renderRoute('#fut-players/market/not-loaded').includes('Kart bu oturumda yüklü değil'));
  assert.equal((renderRoute('#fut-players').match(/<table/g)||[]).length,1);
  assert.ok(keeper.includes('ayrıntılı kaleci özelliklerini içermiyor'));assert.ok(!keeper.includes('Hızlanma'));assert.ok(!keeper.includes('Fiyat ve özellikleri yenile'));
});
