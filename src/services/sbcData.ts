import type { SbcChallenge, SbcRequirement } from '../types/index.ts';
import type { GameYear, MarketMeta, MarketPlatform } from './parseAdapter.ts';
import { ParseDataError, parseCoins } from './parseAdapter.ts';

type Row = Record<string, any>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
export interface SbcRules {
  kind: 'SQUAD' | 'POINTS' | 'UNKNOWN';
  requirements: SbcRequirement | null;
  raw: string[];
  unsupported: string[];
  supported: boolean;
}
export interface RemoteSbcSegment {
  id: string; identityVerified: boolean; name: string; description: string; reward: string; costPc: number | null; costConsole: number | null; rules: SbcRules;
}
export interface RemoteSbcSet {
  id: string; name: string; url: string; year: GameYear; description: string; expires: string; expired: boolean;
  costPc: number | null; costConsole: number | null; reward: string; squadsRequired: number | null;
  segments: RemoteSbcSegment[]; detailsLoaded: boolean; detailsError: string | null; detailsFetchedAt?: string;
}
export interface SbcPage extends MarketMeta {
  year: GameYear; page: number; activeOnly: boolean; sets: RemoteSbcSet[];
  hasMore: boolean; paginationKnown: boolean; skipped: number; detailed: boolean;
}

export const sbcPageKey = (page: Pick<SbcPage, 'year' | 'page' | 'activeOnly'>) => `${page.year}:${page.page}:${page.activeOnly}`;
// Hafif liste yenilemesi önceden alınan koşulları silmez. Koşul tarihi ayrı tutulur.
export function mergeSbcPage(previous: SbcPage | null | undefined, next: SbcPage, now = Date.now()): SbcPage {
  if (!previous || sbcPageKey(previous) !== sbcPageKey(next) || next.detailed) return next;
  const sets = next.sets.map(set => {
    const old = previous.sets.find(p => p.id === set.id && p.year === set.year && p.name === set.name && p.url === set.url);
    const fetchedAt = old?.detailsFetchedAt || previous.fetchedAt;
    if (set.detailsLoaded || set.expired || !old?.detailsLoaded || old.detailsError || !Number.isFinite(Date.parse(fetchedAt)) || now - Date.parse(fetchedAt) > 86400000) return set;
    return { ...set, segments: old.segments, detailsLoaded: true, detailsError: null, detailsFetchedAt: fetchedAt };
  });
  return { ...next, sets, detailed: sets.length > 0 && sets.every(set => set.detailsLoaded) };
}

