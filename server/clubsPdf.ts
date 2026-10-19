import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClubsDashboard, ClubsMatch } from '../src/services/clubsData.ts';
const fonts = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/fonts');
const typeLabels = { leagueMatch: 'Lig maçları', friendlyMatch: 'Hazırlık maçları', playoffMatch: 'Play-off maçları' };
const resultLabels = { win: 'Galibiyet', draw: 'Beraberlik', loss: 'Mağlubiyet' };
const num = (n: number | null | undefined, digits = 0) => n == null ? '-' : n.toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const date = (s: string) => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle:'short',timeStyle:'short' }) : '-';
const position = (s: string) => ({ goalkeeper:'Kaleci',defender:'Defans',midfielder:'Orta saha',forward:'Forvet' }[s] || s || '-');
export async function createClubsPdf(data: ClubsDashboard, archived: ClubsMatch[], exportedAt = new Date().toISOString()): Promise<Buffer> {
  const doc = new PDFDocument({ size:'A4', margins:{ top:108,bottom:55,left:44,right:44 }, bufferPages:true, info:{ Title:`${data.club.name} - Clubs raporu`, Author:'FUT Brain', Subject:'Kulüp, oyuncu ve kaydedilmiş maç istatistikleri', CreationDate:new Date(exportedAt) } });
  const chunks: Buffer[] = [], done = new Promise<Buffer>((resolve,reject) => { doc.on('data',b=>chunks.push(b)); doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject); });
  doc.registerFont('body',path.join(fonts,'NotoSans-Regular.ttf'));doc.registerFont('bold',path.join(fonts,'NotoSans-Bold.ttf'));
  const left=44, width=507, bottom=775, navy='#142335', muted='#586777', green='#466B15'; let y=115;
  const write = (s: string, x: number, top: number, w: number, size=10, bold=false, color=navy) => { doc.font(bold?'bold':'body').fontSize(size).fillColor(color).text(String(s).replace(/[\x00-\x1f]/g,' '),x,top,{width:w,lineGap:2}); };
  const header = () => { doc.rect(0,0,596,84).fill(navy);doc.rect(44,26,4,30).fill('#B7F56A');write('FUT BRAIN / CLUBS',58,25,350,11,true,'#DDF4BA');write('Kulüp performans raporu',58,44,370,15,true,'#FFFFFF');write('EA CLUBS',449,31,103,9,true,'#DDF4BA'); };
  const page = () => { doc.addPage();header();y=108; };
  const ensure = (h: number) => { if(y+h>bottom)page(); };
  const paragraph = (s: string, color=muted) => { doc.font('body').fontSize(9);const h=doc.heightOfString(s,{width,lineGap:2});ensure(h+10);write(s,left,y,width,9,false,color);y+=h+10; };
  const heading = (s: string, sub='') => { ensure(62);write(s,left,y,width,16,true);y+=29;if(sub)paragraph(sub); };
  const table = (columns: { label:string;width:number;align?:'left'|'right' }[], rows:string[][], continuedTitle='') => {
    const tableHead = () => { doc.rect(left,y,width,27).fill('#EAF0F5');let x=left;for(const c of columns){doc.font('bold').fontSize(8.5).fillColor(navy).text(c.label,x+8,y+7,{width:c.width-16,align:c.align||'left',lineBreak:false});x+=c.width;}y+=27; };
    ensure(55);tableHead();
    for(let i=0;i<rows.length;i++) {
      const row=rows[i];doc.font('body').fontSize(9);const h=Math.max(26,...columns.map((c,j)=>doc.heightOfString(row[j]||'-',{width:c.width-16,lineGap:2})+14));
      if(y+h>bottom){page();if(continuedTitle){doc.font('bold').fontSize(11);const th=doc.heightOfString(continuedTitle,{width,lineGap:2});write(continuedTitle,left,y,width,11,true);y+=th+12;}tableHead();}
      if(i%2===0)doc.rect(left,y,width,h).fill('#F6F8FA');
      let x=left;for(let j=0;j<columns.length;j++){const c=columns[j];doc.font(j===0?'bold':'body').fontSize(9).fillColor(navy).text(row[j]||'-',x+8,y+7,{width:c.width-16,align:c.align||'left',lineGap:2});x+=c.width;}
      doc.moveTo(left,y+h).lineTo(left+width,y+h).lineWidth(.4).strokeColor('#E0E6EC').stroke();y+=h;
    }
    y+=17;
  };
  try {
    header();
    doc.font('bold').fontSize(24);const titleHeight=doc.heightOfString(data.club.name,{width});write(data.club.name,left,y,width,24,true);y+=titleHeight+12;
    paragraph(`Kulüp ID: ${data.club.id}  |  ${typeLabels[data.matchType]}  |  PS5 / Xbox Series / PC`);
    paragraph(`EA verisi okuma: ${date(data.observedAt)}  |  PDF oluşturma: ${date(exportedAt)} (Türkiye saati)`);
    if(data.stale || Date.parse(exportedAt)-Date.parse(data.observedAt)>120000)paragraph('Güncellik notu: Son başarılı kayıt kullanıldı. PDF oluşturma zamanı, verinin EA’dan okunma zamanı değildir.','#956014');
    const metrics:[string,number|null][]=[['Toplam maç',data.club.games],['Galibiyet',data.club.wins],['Beraberlik',data.club.draws],['Mağlubiyet',data.club.losses],['Atılan gol',data.club.goals],['Yenilen gol',data.club.conceded],['Beceri puanı',data.skillRating],['Galibiyet serisi',data.streak]];
    ensure(171);for(let i=0;i<metrics.length;i++){const x=left+(i%4)*130,top=y+Math.floor(i/4)*78;doc.roundedRect(x,top,117,66,5).fill('#F0F5EA');write(metrics[i][0],x+10,top+10,99,8.5,false,muted);write(num(metrics[i][1]),x+10,top+29,99,20,true,green);}y+=171;
    paragraph(`Oyuncu kaydı: ${data.members.length}  |  Bu rapordaki kaydedilmiş maç: ${archived.length}`);
    if(data.warning)paragraph(data.warning,'#956014');
    heading('Son karşılaşmalardan','Skorlar seçili kulübün bakış açısından gösterilir.');
    const matchColumns:[string,number][]=[['Tarih',104],['Rakip',214],['Skor',61],['Sonuç',128]];
    const matchRows=(matches:ClubsMatch[])=>matches.map(m=>[date(m.playedAt),m.opponent,`${m.goals} - ${m.conceded}`,resultLabels[m.result]+(m.dnf?' / Yarıda bitti':'')]);
    if(data.matches.length)table(matchColumns.map(([label,width])=>({label,width})),matchRows(data.matches.slice(0,5)));else paragraph('EA bu maç türünde son karşılaşma döndürmedi.');
    paragraph('Kaynak: EA Clubs / proclubs.ea.com. İstatistikler EA’ya yansıdığı biçimde aktarılır. Eksik değerler "-" ile gösterilir. Bu rapor bir EA resmî belgesi değildir.');
    if(data.members.length){page();heading('Oyuncu istatistikleri','Gol sayısına göre sıralandı. Ortalama puan 10 üzerindendir. MOTM: Maçın oyuncusu seçilme sayısı. Bu bölüm EA üye istatistikleridir; yalnız rapordaki maçların toplamı değildir.');
      const members=[...data.members].sort((a,b)=>(b.goals??-1)-(a.goals??-1)||a.name.localeCompare(b.name));
      table([{label:'Oyuncu / mevki',width:182},{label:'Maç',width:46,align:'right'},{label:'Gol',width:45,align:'right'},{label:'Asist',width:46,align:'right'},{label:'Ort. puan',width:70,align:'right'},{label:'Pas %',width:57,align:'right'},{label:'MOTM',width:61,align:'right'}],members.map(m=>[`${m.name} / ${position(m.position)}`,num(m.games),num(m.goals),num(m.assists),num(m.rating,1),num(m.passRate),num(m.motm)]),'Oyuncu istatistikleri / devam');
    }
    if(y>560)page();else y+=12;heading('Kaydedilen maçlar',`${typeLabels[data.matchType]} / ${archived.length} karşılaşma`);
    paragraph('EA her sorguda en fazla son 10 maçı döndürür. Bu liste, sistemin daha önce başarıyla görüp kaydettiği maçlardan oluşur; kulübün bütün geçmişi olduğu anlamına gelmez.');
    if(archived.length)table(matchColumns.map(([label,width])=>({label,width})),matchRows(archived),'Kaydedilen maçlar / devam');else paragraph('Bu maç türünde henüz kaydedilmiş karşılaşma yok.');
    if(data.matches.some(m=>m.players.length)){
      page();heading('Son maçların oyuncu ayrıntıları','Yalnız EA’nın son maç yanıtındaki seçili takım oyuncuları gösterilir.');
      for(const m of data.matches){if(!m.players.length)continue;const title=`${m.opponent} / ${m.goals} - ${m.conceded}`;doc.font('bold').fontSize(12);const titleHeight=doc.heightOfString(title,{width,lineGap:2});doc.font('body').fontSize(9);const rowHeight=m.players.reduce((sum,p)=>sum+Math.max(26,doc.heightOfString(p.name+(p.motm?' (MOTM)':''),{width:195,lineGap:2})+14),0);ensure(Math.min(650,titleHeight+75+rowHeight));write(title,left,y,width,12,true);y+=titleHeight+8;paragraph(`${date(m.playedAt)} / ${resultLabels[m.result]}`);
        table([{label:'Oyuncu',width:211},{label:'Puan',width:56,align:'right'},{label:'Gol',width:42,align:'right'},{label:'Asist',width:46,align:'right'},{label:'Pas / deneme',width:92,align:'right'},{label:'Müd.',width:60,align:'right'}],m.players.map(p=>[p.name+(p.motm?' (MOTM)':''),num(p.rating,1),num(p.goals),num(p.assists),`${num(p.passes)} / ${num(p.passAttempts)}`,num(p.tackles)]),`${m.opponent} / ${m.goals} - ${m.conceded} / devam`);
      }
    }
    const pages=doc.bufferedPageRange();for(let i=pages.start;i<pages.start+pages.count;i++){doc.switchToPage(i);doc.moveTo(left,794).lineTo(left+width,794).lineWidth(.5).strokeColor('#CBD4DE').stroke();doc.font('body').fontSize(8).fillColor(muted).text('FUT Brain / EA Clubs verileri',left,805,{lineBreak:false});doc.text(`${i+1} / ${pages.count}`,490,805,{lineBreak:false});}
    doc.end();return await done;
  } catch(error){doc.destroy(error as Error);await done.catch(()=>{});throw error;}
}
