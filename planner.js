// WDW Sim day planner (roadmap row 67): the pure full-day route search, moved out of index.html so it can be tested on its own.
// index.html imports it and calls plannerInit(env) once at startup; env exposes the game data and helpers the planner reads
// (live bindings through getters). Node tests build a small fake env: tools/test/planner.test.mjs.
// Needs from env: DPW, DPX, G, LL_EARLY, LL_WIN, NI, NODES, PARKS, RIDES, RIDE_BY, WALK_PARK, accessOpen, busy, dijkstra, dpPaceOf, fmtClock, fmtDur, llFresh, llNext, parkOpen, parkOpenPublic, rawWait, showDij.
let E=null;
export function plannerInit(env){E=env}
// ================= DAY PLANNER (full-day route) =================
// Orders a list of must-do rides in one park by beam search. Each step is rope drop, standby, or a
// Lightning Lane entitlement (Multi Pass booking, Single Pass, Premier, Multiple Experience Pass).
// After each tap-in (and at the start) open Multi Pass slots are filled greedily with the remaining
// must-do that saves the most minutes, following the same rules as llCanBook. Travel inside the park
// comes from a walking matrix scaled by crowds; the first leg uses the real route from where you are.
// Optional lunch break (45 min, first gap after 11:45) and extra rides to fill free time after.
const DP_KEY='wdwsim.day.',DP_LLQ=7,DP_LUNCH=45,DP_GRACE=30,DP_LATE_PEN=45,DP_WASTE=60,DP_IDLE_PEN=30;
// Pacing (roadmap row 57). Fastest = old scoring (most must-dos, then earliest finish). Balanced/Relaxed add a comfort cost in
// minutes: standing in standby/rope-drop lines ≥ DP_LONG min builds a "stretch"; a short line or Lightning Lane eases it by 30,
// a meal/show/break resets it. Minutes past cap cost w each. A favourite must-do (biggest headliner) in line during the evening
// earns a bonus, and if the must-dos would all be done before the evening, dpSaveFav holds it back for the evening (free-time ideas
// fill the gap) when its evening wait is at most `slack` min worse. A short break (rest) comes before another long line once the stretch
// reaches rf × cap.
// Comfort never beats must-dos: dpRun falls back to Fastest if pacing would fit fewer.
const DP_LONG=20,DP_PACE={fast:null,bal:{cap:60,w:1,bonus:20,rest:10,rf:1,slack:10},relax:{cap:45,w:1.5,bonus:35,rest:15,rf:0.8,slack:25}};
const DP_PACE_NAME={fast:'Fastest',bal:'Balanced',relax:'Relaxed'};
// Same-day setup shared by the start screen, the planners and startDay
// walking minutes between every pair of rides in a park (no crowd factor)
const DP_TM={};
function dpMatrix(pk){if(DP_TM[pk])return DP_TM[pk];
  const ids=[];E.NODES.forEach((n,i)=>{if(n.park===pk||n.outside===pk)ids.push(i)});const loc={};ids.forEach((g,k)=>loc[g]=k);const n=ids.length,M={};
  for(const r of E.RIDES){if(r.pk!==pk)continue;const dist=new Float64Array(n).fill(Infinity),done=new Uint8Array(n);dist[loc[E.NI[r.nodeId]]]=0;
    for(;;){let u=-1,b=Infinity;for(let i=0;i<n;i++)if(!done[i]&&dist[i]<b){b=dist[i];u=i}if(u<0)break;done[u]=1;
      for(const e of E.NODES[ids[u]].adj){if(e.type!=='walk'||!e.inPark)continue;const v=loc[e.to];if(v==null)continue;const c=b+e.d/E.WALK_PARK+(e.entry||0);if(c<dist[v])dist[v]=c}}
    M[r.id]={};for(const q of E.RIDES)if(q.pk===pk)M[r.id][q.id]=dist[loc[E.NI[q.nodeId]]]}
  return DP_TM[pk]=M}
function dpWait(r,t){const b=Math.round(t/5),k=r.id+':'+b;let w=E.DPW[k];if(w==null){w=E.rawWait(r,b*5);if(E.DPX)w=E.DPX.wait(r,b*5,w);E.DPW[k]=w}return w}
function dpParkEnd(pk){const P=E.PARKS[pk];return Math.max(P.close*60,P.eeh&&E.G.deluxe?P.eeh.to*60:0)}
function dpLLFrom(L){return{mp:L.mp,prem:L.premier,tapped:!!L.tapped,
  held:L.passes.filter(p=>p.st==='active').map(p=>({rid:p.rid,start:p.start,end:p.end,type:p.type,pre:!!p.pre})),
  booked:Object.fromEntries(L.passes.filter(p=>p.st!=='cancelled').map(p=>[p.rid,1])),premUsed:Object.assign({},L.premUsed),
  mep:L.passes.filter(p=>p.st==='mep').map(p=>p.mepOpts.slice())}}
