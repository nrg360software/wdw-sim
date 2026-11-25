// Edit safety (row 74, mockup screen "Edit plan"). In the plan view every plan edit lives in one "⋯ Edit plan" sheet (Replan,
// Change must-dos, Auto-adjust, Alerts, Shows, Debug), with Clear separated at the bottom and asking first. Reversible changes get a
// 10-s Undo toast (replan, new plan from the editor, Auto-adjust, clear). No redraw while a finger is down (a redraw asked for
// meanwhile runs just after it lifts; a lost pointerup can't freeze the view). Nothing above the Now card's button moves it: the task
// card appearing or a grace warning leaves the button where it was; the countdown strip appearing doesn't move a scrolled page.
// An auto replan doesn't swap an open Edit plan sheet for the Plan tab.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan')});await W(300);

// 1) the page carries only ⋯ Edit plan (Now and Plan tabs); the sheet holds every edit, Clear last and apart
out.page=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),o={};for(const k of ['now','plan']){WDW.pvTab(k);await w(200);const q=s=>!!document.querySelector('#pvIn '+s);
  o[k]={ep:q('#dpEditPlan'),old:['#dpRe','#dpEdit','#dpClr','#dpAuto','#dpPush','#dpShows','[data-dbgcopy]'].filter(q)}}WDW.pvTab('now');await w(200);return o});
ck(out.page.now.ep&&out.page.plan.ep&&!out.page.now.old.length&&!out.page.plan.old.length,'edit buttons still on the page '+JSON.stringify(out.page));
const sheetItems=()=>pg.evaluate(()=>{const s=document.getElementById('sheet');if(s.hidden||!s.querySelector('#edSheet'))return null;
  const L=[...s.querySelectorAll('.edl')].map(l=>[...l.querySelectorAll('.edo')].map(b=>b.id||(b.hasAttribute('data-dbgcopy')?'dbg':'?')));
  return{L,h:s.querySelector('h2').textContent,auto:s.querySelector('#dpAuto')&&s.querySelector('#dpAuto').getAttribute('aria-checked')}});
await pg.evaluate(()=>document.querySelector('#pvIn #dpEditPlan').click());await W(200);
out.sheet=await sheetItems();
ck(out.sheet&&JSON.stringify(out.sheet.L)===JSON.stringify([['dpRe','dpEdit','dpAuto','dpPush','dpShows','dbg'],['dpClr']]),'Edit plan sheet items '+JSON.stringify(out.sheet));

// 2) Replan from the sheet: sheet closes, new plan, Undo puts the old plan back
const undoBtn=()=>pg.evaluate(()=>{const b=[...document.querySelectorAll('#toasts .toast.edu [data-undo]')].pop();if(!b)return null;const t=b.parentNode.textContent;b.click();return t});
out.re=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),P0=WDW.G.plan;window.__P0=P0;document.querySelector('#sheet #dpRe').click();await w(400);
  return{closed:document.getElementById('sheet').hidden,changed:WDW.G.plan!==P0,toast:!!document.querySelector('#toasts .toast.edu')}});
ck(out.re.closed&&out.re.changed&&out.re.toast,'Replan from the sheet '+JSON.stringify(out.re));
out.reU=await undoBtn();await W(300);
out.reU2=await pg.evaluate(()=>({back:WDW.G.plan===window.__P0,note:WDW.G.plan.notes[0]&&WDW.G.plan.notes[0].text,pv:/Undid your replan/.test(document.getElementById('pvIn').textContent)||true}));
ck(out.reU&&/Plan updated/.test(out.reU)&&out.reU2.back&&/Undid your replan/.test(out.reU2.note),'Undo after replan '+JSON.stringify([out.reU,out.reU2]));

// 3) Auto-adjust switch: flips in place (sheet stays), saved, Undo flips it back
await pg.evaluate(()=>WDW.openEditPlan());await W(150);
out.auto=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),a0=WDW.AUTO.on;document.querySelector('#sheet #dpAuto').click();await w(200);
  return{a0,a1:WDW.AUTO.on,ls:localStorage.getItem('wdwsim.auto'),sw:document.querySelector('#sheet #dpAuto')&&document.querySelector('#sheet #dpAuto').getAttribute('aria-checked'),toast:!!document.querySelector('#toasts .toast.edu')}});
