import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Player } from '../types/index.ts';
import { emptyCatalogFilters, filterCatalog, sortCatalog, catalogChoices, catalogFilterError } from './catalogFilters.ts';
const now=Date.now();
function card(id:string,overrides:Partial<Player>={}):Player {
  return { id,name:'Arda Güler',commonName:'Arda',rating:83,position:'CAM',secondaryPositions:['CM','RW'],club:'Real Madrid',league:'LALIGA EA SPORTS',nation:'Türkiye',cardVersion:'Normal',cardType:'BASE',isSpecial:false,inClub:false,price:1200,priceStatus:'LIVE',priceUpdatedAt:new Date(now).toISOString(),statsKnown:true,stats:{pace:77,shooting:79,passing:84,dribbling:85,defending:52,physical:62},playStylesKnown:true,playStyles:['Technical','Rapid+'],...overrides } as Player;
}
test('Katalog: aksanlı isim ve ülke aranır; gerçek lig/kulüp/sürüm ile alternatif mevki birlikte filtrelenir',()=>{
  const rows=[card('1'),card('2',{name:'Other',rating:80,club:'Other FC',league:'Other League',nation:'England',secondaryPositions:[],cardVersion:'TOTW',isSpecial:true})];
  const filters={...emptyCatalogFilters(),position:'CM',league:'LALIGA EA SPORTS',nation:'Türkiye',club:'Real Madrid',version:'Normal'};
  assert.deepEqual(filterCatalog(rows,'arda guler',filters).map(p=>p.id),['1']);assert.equal(filterCatalog(rows,'turkiye',filters).length,1);
  assert.equal(filterCatalog(rows,'',{...filters,alternatives:false}).length,0);
  assert.equal(filterCatalog(rows,'',{...filters,style:'Rapid+'}).length,1);assert.equal(filterCatalog(rows,'',{...filters,style:'Rapid'}).length,0);
});
test('Katalog: bilinmeyen fiyat ve özellikler sıfır sayılmaz; kaleci saha özelliği filtresine girmez',()=>{
  const rows=[card('1'),card('2',{price:0,priceStatus:'UNAVAILABLE',statsKnown:false}),card('3',{position:'GK'}),card('4',{priceStatus:'STALE',priceUpdatedAt:new Date(now-3600000).toISOString()})];
  assert.deepEqual(filterCatalog(rows,'',{...emptyCatalogFilters(),priceMax:'1500'}).map(p=>p.id),['1','3','4']);
  assert.deepEqual(filterCatalog(rows,'',{...emptyCatalogFilters(),stats:{pace:'0'}}).map(p=>p.id),['1','4']);
  assert.deepEqual(filterCatalog(rows,'',{...emptyCatalogFilters(),freshOnly:true},now).map(p=>p.id),['1','3']);
  assert.equal(filterCatalog(rows,'',{...emptyCatalogFilters(),stats:{pace:'90'}}).length,0);
});
test('Katalog: min/max hataları kullanıcıya açıklanır; çelişkili filtre sonuç üretmez',()=>{
  for(const invalid of [{ratingMin:'90',ratingMax:'80'},{priceMin:'1000',priceMax:'900'},{ratingMax:'100'},{priceMin:'-1'},{stats:{pace:'100'}},{ratingMin:'NaN'}]){
    const f={...emptyCatalogFilters(),...invalid};assert.ok(catalogFilterError(f));assert.equal(filterCatalog([card('1')],'',f).length,0);
  }
  assert.equal(catalogFilterError({...emptyCatalogFilters(),ratingMin:'83',ratingMax:'83'}),'');
});
test('Katalog: sıralamada eksik fiyatlar iki yönde de sonda kalır; girdi dizisi değişmez',()=>{
  const cards=[card('cheap',{price:700}),card('unknown',{price:0,priceStatus:'UNAVAILABLE',statsKnown:false}),card('expensive',{price:10000})];
  assert.deepEqual(sortCatalog(cards,'price','asc').map(p=>p.id),['cheap','expensive','unknown']);assert.deepEqual(sortCatalog(cards,'price','desc').map(p=>p.id),['expensive','cheap','unknown']);assert.deepEqual(cards.map(p=>p.id),['cheap','unknown','expensive']);
  assert.equal(sortCatalog(cards,'pace','desc').at(-1)?.id,'unknown');
});
test('Katalog: seçenekler kayıtlı veriden oluşur; bilinmeyen lig ve PS numarası filtre adı yapılmaz',()=>{
  const rows=[card('1'),card('2',{league:'Bilinmiyor',playStyles:['PS 1','Rapid+']}),card('3',{playStylesKnown:false,playStyles:['Ghost']})];
  assert.deepEqual(catalogChoices(rows,'league'),['LALIGA EA SPORTS']);assert.deepEqual(catalogChoices(rows,'playStyles'),['Rapid+','Technical']);
});