function dpCtx(o){const pk=o.pk,M=dpMatrix(pk),park=E.RIDES.filter(r=>r.pk===pk),bit={};park.forEach((r,i)=>bit[r.id]=1<<i);
  const must0=o.must.filter(id=>E.RIDE_BY[id]&&E.RIDE_BY[id].pk===pk);
  // Lightning Lanes you already hold for rides that aren't must-dos get planned too (only with the pass), so a pass is never left unused
  const passOnly={};{const L0=o.LLs||(o.L?dpLLFrom(o.L):null);for(const p of (L0&&L0.held)||[]){const r=E.RIDE_BY[p.rid];if(r&&r.pk===pk&&!must0.includes(p.rid)&&!(o.done||[]).includes(p.rid))passOnly[p.rid]=1}}
  const ctx={pk,M,bit,park,must:must0.concat(Object.keys(passOnly)),passOnly,keep:!!o.keep,lunch:!!o.lunch,lunchDone:!!o.lunchDone,tp:o.tp||{},blkAfter:{},extras:!!o.extras,t0:o.t,end:o.until!=null?Math.min(dpParkEnd(pk),o.until):dpParkEnd(pk),until:o.until!=null&&o.until<dpParkEnd(pk)?o.until:null,later:o.later||null,startD:{},book:(o.book||[]).map(k=>typeof k==='string'?{rid:k}:k).filter(k=>E.RIDE_BY[k.rid]&&E.RIDE_BY[k.rid].pk===pk),bookLater:(o.book||[]).map(k=>typeof k==='string'?{rid:k}:k).filter(k=>E.RIDE_BY[k.rid]&&E.RIDE_BY[k.rid].pk!==pk),walkK:o.cal?o.cal.walk:1,llAdj:o.cal?o.cal.ll:null,grace:o.grace||DP_GRACE,dur:o.cal&&o.cal.dur||null,pw:o.cal&&o.cal.pw||null};
  ctx.timed=[];for(const b of o.blocks||[]){if((b.user&&b.at!=null)||(!o.keep&&b.meal&&b.at)){ctx.timed.push(b);continue}const k=b.after&&!(o.done||[]).includes(b.after)?b.after:'_start';(ctx.blkAfter[k]=ctx.blkAfter[k]||[]).push(b)}
  ctx.sd=ctx.timed.map(b=>{if(!b.user||!b.node||E.NI[b.node]==null)return null;const D=E.showDij(E.NI[b.node]),d={};for(const r of E.RIDES)if(r.pk===pk)d[r.id]=D.dist[E.NI[r.nodeId]];return{D,d,d0:o.node!=null?D.dist[o.node]:null}}); // held shows (row 54): walk from any ride / the start
  const D=E.dijkstra(o.node,o.t/60);park.forEach(r=>ctx.startD[r.id]=D.dist[E.NI[r.nodeId]]);
  // lowest standby from each 15-min bucket to close (for the search heuristic)
  ctx.b0=Math.floor(o.t/15);const nb=Math.max(1,Math.ceil(ctx.end/15)-ctx.b0+1);ctx.suf={};
  for(const r of park){const a=new Array(nb).fill(99);let m=99;for(let i=nb-1;i>=0;i--){const t=(ctx.b0+i)*15;if(t>=E.accessOpen(pk)&&E.parkOpen(pk,t))m=Math.min(m,dpWait(r,t));else if(t<E.accessOpen(pk))m=Math.min(m,dpWait(r,E.accessOpen(pk)));a[i]=m}ctx.suf[r.id]=a}
  // last minute you can still join a standby line ("in line by close")
  ctx.lj=null;for(let t=Math.ceil(ctx.end);t>=Math.floor(o.t);t--)if(E.parkOpen(pk,t)){ctx.lj=t+1;break}
  if(ctx.until!=null&&ctx.lj!=null)ctx.lj=Math.min(ctx.lj,ctx.until);
  // pacing: preset, evening start, favourite must-do to save for the evening
  ctx.paceK=o.keep?'fast':E.dpPaceOf(o);ctx.pace=DP_PACE[ctx.paceK];ctx.eve=Math.max(16*60,(ctx.lj||ctx.end)-150);ctx.fav=null;
  if(ctx.pace&&o.t<ctx.eve-30&&ctx.eve<ctx.end-30){let bv=0;for(const id of ctx.must){const r=E.RIDE_BY[id];if(r.kind==='show'||(o.done||[]).includes(id))continue;const v=r.avg*(r.thrill+4);if(v>bv){bv=v;ctx.fav=id}}}
  return ctx}
function dpRoot(ctx,o,ll){ll=Object.assign({},ll);let done=0;for(const id of o.done||[])if(ctx.bit[id])done|=ctx.bit[id];
  const S={t:o.t,at:null,done,ll,lunch:ctx.lunchDone||!ctx.lunch,n:0,par:null,step:null,str:0,pen:0};
  const books=dpBook(ctx,S,o.t,dpRem(ctx,S));const bl=dpBlocks(ctx,'_start',o.t);S.t=bl.t;S.nw=bl.next;S.tb=0;if(bl.blocks.some(b=>b.meal))S.lunch=true;if(ctx.timed.length){if(ctx.timed.some(b=>b.meal))S.lunch=true;dpTimed(ctx,S,bl.blocks,false)}S.step={k:'start',t:o.t,books,blocks:bl.blocks};return S}
// fixed-time blocks attached after a ride: walk there, wait for a reservation time if any, then the block
// timed dining in free order: take it once the reservation is within 25 min (or when forced at the end)
// held shows (row 54, b.user): taken once you'd arrive within 20 min of the time to get there (show time - pre); arriving after
// the start + 5 min = missed (costs 150 so the search keeps the time free); late arrival costs 2/min. Walk from where you are.
function dpShowWalk(ctx,N,i){const b=ctx.timed[i],sd=ctx.sd&&ctx.sd[i],k=(1+0.4*E.busy(N.t/60))*ctx.walkK;
  if(sd){let w=null;if(N.sw!=null&&ctx.sd[N.sw])w=ctx.sd[N.sw].D.dist[E.NI[b.node]];else if(N.at!=null)w=sd.d[N.at];else w=sd.d0;if(w!=null&&isFinite(w))return (w+(b.extra||0))*k}
  return b.walk||10}
function dpTimed(ctx,N,blocks,force,only){for(let i=0;i<ctx.timed.length;i++){const b=ctx.timed[i];if(N.tb&(1<<i)||(only!=null&&i!==only))continue;
    if(b.user){const w=dpShowWalk(ctx,N,i),a=N.t+w,go=b.at-(b.pre||0);if(!force&&a<go-20)continue;N.tb=(N.tb||0)|(1<<i);
      if(a>b.at+5){blocks.push({id:b.id,name:b.name,meal:false,at:b.at,walk:Math.round(w),dur:0,start:a,end:a,show:true,user:1,meet:b.meet,node:b.node,missed:true});N.ms=(N.ms||0)+1;N.pen=(N.pen||0)+150;continue}
      const st=Math.max(a,go),late=Math.max(0,Math.round(a-go));blocks.push({id:b.id,name:b.name,meal:false,at:b.at,walk:Math.round(w),dur:Math.round(b.at+b.show-st),start:st,end:b.at+b.show,show:true,user:1,meet:b.meet,node:b.node,late});
      N.t=b.at+b.show;N.nw=null;N.sw=i;if(late)N.pen=(N.pen||0)+2*late;continue}
    const a=N.t+(b.walk||0);
    if(!force&&a<b.at-25)continue;const st=Math.max(a,b.at-15);blocks.push({id:b.id,name:b.name,meal:true,at:b.at,walk:b.walk||0,dur:b.dur,start:st,end:st+b.dur,tp:b.tp,late:Math.max(0,Math.round(a-b.at))});
    N.t=st+b.dur;N.tb=(N.tb||0)|(1<<i);N.nw=null;N.sw=null;N.lunch=true}}
