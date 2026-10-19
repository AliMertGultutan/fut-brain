import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ClubsClient, CLUBS_TTL } from './clubsClient.ts';
import { createApp } from './app.ts';
import { normalizeClubsMatches, normalizeClubsMembers, normalizeClubsSearch } from '../src/services/clubsData.ts';
const member = { name: 'Test Player', favoritePosition: 'forward', goals: '0', assists: '2', ratingAve: '8.2', gamesPlayed: '4', passSuccessRate: '81' };
const match: any = { matchId: '12345678901', timestamp: 1792325391, clubs: { '1': { goals:'2',goalsAgainst:'1',wins:'0',losses:'0',ties:'0',winnerByDnf:'0' }, '2': { details:{name:'Rakip'},goals:'1',winnerByDnf:'0' } }, players: { '1': { '31': { playername:'Test Player',rating:'8.2',goals:'2',assists:'0',mom:'1',passesmade:'4',passattempts:'5' } }, '2': { '32': { playername:'Rakip oyuncu',rating:'7' } } } };
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(),'clubs-test-')); let clock = Date.now(), fail = false;
  const calls: string[] = [], matches = [structuredClone(match)];
  const transport: typeof fetch = async (url, init) => {
    const u = new URL(String(url)); calls.push(u.pathname); assert.equal(u.origin,'https://proclubs.ea.com'); assert.equal(u.searchParams.get('platform'),'common-gen5'); assert.equal(init?.redirect,'error'); assert.ok(!JSON.stringify(init).includes('API-Key'));
    if (fail) return new Response('<private-secret>',{ status:403 });
    const data = u.pathname.endsWith('/search') ? [{ clubId:'1',clubName:'Test FC',gamesPlayed:'4',wins:'3',clubInfo:{teamId:1,customKit:{selectedKitType:'0'}} }] : u.pathname.endsWith('/info') ? { '1':{clubId:1,name:'Test FC',teamId:1} } : u.pathname.endsWith('/overallStats') ? [{clubId:'1',gamesPlayed:'4',wins:'3',ties:'0',losses:'1',goals:'8',goalsAgainst:'3',skillRating:'1800',wstreak:'2'}] : u.pathname.endsWith('/stats') ? { members:[member] } : matches;
    return new Response(JSON.stringify(data));
  };
  const client = new ClubsClient(root,transport,()=>clock);
  return { root, calls, client, matches, transport, advance:()=>clock+=CLUBS_TTL+1, setFail:()=>fail=true, now:()=>clock, cleanup:()=>rmSync(root,{recursive:true,force:true}) };
}
test('Clubs veri: sıfır puan korunur, eksik veri uydurulmaz, bozuk kaynak boş sonuç sayılmaz', () => {
  const m = normalizeClubsMembers({members:[member]})[0]; assert.equal(m.goals,0);assert.equal(m.motm,null);assert.equal(m.rating,8.2);
  assert.deepEqual(normalizeClubsSearch(null),[]); assert.throws(()=>normalizeClubsSearch({error:'not data'})); assert.throws(()=>normalizeClubsMembers({}));
  assert.throws(()=>normalizeClubsSearch([{clubId:'../secret',clubName:'Invalid'}]));
});
test('Clubs maç: hazırlık sonucu skordan bulunur, yanlış takım ve bozuk skor kabul edilmez', () => {
  const result = normalizeClubsMatches([match],'1','friendlyMatch')[0]; assert.equal(result.result,'win'); assert.equal(result.players.length,1);assert.equal(result.players[0].name,'Test Player');assert.equal(result.players[0].motm,true);
  const loss=structuredClone(match);loss.clubs['1'].wins='0';loss.clubs['1'].losses='1';loss.clubs['2'].winnerByDnf='1';assert.equal(normalizeClubsMatches([loss],'1','leagueMatch')[0].result,'loss');assert.equal(normalizeClubsMatches([loss],'1','leagueMatch')[0].dnf,true);
  assert.throws(()=>normalizeClubsMatches([match],'3','leagueMatch'));const invalid=structuredClone(match);invalid.clubs['1'].goals=undefined;assert.throws(()=>normalizeClubsMatches([invalid],'1','leagueMatch'));
});
test('Clubs merkez: eşzamanlı 30 arama tek EA isteğine iner; yanlış girdiler dış istek yapmaz', async () => {
  const f=fixture();try {
    const results=await Promise.all(Array.from({length:30},()=>f.client.search('Test FC')));assert.equal(results[0].clubs[0].name,'Test FC');assert.equal(f.calls.length,1);
    assert.equal((await f.client.search('Test FC')).cached,true);assert.equal(f.calls.length,1);
    assert.throws(()=>f.client.search('a'));assert.throws(()=>f.client.dashboard('../secret','leagueMatch'));assert.throws(()=>f.client.dashboard('1','bad' as any));await assert.rejects(()=>f.client.archive('../secret','leagueMatch'));assert.equal(f.calls.length,1);
  } finally {f.cleanup();}
});
test('Clubs arşiv: yeniden açılış taze kaydı kullanır, maç tekilleşir; EA kesilince tarih korunarak eski kayıt döner', async () => {
  const f=fixture();try {
    const first=await f.client.dashboard('1','leagueMatch');assert.equal(first.archivedCount,1);assert.equal(first.stale,false);assert.equal(f.calls.length,4);
    const restarted=new ClubsClient(f.root,f.transport,f.now);assert.equal((await restarted.dashboard('1','leagueMatch')).cached,true);assert.equal(f.calls.length,4);
    f.advance();f.matches.push({...structuredClone(match),matchId:'12345678902'});const second=await f.client.dashboard('1','leagueMatch');assert.equal(second.archivedCount,2);assert.equal((await f.client.archive('1','leagueMatch')).matches.length,2);
    f.advance();f.setFail();const stale=await f.client.dashboard('1','leagueMatch');assert.equal(stale.stale,true);assert.equal(stale.observedAt,second.observedAt);assert.ok(!JSON.stringify(stale).includes('private-secret'));
    const count=f.calls.length;await f.client.dashboard('1','leagueMatch');assert.equal(f.calls.length,count);
    const archiveFile=path.join(f.root,'data/clubs/1-leagueMatch-archive.json');writeFileSync(archiveFile,'broken archive');await assert.rejects(()=>f.client.archive('1','leagueMatch'));assert.equal(readFileSync(archiveFile,'utf8'),'broken archive');
  } finally{f.cleanup();}
});
test('Clubs HTTP: Parse anahtarı olmadan çalışır, kaynak kesintisi ve dış köken güvenle reddedilir', async () => {
  const f=fixture(),{app}=createApp({root:f.root,keyOverride:()=>'',clubsTransport:f.transport,clubsNow:f.now});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}/api/clubs/`;
  try {
    const search=await fetch(base+'search?q=Test');assert.equal(search.status,200);assert.equal((await search.json()).clubs[0].id,'1');
    assert.equal((await fetch(base+'search?q=a')).status,400);assert.equal((await fetch(base+'club/1?matchType=bad')).status,400);
    assert.equal((await fetch(base+'search?q=Test',{headers:{Origin:'https://evil.example'}})).status,403);
    const data=await(await fetch(base+'club/1')).json();assert.equal(data.club.wins,3);assert.equal(data.archivedCount,1);assert.equal((await(await fetch(base+'club/1/archive')).json()).matches.length,1);
    const beforePdf=f.calls.length, pdf=await fetch(base+'club/1/report.pdf');assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.match(pdf.headers.get('content-disposition')!,/attachment; filename="clubs-1-leagueMatch.pdf"/);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);assert.equal(f.calls.length,beforePdf);
    assert.equal((await fetch(base+'club/2/report.pdf')).status,409);assert.equal((await fetch(base+'club/1/report.pdf?matchType=bad')).status,400);assert.equal(f.calls.length,beforePdf);
    f.setFail();const fail=await fetch(base+'search?q=Other');assert.equal(fail.status,502);assert.ok(!(await fail.text()).includes('private-secret'));const before=f.calls.length;await fetch(base+'search?q=Other');assert.equal(f.calls.length,before);
  } finally{await new Promise<void>(r=>server.close(()=>r()));f.cleanup();}
});
test('Clubs kaynak yedeği: ZIP özeti ve MIT telif bildirimi saklanır', () => {
  const manifest=JSON.parse(readFileSync('vendor/fc27-clubs-api/source.json','utf8')),bytes=readFileSync('vendor/fc27-clubs-api/upstream.zip');assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.ok(readFileSync('vendor/fc27-clubs-api/LICENSE.md','utf8').includes('MIT'));
});
