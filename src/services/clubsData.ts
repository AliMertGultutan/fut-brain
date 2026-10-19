// EA uç noktası eşlemelerinin kaynak ve MIT lisansı: vendor/fc27-clubs-api/.
export const CLUBS_PLATFORM = 'common-gen5';
export const CLUBS_MATCH_TYPES = ['leagueMatch', 'friendlyMatch', 'playoffMatch'] as const;
export type ClubsMatchType = typeof CLUBS_MATCH_TYPES[number];
export interface ClubsTeam { id: string; name: string; crestId: string | null; games: number | null; wins: number | null; draws: number | null; losses: number | null; goals: number | null; conceded: number | null; division: number | null }
export interface ClubsMember { name: string; proName: string; position: string; games: number | null; goals: number | null; assists: number | null; rating: number | null; passRate: number | null; tackleRate: number | null; motm: number | null }
export interface ClubsMatchPlayer { id: string; name: string; position: string; rating: number | null; goals: number | null; assists: number | null; passes: number | null; passAttempts: number | null; tackles: number | null; shots: number | null; motm: boolean }
export interface ClubsMatch { id: string; type: ClubsMatchType; playedAt: string; opponentId: string; opponent: string; goals: number; conceded: number; result: 'win' | 'draw' | 'loss'; dnf: boolean; players: ClubsMatchPlayer[] }
export interface ClubsDashboard { club: ClubsTeam; skillRating: number | null; streak: number | null; members: ClubsMember[]; matches: ClubsMatch[]; matchType: ClubsMatchType; observedAt: string; cached: boolean; stale: boolean; warning: string; archivedCount: number; archiveStartedAt: string; storageWarning?: string }
export const validClubsId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value);
export const clubsNumber = (value: unknown, max = 1e9): number | null => {
  if (!(typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const text = (v: unknown, fallback = '') => typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : fallback;
const crest = (info: any) => { const kit = object(info.customKit), id = String(String(kit.selectedKitType) === '0' ? info.teamId || kit.crestAssetId || '' : kit.crestAssetId || info.teamId || ''); return validClubsId(id) ? id : null; };
const stats = (r: any) => ({ games: clubsNumber(r.gamesPlayed), wins: clubsNumber(r.wins), draws: clubsNumber(r.ties), losses: clubsNumber(r.losses), goals: clubsNumber(r.goals), conceded: clubsNumber(r.goalsAgainst), division: clubsNumber(r.currentDivision, 20) });
export function normalizeClubsSearch(data: any): ClubsTeam[] {
  if (data === null) return [];
  if (!Array.isArray(data) || data.length > 200) throw new Error('EA kulüp arama yanıtı doğrulanamadı.');
  return data.map(r => { const info = object(r.clubInfo), id = String(r.clubId ?? info.clubId ?? ''), name = text(r.clubName, text(info.name)); if (!validClubsId(id) || !name) throw new Error('EA kulüp kimliği okunamadı.'); return { id, name, crestId: crest(info), ...stats(r) }; });
}
export function normalizeClubsInfo(data: any, id: string): ClubsTeam {
  const r = object(data)[id]; if (!r || String(r.clubId) !== id || !text(r.name)) throw new Error('Kulüp EA’da bulunamadı.');
  return { id, name: text(r.name), crestId: crest(r), ...stats(r) };
}
export function normalizeClubsOverall(data: any, id: string) {
  if (!Array.isArray(data) || data.length !== 1 || String(data[0]?.clubId) !== id) throw new Error('EA takım istatistiği doğrulanamadı.');
  const r = data[0]; return { ...stats(r), skillRating: clubsNumber(r.skillRating), streak: clubsNumber(r.wstreak) };
}
export function normalizeClubsMembers(data: any): ClubsMember[] {
  if (data === null) return [];
  if (!Array.isArray(data?.members) || data.members.length > 1000) throw new Error('EA üye listesi doğrulanamadı.');
  return data.members.map((r: any) => {
    if (!text(r.name)) throw new Error('EA oyuncu adı okunamadı.');
    return { name: text(r.name), proName: text(r.proName), position: text(r.favoritePosition), games: clubsNumber(r.gamesPlayed), goals: clubsNumber(r.goals), assists: clubsNumber(r.assists), rating: clubsNumber(r.ratingAve, 10), passRate: clubsNumber(r.passSuccessRate, 100), tackleRate: clubsNumber(r.tackleSuccessRate, 100), motm: clubsNumber(r.manOfTheMatch) };
  });
}
export function normalizeClubsMatches(data: any, id: string, type: ClubsMatchType): ClubsMatch[] {
  if (data === null) return [];
  if (!Array.isArray(data) || data.length > 10) throw new Error('EA maç listesi doğrulanamadı.');
  return data.map(r => {
    const clubs = object(r.clubs), us = clubs[id], opponents = Object.keys(clubs).filter(k => k !== id), timestamp = clubsNumber(r.timestamp, 1e11);
    if (!us || opponents.length !== 1 || !validClubsId(opponents[0]) || !validClubsId(String(r.matchId)) || !timestamp) throw new Error('EA maç kimliği veya tarafları okunamadı.');
    const them = clubs[opponents[0]], goals = clubsNumber(us.goals, 999), conceded = clubsNumber(us.goalsAgainst, 999);
    if (goals === null || conceded === null) throw new Error('EA maç skoru okunamadı.');
    const ownPlayers = object(object(r.players)[id]); if (Object.keys(ownPlayers).length > 30) throw new Error('EA maç oyuncuları doğrulanamadı.');
    const players = Object.entries(ownPlayers).map(([pid, raw]) => { const p = object(raw); return { id: pid.slice(0, 30), name: text(p.playername, 'İsim okunamadı'), position: text(p.pos), rating: clubsNumber(p.rating, 10), goals: clubsNumber(p.goals), assists: clubsNumber(p.assists), passes: clubsNumber(p.passesmade), passAttempts: clubsNumber(p.passattempts), tackles: clubsNumber(p.tacklesmade), shots: clubsNumber(p.shots), motm: String(p.mom) === '1' }; });
    const result: ClubsMatch['result'] = String(us.wins) === '1' ? 'win' : String(us.losses) === '1' ? 'loss' : String(us.ties) === '1' ? 'draw' : goals > conceded ? 'win' : goals < conceded ? 'loss' : 'draw';
    return { id: String(r.matchId), type, playedAt: new Date(timestamp * 1000).toISOString(), opponentId: opponents[0], opponent: text(them.details?.name, 'Rakip adı okunamadı'), goals, conceded, result, dnf: String(us.winnerByDnf) === '1' || String(them.winnerByDnf) === '1', players };
  }).sort((a,b) => b.playedAt.localeCompare(a.playedAt));
}