// shows with showtimes: the first showtime reachable at least min(pre,10) min early; none left = missed
function dpBlocks(ctx,key,t){const out=[];let next=null;for(const b of ctx.blkAfter[key]||[]){const a=t+(b.walk||0);next=b.walkNext!=null?b.walkNext:null;
    if(b.times&&b.times.length){const T=b.times.find(x=>x-a>=Math.min(b.pre||0,10));
      if(T==null){out.push({id:b.id,name:b.name,meal:false,at:null,walk:b.walk||0,dur:0,start:a,end:a,tp:b.tp,missed:true,show:true});continue}
      const st=Math.max(a,T-(b.pre||0));out.push({id:b.id,name:b.name,meal:false,at:T,walk:b.walk||0,dur:T+b.show-st,start:st,end:T+b.show,tp:b.tp,show:true});t=T+b.show;continue}
    const st=Math.max(a,b.at?b.at-(b.meal?15:0):0);out.push({id:b.id,name:b.name,meal:!!b.meal,at:b.at||null,walk:b.walk||0,dur:b.dur,start:st,end:st+b.dur,tp:b.tp,late:b.at&&b.meal?Math.max(0,Math.round(a-b.at)):0});t=st+b.dur}return{t,blocks:out,next:out.length?next:null}}
const dpRem=(ctx,S)=>ctx.must.filter(id=>!(S.done&ctx.bit[id]));
function dpTravel(ctx,S,r){if(S.nw!=null)return S.nw;if(S.sw!=null&&ctx.sd&&ctx.sd[S.sw]){const w=ctx.sd[S.sw].d[r.id];if(w!=null&&isFinite(w))return (w+(ctx.timed[S.sw].extra||0))*(1+0.4*E.busy(S.t/60))*ctx.walkK}if(S.at!=null&&ctx.pw){const w=ctx.pw[S.at+'>'+r.id];if(w!=null)return w}return S.at==null?ctx.startD[r.id]:ctx.M[S.at][r.id]*(1+0.4*E.busy(S.t/60))*ctx.walkK}
// fill free Multi Pass slots with the candidate that saves the most minutes (≥ 10)
// an imported plan's own in-day bookings (ctx.book) are made in its order instead, at the earliest return
// (no earlier than the plan's own return time, shifted by how late the booking is; stress tests add calibration and return-time luck)
function dpRet(ctx,r,t,k){const sh=ctx.llAdj&&ctx.llAdj[r.id]||0;let ret=E.llNext(r,t+sh);if(ret==null)return null;
  if(E.DPX)ret+=E.DPX.ll(r);ret=Math.max(Math.ceil(t/5)*5,Math.round(ret/5)*5);if(k&&k.ret!=null)ret=Math.max(ret,k.ret+Math.max(0,t-(k.at!=null?k.at:t)));
  return ret>E.PARKS[r.pk].close*60-E.LL_WIN?null:ret}
function dpBook(ctx,S,t,pool){const L=S.ll,out=[];if(!L.mp)return out;let ord=ctx.book.length?ctx.book.filter(k=>pool.includes(k.rid)):null;
  // a rigid follow (live confidence) also replays the plan's bookings for the next park once tapped in
  if(ord&&ctx.later&&L.tapped&&ctx.bookLater.length)ord=ord.concat(ctx.bookLater.filter(k=>ctx.later.ids.includes(k.rid)));
  for(let g=0;g<3;g++){const held=L.held.filter(p=>p.type==='mp');if(held.length>=3)break;let best=null,bs=ord?-1e9:9;
    for(const k of ord||(ctx.later&&L.tapped?pool.concat(ctx.later.ids):pool)){if(ord&&best)break;const id=ord?k.rid:k;const r=E.RIDE_BY[id];if(r.llType!=='mp'||L.booked[id]||(L.prem===r.pk&&!L.premUsed[id]))continue;
      if(!L.tapped){if(r.pk!==L.mp)continue;if(r.tier===1&&held.some(p=>E.RIDE_BY[p.rid].tier===1))continue}
      const ret=dpRet(ctx,r,t,ord?k:null);if(ret==null||(r.pk!==ctx.pk&&ctx.later&&ret<ctx.later.from)||(r.pk===ctx.pk&&ctx.until!=null&&ret>ctx.until-20))continue;const save=dpWait(r,Math.min(ret+30,E.PARKS[r.pk].close*60-1))-DP_LLQ;if(save>bs){bs=save;best={r,ret}}}
    if(!best)break;L.held=L.held.concat([{rid:best.r.id,start:best.ret,end:best.ret+E.LL_WIN,type:'mp'}]);L.booked=Object.assign({},L.booked,{[best.r.id]:1});out.push({rid:best.r.id,ret:best.ret,at:t})}
  return out}
// a ride that would make you miss a held show (row 54): also try going to the show first (from S, if you can still make it), then the ride
function dpExpand(ctx,S,r,useLL,pool){const N=dpExpand0(ctx,S,r,useLL,pool);if(!N||!ctx.sd||(N.ms||0)<=(S.ms||0))return N;
  let S2=null;for(let i=0;i<ctx.timed.length;i++){const b=ctx.timed[i];if(!b.user||(S.tb||0)&(1<<i)||!((N.tb||0)&(1<<i)))continue;if(S.t+dpShowWalk(ctx,S,i)>b.at+5)continue;
    if(!S2)S2=Object.assign({},S,{step:Object.assign({},S.step,{blocks:(S.step&&S.step.blocks||[]).slice()})});dpTimed(ctx,S2,S2.step.blocks,true,i)}
  if(!S2)return N;const N2=dpExpand0(ctx,S2,r,useLL,pool);return N2&&(N2.ms||0)<(N.ms||0)?N2:N}
