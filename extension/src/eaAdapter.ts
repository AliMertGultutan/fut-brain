import type { EaPlan, EaImportResult } from '../../src/services/eaBridgeProtocol.ts';

// Chrome bu fonksiyonu EA sayfasına kopyalar. Bütün yardımcılar fonksiyonun içinde kalır.
// Yalnızca EA'nın mevcut istemci nesneleri kullanılır; çerez/şifre/oturum anahtarı okunmaz.
export async function importEaConcept(plan: EaPlan, replaceDraft = false, testRuntime?: any): Promise<EaImportResult> {
  const g: any = testRuntime || window;
  const normalize = (s: unknown) => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss').replace(/\bvs\b/g, 'v').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const problem = (code: string, message: string) => Object.assign(new Error(message), { code });
  const observe = (observable: any): Promise<any> => new Promise((resolve, reject) => {
    if (!observable || typeof observable.observe !== 'function') return reject(problem('EA_INCOMPATIBLE', 'EA arayüzü değişmiş. Eklenti uyumluluk güncellemesi gerekiyor.'));
    const observer = {};
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; observable.unobserve?.(observer); reject(problem('EA_TIMEOUT', 'EA yanıtı gecikti. Otomatik tekrar yapılmadı; Web App ekranını kontrol et.')); } }, 20000);
    try { observable.observe(observer, (_sender: any, result: any) => {
      if (settled) return; settled = true; clearTimeout(timer); observable.unobserve?.(observer);
      if (!result?.success) reject(problem('EA_REQUEST_FAILED', 'EA isteği tamamlanmadı. Oturumunu ve Web App bağlantısını kontrol et.'));
      else resolve(result);
    }); } catch { settled = true; clearTimeout(timer); reject(problem('EA_INCOMPATIBLE', 'EA arayüzüyle bağlantı kurulamadı.'));
    }
  });
  let squad: any, previous: any[] | null = null, modified = false, saveStarted = false, saveFinished = false, ownsLock = false;
  try {
    if (!g.GAME_NAME) throw problem('EA_NOT_READY', 'EA Web App’e giriş yapıp ana ekranın yüklenmesini bekle; ardından kadroyu siteden yeniden gönder.');
    if (String(g.GAME_NAME) !== 'fc27') throw problem('EA_WRONG_YEAR', 'EA FC 27 Web App oturumunu aç. Başka oyun yılına kadro aktarılmaz.');
    if (!['requestSets', 'requestChallengesForSet', 'loadChallenge', 'saveChallenge'].every(key => typeof g.services?.SBC?.[key] === 'function') || !g.services?.Item?.searchConceptItems || !g.repositories?.Item?.getStaticData || !g.UTSearchCriteriaDTO || g.SearchType?.PLAYER === undefined ||
      !g.getAppMain || !g.UTGameTabBarController || !g.UTSBCSquadSplitViewController || !g.UTSBCSquadOverviewViewController) throw problem('EA_NOT_READY', 'EA Web App’e giriş yapıp ana ekranın yüklenmesini bekle; ardından yeniden dene.');
    if (g.__futBrainImportBusy) throw problem('EA_BUSY', 'EA tarafında bir kadro aktarımı zaten devam ediyor.');
    g.__futBrainImportBusy = true; ownsLock = true;
    const setsResult = await observe(g.services.SBC.requestSets());
    const sets = (setsResult.data?.sets || []).filter((set: any) => normalize(set.name) === normalize(plan.setName));
    if (sets.length !== 1) throw problem('EA_SET_NOT_FOUND', 'SBC grubu EA’da tekil olarak bulunamadı. Güncel görev koşullarını siteden yeniden getir.');
    const set = sets[0];
    if (set.hasExpired?.() || set.isComplete?.() || set.isOneClickSBC?.()) throw problem('EA_SET_UNAVAILABLE', 'Görev tamamlanmış, süresi dolmuş veya puanlı SBC türünde.');
    const challengeResult = await observe(g.services.SBC.requestChallengesForSet(set));
    const challenges = (challengeResult.data?.challenges || []).filter((c: any) => normalize(c.name) === normalize(plan.challengeName));
    if (challenges.length !== 1) throw problem('EA_CHALLENGE_NOT_FOUND', 'Alt görev EA’da tekil olarak bulunamadı. Güncel SBC koşullarını kontrol et.');
    const challenge = challenges[0];
    if (challenge.setId !== set.id || challenge.hasExpired?.() || challenge.isCompleted?.() || challenge.isOneClickChallenge?.()) throw problem('EA_CHALLENGE_UNAVAILABLE', 'Bu alt görev aktarım için uygun değil.');
    await observe(g.services.SBC.loadChallenge(challenge));
    squad = challenge.squad;
    if (!squad?.getFieldPlayers || !squad?.getPlayers || !squad?.setPlayers || !squad?.removeAllItems || !challenge.meetsRequirements || !challenge.isRequirementMet) throw problem('EA_INCOMPATIBLE', 'EA kadro arayüzü değişmiş. Eklenti güncellemesi gerekiyor.');
    if (plan.catalogGold) {
      const catalog = g.repositories.Item.getStaticData();
      if (!Array.isArray(catalog)) throw problem('EA_CATALOG_NOT_READY', 'EA oyuncu kataloğu henüz hazır değil.');
      const candidates = catalog.filter((p: any) => Number.isInteger(p.id) && p.id > 0 && p.rating >= 75 && p.rating <= 99 && typeof p.name === 'string' && p.name.trim()).sort((a: any, b: any) => a.rating - b.rating || a.id - b.id);
      const chosen: any[] = [], names = new Set<string>();
      for (const p of candidates) { const name = normalize(p.name); if (names.has(name) || candidates.filter((c: any) => normalize(c.name) === name && c.rating === p.rating).length !== 1) continue; names.add(name); chosen.push(p); if (chosen.length === 10) break; }
      if (chosen.length !== 10) throw problem('EA_CATALOG_NOT_READY', 'EA kataloğunda 10 tekil standart altın aday doğrulanamadı.');
      // Kaynak kart kimliği uydurulmaz: bu adaylar doğrudan EA kataloğundan eşleştirilir.
      plan = { ...plan, players: chosen.map(p => ({ futbinId: '', name: p.name, rating: p.rating, cardVersion: 'Normal', slot: 'AUTO' })) };
    }
    const formation = squad.getFormation?.();
    const actualFormation = String(formation?.getName?.() || formation?.name || formation?.displayName || challenge.formation || '').replace(/\D/g, '');
    const automatic = plan.placement === 'OPEN_SLOTS';
    if (!automatic && actualFormation !== plan.formation.replace(/\D/g, '')) throw problem('EA_FORMATION_CHANGED', 'EA’daki diziliş kaynak önerisiyle farklı. SBC koşullarını yeniden getir.');
    const allSlots = squad.getFieldPlayers();
    if (!Array.isArray(allSlots) || allSlots.length !== 11) throw problem('EA_LOCKED_SLOTS', 'EA saha slotları doğrulanamadı.');
    const slots = allSlots.filter((slot: any) => !slot.isBrick?.());
    if (slots.length !== plan.players.length || (automatic ? slots.length !== 10 : slots.length !== 11)) throw problem('EA_LOCKED_SLOTS', 'Açık slot sayısı öneriyle eşleşmiyor. Kilitli slot değiştirilmez.');
    const fingerprint = () => squad.getPlayers().map((slot: any) => `${slot.getIndex()}:${slot.getItem()?.id || 0}:${slot.getItem()?.definitionId || 0}:${slot.getItem()?.concept === true}`).join('|');
    const originalFingerprint = fingerprint();
    const staticData = g.repositories.Item.getStaticData();
    if (!Array.isArray(staticData) || !staticData.length) throw problem('EA_CATALOG_NOT_READY', 'EA oyuncu kataloğu henüz hazır değil. Web App’te oyuncu arama ekranını bir kez açıp yeniden dene.');
    const resolved = plan.players.map(player => {
      const name = normalize(player.name);
      const candidates = staticData.filter((p: any) => p.rating === player.rating && [p.name, `${p.firstName || ''} ${p.lastName || ''}`, p.commonName].some(n => n && normalize(n) === name));
      if (candidates.length !== 1 || !Number.isInteger(candidates[0]?.id) || candidates[0].id <= 0) throw problem('EA_PLAYER_AMBIGUOUS', `${player.name}: aynı isim ve reytingde tek bir EA kartı doğrulanamadı. Hiçbir kart değiştirilmedi.`);
      return { player, assetId: candidates[0].id };
    });
    if (new Set(resolved.map(r => r.assetId)).size !== plan.players.length) throw problem('EA_DUPLICATE_PLAYER', 'EA kimlik eşleştirmesinde tekrarlanan futbolcu var.');
    const assigned = slots.map((slot: any) => {
      const position = String(slot.getGeneralPositionName?.() || slot.generalPositionName || '').toUpperCase();
      const index = automatic ? 0 : resolved.findIndex(r => r.player.slot === position);
      if (index < 0) throw problem('EA_POSITION_MISMATCH', 'EA slotları önerilen mevkilerle eşleşmiyor. Kadro değiştirilmedi.');
      return { slot, resolved: resolved.splice(index, 1)[0] };
    });
    const readResult = (alreadyPlaced: boolean): EaImportResult => ({ ok: true, code: alreadyPlaced ? 'ALREADY_PLACED' : 'PLACED', saved: true, alreadyPlaced,
      message: alreadyPlaced ? 'Bu konsept kadro EA’da zaten yerinde; tekrar kaydedilmedi.' : `${slots.length} konsept kart EA taslağına kaydedildi. Koşulları EA ekranında incele.`,
      rating: squad.getRating(), chemistry: squad.getChemistry(), playerCount: slots.length });
    const isSame = assigned.every(({ slot, resolved: r }: any) => { const item = slot.getItem(); return item?.concept === true && item.definitionId === r.assetId && item.rating === r.player.rating; });
    const allSatisfied = () => challenge.meetsRequirements() === true && Array.isArray(challenge.eligibilityRequirements) && challenge.eligibilityRequirements.length > 0 && challenge.eligibilityRequirements.every((r: any) => challenge.isRequirementMet(r) === true);
    const openChallenge = () => {
      try { const root = g.getAppMain().getRootViewController(); root.setGameViewTab(g.UTGameTabBarController.TabTag.SBC);
        const navigation = root.getPresentedViewController().getCurrentViewController();
        const Controller = g.isPhone?.() ? g.UTSBCSquadOverviewViewController : g.UTSBCSquadSplitViewController;
        const controller = new Controller(); controller.initWithSBCSet(set, challenge.id); navigation.pushViewController(controller); return true;
      } catch { return false; }
    };
    if (isSame && allSatisfied()) { const result = readResult(true); openChallenge(); return result; }
    const occupied = slots.some((slot: any) => slot.isValid());
    if (occupied && !replaceDraft) return { ok: false, code: 'EA_DRAFT_EXISTS', requiresOverwrite: true, message: 'Bu SBC’de farklı bir taslak var. Yerleştirme için EA bildirimindeki “Mevcut Taslağı Değiştir” düğmesini kullan.' };
    const criteria = new g.UTSearchCriteriaDTO(); criteria.type = g.SearchType.PLAYER;
    criteria.defId = assigned.map((a: any) => a.resolved.assetId); criteria.count = 21; criteria.offset = 0;
    const found: any[] = [];
    for (let page = 0; page < 3; page++) {
      const result = await observe(g.services.Item.searchConceptItems(criteria));
      if (!Array.isArray(result.response?.items)) throw problem('EA_CONCEPT_RESPONSE_INVALID', 'EA konsept kart yanıtı doğrulanamadı.');
      found.push(...result.response.items);
      if (result.response.endOfList !== false) break;
      criteria.offset += criteria.count;
    }
    const items = assigned.map(({ resolved: r }: any) => {
      const matches = [...new Map(found.filter(item => item.concept === true && item.isPlayer?.() && item.isSpecial?.() === false && item.definitionId === r.assetId && item.rating === r.player.rating).map(item => [item.definitionId, item])).values()];
      if (matches.length !== 1) throw problem('EA_CONCEPT_NOT_FOUND', `${r.player.name}: standart konsept kart tekil olarak bulunamadı. Taslak değiştirilmedi.`);
      return matches[0];
    });
    if (fingerprint() !== originalFingerprint) throw problem('EA_DRAFT_CHANGED', 'Arama sırasında EA taslağı değişti. Güncel kadroyu kontrol edip yeniden gönder.');
    const snapshot: any[] = squad.getPlayers().map((slot: any) => slot.getItem()); previous = snapshot;
    const next = [...snapshot]; assigned.forEach(({ slot }: any, i: number) => { next[slot.getIndex()] = items[i]; });
    modified = true; squad.setPlayers(next, true);
    if (!assigned.every(({ slot, resolved: r }: any) => slot.getItem()?.concept === true && slot.getItem()?.definitionId === r.assetId) || !allSatisfied()) throw problem('EA_REQUIREMENTS_FAILED', 'EA koşulları karşılanmadı. Önceki taslak geri yüklendi; öneriyi yeniden oluştur.');
    saveStarted = true; await observe(g.services.SBC.saveChallenge(challenge)); saveFinished = true;
    const result = readResult(false);
    if (!openChallenge()) result.message = 'Konsept kadro kaydedildi. EA’da ilgili SBC’yi açarak inceleyebilirsin.';
    return result;
  } catch (error: any) {
    if (modified && !saveFinished && previous && squad) { try { squad.removeAllItems(true); squad.setPlayers([...previous], true); } catch { /* Sonuç belirsizse kullanıcıya EA ekranını kontrol etmesi söylenir. */ } }
    return { ok: false, code: error?.code || 'EA_INCOMPATIBLE', mayHaveSaved: saveStarted && !saveFinished,
      message: saveStarted && !saveFinished ? 'EA kaydetme sonucu doğrulanamadı. Otomatik tekrar yapılmadı; Web App’i yenileyip taslağı kontrol et.' : error?.code ? error.message : 'EA arayüzüyle uyumluluk doğrulanamadı. Eklenti güncellemesi gerekiyor.' };
  } finally { if (ownsLock) g.__futBrainImportBusy = false; }
}
