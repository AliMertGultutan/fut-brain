import type { Player } from '../types/index.ts';
export interface ItemScoreRequest { setName: string; segmentName: string; cards: { key: string; name: string; commonName: string; rating: number }[] }
export interface ItemScoreData { target: number; submitted: number; observedAt: string; setName: string; cards: { key: string; definitionId: number; rating: number; score: number }[]; unmatched: number }
export function normalizeItemScoreRequest(value: any): ItemScoreRequest {
  const label = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 150;
  if (!value || !label(value.setName) || !label(value.segmentName) || !Array.isArray(value.cards) || value.cards.length > 60) throw new Error('Puan isteği geçersiz.');
  const keys = new Set<string>();
  const cards = value.cards.map((c: any) => {
    if (typeof c?.key !== 'string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(c.key) || keys.has(c.key) || !label(c.name) || typeof c.commonName !== 'string' || c.commonName.length > 150 || !Number.isInteger(c.rating) || c.rating < 1 || c.rating > 99) throw new Error('Puan isteğindeki kart doğrulanamadı.');
    keys.add(c.key); return { key: c.key, name: c.name, commonName: c.commonName, rating: c.rating };
  });
  return { setName: value.setName, segmentName: value.segmentName, cards };
}
export function normalizeItemScoreData(value: any): ItemScoreData {
  if (!value || !Number.isInteger(value.target) || value.target < 1 || value.target > 100000 || !Number.isSafeInteger(value.submitted) || value.submitted < 0 || typeof value.setName !== 'string' || !value.setName.trim() || value.setName.length > 150 || typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)) || !Array.isArray(value.cards) || value.cards.length > 60 || !Number.isInteger(value.unmatched) || value.unmatched < 0 || value.unmatched + value.cards.length > 60) throw new Error('EA Item Score yanıtı doğrulanamadı.');
  const ids = new Set<string>();
  const cards = value.cards.map((c: any) => {
    if (typeof c?.key !== 'string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(c.key) || ids.has(c.key) || !Number.isSafeInteger(c.definitionId) || c.definitionId < 1 || !Number.isInteger(c.rating) || c.rating < 1 || c.rating > 99 || !Number.isInteger(c.score) || c.score < 1 || c.score > 10000000) throw new Error('EA kart puanı doğrulanamadı.');
    ids.add(c.key); return { key: c.key, definitionId: c.definitionId, rating: c.rating, score: c.score };
  });
  return { target: value.target, submitted: value.submitted, observedAt: value.observedAt, setName: value.setName, cards, unmatched: value.unmatched };
}
export function scorePricePool(players: Player[], year: string, platform: string, now = Date.now()) {
  return players.filter(p => p.gameYear === year && p.pricePlatform === platform && p.price > 0 && ['LIVE','CACHED'].includes(p.priceStatus) && Number.isFinite(Date.parse(p.priceUpdatedAt)) && now - Date.parse(p.priceUpdatedAt) >= -60000 && now - Date.parse(p.priceUpdatedAt) <= 30 * 60000 && !p.isSpecial && ['BASE','GOLD_RARE'].includes(p.cardType) && !p.inClub).sort((a,b) => a.price - b.price);
}
export function scoreCandidates(players: Player[]) {
  // Tek reytinge yığılmadan, farklı puan seviyelerindeki ucuz kartları karşılaştır.
  const seen = new Set<string>(), counts = new Map<string, number>();
  return players.filter(p => {
    const key = p.basePlayerId || p.id, tier = `${p.rating}:${p.cardType === 'GOLD_RARE' || /rare/i.test(p.cardVersion || '') ? 'rare' : 'normal'}`;
    if (seen.has(key) || (counts.get(tier) || 0) >= 2) return false;
    seen.add(key); counts.set(tier, (counts.get(tier) || 0) + 1); return true;
  }).slice(0, 60);
}
export function solveItemScore(data: ItemScoreData, pool: Player[]) {
  const target = Math.max(0, data.target - data.submitted);
  const quotes = data.cards.flatMap(c => { const player = pool.find(p => p.id === c.key && p.rating === c.rating); return player ? [{ player, score: c.score }] : []; });
  const bestByScore = new Map<number, typeof quotes[number]>();
  for (const q of quotes) if (!bestByScore.has(q.score) || bestByScore.get(q.score)!.player.price > q.player.price) bestByScore.set(q.score, q);
  const choices = [...bestByScore.values()], costs = new Float64Array(target + 1).fill(Infinity), parents = new Int32Array(target + 1).fill(-1), items = new Int32Array(target + 1).fill(-1);
  costs[0] = 0;
  for (let score = 0; score < target; score++) if (Number.isFinite(costs[score])) for (let i = 0; i < choices.length; i++) {
    const next = Math.min(target, score + choices[i].score), cost = costs[score] + choices[i].player.price;
    if (cost < costs[next]) { costs[next] = cost; parents[next] = score; items[next] = i; }
  }
  if (!Number.isFinite(costs[target])) return null;
  const quantities = new Map<number, number>(); let cursor = target;
  while (cursor > 0) { const i = items[cursor]; if (i < 0 || parents[cursor] >= cursor) return null; quantities.set(i, (quantities.get(i) || 0) + 1); cursor = parents[cursor]; }
  const rows = [...quantities].map(([i, quantity]) => ({ ...choices[i], quantity }));
  return { coins: costs[target], score: rows.reduce((sum, r) => sum + r.score * r.quantity, 0), rows, ranking: quotes.sort((a,b) => a.player.price / a.score - b.player.price / b.score) };
}
