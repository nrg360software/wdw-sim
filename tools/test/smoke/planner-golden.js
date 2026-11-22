// planner golden checks (row 67): all must-dos done and finish no more than 15 min later than the Nov 22 baseline (ae59c46).
// If a planner change makes a plan better, lower the baseline here; if worse, it fails.
await pg.waitForTimeout(3000);
return await pg.evaluate(()=>{const W=WDW,out=[];
 const base={'MK Dec20 11am pre|fast':963,'MK rope|fast':708,'EP Dec19|fast':817,'HS Dec21 noon|fast':1015,'AK Dec18|fast':742,'MK→EP hop|fast':1062,'MK Dec20 11am pre|bal':1012,'MK rope|bal':708,'EP Dec19|bal':817,'HS Dec21 noon|bal':1015,'AK Dec18|bal':742,'MK→EP hop|bal':1160},fail=[];
 const run=(name,date,pk,must,t,pre,mp,pace,legs,end)=>{W.prepDay(date,1,'pop');const L=W.llFresh();if(mp){L.mp=mp;(pre||[]).forEach((p,i)=>L.passes.push({id:'g'+i,rid:p[0],type:'mp',start:p[1],end:p[1]+60,st:'active',pre:true}))}
  const t0=performance.now();const r=W.dpRunDay({pk,must,ll:mp?'mine':'none',lunch:true,extras:false,pace,node:W.NI[pk+':front'],t,L,done:[],legs,end});
  const k=name+'|'+pace,e=Math.round(r.endMust);out.push([k,r.nDone+'/'+r.nMust,e,Math.round(performance.now()-t0)+' ms']);if(r.nDone<r.nMust)fail.push(k+': '+r.nDone+'/'+r.nMust);if(e>base[k]+15)fail.push(k+': done '+e+' vs baseline '+base[k])};
 for(const pace of ['fast','bal']){
 run('MK Dec20 11am pre','2026-12-20','MK',['tron','sdmt','pp','space','btm','hm','jc'],660,[['pp',720],['btm',780],['hm',840]],'MK',pace);
 run('MK rope','2026-12-09','MK',['tron','sdmt','pp','space','btm','hm','jc'],480,null,null,pace);
 run('EP Dec19','2026-12-19','EP',['gotg','tt','remy','fea','soar','msp'],540,[['fea',600],['soar',660],['tt',720]],'EP',pace);
 run('HS Dec21 noon','2026-12-21','HS',['rotr','sdd','tot','tsm','mmrr','rnrc'],720,[['sdd',780],['tot',840],['tsm',900]],'HS',pace);
 run('AK Dec18','2026-12-18','AK',['fop','navi','ee','kili','krr'],480,[['navi',600],['ee',660],['kili',720]],'AK',pace);
 run('MK→EP hop','2026-12-09','MK',['tron','sdmt','pp','space'],480,null,null,pace,[{pk:'EP',must:['tt','fea','soar','msp'],hopAt:840,blocks:[],tp:{}}]);}
 return {out,fail}})
