// Imported stops in free order (Nov 23): untimed stops float like plan items instead of staying glued after the ride they
// followed in the TouringPlans plan; stops between the same two rides stay linked (train up → Conservation Station → train
// back); once you start the first, the rest come next. DAK day from Nick's test: passes Everest 11:00, Safari 11:10,
// Na'vi 2:00, Flight of Passage 2:30 (single pass); Satu'li booked 1:30; plan ends 3:30.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await pg.evaluate(()=>{const d=WDW.orlandoNow().date;localStorage.setItem('wdwsim.ll.'+d,JSON.stringify({mp:'AK',picks:[{rid:'navi',start:840},{rid:'ee',start:660},{rid:'kili',start:670}],sp:[{rid:'fop',start:870}],prem:null}));
  localStorage.setItem('wdwsim.view','plan');localStorage.setItem('wdwsim.auto','1');Object.keys(localStorage).filter(k=>/^wdwsim\.run\./.test(k)).forEach(k=>localStorage.removeItem(k));
  WDW.dpSave(d,{pk:'AK',must:['navi','ee','kili'],ll:'mine',lunch:false,extras:false,pace:'bal',keep:false,end:930,blocks:[
   {id:'b0',name:"Satu'li Canteen",after:'navi',walk:2,walkNext:null,dur:45,at:810,meal:true,tp:797},
   {id:'b1',name:'Wildlife Express Train from Africa to Conservation Station',after:'navi',walk:11,walkNext:null,dur:11,at:null,meal:false,tp:853},
   {id:'b2',name:'Conservation Station',after:'navi',walk:5,walkNext:null,dur:20,at:null,meal:false,tp:869},
   {id:'b3',name:'Wildlife Express Train from Conservation Station to Africa',after:'navi',walk:2,walkNext:8,dur:11,at:null,meal:false,tp:894}]})});
await lib.reload(pg);
await pg.evaluate(()=>{document.querySelector('#segTime [data-v="660"]:not([data-now])').click()});await pg.waitForTimeout(200);
await pg.evaluate(()=>document.querySelector('#bPlay').click());await pg.waitForFunction(()=>WDW.G.started&&WDW.G.plan,null,{timeout:60000});await pg.waitForTimeout(500);
const look=()=>pg.evaluate(()=>{const r=WDW.G.plan.res,flat=[];for(const s of r.steps){if(s.k==='ride')flat.push({k:'r',id:s.rid,a:s.q0,b:s.end});for(const b of s.blocks||[])flat.push({k:'b',id:b.id,a:b.start,b:b.end,w:b.walk,late:b.late||0})}
  return{flat,nDone:r.nDone,nMust:r.nMust,passMissed:r.passMissed||null,actMissed:r.actMissed||null,until:r.until}});
const check=(p,tag)=>{const ids=p.flat.map(x=>x.id),g=['b1','b2','b3'].map(id=>ids.indexOf(id));
  ck(g.every(i=>i>=0)&&g[1]===g[0]+1&&g[2]===g[1]+1,tag+': train → station → train back not together in order '+ids.join(','));
  const m=p.flat.find(x=>x.id==='b0');ck(m&&m.late<=15,tag+': lunch late '+JSON.stringify(m));
  ck(p.nDone===p.nMust&&!p.passMissed&&!p.actMissed,tag+': something dropped '+JSON.stringify([p.nDone,p.nMust,p.passMissed,p.actMissed]));
  const last=p.flat[p.flat.length-1];ck(last.b<=930+1e-6,tag+': runs past 3:30 '+last.b)};
let p=await look();out.p0=p.flat.map(x=>x.id+'@'+Math.round(x.a)).join(' ');check(p,'11:00 plan');
const navi=p.flat.findIndex(x=>x.id==='navi'),b1=p.flat.findIndex(x=>x.id==='b1');out.floated=b1!==navi+1;
// start the train up: the station and the train back are next, before any ride
out.after=await pg.evaluate(async()=>{const G=WDW.G,P=G.plan;G.t=Math.max(G.t,775);P.blkDone=Object.assign({},P.blkDone,{b1:1});G.segs=null;
  WDW.autoReplan([{k:'manual',text:'test'}],true);await new Promise(r=>setTimeout(r,300));const pr=WDW.dpProgress();const r=G.plan.res;
  const first=[];for(const s of r.steps){for(const b of s.blocks||[])first.push(b.id);if(s.k==='ride')first.push(s.rid)}return{next:pr.blk&&pr.blk.id,order:first.join(',')}});
ck(out.after.next==='b2'&&/^b2,b3/.test(out.after.order.replace(/^b0,?/,'')),'after starting the train up, the station and train back are not next '+JSON.stringify(out.after));
out.fail=fail;return out
