import type { Player, PlayerPosition, SbcChallenge, SbcChecklistItem, SbcRequirement, SbcSlot, SbcSolution, SolverStrategy, TokenInventory } from '../types/index.ts';
import { parseSbcRules } from './sbcData.ts';

export const FORMATION_433_ATTACK: Array<{ id: string; pos: PlayerPosition }> = [
  { id: 'pos_lw', pos: 'LW' }, { id: 'pos_st', pos: 'ST' }, { id: 'pos_rw', pos: 'RW' },
  { id: 'pos_cm1', pos: 'CM' }, { id: 'pos_cm2', pos: 'CM' }, { id: 'pos_cm3', pos: 'CAM' },
  { id: 'pos_lb', pos: 'LB' }, { id: 'pos_cb1', pos: 'CB' }, { id: 'pos_cb2', pos: 'CB' },
  { id: 'pos_rb', pos: 'RB' }, { id: 'pos_gk', pos: 'GK' },
];

// Kesirli ortalama + pozitif farklar: temkinli topluluk modeli, resmî formül iddiası yok.
export function calculateSquadRating(ratings: number[]) {
  if (!ratings.length) return { average: 0, excess: 0, rawScore: 0, effectiveRatingRounded: 0, effectiveRatingExact: 0 };
  if (ratings.some(r => !Number.isInteger(r) || r < 0 || r > 99)) throw new Error('Reytingler 0–99 arasında tam sayı olmalı.');
  const sum = ratings.reduce((a, b) => a + b, 0), average = sum / ratings.length;
  const excess = ratings.reduce((n, r) => n + Math.max(0, r - average), 0), rawScore = sum + excess;
  return { average, excess, rawScore, effectiveRatingExact: rawScore / ratings.length, effectiveRatingRounded: Math.floor(rawScore / ratings.length + 1e-9) };
}
export const positionMatches = (p: Player, pos: PlayerPosition) => p.position === pos || Boolean(p.secondaryPositions?.includes(pos));
const identity = (p: Player) => p.basePlayerId || p.name.trim().toLocaleLowerCase('en-US') || p.id;
const known = (v: string) => Boolean(v && !['Bilinmiyor', 'İçe Aktarılan', 'Global', 'Kulüp'].includes(v));
export const hasUsablePrice = (p: Player) => Number.isFinite(p.price) && p.price > 0 && p.priceStatus !== 'UNAVAILABLE';
const add = (map: Record<string, number>, key: string, n = 1) => { if (known(key)) map[key] = (map[key] || 0) + n; };
const threshold = (n: number, values: number[]) => values.filter(v => n >= v).length;

// FC25 temel kimya profili; teknik direktör ve kampanya bonusları kapsam dışı.
export function calculateSquadChemistry(slots: SbcSlot[]) {
  const clubCounts: Record<string, number> = {}, leagueCounts: Record<string, number> = {}, nationCounts: Record<string, number> = {}, slotChemistry: Record<string, number> = {};
  const eligible = slots.filter(s => !s.isToken && s.player && positionMatches(s.player, s.position));
  const icons = eligible.filter(s => s.player!.cardType === 'ICON').length;
  for (const s of eligible) {
    const p = s.player!;
    add(nationCounts, p.nation, p.cardType === 'ICON' ? 2 : 1);
    if (p.cardType !== 'ICON') add(leagueCounts, p.league, p.cardType === 'HERO' ? 2 : 1);
    if (!['ICON', 'HERO'].includes(p.cardType)) add(clubCounts, p.club);
  }
  for (const league of new Set(eligible.map(s => s.player!.league).filter(known))) add(leagueCounts, league, icons);
  let totalChemistry = 0;
  for (const s of slots) {
    const p = s.player;
    const chemistry = !s.isToken && p && positionMatches(p, s.position) ?
      (['ICON', 'HERO'].includes(p.cardType) ? 3 : Math.min(3, threshold(clubCounts[p.club] || 0, [2, 4, 7]) + threshold(nationCounts[p.nation] || 0, [2, 5, 8]) + threshold(leagueCounts[p.league] || 0, [3, 5, 8]))) : 0;
    slotChemistry[s.slotId] = chemistry; totalChemistry += chemistry;
  }
  return { totalChemistry, slotChemistry, clubCounts, leagueCounts, nationCounts };
}

