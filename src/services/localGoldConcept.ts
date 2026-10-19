import type { Player } from '../types/index.ts';
import type { RemoteSbcSet, RemoteSbcSegment } from './sbcData.ts';
import type { MarketPlatform } from './parseAdapter.ts';
import type { ConceptSquad } from './conceptSquad.ts';
import { isBaseCard, validateEaPlan } from './eaBridgeProtocol.ts';
export function supportsLocalGold(set: RemoteSbcSet, segment: RemoteSbcSegment) {
  return set.year === '27' && !set.expired && set.detailsLoaded && !set.detailsError && segment.identityVerified && segment.rules.raw.length === 2 && segment.rules.raw.some(line => /^Player Level:\s*Exactly Gold$/i.test(line)) && segment.rules.raw.some(line => /^# of players in squad:\s*10$/i.test(line));
}
export function localGoldConcept(set: RemoteSbcSet, segment: RemoteSbcSegment, pool: Player[], platform: MarketPlatform): ConceptSquad {
  if (!supportsLocalGold(set, segment)) throw new Error('Yerel altın kart çözümü yalnızca 10 oyuncu ve tam altın seviyesi şartlı görevleri destekler.');
  const sorted = pool.filter(p => p.gameYear === '27' && p.pricePlatform === platform && !p.inClub && !p.isSpecial && p.rating >= 75 && p.rating <= 99 && /^[1-9]\d{0,9}$/.test(p.futbinId || '') && isBaseCard(p.cardVersion || '') && Number.isInteger(p.price) && p.price > 0 && p.priceStatus !== 'DEMO' && p.priceStatus !== 'UNAVAILABLE').sort((a, b) => a.price - b.price);
  const names = new Set<string>(), cards: Player[] = [];
  for (const p of sorted) { const identity = p.name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, ''); if (!names.has(identity)) { names.add(identity); cards.push(p); } if (cards.length === 10) break; }
  if (cards.length !== 10) throw new Error(`Bu platformun kayıtlı kataloğunda fiyatı bilinen ${cards.length}/10 standart altın kart var. “Altın Kart Havuzunu Getir” ile katalog sayfası getir veya sonraki sayfayı ekle.`);
  const time = new Date().toISOString();
  return { year: '27', platform, engine: 'LOCAL_GOLD', setId: set.id, segmentId: segment.id, sbcName: set.name, challengeName: segment.name, sourceUrl: set.url, found: true, formation: 'EA', fetchedAt: time, cached: true, credits: 0, maxAgeMinutes: 60, timestamp: time, reason: '', totalCost: cards.reduce((sum, p) => sum + p.price, 0), rating: null, chemistry: null, searchComplete: true, optimalWithinPool: true, outcome: 'local_gold_pool',
    players: cards.map(p => ({ id: p.futbinId!, name: p.name, rating: p.rating, level: 'Gold', version: p.cardVersion!, position: 'AUTO', positions: [p.position, ...(p.secondaryPositions || [])], inPosition: false, chemistry: 0, club: p.club, league: p.league, nation: p.nation, price: p.price, updatedAt: p.priceUpdatedAt || '', url: '' })),
    checks: segment.rules.raw.map(requirement => ({ requirement, actual: '10', satisfied: true })) };
}
export function goldCatalogPlan(set: RemoteSbcSet, segment: RemoteSbcSegment, platform: MarketPlatform) {
  if (!supportsLocalGold(set, segment)) throw new Error('Bu görev otomatik altın kart seçimi için uygun değil.');
  return validateEaPlan({ version: 1, mode: 'CONCEPT_ONLY', year: '27', platform, placement: 'OPEN_SLOTS', catalogGold: true, createdAt: Date.now(), setName: set.name, challengeName: segment.name, formation: 'EA', sourceFetchedAt: set.detailsFetchedAt || new Date().toISOString(), expectedRating: 0, expectedChemistry: 0, estimatedCoins: 0, players: [] });
}
