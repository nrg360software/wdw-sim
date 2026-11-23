// Nov 22 (Nick, iPhone): Start on a held character meet threw "tgt.short" every frame (×325) — the HUD assumed every trip
// ends at a ride. Walk to a held show/meet in each park (Go now, the same trip Start builds), in both views: no errors, and
// the status line names the show while walking.
await pg.waitForTimeout(4000);const fail=[],out={};
for(const [pk,view] of [['EP','map'],['MK','plan'],['HS','map'],['AK','plan']]){
  await lib.startDay(pg,pk,view,660,{show:true});
  await pg.evaluate(p=>WDW.rtAt(p+':front',p+' entrance'),pk);await pg.waitForTimeout(400); // in the park, like Nick: the trip starts with walking
  const r=await pg.evaluate(async([pk])=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const G=WDW.G,n0=WDW.DBG.n;
    const b=G.plan.settings.blocks.find(x=>x.user),it=(WDW.showsFor(pk,WDW.orlandoNow().date).items||[]).find(i=>i.id===b.sid);
    if(!it)return {err:'held show not in the feed'};WDW.closeSheet();WDW.showGo(it,pk);await w(300);
    const wi=(G.segs||[]).findIndex(x=>x.k==='walk'&&x.inPark);if(wi>=0)G.seg=wi;await w(800);const walk=document.querySelector('#statusT').textContent;await w(1500);
    return {show:b.name,walk,segs:(G.segs||[]).map(s=>s.k).join(','),errs:WDW.DBG.n-n0,last:(WDW.DBG.err.slice(-1)[0]||{}).m}},[pk]);
  out[pk+' '+view]=r;
  if(r.err)fail.push(pk+' '+view+': '+r.err);else{if(r.errs)fail.push(pk+' '+view+': '+r.errs+' errors on the way, last: '+r.last);if(!/walk.*snack$/.test(r.segs))fail.push(pk+' '+view+': no walk to the show ('+r.segs+')');if(!/^Walking.*→ \S/.test(r.walk))fail.push(pk+' '+view+': status while walking: '+r.walk)}
}
out.fail=fail;return out