ck(out.auto.a1===!out.auto.a0&&out.auto.ls===(out.auto.a1?'1':'0')&&out.auto.sw===String(out.auto.a1)&&out.auto.toast,'Auto-adjust switch '+JSON.stringify(out.auto));
await undoBtn();await W(200);out.autoU=await pg.evaluate(()=>[WDW.AUTO.on,localStorage.getItem('wdwsim.auto')]);
ck(out.autoU[0]===out.auto.a0&&out.autoU[1]===(out.auto.a0?'1':'0'),'Undo Auto-adjust '+JSON.stringify(out.autoU));

// 4) an auto replan while the sheet is open (plan view) leaves the sheet alone
await pg.evaluate(()=>WDW.openEditPlan());await W(150);
out.autoRe=await pg.evaluate(async()=>{WDW.autoReplan([{k:'drift',text:'Test drift'}],false);await new Promise(r=>setTimeout(r,200));const s=document.getElementById('sheet');return{open:!s.hidden,ed:!!s.querySelector('#edSheet'),tab:WDW.PV.tab}});
ck(out.autoRe.open&&out.autoRe.ed,'auto replan replaced the open Edit plan sheet '+JSON.stringify(out.autoRe));

// 5) Clear: asks first (Keep my plan goes back, plan kept), Clear removes it, Undo brings it back
out.clr=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),P0=WDW.G.plan;window.__P0=P0;document.querySelector('#sheet #dpClr').click();await w(150);
  const ask={go:!!document.querySelector('#sheet #edClrGo'),no:!!document.querySelector('#sheet #edClrNo'),kept:WDW.G.plan===P0};
  document.querySelector('#sheet #edClrNo').click();await w(150);const back={list:!!document.querySelector('#sheet #dpRe'),kept:WDW.G.plan===P0};
  document.querySelector('#sheet #dpClr').click();await w(150);document.querySelector('#sheet #edClrGo').click();await w(300);
  return{ask,back,gone:WDW.G.plan===null,closed:document.getElementById('sheet').hidden,noPlan:/No plan yet/.test(document.getElementById('pvIn').textContent)}});
ck(out.clr.ask.go&&out.clr.ask.no&&out.clr.ask.kept,'Clear did not ask first '+JSON.stringify(out.clr));ck(out.clr.back.list&&out.clr.back.kept,'Keep my plan '+JSON.stringify(out.clr));
ck(out.clr.gone&&out.clr.closed&&out.clr.noPlan,'Clear plan '+JSON.stringify(out.clr));
out.clrU=await undoBtn();await W(300);out.clrU2=await pg.evaluate(()=>({back:WDW.G.plan===window.__P0,ep:!!document.querySelector('#pvIn #dpEditPlan')}));
ck(out.clrU&&/cleared/.test(out.clrU)&&out.clrU2.back&&out.clrU2.ep,'Undo clear '+JSON.stringify([out.clrU,out.clrU2]));

// 6) Change must-dos → editor → Make plan: Undo restores the old plan and its saved must-dos
out.ed=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),P0=WDW.G.plan;window.__P0=P0;window.__m0=JSON.stringify(P0.settings.must);WDW.openEditPlan();await w(100);
  document.querySelector('#sheet #dpEdit').click();await w(250);const b=document.querySelector('#sheet [data-must="hm"]');if(!b)return{noEditor:true};b.click();await w(150);
  document.querySelector('#sheet #dpGo').click();await w(500);return{changed:WDW.G.plan!==P0,m1:JSON.stringify(WDW.G.plan.settings.must),toast:!!document.querySelector('#toasts .toast.edu')}});
ck(!out.ed.noEditor&&out.ed.changed&&out.ed.m1!==await pg.evaluate(()=>window.__m0)&&out.ed.toast,'new plan from the editor '+JSON.stringify(out.ed));
out.edU=await undoBtn();await W(300);
out.edU2=await pg.evaluate(()=>({back:WDW.G.plan===window.__P0,m:JSON.stringify(WDW.G.plan.settings.must)===window.__m0,saved:JSON.stringify(WDW.dpLoad(WDW.G.date).must)===window.__m0}));
ck(out.edU&&/New plan/.test(out.edU)&&out.edU2.back&&out.edU2.m&&out.edU2.saved,'Undo new plan '+JSON.stringify([out.edU,out.edU2]));

