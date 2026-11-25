// Conservation Station is off the walkways (Nick, Nov 25: "I could say go to Satu'li Canteen when the time was up and the sim let me
// walk there even though there is no walking path from Conservation Station. The sim also let me abort riding the train and start
// walking to another place as if the train were a walking path."). Imported stops: train up → Conservation Station → train back.
// On the train you can't change course (rides' Go disabled with the reason, other stops refused); at Conservation Station the only
// way on is the train back; the train back leaves you in Africa, and from there everything works again. With no train back left in
// the plan the Now card offers it. The state survives a save.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await pg.evaluate(()=>{const d=WDW.orlandoNow().date;localStorage.setItem('wdwsim.ll.'+d,JSON.stringify({mp:'AK',picks:[{rid:'navi',start:840}],sp:[],prem:null}));
  localStorage.setItem('wdwsim.view','plan');localStorage.setItem('wdwsim.auto','0');Object.keys(localStorage).filter(k=>/^wdwsim\.run\./.test(k)).forEach(k=>localStorage.removeItem(k));
  WDW.dpSave(d,{pk:'AK',must:['navi','ee'],ll:'mine',lunch:false,extras:false,pace:'bal',keep:false,end:1000,blocks:[
   {id:'b0',name:"Satu'li Canteen",after:'navi',walk:2,walkNext:null,dur:45,at:810,meal:true,tp:797},
   {id:'b1',name:'Wildlife Express Train from Africa to Conservation Station',after:'navi',walk:11,walkNext:null,dur:11,at:null,meal:false,tp:853},
   {id:'b2',name:'Conservation Station',after:'navi',walk:5,walkNext:null,dur:20,at:null,meal:false,tp:869},
   {id:'b3',name:'Wildlife Express Train from Conservation Station to Africa',after:'navi',walk:2,walkNext:8,dur:11,at:null,meal:false,tp:894}]})});
await lib.reload(pg);
await pg.evaluate(()=>{document.querySelector('#segTime [data-v="660"]:not([data-now])').click()});await pg.waitForTimeout(200);
await pg.evaluate(()=>document.querySelector('#bPlay').click());await pg.waitForFunction(()=>WDW.G.started&&WDW.G.plan,null,{timeout:60000});await pg.waitForTimeout(400);
out.kinds=await pg.evaluate(()=>['Wildlife Express Train from Africa to Conservation Station','Conservation Station','Wildlife Express Train from Conservation Station to Africa',"Satu'li Canteen",'Rafiki\'s Planet Watch'].map(n=>{const k=WDW.awayOf(n,'AK');return k?(k.at?'at':k.dir):'-'}).join(','));
ck(out.kinds==='out,at,back,-,at','stop kinds '+out.kinds);
const B={b0:{id:'b0',name:"Satu'li Canteen",walk:2,dur:45,at:810,meal:true},b1:{id:'b1',name:'Wildlife Express Train from Africa to Conservation Station',walk:11,dur:11},
  b2:{id:'b2',name:'Conservation Station',walk:5,dur:20},b3:{id:'b3',name:'Wildlife Express Train from Conservation Station to Africa',walk:2,dur:11}};
const state=()=>pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G,R=WDW.RIDE_BY;WDW.closeSheet();WDW.openRide(R.ee);await w(150);
  const go=document.querySelector('#sheet #goS'),note=[...document.querySelectorAll('#sheet .note')].map(n=>n.innerText).join(' ');WDW.closeSheet();
  WDW.setView('plan');WDW.pvTab('now');WDW.pvRefresh(true);await w(150);const nc=document.getElementById('pvNow').innerText.replace(/\s+/g,' ');
  const s=G.segs&&G.segs[G.seg];return{away:G.away||null,seg:s?s.name+'/'+(s.away||''):null,goOff:!!(go&&go.disabled),note,nc,node:WDW.NODES[G.node]&&WDW.NODES[G.node].id}});
