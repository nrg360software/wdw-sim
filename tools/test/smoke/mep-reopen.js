// Nick's DAK day (Nov 24): Na'vi pass 2–3, Flight of Passage 2:30–3:30. Na'vi broke down in its window → Multiple Experience Pass.
// When Na'vi came back up, auto-adjust "dropped Na'vi (won't fit: timing)" and the Now card went straight to Flight: the MEP was only
// good on OTHER rides, so the plan couldn't use it at Na'vi. Disney's MEP covers the same ride once it reopens. Check: after Na'vi
// reopens the replan keeps Na'vi on the MEP and Flight inside its window; same for a run saved before the fix (opts without Na'vi).
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await lib.startDay(pg,'AK','plan',660,{must:['navi','fop']});
const day=old=>pg.evaluate(async old=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G,R=WDW.RIDE_BY;const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();
  G.segs=null;G.trip=null;G.tripEnd=null;G.ridden=G.ridden.filter(x=>x!=='navi'&&x!=='fop');G.LL.mp='AK';G.LL.tapped=true;G.node=WDW.NI[R.ee.nodeId];G.ridden=G.ridden.includes('ee')?G.ridden:G.ridden.concat('ee');   // just off Everest, like Nick
  
  G.LL.passes=[{id:9801,rid:'navi',type:'mp',start:840,end:900,st:'active'},{id:9802,rid:'fop',type:'sp',start:870,end:930,st:'active'}];
  // Na'vi down during its window
  G.t=845;R.navi.downUntil=868;for(let i=0;i<3;i++)WDW.llTick(5);const p=G.LL.passes[0],mep={st:p.st,opts:(p.mepOpts||[]).slice()};
  if(old&&p.st==='mep')p.mepOpts=p.mepOpts.filter(x=>x!=='navi');   // a run saved before the fix
  // back up at 2:29 → replan
  G.t=869;WDW.autoReplan([{k:'sync',text:"Na'vi is back up"}],true);await w(150);
  const st=G.plan.res.steps.filter(s=>s.k==='ride').map(s=>({rid:s.rid,how:s.how,q0:Math.round(s.q0)}));
  const use=WDW.llUse(R.navi);WDW.setView('plan');WDW.pvTab('now');WDW.pvRefresh(true);await w(150);const chips=[...document.querySelectorAll('#pvIn .pvlb')].map(b=>b.innerText).join(' | ');
  const lock=WDW.pvLockItems().map(x=>x.h.replace(/<[^>]+>/g,'')).join(' | ');
  return{mep,st,use:use&&use.kind,missed:(G.plan.res.missed||[]).map(x=>x.rid||x.id||x),chips,lock}},old);
for(const old of [false,true]){const k=old?'oldSave':'fresh';out[k]=await day(old);const o=out[k],nv=o.st.find(s=>s.rid==='navi'),fp=o.st.find(s=>s.rid==='fop');
  if(!old)ck(o.mep.st==='mep'&&o.mep.opts.includes('navi'),k+': breakdown MEP not good on Na\'vi '+JSON.stringify(o.mep));
  ck(o.use==='mep',k+': Na\'vi can\'t use the MEP '+JSON.stringify(o.use));
  ck(nv&&nv.how==='mep',k+': plan dropped Na\'vi or rides it standby '+JSON.stringify(o.st));
  ck(fp&&fp.q0>=865&&fp.q0<=930,k+': Flight not inside its 2:30–3:30 window '+JSON.stringify(o.st));
  // Nick: "the part that was unclear to me was that Na'vi went down" — the held-pass chip and the 🔒 box say so
  if(!old)ck(/Na'vi · went down · good all day/.test(o.chips)&&/Na'vi.*went down 2:05 PM · pass now good all day, on Na'vi or any .*planned on Na'vi/.test(o.lock),k+': breakdown not shown '+JSON.stringify([o.chips,o.lock]))}
return {fail,out};
