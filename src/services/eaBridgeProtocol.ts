import type { ConceptSquad } from './conceptSquad.ts';

export const BRIDGE_CHANNEL = 'FUT_BRAIN_BRIDGE_V1';
export const EA_WEB_URL = 'https://www.ea.com/ea-sports-fc/ultimate-team/web-app/';
export const EA_MATCH = EA_WEB_URL + '*';
export const BRIDGE_TTL = 10 * 60000;
export function isCurrentBridgeVersion(version: unknown) { const parts = typeof version === 'string' ? version.split('.').map(Number) : []; return parts.length === 3 && parts.every(n => Number.isInteger(n) && n >= 0) && (parts[0] > 0 || parts[1] > 3 || (parts[1] === 3 && parts[2] >= 4)); }
export interface EaPlan {
  version: 1; mode: 'CONCEPT_ONLY'; year: '27'; platform: 'ps' | 'pc' | 'xbox'; placement?: 'OPEN_SLOTS'; catalogGold?: true; createdAt: number;
  setName: string; challengeName: string; formation: string; sourceFetchedAt: string;
  expectedRating: number; expectedChemistry: number; estimatedCoins: number;
  players: { futbinId: string; name: string; rating: number; cardVersion: string; slot: string }[];
}
export interface EaImportResult {
  ok: boolean; code: string; message: string; saved?: boolean; alreadyPlaced?: boolean;
  requiresOverwrite?: boolean; mayHaveSaved?: boolean; rating?: number; chemistry?: number; playerCount?: number;
}
export const normalizeEaName = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss').replace(/\bvs\b/g, 'v').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function isSiteUrl(value: unknown) {
  try { const url = new URL(String(value)); return ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://localhost:3001'].includes(url.origin); } catch { return false; }
}
export function isEaUrl(value: unknown) {
  try { const url = new URL(String(value)); return url.origin === 'https://www.ea.com' && url.pathname.startsWith('/ea-sports-fc/ultimate-team/web-app/'); } catch { return false; }
}
export const isBaseCard = (version: string) => /^(normal|bronze|silver|gold|gold rare|rare gold|common|rare|bronze rare|silver rare)$/i.test(version.trim());
export function validateEaPlan(value: any, now = Date.now()): EaPlan {
  const fail = (message: string): never => { throw new Error(message); };
  const label = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const openSlots = value?.placement === 'OPEN_SLOTS';
  const catalogGold = value?.catalogGold === true;
  if (catalogGold && !openSlots) fail('Otomatik altın kart seçimi yalnızca açık slotlu görevde kullanılabilir.');
  if (!value || value.version !== 1 || value.mode !== 'CONCEPT_ONLY' || value.year !== '27' || !(openSlots ? ['ps', 'pc', 'xbox'].includes(value.platform) : value.platform === 'ps')) fail('Yalnızca doğrulanmış FC 27 konsept kadrosu aktarılabilir.');
  if (!Number.isFinite(value.createdAt) || value.createdAt > now + 60000 || now - value.createdAt > BRIDGE_TTL) fail('Aktarım isteğinin süresi doldu. Kadroyu siteden yeniden gönder.');
  if (!label(value.setName, 120) || !label(value.challengeName, 120) || !(openSlots ? value.formation === 'EA' : /^\d(?:-\d){1,4}$/.test(value.formation)) || !Number.isFinite(Date.parse(value.sourceFetchedAt))) fail('Görev adı, diziliş veya kaynak tarihi geçersiz.');
  if (!Array.isArray(value.players) || value.players.length !== (catalogGold ? 0 : openSlots ? 10 : 11)) fail('Desteklenen kadro 11 standart kart veya bir kilitli slotlu 10 altın kart içermeli.');
  if (![value.expectedRating, value.expectedChemistry, value.estimatedCoins].every(Number.isInteger) || value.expectedRating < (openSlots ? 0 : 1) || value.expectedRating > 99 || value.expectedChemistry < 0 || value.expectedChemistry > 33 || value.estimatedCoins < 0 || value.estimatedCoins > 165000000) fail('Kadro özeti geçersiz.');
  const ids = new Set(), names = new Set();
  const players = value.players.map((p: any) => {
    if (!p || !/^[1-9]\d{0,9}$/.test(p.futbinId) || !label(p.name, 100) || !normalizeEaName(p.name) || !Number.isInteger(p.rating) || p.rating < 1 || p.rating > 99 ||
      typeof p.cardVersion !== 'string' || !isBaseCard(p.cardVersion) || (openSlots ? p.slot !== 'AUTO' || p.rating < 75 : !/^(GK|RB|LB|CB|RWB|LWB|CDM|CM|CAM|LM|RM|LW|RW|ST|CF)$/.test(p.slot))) fail('Kart sürümü veya slot doğrulanamadı. Bu sürüm standart kartları destekler; özel kartları karıştırmaz.');
    if (ids.has(p.futbinId) || names.has(normalizeEaName(p.name))) fail('Kadroda tekrarlanan oyuncu var.');
    ids.add(p.futbinId); names.add(normalizeEaName(p.name));
    return { futbinId: p.futbinId, name: p.name.trim(), rating: p.rating, cardVersion: p.cardVersion.trim(), slot: p.slot };
  });
  if (!openSlots && (players.filter((p: any) => p.slot === 'GK').length !== 1 || value.formation.split('-').reduce((s: number, n: string) => s + Number(n), 0) !== 10)) fail('11 oyunculu diziliş doğrulanamadı.');
  // İzin verilen alanlar yeniden kurulur; anahtar, oturum, URL veya çalıştırılacak kod taşınmaz.
  return { version: 1, mode: 'CONCEPT_ONLY', year: '27', platform: value.platform, ...(openSlots ? { placement: 'OPEN_SLOTS' as const } : {}), ...(catalogGold ? { catalogGold: true as const } : {}), createdAt: value.createdAt, setName: value.setName.trim(), challengeName: value.challengeName.trim(), formation: value.formation,
    sourceFetchedAt: value.sourceFetchedAt, expectedRating: value.expectedRating, expectedChemistry: value.expectedChemistry, estimatedCoins: value.estimatedCoins, players };
}
export function createEaPlan(squad: ConceptSquad): EaPlan {
  if (!squad.found || !squad.checks.length || squad.checks.some(c => !c.satisfied)) throw new Error('Önce koşulları karşılayan bir konsept kadro oluştur.');
  return validateEaPlan({ version: 1, mode: 'CONCEPT_ONLY', year: squad.year, platform: squad.platform, createdAt: Date.now(), setName: squad.sbcName, challengeName: squad.challengeName,
    formation: squad.formation, ...(squad.engine === 'LOCAL_GOLD' ? { placement: 'OPEN_SLOTS' } : {}), sourceFetchedAt: squad.fetchedAt, expectedRating: squad.rating ?? 0, expectedChemistry: squad.chemistry ?? 0, estimatedCoins: squad.totalCost,
    players: squad.players.map(p => ({ futbinId: p.id, name: p.name, rating: p.rating, cardVersion: p.version, slot: p.position })) });
}
