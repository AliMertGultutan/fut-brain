import type { Player } from '../types/index.ts';
import { normalizeEaPlayStyles } from './eaPlayStyles.ts';
import type { EaPlayStyle } from './eaPlayStyles.ts';
export interface EaSquadCard { id: string; definitionId: number; assetId: number; name: string; rating: number; position: string | null; secondaryPositions: string[]; positionsKnown: boolean; concept: boolean; untradeable: boolean; special: boolean; club: string; league: string; nation: string; stats: number[] | null; playStyles: string[]; playStyleDetails?: EaPlayStyle[]; playStylesKnown: boolean; portraitUrl?: string; shellUrl?: string }
export interface EaActiveSquad { version: 1; year: '27'; squadId: string; name: string; formation: string; observedAt: string; rating: number; chemistry: number; coinsBalance?: number | null; slots: { index: number; position: string; uniquePosition?: string; chemistry?: number | null; player: EaSquadCard | null }[]; bench: EaSquadCard[] }
export function officialEaImage(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1500) return '';
  try { const url = new URL(value, 'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/'); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && (url.hostname === 'ea.com' || url.hostname.endsWith('.ea.com')) ? url.href : ''; } catch { return ''; }
}
const positions = new Set('GK LB CB RB LWB RWB CDM CM CAM LM RM LW RW LF RF ST CF'.split(' '));
export class EaSquadDataError extends Error {}
export function normalizeEaSquad(value: any): EaActiveSquad {
  const fail = (message = 'EA kadrosunun dizilişi veya saha verisi doğrulanamadı.'): never => { throw new EaSquadDataError(message); };
  const label = (v: any, max = 100) => typeof v === 'string' && v.length <= max;
  if (!value || value.version !== 1 || value.year !== '27' || !label(value.squadId, 30) || !label(value.name) || !label(value.formation, 40) || !Number.isFinite(Date.parse(value.observedAt)) || !Number.isInteger(value.rating) || value.rating < 0 || value.rating > 99 || !Number.isInteger(value.chemistry) || value.chemistry < 0 || value.chemistry > 33 || !Array.isArray(value.slots) || value.slots.length !== 11 || !Array.isArray(value.bench) || value.bench.length > 20) fail();
  const ids = new Set<string>();
  const card = (p: any): EaSquadCard => {
    if (!p || !label(p.id, 30) || !(p.concept === true ? /^(?:-?\d+|concept:\d+)$/.test(p.id) : /^[1-9]\d*$/.test(p.id))) fail('EA kart kimliği okunamadı: envanter kaydı geçersiz (EA-ID-01).');
    if (!Number.isSafeInteger(p.definitionId) || p.definitionId <= 0) fail('EA kart kimliği okunamadı: kart sürümü eksik (EA-ID-02).');
    if (!Number.isSafeInteger(p.assetId) || p.assetId <= 0) fail('EA kart kimliği okunamadı: oyuncu kaydı eksik (EA-ID-03). Eklentiyi 0.2.2 sürümüne güncelle.');
    if (!label(p.name) || !p.name.trim() || !Number.isInteger(p.rating) || p.rating < 1 || p.rating > 99 || (p.position !== null && !positions.has(p.position)) || !Array.isArray(p.secondaryPositions) || p.secondaryPositions.some((s: any) => !positions.has(s)) || !Array.isArray(p.playStyles) || p.playStyles.some((s: any) => !label(s, 60)) || !['concept','untradeable','special','positionsKnown','playStylesKnown'].every(k => typeof p[k] === 'boolean')) fail('EA kartının adı, reytingi veya mevki verisi doğrulanamadı.');
    // Konsept kartların EA envanter kimliği 0 olabilir; bu sahiplik anlamına gelmez.
    const identity = p.concept ? `concept:${p.definitionId}` : p.id;
    if (ids.has(identity)) fail('EA kadrosunda tekrarlanan kart kaydı var. Kadroyu EA ekranında kontrol et.');
    ids.add(identity);
    const stats = Array.isArray(p.stats) && p.stats.length === 6 && p.stats.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 99) ? p.stats : null;
    const playStyleDetails = normalizeEaPlayStyles(p.playStyleDetails);
    const playStyles = playStyleDetails.length ? playStyleDetails.map(s => `${s.name || 'Adı okunamadı'}${s.isPlus ? '+' : ''}`) : [...new Set<string>(p.playStyles)];
    return { id: identity, definitionId: p.definitionId, assetId: p.assetId, name: p.name, rating: p.rating, position: p.position, secondaryPositions: [...new Set<string>(p.secondaryPositions)], positionsKnown: p.positionsKnown, concept: p.concept, untradeable: p.untradeable, special: p.special, club: label(p.club) ? p.club : '', league: label(p.league) ? p.league : '', nation: label(p.nation) ? p.nation : '', stats, playStyles, playStyleDetails, playStylesKnown: p.playStylesKnown, portraitUrl: officialEaImage(p.portraitUrl), shellUrl: officialEaImage(p.shellUrl) };
  };
  const indices = new Set();
  const slots = value.slots.map((s: any) => { if (!Number.isInteger(s?.index) || s.index < 0 || s.index > 10 || indices.has(s.index) || !positions.has(s.position)) fail(); indices.add(s.index); return { index: s.index, position: s.position, uniquePosition: typeof s.uniquePosition === 'string' && /^[A-Z]{1,6}$/.test(s.uniquePosition) ? s.uniquePosition : '', chemistry: Number.isInteger(s.chemistry) && s.chemistry >= 0 && s.chemistry <= 3 ? s.chemistry : null, player: s.player === null ? null : card(s.player) }; });
  return { version: 1, year: '27', squadId: value.squadId, name: value.name, formation: value.formation, observedAt: value.observedAt, rating: value.rating, chemistry: value.chemistry, coinsBalance: Number.isSafeInteger(value.coinsBalance) && value.coinsBalance >= 0 ? value.coinsBalance : null, slots, bench: value.bench.map(card) };
}
export function eaSquadPlayers(squad: EaActiveSquad): Player[] {
  return [...squad.slots.flatMap(s => s.player ? [s.player] : []), ...squad.bench].filter(p => !p.concept && p.position).map(p => ({
    id: `ea:${p.id}`, basePlayerId: `ea:${p.assetId}`, gameYear: '27', name: p.name, commonName: p.name, rating: p.rating, position: p.position as Player['position'], secondaryPositions: p.secondaryPositions as Player['position'][], positionsKnown: p.positionsKnown,
    club: p.club, clubCode: '', league: p.league, nation: p.nation, nationCode: '', cardType: p.special ? 'SPECIAL' : 'BASE', cardVersion: p.special ? 'EA özel kart' : 'Normal', isSpecial: p.special, isUntradeable: p.untradeable, inClub: true,
    priceObservedAt: squad.observedAt, imageUrl: p.portraitUrl, shellUrl: p.shellUrl, playStyleDetails: p.playStyleDetails, price: 0, priceSource: 'EA Web App', priceStatus: 'UNAVAILABLE', priceUpdatedAt: '', stats: p.stats ? { pace: p.stats[0], shooting: p.stats[1], passing: p.stats[2], dribbling: p.stats[3], defending: p.stats[4], physical: p.stats[5] } : { pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0 }, statsKnown: !!p.stats, playStyles: p.playStyles, playStylesKnown: p.playStylesKnown,
  }));
}
export function eaPitchRows(squad: EaActiveSquad) {
  const counts = squad.formation.match(/\d+(?:-\d+){1,4}/)?.[0].split('-').map(Number).reverse();
  const rank: Record<string, number> = { ST: 7, CF: 7, LW: 7, RW: 7, LF: 7, RF: 7, CAM: 6, LM: 5, RM: 5, CM: 4, CDM: 3, LWB: 2, RWB: 2, LB: 1, RB: 1, CB: 1 };
  const field = squad.slots.filter(s => s.position !== 'GK').sort((a, b) => (rank[b.position] || 0) - (rank[a.position] || 0));
  // EA slotları aynı hat içinde sağdan sola numaralanır; kadrodaki kimlikler değişmez.
  if (!counts || counts.reduce((a, b) => a + b, 0) !== field.length) return [field.sort((a, b) => b.index - a.index), squad.slots.filter(s => s.position === 'GK')];
  let cursor = 0; return [...counts.map(count => { const row = field.slice(cursor, cursor + count).sort((a, b) => b.index - a.index); cursor += count; return row; }), squad.slots.filter(s => s.position === 'GK')];
}
