import type { Player, TokenInventory, AppSettings, EvolutionProgram, SbcChallenge } from '../types/index.ts';
import { INITIAL_PLAYERS, INITIAL_TOKEN_INVENTORY, INITIAL_SETTINGS, EVOLUTION_PROGRAMS } from '../data/mockData.ts';

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : structuredClone(fallback); } catch { return structuredClone(fallback); }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { throw new Error('Yerel kayıt yazılamadı. Tarayıcı depolama iznini ve boş alanı kontrol edin.'); }
}
const positions = new Set(['GK','LB','CB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','LF','RF','ST','CF']);
const cardTypes = new Set(['GOLD_RARE','BASE','TOTW','CENTURIONS','FLASHBACK','RTTF','POTM','ICON','HERO','SPECIAL']);
const zeroStats = { pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0 };
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else if (c !== '\r' || quoted) cell += c;
  }
  if (quoted) throw new Error('CSV içinde kapanmamış tırnak var.');
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
const bool = (value: unknown, fallback: boolean) => value === undefined || value === '' ? fallback : value === true || value === 'true' || value === '1';
const str = (v: unknown, fallback = '') => typeof v === 'string' ? v.trim() : fallback;
export class ClubDataProvider {
  static getPlayers(): Player[] {
    const stored = read<Player[]>('fut_brain_players', INITIAL_PLAYERS);
    if (!Array.isArray(stored)) return structuredClone(INITIAL_PLAYERS);
    return stored.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Number.isInteger(p.rating) && p.rating > 0 && p.rating <= 99 && positions.has(p.position)).map(p => ({
      ...p, stats: p.stats || zeroStats, playStyles: Array.isArray(p.playStyles) ? p.playStyles : [],
      priceStatus: p.priceSource?.includes('İçe Aktar') ? (p.price > 0 ? 'MANUAL' : 'UNAVAILABLE') : p.priceStatus === 'LIVE' ? 'DEMO' : p.priceStatus,
    }));
  }
  static savePlayers(players: Player[]) { save('fut_brain_players', players); }
  static importData(text: string, format: 'json' | 'csv') {
    const existing = this.getPlayers(), errors: string[] = [], valid: Player[] = [];
    const fail = (message: string) => ({ success: false, importedCount: 0, errorCount: 1, errors: [message], updatedPlayers: existing });
    if (new TextEncoder().encode(text).length > 2_000_000) return fail('Dosya boyutu en fazla 2 MB olabilir.');
    try {
      let records: unknown[];
      if (format === 'json') { const parsed = JSON.parse(text); records = Array.isArray(parsed) ? parsed : [parsed]; }
      else {
        const rows = parseCsv(text.replace(/^\uFEFF/, ''));
        if (rows.length < 2) return fail('CSV başlık ve en az bir satır içermeli.');
        const headers = rows[0].map(h => ({isim:'name',gen:'rating',mevki:'position'}[h.toLowerCase()] || h));
        if (!['name','rating','position'].every(k => headers.includes(k))) return fail('CSV başlıkları name,rating,position alanlarını içermeli.');
        records = rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
      }
      if (records.length > 10000) return fail('En fazla 10.000 oyuncu içe aktarılabilir.');
      const ids = new Set<string>();
      for (let i = 0; i < records.length; i++) {
        const item = records[i] as Record<string, unknown>;
        if (!item || typeof item !== 'object') { errors.push('Satır ' + (i + 1) + ': Nesne bekleniyor.'); continue; }
        const name = str(item.name), rating = typeof item.rating === 'string' && item.rating.trim() ? Number(item.rating) : item.rating;
        const position = str(item.position).toUpperCase(), cardType = str(item.cardType, 'GOLD_RARE');
        if (!name || !Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 99 || !positions.has(position) || !cardTypes.has(cardType)) {
          errors.push('Satır ' + (i + 1) + ': İsim, 1–99 reyting, geçerli mevki ve kart türü gerekir.'); continue;
        }
        if (item.price !== undefined && item.price !== '' && (!Number.isFinite(Number(item.price)) || Number(item.price) < 0)) { errors.push('Satır ' + (i + 1) + ': Fiyat geçersiz.'); continue; }
        const id = str(item.id) || 'manual_' + encodeURIComponent([name, rating, position, cardType, str(item.club)].join('|'));
        if (ids.has(id)) { errors.push('Satır ' + (i + 1) + ': Aynı kart kimliği tekrarlandı.'); continue; }
        ids.add(id);
        const supplied = item.stats as Player['stats'];
        const statsKnown = supplied && (Object.keys(zeroStats) as Array<keyof typeof zeroStats>).every(k => Number.isInteger(supplied[k]) && supplied[k] >= 0 && supplied[k] <= 99);
        const price = Number(item.price) || 0;
        valid.push({
          id, basePlayerId: str(item.basePlayerId) || undefined, gameYear: ['26', '27'].includes(str(item.gameYear)) ? str(item.gameYear) as '26' | '27' : undefined, name, commonName: str(item.commonName, name), rating: Number(rating), position: position as Player['position'],
          secondaryPositions: Array.isArray(item.secondaryPositions) ? item.secondaryPositions.filter(p => positions.has(p)) : [],
          league: str(item.league), nation: str(item.nation), nationCode: str(item.nationCode), club: str(item.club), clubCode: str(item.clubCode),
          cardType: cardType as Player['cardType'], isSpecial: !['GOLD_RARE', 'BASE'].includes(cardType), isUntradeable: bool(item.isUntradeable, bool(item.inClub, true)),
          isDuplicate: bool(item.isDuplicate, false), inClub: bool(item.inClub, true), price, priceSource: 'Kullanıcı İçe Aktarımı', priceStatus: price > 0 ? 'MANUAL' : 'UNAVAILABLE',
          priceUpdatedAt: new Date().toISOString(), stats: statsKnown ? supplied : { ...zeroStats }, statsKnown: Boolean(statsKnown),
          playStyles: Array.isArray(item.playStyles) ? item.playStyles.filter(p => typeof p === 'string') : [],
        });
      }
      if (!valid.length) return { ...fail('Geçerli oyuncu bulunamadı.'), errors: errors.length ? errors : ['Geçerli oyuncu bulunamadı.'], errorCount: errors.length || 1 };
      const merged = [...valid, ...existing.filter(e => e.priceStatus !== 'DEMO' && !ids.has(e.id))];
      this.savePlayers(merged);
      return { success: true, importedCount: valid.length, errorCount: errors.length, errors, updatedPlayers: merged };
    } catch (e) { return fail(e instanceof Error ? e.message : 'İçe aktarma başarısız.'); }
  }
  static resetToDefault() { this.savePlayers(structuredClone(INITIAL_PLAYERS)); return this.getPlayers(); }
}
export class ItemTokenProvider {
  static getInventory(): TokenInventory { return read('fut_brain_tokens', INITIAL_TOKEN_INVENTORY); }
  static saveInventory(tokens: TokenInventory) {
    if (!Object.values(tokens).every(n => Number.isInteger(n) && n >= 0)) throw new Error('Envanter miktarları sıfır veya pozitif tam sayı olmalı.');
    save('fut_brain_tokens', tokens);
  }
  static convertFragments(inventory: TokenInventory, rules?: SbcChallenge['tokenRules']) {
    const fail = (message: string) => ({ success: false, updated: inventory, message });
    if (!rules || !Number.isInteger(rules.fragmentCost) || rules.fragmentCost <= 0 || !rules.allowedRatings.includes(rules.fragmentTokenRating)) return fail('Geçerli bir parça dönüşüm kuralı tanımlanmalı.');
    if (!Object.values(inventory).every(n => Number.isInteger(n) && n >= 0)) return fail('Envanter bilinmiyor veya geçersiz.');
    if (inventory.fragments < rules.fragmentCost) return fail('Yetersiz parça: ' + rules.fragmentCost + ' gerekli.');
    const key = ('tokens' + rules.fragmentTokenRating + 'Plus') as keyof TokenInventory;
    const updated = { ...inventory, fragments: inventory.fragments - rules.fragmentCost, [key]: inventory[key] + 1 };
    try { this.saveInventory(updated); return { success: true, updated, message: 'Yerel ' + (rules.source === 'DEMO' ? 'demo' : 'manuel') + ' envanter güncellendi. Oyunda dönüşüm yapılmadı.' }; }
    catch (e) { return fail((e as Error).message); }
  }
}
export class EvolutionDataProvider {
  static getPrograms(): EvolutionProgram[] { return read('fut_brain_evolutions', EVOLUTION_PROGRAMS); }
  static savePrograms(programs: EvolutionProgram[]) { save('fut_brain_evolutions', programs); }
}
export class SettingsProvider {
  static getSettings(): AppSettings { const data = read('fut_brain_settings', INITIAL_SETTINGS); return { ...INITIAL_SETTINGS, ...data, dataSourceMode: data.dataSourceMode === 'MANUAL' ? 'MANUAL' : 'DEMO', marketApiStatus: 'DISCONNECTED' }; }
  static saveSettings(settings: AppSettings) { save('fut_brain_settings', { ...settings, marketApiStatus: 'DISCONNECTED' }); }
}
export type SavedSquad = { formation: string; ids: Record<string, string>; savedAt: string };
export class SquadProvider {
  static getSaved(): SavedSquad | null { const value = read<SavedSquad | null>('fut_brain_squad', null); return value?.ids && typeof value.formation === 'string' ? value : null; }
  static save(squad: SavedSquad) {
    const ids = Object.values(squad.ids).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new Error('Aynı oyuncu kadroda iki kez bulunamaz.');
    save('fut_brain_squad', squad);
  }
}
export type EvolutionTracking = { programId: string; playerId: string; playerName: string; programName: string; savedAt: string };
export class EvolutionTrackingProvider {
  static getAll(): EvolutionTracking[] { const all = read<EvolutionTracking[]>('fut_brain_evo_tracking', []); return Array.isArray(all) ? all : []; }
  static add(entry: EvolutionTracking) { const all = this.getAll(); save('fut_brain_evo_tracking', [...all.filter(e => e.programId !== entry.programId || e.playerId !== entry.playerId), entry]); }
}
