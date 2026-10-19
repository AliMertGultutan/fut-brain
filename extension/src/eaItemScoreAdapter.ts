// Yalnız görev koşulları ve konsept kart puanları okunur; kart seçilmez veya teslim edilmez.
export async function readEaItemScores(request: { setName: string; segmentName: string; cards: { key: string; name: string; commonName: string; rating: number }[] }, testRuntime?: any) {
  const g: any = testRuntime || window, fail = (message: string) => ({ ok: false as const, message });
  if (g.GAME_NAME !== 'fc27' || !g.services?.SBC?.requestSets || !g.services?.Item?.searchConceptItems || !g.UTSearchCriteriaDTO) return fail('FC 27 Web App’e giriş yapıp SBC ekranını aç.');
  if (!request || typeof request.setName !== 'string' || typeof request.segmentName !== 'string' || request.setName.length > 150 || request.segmentName.length > 150 || !Array.isArray(request.cards) || request.cards.length > 60) return fail('Puan isteği geçersiz.');
  const observe = (o: any): Promise<any> => new Promise((resolve,reject) => {
    if (!o?.observe) return reject(new Error()); const owner = {}; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; o.unobserve?.(owner); reject(new Error()); } }, 9000);
    try { o.observe(owner, (_: any, r: any) => { if (done) return; done = true; clearTimeout(timer); o.unobserve?.(owner); r?.success ? resolve(r) : reject(new Error()); }); } catch { done = true; clearTimeout(timer); reject(new Error()); }
  });
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  try {
    const sets = (await observe(g.services.SBC.requestSets())).data?.sets;
    const matches = Array.isArray(sets) ? sets.filter((s: any) => normalize(s.name) === normalize(request.setName) && !s.hasExpired?.()) : [];
    if (matches.length !== 1) return fail('Görev EA’da tekil bulunamadı. SBC listesini ve açık EA oturumunu kontrol et.');
    const challenges = (await observe(g.services.SBC.requestChallengesForSet(matches[0]))).data?.challenges;
    const tasks = Array.isArray(challenges) ? challenges.filter((c: any) => normalize(c.name) === normalize(request.segmentName)) : [];
    if (tasks.length !== 1) return fail('Alt görev EA’da doğrulanamadı.');
    const task = tasks[0];
    if (!Number.isInteger(task.scoreRequirement) || task.scoreRequirement < 1 || task.scoreRequirement > 100000 || task.hasExpired?.()) return fail('Bu görev açık bir Item Score görevi olarak doğrulanamadı.');
    if (!Array.isArray(task.eligibilityRequirements) || !Number.isSafeInteger(task.submittedScore) || task.submittedScore < 0) return fail('Görevin koşulları veya teslim edilmiş puanı okunamadı.');
    if (task.eligibilityRequirements.length > 1 && task.eligibilityOperation !== g.SBCEligibilityOperation?.AND) return fail('Bu görevin birleşik kart koşulları henüz desteklenmiyor.');
    const min = [], max = [], exact = [];
    for (const r of task.eligibilityRequirements) {
      const keys = r.keys?.(); if (!Array.isArray(keys) || keys.length !== 1) return fail('Bu puan görevinin ek koşulları henüz desteklenmiyor.');
      // EA tablosu anahtarları sayı yerine sayısal metin döndürebilir.
      if (!/^\d+$/.test(String(keys[0]))) return fail('Görevin kart koşulu okunamadı.');
      const key = Number(keys[0]), values = r.getValue?.(keys[0]);
      if (!Array.isArray(values) || values.length !== 1) return fail('Bu görevin çok değerli kart koşulu henüz desteklenmiyor.');
      const value = r.getFirstValue?.(keys[0]);
      if (!Number.isInteger(value) || value < 1 || value > 99) return fail('Görevin kart koşulu okunamadı.');
      if (key === g.SBCEligibilityKey?.PLAYER_MIN_OVR) min.push(value);
      else if (key === g.SBCEligibilityKey?.PLAYER_MAX_OVR) max.push(value);
      else if (key === g.SBCEligibilityKey?.PLAYER_EXACT_OVR) exact.push(value);
      else return fail('Bu görevdeki ek kart koşulu için otomatik F/P önerisi henüz açılamıyor.');
    }
    const catalog = g.repositories?.Item?.getStaticData?.(); if (!Array.isArray(catalog)) return fail('EA oyuncu kataloğu henüz hazır değil.');
    const resolved: any[] = [];
    for (const c of request.cards) {
      if (typeof c.key !== 'string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(c.key) || typeof c.name !== 'string' || typeof c.commonName !== 'string' || !Number.isInteger(c.rating) || c.rating < 1 || c.rating > 99) continue;
      if (min.some(n => c.rating < n) || max.some(n => c.rating > n) || exact.some(n => c.rating !== n)) continue;
      const names = [c.name, c.commonName].filter(Boolean).map(normalize);
      const players = catalog.filter((p: any) => p.rating === c.rating && [p.name, p.commonName, [p.firstName, p.lastName].filter(Boolean).join(' ')].some(n => n && names.includes(normalize(n))));
      if (players.length === 1 && Number.isSafeInteger(players[0].id)) resolved.push({ card: c, defId: players[0].id });
    }
    const found: any[] = [];
    if (resolved.length) {
      const criteria = new g.UTSearchCriteriaDTO(); criteria.type = g.SearchType.PLAYER; criteria.defId = [...new Set(resolved.map(c => c.defId))]; criteria.count = 21; criteria.offset = 0;
      for (let page = 0; page < 3; page++) { const result = await observe(g.services.Item.searchConceptItems(criteria)); if (!Array.isArray(result.response?.items)) throw new Error(); found.push(...result.response.items); if (result.response.endOfList !== false) break; criteria.offset += 21; }
    }
    const cards = resolved.flatMap(r => {
      const items = found.filter(p => p.definitionId === r.defId && p.rating === r.card.rating && p.concept === true && p.isPlayer?.() && p.isSpecial?.() === false && Number.isInteger(p.sbsScore) && p.sbsScore > 0);
      const scores = [...new Set(items.map(p => p.sbsScore))]; return scores.length === 1 ? [{ key: r.card.key, definitionId: r.defId, rating: r.card.rating, score: scores[0] }] : [];
    });
    return { ok: true as const, itemScores: { target: task.scoreRequirement, submitted: task.submittedScore, observedAt: new Date().toISOString(), setName: String(matches[0].name), cards, unmatched: request.cards.length - cards.length } };
  } catch { return fail('EA kart puanları okunamadı. Web App’te ilgili SBC’yi açıp tekrar dene.'); }
}