export function evaluateSbcRequirements(slots: SbcSlot[], req: SbcRequirement, effectiveRating: number, totalChemistry: number) {
  const checklist: SbcChecklistItem[] = [], unmetRequirements: string[] = [];
  const occupied = slots.filter(s => s.isToken ? Number.isInteger(s.tokenRating) && s.tokenRating! >= 1 && s.tokenRating! <= 99 : Boolean(s.player));
  const players = occupied.flatMap(s => s.player ? [s.player] : []);
  const check = (id: string, label: string, current: number | string, required: string, satisfied: boolean) => {
    checklist.push({ id, label, current: String(current), required, satisfied });
    if (!satisfied) unmetRequirements.push(label + ': ' + current + ' (' + required + ')');
  };
  const numericKeys = ['playerCount', 'minSquadRating', 'minTotw', 'minSpecial', 'maxPerClub', 'maxPerLeague', 'maxPerNation', 'minSameClub', 'minClubs', 'maxClubs', 'maxNations', 'maxLeagues', 'minNations', 'minLeagues', 'minChemistry', 'minSameNation', 'minSameLeague'];
  const textKeys = ['exactLeague', 'exactNation', 'exactClub'];
  const inputValid = Number.isInteger(req.playerCount) && req.playerCount >= 1 && req.playerCount <= 11 && Number.isInteger(req.minSquadRating) && req.minSquadRating >= 0 && req.minSquadRating <= 99 &&
    Object.entries(req).every(([key, v]) => v === undefined || (numericKeys.includes(key) ? typeof v === 'number' && Number.isInteger(v) && v >= 0 && Number.isFinite(v) && (key !== 'minChemistry' || v <= 33) : textKeys.includes(key) && typeof v === 'string'));
  check('req_input', 'Gereksinim girdileri', inputValid ? 'Geçerli' : 'Geçersiz', 'Tam sayı ve geçerli sınırlar', inputValid);
  check('req_count', 'Kadro Oyuncu Sayısı', occupied.length, 'Tam ' + req.playerCount + ' oyuncu', occupied.length === req.playerCount);
  check('req_rating', 'Takım Reytingi', Number.isFinite(effectiveRating) ? effectiveRating.toFixed(3) : 'Bilinmiyor', 'Min. ' + req.minSquadRating, Number.isFinite(effectiveRating) && Math.floor(effectiveRating + 1e-9) >= req.minSquadRating);
  check('req_unique', 'Benzersiz oyuncular ve slotlar', players.length, 'Tekrar yok', new Set(players.map(identity)).size === players.length && new Set(slots.map(s => s.slotId)).size === slots.length);
  const totwCount = players.filter(p => p.cardType === 'TOTW').length;
  if (req.minTotw) check('req_totw', 'Haftanın Takımı (TOTW)', totwCount, 'Min. ' + req.minTotw, totwCount >= req.minTotw);
  const specialCount = players.filter(p => p.isSpecial || !['GOLD_RARE', 'BASE'].includes(p.cardType)).length;
  if (req.minSpecial) check('req_special', 'Özel kart', specialCount, 'Min. ' + req.minSpecial, specialCount >= req.minSpecial);
  if (req.minChemistry) check('req_chem', 'Toplam Takım Kimyası', totalChemistry, 'Min. ' + req.minChemistry, totalChemistry >= req.minChemistry);
  for (const [field, label, exact, minimum, same, maximum, perGroup] of [
    ['league', 'Lig', req.exactLeague, req.minLeagues, req.minSameLeague, req.maxLeagues, req.maxPerLeague],
    ['nation', 'Ülke', req.exactNation, req.minNations, req.minSameNation, req.maxNations, req.maxPerNation],
    ['club', 'Kulüp', req.exactClub, req.minClubs, req.minSameClub, req.maxClubs, req.maxPerClub],
  ] as const) {
    const counts: Record<string, number> = {}; players.forEach(p => add(counts, p[field]));
    if (exact) check('req_' + field, label + ': ' + exact, counts[exact] || 0, 'Min. 1', (counts[exact] || 0) >= 1);
    if (minimum) check('req_distinct_' + field, 'Farklı ' + label, Object.keys(counts).length, 'Min. ' + minimum, Object.keys(counts).length >= minimum);
    const max = Math.max(0, ...Object.values(counts));
    if (same) check('req_same_' + field, 'Aynı ' + label, max, 'Min. ' + same, max >= same);
    const allKnown = players.every(p => known(p[field]));
    if (maximum !== undefined) check('req_max_distinct_' + field, 'Farklı ' + label + ' üst sınırı', allKnown ? Object.keys(counts).length : 'Bilinmeyen ' + label.toLowerCase(), 'Maks. ' + maximum, allKnown && Object.keys(counts).length <= maximum);
    if (perGroup !== undefined) check(field === 'club' ? 'req_club_limit' : 'req_' + field + '_limit', 'Aynı ' + label.toLowerCase() + ' üst sınırı', allKnown ? max : 'Bilinmeyen ' + label.toLowerCase(), 'Maks. ' + perGroup, allKnown && max <= perGroup);
  }
  const missing = occupied.filter(s => !s.isToken && !s.isFromClub && s.player && !hasUsablePrice(s.player)).length;
  check('req_prices', 'Satın alma fiyatları', missing ? missing + ' eksik' : 'Mevcut', 'Eksik fiyat yok', missing === 0);
  return { isFeasible: unmetRequirements.length === 0, unmetRequirements, checklist, totwCount };
}

