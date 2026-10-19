import React, { useState } from 'react';
import { eaPlayStyleIcon } from '../services/eaPlayStyles.ts';
import type { EaPlayStyle } from '../services/eaPlayStyles.ts';
function PlayStyle({ style }: { style: EaPlayStyle }) {
  const [failed, setFailed] = useState(false);
  return <details className={`rounded-lg border px-2 py-1 ${style.isPlus ? 'border-primary-fixed/40 bg-primary-fixed/5' : 'border-outline-variant/60 bg-surface-container'}`}>
    <summary className="flex cursor-pointer items-center gap-2.5 min-h-11 focus-visible:outline-2 focus-visible:outline-primary rounded">
      {failed ? <span className="w-7 h-7 flex shrink-0 items-center justify-center text-outline text-xs">—</span> : <img src={eaPlayStyleIcon(style)} width="28" height="28" alt="" aria-hidden="true" loading="lazy" referrerPolicy="no-referrer" className="w-7 h-7 object-contain shrink-0" onError={() => setFailed(true)} />}
      <span className="min-w-0 flex-1"><strong className="block text-[13px] leading-5">{style.name || 'Oyun tarzının adı okunamadı'}{style.isPlus && ' +'}</strong><span className="text-xs text-outline">{style.isPlus ? 'PlayStyle+ · Geliştirilmiş' : 'PlayStyle · Normal'}</span></span><span className="text-outline text-xs" aria-hidden="true">⌄</span>
    </summary><p className="text-[13px] leading-relaxed text-on-surface-variant mt-2 pb-1">{style.description || 'Bu oyun tarzının açıklaması EA’dan alınamadı. Kadronu yenileyerek tekrar kontrol edebilirsin.'}</p>
  </details>;
}
export function EaPlayStylesPanel({ styles = [], known, legacyCount = 0 }: { styles?: EaPlayStyle[]; known: boolean; legacyCount?: number }) {
  return <section className="space-y-2" aria-label="Oyun tarzları"><h3 className="font-bold text-sm">Oyun tarzları</h3>
    {!known ? <p className="text-sm text-outline">Oyun tarzı verisi okunamadı; bu kartta yok olarak değerlendirilmez.</p> : !styles.length ? <p className="text-sm text-outline">{legacyCount ? 'Ad ve simgeleri almak için güncel eklentiyle EA Kadromu Yenile’ye bas.' : 'Bu kartta oyun tarzı yok.'}</p> : <>
      <p className="text-xs text-outline">Yalnız bu kartın oyun tarzları · Etkisini okumak için tıkla.</p>
      {styles.some(s => s.isPlus) && <div className="space-y-2"><h4 className="text-sm font-bold text-primary">PlayStyle+ · {styles.filter(s => s.isPlus).length}</h4>{styles.filter(s => s.isPlus).map(s => <PlayStyle key={s.id} style={s} />)}</div>}
      {styles.some(s => !s.isPlus) && <div className="space-y-2"><h4 className="text-sm font-bold">Normal PlayStyle · {styles.filter(s => !s.isPlus).length}</h4>{styles.filter(s => !s.isPlus).map(s => <PlayStyle key={s.id} style={s} />)}</div>}
    </>}
  </section>;
}