function dpExpand0(ctx,S,r,useLL,pool){
  if(S.done&ctx.bit[r.id])return null;const P=ctx.pace,str0=S.str||0;let rest=0;
  if(P&&P.rest&&!useLL&&str0>=P.cap*P.rf){const a0=S.t+dpTravel(ctx,S,r);if(isFinite(a0)&&a0>=E.accessOpen(r.pk)&&dpWait(r,a0+P.rest)>=DP_LONG)rest=P.rest}
  const arr=S.t+rest+dpTravel(ctx,S,r);if(!isFinite(arr))return null;
  const ll=Object.assign({},S.ll);let how,q0=arr,wait,tap=null,wasted=[],idle=0;
  if(useLL){if(!r.ll)return null;const p=ll.held.find(p=>p.rid===r.id);
    if(p){if(arr>p.end+ctx.grace)return null;how=p.type==='sp'?'sp':'ll';q0=Math.max(arr,p.start-E.LL_EARLY);ll.held=ll.held.filter(x=>x!==p);if(p.type==='mp'&&!ll.tapped){ll.tapped=true}tap=p}
    else if(ll.prem===r.pk&&!ll.premUsed[r.id]){how='prem';const op=E.PARKS[r.pk].open*60;if(arr<op)q0=op;else if(!E.parkOpenPublic(r.pk,arr))return null;ll.premUsed=Object.assign({},ll.premUsed,{[r.id]:1})}
    else{const mi=ll.mep.findIndex(o=>o.includes(r.id));if(mi<0)return null;how='mep';if(!E.parkOpenPublic(r.pk,arr))return null;ll.mep=ll.mep.filter((_,i)=>i!==mi)}
    // arriving 20+ min before the window: allowed (it can be the only move left — e.g. AK with every other must-do done
    // and the next pass an hour away), but the idle time is costed so the plan does something else first when it can
    if(tap&&q0-arr>20&&!ctx.keep&&!ctx.passOnly[r.id])idle=q0-arr-20;wait=DP_LLQ}
  else{if(ctx.passOnly[r.id])return null;if(ll.held.some(p=>p.rid===r.id&&arr<=p.end+ctx.grace))return null;wasted=ll.held.filter(p=>p.rid===r.id);ll.held=ll.held.filter(p=>p.rid!==r.id);
    if(arr<E.accessOpen(r.pk)){q0=E.accessOpen(r.pk);how='rope'}else if(!E.parkOpen(r.pk,arr))return null;else how='standby';
    wait=dpWait(r,q0)}
  let down=0;if(E.DPX){const up=E.DPX.up(r,q0);if(up>q0){down=up-q0;wait+=down}}
  let end=q0+wait+(ctx.dur&&ctx.dur[r.id]!=null?ctx.dur[r.id]:r.dur);
  if(ctx.until!=null&&end>ctx.until)return null; // plan end / hop time: off the ride by then
  // passes whose window has passed expire (their ride stays used for the day)
  wasted=wasted.concat(ll.held.filter(p=>p.end+ctx.grace<end));ll.held=ll.held.filter(p=>p.end+ctx.grace>=end);
  // comfort cost (pacing): stretch of standing in long lines since the last break
  const stand=(how==='standby'||how==='rope')&&wait>=DP_LONG;let str=rest?0:str0;str=stand?str+wait:Math.max(0,str-30);let pen=S.pen||0;
  if(P){pen+=P.w*(Math.max(0,str-P.cap)-Math.max(0,(rest?0:str0)-P.cap))+rest*0.5;if(ctx.fav===r.id&&q0>=ctx.eve-10)pen-=P.bonus}
  // arriving after the window relies on the grace period: allowed, but costed so the plan only does it when nothing else works
  if(tap&&arr>tap.end)pen+=DP_LATE_PEN+3*(arr-tap.end);
  if(idle)pen+=DP_IDLE_PEN+idle;
  // a held pass that runs out unused costs what it would have saved, plus a flat charge (it was paid for), so the plan uses passes it holds
  for(const p of wasted){const pr=E.RIDE_BY[p.rid];pen+=DP_WASTE+Math.max(0,dpWait(pr,Math.min(p.start+30,E.PARKS[pr.pk].close*60-1))-DP_LLQ)}
  if(!ctx.passOnly[r.id])pen+=0.04*(end-ctx.t0); // tie-break: must-dos done earlier (stops a pinned pass window from making idle mornings look free)
  if(how==='standby'||how==='rope')pen+=0.03*wait; // tie-break: among orders that end at the same time (e.g. pinned by a later pass window), less time in line
  const N={t:end,at:r.id,done:S.done|ctx.bit[r.id],ll,lunch:S.lunch,n:S.n+(ctx.passOnly[r.id]?0.01:1),par:S,step:null,tb:S.tb||0,ms:S.ms||0,str,pen};
  const step={k:'ride',rid:r.id,how,leave:S.t+rest,rest,str:Math.round(str),fav:ctx.fav===r.id&&q0>=ctx.eve-10,arr,q0,wait:Math.round(wait),end,books:[],meal:null,must:ctx.must.includes(r.id)&&!ctx.passOnly[r.id],pass:!!ctx.passOnly[r.id],win:tap?tap.start:null,late:tap&&arr>tap.end?Math.round(arr-tap.end):0,tp:ctx.tp[r.id],blocks:[],down:Math.round(down)};
  const pl=pool?pool(N):dpRem(ctx,N);
  step.books=dpBook(ctx,N,tap&&tap.type==='mp'?q0:end,pl);
  const bl=dpBlocks(ctx,r.id,end);step.blocks=bl.blocks;N.t=bl.t;N.nw=bl.next;if(bl.blocks.some(b=>b.meal))N.lunch=true;if(ctx.timed.length)dpTimed(ctx,N,step.blocks,false);
  // lunch waits (until 2:30 at the latest) while a held pass window would be missed or used late because of it
  const lunchBlocks=N.t<870&&N.ll.held.some(p=>p.end<N.t+DP_LUNCH+15&&p.end+ctx.grace>N.t);
  if(!N.lunch&&N.t>=705&&N.t<=900&&!lunchBlocks){step.meal={start:N.t,end:N.t+DP_LUNCH};N.t+=DP_LUNCH;N.lunch=true;N.nw=null}
  if(step.meal||step.blocks.some(b=>!b.missed&&b.dur>=15))N.str=0;
  N.step=step;return N}
