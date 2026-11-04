const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const audit=require('../data/continued-audit-20261104.json');
const file=path.join(root,'data/verified-events.json');
const events=JSON.parse(fs.readFileSync(file,'utf8'));
for(const [ticker,name,date,source] of audit.confirmed){
  const event={ticker,name,date,session:'other',source,verifiedOn:audit.checkedOn,evidence:'Issuer calendar or release explicitly confirms date and event type. No release time inferred.'};
  const i=events.findIndex(e=>e.ticker===ticker&&e.date===date);
  if(i<0)events.push(event);else events[i]=event;
}
fs.writeFileSync(file,JSON.stringify(events,null,2)+'\n');
