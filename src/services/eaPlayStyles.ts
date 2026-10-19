export interface EaPlayStyle { id: number; name: string; isPlus: boolean; description: string | null }
export function eaPlayStyleIcon(style: Pick<EaPlayStyle, 'id' | 'isPlus'>) {
  return Number.isInteger(style.id) && style.id >= 0 && style.id <= 999 ? `https://www.ea.com/ea-sports-fc/ultimate-team/web-app/images/traits/bio/${style.isPlus ? 'icon' : 'base'}trait${style.id}.png` : '';
}
export function normalizeEaPlayStyles(value: unknown): EaPlayStyle[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error('EA oyun tarzı verisi doğrulanamadı.');
  const styles = new Map<number, EaPlayStyle>();
  for (const s of value) {
    if (!s || !Number.isInteger(s.id) || s.id < 0 || s.id > 999 || typeof s.name !== 'string' || s.name.length > 120 || typeof s.isPlus !== 'boolean' || !(s.description === null || typeof s.description === 'string' && s.description.length <= 2000)) throw new Error('EA oyun tarzı verisi doğrulanamadı.');
    // Aynı tarzın geliştirilmiş hali normal halinin yerine geçer; iki kez sayılmaz.
    if (!styles.get(s.id)?.isPlus) styles.set(s.id, { id: s.id, name: s.name, isPlus: s.isPlus, description: s.description });
  }
  return [...styles.values()];
}
