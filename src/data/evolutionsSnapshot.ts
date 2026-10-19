import type { EvolutionPage, GameYear, RemoteEvolution } from '../services/parseAdapter.ts';

// FUTBIN'in ana EVO kategorisi 18 Ekim 2026'da kontrol edildi.
// Açıklamalar kopyalanmaz; koşullar ve yükseltmeler kaynakta verilen sayısal kayıtlardır.
export const evoSnapshotCheckedAt = '2026-10-18T15:01:24.000Z';
export const evoSnapshotSource = 'https://www.futbin.com/27/evolutions?category=3';
const evo = (id: number, slug: string, name: string, expires: string, unlockTime: string, cost: string, requirements: Record<string, string>, boosts: Record<string, string>): RemoteEvolution => ({
  name, url: `https://www.futbin.com/27/evolutions/${id}/${slug}`, year: '27', status: 'active', description: '', cost, expires, unlockTime, requirements, boosts,
});
export const fc27EvolutionSnapshot: RemoteEvolution[] = [
  evo(59, 'speed-bump', 'Speed Bump', '2 Weeks', '1 Weeks', 'Free',
    { Overall: 'Max 80', Pace: 'Max 75', PlayStyle: 'Max 7', Position: 'CB', 'Not Position': 'CDM' },
    { Overall: '+10 | 83', Acceleration: '+10 | 77', Aggression: '+5 | 84', 'Ball control': '+5 | 76', 'Heading Acc.': '+5 | 80', Interceptions: '+7 | 82', Jumping: '+10 | 85', 'Long Passing': '+4 | 76', 'Def. Aware': '+7 | 82', Reactions: '+7 | 80', 'Short Passing': '+11 | 80', 'Slide Tackle': '+7 | 82', 'Sprint Speed': '+10 | 77', 'Stand Tackle': '+12 | 82', Strength: '+7 | 86', Composure: '+14 | 81', PS: 'Jockey | 3; Intercept | 3' }),
  evo(51, 'centre-stage', 'Centre Stage', '2 Weeks', '1 Weeks', 'Free',
    { Overall: 'Max 81', Pace: 'Max 85', PlayStyle: 'Max 7', Position: 'CDM or CM', 'Not Position': 'CB, ST, CAM' },
    { Overall: '+10 | 85', Acceleration: '+7 | 77', Aggression: '+30 | 85', Crossing: '+10 | 82', Curve: '+10 | 82', 'Heading Acc.': '+10 | 81', Interceptions: '+10 | 82', Jumping: '+30 | 85', 'Long Passing': '+10 | 83', 'Def. Aware': '+10 | 80', 'Short Passing': '+10 | 82', 'Free Kick': '+10 | 82', 'Slide Tackle': '+10 | 82', 'Sprint Speed': '+7 | 77', 'Stand Tackle': '+10 | 81', Stamina: '+30 | 84', Strength: '+30 | 85', Vision: '+10 | 83', 'Weak Foot': '+2 | 3', Skills: '+2 | 3', PS: 'Jockey | 3; Incisive Pass | 3' }),
  evo(50, 'side-step', 'Side Step', '1 Weeks', '6 days', 'Free',
    { Overall: 'Max 80', Pace: 'Max 85', PlayStyle: 'Max 7', Position: 'LB or RB', 'Not Position': 'CB, CM' },
    { Overall: '+7 | 81', Acceleration: '+5 | 83', Crossing: '+7 | 81', Curve: '+7 | 77', Finishing: '+7 | 78', Interceptions: '+7 | 78', 'Long Passing': '+7 | 76', 'Long Shots': '+7 | 78', 'Def. Aware': '+7 | 78', 'Short Passing': '+7 | 80', 'Free Kick': '+7 | 78', 'Shot Power': '+7 | 77', 'Slide Tackle': '+7 | 81', 'Sprint Speed': '+5 | 83', 'Stand Tackle': '+7 | 81', Vision: '+7 | 78', Volleys: '+7 | 76', 'Weak Foot': '+2 | 3', PS: 'Tiki Taka | 3' }),
  evo(48, 'touchline-magic', 'Touchline Magic', '1 Weeks', '4 days', '20.000 coins veya 150 FC Points',
    { Overall: 'Max 80', Pace: 'Max 86', PlayStyle: 'Max 7', Position: 'LW or RW', 'Not Position': 'ST, CM, CAM' },
    { Overall: '+10 | 84', Acceleration: '+10 | 85', Agility: '+10 | 84', Balance: '+10 | 83', 'Ball control': '+10 | 84', Curve: '+7 | 83', Dribbling: '+10 | 84', Finishing: '+7 | 82', 'Long Shots': '+7 | 81', Positioning: '+7 | 81', Reactions: '+10 | 83', 'Short Passing': '+7 | 80', 'Shot Power': '+7 | 81', 'Sprint Speed': '+10 | 85', Stamina: '+7 | 82', Vision: '+7 | 79', Composure: '+10 | 83', Skills: '+1 | 4', PS: 'Technical | 3; Quick Step | 3' }),
  evo(6, 'intro-to-repeatable-evolutions', 'Intro to Repeatable Evolutions', '11 Months', '11 Months', 'Free',
    { Overall: 'Max 79', Pace: 'Max 81', Position: 'ST' },
    { Overall: '+1 | 80', Dribbling: '+4 | 80', 'Long Passing': '+4 | 77', 'Long Shots': '+4 | 77', Reactions: '+4 | 80', 'Short Passing': '+3 | 78', 'Free Kick': '+4 | 80', 'Shot Power': '+3 | 78', Vision: '+3 | 79', Volleys: '+3 | 78' }),
  evo(5, 'intro-to-evolutions', 'Intro to Evolutions', '11 Months', '11 Months', 'Free',
    { Overall: 'Max 75', Pace: 'Max 80', 'Total Positions': 'Max 2', PlayStyle: 'Max 7', Position: 'RB', 'Not Position': 'CB' },
    { Overall: '+34 | 79', Acceleration: '+40 | 80', Agility: '+40 | 78', Balance: '+40 | 77', 'Ball control': '+40 | 80', Crossing: '+40 | 78', Curve: '+40 | 80', Dribbling: '+40 | 80', Interceptions: '+40 | 76', 'Def. Aware': '+40 | 77', 'Short Passing': '+40 | 76', 'Slide Tackle': '+40 | 75', 'Sprint Speed': '+40 | 80', 'Stand Tackle': '+40 | 78', Stamina: '+40 | 80', Vision: '+40 | 75', PS: 'Slide Tackle | 3', Roles: 'Wingback+' }),
  evo(2, 'intro-to-pathway-evolutions', 'Intro to Pathway Evolutions', '11 Months', '11 Months', 'Free',
    { Overall: 'Max 80', PlayStyle: 'Max 3' }, { 'Path A · PS': 'Gamechanger | 4' }),
];

export function evolutionDataForYear(page: EvolutionPage | null, year: GameYear) {
  const remote = page?.evolutions.filter(e => e.year === year) || [];
  if (remote.length || year === '26') return { evolutions: remote, kind: page ? 'PARSE' as const : 'EMPTY' as const, fetchedAt: page?.fetchedAt || null, sourceUrl: '' };
  return { evolutions: fc27EvolutionSnapshot, kind: 'SNAPSHOT' as const, fetchedAt: evoSnapshotCheckedAt, sourceUrl: evoSnapshotSource };
}
