import type { Player, PlayerStats } from '../types/index.ts';
import { normalizePlayerName } from './playerNames.ts';
export const CATALOG_STATS = [['pace','HIZ'],['shooting','ŞUT'],['passing','PAS'],['dribbling','DRİ'],['defending','DEF'],['physical','FİZ']] as const;
export interface CatalogFilters { position: string; alternatives: boolean; version: string; league: string; nation: string; club: string; kind: string; style: string; ratingMin: string; ratingMax: string; priceMin: string; priceMax: string; freshOnly: boolean; stats: Partial<Record<keyof PlayerStats,string>> }
export type CatalogSort = 'name' | 'rating' | 'price' | keyof PlayerStats;
export const emptyCatalogFilters = (): CatalogFilters => ({ position:'',alternatives:true,version:'',league:'',nation:'',club:'',kind:'',style:'',ratingMin:'',ratingMax:'',priceMin:'',priceMax:'',freshOnly:false,stats:{} });
export function catalogFilterError(f: CatalogFilters) {
  for(const [low,high,label,min,max] of [[f.ratingMin,f.ratingMax,'Reyting',1,99],[f.priceMin,f.priceMax,'Fiyat',0,1e9]] as const){
    for(const n of [low,high])if(n!==''&&(!Number.isInteger(Number(n))||Number(n)<min||Number(n)>max))return `${label} aralığı ${min}–${max} arasında tam sayı olmalı.`;
    if(low!==''&&high!==''&&Number(low)>Number(high))return `${label} alt sınırı üst sınırından büyük olamaz.`;
  }
  if(Object.values(f.stats).some(n=>n!==''&&n!==undefined&&(!Number.isInteger(Number(n))||Number(n)<0||Number(n)>99)))return 'Özellik sınırları 0–99 arasında tam sayı olmalı.';
  return '';
}
export const catalogHasPrice = (p: Player) => Number.isFinite(p.price) && p.price>0 && p.priceStatus!=='UNAVAILABLE';
export function filterCatalog(players: Player[], query: string, f: CatalogFilters, now=Date.now()) {
  if(catalogFilterError(f))return [];
  const q=normalizePlayerName(query.trim());
  return players.filter(p=>{
    if(q&&!normalizePlayerName([p.name,p.commonName,p.club,p.league,p.nation,p.cardVersion].join(' ')).includes(q))return false;
    if(f.position&&p.position!==f.position&&!(f.alternatives&&p.secondaryPositions?.includes(f.position as Player['position'])))return false;
    if(f.version&&p.cardVersion!==f.version || f.league&&p.league!==f.league || f.nation&&p.nation!==f.nation || f.club&&p.club!==f.club)return false;
    if(f.kind==='special'&&!p.isSpecial || f.kind==='standard'&&p.isSpecial || f.kind==='gold_rare'&&p.cardType!=='GOLD_RARE')return false;
    if(f.style&&(!p.playStylesKnown||!p.playStyles.includes(f.style)))return false;
    if(f.ratingMin!==''&&p.rating<Number(f.ratingMin)||f.ratingMax!==''&&p.rating>Number(f.ratingMax))return false;
    if(f.priceMin!==''&&(!catalogHasPrice(p)||p.price<Number(f.priceMin))||f.priceMax!==''&&(!catalogHasPrice(p)||p.price>Number(f.priceMax)))return false;
    if(f.freshOnly&&(!catalogHasPrice(p)||!['LIVE','CACHED'].includes(p.priceStatus)||!Number.isFinite(Date.parse(p.priceUpdatedAt))||now-Date.parse(p.priceUpdatedAt)>1800000||now-Date.parse(p.priceUpdatedAt)<-60000))return false;
    for(const [key,value]of Object.entries(f.stats))if(value!==''&&value!==undefined&&(!p.statsKnown||p.position==='GK'||p.stats[key as keyof PlayerStats]<Number(value)))return false;
    return true;
  });
}
export function sortCatalog(players: Player[], key: CatalogSort, direction:'asc'|'desc') {
  return [...players].sort((a,b)=>{
    if(key==='name')return (direction==='asc'?1:-1)*a.name.localeCompare(b.name,'tr');
    const value=(p:Player):number|null=>key==='price'?catalogHasPrice(p)?p.price:null:key==='rating'?p.rating:p.statsKnown&&p.position!=='GK'?p.stats[key]:null;
    const x=value(a),y=value(b);if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
    return (x===null||y===null?0:(x-y)*(direction==='asc'?1:-1))||b.rating-a.rating||a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id);
  });
}
export function catalogChoices(players: Player[], key:'league'|'nation'|'club'|'cardVersion'|'playStyles') {
  return [...new Set(players.flatMap(p=>key==='playStyles' ? p.playStylesKnown ? p.playStyles.filter(s=>!/^PS\s*\d/i.test(s)) : [] : [p[key]||'']).filter(v=>v&&v!=='Bilinmiyor'))].sort((a,b)=>a.localeCompare(b,'tr'));
}
