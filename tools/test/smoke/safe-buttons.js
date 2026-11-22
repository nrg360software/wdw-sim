// safer buttons (row 67): one failing button can't take down a panel.
// (1) a button missing from the Plan panel (as if its HTML failed) must not leave the other buttons dead (before bindAll, the
//     first missing button threw and nothing after it was bound); (2) a handler that throws reports to the error box and the
//     rest still work; (3) a bad selector doesn't stop the others.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await lib.startDay(pg,'MK','map',660);
await pg.evaluate(()=>{const qs=Element.prototype.querySelector,qa=Element.prototype.querySelectorAll;window.__hide='#dpPush';
 Element.prototype.querySelector=function(s){if(s===window.__hide)return null;return qs.call(this,s)};
 Element.prototype.querySelectorAll=function(s){const r=qa.call(this,s);if(s!==window.__hide)return r;const f=document.createDocumentFragment();return f.querySelectorAll('x')}});
for(const view of ['map','plan']){
  const r=await lib.audit(pg,'plan without #dpPush ('+view+')',`WDW.setView('${view}');`+(view==='map'?'WDW.openPlan()':"document.getElementById('pv').scrollTop=0"),view==='map'?'#sheet':'#pv',{skip:'dpPush'});
  out[view]=r.tapped;fail.push(...r.fail);
  for(const id of ['#dpRe','#dpEdit','#dpClr','#dpAuto'])ck(r.res.some(x=>x.k.startsWith(id)&&x.ch&&x.ch!=='NOTHING'),view+': '+id+' dead when another button is missing')}
await pg.evaluate(()=>{window.__hide='#none'});
// (2) throwing handler
out.thr=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));window.__aud.reset();WDW.setView('map');WDW.openPlan();const root=document.getElementById('sheetIn');
 WDW.bindAll(root,{':::bad selector':()=>{},'#dpAuto':()=>{throw new Error('test boom bindAll')},'#dpRe':b=>{b.dataset.hit='1'}});
 const n0=WDW.DBG.n;root.querySelector('#dpAuto').click();await w(100);const box=document.getElementById('errBox');
 const a=WDW.DBG.n>n0&&box&&!box.hidden&&/test boom bindAll/.test(box.textContent);root.querySelector('#dpRe').click();const b=root.querySelector('#dpRe').dataset.hit==='1';
 root.querySelector('#dpEdit').click();await w(150);const c=!!document.querySelector('#sheet #dpGo');return {reported:a,others:b,edit:c,errs:WDW.DBG.err.slice(-3).map(e=>e.m)}});
ck(out.thr.reported,'throwing handler not reported');ck(out.thr.others,'bad selector / throwing handler stopped the next binding');ck(out.thr.edit,'Change must-dos dead after another handler threw');
out.fail=fail;return out
