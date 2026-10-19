import { useEffect, useRef, useState } from 'react';
import { CLUBS_MATCH_TYPES, validClubsId } from './clubsData.ts';
import type { ClubsTeam, ClubsDashboard, ClubsMatch, ClubsMatchType } from './clubsData.ts';
const followKey = 'fut-brain-clubs-followed-v1';
const selectionKey = 'fut-brain-clubs-selection-v1';
function readFollowed(): { id: string; name: string }[] { try { const d = JSON.parse(localStorage.getItem(followKey) || '[]'); return Array.isArray(d) ? d.filter(c => validClubsId(c?.id) && typeof c.name === 'string').slice(0,12).map(c => ({ id: c.id, name: c.name.slice(0,120) })) : []; } catch { return []; } }
function route() {
  const [,id,type] = location.hash.slice(1).split('/');
  if (validClubsId(id)) return { id, type: CLUBS_MATCH_TYPES.includes(type as ClubsMatchType) ? type as ClubsMatchType : 'leagueMatch' as const };
  try { const saved = JSON.parse(localStorage.getItem(selectionKey) || 'null'); if (validClubsId(saved?.id) && CLUBS_MATCH_TYPES.includes(saved.type)) return { id: saved.id as string, type: saved.type as ClubsMatchType }; } catch { /* Depolama kapalıysa arama ekranı açılır. */ }
  return { id: '', type: 'leagueMatch' as ClubsMatchType };
}
async function get<T>(url: string, signal?: AbortSignal): Promise<T> { const r = await fetch('/api/clubs/' + url, { signal: signal || AbortSignal.timeout(45000) }); const d = await r.json().catch(() => null); if (!r.ok || !d) throw new Error(d?.error || 'Clubs veri sunucusuna ulaşılamadı.'); return d; }
export function useClubs() {
  const [followed, setFollowed] = useState(readFollowed), [selection, setSelection] = useState(route);
  const [data, setData] = useState<ClubsDashboard | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [results, setResults] = useState<ClubsTeam[] | null>(null), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const [archive, setArchive] = useState<ClubsMatch[] | null>(null), [archiveBusy, setArchiveBusy] = useState(false), [archiveError, setArchiveError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [auto, setAuto] = useState(true), [now, setNow] = useState(Date.now());
  const autoRef = useRef(auto); autoRef.current = auto;
  const refreshRef = useRef<() => void>(() => {}), searchAbort = useRef<AbortController | null>(null), archiveAbort = useRef<AbortController | null>(null);
  useEffect(() => { const update = () => setSelection(route()); window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange',update); }, []);
  useEffect(() => {
    setData(null); setArchive(null); setArchiveError(''); setArchiveBusy(false); setPdfBusy(false); archiveAbort.current?.abort(); setError('');
    let active = true, pending = false; const controller = new AbortController();
    const load = async () => {
      if (!selection.id || pending || !active) return; pending = true; setBusy(true); setError('');
      try { const next = await get<ClubsDashboard>(`club/${selection.id}?matchType=${selection.type}`, AbortSignal.any([controller.signal, AbortSignal.timeout(45000)])); if (active) { if (next.club?.id !== selection.id || next.matchType !== selection.type || !Array.isArray(next.matches) || !Array.isArray(next.members)) throw new Error('Kulüp yanıtı seçimle eşleşmedi.'); setData(next); setNow(Date.now()); setArchive(null); } }
      catch (e) { if (active && !controller.signal.aborted) { const message = e instanceof Error ? e.message : 'EA verisi alınamadı.'; setError(message); setData(old => old ? { ...old, stale: true, warning: message } : null); } }
      finally { pending = false; if (active) setBusy(false); }
    };
    refreshRef.current = load; void load();
    const interval = setInterval(() => { if (autoRef.current && document.visibilityState === 'visible' && navigator.onLine) void load(); }, 120000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, [selection.id, selection.type]);
  useEffect(() => { const clock = setInterval(() => setNow(Date.now()),30000); return () => { clearInterval(clock); searchAbort.current?.abort(); archiveAbort.current?.abort(); }; }, []);
  const select = (id: string, type: ClubsMatchType = selection.type) => { if (validClubsId(id)) { setResults(null); try { localStorage.setItem(selectionKey,JSON.stringify({ id, type })); } catch { /* Seçim bu oturumda yine açılabilir. */ } location.hash = `clubs/${id}/${type}`; } };
  const search = async (query: string) => {
    searchAbort.current?.abort(); const controller = new AbortController(); searchAbort.current = controller; setSearching(true); setSearchError(''); setResults(null);
    try { const response = await get<{ clubs: ClubsTeam[] }>('search?q=' + encodeURIComponent(query.trim()), AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])); if (!controller.signal.aborted) setResults(response.clubs); }
    catch (e) { if (!controller.signal.aborted) setSearchError(e instanceof Error ? e.message : 'Kulüp bulunamadı.'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  };
  const toggleFollow = () => {
    if (!data) return; const next = followed.some(c => c.id === data.club.id) ? followed.filter(c => c.id !== data.club.id) : [...followed, { id: data.club.id, name: data.club.name }].slice(-12);
    try { localStorage.setItem(followKey,JSON.stringify(next)); setFollowed(next); } catch { setError('Takip tercihi bu tarayıcıya kaydedilemedi.'); }
  };
  const getArchive = async () => {
    archiveAbort.current?.abort(); const controller = new AbortController(); archiveAbort.current = controller; setArchiveBusy(true); setPdfBusy(false); setArchiveError('');
    try { const d = await get<{ clubId: string; matchType: string; matches: ClubsMatch[] }>(`club/${selection.id}/archive?matchType=${selection.type}`, controller.signal); if (controller.signal.aborted) return; if (d.clubId !== selection.id || d.matchType !== selection.type || !Array.isArray(d.matches)) throw new Error('Maç arşivi doğrulanamadı.'); setArchive(d.matches);
    } catch (e) { if (!controller.signal.aborted) setArchiveError(e instanceof Error ? e.message : 'Arşiv okunamadı.'); } finally { if (!controller.signal.aborted) setArchiveBusy(false); }
  };
  const downloadPdf = async () => {
    archiveAbort.current?.abort(); const controller = new AbortController(); archiveAbort.current = controller; setArchiveBusy(false); setPdfBusy(true); setArchiveError('');
    try {
      const response = await fetch(`/api/clubs/club/${selection.id}/report.pdf?matchType=${selection.type}`, { signal: AbortSignal.any([controller.signal,AbortSignal.timeout(45000)]) });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) { const d = await response.json().catch(()=>null); throw new Error(d?.error || 'PDF raporu hazırlanamadı.'); }
      const blob = await response.blob(); if (controller.signal.aborted) return;
      const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`clubs-${selection.id}-${selection.type}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) { if(!controller.signal.aborted)setArchiveError(e instanceof Error ? e.message : 'PDF raporu indirilemedi.'); } finally { if(!controller.signal.aborted)setPdfBusy(false); }
  };
  return { ...selection, data, busy, error, results, searching, searchError, followed, auto, setAuto, now, archive, archiveBusy, pdfBusy, archiveError, select, search, refresh: () => refreshRef.current(), toggleFollow, getArchive, downloadPdf };
}
