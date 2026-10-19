// Bu fonksiyon Chrome tarafından EA'nın MAIN dünyasına kopyalanır. Dış yardımcı kullanmaz.
export async function readEaActiveSquad(testRuntime?: any) {
  const g: any = testRuntime || window;
  const unavailable = (message: string) => ({ ok: false as const, message });
  if (g.GAME_NAME !== 'fc27' || !g.services?.Squad?.requestSquadList || !g.services?.Squad?.requestSquadById) return unavailable('EA FC 27 Web App’e giriş yapıp ana ekranın yüklenmesini bekle.');
  const observe = (o: any): Promise<any> => new Promise((resolve, reject) => {
    if (!o?.observe) return reject(new Error()); const owner = {}; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; o.unobserve?.(owner); reject(new Error()); } }, 12000);
    try { o.observe(owner, (_: any, r: any) => { if (done) return; done = true; clearTimeout(timer); o.unobserve?.(owner); r?.success ? resolve(r) : reject(new Error()); }); } catch { done = true; clearTimeout(timer); reject(new Error()); }
  });
  try {
    const list = await observe(g.services.Squad.requestSquadList()), id = list.data?.activeSquadId;
    if (!Number.isInteger(id) || id < 0) return unavailable('EA’da aktif bir ana kadro bulunamadı.');
    const loaded = await observe(g.services.Squad.requestSquadById(id)), squad = loaded.data?.squad;
    if (!squad?.getFieldPlayers || !squad?.getFormation || !squad?.getPlayers) return unavailable('EA kadro arayüzüyle uyumluluk güncellemesi gerekiyor.');
    const formation = squad.getFormation(), fields = squad.getFieldPlayers();
    const allowed = new Set('GK LB CB RB LWB RWB CDM CM CAM LM RM LW RW LF RF ST CF'.split(' '));
    const position = (id: any) => { const dto = g.repositories?.Squad?.getPosition?.(id), name = dto?.getTypeName?.() || dto?.typeName; return allowed.has(name) ? name : null; };
    const card = (item: any) => {
      if (!item?.isPlayer?.()) return null;
      // databaseId oyuncuyu, definitionId kart sürümünü tanımlar. getAssetId() kart türüdür.
      const assetId = item.databaseId;
      const data = item.getStaticData?.(), catalog = g.repositories?.Item?.getStaticDataByDefId?.(assetId);
      const name = [data?.getFullName?.(), data?.knownAs, data?.commonName, [data?.firstName, data?.lastName].filter(Boolean).join(' '), data?.name, catalog?.name].find(n => typeof n === 'string' && n.trim());
      if (!name) throw new Error();
      const primary = position(item.preferredPosition), possible = Array.isArray(item.possiblePositions) ? item.possiblePositions.map(position) : [];
      const attributes = item.getAttributes?.();
      const stats = primary !== 'GK' && Array.isArray(attributes) && attributes.length === 6 && attributes.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 99) && attributes.some((n: number) => n > 0) ? attributes : null;
      const styles = item.getPlayStyles?.(), meta = item.getMetaData?.(), stylesKnown = !!meta && (Array.isArray(meta.baseTraits) || Array.isArray(meta.iconTraits)) && Array.isArray(styles) && styles.every((s: any) => typeof s.name === 'string' || Number.isInteger(s.traitId));
      const localized = (key: string) => {
        try { const text = g.services?.Localization?.localize?.(key, [], { gender: item.gender }); return typeof text === 'string' && text !== key && !text.includes('extendedPlayerInfo.') ? text : ''; } catch { return ''; }
      };
      // EA'nın oyun tarzı listesi ve ayrıntı penceresindeki güncel ad/açıklama anahtarları.
      const playStyleDetails = stylesKnown ? styles.filter((s: any) => Number.isInteger(s.traitId)).map((s: any) => {
        const isPlus = s.isIcon === true || s.isPlus === true;
        return { id: s.traitId, name: localized(`extendedPlayerInfo.signatureAbility.name.${s.traitId}`) || (typeof s.name === 'string' ? s.name : ''), isPlus, description: localized(`extendedPlayerInfo.signatureAbility.desc.${s.traitId}.${isPlus ? 'iconTrait' : 'baseTrait'}`) || null };
      }) : [];
      let portraitUrl = '', shellUrl = '';
      try {
        const assets = g.AssetLocationUtils, rarity = g.services?.Configuration?.getItemRarity?.(item);
        portraitUrl = assets?.getPortraitImageUri?.(item.isSpecial?.() && item.guidAssetId ? item.definitionId : assetId, item.isSpecial?.() && item.guidAssetId ? item.guidAssetId : undefined) || '';
        shellUrl = assets?.getShellUri?.(g.ItemViewSize?.LARGE, 1, item.rareflag, item.getTier?.(), item.isSpecial?.() ? rarity?.getGuid?.() || '' : '') || '';
      } catch { /* Görsel servisi kullanılamazsa başka oyuncunun resmi gösterilmez. */ }
      const loc = g.UTLocalizationUtil, localization = g.services?.Localization;
      const translated = (method: string, id: any) => { try { return String(loc?.[method]?.(id, localization) || ''); } catch { return ''; } };
      return { id: String(item.id), definitionId: item.definitionId, assetId, portraitUrl, shellUrl, name: String(name).trim(), rating: item.rating, position: primary, secondaryPositions: [...new Set(possible.filter((p: any) => p && p !== primary))], positionsKnown: primary !== null && Array.isArray(item.possiblePositions) && possible.length > 0 && possible.every(Boolean), concept: item.concept === true, untradeable: item.isTradeable?.() === false, special: item.isSpecial?.() === true, club: translated('teamIdToName', item.teamId), league: translated('leagueIdToName', item.leagueId), nation: translated('nationIdToAbbr12', item.nationId), stats, playStyles: stylesKnown ? styles.map((s: any) => String(s.name || `PS ${s.traitId}`) + (s.isIcon === true || s.isPlus === true ? '+' : '')) : [], playStyleDetails, playStylesKnown: stylesKnown };
    };
    if (!Array.isArray(fields) || fields.length !== 11) throw new Error();
    let coinsBalance: number | null = null;
    try {
      // EA üst çubuğuyla aynı mevcut bakiye okunur; ek istek veya harcama yapılmaz.
      const raw = g.services?.User?.getUser?.()?.getCurrencies?.(), currencies = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const coins = g.GameCurrency?.COINS === undefined ? undefined : currencies.find((c: any) => c.type === g.GameCurrency.COINS)?.amount;
      if (Number.isSafeInteger(coins) && coins >= 0) coinsBalance = coins;
    } catch { /* Bakiye bilinmiyorsa sıfır olarak gösterilmez. */ }
    return { ok: true as const, squad: { version: 1, year: '27', squadId: String(id), name: String(squad.getName?.() || 'Aktif kadrom'), formation: String(formation?.getDisplayName?.() || formation?.displayName || formation?.getName?.() || ''), observedAt: new Date().toISOString(), rating: squad.getRating(), chemistry: squad.getChemistry(), coinsBalance,
      slots: fields.map((slot: any) => ({ index: slot.getIndex(), position: slot.getGeneralPositionName(), uniquePosition: slot.getUniquePositionName?.() || '', chemistry: slot.isValid() ? slot.getChemistry?.() ?? null : null, player: slot.isValid() ? card(slot.getItem()) : null })),
      bench: squad.getPlayers().filter((slot: any) => slot.getIndex() >= 11 && slot.isValid()).map((slot: any) => card(slot.getItem())).filter(Boolean) } };
  } catch { return unavailable('Aktif kadro henüz okunamadı. EA’ya giriş yaptıktan sonra Kadro ekranındaki Yenile düğmesini kullan.'); }
}
