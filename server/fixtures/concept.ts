import { parseSbcRules } from '../../src/services/sbcData.ts';
import type { RemoteSbcSet, RemoteSbcSegment } from '../../src/services/sbcData.ts';

export function conceptFixture(count = 11) {
  const raw = ['Player Level: Exactly Gold', `# of players in squad: ${count}`, 'Team Chemistry: Min 11'];
  const segment: RemoteSbcSegment = { id: '10', identityVerified: true, name: 'Test Upgrade', description: '', reward: 'Pack', costPc: null, costConsole: null, rules: parseSbcRules(raw) };
  const set: RemoteSbcSet = { id: '1', name: 'Test Upgrade', url: 'https://www.futbin.com/27/squad-building-challenge/1/test', year: '27', description: '', expires: '1 Day', expired: false, costPc: null, costConsole: null, reward: '', squadsRequired: 1, segments: [segment], detailsLoaded: true, detailsError: null };
  const timestamp = Date.now();
  const players = Array.from({ length: count }, (_, i) => ({ player_id: i + 1, name: `Test Card ${i + 1}`, rating: 80, level: 'Gold', version: 'Normal', position: i === 0 ? 'GK' : 'CM',
    card_positions: [i === 0 ? 'GK' : 'CM'], in_position: true, chemistry: 1, club: 'Test Club', league: 'Test League', nation: 'Test Nation',
    main_price: 500, current_price: 500, locked: false, page_verified: true, price_source: 'card_page', updated_age_seconds: 60, effective_age_seconds: 65 }));
  const data = { year: '27', platform: 'ps', sbc_name: set.name, challenge_name: segment.name, found: true, solution_found: true, players, formation: '4-4-2', requirements: raw,
    total_cost: count * 500, timestamp, locked_players: { count: 0 }, max_age_minutes: 60, solution_status: 'valid_not_proven_optimal', search_complete: false, proven_optimal: false,
    verification: { all_satisfied: true, total_cost_verified: true, all_prices_page_verified: true, feed_priced_players: 0, squad_size: { actual: count, required: count, satisfied: true },
      team_rating: 80, team_chemistry: count, freshness: { satisfied: true, effective_within_limit: true, max_age_seconds: 3600 },
      requirements: raw.map((requirement, i) => ({ requirement, actual: i === 0 ? 'Gold' : count, satisfied: true })) } };
  const source = { year: '27', page: 1, has_more: false, sbcs: [{ id: set.id, name: set.name, url: set.url, expires: '1 Day', challenges: [{ id: segment.id, name: segment.name, requirements: raw }] }] };
  return { set, segment, data, source, meta: { fetchedAt: new Date(timestamp).toISOString(), cached: false, credits: 10 } };
}