function dpH(ctx,S){let h=0;const i=Math.max(0,Math.floor(S.t/15)-ctx.b0);
  for(const id of dpRem(ctx,S)){const r=E.RIDE_BY[id],a=ctx.suf[id];let w=a[Math.min(i,a.length-1)];
    if(r.ll&&(S.ll.mp||S.ll.prem===r.pk||S.ll.held.some(p=>p.rid===id)))w=Math.min(w,DP_LLQ);h+=w+r.dur+2}
  if(ctx.fav&&!(S.done&ctx.bit[ctx.fav]))h-=ctx.pace.bonus;
  return h}
const dpCost=S=>S.t+(S.pen||0);
const dpBetter=(a,b)=>{const x=Math.round(a.n*100),y=Math.round(b.n*100);return x!==y?x>y:dpCost(a)<dpCost(b)};
function dpBeam(ctx,root,W){let beam=[root],best=root;
  for(let d=0;d<ctx.must.length;d++){const next=[];
    for(const S of beam){for(const id of dpRem(ctx,S)){const r=E.RIDE_BY[id],k=next.length;const a=dpExpand(ctx,S,r,false);if(a)next.push(a);if(r.ll){const b=dpExpand(ctx,S,r,true);if(b)next.push(b)}if(ctx.keep&&next.length>k)break}}
    if(!next.length)break;for(const S of next)S.key=dpCost(S)+dpH(ctx,S);next.sort((a,b)=>a.key-b.key);
    beam=[];const seen=new Set();
    for(const S of next){const sig=S.done+'|'+S.at+'|'+S.ll.held.map(p=>p.rid+p.start).join(',')+'|'+(S.ll.tapped?1:0)+(S.lunch?1:0)+'|'+(S.tb||0)+'|'+Math.round(S.t/5)+'|'+(ctx.pace?Math.floor((S.str||0)/25):0);if(seen.has(sig))continue;seen.add(sig);beam.push(S);if(beam.length>=W)break}
    for(const S of beam)if((!ctx.req||S.done&ctx.req)&&dpBetter(S,best))best=S}
  return best}
// after the must-dos: keep adding the best fun-per-hour ride (no repeats) until the park closes
function dpExtras(ctx,S,until,hold){const val=r=>4+r.thrill*1.6+r.base/12;const pool=N=>ctx.park.filter(r=>!(N.done&ctx.bit[r.id])).map(r=>r.id);
  for(let g=0;g<30;g++){let best=null,bs=-1;
    for(const r of ctx.park){if(S.done&ctx.bit[r.id]||r.id===hold)continue;for(const u of r.ll?[false,true]:[false]){const N=dpExpand(ctx,S,r,u,pool);if(!N||(until!=null&&N.t>until)||(N.ms||0)>(S.ms||0))continue;const sc=val(r)/(N.t-S.t+15+Math.max(0,(N.pen||0)-(S.pen||0)))*60;if(sc>bs){bs=sc;best=N}}}
    if(!best)break;best.step.extra=true;S=best}
  return S}
// Fill idle gaps inside the plan (e.g. an hour before a Lightning Lane window): try short standby rides from the state before
// the waiting step that still let you reach it by its queue time, then replay the rest of the plan from there. Kept only if
// every later must-do / pass step replays the same way and no later than before (+5 min); later extras may drop out.
function dpReplay(ctx,S,olds,pool){let cur=S;const out=[];
  for(const o of olds){const st=o.step;if(!st)return null;if(st.fav||st.free)return null;const r=E.RIDE_BY[st.rid];if(!r)return null;
    const M=dpExpand(ctx,cur,r,st.how!=='standby'&&st.how!=='rope',st.extra?pool:null);
    if(!M||M.step.how!==st.how||M.t>o.t+(st.extra?15:5)){if(st.extra)continue;return null}
    if(st.extra)M.step.extra=true;if(st.gap)M.step.gap=true;out.push(M);cur=M}
  return out}
function dpFillGaps(ctx,fin){if(!fin||!fin.par)return fin;const val=r=>4+r.thrill*1.6+r.base/12,pool=N=>ctx.park.filter(r=>!(N.done&ctx.bit[r.id])).map(r=>r.id);
  let chain=[];for(let x=fin;x;x=x.par)chain.push(x);chain.reverse();
  for(let i=1;i<chain.length;i++){const P=chain[i-1],st=chain[i].step;if(!st||st.extra||st.fav||st.free)continue;const r=E.RIDE_BY[st.rid];if(!r)continue;
    const idle=st.q0-P.t-(st.rest||0)-dpTravel(ctx,P,r);if(!(idle>=25))continue;
    const later=new Set(chain.slice(i).map(x=>x.step&&x.step.rid).filter(Boolean));let E=P;const added=[];
    for(let g=0;g<6;g++){let best=null,bs=-1;
      for(const x of ctx.park){if(E.done&ctx.bit[x.id]||later.has(x.id)||ctx.passOnly[x.id]||ctx.must.includes(x.id))continue;
        const M=dpExpand(ctx,E,x,false,()=>[]);if(!M||M.step.meal||M.t+dpTravel(ctx,M,r)>st.q0-2)continue;const sc=val(x)/(M.t-E.t+15)*60;if(sc>bs){bs=sc;best=M}}
      if(!best)break;best.step.extra=true;best.step.gap=true;E=best;added.push(best)}
    while(added.length){const rp=dpReplay(ctx,added[added.length-1],chain.slice(i),pool);
      if(rp){chain=chain.slice(0,i).concat(added,rp);i+=added.length;break}added.pop()}}
  return chain[chain.length-1]}
