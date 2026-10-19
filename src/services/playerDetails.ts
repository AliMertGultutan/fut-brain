import type { Player } from '../types/index.ts';
import { officialEaImage } from './eaSquad.ts';

export const PLAYER_STAT_GROUPS = [
  { key: 'pace', name: 'Hız', short: 'HIZ', attributes: [['acceleration', 'Hızlanma'], ['sprintSpeed', 'Sprint hızı']] },
  { key: 'shooting', name: 'Şut', short: 'ŞUT', attributes: [['positioning', 'Pozisyon alma'], ['finishing', 'Bitiricilik'], ['shotPower', 'Şut gücü'], ['longShots', 'Uzaktan şut'], ['volleys', 'Vole'], ['penalties', 'Penaltı']] },
  { key: 'passing', name: 'Pas', short: 'PAS', attributes: [['vision', 'Görüş'], ['crossing', 'Orta'], ['freeKickAccuracy', 'Serbest vuruş'], ['shortPassing', 'Kısa pas'], ['longPassing', 'Uzun pas'], ['curve', 'Falso']] },
  { key: 'dribbling', name: 'Dribbling', short: 'DRİ', attributes: [['agility', 'Çeviklik'], ['balance', 'Denge'], ['reactions', 'Reaksiyon'], ['ballControl', 'Top kontrolü'], ['dribbling', 'Top sürme'], ['composure', 'Soğukkanlılık']] },
  { key: 'defending', name: 'Savunma', short: 'DEF', attributes: [['interceptions', 'Top kesme'], ['headingAccuracy', 'Kafa isabeti'], ['defensiveAwareness', 'Savunma farkındalığı'], ['standingTackle', 'Ayakta müdahale'], ['slidingTackle', 'Kayarak müdahale']] },
  { key: 'physical', name: 'Fizik', short: 'FİZ', attributes: [['jumping', 'Zıplama'], ['stamina', 'Dayanıklılık'], ['strength', 'Güç'], ['aggression', 'Agresiflik']] },
] as const;

const aliases: Record<string, string[]> = {
  sprintSpeed: ['sprintspeed'], positioning: ['attposition', 'attackingposition', 'attackpositioning'], freeKickAccuracy: ['fkaccuracy', 'fkacc', 'freekick'],
  shortPassing: ['shortpass'], longPassing: ['longpass'], headingAccuracy: ['headingacc', 'heading'], defensiveAwareness: ['defawareness', 'defaware', 'marking'],
  standingTackle: ['standtackle'], slidingTackle: ['slidetackle'],
};
const cleanKey = (key: string) => key.toLowerCase().replace(/[^a-z]/g, '');
const validStat = (value: unknown): number | undefined => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return;
  const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= 99 ? n : undefined;
};

// Yalnız kaynakta ayrı verilen alt özellikler alınır; ana özelliklerden tahmin üretilmez.
export function normalizePlayerExtras(row: Record<string, any>): Partial<Player> {
  const raw = row.detailed_stats;
  const details: Record<string, number> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const entries = Object.entries(raw).slice(0, 100);
    const flat = Object.fromEntries(entries.map(([key, value]) => [cleanKey(key), value]));
    for (const group of PLAYER_STAT_GROUPS) {
      const nested = entries.find(([key]) => cleanKey(key) === group.key)?.[1];
      const source = nested && typeof nested === 'object' && !Array.isArray(nested)
        ? Object.fromEntries(Object.entries(nested).slice(0, 30).map(([key, value]) => [cleanKey(key), value])) : flat;
      for (const [key] of group.attributes) {
        // Flat Dribbling, alt özellik yerine ana kart özelliği olabilir.
        if (key === 'dribbling' && source === flat) continue;
        const value = [cleanKey(key), ...(aliases[key] || [])].map(alias => validStat(source[alias])).find(v => v !== undefined);
        if (value !== undefined) details[key] = value;
      }
    }
  }
  const imageUrl = officialEaImage(row.portrait_url || row.image_url);
  const shellUrl = officialEaImage(row.shell_url);
  return { ...(Object.keys(details).length ? { detailedStats: details } : {}), ...(imageUrl ? { imageUrl } : {}), ...(shellUrl ? { shellUrl } : {}) };
}

export function readPlayerRoute(hash: string): { id: string; source: 'market' | 'club' } {
  const [page, source, encoded, ...extra] = hash.replace(/^#/, '').split('/');
  if (!['fut-players', 'fut-gallery'].includes(page) || !['market', 'club'].includes(source) || !encoded || extra.length) return { id: '', source: 'market' };
  try { const id = decodeURIComponent(encoded); return id.length <= 150 ? { id, source: source as 'market' | 'club' } : { id: '', source: 'market' }; }
  catch { return { id: '', source: 'market' }; }
}
export const playerDetailHash = (id: string, source: 'market' | 'club') => `#fut-players/${source}/${encodeURIComponent(id)}`;
