const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../functions/api/search.js'),'utf8')).toString('base64'));
test('provider results cover target markets but exclude ETFs and unsupported exchanges',async()=>{
 const {normaliseQuotes}=await load();
 const qs=[['NVDA','NMS','US'],['0700.HK','HKG','HK'],['SAP.DE','GER','DE'],['SHEL.L','LSE','UK'],['MC.PA','PAR','FR'],['7203.T','JPX','JP'],['005930.KS','KSC','KR'],['600519.SS','SHH','CN']];
 const results=normaliseQuotes(qs.map(([symbol,exchange])=>({symbol,exchange,quoteType:'EQUITY',shortname:symbol})).concat([{symbol:'SPY',exchange:'PCX',quoteType:'ETF'},{symbol:'SHOP.TO',exchange:'TOR',quoteType:'EQUITY'}]));
 assert.deepEqual(results.map(x=>x.market),qs.map(x=>x[2]));assert.equal(results.length,8);
});
test('numeric queries include exchange-qualified symbols',async()=>{
 const {searchQueries}=await load();assert.ok(searchQueries('700').includes('0700.HK'));assert.ok(searchQueries('7203').includes('7203.T'));assert.ok(searchQueries('005930').includes('005930.KS'));assert.ok(searchQueries('600519').includes('600519.SS'));
});
test('upstream failure returns an unavailable status rather than a false empty success',async()=>{
 const {handleSearch}=await load();const r=await handleSearch(new Request('https://qalendar.app/api/search?q=NVDA'),async()=>new Response('',{status:429}));
 assert.equal(r.status,503);
});
test('search uses a fixed upstream and normalises equities',async()=>{
 const {handleSearch}=await load();const r=await handleSearch(new Request('https://qalendar.app/api/search?q=novavax'),async url=>{assert.equal(new URL(url).hostname,'query2.finance.yahoo.com');return Response.json({quotes:[{symbol:'NVAX',exchange:'NGM',quoteType:'EQUITY',longname:'Novavax'}]});});
 const body=await r.json();assert.equal(body.results[0].symbol,'NVAX');
});
