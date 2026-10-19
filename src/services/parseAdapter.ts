import type { Player, PlayerPosition, PlayerStats } from '../types/index.ts';
import { normalizePlayerExtras } from './playerDetails.ts';

export type MarketPlatform = 'pc' | 'ps' | 'xbox';
export type GameYear = '26' | '27';
type Row = Record<string, any>;
export interface RemoteEvolution {
  name: string; url: string; year: GameYear | null; status: string; description: string;
  cost: string; expires: string; unlockTime: string; requirements: Record<string, string>;
  boosts: Record<string, string>;
}
export interface MarketMeta { cached: boolean; fetchedAt: string; credits: number }
export interface MarketPage extends MarketMeta {
  players: Player[]; page: number; hasMore: boolean; paginationKnown: boolean; skipped: number;
}
export interface EvolutionPage extends MarketMeta { evolutions: RemoteEvolution[] }
export interface ParseStatus {
  configured: boolean; connected: boolean; lastSuccessAt: string | null; lastError: string | null;
  creditsAttempted: number; sessionCreditLimit: number; requestsRemaining: number;
}
const positions = new Set('GK LB CB RB LWB RWB CDM CM CAM LM RM LW RW LF RF ST CF'.split(' '));
const object = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const label = (v: any) => typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : String(object(v).name || '');
export class ParseDataError extends Error {}
export const validFutbinId = (id: unknown): id is string => typeof id === 'string' && /^[1-9]\d{0,9}(?:_\d{1,10}){0,16}$/.test(id);
export function parsePositions(value: unknown): PlayerPosition[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(parsePositions))];
  const text = label(value).toUpperCase();
  if (!text) return [];
  const result: PlayerPosition[] = [];
  let remaining = text;
  // Kaynak bazı kartlarda ana ve alternatif mevkileri aynı alanda birleştirir.
  while (remaining) {
    const separator = /^[\s,;/|]+/.exec(remaining);
    if (separator) { remaining = remaining.slice(separator[0].length); continue; }
    const match = /^(CAM|CDM|LWB|RWB|GK|LB|CB|RB|CM|LM|RM|LW|RW|LF|RF|ST|CF)(?:\s*\+{1,2})?/.exec(remaining);
    if (!match || !positions.has(match[1])) return [];
    result.push(match[1] as PlayerPosition); remaining = remaining.slice(match[0].length);
  }
  return [...new Set(result)];
}
export function parseCoins(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  if (typeof value !== 'string') return 0;
  const match = /^(\d+(?:\.\d+)?)\s*([km])?$/i.exec(value.trim().replace(/,/g, ''));
  if (!match) return 0;
  const coins = Number(match[1]) * ({ k: 1000, m: 1000000 }[match[2]?.toLowerCase() || ''] || 1);
  return Number.isSafeInteger(Math.round(coins)) ? Math.round(coins) : 0;
}
function sourceAge(box: Row): number | null {
  if (typeof box.updated_age_seconds === 'number' && box.updated_age_seconds >= 0 && Number.isFinite(box.updated_age_seconds)) return box.updated_age_seconds * 1000;
  const match = /^(\d+(?:\.\d+)?)\s*(secs?|seconds?|mins?|minutes?|hrs?|hours?|days?)\s+ago$/.exec(label(box.updated_text || box.updated).toLowerCase());
  if (!match) return null;
  return Number(match[1]) * (/^(sec)/.test(match[2]) ? 1000 : /^(min)/.test(match[2]) ? 60000 : /^(hr|hour)/.test(match[2]) ? 3600000 : 86400000);
}
export function normalizeQuote(raw: unknown, platform: MarketPlatform, fetchedAt: string, cached = false): Pick<Player, 'price' | 'priceSource' | 'priceStatus' | 'priceUpdatedAt' | 'priceObservedAt' | 'pricePlatform'> {
  const row = object(raw), box = object(object(row.prices)[platform]);
  // Xbox için PC veya PlayStation fiyatı varsayılmaz.
  const price = box.available === false ? 0 : parseCoins(box.price ?? row[`price_${platform}_coins`] ?? row[`price_${platform}`]);
  const age = sourceAge(box), updatedAt = age === null ? '' : new Date(Date.parse(fetchedAt) - age).toISOString();
  const fresh = updatedAt && Date.now() - Date.parse(updatedAt) <= 30 * 60000;
  return { price, priceSource: 'Parse / FUTBIN', pricePlatform: platform, priceObservedAt: fetchedAt,
    priceUpdatedAt: updatedAt, priceStatus: !price ? 'UNAVAILABLE' : fresh ? cached ? 'CACHED' : 'LIVE' : 'STALE' };
}
function statsOf(row: Row): { stats: PlayerStats; statsKnown: boolean } {
  const raw = object(row.face_stats || row.stats || row.detailed_stats);
  const keys = [['pace', 'PAC', 'Pace'], ['shooting', 'SHO', 'Shooting'], ['passing', 'PAS', 'Passing'],
    ['dribbling', 'DRI', 'Dribbling'], ['defending', 'DEF', 'Defending'], ['physical', 'PHY', 'Physical']];
  const values = keys.map(([key, short, full]) => { const v = raw[key] ?? raw[short] ?? raw[full]; return v === '' || v == null ? NaN : Number(v); });
  const statsKnown = values.every(v => Number.isInteger(v) && v >= 0 && v <= 99);
  // Kaleci değerleri saha oyuncusu özellikleri gibi etiketlenmez.
  return { stats: Object.fromEntries(keys.map(([key], i) => [key, statsKnown ? values[i] : 0])) as unknown as PlayerStats, statsKnown };
}
function stylesOf(value: unknown): string[] {
  const groups = object(value);
  return [...new Set([...(Array.isArray(groups.plus) ? groups.plus.map(v => label(v)).filter(Boolean).map(v => v + '+') : []),
    ...(Array.isArray(groups.basic) ? groups.basic.map(v => label(v)) : []),
    ...(Array.isArray(value) ? value.map(v => label(v)) : [])].filter(Boolean))];
}
function cardType(version: string): Player['cardType'] {
  const v = version.toUpperCase();
  if (/ICON/.test(v)) return 'ICON';
  if (/HERO/.test(v)) return 'HERO';
  if (/TOTW|TEAM OF THE WEEK|IN FORM/.test(v)) return 'TOTW';
  if (/^(GOLD RARE|RARE GOLD)$/.test(v)) return 'GOLD_RARE';
  if (!v || /^(GOLD|SILVER|BRONZE|COMMON|RARE|NORMAL)( (COMMON|RARE))?$/.test(v)) return 'BASE';
  return 'SPECIAL';
}
export function normalizePlayer(value: unknown, year: GameYear, platform: MarketPlatform, fetchedAt: string, cached = false): Player | null {
  const row = object(value), id = label(row.id ?? row.player_id ?? row.card_id), rating = Number(row.rating), listedPositions = parsePositions(row.position), pos = listedPositions[0], name = label(row.name);
  if (!validFutbinId(id) || !name || !pos || !Number.isInteger(rating) || rating < 1 || rating > 99 || (row.year && String(row.year) !== year)) return null;
  const version = label(row.version), type = cardType(version);
  const secondaries = [...new Set([...listedPositions.slice(1), ...parsePositions(row.secondary_positions), ...parsePositions(row.positions)])].filter(p => p !== pos);
  return { id: `futbin:${year}:${id}`, futbinId: id, gameYear: year, name, commonName: name,
    rating, position: pos, secondaryPositions: secondaries, cardType: type, cardVersion: version,
    club: label(row.club) || 'Bilinmiyor', league: label(row.league) || 'Bilinmiyor', nation: label(row.nation) || 'Bilinmiyor',
    nationCode: '', clubCode: '', isSpecial: !['BASE', 'GOLD_RARE'].includes(type), inClub: false,
    isUntradeable: row.untradeable === true, ...normalizeQuote(row, platform, fetchedAt, cached), ...statsOf(row), ...normalizePlayerExtras(row), playStyles: stylesOf(row.playstyles),
    playStylesKnown: Array.isArray(row.playstyles) || Array.isArray(row.playstyles?.basic) || Array.isArray(row.playstyles?.plus), positionsKnown: Array.isArray(row.secondary_positions) || Array.isArray(row.positions) };
}
export function normalizePlayers(data: unknown, year: GameYear, platform: MarketPlatform, meta: MarketMeta): MarketPage {
  const row = object(data), rows = row.players ?? row.results;
  if (!Array.isArray(rows)) throw new Error('Oyuncu yanıtı beklenen biçimde değil.');
  const players = rows.map(v => normalizePlayer(v, year, platform, meta.fetchedAt, meta.cached)).filter(Boolean) as Player[];
  if (rows.length && !players.length) throw new ParseDataError('Sağlayıcı kart döndürdü, ancak mevki, kimlik veya reyting bilgileri okunamadı. Bu, oyuncunun bulunmadığı anlamına gelmez.');
  return { cached: meta.cached, fetchedAt: meta.fetchedAt, credits: meta.credits, players, page: Number(row.page) || 1, hasMore: row.has_more === true,
    paginationKnown: typeof row.has_more === 'boolean', skipped: rows.length - players.length };
}
export function normalizeDetail(data: unknown, id: string, year: GameYear, platform: MarketPlatform, meta: MarketMeta): Partial<Player> {
  const row = object(data);
  if (label(row.id ?? row.player_id ?? row.card_id) !== id || (row.year && String(row.year) !== year)) throw new Error('Kart ayrıntısının kimliği eşleşmiyor.');
  const stats = statsOf(row);
  return { id: `futbin:${year}:${id}`, ...normalizeQuote(row, platform, meta.fetchedAt, meta.cached), ...normalizePlayerExtras(row),
    ...(stats.statsKnown ? stats : {}), ...(Array.isArray(row.playstyles) || Array.isArray(row.playstyles?.basic) || Array.isArray(row.playstyles?.plus) ? { playStyles: stylesOf(row.playstyles), playStylesKnown: true } : {}),
    ...(Array.isArray(row.positions) || Array.isArray(row.secondary_positions) ? { secondaryPositions: [...new Set([...parsePositions(row.positions), ...parsePositions(row.secondary_positions), ...parsePositions(row.position).slice(1)])], positionsKnown: true } : {}) };
}
function textMap(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(object(value)).slice(0, 60).map(([key, v]) => [key, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
}
export function normalizeEvolutions(data: unknown, meta: MarketMeta): EvolutionPage {
  const rows = object(data).evos;
  if (!Array.isArray(rows)) throw new Error('Evolution yanıtı beklenen biçimde değil.');
  const evolutions = rows.filter(v => label(object(v).name)).map(v => {
    const row = object(v), url = label(row.url), match = /^https:\/\/(www\.)?futbin\.com\/(26|27)\/evolutions\//.exec(url);
    return { name: label(row.name), url: match ? url : '', year: match ? match[2] as GameYear : null,
      status: label(row.status), description: label(row.description), cost: label(row.cost), expires: label(row.expires),
      unlockTime: label(row.unlock_time), requirements: textMap(row.requirements), boosts: textMap(row.stat_boosts) };
  });
  if (rows.length && !evolutions.length) throw new Error('Evolution kayıtları doğrulanamadı.');
  return { cached: meta.cached, fetchedAt: meta.fetchedAt, credits: meta.credits, evolutions };
}
export function ageMarketPlayers(players: Player[]): Player[] {
  return players.map(p => ({ ...p, priceStatus: !p.price ? 'UNAVAILABLE' : !p.priceUpdatedAt || Date.now() - Date.parse(p.priceUpdatedAt) > 30 * 60000 ? 'STALE' : p.priceStatus }));
}
