const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
function boot(date='2026-10-29T12:00:00',payload){
 let now=new Date(date).getTime();
 const elements=new Map(), listeners={}, intervals=[];
 function element(id){
  if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',hidden:false,children:[],style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(type,fn){this[type]=fn;},querySelectorAll(){return [];}});
  return elements.get(id);
 }
 for(const id of ['week-data','dir']) element(id).textContent=html.match(new RegExp('<script type="application/json" id="'+id+'">([\\s\\S]*?)</script>'))[1];
 if(payload)element('week-data').textContent=JSON.stringify(payload);
 const storage=new Map([['userLists',JSON.stringify([{n:'Saved list',t:['MSFT'],d:1,id:'saved'}])]]);
 const document={getElementById:element,documentElement:{},hidden:false,addEventListener(type,fn){listeners['document:'+type]=fn;},querySelectorAll(){return [];}};
 const sandbox={console,document,navigator:{language:'en'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},Intl,URL,AbortController,setTimeout(){return 1;},clearTimeout(){},setInterval(fn,ms){intervals.push({fn,ms});},fetch:async()=>{throw Error('offline');},location:{href:'https://qalendar.app/',protocol:'https:'}};
 sandbox.window={addEventListener(type,fn){listeners[type]=fn;},scrollTo(){}};
 sandbox.DOMParser=class{parseFromString(text){return {getElementById(id){const m=text.match(new RegExp('<script type="application/json" id="'+id+'">([\\s\\S]*?)</script>'));return m?{textContent:m[1]}:null;}};}};
 const ctx=vm.createContext(sandbox); vm.runInContext(script,ctx);
 return {element,storage,ctx,run:s=>vm.runInContext(s,ctx),setDate:s=>{now=new Date(s).getTime();},async tick(){for(const x of intervals)await x.fn();},async focus(){await listeners.focus?.();},payload:()=>JSON.parse(element('week-data').textContent)};
}
test('Oct 29 opens Oct 26, not the first stored week',()=>{
 const app=boot(); assert.equal(app.run('W()[active].days[0].date'),'2026-10-26');
 assert.match(app.element('content').innerHTML,/todaytag/);
});
test('a Sunday stays in its week and an open page rolls over on Monday',async()=>{
 const app=boot('2026-11-01T23:59:00');
 assert.equal(app.run('W()[active].days[0].date'),'2026-10-26');
 app.setDate('2026-11-02T00:01:00'); await app.tick();
 assert.equal(app.run('W()[active].days[0].date'),'2026-11-02');
});
test('an exhausted data window shows the actual current week without fabricated earnings',()=>{
 const app=boot('2027-01-03T12:00:00');
 assert.equal(app.run('W()[active].days[0].date'),'2026-12-28');
 assert.equal(app.run('W()[active].unavailable'),true);
 assert.doesNotMatch(app.element('content').innerHTML,/class="co/);
});
test('stale published data is visibly flagged',()=>{
 const app=boot(); assert.equal(app.element('freshness').hidden,false);
 assert.match(app.element('freshness').textContent,/out of date/i);
});
test('refresh updates data while preserving the selected week and saved lists',async()=>{
 const app=boot(); app.run('active=1');
 const selected=app.run('W()[active].days[0].date');
 const data=app.payload();data.updatedAt='2026-10-29 12:00 (Berlin)';
 data.weeks[2].days[0].post.push({t:'TEST',n:'New published event',idx:['SPX']});
 app.ctx.fetch=async(url,opts)=>{assert.equal(opts.cache,'no-store');return {ok:true,text:async()=>'<script type="application/json" id="week-data">'+JSON.stringify(data)+'</script>'};};
 await app.tick();
 assert.equal(app.run('data.updatedAt'),'2026-10-29 12:00 (Berlin)');
 assert.equal(app.run('W()[active].days[0].date'),selected);
 assert.match(app.element('content').innerHTML,/New published event/);
 assert.match(app.storage.get('userLists'),/Saved list/);
 assert.equal(app.element('freshness').hidden,true);
});
test('failed or malformed refresh keeps the previous data and update timestamp',async()=>{
 const app=boot();const before=app.run('JSON.stringify(data)');
 app.ctx.fetch=async()=>({ok:true,text:async()=>'<script type="application/json" id="week-data">{"weeks":[{"days":[{"date":"bad"}]}]}</script>'});
 await app.tick();assert.equal(app.run('JSON.stringify(data)'),before);
 app.ctx.fetch=async()=>{throw Error('offline');};await app.focus();
 assert.equal(app.run('JSON.stringify(data)'),before);
});
test('an older published snapshot cannot replace newer data',async()=>{
 const app=boot();const before=app.run('JSON.stringify(data)');
 const old=app.payload();old.updatedAt='2026-10-20 16:30 (Berlin)';old.weeks[1].days[0].pre=[];
 app.ctx.fetch=async()=>({ok:true,text:async()=>'<script type="application/json" id="week-data">'+JSON.stringify(old)+'</script>'});
 await app.tick();assert.equal(app.run('JSON.stringify(data)'),before);
});
test('daily rollover preserves future browsing until Monday resets to the current week',async()=>{
 const app=boot('2026-10-29T23:59:00');app.run('active=2');
 app.setDate('2026-10-30T00:01:00');await app.tick();
 assert.equal(app.run('W()[active].days[0].date'),'2026-11-09');
});
