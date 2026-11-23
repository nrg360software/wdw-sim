// Now card (row 70): plan-only view, real-time day. One primary button at the bottom; progress only moves on a tap
// (the sim waits at the ride for "I'm in line"); later taps complete earlier steps; Undo; Fix steps (rode it with a time,
// skipped it); no tappable future steps; Go uses a Lightning Lane you hold whenever the button says so.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
const W=ms=>pg.waitForTimeout(ms);
const card=()=>pg.evaluate(()=>{const c=document.querySelector('#pvNow .ncard');if(!c)return null;const b=c.querySelector('.ncgo'),q=s=>{const e=c.querySelector(s);return e?e.textContent:''};
  let hit=null;if(b){const r=b.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);hit=(t===b||b.contains(t))&&r.bottom<=innerHeight&&r.top>=0}
  const s=WDW.G.segs&&WDW.G.segs[WDW.G.seg];
  return{tag:q('.nct'),big:q('.ncb'),sub:q('.ncs'),nudge:q('.ncn'),btn:b?b.textContent:null,nc:b?b.dataset.nc:null,dis:b?b.disabled:null,hit,fix:!!c.querySelector('[data-nc="fix"]'),foot:q('.ncft'),
    seg:s?s.k+(s.started?'+':'-')+(s.tap?'T':''):null,ridden:WDW.G.ridden.length,rt:getComputedStyle(document.querySelector('#rtRow')).display}});
const tapMain=async()=>{await pg.evaluate(()=>{WDW.__pvTouch=0;document.querySelector('#pvNow .ncgo').click()});await W(300)};
const refresh=()=>pg.evaluate(()=>{WDW.stepsRefresh?WDW.stepsRefresh():WDW.setView('plan')});
const advance=async m=>{await pg.evaluate(m=>window.adv(m),m);await W(2500);await pg.evaluate(()=>WDW.setView('plan'));await W(200)};
const toUndo=()=>pg.evaluate(()=>{const b=document.querySelector('#toasts [data-undo]');if(!b)return false;b.click();return true});

await lib.startDay(pg,'MK','plan','now');
let c=await card();out.c0=c;
ck(c&&c.tag==='Next'&&c.nc==='go'&&c.hit,'idle card: Next + Go button reachable '+JSON.stringify(c));
ck(c&&c.fix,'Fix steps link missing on a real day');ck(c&&c.rt==='none','dock ✓ row still shown in the plan view (two places to confirm)');
ck(await pg.evaluate(()=>!document.querySelector('#pvIn #dpNext')&&!document.querySelector('#pvIn .nowc')),'plan page still has its own Go / now card');

// Go, then tap through to "I'm in line" (bus legs first if the day starts at the hotel)
await tapMain();c=await card();out.c1=c;ck(c&&/^Head to /.test(c.big)&&c.nc==='tap','after Go: Head to + tap button '+JSON.stringify(c));
for(let k=0;k<4&&c&&!/in line/.test(c.btn);k++){await tapMain();c=await card()}
ck(c&&c.btn==="I'm in line",'never offered "I\'m in line" '+JSON.stringify(c));
// the walk runs out: the sim waits at the ride instead of starting the line
const est=await pg.evaluate(()=>Math.ceil(WDW.G.trip.est+5));await advance(est);c=await card();out.c2=c;
ck(c&&c.seg==='queue-'&&/^Head to /.test(c.big)&&/there about now/.test(c.sub),'sim started the line without a tap '+JSON.stringify(c));
// tap in line → In line; Undo → back; tap again
await tapMain();c=await card();out.c3=c;ck(c&&/^In line · /.test(c.big)&&c.btn==='Off the ride ✓'&&c.seg==='queue+T','in line state '+JSON.stringify(c));
ck(await toUndo(),'no Undo after a tap');await W(300);await refresh();await W(300);c=await card();out.c3u=c;ck(c&&c.seg==='queue-'&&/^Head to /.test(c.big),'Undo did not restore '+JSON.stringify(c));
await tapMain();c=await card();
// running long: quiet note on the card, no toast
const q=await pg.evaluate(()=>{const s=WDW.G.segs[WDW.G.seg];return Math.ceil(s.dur+8)});await advance(q);c=await card();out.c4=c;
ck(c&&c.seg==='queue+T'&&/longer than expected/.test(c.nudge),'running long: no quiet note or line ended without a tap '+JSON.stringify(c));
ck(await pg.evaluate(()=>!/longer/i.test(document.querySelector('#toasts').innerText)),'running long raised a toast');
// off the ride
const r0=await pg.evaluate(()=>WDW.G.segs[WDW.G.segs.length-1].ride.short);
await tapMain();c=await card();out.c5=c;ck(c&&c.ridden===1&&c.tag==='Next'&&c.foot.includes('Done: '+r0),'off the ride '+JSON.stringify(c));

// steps sheet: no tappable future steps
await pg.evaluate(()=>document.querySelector('#pvNow .ncgo').click());await W(300);
out.fut=await pg.evaluate(()=>{WDW.openSteps();const n=[...document.querySelectorAll('#sheet .stp.fut button')].length;const f=!!document.querySelector('#sheet [data-now="fix"]');WDW.testReset();return{n,f}});
ck(out.fut.n===0&&out.fut.f,'steps sheet: future steps tappable or Fix missing '+JSON.stringify(out.fut));

