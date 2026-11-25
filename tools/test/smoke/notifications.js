// Notifications (Nick, Nov 25: "The notifications blend in with the info they overlay. It might be better to have a dedicated, scrollable
// notifications section."). Plan view: no floating toasts over the page; one fixed-height line under the countdown strip shows the newest
// notice (gold while fresh, Undo while it lasts, unread count) and the page starts below it; tapping it opens a scrollable Notifications
// sheet (newest first, Undo on live ones). Floating toasts still show over other sheets and in the map view. Not redrawn under a finger.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan');WDW.pvTab('now');WDW.pvRefresh(true)});await W(300);
const bar=()=>pg.evaluate(()=>{const b=document.getElementById('pvNtf'),r=b.getBoundingClientRect(),t=document.getElementById('toasts'),first=document.querySelector('#pvIn').firstElementChild;
  return{vis:getComputedStyle(b).display!=='none',h:Math.round(r.height),bottom:Math.round(r.bottom),pageTop:first?Math.round(first.getBoundingClientRect().top):null,
    text:(b.querySelector('.ntx')||{}).textContent||'',nu:(b.querySelector('.nu')||{}).textContent||'',undo:!!b.querySelector('[data-ntfundo]'),fresh:b.classList.contains('fresh'),floating:getComputedStyle(t).display!=='none'}});
// 1) two notices: newest in the line, unread count, fresh; no floating toasts; the page starts below the line
await pg.evaluate(()=>{WDW.toast('Alpha notice');WDW.toast('Safari done · 1h 5m to get on',17)});await W(250);
out.b1=await bar();
ck(out.b1.vis&&out.b1.h===36&&out.b1.text==='+17 Safari done · 1h 5m to get on'&&+out.b1.nu>=2&&out.b1.fresh,'notification line '+JSON.stringify(out.b1));
ck(!out.b1.floating,'floating toasts still over the plan view');ck(out.b1.pageTop!=null&&out.b1.pageTop>=out.b1.bottom,'page content under the notification line '+JSON.stringify(out.b1));
// 2) Undo from the line (a replan's Undo, kept in the line over newer notices for its 10 s): restores the old plan
out.undo=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),P0=WDW.G.plan;WDW.openEditPlan();document.querySelector('#sheet #dpRe').click();await w(300);
  const b=document.querySelector('#pvNtf [data-ntfundo]'),txt=document.querySelector('#pvNtf .ntx').textContent;if(!b)return{noBtn:true,txt};b.click();await w(300);
  return{txt,back:WDW.G.plan===P0,gone:!document.querySelector('#pvNtf [data-ntfundo]'),sheet:!document.getElementById('sheet').hidden}});
ck(!out.undo.noBtn&&/Plan updated/.test(out.undo.txt)&&out.undo.back&&out.undo.gone&&!out.undo.sheet,'Undo in the notification line '+JSON.stringify(out.undo));
// 3) the sheet: everything, newest first; opening it clears the count; no floating toasts over it, but over other sheets yes
out.sheet=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));document.getElementById('pvNtf').click();await w(250);
  const nu=(document.querySelector('#pvNtf .nu')||{}).textContent||'',rows=[...document.querySelectorAll('#sheet .ntr .ntx')].map(x=>x.textContent),h=document.querySelector('#sheet h2').textContent;WDW.toast('While the sheet is open');await w(100);
  const fl=getComputedStyle(document.getElementById('toasts')).display!=='none';WDW.closeSheet();WDW.openEditPlan();await w(100);const fl2=getComputedStyle(document.getElementById('toasts')).display!=='none';WDW.closeSheet();
  return{h,rows,fl,fl2,nu}});
const R=out.sheet.rows;
ck(out.sheet.h==='Notifications'&&R.indexOf('Undone')<R.indexOf('Plan updated from here')&&R.indexOf('+17 Safari done · 1h 5m to get on')<R.indexOf('Alpha notice')&&R.includes('Alpha notice'),'sheet list '+JSON.stringify(R));
ck(!out.sheet.fl&&out.sheet.fl2,'floating toasts over sheets '+JSON.stringify(out.sheet));
ck(!out.sheet.nu,'count not cleared by opening the sheet '+JSON.stringify(out.sheet.nu));
// 4) older than 20 s: muted
out.old=await pg.evaluate(()=>{WDW.NTF.list[0].at-=30000;WDW.pvRefresh(true);const b=document.getElementById('pvNtf');return{fresh:b.classList.contains('fresh'),old:!!b.querySelector('.ntx.old')}});
ck(!out.old.fresh&&out.old.old,'old notice still highlighted '+JSON.stringify(out.old));
// 5) not redrawn while a finger is down; drawn after it lifts
out.hold=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),b=document.getElementById('pvNtf');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:51,bubbles:true,pointerType:'touch'}));
  WDW.toast('Under the finger');await w(200);const during=b.querySelector('.ntx').textContent,latest=WDW.NTF.list[0].text;window.dispatchEvent(new PointerEvent('pointerup',{pointerId:51,bubbles:true,pointerType:'touch'}));await w(700);
  return{during,latest,after:b.querySelector('.ntx').textContent,now:WDW.NTF.list[0].text}});
ck(out.hold.during!==out.hold.latest&&out.hold.after===out.hold.now,'redrawn under a finger '+JSON.stringify(out.hold));
// 6) map view: floating toasts, no line
out.map=await pg.evaluate(async()=>{WDW.setView('map');await new Promise(r=>setTimeout(r,300));const r={line:getComputedStyle(document.getElementById('pvNtf')).display!=='none'&&!!document.getElementById('pvNtf').offsetParent,floating:getComputedStyle(document.getElementById('toasts')).display!=='none'};WDW.setView('plan');return r});
ck(!out.map.line&&out.map.floating,'map view '+JSON.stringify(out.map));
out.fail=fail;return out
