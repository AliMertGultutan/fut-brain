import type { Player, PlayerPosition, SbcSlot } from '../types/index.ts';
import { calculateSquadChemistry, positionMatches } from './sbcSolver.ts';

export const SQUAD_KEYS = ['lf', 'st', 'rf', 'lcm', 'cm', 'rcm', 'lb', 'lcb', 'rcb', 'rb', 'gk'];
export const FORMATIONS: Record<string, PlayerPosition[][]> = {
  '4-3-2-1': [['LW', 'ST', 'RW'], ['CM', 'CM', 'CM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '4-4-2': [['ST', 'ST'], ['LM', 'CM', 'CM', 'RM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '4-2-3-1': [['ST'], ['LM', 'CAM', 'RM'], ['CDM', 'CDM'], ['LB', 'CB', 'CB', 'RB'], ['GK']],
  '3-5-2': [['ST', 'ST'], ['LM', 'CDM', 'CAM', 'CDM', 'RM'], ['CB', 'CB', 'CB'], ['GK']],
};
export function createInitialSquad(players: Player[]): Record<string, string> {
  const preferred = ['p_mbappe', 'p_haaland', 'p_salah', 'p_bellingham', 'p_rodri', 'p_debruyne', 'p_theo', 'p_vandijk', 'p_saliba', 'p_walker', 'p_alisson'];
  const used = new Set<string>();
  return Object.fromEntries(SQUAD_KEYS.map((key, i) => {
    const available = players.filter(p => !used.has(p.id));
    const player = available.find(p => p.id === preferred[i]) || available.find(p => positionMatches(p, FORMATIONS['4-3-2-1'].flat()[i])) || available[0];
    if (player) used.add(player.id);
    return [key, player?.id || ''];
  }));
}
export function squadSlots(ids: Record<string, string>, formation: string, players: Player[]): SbcSlot[] {
  return (FORMATIONS[formation] || FORMATIONS['4-3-2-1']).flat().map((position, i) => {
    const player = players.find(p => p.id === ids[SQUAD_KEYS[i]]) || null;
    return { slotId: SQUAD_KEYS[i], position, player, isFromClub: true, isToken: false, isUntradeable: player?.isUntradeable || false, cost: 0 };
  });
}
export function optimizeSquadPositions(slots: SbcSlot[]): SbcSlot[] {
  const players = slots.flatMap(s => s.player ? [s.player] : []), matches = new Map<number, number>();
  const match = (pi: number, seen: Set<number>): boolean => {
    for (let si = 0; si < slots.length; si++) {
      if (seen.has(si) || !positionMatches(players[pi], slots[si].position)) continue;
      seen.add(si);
      const old = matches.get(si);
      if (old === undefined || match(old, seen)) { matches.set(si, pi); return true; }
    }
    return false;
  };
  players.forEach((_, pi) => match(pi, new Set()));
  const used = new Set(matches.values()), rest = players.map((_, pi) => pi).filter(pi => !used.has(pi));
  const proposed = slots.map((s, si) => ({ ...s, player: players[matches.get(si) ?? rest.shift() ?? -1] || null }));
  return calculateSquadChemistry(proposed).totalChemistry >= calculateSquadChemistry(slots).totalChemistry ? proposed : slots;
}
