// Bu liste yalnızca isim tamamlar; kart, sahiplik veya fiyat verisi içermez.
const STARTER_NAMES = [
  'Lionel Messi', 'Mason Greenwood', 'Alex Greenwood', 'Sam Greenwood', 'Erling Haaland',
  'Cristiano Ronaldo', 'Kylian Mbappé', 'Mohamed Salah', 'Vinícius Júnior', 'Jude Bellingham',
  'Harry Kane', 'Cole Palmer', 'Bukayo Saka', 'Phil Foden', 'Kevin De Bruyne', 'Rodri',
  'Lamine Yamal', 'Pedri', 'Gavi', 'Raphinha', 'Robert Lewandowski', 'Frenkie de Jong',
  'Ousmane Dembélé', 'Désiré Doué', 'Vitinha', 'Achraf Hakimi', 'Nuno Mendes',
  'Bruno Fernandes', 'Bruno Guimarães', 'Alexander Isak', 'Florian Wirtz', 'Jamal Musiala',
  'Michael Olise', 'Joshua Kimmich', 'Lautaro Martínez', 'Marcus Thuram', 'Nicolò Barella',
  'Federico Valverde', 'Aurélien Tchouaméni', 'Eduardo Camavinga', 'Arda Güler',
  'Kenan Yıldız', 'Hakan Çalhanoğlu', 'Orkun Kökçü', 'Kerem Aktürkoğlu', 'Barış Alper Yılmaz',
  'Victor Osimhen', 'Leroy Sané', 'Mauro Icardi', 'Lucas Torreira', 'Gabriel Sara',
  'Heung-min Son', 'Neymar', 'Karim Benzema', 'Antoine Griezmann', 'Julián Álvarez',
  'Rafael Leão', 'Christian Pulisic', 'Paulo Dybala', 'Dušan Vlahović', 'Rasmus Højlund',
  'Virgil van Dijk', 'William Saliba', 'Gabriel Magalhães', 'Rúben Dias', 'Antonio Rüdiger',
  'Alessandro Bastoni', 'Marquinhos', 'Trent Alexander-Arnold', 'Theo Hernández',
  'Alisson Becker', 'Thibaut Courtois', 'Gianluigi Donnarumma', 'Jan Oblak', 'Emiliano Martínez',
  'Alexia Putellas', 'Aitana Bonmatí', 'Caroline Graham Hansen', 'Sam Kerr', 'Sophia Wilson',
];
const STORAGE_KEY = 'fut_brain_player_names_v1';
const MAX_NAMES = 2000;
export function normalizePlayerName(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i')
    .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe');
}
const compact = (value: string) => normalizePlayerName(value).replace(/[^\p{L}\p{N}]/gu, '');
export function uniquePlayerNames(names: unknown[]): string[] {
  const result = new Map<string, string>();
  for (const value of names) {
    if (typeof value !== 'string') continue;
    const name = value.trim().replace(/\s+/g, ' '), key = compact(name);
    if (name.length >= 2 && name.length <= 80 && key && !result.has(key)) result.set(key, name);
    if (result.size === MAX_NAMES) break;
  }
  return [...result.values()];
}
export function readSavedPlayerNames(): string[] {
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? uniquePlayerNames(parsed) : []; }
  catch { return []; }
}
export function rememberPlayerNames(names: string[]): string[] {
  const merged = uniquePlayerNames([...names, ...readSavedPlayerNames()]);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* Öneri önbelleği yazılamasa da arama çalışır. */ }
  return merged;
}
export function suggestPlayerNames(query: string, knownNames: string[] = [], limit = 8): string[] {
  const q = compact(query);
  if (q.length < 2) return [];
  return uniquePlayerNames([...knownNames, ...STARTER_NAMES]).map((name, index) => {
    const normalized = normalizePlayerName(name), joined = compact(name);
    const words = normalized.split(/[^\p{L}\p{N}]+/u);
    const score = joined === q ? 0 : words.includes(q) ? 1 : joined.startsWith(q) ? 2 : words.some(word => word.startsWith(q)) ? 3 : 4;
    return { name, index, score, match: joined.includes(q) };
  }).filter(row => row.match).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, Math.max(0, Math.min(20, limit))).map(row => row.name);
}
