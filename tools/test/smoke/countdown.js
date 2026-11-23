// Countdown strip + alert tiers (row 71). Act now must be accurate (passes cost money, a missed dining reservation is charged):
// travel from where you are, the current step's remaining time, the pass window END, the booked time; never for what you're
// already heading to or a pass you've used. Plan changes in the plan view: no toast when what's next is unchanged, dot on
// Plan, Undo restores the previous plan and pauses auto-adjust. Phone alert for Act now on a real day.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
// freeze the sim clock; put the player at TRON (far from Peter Pan) with a Peter Pan pass 12:00–1:00
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();const G=WDW.G;G.segs=null;G.trip=null;G.node=WDW.NI[WDW.RIDE_BY.tron.nodeId];
  G.LL.passes.push({id:9801,rid:'pp',type:'mp',start:720,end:780,st:'active'})});
const L=(t,extra)=>pg.evaluate(([t,extra])=>{const G=WDW.G;G.t=t;if(extra)new Function('G','WDW',extra)(G,WDW);return WDW.cdList().map(o=>({key:o.key,k:o.k,tier:o.tier,tNow:o.tNow,tFin:o.tFin,rem:o.rem,slackNow:o.slackNow,slackFin:o.slackFin,onWay:o.onWay}))},[t,extra||'']);
const pp=a=>a.find(o=>o.key==='ll:9801');

// 1) travel is measured from where you are
let a=await L(700);const eta=await pg.evaluate(()=>WDW.planTo(WDW.RIDE_BY.pp,true).eta);out.eta=eta;
ck(pp(a)&&Math.abs(pp(a).tNow-eta)<0.01,'travel not from where you are '+JSON.stringify([pp(a),eta]));
ck(pp(a)&&pp(a).tier!=='act','false alarm at 11:40 with an 80 min margin '+JSON.stringify(pp(a)));
// 2) the window END is the deadline: 3 min of slack → Act now; 8 min → not
a=await L(780-eta-3);ck(pp(a)&&pp(a).tier==='act','no Act now with 3 min to spare '+JSON.stringify(pp(a)));
a=await L(780-eta-8);ck(pp(a)&&pp(a).tier!=='act','Act now with 8 min to spare '+JSON.stringify(pp(a)));
a=await L(780-eta-3,'G.LL.passes.find(p=>p.id===9801).end=800');ck(pp(a)&&pp(a).tier!=='act','window end not used (moved to 1:20 and still alarmed)');
await pg.evaluate(()=>{WDW.G.LL.passes.find(p=>p.id===9801).end=780});
// strip: Act now banner with Go now; Go → on your way, alarm gone
a=await L(780-eta-3);await pg.evaluate(()=>{WDW.cdRender()});
out.banner=await pg.evaluate(()=>{const s=document.querySelector('#pvStrip .cds');if(!s)return null;const r=s.getBoundingClientRect(),g=s.querySelector('[data-cd="go"]');
  let hit=null;if(g){const q=g.getBoundingClientRect(),t=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);hit=t===g||g.contains(t)}return{cls:s.className,txt:s.innerText.replace(/\s+/g,' '),go:!!g,hit,top:Math.round(r.top)}});
