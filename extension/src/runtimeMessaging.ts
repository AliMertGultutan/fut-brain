/// <reference types="chrome" />
export const disconnectedReply = () => ({ ok: false, installed: false, message: 'Eklenti yenilendi. FUT Brain ve EA sekmelerini yenileyerek tekrar bağlan.' });

// sendMessage geçersiz bağlamda Promise döndürmeden de hata fırlatabilir.
export async function sendRuntimeMessage(api: typeof chrome, message: unknown, retire: () => void) {
  try {
    if (!api.runtime?.id) { retire(); return disconnectedReply(); }
    return await api.runtime.sendMessage(message);
  } catch (error: any) {
    if (/extension context invalidated/i.test(String(error?.message || ''))) { retire(); return disconnectedReply(); }
    return { ok: false, message: 'Eklenti yanıt vermedi. Bağlantıyı yeniden kontrol et.' };
  }
}
