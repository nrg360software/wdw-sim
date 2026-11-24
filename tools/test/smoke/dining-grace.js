// Dining grace warning (Nick, Nov 23: arriving within a reservation's 15-min grace is OK, but warn BEFORE starting the step that
// leads into it). The Now card shows "⚠ This gets you to X ~Nm late (within the 15-min grace)" on the Go / Start of the step right
// before the meal, not on unrelated steps, and not once you've started it. The strip calls it out as Heads up instead of a false
// Act now, and still raises Act now if it slips past what the plan accepted.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan')});await W(300);
const card=()=>pg.evaluate(async()=>{WDW.pvRefresh(true);await new Promise(r=>setTimeout(r,120));const n=document.getElementById('pvNow'),w=n.querySelector('.ncw'),b=n.querySelector('.ncgo');
  return{warn:w?w.innerText:'',btn:b?b.dataset.nc+':'+b.innerText:'',warnAboveBtn:!!(w&&b&&w.getBoundingClientRect().bottom<=b.getBoundingClientRect().top+1)}});
// set up: clear any meals, put a late meal after a given step
const put=(where,extra)=>pg.evaluate(([where,extra])=>{const G=WDW.G,P=G.plan,st=P.res.steps;G.segs=null;G.trip=null;G.tripEnd=null;
  st.forEach(s=>{s.blocks=(s.blocks||[]).filter(b=>!/^tg/.test(b.id))});P.blkDone={};
  const pr=WDW.dpProgress(),i=where==='next'?pr.next:where==='later'?st.findIndex((s,j)=>j>pr.next&&s.k==='ride'):0;
  const meal={id:'tgr',name:'Test Grill',meal:true,at:Math.round(G.t)+120,walk:5,dur:45,start:Math.round(G.t)+131,end:Math.round(G.t)+176,late:11};
  st[i].blocks=extra==='stop'?[{id:'tgs',name:'Test Stop',meal:false,at:null,walk:3,dur:10,start:0,end:0,late:0},meal]:[meal].concat(st[i].blocks||[]);
  return{i,k:st[i].k,next:pr.next}},[where,extra||'']);

// 1) the meal right after the next ride: warning on that ride's Go, above the button
out.s1=await put('next');let c=await card();out.c1=c;
ck(/^go:/.test(c.btn)&&/This gets you to Test Grill ~11m late \(within the 15-min grace\)/.test(c.warn)&&c.warnAboveBtn,'no grace warning on the Go before the meal '+JSON.stringify(c));
// the map-view Plan sheet's status says it too
out.sheet=await pg.evaluate(()=>/This gets you to Test Grill ~11m late/.test(WDW.planViewHTML().head));ck(out.sheet,'grace warning missing from the plan status');
// 🔒 box: seat time + late within grace
out.lock=await pg.evaluate(()=>WDW.pvLockItems().map(x=>x.h).join(' | '));ck(/Test Grill.*~11m late \(within the 15-min grace\)/.test(out.lock),'🔒 box '+out.lock);
// 2) the meal after a later ride: no warning on this step
out.s2=await put('later');c=await card();out.c2=c;ck(out.s2.i>out.s2.next&&/^go:/.test(c.btn)&&!c.warn,'grace warning on an unrelated step '+JSON.stringify([out.s2,c]));
// 3) an earlier stop leads into it: warning on that stop's Start; once the stop is done, the meal's own Start says "You'll reach"
out.s3=await put('start','stop');c=await card();out.c3=c;
ck(out.s3.k==='start'&&/^blk:/.test(c.btn)&&/This gets you to Test Grill/.test(c.warn),'no grace warning on the stop before the meal '+JSON.stringify([out.s3,c]));
await pg.evaluate(()=>{WDW.G.plan.blkDone.tgs=1});c=await card();out.c3b=c;
ck(/^blk:/.test(c.btn)&&/You'll reach Test Grill ~11m late/.test(c.warn),'meal\'s own Start lost the warning '+JSON.stringify(c));
// 4) after Go the choice is made: no warning on the card while heading there
await put('next');c=await card();out.c4a=c;out.go=await pg.evaluate(()=>{const g=document.querySelector('#pvNow [data-nc="go"]');if(g)g.click();return !!g});await W(200);c=await card();out.c4=c;ck(out.go,'no Go on the card '+JSON.stringify(out.c4a));
ck(!c.warn,'grace warning still on the card after Go '+JSON.stringify(c));
// 5) strip: the planned lateness is Heads up (not a false Act now) with the reason; slipping past it → Act now; a meal the plan
//    didn't seat late (late 0) keeps the old Act now threshold
const strip=(late,slip)=>pg.evaluate(([late,slip])=>{const G=WDW.G,b=G.plan.res.steps.flatMap(s=>s.blocks||[]).find(x=>x.id==='tgr');b.late=late;
  const o0=WDW.cdList().find(x=>x.key==='blk:tgr');b.at=Math.round(G.t+o0.rem+o0.tFin-slip);const o=WDW.cdList().find(x=>x.key==='blk:tgr');WDW.CD.html='';WDW.cdRender();
  return{tier:o.tier,sf:Math.round(o.slackFin),txt:document.getElementById('pvStrip').innerText.replace(/\s+/g,' ')}},[late,slip]);
out.st1=await strip(11,11);ck(out.st1.tier==='heads'&&/plan gets you there ~11m late \(within the 15-min grace\)/.test(out.st1.txt),'planned grace lateness not Heads up '+JSON.stringify(out.st1));
out.st2=await strip(11,16);ck(out.st2.tier==='act','slipped past the planned lateness: no Act now '+JSON.stringify(out.st2));
out.st3=await strip(0,4);ck(out.st3.tier==='act','unplanned lateness lost its Act now '+JSON.stringify(out.st3));
await pg.evaluate(()=>{const st=WDW.G.plan.res.steps;st.forEach(s=>{s.blocks=(s.blocks||[]).filter(b=>!/^tg/.test(b.id))})});
return {fail,out};