ck(out.banner&&/act/.test(out.banner.cls)&&/Leave now for Peter Pan/.test(out.banner.txt)&&out.banner.go&&out.banner.hit,'Act now banner '+JSON.stringify(out.banner));
await pg.evaluate(()=>document.querySelector('#pvStrip [data-cd="go"]').click());await W(200);
a=await L(780-eta-3);ck(pp(a)&&pp(a).onWay&&pp(a).tier!=='act','still alarming while heading there '+JSON.stringify(pp(a)));
// 3) the current step's remaining time counts: a 40 min meal
const meal="G.segs=[{k:'snack',dur:40,el:0,started:true,t0:G.t,name:'Lunch',act:'dine'}];G.seg=0;G.trip=null;G.tripEnd=null;";
a=await L(780-eta-30,meal);ck(pp(a)&&Math.abs(pp(a).rem-40)<0.5&&pp(a).tier==='act','40 min meal with 30 min margin: no Act now '+JSON.stringify(pp(a)));
a=await L(780-eta-50,meal);ck(pp(a)&&pp(a).tier!=='act','40 min meal with 50 min margin: false alarm '+JSON.stringify(pp(a)));
await pg.evaluate(()=>{WDW.cdRender()});out.why=await pg.evaluate(()=>document.querySelector('#pvStrip').innerText.replace(/\s+/g,' '));
await L(780-eta-30,meal);await pg.evaluate(()=>{WDW.cdRender()});out.why2=await pg.evaluate(()=>document.querySelector('#pvStrip').innerText.replace(/\s+/g,' '));
ck(/Finishing Lunch/.test(out.why2),'banner doesn\'t say finishing lunch makes you late '+out.why2);
// Not going: no more alarm for it
await pg.evaluate(()=>document.querySelector('#pvStrip [data-cd="dis"]').click());a=await L(780-eta-30,meal);ck(pp(a)&&pp(a).tier!=='act','Not going did not stop the alarm');
await pg.evaluate(()=>{delete WDW.CD.dis['ll:9801']});
// 4) dining: the booked time is the deadline
const din="G.segs=null;G.trip=null;G.tripEnd=null;const s=G.plan.res.steps[0];s.blocks=(s.blocks||[]).filter(b=>b.id!=='tdin').concat([{id:'tdin',name:'Test Diner',meal:true,at:WDW.__at||810,walk:5,dur:45}]);";
await pg.evaluate(()=>{WDW.G.ridden.push('pp')}); // 5) a used pass never alarms
a=await L(801,din);let d=a.find(o=>o.key==='blk:tdin');ck(!pp(a),'used pass still listed');
ck(d&&d.tier==='act','dining 1:30, 5 min walk, 1:21: no Act now '+JSON.stringify(d));
a=await L(790,din);d=a.find(o=>o.key==='blk:tdin');ck(d&&d.tier==='heads','dining at 1:10: not Heads up '+JSON.stringify(d));
a=await L(801,"WDW.__at=830;"+din);d=a.find(o=>o.key==='blk:tdin');ck(d&&d.tier!=='act','booked time not used (1:50 booking alarmed at 1:21)');
// a held show never escalates to Act now (no money at stake)
a=await L(801,"WDW.__at=810;"+din+"G.plan.res.steps[0].blocks.find(b=>b.id==='tdin').meal=false;G.plan.res.steps[0].blocks.find(b=>b.id==='tdin').user=true;");
d=a.find(o=>o.key==='blk:tdin');ck(d&&d.k==='show'&&d.tier!=='act','show escalated to Act now '+JSON.stringify(d));
await pg.evaluate(()=>{const s=WDW.G.plan.res.steps[0];s.blocks=s.blocks.filter(b=>b.id!=='tdin')});

// 6) plan changes: no toast when the next step is unchanged; dot on Plan; Undo restores and pauses auto-adjust
out.chg=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const G=WDW.G;G.ridden=G.ridden.filter(x=>x!=='pp');document.querySelector('#toasts').innerHTML='';
  const nx=()=>{const pr=WDW.dpProgress();return pr.step?pr.step.rid:pr.blk?pr.blk.id:'-'};
  // first change: toast only if what's next changed, and then it names it
  const n0=nx();WDW.autoReplan([{k:'behind',text:'test change'}]);await w(100);const t1=document.querySelector('#toasts').innerText,n1=nx();
  const firstOk=n1!==n0?/Plan changed · next: /.test(t1):!/Plan changed|Plan adjusted/.test(t1);
  // second change from the same state: same next step → no toast
  document.querySelector('#toasts').innerHTML='';const old=G.plan;WDW.autoReplan([{k:'behind',text:'test change 2'}]);await w(100);const n2=nx();const toast=n2===n1?document.querySelector('#toasts').innerText:'(next changed again: '+n1+'→'+n2+')';
  WDW.setView('plan');await w(300);const dot=document.querySelector('#bPlan').classList.contains('dot');const u=document.querySelector('#pvIn [data-auto-undo]');
  if(u)u.click();await w(300);const back=G.plan===old,pause=WDW.AUTO.pause>G.t;document.querySelector('#bPlan').click();await w(300);const dot2=document.querySelector('#bPlan').classList.contains('dot');WDW.testReset();
  return{firstOk,toast,dot,undo:!!u,back,pause,dot2}});
ck(out.chg.firstOk&&!/Plan changed|Plan adjusted|next changed/.test(out.chg.toast)&&out.chg.dot&&out.chg.undo&&out.chg.back&&out.chg.pause&&!out.chg.dot2,'plan change log / Undo '+JSON.stringify(out.chg));

// 7) phone alert for Act now (real day): due when finishing what you're doing stops leaving 5 min
await lib.startDay(pg,'MK','plan','now');
out.push=await pg.evaluate(()=>{const G=WDW.G,r=WDW.RIDE_BY.pp;G.LL.passes.push({id:9802,rid:'pp',type:'mp',start:Math.round(G.t)+30,end:Math.round(G.t)+90,st:'active'});
  WDW.PUSH.cats.ll=true;const o=WDW.cdList().find(x=>x.key==='ll:9802');const it=WDW.pushPlan().items.find(i=>i.k==='act:ll:9802');
  return{o:o&&{tFin:o.tFin,rem:o.rem,dl:o.dl},it:it&&{m:it.m,title:it.title},want:o&&o.dl-o.tFin-o.rem-5}});
ck(out.push.it&&Math.abs(out.push.it.m-out.push.want)<0.01&&/Leave now for Peter Pan/.test(out.push.it.title),'Act now phone alert '+JSON.stringify(out.push));
out.fail=fail;return out
