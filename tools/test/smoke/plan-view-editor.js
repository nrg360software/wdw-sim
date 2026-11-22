// regression: plan-only view, real-time day, in-game editor: show picker stays open, ‹ / × / Make plan respond, debug info works
await pg.waitForTimeout(6000);
await pg.evaluate(()=>{localStorage.setItem('wdwsim.view','plan');localStorage.setItem('wdwsim.auto','0');const d=WDW.orlandoNow().date;
 localStorage.setItem('wdwsim.ll.'+d,JSON.stringify({mp:'EP',picks:[{rid:'remy',start:810},{rid:'soar',start:840},{rid:'sse',start:870}],sp:[{rid:'gotg',start:930}],prem:null}));
 WDW.dpSave(d,{pk:'EP',must:['gotg','tt','remy','fea','soar','lwtl','sse','fig','seas'],ll:'mine',lunch:true,extras:true,pace:'bal'})});
await pg.reload();await pg.waitForFunction(()=>window.WDW&&window.WDW.scene,null,{timeout:120000});await pg.waitForTimeout(6000);
await pg.evaluate(()=>{const s=document.querySelector('#selHotel');s.value='sd';s.dispatchEvent(new Event('change'));document.querySelector('#segTime [data-now="1"]').click()});
await pg.waitForTimeout(300);await pg.evaluate(()=>document.querySelector('#bPlay').click());
await pg.waitForFunction(()=>WDW.G.started&&WDW.G.plan,null,{timeout:60000});await pg.waitForTimeout(2500);
const out={},fail=[];const ck=(c,m)=>{if(!c)fail.push(m)};
const hit=sel=>pg.evaluate(sel=>{const b=document.querySelector(sel);if(!b)return 'missing';b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e===b||b.contains(e)?'ok':'covered by '+(e&&(e.id||e.className||e.tagName))},sel);
const openEd=async()=>{await pg.evaluate(()=>document.querySelector('#pvIn #dpEdit').click());await pg.waitForTimeout(500)};
// 2. buttons are on top and respond
await openEd();
for(const sel of ['#sheet [data-back]','#sheet .x[aria-label="Close"]','#dpGo']){out[sel]=await hit(sel);ck(out[sel]==='ok',sel+' '+out[sel])}
await pg.evaluate(()=>document.querySelector('#sheet [data-must="msp"]').click());await pg.waitForTimeout(200);
await pg.evaluate(()=>document.querySelector('#sheet [data-back]').click());await pg.waitForTimeout(300);ck(await pg.evaluate(()=>document.querySelector('#sheet').hidden),'‹ did not close the editor');
await openEd();await pg.evaluate(()=>document.querySelector('#sheet .x[aria-label="Close"]').click());await pg.waitForTimeout(300);ck(await pg.evaluate(()=>document.querySelector('#sheet').hidden),'× did not close the editor');
// 1. show picker: open details, tap 3 shows' times
await openEd();
await pg.evaluate(()=>{const d=[...document.querySelectorAll('#sheet details')].find(x=>/Add a show/.test(x.textContent));d.open=true});
for(let k=0;k<3;k++){const r=await pg.evaluate(k=>{const rows=[...document.querySelectorAll('#sheet .shp')].filter(x=>!x.querySelector('[aria-pressed="true"]'));const c=rows[k===0?0:0]&&rows[0].querySelector('[data-sha]');if(!c)return 'no chip';const y0=document.querySelector('#sheet .sb').scrollTop;c.click();return y0},k);await pg.waitForTimeout(250);
  const st=await pg.evaluate(()=>({open:[...document.querySelectorAll('#sheet details')].find(x=>/Add a show/.test(x.textContent)).open,held:document.querySelectorAll('#sheet [data-shx]').length,y:document.querySelector('#sheet .sb').scrollTop}));out['pick'+k]=[r,st];ck(st.open,'picker closed after chip '+k);ck(st.held===k+1,'held count '+st.held+' after chip '+k);ck(typeof r!=='number'||Math.abs(st.y-r)<40,'scroll jumped '+r+'→'+st.y)}
await pg.evaluate(()=>document.querySelector('#dpGo').click());await pg.waitForTimeout(800);ck(await pg.evaluate(()=>document.querySelector('#sheet').hidden),'Make plan did not close the editor');
out.held=await pg.evaluate(()=>(WDW.G.plan.settings.blocks||[]).filter(b=>b.user).map(b=>b.name+'@'+b.at));ck(out.held.length===3,'plan holds '+out.held.length+' shows');
// 3. a throwing show binder must not kill ‹ / Make plan
await openEd();
// 4. debug info
await pg.evaluate(()=>{setTimeout(()=>{throw new Error('test boom')},0)});await pg.waitForTimeout(300);
out.errBox=await pg.evaluate(()=>{const b=document.querySelector('#errBox');return b&&!b.hidden?b.textContent:null});ck(out.errBox&&/test boom/.test(out.errBox),'error box missing');
out.dbgBtn=await pg.evaluate(()=>{document.querySelector('#errBox [data-dbgx]').click();document.querySelector('#sheet .x[aria-label="Close"]').click();const b=document.querySelector('#pvIn [data-dbgcopy]');b.click();return new Promise(r=>setTimeout(()=>{const t=document.querySelector('#dbgTxt textarea');r(t?'textarea':b.textContent)},400))});
out.dbg=await pg.evaluate(()=>WDW.dbgText());
ck(/test boom/.test(out.dbg)&&/Last taps/.test(out.dbg),'debug text incomplete');
out.fail=fail;return out