// Fix steps › Already rode it, 5 min earlier than the guess
await pg.evaluate(()=>document.querySelector('#pvNow [data-nc="fix"]').click());await W(300);
out.fx=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const sh=document.querySelector('#fixSheet');if(!sh)return null;
  document.querySelector('[data-fx="rode"]').click();await w(100);const t0=document.querySelector('.fxt b').textContent;document.querySelector('[data-fxt="-5"]').click();await w(100);
  const t1=document.querySelector('.fxt b').textContent;const n0=WDW.G.ridden.length;document.querySelector('#fxGo').click();await w(200);
  const L=WDW.G.log,e=L[L.length-1];return{t0,t1,n0,n1:WDW.G.ridden.length,e:{q0:e.q0,on:e.on,wait:e.wait,done:e.done},open:!document.getElementById('sheet').hidden}});
const hm=s=>{const m=s.match(/(\d+):(\d+) (AM|PM)/);return (+m[1]%12+(m[3]==='PM'?12:0))*60+ +m[2]};
ck(out.fx&&out.fx.n1===out.fx.n0+1&&hm(out.fx.t0)-hm(out.fx.t1)===5&&out.fx.e.q0===hm(out.fx.t1)&&out.fx.e.wait!=null&&out.fx.e.done,'Fix › rode it '+JSON.stringify(out.fx));
ck(await toUndo(),'no Undo after Fix');await W(300);out.fxu=await pg.evaluate(()=>({n:WDW.G.ridden.length,segs:!!WDW.G.segs}));ck(out.fxu.n===out.fx.n0&&out.fxu.segs,'Undo of Fix '+JSON.stringify(out.fxu));

// Fix steps › Skipped it
await refresh();await W(300);await pg.evaluate(()=>document.querySelector('#pvNow [data-nc="fix"]').click());await W(300);
out.sk=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('[data-fx="skip"]').click();await w(100);const n0=WDW.G.ridden.length;document.querySelector('#fxGo').click();await w(300);return{n0,n1:WDW.G.ridden.length,segs:!!WDW.G.segs}});
ck(out.sk.n1===out.sk.n0&&!out.sk.segs,'Fix › skipped '+JSON.stringify(out.sk));

// the sim gives up waiting for the tap after 30 min, gets in line on its own; the card still asks, and the tap restarts the line from now
await refresh();await W(300);c=await card();if(c.nc==='go'){await tapMain()}
for(let k=0;k<4;k++){c=await card();if(c.btn==="I'm in line")break;await tapMain()}
const e2=await pg.evaluate(()=>Math.ceil(WDW.G.trip.est+40));await advance(e2);c=await card();out.c6=c;
ck(c&&c.seg==='queue+'&&/^Head to /.test(c.big)&&c.btn==="I'm in line",'after the arrival cap '+JSON.stringify(c));
await tapMain();out.rs=await pg.evaluate(()=>{const s=WDW.G.segs[WDW.G.seg],L=WDW.G.log,e=L[L.length-1];return{el:s.el,tap:!!s.tap,q0:e.q0,t:Math.round(WDW.G.t)}});
ck(out.rs.tap&&out.rs.el<2&&Math.abs(out.rs.q0-out.rs.t)<=1,'tap after the cap did not restart the line '+JSON.stringify(out.rs));
await pg.evaluate(()=>document.querySelector('#pvNow .ncgo').click());await W(300);

// Go uses a Lightning Lane you hold for a standby step when the button says so (#dpNext used standby before)
out.ll=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const G=WDW.G;WDW.setView('plan');await w(300);
  const P=G.plan,pr=WDW.dpProgress(),s=pr.step;if(!s)return 'no step';const r=WDW.RIDE_BY[s.rid];if(!r.ll)return 'no LL ride '+s.rid;
  G.LL.passes.push({id:9901,rid:r.id,st:'active',start:Math.round(G.t),end:Math.round(G.t)+60,type:'mp'});WDW.setView('plan');await w(300);
  const b=document.querySelector('#pvNow .ncgo');const lab=b.textContent;b.click();await w(300);const q=G.segs&&G.segs.find(x=>x.k==='queue');
  // and the 3D view's plan sheet button
  G.segs=null;G.trip=null;WDW.setView('map');WDW.openPlan();await w(300);const d=document.querySelector('#sheet #dpNext');const dl=d?d.textContent:null;if(d)d.click();await w(300);
  const q2=G.segs&&G.segs.find(x=>x.k==='queue');WDW.setView('plan');return{how:s.how,lab,ll:!!(q&&q.ll),dl,ll2:!!(q2&&q2.ll)}});
ck(out.ll&&/⚡/.test(out.ll.lab)&&out.ll.ll&&/Lightning Lane/.test(out.ll.dl)&&out.ll.ll2,'Go with a held Lightning Lane '+JSON.stringify(out.ll));

// every Now-card and Fix-steps button does something
await lib.startDay(pg,'MK','plan','now');
const a1=await lib.audit(pg,'now card','WDW.setView("plan")','#pvNow',{});fail.push(...a1.fail);
await pg.evaluate(()=>document.querySelector('#pvNow .ncgo').click());await W(300);
const a2=await lib.audit(pg,'fix steps','WDW.setView("plan");WDW.openFix()','#sheet',{reset:false});fail.push(...a2.fail);
out.audit=[a1.tapped,a2.tapped];ck(a1.tapped>=2&&a2.tapped>=5,'audit found too few buttons '+out.audit);
out.fail=fail;return out
