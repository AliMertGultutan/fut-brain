import { ParseDataError, parsePositions } from './parseAdapter.ts';
import type { MarketMeta } from './parseAdapter.ts';
import type { RemoteSbcSet, RemoteSbcSegment } from './sbcData.ts';

export interface ConceptPlayer {
  id: string; name: string; rating: number; level: string; version: string;
  position: string; positions: string[]; inPosition: boolean; chemistry: number;
  club: string; league: string; nation: string; price: number; updatedAt: string; url: string;
}
export interface ConceptSquad extends MarketMeta {
  year: '27'; platform: 'ps' | 'pc' | 'xbox'; engine?: 'LOCAL_GOLD' | 'PROVIDER'; setId: string; segmentId: string; sbcName: string; challengeName: string;
  sourceUrl: string; found: boolean; formation: string; players: ConceptPlayer[];
  totalCost: number | null; rating: number | null; chemistry: number | null;
  checks: { requirement: string; actual: string; satisfied: boolean }[];
  optimalWithinPool: boolean; searchComplete: boolean; outcome: string;
  maxAgeMinutes: number; timestamp: string; reason: string;
}
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\bvs\b/g, 'v').replace(/\s+/g, ' ').trim();
const fail = (message: string): never => { throw new ParseDataError(message); };
const integer = (value: unknown, min: number, max: number) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
export function canRequestConcept(set: RemoteSbcSet, segment: RemoteSbcSegment) {
  return set.year === '27' && !set.expired && set.detailsLoaded && !set.detailsError && segment.identityVerified && segment.rules.kind === 'SQUAD' &&
    segment.rules.raw.length > 0 && !segment.rules.raw.some(line => /\b(tokens?|fragments?|item score|squad score)\b/i.test(line));
}
export function normalizeConcept(data: any, set: RemoteSbcSet, segment: RemoteSbcSegment, maxAgeMinutes: number, meta: MarketMeta): ConceptSquad {
  if (!canRequestConcept(set, segment)) fail('Bu görev klasik konsept kadro için doğrulanamadı.');
  if (!data || data.year !== '27' || data.platform !== 'ps' || normalized(String(data.sbc_name)) !== normalized(set.name) || normalized(String(data.challenge_name)) !== normalized(segment.name)) fail('Sağlayıcının seçtiği SBC, oyun yılı veya fiyat platformu eşleşmiyor.');
  if (typeof data.found !== 'boolean' || data.solution_found !== data.found || !Array.isArray(data.players)) fail('Konsept kadro yanıtının sonucu doğrulanamadı.');
  if (!Array.isArray(data.requirements) || !segment.rules.raw.every(line => data.requirements.some((r: unknown) => typeof r === 'string' && normalized(r) === normalized(line)))) fail('Konsept yanıtında görevin bazı koşulları eksik.');
  if (!integer(data.timestamp, 1, Number.MAX_SAFE_INTEGER)) fail('Kaynak yanıt zamanı belirtilmemiş.');
  const base: ConceptSquad = { ...meta, year: '27', platform: 'ps', setId: set.id, segmentId: segment.id, sbcName: set.name, challengeName: segment.name, sourceUrl: set.url,
    found: data.found, formation: '', players: [], totalCost: null, rating: null, chemistry: null, checks: [], optimalWithinPool: false,
    searchComplete: data.search_complete === true, outcome: String(data.solution_status || ''), maxAgeMinutes, timestamp: new Date(data.timestamp).toISOString(), reason: '' };
  if (!data.found) {
    if (data.players.length || !['no_solution_in_covered_pool', 'search_incomplete_no_solution', 'locked_players_infeasible', 'not_searched'].includes(base.outcome)) fail('Çözüm bulunamadı yanıtı tutarsız.');
    const reason = base.outcome === 'not_searched' ? /pre-placed locked cards/i.test(String(data.message)) ? 'Bu görevde önceden yerleştirilmiş kilitli slotlar var. Sağlayıcının çözücüsü bu düzeni desteklemiyor.' : 'Sağlayıcının çözücüsü bu görevin bazı koşullarını uygulayamıyor; arama başlatılmadı.' : base.searchComplete ? 'Taranan kart havuzunda bütün koşulları karşılayan kadro bulunamadı.' : 'Arama tamamlanmadan süre veya aday sınırına ulaşıldı. Bu, görevin yapılamaz olduğu anlamına gelmez.';
    return { ...base, reason };
  }
  const v = data.verification;
  const count = segment.rules.requirements!.playerCount;
  if (!v || !v.all_satisfied || !v.total_cost_verified || !v.all_prices_page_verified || v.feed_priced_players !== 0 ||
    !v.squad_size?.satisfied || v.squad_size.actual !== count || v.squad_size.required !== count || data.players.length !== count ||
    !integer(v.team_rating, 1, 99) || !integer(v.team_chemistry, 0, count * 3)) fail('Kadro sayısı, fiyatları veya koşul kontrolü doğrulanamadı.');
  if (!v.freshness?.satisfied || v.freshness.effective_within_limit !== true || v.freshness.max_age_seconds !== maxAgeMinutes * 60 || data.max_age_minutes !== maxAgeMinutes) fail('Fiyat güncelliği sınırı uygulanmamış.');
  if (data.locked_players?.count !== 0 || data.players.some((p: any) => p.locked !== false)) fail('Sahip olduğun varsayılan kartlar içeren yanıt kabul edilmedi.');
  if (!Array.isArray(v.requirements) || v.requirements.some((check: any) => check.satisfied !== true) ||
    !segment.rules.raw.every(line => v.requirements.some((check: any) => typeof check.requirement === 'string' && normalized(check.requirement) === normalized(line) && check.satisfied === true))) fail('Görevin her koşulu ayrı ayrı onaylanmamış.');
  const sourceTime = data.timestamp;
  if (sourceTime > Date.parse(meta.fetchedAt) + 60000 || Date.parse(meta.fetchedAt) - sourceTime > 5 * 60000) fail('Kaynak eski bir çözüm döndürdü; güncel öneri olarak kullanılamıyor.');
  const ids = new Set<string>(), names = new Set<string>();
  const players: ConceptPlayer[] = data.players.map((p: any) => {
    const id = String(p.player_id), name = typeof p.name === 'string' ? p.name.trim() : '';
    const positions = parsePositions(p.card_positions), position = parsePositions(p.position);
    if (!/^[1-9]\d{0,9}$/.test(id) || !name || ids.has(id) || names.has(normalized(name)) || !integer(p.rating, 1, 99) ||
      !integer(p.chemistry, 0, 3) || position.length !== 1 || !positions.length || typeof p.in_position !== 'boolean' ||
      p.in_position !== positions.includes(position[0]) || !integer(p.main_price, 1, 15000000) || p.current_price !== p.main_price ||
      (!p.in_position && p.chemistry !== 0) ||
      p.page_verified !== true || p.price_source !== 'card_page' || !Number.isFinite(p.updated_age_seconds) || p.updated_age_seconds < 0 ||
      !Number.isFinite(p.effective_age_seconds) || p.effective_age_seconds < p.updated_age_seconds || p.effective_age_seconds > maxAgeMinutes * 60) fail('Bazı oyuncuların kimliği, mevkisi veya kart sayfası fiyatı doğrulanamadı.');
    ids.add(id); names.add(normalized(name));
    return { id, name, rating: p.rating, level: String(p.level || ''), version: String(p.version || ''), position: position[0], positions,
      inPosition: p.in_position, chemistry: p.chemistry, club: String(p.club || ''), league: String(p.league || ''), nation: String(p.nation || ''),
      price: p.main_price, updatedAt: new Date(sourceTime - p.effective_age_seconds * 1000).toISOString(), url: `https://www.futbin.com/27/player/${id}` };
  });
  const totalCost = players.reduce((sum, p) => sum + p.price, 0);
  if (data.total_cost !== totalCost || players.reduce((sum, p) => sum + p.chemistry, 0) !== v.team_chemistry) fail('Kadro toplam maliyeti veya kimyası oyuncularla eşleşmiyor.');
  for (const line of segment.rules.raw) {
    const level = /^Player Level:\s*(Exactly|Min|Max)\s+(Gold|Silver|Bronze)$/i.exec(line);
    if (level) {
      const [min, max] = level[2].toLowerCase() === 'gold' ? [75, 99] : level[2].toLowerCase() === 'silver' ? [65, 74] : [1, 64];
      if (players.some(p => /^min$/i.test(level[1]) ? p.rating < min : /^max$/i.test(level[1]) ? p.rating > max : p.rating < min || p.rating > max)) fail('Kart seviyeleri kaynak koşuluyla eşleşmiyor.');
    }
    const minLevel = /^(Gold|Silver|Bronze) Players:\s*Min\s+(\d+)$/i.exec(line);
    if (minLevel && players.filter(p => minLevel[1].toLowerCase() === 'gold' ? p.rating >= 75 : minLevel[1].toLowerCase() === 'silver' ? p.rating >= 65 && p.rating <= 74 : p.rating <= 64).length < Number(minLevel[2])) fail('İstenen kart seviyesinin oyuncu sayısı karşılanmıyor.');
  }
  const formation = String(data.formation || '');
  const formationSize = formation.split('-').reduce((sum, n) => sum + Number(n), 0);
  if (!/^\d(?:-\d){1,4}$/.test(formation) || formationSize < count - 1 || formationSize > 10) fail('Gerçek SBC dizilişi doğrulanamadı.');
  if (!['optimal_over_covered_pool', 'valid_not_proven_optimal'].includes(base.outcome)) fail('Çözüm durumu tutarsız.');
  return { ...base, players, totalCost, formation, rating: v.team_rating, chemistry: v.team_chemistry,
    optimalWithinPool: data.proven_optimal === true && data.search_complete === true && base.outcome === 'optimal_over_covered_pool',
    checks: v.requirements.map((check: any) => ({ requirement: String(check.requirement), actual: typeof check.actual === 'object' ? JSON.stringify(check.actual) : String(check.actual), satisfied: true })) };
}

export function conceptCsv(squad: ConceptSquad) {
  const escape = (value: unknown) => '"' + String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
  const rows = [['SBC', 'Görev', 'Oyun', 'Platform', 'Diziliş', 'Kart ID', 'Oyuncu', 'Reyting', 'Sürüm', 'Slot', 'Kart mevkileri', 'Kulüp', 'Lig', 'Ülke', 'Kimya', 'Fiyat', 'Fiyat güncellemesi', 'Kaynak'],
    ...squad.players.map(p => [squad.sbcName, squad.challengeName, 'FC 27', { ps: 'PlayStation', pc: 'PC', xbox: 'Xbox' }[squad.platform], squad.formation, p.id, p.name, p.rating, p.version, p.position, p.positions.join('/'), p.club, p.league, p.nation, p.chemistry, p.price, p.updatedAt, p.url])];
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}
