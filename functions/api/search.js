const EXCHANGES={NMS:'US',NGM:'US',NCM:'US',NYQ:'US',ASE:'US',PCX:'US',BTS:'US',PNK:'US',OQB:'US',OQX:'US',HKG:'HK',GER:'DE',FRA:'DE',STU:'DE',MUN:'DE',BER:'DE',DUS:'DE',HAM:'DE',HAN:'DE',LSE:'UK',PAR:'FR',JPX:'JP',TYO:'JP',KSC:'KR',KOE:'KR',SHH:'CN',SHZ:'CN'};
export function normaliseQuotes(quotes){
 const seen=new Set();return quotes.flatMap(q=>{
  const market=EXCHANGES[q.exchange];
  if(q.quoteType!=='EQUITY'||!market||typeof q.symbol!=='string'||!q.symbol||seen.has(q.symbol))return [];
  seen.add(q.symbol);return [{symbol:q.symbol,name:q.longname||q.shortname||q.symbol,market,exchange:q.exchDisp||q.exchange}];
 });
}
export function searchQueries(q){
 const queries=[q];
 if(/^\d{1,5}$/.test(q)){queries.push(q.padStart(4,'0')+'.HK');if(q.length===4)queries.push(q+'.T');}
 if(/^\d{6}$/.test(q)){queries.push(q+'.KS',q+'.SS',q+'.SZ');}
 return [...new Set(queries)];
}
export async function handleSearch(request,fetcher=fetch){
 const q=(new URL(request.url).searchParams.get('q')||'').trim();
 const headers={'Cache-Control':'public, max-age=300','Content-Type':'application/json; charset=utf-8'};
 if(!q||q.length>80)return Response.json({results:[],error:'invalid_query'},{status:400});
 const batches=await Promise.all(searchQueries(q).map(async term=>{
  const url=new URL('https://query2.finance.yahoo.com/v1/finance/search');
  url.search=new URLSearchParams({q:term,quotesCount:'50',newsCount:'0',listsCount:'0',enableFuzzyQuery:'false'}).toString();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
   const response=await fetcher(url.href,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'},signal:controller.signal});
   if(!response.ok)throw Error('upstream');
   const data=await response.json();if(!Array.isArray(data.quotes))throw Error('format');
   return data.quotes;
  }catch{return null;}finally{clearTimeout(timer);}
 }));
 if(batches.every(x=>x===null))return Response.json({results:[],error:'search_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({results:normaliseQuotes(batches.filter(Boolean).flat()).slice(0,50),partial:batches.some(x=>x===null),source:'Yahoo Finance'},{headers});
}
export const onRequestGet=({request})=>handleSearch(request);