function dpSteps(S){const out=[];for(let x=S;x;x=x.par)if(x.step)out.push(x.step);return out.reverse()}
// Save the favourite for the evening: plan the other must-dos, fill free time until the evening (extras on), then the favourite.
function dpSaveFav(ctx,root,best,W){const fav=ctx.fav,fs=dpSteps(best).find(s=>s.rid===fav);if(!fs||fs.q0>=ctx.eve-10||ctx.keep)return null;
  const cB=Object.assign({},ctx,{must:ctx.must.filter(x=>x!==fav)}),bB=dpBeam(cB,root,W);if(bB.n<best.n-1)return null;
  const r=E.RIDE_BY[fav],tv=x=>dpTravel(ctx,x,r);let S1=ctx.extras?dpExtras(ctx,bB,ctx.eve-10,fav):bB;
  const lv=Math.max(S1.t,ctx.eve-tv(S1)),free=lv-S1.t;if(!ctx.extras&&free>120)return null;
  const S2=Object.assign({},S1,{t:lv,nw:null,str:free>=15?0:S1.str}),N=dpExpand(ctx,S2,r,false)||dpExpand(ctx,S2,r,true);if(!N)return null;
  if(N.step.how==='standby'&&N.step.wait>fs.wait+ctx.pace.slack)return null;
  N.par=S1;N.step.free=Math.round(free);N.step.leave=lv;let fin=ctx.extras?dpExtras(ctx,N):N;return{best:N,fin}}
function dpPack(ctx,S,W){let best=dpBeam(ctx,S,W);let fin=null;
  if(ctx.pace&&ctx.fav&&!ctx.req){const sv=dpSaveFav(ctx,S,best,W);if(sv){best=sv.best;fin=sv.fin}}
  if(!fin)fin=ctx.extras?dpExtras(ctx,best):best;
  if(ctx.extras&&!ctx.keep)try{fin=dpFillGaps(ctx,fin)}catch(e){}
  if(ctx.timed.length&&ctx.timed.some((b,i)=>!((fin.tb||0)&(1<<i)))&&fin.step){fin=Object.assign({},fin,{step:Object.assign({},fin.step,{blocks:(fin.step.blocks||[]).slice()})});dpTimed(ctx,fin,fin.step.blocks,true)}
  const steps=dpSteps(fin);
  const mustSteps=steps.filter(s=>s.k==='ride'&&s.must);const doneIds=new Set(mustSteps.map(s=>s.rid));
  const realMust=ctx.must.filter(id=>!ctx.passOnly[id]),usedP=new Set(steps.filter(s=>s.pass).map(s=>s.rid));
  const res={steps,nMust:realMust.length,nDone:mustSteps.length,endMust:mustSteps.length?mustSteps[mustSteps.length-1].end:ctx.t0,end:fin.t,
    missed:realMust.filter(id=>!doneIds.has(id)),ll:best.ll,pen:Math.round(best.pen||0)};
  const pm=Object.keys(ctx.passOnly).filter(id=>!usedP.has(id));if(pm.length)res.passMissed=pm;
  Object.defineProperty(res,'_best',{value:best,enumerable:false});Object.defineProperty(res,'_fin',{value:fin,enumerable:false});res.pace=dpPaceStats(ctx,steps);return res}
// how the must-dos feel: total standby, longest stretch in line without a real break, favourite saved for the evening
function dpPaceStats(ctx,steps){let str=0,longest=0,standby=0,fav=null;
  for(const s of steps){if(s.k!=='ride'||s.extra)continue;const stand=(s.how==='standby'||s.how==='rope')&&s.wait>=DP_LONG;if(s.rest)str=0;
    str=stand?str+s.wait:Math.max(0,str-30);if(s.how==='standby'||s.how==='rope')standby+=s.wait;longest=Math.max(longest,str);if(s.meal||(s.blocks||[]).some(b=>!b.missed&&b.dur>=15))str=0;
    if(s.rid===ctx.fav)fav={rid:s.rid,q0:s.q0,eve:s.q0>=ctx.eve-10}}
  const oth=steps.filter(s=>s.k==='ride'&&s.must&&s.rid!==ctx.fav);
  return{mode:ctx.paceK,standby:Math.round(standby),longest:Math.round(longest),fav,favId:ctx.fav,eve:ctx.eve,rests:steps.filter(s=>s.rest).length,othersEnd:oth.length?oth[oth.length-1].end:null}}
const dpScore=p=>p.nDone*10000-p.endMust-(p.pen||0);
// Multi Pass pre-book suggestion: the most valuable Group 1 + two Group 2 must-dos (any 3 at AK),
// tried in every order and several staggered start times; also plain day-of booking. Best plan wins.
function dpSuggest(ctx,o,base){const pk=ctx.pk,P=E.PARKS[pk],open=P.open*60,last=Math.min(P.close*60,ctx.end)-E.LL_WIN;
  const peak=r=>{let m=0;for(let h=P.open;h<P.close;h++)m=Math.max(m,dpWait(r,h*60+30));return m*(r.thrill+4)};
  const cand=ctx.must.map(id=>E.RIDE_BY[id]).filter(r=>r.llType==='mp'&&!(o.done||[]).includes(r.id)).sort((a,b)=>peak(b)-peak(a));
  let pick=pk==='AK'?cand.slice(0,3):[cand.find(r=>r.tier===1),...cand.filter(r=>r.tier===2).slice(0,2)].filter(Boolean);
  const mk=held=>{const L=Object.assign({},base,{mp:pk,tapped:false,held:base.held.filter(p=>p.type!=='mp').concat(held),booked:{}});L.held.forEach(p=>L.booked[p.rid]=1);return L};
  let best=dpPack(ctx,dpRoot(ctx,o,mk([])),18),bestPre=[];
  const perm=a=>a.length<=1?[a]:a.flatMap((x,i)=>perm(a.filter((_,j)=>j!==i)).map(p=>[x,...p]));
  for(const s0 of [open,open+30,open+60,open+90,open+150]){for(const ord of perm(pick)){
    const held=ord.map((r,i)=>({rid:r.id,start:s0+40*i,end:s0+40*i+E.LL_WIN,type:'mp',pre:true}));if(held.some(p=>p.start>last))continue;
    const res=dpPack(ctx,dpRoot(ctx,o,mk(held)),18);if(dpScore(res)>dpScore(best)){best=res;bestPre=held}}}
  const pre=bestPre.map(p=>({rid:p.rid,start:p.start}));
  const fin=dpPack(ctx,dpRoot(ctx,o,mk(bestPre)),48);Object.defineProperty(fin,'_ll',{value:mk(bestPre),enumerable:false});return Object.assign(fin,{pre})}
