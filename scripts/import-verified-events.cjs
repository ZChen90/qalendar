// Review data/verified-events.json before running. Historical entries outside
// the currently published window are left alone; no rollover or date guessing.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),file=path.join(root,'index.html');
let html=fs.readFileSync(file,'utf8');
const re=/(<script type="application\/json" id="week-data">\n)([\s\S]*?)(\n<\/script>)/;
const data=JSON.parse(html.match(re)[2]);
const dir=JSON.parse(html.match(/<script type="application\/json" id="dir">\n([\s\S]*?)\n<\/script>/)[1]);
const indices=new Map(dir.flatMap(c=>c.l.map(l=>[l[0],l[2]])));
const events=JSON.parse(fs.readFileSync(path.join(root,'data/verified-events.json'),'utf8'));
for(const w of data.weeks){
 const start=new Date(w.days[0].date+'T12:00:00Z');
 for(let i=w.days.length;i<7;i++){const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);w.days.push({date:d.toISOString().slice(0,10),pre:[],post:[]});}
}
const beforeEvents=JSON.stringify(data);
for(const e of events){
 if(!/^https:\/\//.test(e.source)||!e.verifiedOn||!['pre','post','other'].includes(e.session))throw Error('Unverified event '+e.ticker);
 const day=data.weeks.flatMap(w=>w.days).find(d=>d.date===e.date);if(!day)continue;
 const record={t:e.ticker,n:e.name+(e.time?' ('+e.time+')':''),idx:indices.get(e.ticker)||[],source:e.source,verifiedOn:e.verifiedOn};
 if(!record.idx.length)throw Error('No checked membership for '+e.ticker);
 for(const s of ['pre','post','other'])if(day[s])day[s]=day[s].filter(c=>c.t!==e.ticker);
 (day[e.session]??=[]).push(record);
}
const changed=JSON.stringify(data)!==beforeEvents;
if(changed){
 // Explicit verification date from reviewed evidence, never the machine clock.
 data.updatedAt='2026-11-04 21:10 (Berlin)';
 data.source='official exchange schedules and company IR; verified dates, partial earnings coverage';
 html=html.replace(re,(_,a,b,c)=>a+JSON.stringify(data)+c);fs.writeFileSync(file,html);
}
console.log('Imported reviewed events; changed:',changed);