export function parseSbcRules(value: unknown): SbcRules {
  const raw = Array.isArray(value) ? value.map(v => typeof v === 'string' ? v.trim() : JSON.stringify(v) ?? String(v)) : [];
  const unsupported: string[] = [];
  const req: Partial<SbcRequirement> = { minSquadRating: 0 };
  const points = raw.some(line => /\b(?:item\s+score|(?:required\s+)?squad\s+score|total\s+(?:item\s+)?score|(?:item|total)\s+points)\b/i.test(line));
  if (points) return { kind: 'POINTS', requirements: null, raw, unsupported: ['Bu görev puanla tamamlanıyor. Klasik kadro çözücüsü yerine EA Item Score kontrolü kullanılır.'], supported: false };
  const put = (key: keyof SbcRequirement, amount: number, line: string) => {
    const max = key === 'minSquadRating' ? 99 : key === 'minChemistry' ? 33 : 11;
    if (!Number.isInteger(amount) || amount < (key === 'playerCount' ? 1 : 0) || amount > max || (key === 'playerCount' && req.playerCount !== undefined && req.playerCount !== amount)) { unsupported.push('Geçersiz veya çelişen koşul: ' + line); return; }
    const current = req[key];
    const next = typeof current === 'number' ? key.startsWith('max') ? Math.min(current, amount) : Math.max(current, amount) : amount;
    (req as Record<string, unknown>)[key] = next;
  };
  for (const line of raw) {
    let match = /^(?:# of players in squad|Players in squad|Number of players in squad)\s*:\s*(?:Exactly\s+)?(\d+)$/i.exec(line);
    if (match) { put('playerCount', Number(match[1]), line); continue; }
    match = /^(Squad Rating|Team Chemistry|Total Chemistry|TOTW Players|Team of the Week Players|# of TOTW players)\s*:\s*Min\s+(\d+)$/i.exec(line);
    if (match) { put(/rating/i.test(match[1]) ? 'minSquadRating' : /chemistry/i.test(match[1]) ? 'minChemistry' : 'minTotw', Number(match[2]), line); continue; }
    match = /^Same (Club|League|Nation|Nationality) Count\s*:\s*(Min|Max)\s+(\d+)$/i.exec(line);
    if (match) {
      const group = /^club$/i.test(match[1]) ? 'Club' : /^league$/i.test(match[1]) ? 'League' : 'Nation';
      put((/^min$/i.test(match[2]) ? 'minSame' + group : 'maxPer' + group) as keyof SbcRequirement, Number(match[3]), line); continue;
    }
    match = /^(Clubs|Leagues|Nations|Nationalities)\s*:\s*(Min|Max)\s+(\d+)$/i.exec(line);
    if (match) {
      const group = /^clubs$/i.test(match[1]) ? 'Clubs' : /^leagues$/i.test(match[1]) ? 'Leagues' : 'Nations';
      put((match[2].toLowerCase() + group) as keyof SbcRequirement, Number(match[3]), line); continue;
    }
    unsupported.push(line || 'Boş gereksinim satırı');
  }
  if (!raw.length) unsupported.push('Kaynakta gereksinim listesi yok.');
  if (req.playerCount === undefined) unsupported.push('Oyuncu sayısı kaynakta açıkça belirtilmemiş.');
  if (req.minChemistry) unsupported.push('Kimya isteniyor; kaynaktan gerçek SBC slot dizilişi alınamadı.');
  return { kind: req.playerCount !== undefined ? 'SQUAD' : 'UNKNOWN', requirements: req.playerCount !== undefined ? req as SbcRequirement : null, raw, unsupported, supported: unsupported.length === 0 };
}

const price = (value: unknown) => parseCoins(value) || null;
export function normalizeSbcPage(data: unknown, year: GameYear, detailed: boolean, activeOnly: boolean, meta: MarketMeta): SbcPage {
  const row = object(data);
  if (!Array.isArray(row.sbcs)) throw new ParseDataError('SBC yanıtı beklenen liste biçiminde değil.');
  if (row.year && String(row.year) !== year) throw new ParseDataError('SBC yanıtının oyun yılı eşleşmiyor.');
  const sets: RemoteSbcSet[] = [];
  let validRecords = 0;
  for (const value of row.sbcs) {
    const item = object(value), id = text(item.id), url = text(item.url), name = text(item.name);
    const match = /^https:\/\/(?:www\.)?futbin\.com\/(26|27)\/squad-building-challenge\/(\d+)(?:\/[^?#]*)?(?:\?[^#]*)?$/.exec(url);
    if (!/^[1-9]\d{0,9}$/.test(id) || !name || !match || match[1] !== year || match[2] !== id) continue;
    validRecords++;
    const segments: RemoteSbcSegment[] = [];
    let malformed = false;
    if (Array.isArray(item.challenges)) for (const [index, v] of item.challenges.entries()) {
      const segment = object(v), sid = text(segment.id), sname = text(segment.name);
      const identityVerified = /^[1-9]\d{0,9}$/.test(sid) && Boolean(sname);
      if (!v || typeof v !== 'object' || Array.isArray(v)) malformed = true;
      const rules = parseSbcRules(segment.requirements);
      if (!identityVerified && rules.kind !== 'POINTS') { rules.supported = false; rules.unsupported.push('Alt görev kimliği veya adı kaynakta doğrulanamadı.'); }
      // Puanlı görevlerde kaynak kimliği boş olabilir; koşullar kaybolmaz, çözüm kapalı kalır.
      segments.push({ id: identityVerified ? sid : `source-missing-${index + 1}`, identityVerified, name: sname || `Alt görev ${index + 1}`, description: text(segment.description), reward: text(segment.reward), costPc: price(segment.cost_pc), costConsole: price(segment.cost_ps), rules });
    }
    const expected = Number(item.squads_required), expiry = text(item.expires), expired = /\bexpired\b/i.test(expiry);
    if (activeOnly && expired) continue;
    const detailsError = text(item.challenges_error) ? 'Sağlayıcı bu görevin alt görevlerini okuyamadı.' : malformed ? 'Bazı alt görev kayıtları doğrulanamadı.' :
      detailed && !Array.isArray(item.challenges) ? 'Sağlayıcı alt görev listesini göndermedi.' : detailed && !segments.length ? 'Alt görev koşulları kaynakta bulunamadı.' : null;
    sets.push({ id, name, url, year, description: text(item.description), expires: expiry || 'Belirtilmemiş', expired,
      costPc: price(item.cost_pc), costConsole: price(item.cost_ps), reward: text(object(item.reward_card).name),
      squadsRequired: Number.isInteger(expected) && expected > 0 ? expected : null, segments, detailsLoaded: detailed, detailsError, ...(detailed ? { detailsFetchedAt: meta.fetchedAt } : {}) });
  }
  if (row.sbcs.length && !validRecords) throw new ParseDataError('SBC kayıtlarının oyun yılı veya kimliği doğrulanamadı; boş liste olarak gösterilmedi.');
  return { fetchedAt: meta.fetchedAt, cached: meta.cached, credits: meta.credits, year, detailed, page: Number(row.page) || 1,
    activeOnly, sets, skipped: row.sbcs.length - sets.length, hasMore: row.has_more === true, paginationKnown: typeof row.has_more === 'boolean' };
}

export function toSolverChallenge(set: RemoteSbcSet, segment: RemoteSbcSegment, meta: MarketMeta, platform: MarketPlatform): SbcChallenge | null {
  if (!set.detailsLoaded || set.detailsError || set.expired || !segment.identityVerified || !set.segments.some(s => s.id === segment.id) || !segment.rules.supported || !segment.rules.requirements) return null;
  return { id: `futbin-sbc:${set.year}:${set.id}:${segment.id}`, source: 'PARSE', gameYear: set.year, sourceUrl: set.url,
    sourceFetchedAt: set.detailsFetchedAt || meta.fetchedAt, rawRequirements: [...segment.rules.raw], expiresText: set.expires, name: set.name, group: `FUTBIN · FC ${set.year}`,
    segmentTitle: segment.name, segmentIndex: set.segments.findIndex(v => v.id === segment.id) + 1, segmentTotal: set.squadsRequired || set.segments.length,
    expiresDays: 0, requirements: { ...segment.rules.requirements }, rewardTitle: segment.reward || set.reward || 'Belirtilmemiş', rewardValueEstimated: 0,
    marketPriceBench: (platform === 'pc' ? segment.costPc : segment.costConsole) || 0 };
}
