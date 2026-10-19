import { officialEaImage } from './eaSquad.ts';
import { normalizeEaPlayStyles } from './eaPlayStyles.ts';
import type { EaPlayStyle } from './eaPlayStyles.ts';
export const validEaEvolutionId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id);
export class EaEvolutionDataError extends Error {}
export interface EaEvolutionCheck { label: string; satisfied: boolean | null }
export interface EaPlayerEvolutions {
  version: 1; playerId: string; definitionId: number; rating: number; observedAt: string; partial: boolean;
  programs: { id: string; name: string; cost: string; expiresAt: number | null; eligible: boolean | null; checks: EaEvolutionCheck[]; multiChoice: boolean; finalRating: number | null }[];
  preview?: { programId: string; rating: number; stats: number[] | null; portraitUrl: string; playStyles: string[]; playStyleDetails?: EaPlayStyle[]; playStylesKnown?: boolean };
}
export function normalizeEaEvolutions(value: any): EaPlayerEvolutions {
  const fail = (code = '01'): never => { throw new EaEvolutionDataError(`EA EVO yanıtı doğrulanamadı (EVO-DATA-${code}).`); };
  const text = (s: any, max = 150) => typeof s === 'string' && s.length > 0 && s.length <= max;
  const numericId = (id: any) => typeof id === 'string' && /^[1-9]\d{0,19}$/.test(id);
  const rating = (n: any) => Number.isInteger(n) && n > 0 && n <= 99;
  const stats = (s: any) => Array.isArray(s) && s.length === 6 && s.every(n => Number.isInteger(n) && n >= 0 && n <= 99) ? s : null;
  if (!value || value.version !== 1 || !numericId(value.playerId) || !Number.isSafeInteger(value.definitionId) || value.definitionId <= 0 || !rating(value.rating) || !Number.isFinite(Date.parse(value.observedAt)) || typeof value.partial !== 'boolean' || !Array.isArray(value.programs) || value.programs.length > 300) fail();
  const ids = new Set<string>();
  const programs = value.programs.map((p: any) => {
    if (!validEaEvolutionId(p?.id) || ids.has(p.id)) fail('02');
    if (!text(p.name) || !text(p.cost) || ![true, false, null].includes(p.eligible) || typeof p.multiChoice !== 'boolean' || !Array.isArray(p.checks) || p.checks.length > 100 || !(p.expiresAt === null || Number.isSafeInteger(p.expiresAt) && p.expiresAt > 0) || !(p.finalRating === null || rating(p.finalRating))) fail('03');
    ids.add(p.id);
    const checks = p.checks.map((c: any) => { if (!text(c?.label, 250) || ![true, false, null].includes(c.satisfied)) fail(); return { label: c.label, satisfied: c.satisfied }; });
    if (p.eligible === true && checks.some((c: EaEvolutionCheck) => c.satisfied !== true)) fail();
    return { id: p.id, name: p.name, cost: p.cost, expiresAt: p.expiresAt, eligible: p.eligible, checks, multiChoice: p.multiChoice, finalRating: p.finalRating };
  });
  let preview: EaPlayerEvolutions['preview'];
  if (value.preview) {
    const p = value.preview;
    if (!ids.has(p.programId) || !rating(p.rating) || !Array.isArray(p.playStyles) || p.playStyles.length > 50 || p.playStyles.some((s: any) => !text(s, 60))) fail();
    preview = { programId: p.programId, rating: p.rating, stats: stats(p.stats), portraitUrl: officialEaImage(p.portraitUrl), playStyles: [...p.playStyles], playStyleDetails: normalizeEaPlayStyles(p.playStyleDetails), playStylesKnown: p.playStylesKnown === true };
  }
  return { version: 1, playerId: value.playerId, definitionId: value.definitionId, rating: value.rating, observedAt: value.observedAt, partial: value.partial, programs, ...(preview ? { preview } : {}) };
}
