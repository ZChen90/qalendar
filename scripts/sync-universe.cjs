// Embed reviewed constituent records without losing local aliases/watch companies.
// Does not fetch data, change dates, or advance the earnings freshness timestamp.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),file=path.join(root,'index.html');
let html=fs.readFileSync(file,'utf8');
const block=id=>new RegExp('(<script type="application/json" id="'+id+'">\\n)([\\s\\S]*?)(\\n</script>)');
const dir=JSON.parse(html.match(block('dir'))[2]);
const data=JSON.parse(html.match(block('week-data'))[2]);
const universe=JSON.parse(fs.readFileSync(path.join(root,'data/index-universe.json'),'utf8'));
const keys=Object.keys(universe.indices),byTicker=new Map();
for(const c of dir)for(const l of c.l){l[2]=l[2].filter(x=>!keys.includes(x));byTicker.set(l[0],{c,l});}
const markets={HK:'HK',DE:'DE',L:'UK',PA:'FR',AS:'NL',T:'JP',KS:'KR',SS:'CN'};
function include(row,index){
 let found=byTicker.get(row.Symbol);
 if(!found){const c={n:row.Name.trim(),a:row.aliases||[],l:[[row.Symbol,markets[row.Symbol.split('.').at(-1)]||'US',[]]]};dir.push(c);found={c,l:c.l[0]};byTicker.set(row.Symbol,found);}
 if(index&&!found.l[2].includes(index))found.l[2].push(index);
 found.c.a=[...new Set([...(found.c.a||[]),row.Name.trim(),...(row.aliases||[])])].filter(n=>n!==found.c.n);
}
for(const [key,roster] of Object.entries(universe.indices))for(const row of roster.constituents)include(row,key);
for(const row of universe.marketDirectories.KR.companies)include(row);
// Dates and membership are separate: reconcile event tags to the reviewed roster.
for(const w of data.weeks)for(const d of w.days)for(const session of ['pre','post','other'])for(const event of d[session]||[]){
 const found=byTicker.get(event.t);
 if(found)event.idx=[...new Set([...event.idx.filter(x=>!keys.includes(x)),...found.l[2]])];
}
data.coverage=Object.entries(universe.indices).map(([index,r])=>({index,count:r.constituents.length,status:r.quality+' · '+r.asOf}));
data.coverage.push({index:'KOSPI',count:[...byTicker.values()].filter(x=>x.l[2].includes('KOSPI')).length,status:'Incomplete index verification; '+universe.marketDirectories.KR.companies.length+' market issuers searchable'});
for(const r of Object.values(universe.indices))for(const c of r.constituents){
 c.earningsReview='not reviewed for the full window';
 c.knownReleaseDates=[];
 for(const w of data.weeks)for(const d of w.days)for(const s of ['pre','post','other'])if((d[s]||[]).some(e=>e.t===c.Symbol))c.knownReleaseDates.push(d.date);
 if(c.knownReleaseDates.length)c.earningsReview='at least one verified release; full-window completeness not certified';
}
html=html.replace(block('dir'),(_,a,b,c)=>a+JSON.stringify(dir)+c).replace(block('week-data'),(_,a,b,c)=>a+JSON.stringify(data)+c);
fs.writeFileSync(file,html);
fs.writeFileSync(path.join(root,'data/index-universe.json'),JSON.stringify(universe,null,2)+'\n');
console.log('Embedded',dir.length,'company records;',byTicker.size,'unique listings.');
