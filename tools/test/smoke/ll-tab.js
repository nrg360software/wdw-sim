// Lightning Lanes tab (Nick, Nov 25: "a Lightning Lanes tab where I can see all the booked, used and missed passes").
// Dock: Now · Plan · ⚡ LL · Waits · ⋯. Sections Booked (held + Multiple Experience, with window state and planned time), Used
// (tap-in time; MEP: which ride), Missed (expired, or an active pass past the tap-in limit). Cancelled listed small. Rows and the
// bottom button open the Lightning Lane panel (book, change, swap, cancel). The Now card and task card aren't drawn over it.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};const W=ms=>pg.waitForTimeout(ms);
await lib.startDay(pg,'MK','plan',660);
await pg.evaluate(()=>{const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();WDW.setView('plan')});await W(300);
await pg.evaluate(()=>{const G=WDW.G,t=Math.round(G.t),L=G.LL;L.mp='MK';L.tapped=true;
  const P=(rid,start,st,x)=>Object.assign({id:L.nid++,rid,type:'mp',start,end:start+60,st},x||{});
  L.passes=[P('btm',t+90,'active'),P('pp',t-20,'active'),P('space',t-60,'mep',{mepAt:t-50,mepOpts:['hm']}),
    P('sdmt',t-200,'used',{usedAt:t-170}),P('jc',t-150,'mepused',{usedAt:t-120,usedOn:'hm'}),P('dumbo',t-300,'expired'),
    P('tron',t-200,'active',{type:'sp'}),P('pooh',t-100,'cancelled')]});
// the late Single Pass (window ended 140 min ago, still 'active') is missed: past the 60-min tap-in limit
await pg.evaluate(async()=>{document.getElementById('bLL').click();await new Promise(r=>setTimeout(r,300))});
out.tab=await pg.evaluate(()=>{const el=document.getElementById('pvIn'),sec=[...el.querySelectorAll('.llsec')].map(s=>s.textContent.replace(/\s+/g,' ').trim());
  const rows=c=>[...el.querySelectorAll('.lltr'+(c?'.'+c:':not(.used):not(.miss)'))].map(r=>r.innerText.replace(/\s+/g,' '));
  const sel=document.querySelector('#bLL').getAttribute('aria-selected');const n=document.getElementById('pvNow');
  return{sec,book:rows(''),used:rows('used'),miss:rows('miss'),canc:/Cancelled: Pooh/.test(el.innerText),sel,sum:(el.querySelector('.llsum')||{}).innerText,nowCard:!!n.querySelector('.ncgo,#llTask'),txt:el.innerText.slice(0,200)}});
const T=out.tab;
ck(T.sel==='true','LL tab not selected '+T.sel);ck(!T.nowCard,'Now card drawn over the LL tab');
ck(JSON.stringify(T.sec)===JSON.stringify(['Booked 3','Used 2','Missed 2']),'sections '+JSON.stringify(T.sec));
ck(T.book.length===3&&/Big Thunder.*opens in 1h 30m.*planned \d+:\d\d|Big Thunder.*opens in 1h 30m/.test(T.book.join('|'))&&/Peter Pan.*open now · ends in 40m/.test(T.book.join('|'))&&/Space Mountain.*Multiple Experience.*went down/.test(T.book.join('|')),'booked rows '+JSON.stringify(T.book));
ck(/Seven Dwarfs.*tapped in \d+:\d\d/.test(T.used.join('|'))&&/Multiple Experience.*used on Mansion at \d+:\d\d/.test(T.used.join('|')),'used rows '+JSON.stringify(T.used));
ck(/Dumbo.*window passed · not used/.test(T.miss.join('|'))&&/TRON.*Single Pass.*too late to tap in/.test(T.miss.join('|')),'missed rows '+JSON.stringify(T.miss));
ck(T.canc&&/Multi Pass · MK.*holding 2 of 3/.test(T.sum),'summary / cancelled '+JSON.stringify([T.sum,T.canc]));
// a row opens the Lightning Lane panel; so does the bottom button
out.open=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),o={};document.querySelector('#pvIn .lltr').click();await w(250);o.row=!document.getElementById('sheet').hidden&&!!document.querySelector('#sheet .llp');
  WDW.closeSheet();document.getElementById('bLL').click();await w(250);document.querySelector('#pvIn .pvmore[data-pvll]').click();await w(250);o.btn=!document.getElementById('sheet').hidden&&!!document.querySelector('#sheet .llp');WDW.closeSheet();return o});
ck(out.open.row&&out.open.btn,'LL panel did not open '+JSON.stringify(out.open));
// using a pass moves it Booked → Used on the next draw
out.after=await pg.evaluate(async()=>{const p=WDW.G.LL.passes.find(p=>p.rid==='pp');p.st='used';p.usedAt=Math.round(WDW.G.t);document.getElementById('bLL').click();await new Promise(r=>setTimeout(r,250));
  return[...document.querySelectorAll('#pvIn .llsec')].map(s=>s.textContent.replace(/\s+/g,' ').trim())});
ck(JSON.stringify(out.after)===JSON.stringify(['Booked 2','Used 3','Missed 2']),'after a tap-in '+JSON.stringify(out.after));
out.fail=fail;return out
