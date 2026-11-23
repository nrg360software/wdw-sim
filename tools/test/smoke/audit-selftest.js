// the button audit itself must catch a dead button, a covered button and a button whose handler throws
await pg.waitForTimeout(4000);
await lib.startDay(pg,'MK','map',660);
// the start-of-day toasts (plan ready, no Lightning Lanes) arrive a moment later; a toast landing during the dead button's tap counted as a change
await pg.waitForTimeout(2500);await pg.waitForFunction(()=>!document.querySelector('#toasts').children.length,null,{timeout:20000}).catch(()=>{});
const r=await lib.audit(pg,'selftest',`WDW.openPlan();const sb=document.querySelector('#sheet .sb');const d=document.createElement('div');d.id='selft';d.style.position='relative';
 d.innerHTML='<button id="stOk">ok</button><button id="stDead">dead</button><button id="stCov">covered</button><button id="stThrow">throws</button><div style="position:absolute;inset:0 0 0 auto;width:30%;height:100%"></div>';
 sb.prepend(d);const cov=d.lastChild;const b=d.querySelector('#stCov');d.querySelector('#stOk').onclick=()=>{d.querySelector('#stOk').textContent='done'};
 b.onclick=()=>{b.textContent='x'};d.querySelector('#stDead').onclick=()=>{};d.querySelector('#stThrow').onclick=()=>{try{throw new Error('test boom selftest')}catch(e){window.WDW.DBG&&0;throw e}};
 const r=b.getBoundingClientRect(),c=d.getBoundingClientRect();cov.style.left=(r.left-c.left)+'px';cov.style.width=r.width+'px'`,'#selft',{});
const got=r.fail.join('\n'),fail=[];
if(!/#stDead.*did nothing/.test(got))fail.push('dead button not caught');
if(!/#stCov.*covered/.test(got))fail.push('covered button not caught');
if(/#stOk/.test(got))fail.push('working button flagged');
if(!/#stThrow.*(error|did nothing)/.test(got))fail.push('throwing button not caught');
return {got:r.fail,fail}