export function findAlternativePlayers(slot: SbcSlot, pool: Player[], usedIds: Set<string>, rating: number): Player[] {
  return pool.filter(p => !usedIds.has(p.id) && p.id !== slot.player?.id && (p.inClub || hasUsablePrice(p)))
    .sort((a, b) => Number(positionMatches(b, slot.position)) - Number(positionMatches(a, slot.position)) || Math.abs(a.rating - rating) - Math.abs(b.rating - rating) || (a.inClub ? 0 : a.price) - (b.inClub ? 0 : b.price)).slice(0, 5);
}
type Candidate = { player?: Player; tokenRating?: number; key: string; cost: number; club: boolean; rating: number };
type Locked = Record<string, Player | { isToken: boolean; tokenRating: number }>;
type SearchOptions = { useClubPlayers: boolean; prioritizeUntradeables: boolean; includeTokens: boolean; onlyClub?: boolean; strategy?: SolverStrategy; lockedSlots?: Locked; budgetLimit?: number; maxNodes?: number; excludedPlayerIds?: string[] };
function makeSlot(c: Candidate, def: { id: string; pos: PlayerPosition }): SbcSlot {
  return { slotId: def.id, position: def.pos, player: c.player || null, isFromClub: c.club, isUntradeable: c.player?.isUntradeable || Boolean(c.tokenRating), isToken: Boolean(c.tokenRating),
    tokenRating: c.tokenRating, tokenLabel: c.tokenRating ? c.tokenRating + '+ Jeton (yapılandırılmış)' : undefined, cost: c.cost, isPositionMatch: c.player ? positionMatches(c.player, def.pos) : false };
}
// Maksimum pozisyon eşlemesi; kimya optimumu olarak sunulmaz.
function assignPositions(candidates: Candidate[], defs: typeof FORMATION_433_ATTACK, locked: SbcSlot[]) {
  const matches = new Map<number, number>();
  const visit = (ci: number, seen: Set<number>): boolean => {
    const c = candidates[ci]; if (!c.player) return false;
    for (let di = 0; di < defs.length; di++) {
      if (seen.has(di) || !positionMatches(c.player, defs[di].pos)) continue;
      seen.add(di); const current = matches.get(di);
      if (current === undefined || visit(current, seen)) { matches.set(di, ci); return true; }
    }
    return false;
  };
  candidates.forEach((_, ci) => visit(ci, new Set()));
  const used = new Set(matches.values()), leftovers = candidates.map((_, i) => i).filter(i => !used.has(i));
  const slots = [...locked];
  defs.forEach((def, i) => { const ci = matches.get(i) ?? leftovers.shift(); if (ci !== undefined) slots.push(makeSlot(candidates[ci], def)); });
  return slots.sort((a, b) => FORMATION_433_ATTACK.findIndex(f => f.id === a.slotId) - FORMATION_433_ATTACK.findIndex(f => f.id === b.slotId));
}
function solve(challenge: SbcChallenge, clubPlayers: Player[], marketPool: Player[], inventory: TokenInventory, options: SearchOptions, mode: SbcSolution['mode']): SbcSolution {
  const started = performance.now(), req = challenge.requirements;
  const count = Number.isInteger(req.playerCount) && req.playerCount >= 1 && req.playerCount <= 11 ? req.playerCount : 11;
  const defs = FORMATION_433_ATTACK.slice(0, count), warnings: string[] = [], errors: string[] = [];
  if (challenge.source === 'PARSE' && (!challenge.rawRequirements?.length || !challenge.gameYear)) errors.push('Canlı SBC kaynak koşulları veya oyun yılı eksik.');
  if (challenge.source === 'PARSE') {
    const parsed = parseSbcRules(challenge.rawRequirements);
    if (!parsed.supported || !parsed.requirements || [...new Set([...Object.keys(req), ...Object.keys(parsed.requirements || {})])].some(key => req[key as keyof SbcRequirement] !== parsed.requirements?.[key as keyof SbcRequirement])) errors.push('Canlı SBC koşulları desteklenmiyor veya kaynak koşullarından değiştirilmiş.');
    if (challenge.tokenRules) errors.push('Canlı SBC için doğrulanmış jeton kuralı yok.');
    if (/\bexpired\b/i.test(challenge.expiresText || '')) errors.push('SBC süresi dolmuş.');
  }
  const strategy = options.strategy || 'CHEAPEST', used = new Set<string>(), locked: SbcSlot[] = [], tokenUsage: Record<string, number> = {};
  const stocks: Record<number, number> = { 87: inventory.tokens87Plus, 88: inventory.tokens88Plus, 89: inventory.tokens89Plus };
  const rules = challenge.tokenRules, excluded = new Set(options.excludedPlayerIds || []), pool = new Map<string, Player>();
  const clubIds = new Set(options.useClubPlayers ? clubPlayers.map(p => p.id) : []);
  for (const p of [...marketPool, ...(options.useClubPlayers ? clubPlayers : [])]) {
    if (challenge.source === 'PARSE' && (p.priceStatus === 'DEMO' || p.gameYear !== challenge.gameYear)) continue;
    if (!Number.isInteger(p.rating) || p.rating < 1 || p.rating > 99 || !p.id || excluded.has(p.id)) continue;
    const normalized: Player = { ...p, inClub: clubIds.has(p.id), priceStatus: p.futbinId && p.price > 0 && (!p.priceUpdatedAt || !Number.isFinite(Date.parse(p.priceUpdatedAt)) || Date.now() - Date.parse(p.priceUpdatedAt) > 30 * 60000) ? 'STALE' : p.priceStatus };
    if (!options.onlyClub || normalized.inClub) pool.set(p.id, normalized);
  }
  const missingPriceCount = [...pool.values()].filter(p => !p.inClub && !hasUsablePrice(p)).length;
  if ([...pool.values()].some(p => p.priceStatus === 'STALE')) warnings.push('Eski fiyatlı kartlar tahmini maliyetle değerlendirilir.');
  for (const [slotId, item] of Object.entries(options.lockedSlots || {})) {
    const def = defs.find(f => f.id === slotId);
    if (!def) { errors.push('Kilitli slot bu kadroda yok: ' + slotId); continue; }
    if ('isToken' in item && item.isToken) {
      const r = item.tokenRating;
      if (!options.includeTokens || !rules?.allowedRatings.includes(r) || !Number.isInteger(stocks[r]) || stocks[r] <= (tokenUsage[r] || 0)) { errors.push('Kilitli jeton için izin veya yeterli stok yok: ' + r); continue; }
      tokenUsage[r] = (tokenUsage[r] || 0) + 1;
      locked.push(makeSlot({ key: 'token', rating: r, tokenRating: r, cost: 0, club: false }, def));
    } else if ('id' in item) {
      const p = pool.get(item.id);
      if (!p || used.has(identity(p)) || (!p.inClub && !hasUsablePrice(p))) { errors.push('Kilitli oyuncu kullanılamıyor, tekrarlanıyor veya fiyatı eksik: ' + item.name); continue; }
      used.add(identity(p)); locked.push(makeSlot({ player: p, key: identity(p), rating: p.rating, cost: p.inClub ? 0 : p.price, club: p.inClub }, def));
    } else errors.push('Geçersiz slot kilidi.');
  }
  const candidates: Candidate[] = [...pool.values()].filter(p => !used.has(identity(p)) && (p.inClub || hasUsablePrice(p)))
    .map(p => ({ player: p, key: identity(p), cost: p.inClub ? 0 : p.price, club: p.inClub, rating: p.rating }));
  if (options.includeTokens && rules) {
    for (const r of new Set(rules.allowedRatings)) {
      if (!Number.isInteger(stocks[r]) || stocks[r] < 0) { warnings.push(r + '+ jeton stoğu bilinmiyor veya geçersiz.'); continue; }
      for (let i = tokenUsage[r] || 0; i < Math.min(stocks[r], count); i++) candidates.push({ key: 'token_' + r, cost: 0, club: false, rating: r, tokenRating: r });
    }
    warnings.push('Jeton ikameleri ve parça dönüşümü ' + (rules.source === 'DEMO' ? 'örnek' : 'manuel') + ' kurala dayanır; oyunda işlem yapılmaz.');
  } else if (options.includeTokens) warnings.push('Bu SBC için jeton kuralı tanımlı değil; jeton kullanılmadı.');
  candidates.sort((a, b) => {
    if (strategy === 'CLUB_FIRST' && a.club !== b.club) return Number(b.club) - Number(a.club);
    if (strategy === 'TOKEN_OPTIMIZED' && Boolean(a.tokenRating) !== Boolean(b.tokenRating)) return Number(Boolean(a.tokenRating)) - Number(Boolean(b.tokenRating));
    return a.cost - b.cost || b.rating - a.rating || a.key.localeCompare(b.key);
  });
  const freeDefs = defs.filter(d => !locked.some(s => s.slotId === d.id));
  const score = (slots: SbcSlot[], chemistry: number) => {
    const cost = slots.reduce((n, s) => n + s.cost, 0), club = slots.filter(s => s.isFromClub).length, tokens = slots.filter(s => s.isToken).length;
    const value = slots.reduce((n, s) => n + (s.isFromClub ? s.player?.price || 0 : 0), 0);
    const tradeable = options.prioritizeUntradeables ? slots.filter(s => s.isFromClub && !s.isUntradeable).length : 0;
    return strategy === 'CLUB_FIRST' ? [-club, cost, tradeable, value, tokens] : strategy === 'TOKEN_OPTIMIZED' ? [tokens, cost, tradeable, value] :
      strategy === 'MAX_CHEM' ? [-chemistry, cost, tradeable, value] : [cost, tradeable, value, tokens];
  };
  const better = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
  let best: SbcSlot[] | null = null, bestScore: number[] = [], nearest: SbcSlot[] = [...locked], nearestPenalty = Infinity, searchedNodes = 0, limited = false;
  const maxNodes = Math.max(1, Math.min(2_000_000, options.maxNodes ?? 60_000));
  if (!evaluateSbcRequirements([], req, 0, 0).checklist.find(c => c.id === 'req_input')!.satisfied) errors.push('SBC gereksinimleri geçersiz.');
  if (options.budgetLimit !== undefined && (!Number.isFinite(options.budgetLimit) || options.budgetLimit < 0)) errors.push('Bütçe sıfır veya pozitif bir sayı olmalı.');
  const evaluate = (selected: Candidate[]) => {
    const slots = assignPositions(selected, freeDefs, locked), chemistry = calculateSquadChemistry(slots);
    const rating = calculateSquadRating(slots.map(s => s.isToken ? s.tokenRating! : s.player!.rating));
    const evaluation = evaluateSbcRequirements(slots, req, rating.effectiveRatingExact, chemistry.totalChemistry);
    const cost = slots.reduce((n, s) => n + s.cost, 0), budgetOkay = options.budgetLimit === undefined || cost <= options.budgetLimit;
    const penalty = evaluation.unmetRequirements.length + (budgetOkay ? 0 : 1) + Math.max(0, req.minSquadRating - rating.effectiveRatingExact);
    if (penalty < nearestPenalty) { nearest = slots; nearestPenalty = penalty; }
    if (!evaluation.isFeasible || !budgetOkay) return { penalty, cost, valid: false };
    const current = score(slots, chemistry.totalChemistry);
    if (!best || better(current, bestScore)) { best = slots; bestScore = current; }
    return { penalty, cost, valid: true };
  };
  const chosen: Candidate[] = [], lockedCost = locked.reduce((n, s) => n + s.cost, 0);
  const search = (start: number, cost: number) => {
    if (++searchedNodes > maxNodes) { limited = true; return; }
    const needed = freeDefs.length - chosen.length;
    if (needed === 0) { evaluate(chosen); return; }
    if (candidates.length - start < needed || (options.budgetLimit !== undefined && cost > options.budgetLimit) || (best && strategy === 'CHEAPEST' && cost > bestScore[0])) return;
    for (let i = start; i <= candidates.length - needed; i++) {
      if (limited) return;
      const c = candidates[i];
      if ((c.player && used.has(c.key)) || (!c.player && i > start && candidates[i - 1].key === c.key)) continue;
      chosen.push(c); if (c.player) used.add(c.key);
      search(i + 1, cost + c.cost);
      chosen.pop(); if (c.player) used.delete(c.key);
    }
  };
  if (!errors.length) {
    for (const ordered of [candidates, [...candidates].sort((a, b) => b.rating - a.rating), [...candidates].sort((a, b) => Number(b.player?.cardType === 'TOTW') - Number(a.player?.cardType === 'TOTW') || b.rating - a.rating)]) {
      const seed: Candidate[] = [], ids = new Set(used);
      for (const c of ordered) { if (seed.length === freeDefs.length) break; if (c.player && ids.has(c.key)) continue; seed.push(c); if (c.player) ids.add(c.key); }
      evaluate(seed);
    }
    // Ucuz başlangıcı küçük değişimlerle iyileştir; sonuç her adımda tüm şartlardan geçer.
    // Bu sezgisel başlangıç tek başına optimum veya imkânsızlık kanıtı değildir.
    let repaired = candidates.filter((c, i, all) => !c.player || all.findIndex(p => p.player && p.key === c.key) === i).slice(0, freeDefs.length);
    let quality = evaluate(repaired), repairChecks = 0;
    for (let step = 0; step < count && repairChecks < 2500 && repaired.length === freeDefs.length; step++) {
      let improved = repaired, nextQuality = quality;
      for (let si = 0; si < repaired.length; si++) for (const replacement of candidates) {
        if (++repairChecks > 2500) break;
        if (repaired.includes(replacement) || (replacement.player && repaired.some((c, i) => i !== si && c.player && c.key === replacement.key))) continue;
        const proposal = [...repaired]; proposal[si] = replacement;
        const result = evaluate(proposal);
        if (!nextQuality || result.penalty < nextQuality.penalty || (result.penalty === nextQuality.penalty && result.cost < nextQuality.cost)) { improved = proposal; nextQuality = result; }
      }
      if (improved === repaired) break;
      repaired = improved; quality = nextQuality;
    }
    search(0, lockedCost);
  }
  const slots: SbcSlot[] = best || nearest, chem = calculateSquadChemistry(slots);
  slots.forEach(s => { s.chemistry = chem.slotChemistry[s.slotId] || 0; });
  const rating = calculateSquadRating(slots.map(s => s.isToken ? s.tokenRating! : s.player?.rating || 0)), evaluation = evaluateSbcRequirements(slots, req, rating.effectiveRatingExact, chem.totalChemistry);
  const totalCoinCost = slots.reduce((n, s) => n + s.cost, 0), unmetRequirements = [...errors, ...evaluation.unmetRequirements];
  if (options.budgetLimit !== undefined && totalCoinCost > options.budgetLimit) unmetRequirements.push('Bütçe sınırı aşıldı.');
  if (missingPriceCount) warnings.push(missingPriceCount + ' pazar kartı fiyatı bulunmadığı için aramaya alınmadı.');
  if (limited) warnings.push('Arama sınırına ulaşıldı. ' + (best ? 'Bulunan en iyi geçerli çözüm gösteriliyor; en ucuz olduğu kanıtlanmadı.' : 'Çözüm bulunamadı; bu, çözümün imkânsız olduğu anlamına gelmez.'));
  if (req.minChemistry || strategy === 'MAX_CHEM') warnings.push('Kimya için pozisyon eşlemesi kullanıldı; küresel optimum garantisi yok.');
  warnings.push('Reyting topluluk modeliyle, kimya FC25 temel profiliyle hesaplandı; teknik direktör ve kampanya bonusları kapsam dışı.');
  const isFeasible = unmetRequirements.length === 0, usage: Record<string, number> = {};
  slots.filter(s => s.isToken).forEach(s => { usage[s.tokenRating!] = (usage[s.tokenRating!] || 0) + 1; });
  const hasRemote = slots.some(s => s.player?.futbinId);
  const hasLocal = slots.some(s => s.player && !s.player.futbinId);
  const dataStatus: SbcSolution['dataStatus'] = slots.some(s => s.player?.priceStatus === 'DEMO') || (slots.some(s => s.isToken) && rules?.source === 'DEMO') ? 'DEMO' : hasRemote ? hasLocal ? 'MIXED' : 'PARSE' : slots.length ? 'MANUAL' : 'UNAVAILABLE';
  if (hasRemote) warnings.push('Parse kataloğu sınırlı kart havuzudur. SBC gereksinimleri ve topluluk hesap modeli oyun içi geçerlilik garantisi vermez; FC 27 Item Score desteklenmez.');
  const searchStatus: SbcSolution['searchStatus'] = errors.length ? 'INVALID_INPUT' : limited ? 'LIMIT_REACHED' : !isFeasible ? 'NO_SOLUTION' : req.minChemistry || strategy === 'MAX_CHEM' ? 'FEASIBLE' : 'OPTIMAL';
  for (const s of slots) s.alternativePlayers = findAlternativePlayers(s, [...pool.values()], new Set(slots.flatMap(x => x.player && x.slotId !== s.slotId ? [x.player.id] : [])), s.tokenRating || s.player?.rating || req.minSquadRating);
  return { challengeId: challenge.id, challengeName: challenge.name, mode, strategyUsed: strategy, formation: count === 11 ? '4-3-3 (Attack)' : count + ' slot', slots, totalCoinCost,
    untradeableValueUsed: slots.filter(s => s.isFromClub).reduce((n, s) => n + (s.player?.price || 0), 0), clubPlayersCount: slots.filter(s => s.isFromClub).length, marketPlayersCount: slots.filter(s => !s.isFromClub && !s.isToken).length,
    tokensCount: slots.filter(s => s.isToken).length, tokensUsed: Object.entries(usage).map(([r, n]) => r + '+ Jeton × ' + n), tokenUsage: usage, effectiveRating: rating.effectiveRatingExact, requiredRating: req.minSquadRating,
    ratingDelta: rating.rawScore - count * req.minSquadRating, rawRatingSum: rating.rawScore, requiredRawSum: count * req.minSquadRating, totalChemistry: chem.totalChemistry, requiredChemistry: req.minChemistry || 0, isFeasible,
    satisfiesTotw: evaluation.totwCount >= (req.minTotw || 0), unmetRequirements, requirementChecklist: evaluation.checklist, savingsPercent: 0, solveTimeMs: Math.round(performance.now() - started), searchStatus, searchedNodes, warnings, dataStatus, missingPriceCount };
}
export function solveClubAndTokenSbc(challenge: SbcChallenge, clubPlayers: Player[], marketPool: Player[], tokenInventory: TokenInventory, options: SearchOptions): SbcSolution {
  return solve(challenge, clubPlayers, marketPool, tokenInventory, options, 'CLUB_TOKEN');
}
export function solveNormalSbc(challenge: SbcChallenge, marketPool: Player[], options?: { budgetLimit?: number; strategy?: SolverStrategy; lockedSlots?: Record<string, Player>; maxNodes?: number }): SbcSolution {
  return solve(challenge, [], marketPool, { tokens89Plus: 0, tokens88Plus: 0, tokens87Plus: 0, fragments: 0 }, { ...options, useClubPlayers: false, prioritizeUntradeables: false, includeTokens: false }, 'NORMAL');
}
