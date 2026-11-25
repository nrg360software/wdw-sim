// Nick, Nov 24: (1) the Now tab is clean — no auto-adjust box (it lives on the Plan tab with its Undo), plan confidence is one line
// and the explanation shows only when expanded (and stays expanded across the 2 s re-render); (2) "I'm done" ends the day early and
// shows the summary — from the Now card once everything is done, and any time from ⋯ More, always behind a confirm.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan')});await W(300);
// 1) a plan change happened: Now tab shows no change box; Plan tab has it with Undo
out.chg=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));WDW.autoReplan([{k:'behind',text:'test change'}]);await w(150);WDW.pvTab('now');await w(200);
  const pin=document.getElementById('pvIn'),now={undo:!!pin.querySelector('[data-auto-undo]'),txt:/Auto-adjusted/.test(pin.innerText)};WDW.pvTab('plan');await w(200);
  const plan=!!pin.querySelector('[data-auto-undo]');WDW.pvTab('now');await w(150);return{now,plan}});
ck(!out.chg.now.undo&&!out.chg.now.txt&&out.chg.plan,'auto-adjust note on the Now tab / missing on the Plan tab '+JSON.stringify(out.chg));
// 2) confidence: one line, collapsed; expanding shows the explanation and survives a re-render
await pg.waitForFunction(()=>WDW.G.plan.conf&&WDW.G.plan.conf.last,null,{timeout:60000}).catch(()=>{});
out.conf=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));WDW.PV.confOpen=false;WDW.pvRefresh(true);await w(150);const d=document.querySelector('#pvIn details.confc');if(!d)return{none:true,has:!!(WDW.G.plan.conf&&WDW.G.plan.conf.last)};
  const s=d.querySelector('summary'),closed={open:d.open,sum:s.innerText.replace(/\s+/g,' '),h:Math.round(d.getBoundingClientRect().height),pin:/Chance the rest goes/.test(document.getElementById('pvIn').innerText),full:!!document.querySelector('#pvIn > .conf')};
  s.click();await w(100);WDW.pvRefresh(true);await w(150);const d2=document.querySelector('#pvIn details.confc');
  return{closed,reopen:!!(d2&&d2.open),shows:/Chance the rest goes/.test(document.getElementById('pvIn').innerText)}});
ck(out.conf.closed&&!out.conf.closed.open&&/^\d+% Plan confidence/.test(out.conf.closed.sum)&&out.conf.closed.h<=60&&!out.conf.closed.pin&&!out.conf.closed.full,'confidence not a collapsed one-liner '+JSON.stringify(out.conf));
ck(out.conf.reopen&&out.conf.shows,'expanded confidence closed again on re-render / no explanation '+JSON.stringify(out.conf));
await pg.evaluate(()=>{WDW.PV.confOpen=false});
// 3) ⋯ More → I'm done → confirm: Keep going leaves the day running
out.more=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));document.getElementById('bMore').click();await w(200);const e=document.querySelector('#sheet [data-endday]');if(!e)return{noBtn:true};e.click();await w(200);
  const sh=document.getElementById('sheet').innerText.replace(/\s+/g,' '),no=document.querySelector('#sheet [data-endno]');if(no)no.click();await w(200);return{sh,over:WDW.G.over,sheetHidden:document.getElementById('sheet').hidden}});
ck(/Done for the day\?/.test(out.more.sh)&&/End my day/.test(out.more.sh)&&!out.more.over&&out.more.sheetHidden,'More → I\'m done → Keep going '+JSON.stringify(out.more));
// 4) everything done: the Now card offers I'm done (main) + Add must-dos; confirm → summary now, without fast-forwarding
out.end=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G;G.segs=null;G.trip=null;G.plan.res.steps=G.plan.res.steps.filter(s=>s.k!=='ride');WDW.pvRefresh(true);await w(200);
  const n=document.getElementById('ncard'),go=n&&n.querySelector('.ncgo'),alt=n&&n.querySelector('.ncalt'),card={big:n&&n.querySelector('.ncb').innerText,go:go&&go.innerText,alt:alt&&alt.innerText};
  if(!go)return{card};const t0=G.t;go.click();await w(200);const ok=document.querySelector('#sheet [data-endgo]');if(!ok)return{card,noConfirm:true};ok.click();await w(400);
  return{card,over:G.over,t:G.t===t0,end:!document.getElementById('end').hidden,stats:document.getElementById('endStats').innerText.replace(/\s+/g,' ').slice(0,120)}});
ck(/I'm done/.test(out.end.card.go||'')&&/Add must-dos/.test(out.end.card.alt||''),'Now card with nothing left: no I\'m done / Add must-dos '+JSON.stringify(out.end.card));
ck(out.end.over&&out.end.t&&out.end.end&&/rides/i.test(out.end.stats||''),'I\'m done did not end the day with the summary now '+JSON.stringify(out.end));
return {fail,out};
