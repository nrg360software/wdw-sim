await pg.waitForTimeout(8000);const out={},fail=[];const ck=(c,m)=>{if(!c)fail.push(m)};
// start-screen editor: show picker stays open across chip taps
await pg.evaluate(()=>document.querySelector('#bDayPlan').click());await pg.waitForTimeout(400);
await pg.evaluate(()=>{const d=[...document.querySelectorAll('#daysetIn details')].find(x=>/Add a show/.test(x.textContent));d.open=true});
for(let k=0;k<3;k++){await pg.evaluate(()=>{const rows=[...document.querySelectorAll('#daysetIn .shp')].filter(x=>!x.querySelector('[aria-pressed="true"]'));rows[0].querySelector('[data-sha]').click()});await pg.waitForTimeout(200)}
out.ds=await pg.evaluate(()=>({open:[...document.querySelectorAll('#daysetIn details')].find(x=>/Add a show/.test(x.textContent)).open,held:document.querySelectorAll('#daysetIn [data-shx]').length}));
ck(out.ds.open&&out.ds.held===3,'start editor picker '+JSON.stringify(out.ds));
const off=await pg.evaluate(()=>+(sessionStorage.getItem('__off')||0));
// freeze detection: a tap followed by a hang, then a fresh load in the same browser
await pg.evaluate(()=>{const b=document.querySelector('#dpCancel')||document.querySelector('#bDayPlan');b.addEventListener('click',()=>{setTimeout(()=>{const t=Date.now();while(Date.now()-t<60000){}},0)});b.click()});
await pg.waitForTimeout(1500);
// the second page runs on the same fake clock (the freeze notice only shows within a day of the hang; real time had moved on)
const pg2=await pg.context().newPage();await pg2.addInitScript(off=>{const RD=Date;class D extends RD{constructor(...a){if(a.length)super(...a);else super(RD.now()+off)}static now(){return RD.now()+off}}window.Date=D},off);await pg2.goto('https://wdw.test/');await pg2.waitForFunction(()=>window.WDW&&window.WDW.scene,null,{timeout:120000});await pg2.waitForTimeout(500);
out.prev=await pg2.evaluate(()=>{const e=document.querySelector('#dbgPrev');return e.hidden?null:e.textContent});ck(out.prev&&/Cancel|Plan my day/.test(out.prev),'freeze notice missing');
out.fail=fail;return out