// o = {pk, must[], ll:'mine'|'suggest'|'none', lunch, lunchDone, extras, node, t, L (G.LL-like), done[]}
function dpRun(o){E.DPW={};const t0=performance.now();const ctx=dpCtx(o);const base=o.LLs||dpLLFrom(o.L||E.llFresh());let res,rootLL;
  if(o.ll==='none'){rootLL=Object.assign(dpLLFrom(E.llFresh()),{held:base.held.slice(),booked:Object.assign({},base.booked),mep:base.mep.slice(),tapped:base.tapped});res=dpPack(ctx,dpRoot(ctx,o,rootLL),48)}
  else if(o.ll==='suggest'){res=dpSuggest(ctx,o,base);rootLL=res._ll}
  else{rootLL=base;res=dpPack(ctx,dpRoot(ctx,o,rootLL),48)}
  // pacing: compare with Fastest on the same passes; never trade a must-do for comfort
  if(ctx.pace&&ctx.must.length){const cf=Object.assign({},ctx,{pace:null,paceK:'fast',fav:null}),fast=o.ll==='suggest'?dpSuggest(cf,o,base):dpPack(cf,dpRoot(cf,o,rootLL),48);
    const gain=(fast.pace.longest-res.pace.longest)+(fast.pace.standby-res.pace.standby)/3+(res.pace.fav&&res.pace.fav.eve?ctx.pace.bonus:0)+res.pace.rests*5;
    if(fast.nDone>res.nDone){if(fast._ll)rootLL=fast._ll;fast.paceFallback=ctx.paceK;fast.pace.mode=ctx.paceK;fast.pace.favId=ctx.fav;res=fast}
    else if(gain<=0&&fast.endMust<=res.endMust){if(fast._ll)rootLL=fast._ll;fast.pace.mode=ctx.paceK;fast.pace.favId=ctx.fav;fast.fast={nDone:fast.nDone,endMust:fast.endMust,standby:fast.pace.standby,longest:fast.pace.longest};res=fast}
    else res.fast={nDone:fast.nDone,endMust:fast.endMust,standby:fast.pace.standby,longest:fast.pace.longest,favQ0:ctx.fav?(fast.steps.find(s=>s.rid===ctx.fav)||{}).q0:null}}
  if(res.missed.length&&!o.noCmp&&!o.noWhy)try{res.why=dpWhy(ctx,o,res,rootLL)}catch(e){res.why={}}
  if(!o.noCmp&&!o.noLLCmp&&o.ll!=='none'&&ctx.must.some(id=>E.RIDE_BY[id].ll)&&(o.ll==='suggest'||base.mp||base.prem||base.held.length)){const nl=Object.assign({},ctx,{extras:false});res.noLL=dpPack(nl,dpRoot(nl,o,dpLLFrom(E.llFresh())),48)}
  res.pk=o.pk;res.mode=o.ll;res.t0=o.t;if(ctx.until!=null)res.until=ctx.until;res.ms=Math.round(performance.now()-t0);return res}
// ---- Park hopping (roadmap row 26). A day can span parks: S.legs = later parks [{pk,must,hopAt,blocks,tp,book,keep,gate,imported}],
// leg 0 is S itself. hopAt = minute to leave the previous park, or null = right after its must-dos. S.end = minute the day ends
// (off the last ride by then), or null = park close. Each leg is planned by dpRun up to its leave time; travel to the next park's gate
// comes from the resort route graph (buses, monorail, Skyliner, boats, walkways). Lightning Lane state carries over (held passes,
// tap-in), and once tapped in, open Multi Pass slots may take the next park's must-dos for returns after the planned arrival.
// Disney World rule (since Jan 2024): with a Park Hopper you can hop any time after tapping into your first park.
const DP_HOP_MAX=3;
function dpLegs(S){const out=[S];for(const l of (S&&S.legs)||[]){if(!l||!E.PARKS[l.pk])continue;if(out.length>DP_HOP_MAX)break;out.push(l)}return out}
function dpAllMust(S){return S?dpLegs(S).flatMap(l=>(l.must||[]).filter(id=>E.RIDE_BY[id]&&E.RIDE_BY[id].pk===l.pk)):[]}
function dpGateNode(l){return E.NI[l.gate||l.pk+':front']}
function dpHopTravel(node,t,l){const D=E.dijkstra(node,t/60);return D.dist[dpGateNode(l)]}
function dpLastNode(res,node){for(let i=res.steps.length-1;i>=0;i--){const s=res.steps[i];if(s.k==='ride')return E.NI[E.RIDE_BY[s.rid].nodeId]}return node}
function dpParksLabel(res){return res&&res.legs?res.legs.map(l=>E.PARKS[l.pk].short).join(' → '):E.PARKS[res.pk].short}
// the hop a ride step waits on: a hop step after the last ride before it
function dpHopBefore(steps,i){for(let j=i-1;j>=0;j--){const s=steps[j];if(s.k==='hop')return s;if(s.k==='ride')return null}return null}
function dpRunDay(o){const legs=dpLegs(o);
  if(legs.length<2)return dpRun(Object.assign({},o,{until:o.end!=null?o.end:null}));
  const t0=performance.now();let node=o.node,t=o.t,LLs=o.LLs||dpLLFrom(o.L||E.llFresh()),lunchDone=!!o.lunchDone;const parts=[],hops=[];
  for(let i=0;i<legs.length;i++){const l=legs[i],nx=legs[i+1],last=!nx;
    const until=!last&&nx.hopAt!=null?(o.end!=null?Math.min(nx.hopAt,o.end):nx.hopAt):(o.end!=null?o.end:null);
    const lo=Object.assign({},o,{pk:l.pk,must:(l.must||[]).filter(id=>E.RIDE_BY[id]&&E.RIDE_BY[id].pk===l.pk&&!(o.done||[]).includes(id)),blocks:i?(l.blocks||[]):(o.blocks||[]),tp:l.tp||{},book:l.book||null,keep:!!l.keep,
      node,t,LLs,L:null,lunchDone,until,ll:i&&o.ll==='suggest'?'mine':o.ll,extras:!!o.extras&&(last||nx.hopAt!=null),noLLCmp:true,legs:null,later:null});
    if(nx&&o.ll!=='none'){const ids=(nx.must||[]).filter(id=>E.RIDE_BY[id]&&E.RIDE_BY[id].llType==='mp'&&E.RIDE_BY[id].pk===nx.pk&&!(o.done||[]).includes(id));
      if(ids.length){let est=nx.hopAt;if(est==null)est=dpRun(Object.assign({},lo,{noWhy:true,pace:'fast'})).end;est=Math.max(est,t);lo.later={ids,from:est+dpHopTravel(dpGateNode(l),est,nx)+10}}}
    const res=dpRun(lo);parts.push(res);const fin=res._fin;if(fin&&fin.ll)LLs=fin.ll;
    if(res.steps.some(s=>s.meal||(s.blocks||[]).some(b=>b.meal)))lunchDone=true;
    if(last)break;
    const leave=Math.max(res.end,nx.hopAt!=null?nx.hopAt:0,t),from=dpLastNode(res,node),tr=dpHopTravel(from,leave,nx);
    if(!isFinite(tr))throw new Error('No route from '+E.PARKS[l.pk].name+' to '+E.PARKS[nx.pk].name);
    const arr=leave+tr;hops.push({k:'hop',from:l.pk,to:nx.pk,leave,arr,travel:Math.round(tr),idle:Math.max(0,Math.round(leave-res.end)),target:nx.hopAt!=null?nx.hopAt:null,books:[],blocks:[]});
    node=dpGateNode(nx);t=arr}
  const steps=[];parts.forEach((r,i)=>{if(i)steps.push(Object.assign(hops[i-1],{leg:i}));r.steps.forEach(s=>{s.leg=i;steps.push(s)})});
  const sum=k=>parts.reduce((a,r)=>a+r[k],0),wm=parts.filter(r=>r.nDone);
  const res={steps,nMust:sum('nMust'),nDone:sum('nDone'),endMust:wm.length?wm[wm.length-1].endMust:o.t,end:parts[parts.length-1].end,missed:parts.flatMap(r=>r.missed),
    why:Object.assign({},...parts.map(r=>r.why||{})),ll:parts[parts.length-1].ll,passMissed:parts.flatMap(r=>r.passMissed||[]),pen:0,pace:null,pk:legs[0].pk,mode:o.ll,t0:o.t,
    legs:parts.map((r,i)=>({pk:legs[i].pk,nMust:r.nMust,nDone:r.nDone,endMust:r.endMust,end:r.end,missed:r.missed,until:r.until!=null?r.until:null,pace:r.pace,paceFallback:r.paceFallback||null})),hops:hops.slice()};
  if(parts[0].pre)res.pre=parts[0].pre;{const lu=parts[parts.length-1].until;if(lu!=null)res.until=lu}res.ms=Math.round(performance.now()-t0);return res}