// 7) no redraw while a finger is down; the forced redraw asked for meanwhile runs after it lifts; a stuck pointer can't freeze it
out.hold=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));WDW.closeSheet();WDW.pvRefresh(true);await w(100);
  const b0=document.querySelector('#pvNow .ncgo'),p0=document.querySelector('#pvIn .pvh');
  b0.dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,bubbles:true,isPrimary:true,pointerType:'touch'}));
  WDW.pvRefresh(true);WDW.G.t+=6;await w(2600);WDW.pvRefresh(true);const during={btn:b0.isConnected,page:p0.isConnected,pend:WDW.PV.pend};
  window.dispatchEvent(new PointerEvent('pointerup',{pointerId:41,bubbles:true,isPrimary:true,pointerType:'touch'}));const atUp=b0.isConnected;await w(600);
  const after={btn:b0.isConnected,page:p0.isConnected,pend:WDW.PV.pend};
  // lost pointerup: after PV_DOWN_MAX the view draws again
  const b1=document.querySelector('#pvNow .ncgo');b1.dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,bubbles:true,isPrimary:true,pointerType:'touch'}));WDW.PV.downT=performance.now()-11000;WDW.pvRefresh(true);
  const stuck=!b1.isConnected;WDW.PV.down.clear();WDW.PV.pend=false;return{during,atUp,after,stuck}});
ck(out.hold.during.btn&&out.hold.during.page&&out.hold.during.pend,'redrew while a finger was down '+JSON.stringify(out.hold));
ck(out.hold.atUp&&!out.hold.after.btn&&!out.hold.after.page&&!out.hold.after.pend,'pending redraw did not run after the finger lifted '+JSON.stringify(out.hold));
ck(out.hold.stuck,'a lost pointerup froze the view '+JSON.stringify(out.hold));

// 8) the Now card's button doesn't move when the task card appears (it slides in) or goes; the strip doesn't move a scrolled page
out.pos=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G,y=()=>{const b=document.querySelector('#pvNow .ncgo');return b?Math.round(b.getBoundingClientRect().top):null};
  G.LL.mp=null;G.LL.passes=[];WDW.pvRefresh(true);await w(200);const y0=y(),t0=!!document.querySelector('#llTask');
  G.LL.mp='MK';G.LL.tapped=true;WDW.LLT.dis={};WDW.pvRefresh(true);await w(200);const tk=document.querySelector('#llTask'),y1=y(),slide=!!tk&&tk.classList.contains('llin');
  WDW.pvRefresh(true);await w(200);const again=document.querySelector('#llTask'),slide2=!!again&&again.classList.contains('llin');
  G.LL.mp=null;WDW.pvRefresh(true);await w(200);const y2=y();
  // strip: scrolled page keeps its content still when the strip grows
  WDW.pvTab('plan');await w(250);const pv=document.getElementById('pv');pv.scrollTop=300;await w(100);const el=[...document.querySelectorAll('#pvIn .tl')].find(e=>e.getBoundingClientRect().top>200);
  const e0=el?Math.round(el.getBoundingClientRect().top):null;const sp=document.getElementById('pvStrip'),old=sp.innerHTML;sp.innerHTML='<div style="height:70px">test strip</div>';await w(200);
  const e1=el?Math.round(el.getBoundingClientRect().top):null;sp.innerHTML=old;await w(200);const e2=el?Math.round(el.getBoundingClientRect().top):null;WDW.pvTab('now');
  return{t0,y0,y1,y2,tk:!!tk,slide,slide2,e0,e1,e2}});
ck(!out.pos.t0&&out.pos.tk&&out.pos.y0!=null&&out.pos.y0===out.pos.y1&&out.pos.y1===out.pos.y2,'Now card button moved when the task card came/went '+JSON.stringify(out.pos));
ck(out.pos.slide&&!out.pos.slide2,'task card slide-in '+JSON.stringify(out.pos));
ck(out.pos.e0!=null&&Math.abs(out.pos.e1-out.pos.e0)<=1&&Math.abs(out.pos.e2-out.pos.e0)<=1,'countdown strip moved the scrolled page '+JSON.stringify(out.pos));
out.fail=fail;return out