const start=id=>pg.evaluate(b=>{const s0=WDW.G.segs&&WDW.G.segs[WDW.G.seg];WDW.dpStartBlk({blk:b});const s=WDW.G.segs&&WDW.G.segs[WDW.G.seg];return !!s&&s!==s0&&s.name===b.name},B[id]);
await pg.evaluate(()=>{WDW.G.t=900;WDW.G.segs=null;WDW.G.node=WDW.NI[WDW.RIDE_BY.navi.nodeId]});   // start away from Africa: the train back must leave you there
// 1) on the train up: no Go, no other stop; Now card says so
ck(await start('b1'),'train up did not start');
out.train=await state();
ck(out.train.goOff&&/on the Wildlife Express/.test(out.train.note),'Go allowed on the train '+JSON.stringify(out.train));
ck(!(await start('b0')),'Satu\'li started from the train');
ck(/Wildlife Express.*To Conservation Station/.test(out.train.nc),'Now card on the train '+out.train.nc);
// 2) train arrives: at Conservation Station, still no Go and no Satu'li
await pg.evaluate(()=>{const s=WDW.G.segs[WDW.G.seg];s.el=s.dur;WDW.actDone()});await pg.waitForTimeout(200);
out.at=await state();
ck(out.at.away==='Conservation Station'&&out.at.goOff&&/at Conservation Station.*only way back/.test(out.at.note),'at the station '+JSON.stringify(out.at));
ck(!(await start('b0')),'Satu\'li started from Conservation Station (no walking path)');
// 3) the visit, then the train back (cutting the visit short is fine); the train back can't be abandoned either
ck(await start('b2'),'Conservation Station visit did not start');ck(await start('b3'),'train back did not start from the station');
out.back=await state();ck(out.back.goOff&&/back to Africa/.test(out.back.note),'Go allowed on the train back '+JSON.stringify(out.back));
ck(!(await start('b0')),'Satu\'li started from the train back');
// a save mid-train keeps where you are
out.save=await pg.evaluate(()=>{const o=WDW.runState(),s=o.trip&&o.trip.segs&&o.trip.segs[0];return{away:o.away,seg:s&&s.away+'/'+s.awayName}});
ck(out.save.away==='Conservation Station'&&out.save.seg==='back/Conservation Station','save '+JSON.stringify(out.save));
// 4) off the train: back in Africa, everything works again
await pg.evaluate(()=>{const s=WDW.G.segs[WDW.G.seg];s.el=s.dur;WDW.actDone()});await pg.waitForTimeout(200);
out.home=await state();
ck(!out.home.away&&out.home.node==='AK:afr'&&!out.home.goOff,'not back in Africa '+JSON.stringify(out.home));
ck(await start('b0'),'Satu\'li refused after the train back');
// 5) at the station with no train back left in the plan: the Now card offers it, the replan counts the ride, tapping it takes you home
await pg.evaluate(()=>{const G=WDW.G;G.segs=null;G.away='Conservation Station';for(const k of ['b1','b2','b3'])G.plan.blkDone[k]=1});
out.nc=await state();ck(/At Conservation Station/.test(out.nc.nc)&&/Take the train back/.test(out.nc.nc),'Now card at the station '+out.nc.nc);
out.opts=await pg.evaluate(()=>{const o=WDW.dpGameOpts(WDW.G.plan.settings);return{node:WDW.NODES[o.node].id,dt:Math.round(o.t-WDW.G.t)}});
ck(out.opts.node==='AK:afr'&&out.opts.dt>=12,'replan from the station '+JSON.stringify(out.opts));
await pg.evaluate(async()=>{document.querySelector('#pvNow [data-nc="awayback"]').click();await new Promise(r=>setTimeout(r,150));const s=WDW.G.segs[WDW.G.seg];s.el=s.dur;WDW.actDone()});await pg.waitForTimeout(200);
out.home2=await state();ck(!out.home2.away&&out.home2.node==='AK:afr','train back from the Now card '+JSON.stringify(out.home2));
out.fail=fail;return out
