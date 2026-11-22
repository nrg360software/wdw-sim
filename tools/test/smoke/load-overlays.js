// every park loads; the start-screen overlays open and close; a map-view 11 AM day starts and its sheets open
await pg.waitForTimeout(6000);const out={},fail=[];const ck=(c,m)=>{if(!c)fail.push(m)};
for(const [btn,ov,close] of [['#bDayPlan','#daysetup','#dpCancel'],['#bLLPlan','#llsetup','#llDone'],['#bPush','#pushview','#puClose']]){
  const r=await pg.evaluate(([btn,ov,close])=>{const b=document.querySelector(btn);if(!b)return btn+' missing';b.click();const o=document.querySelector(ov);if(!o||o.hidden)return ov+' did not open';const c=document.querySelector(close);if(!c)return close+' missing';c.click();return o.hidden?'ok':ov+' did not close'},[btn,ov,close]);
  ck(r==='ok',r);await pg.waitForTimeout(200)}
await pg.evaluate(()=>{localStorage.setItem('wdwsim.auto','0');WDW.dpSave(WDW.orlandoNow().date,{pk:'MK',must:['tron','sdmt','pp','space','btm','hm'],ll:'none',lunch:true,extras:true,pace:'bal'})});
await pg.evaluate(()=>{document.querySelector('#segTime [data-v="660"]').click()});await pg.waitForTimeout(200);
await pg.evaluate(()=>document.querySelector('#bPlay').click());await pg.waitForFunction(()=>WDW.G.started&&WDW.G.plan,null,{timeout:60000});await pg.waitForTimeout(1500);
for(const fn of ['openPlan','openRides','openPicks','openLL','openWhere']){const r=await pg.evaluate(fn=>{try{WDW[fn]();const sh=document.querySelector('#sheet');const ok=!sh.hidden&&sh.querySelector('.sh h2');const x=sh.querySelector('.x[aria-label="Close"]')||sh.querySelector('.x');if(x)x.click();return ok?(sh.hidden?'ok':'x did not close'):'no sheet'}catch(e){return e.message}},fn);ck(r==='ok',fn+': '+r);out[fn]=r}
const r=await pg.evaluate(()=>{WDW.openShows('MK');const sh=document.querySelector('#sheet');return !sh.hidden&&!!sh.querySelector('#shSheet')});ck(r,'openShows');
out.fail=fail;return out
