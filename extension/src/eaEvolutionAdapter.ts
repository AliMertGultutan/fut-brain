// EA'nın salt okunur EVO listesi ve kart önizleme hizmetlerini kullanır; kayıt veya satın alma yapmaz.
// MAIN dünyasına kopyalandığı için dış modül yardımcısı kullanmaz.
export async function readEaPlayerEvolutions(playerId: string, programId?: string, testRuntime?: any) {
  const g: any = testRuntime || window;
  const failure = (message: string) => ({ ok: false as const, message });
  if (!/^[1-9]\d{0,19}$/.test(playerId) || programId !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(programId)) return failure('Oyuncu veya EVO kimliği geçersiz.');
  if (g.GAME_NAME !== 'fc27' || !g.services?.Academy?.requestAcademyHub || !g.UTAcademySlotSearchCriteriaDTO) return failure('EA FC 27’ye giriş yapıp Evolutions ekranının yüklenmesini bekle.');
  const observe = (o: any): Promise<any> => new Promise((resolve, reject) => {
    if (!o?.observe) return reject(new Error()); const owner = {}; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; o.unobserve?.(owner); reject(new Error()); } }, 7000);
    try { o.observe(owner, (_: any, r: any) => { if (done) return; done = true; clearTimeout(timer); o.unobserve?.(owner); r?.success ? resolve(r.data) : reject(new Error()); }); } catch { done = true; clearTimeout(timer); reject(new Error()); }
  });
  let stage = 'SQUAD';
  try {
    const list = await observe(g.services.Squad.requestSquadList());
    if (!Number.isInteger(list?.activeSquadId)) throw new Error();
    const loaded = await observe(g.services.Squad.requestSquadById(list.activeSquadId));
    const item = loaded?.squad?.getPlayers?.().filter((s: any) => s.isValid?.()).map((s: any) => s.getItem?.()).find((p: any) => String(p?.id) === playerId);
    if (!item?.isPlayer?.() || item.concept) return failure('Bu oyuncu artık aktif kadroda değil veya konsept kart. Kadronu yenile.');
    const academy = g.services.Academy, criteria = new g.UTAcademySlotSearchCriteriaDTO();
    criteria.count = 20; criteria.offset = 0;
    stage = 'HUB'; const hub = await observe(academy.requestAcademyHub(criteria));
    const slots = new Map<string, any>(), deadline = Date.now() + 20000; let partial = false, calls = 0;
    const add = (rows: any) => { if (!Array.isArray(rows)) throw new Error(); for (const slot of rows) slots.set(String(slot.id), slot); };
    add(hub.slots);
    const categories = Array.isArray(hub.categories) ? hub.categories : academy.getCategories?.() || [];
    // Kategori ve sayfa sayısı sınırlıdır; eksik tarama sonuçta açıkça bildirilir.
    for (const category of categories) {
      for (let offset = 0; ; offset += 20) {
        if (calls >= 12 || Date.now() > deadline) { partial = true; break; }
        const query = new g.UTAcademySlotSearchCriteriaDTO(); query.count = 20; query.offset = offset; query.categoryId = category.id;
        stage = 'CATEGORY'; const page = await observe(academy.requestSlotsByCategory(query)); calls++; add(page.slots);
        if (page.slots.length < 20) break;
      }
      if (partial) break;
    }
    if (!categories.length && (hub.availableSlotsCount || 0) > slots.size) partial = true;
    stage = 'RULES'; const programs: any[] = [];
    for (const slot of slots.values()) {
      if (!slot.isAvailable?.() || slot.hidden || slot.isStarted?.() || slot.hasEnrollmentExpired?.() || slot.hasEndTimeExpired?.() || slot.isOnCooldown?.()) continue;
      const checks: any[] = [];
      for (const r of slot.eligibilityRequirements || []) {
        const labels: Record<string, string> = { OVR: 'Genel reyting', PACE: 'Hız', SHOOTING: 'Şut', PASSING: 'Pas', DRIBBLING_MAIN: 'Dribling', DEFENSE: 'Defans', PHYSICALITY: 'Fizik', POSITION: 'Mevki', PLAYSTYLES: 'Oyun tarzı sayısı', SKILL_MOVES: 'Beceri', WEAK_FOOT: 'Zayıf ayak' };
        const attributeKey = g.AcademyEligibilityAttribute?.[r.attribute] || 'Koşul', scopeKey = g.AcademyEligibilityScope?.[r.scope] || '';
        const attribute = labels[attributeKey] || attributeKey, scope = ({ MAX: 'En fazla', MIN: 'En az', EXACT: 'Tam', BETWEEN: 'Aralık' } as Record<string, string>)[scopeKey] || scopeKey;
        let satisfied: boolean | null = null;
        try { if (r.isValid === true && typeof r.meetsRequirements === 'function') { const result = r.meetsRequirements(item); if (typeof result === 'boolean') satisfied = result; } } catch { /* Bilinmeyen koşul uygun sayılmaz. */ }
        checks.push({ label: `${attribute} ${scope} ${(r.targets || []).join(' / ')}`.slice(0, 250), satisfied });
      }
      if (!Array.isArray(slot.eligibilityRequirements)) checks.push({ label: 'Katılım koşulları okunamadı', satisfied: null });
      if (slot.isGkExclusive?.()) checks.push({ label: 'Yalnız kaleci', satisfied: item.isGK?.() === true });
      if (slot.isOutfieldExclusive?.()) checks.push({ label: 'Saha oyuncusu', satisfied: typeof item.isGK === 'function' ? !item.isGK() : null });
      if (item.isActiveInAcademy?.() || item.isActiveInTimedEvolution?.()) checks.push({ label: 'Kart başka bir EVO’da aktif', satisfied: false });
      if (item.isLimitedUse?.()) checks.push({ label: 'Kiralık kart EVO’ya katılamaz', satisfied: false });
      const eligible = checks.some(c => c.satisfied === false) ? false : checks.some(c => c.satisfied === null) ? null : true;
      let finalRating: number | null = item.rating;
      if (slot.isMultiChoice || !Array.isArray(slot.levels)) finalRating = null;
      else for (const level of [...slot.levels].sort((a: any, b: any) => a.id - b.id)) {
        if (!Array.isArray(level.awards)) { finalRating = null; break; }
        for (const reward of level.awards) if (g.AcademyStatEnum?.OVR !== undefined && reward.type === g.AcademyStatEnum.OVR) {
          if (!Number.isInteger(reward.value) || reward.value < 0) { finalRating = null; break; }
          if (finalRating !== null) finalRating = Math.max(finalRating, Math.min(finalRating + reward.value, Number.isInteger(reward.maxValue) && reward.maxValue > 0 ? reward.maxValue : 99));
        }
      }
      if (g.AcademyStatEnum?.OVR === undefined) finalRating = null;
      const coins = slot.getPrice?.(g.GameCurrency?.COINS), points = slot.getPrice?.(g.GameCurrency?.POINTS);
      programs.push({ id: String(slot.id), name: String(slot.slotName || 'Evolution'), cost: coins > 0 ? `${coins} Coins` : points > 0 ? `${points} FC Points` : coins === 0 && points === 0 ? 'Ücretsiz' : 'Bedel okunamadı', expiresAt: slot.endTimePurchaseVisibility > 0 ? slot.endTimePurchaseVisibility * 1000 : null, eligible, checks, multiChoice: !!slot.isMultiChoice, finalRating });
    }
    const result: any = { version: 1, playerId, definitionId: item.definitionId, rating: item.rating, observedAt: new Date().toISOString(), partial, programs };
    if (programId) {
      const program = programs.find(p => p.id === programId);
      if (!program || program.eligible !== true) return failure('Bu EVO mevcut karta uygun değil veya katılıma kapalı.');
      if (program.multiChoice) return failure('Bu EVO’da yol seçimi gerekiyor. Son kartı EA Evolutions ekranında seçtiğin yola göre kontrol et.');
      if (!Number.isSafeInteger(Number(playerId))) return failure('EA önizleme oyuncu kimliği desteklenen aralık dışında.');
      // EA deposu kimlikleri türüyle eşler: sayısal kimlik sayı, UUID metin olarak korunur.
      const nativeId = slots.get(programId)?.id;
      if (typeof nativeId !== 'string' && !Number.isSafeInteger(nativeId)) return failure('EA programının kaynak kimliği okunamadı.');
      stage = 'PREVIEW'; const response = await observe(academy.getSlotPreview(nativeId, Number(playerId))), slot = response?.updatedSlot;
      const final = slot?.levels?.reduce((a: any, b: any) => !a || b.id > a.id ? b : a, null)?.boostedPlayer;
      if (!final?.isPlayer?.()) return failure('EA son kart önizlemesini döndürmedi.');
      const attributes = final.isGK?.() ? null : final.getAttributes?.();
      const localized = (key: string) => { try { const text = g.services?.Localization?.localize?.(key, [], { gender: final.gender }); return typeof text === 'string' && text !== key && !text.includes('extendedPlayerInfo.') ? text : ''; } catch { return ''; } };
      const rawStyles = final.getPlayStyles?.(), styles = Array.isArray(rawStyles) ? rawStyles : [], meta = final.getMetaData?.();
      const playStylesKnown = Array.isArray(rawStyles) && (styles.length > 0 || Array.isArray(meta?.baseTraits) || Array.isArray(meta?.iconTraits));
      const playStyleDetails = styles.filter((s: any) => Number.isInteger(s.traitId)).map((s: any) => {
        const isPlus = s.isIcon === true || s.isPlus === true;
        return { id: s.traitId, name: localized(`extendedPlayerInfo.signatureAbility.name.${s.traitId}`) || (typeof s.name === 'string' ? s.name : ''), isPlus, description: localized(`extendedPlayerInfo.signatureAbility.desc.${s.traitId}.${isPlus ? 'iconTrait' : 'baseTrait'}`) || null };
      });
      result.preview = { programId, rating: final.rating, stats: Array.isArray(attributes) && attributes.some((n: any) => n > 0) ? attributes : null, portraitUrl: g.AssetLocationUtils?.getPortraitImageUri?.(final.databaseId) || '', playStyles: styles.map((s: any) => String(s.name || `PS ${s.traitId}`) + (s.isIcon || s.isPlus ? '+' : '')), playStyleDetails, playStylesKnown };
    }
    return { ok: true as const, evolutions: result };
  } catch { return failure(`EA EVO okuması tamamlanamadı (EVO-${stage}). EA’da Evolutions ekranını açıp tekrar dene.`); }
}
