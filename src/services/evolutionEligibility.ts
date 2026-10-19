import type { Player } from '../types/index.ts';
import type { RemoteEvolution } from './parseAdapter.ts';
export interface EvoCheck { label: string; required: string; actual: string; satisfied: boolean | null }
const key = (value: string) => value.toLowerCase().replace(/[^a-z+]/g, '');
export function evolutionEligibility(evo: RemoteEvolution, player: Player) {
  const checks: EvoCheck[] = [{ label: 'Oyun yılı', required: `FC ${evo.year}`, actual: player.gameYear ? `FC ${player.gameYear}` : 'Belirtilmemiş', satisfied: player.gameYear ? player.gameYear === evo.year : null }];
  if (evo.status === 'expired') checks.push({ label: 'Program durumu', required: 'Aktif', actual: 'Süresi dolmuş', satisfied: false });
  const positions = [...new Set([player.position, ...(player.secondaryPositions || [])])];
  for (const [label, required] of Object.entries(evo.requirements)) {
    const k = key(label); let actual = 'Veri eksik', satisfied: boolean | null = null;
    if (k === 'position' || k === 'notposition') {
      const wanted = required.toUpperCase().split(/\s+OR\s+|[,/;|]/).map(s => s.trim());
      const matches = positions.some(p => wanted.includes(p)); actual = positions.join(' / ') + (player.positionsKnown ? '' : ' · alternatifler doğrulanmadı');
      satisfied = k === 'position' ? matches ? true : player.positionsKnown ? false : null : matches ? false : player.positionsKnown ? true : null;
    } else {
      let value: number | undefined;
      if (k === 'overall' || k === 'rating') value = player.rating;
      const stats = { pace: 'pace', shooting: 'shooting', passing: 'passing', dribbling: 'dribbling', defending: 'defending', physical: 'physical' } as const;
      if (k in stats && player.statsKnown) value = player.stats[stats[k as keyof typeof stats]];
      if (k === 'playstyle' || k === 'playstyles') value = player.playStylesKnown ? player.playStyles.length : undefined;
      if (k === 'playstyle+' || k === 'playstyles+') value = player.playStylesKnown ? player.playStyles.filter(s => s.endsWith('+')).length : undefined;
      if (k === 'totalpositions') value = player.positionsKnown ? positions.length : undefined;
      const match = /^(Max|Min|Exactly)\s+(\d+)$/i.exec(required.trim());
      if (Number.isFinite(value) && match) { actual = String(value); satisfied = match[1].toLowerCase() === 'max' ? value! <= Number(match[2]) : match[1].toLowerCase() === 'min' ? value! >= Number(match[2]) : value === Number(match[2]); }
    }
    checks.push({ label, required, actual, satisfied });
  }
  if (!Object.keys(evo.requirements).length) checks.push({ label: 'Katılım koşulları', required: 'Doğrulanmış koşullar', actual: 'Koşul verisi yok', satisfied: null });
  const status = checks.some(c => c.satisfied === false) ? 'INELIGIBLE' : checks.some(c => c.satisfied === null) ? 'UNKNOWN' : 'ELIGIBLE';
  return { status, checks };
}