// Why each dropped must-do won't fit (roadmap row 59): down for the day, can't reach the line before the last entry,
// or the time it needs after the other must-dos vs the time left; plus what you'd have to skip to fit it and the
// latest time to head straight there. Times are minutes of the day; "last entry" = last minute to join a standby line.
function dpWhy(ctx,o,res,rootLL){const out={},lj=ctx.lj,t0=ctx.t0,best=res._best,others=res.nDone;
  for(const id of res.missed){const r=E.RIDE_BY[id],walk=Math.round(ctx.startD[id]),w={};out[id]=w;
    w.leaveBy=lj!=null&&isFinite(walk)?Math.floor((lj-walk-1)/5)*5:null;if(w.leaveBy!=null&&w.leaveBy<t0)w.leaveBy=null;
    if(lj==null||lj<=t0){w.short='park closed';w.text=`The park has no standby entry left today.`;continue}
    const up=E.DPX?E.DPX.up(r,t0):t0;if(up>=lj){w.short='down';w.text=`${r.short} is down and isn't expected back before ${E.fmtClock(lj)}.`;w.leaveBy=null;continue}
    if(!isFinite(walk)||t0+walk>=lj){w.short=`${walk}m away, ${Math.max(0,Math.round(lj-t0))}m left`;w.text=`It's about ${walk} min from you and ${ctx.until!=null?'you leave':'standby entry ends'} at ${E.fmtClock(lj)}, so you can't reach the line in time.`;continue}
    if(best){const arr=best.t+(best.at===id?0:dpTravel(ctx,best,r)),need=Math.round(arr-t0),have=Math.round(lj-t0);
      if(need>have){w.need=need;w.have=have;w.short=`needs ~${E.fmtDur(need)}, ${E.fmtDur(have)} left`;
        w.text=`After your other ${others} must-do${others===1?'':'s'} it needs ~${E.fmtDur(need)} to reach the line; you have ${E.fmtDur(have)} (${ctx.until!=null?'leaving':'last entry'} ${E.fmtClock(lj)}).`}}
    if(!w.text){w.short='timing';w.text=`No order gets it ${ctx.until!=null?'done':'in line'} by ${E.fmtClock(lj)} without missing a Lightning Lane window, meal or show in the plan.`}
    // what it would take: best plan that must include this ride
    const cr=Object.assign({},ctx,{req:ctx.bit[id]}),b2=dpBeam(cr,dpRoot(cr,o,rootLL),18);
    if(b2.done&ctx.bit[id]){const done=new Set(dpSteps(b2).filter(s=>s.k==='ride').map(s=>s.rid));const skip=res.steps.filter(s=>s.k==='ride'&&s.must&&!done.has(s.rid)).map(s=>s.rid);
      if(skip.length&&skip.length<=2){w.skip=skip;w.text+=` It fits if you swap it for ${skip.map(x=>E.RIDE_BY[x].short).join(' and ')}.`}}}
  return out}

export {DP_KEY,DP_LLQ,DP_LUNCH,DP_GRACE,DP_LATE_PEN,DP_WASTE,DP_IDLE_PEN,DP_LONG,DP_PACE,DP_PACE_NAME,DP_TM,dpMatrix,dpWait,dpParkEnd,dpLLFrom,dpCtx,dpRoot,dpShowWalk,dpTimed,dpBlocks,dpRem,dpTravel,dpRet,dpBook,dpExpand,dpExpand0,dpH,dpCost,dpBetter,dpBeam,dpExtras,dpReplay,dpFillGaps,dpSteps,dpSaveFav,dpPack,dpPaceStats,dpScore,dpSuggest,dpRun,DP_HOP_MAX,dpLegs,dpAllMust,dpGateNode,dpHopTravel,dpLastNode,dpParksLabel,dpHopBefore,dpRunDay,dpWhy};
