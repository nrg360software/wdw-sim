// Nick, Nov 24: the planner counts on only 15 min after a Lightning Lane window (the sim still lets you tap in up to 60). A pass you
// can't reach within 15 even leaving now keeps the 60 as a last resort, so the plan still tries it instead of wasting it.
await pg.waitForTimeout(4000);const fail=[],out={};const ck=(c,m)=>{if(!c)fail.push(m)};
await lib.startDay(pg,'AK','plan',660,{must:['fop','navi','ee']});
out.r=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),G=WDW.G,R=WDW.RIDE_BY;const b=document.querySelector('#speedSeg [data-s="0"]');if(b)b.click();
  G.segs=null;G.trip=null;G.tripEnd=null;G.LL.mp='AK';G.LL.tapped=true;G.node=WDW.NI[R.ee.nodeId];G.t=900;
  // fop: window still open (reachable); navi: window ended 25 min ago (can't make end+15 even leaving now)
  G.LL.passes=[{id:9701,rid:'fop',type:'sp',start:870,end:930,st:'active'},{id:9702,rid:'navi',type:'mp',start:815,end:875,st:'active'}];
  const O=WDW.dpGameOpts(G.plan.settings),gr=Object.fromEntries(O.LLs.held.map(h=>[h.rid,h.grace]));
  WDW.autoReplan([{k:'sync',text:'test'}],true);await w(150);const st=G.plan.res.steps.filter(s=>s.k==='ride').map(s=>({rid:s.rid,how:s.how,arr:Math.round(s.arr??s.q0)}));
  return{grace:O.grace,gr,st}});
const st=out.r.st,fp=st.find(s=>s.rid==='fop'),nv=st.find(s=>s.rid==='navi');
ck(out.r.grace===15&&out.r.gr.fop===15&&out.r.gr.navi===60,'per-pass grace from the game '+JSON.stringify(out.r));
ck(fp&&fp.how==='sp'&&fp.arr<=930+15,'reachable pass not planned within 15 min of its window '+JSON.stringify(st));
ck(nv&&nv.how==='ll'&&nv.arr<=875+60,'unreachable-within-15 pass wasted instead of tried '+JSON.stringify(st));
return {fail,out};
