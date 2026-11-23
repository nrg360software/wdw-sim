// Shared helpers for smoke scenarios (row 67). run.js passes this module to every scenario as `lib`.
// PAGE is injected into every page (addInitScript) as window.__aud: the dead-button audit.

const PAGE = String.raw`(()=>{const A=window.__aud={ev:[],
 install(){if(A.ok)return;A.ok=1;const wt=t=>{A.ev.push('clip');return Promise.resolve()};
  try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:wt}})}catch(e){try{navigator.clipboard.writeText=wt}catch(e2){}}
  window.open=u=>{A.ev.push('open '+u);return null};window.alert=()=>A.ev.push('alert');window.confirm=()=>{A.ev.push('confirm');return false};
  const ic=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'){A.ev.push('file');return}return ic.call(this)};
  document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;const a=t.closest('a[href]');if(a&&!/^#/.test(a.getAttribute('href'))){e.preventDefault();A.ev.push('link '+a.href)}
   const l=t.closest('label');if(l&&l.control&&l.control.type==='file'){e.preventDefault();A.ev.push('file')}},true)},
 reset(){['llsetup','daysetup','rfview','pushview'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true});
  const eb=document.getElementById('errBox');if(eb)eb.hidden=true;const dt=document.getElementById('dbgTxt');if(dt)dt.remove();
  document.getElementById('toasts').innerHTML='';if(window.WDW&&WDW.testReset)WDW.testReset()},
 w:ms=>new Promise(r=>setTimeout(r,ms)),
 h(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h},
 sig(){const W=window.WDW,G=W.G,q=s=>document.querySelector(s),o={};
  for(const id of ['sheet','start','llsetup','daysetup','rfview','pushview','end','pv','top','bottom','errBox','dbgTxt','toasts','resumeBox']){const e=document.getElementById(id);o[id]=e?(e.hidden?'h':'v')+A.h(e.innerHTML):'-'}
  const sb=q('#sheet .sb');o.sbY=sb?Math.round(sb.scrollTop/8):0;const pv=q('#pv');o.pvY=pv?Math.round(pv.scrollTop/8):0;
  o.ovY=[...document.querySelectorAll('.modal')].map(m=>Math.round(m.scrollTop/8)).join(',');
  o.G=A.h(JSON.stringify({s:G.started,o:G.over,f:G.follow,seg:G.seg,n:(G.segs||[]).length,pl:G.plan&&[G.plan.made,G.plan.settings&&G.plan.settings.must,G.plan.notes&&G.plan.notes.length,G.plan.res&&G.plan.res.steps&&G.plan.res.steps.length],ll:G.LL&&G.LL.passes,r:(G.ridden||[]).length,node:G.node,sp:G.speed,ps:G.sheetPaused}));
  o.ls=A.h(Object.keys(localStorage).sort().filter(k=>!/dbg|wdwsim\.run\.|hist\.|shows\.v1|llobs/.test(k)).map(k=>k+localStorage.getItem(k)).join('|'));
  const c=W.camera;o.cam=c?[c.position.x,c.position.y,c.position.z].map(v=>Math.round(v/4)).join():'';
  o.ev=A.ev.length;o.err=W.DBG?W.DBG.n:0;return o},
 vis(e){if(e.disabled||e.closest('[hidden]'))return false;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;
  const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.pointerEvents!=='none'&&+cs.opacity>0},
 list(root,openDetails){if(openDetails)root.querySelectorAll('details').forEach(d=>d.open=true);
  return [...root.querySelectorAll('*')].filter(e=>{const tg=e.tagName;
   const b=tg==='BUTTON'||tg==='SUMMARY'||(tg==='A'&&e.hasAttribute('href'))||typeof e.onclick==='function'||e.getAttribute('role')==='button'||(tg==='LABEL'&&e.control&&e.control.type==='file');
   return b&&A.vis(e)})},
 fam(e){return e.tagName+'|'+Object.keys(e.dataset||{}).join(',')+'|'+(e.id?'id':'')+(e.className&&e.className.baseVal==null?String(e.className):'')},
 key(e){const ds=Object.keys(e.dataset||{}).map(k=>k+'='+String(e.dataset[k]).slice(0,20)).join(' ');
  return (e.id?'#'+e.id+' ':'')+e.tagName.toLowerCase()+(ds?'['+ds+']':'')+' "'+(e.getAttribute('aria-label')||e.textContent||'').replace(/[0-9]+/g,'#').replace(/\s+/g,' ').trim().slice(0,40)+'"'},
 desc(e){return e?(e.id?'#'+e.id:'')+'<'+e.tagName.toLowerCase()+(e.className&&e.className.baseVal==null?'.'+String(e.className).split(' ')[0]:'')+'>':'nothing'},
 // Re-open the panel (openSrc), tap every visible button in root once, report hit-test + what changed.
 async run(openSrc,rootSel,o={}){A.install();const open=new Function(openSrc),dt=o.dt||110,res=[];const skip=o.skip?new RegExp(o.skip):null;
  const prep=async()=>{if(o.reset!==false)A.reset();await open();await A.w(o.wait||80);const root=document.querySelector(rootSel);if(!root||root.hidden)throw new Error('panel did not open: '+rootSel);return A.list(root,o.details!==false)};
  let L=await prep();let keys=L.map(A.key);
  if(o.sample){const seen={};keys=keys.filter((k,i)=>{const f=A.fam(L[i]);if(L[i].id)return true;seen[f]=(seen[f]||0)+1;return seen[f]<=o.sample})}
  const R=window.WDW.renderer,rr=R.render;if(o.noRender!==false)R.render=()=>{};try{
  for(let i=o.from||0;i<keys.length;i++){const k=keys[i];if(skip&&skip.test(k)){res.push({k,r:'skip'});continue}
   if(i>(o.from||0)){try{L=await prep()}catch(er){res.push({k,hit:'ok',ch:'REOPEN FAILED after the previous tap: '+er.message});continue}}const nth=keys.slice(0,i).filter(x=>x===k).length;const e=L.filter(x=>A.key(x)===k)[nth];
   if(!e){res.push({k,r:'gone'});continue}
   e.scrollIntoView({block:'center',inline:'nearest'});await A.w(40);
   const rc=e.getClientRects()[0]||e.getBoundingClientRect(),top=document.elementFromPoint(rc.left+rc.width/2,rc.top+rc.height/2);
   const hit=top===e||e.contains(top)||(top&&top.closest('label')===e)?'ok':'covered by '+A.desc(top);
   const pressed=e.getAttribute('aria-pressed')==='true'||e.getAttribute('aria-selected')==='true';
   const s0=A.sig();await A.w(dt);const s1=A.sig();const noisy=Object.keys(s0).filter(x=>s0[x]!==s1[x]&&x!=='err');
   e.click();await A.w(dt);if(o.slow&&o.slow.test&&new RegExp(o.slow).test(k))await A.w(1200);
   let s2=A.sig();let ch=Object.keys(s2).filter(x=>!noisy.includes(x)&&s1[x]!==s2[x]&&x!=='err');
   if(!ch.length){await A.w(450);s2=A.sig();ch=Object.keys(s2).filter(x=>!noisy.includes(x)&&s1[x]!==s2[x]&&x!=='err')}
   const err=s2.err>s1.err?(window.WDW.DBG.err.slice(-1)[0]||{}).m:null;
   res.push({k,hit,ch:ch.join(',')||(pressed?'already selected':'NOTHING'),noisy:noisy.join(','),err});
   if(o.stop&&new Function(o.stop)())return {res,next:i+1,n:keys.length}}
  return {res,next:null,n:keys.length}}finally{R.render=rr}}
};})();`;

// tap every visible button of a panel; re-runs from where it stopped when a button ends the day (restart = async fn)
async function audit(pg, name, openSrc, rootSel, o = {}, restart) {
  const all = []; let from = 0, guard = 0;
  while (from != null && guard++ < 20) {
    const r = await pg.evaluate(([s, sel, o]) => window.__aud.run(s, sel, o), [openSrc, rootSel, Object.assign({}, o, { from, stop: o.stop || 'return !WDW.G.started||WDW.G.over' })]);
    all.push(...r.res); from = r.next;
    if (from != null) { if (!restart) break; await restart(); }
  }
  const fail = [];
  for (const x of all) {
    if (x.r) continue;
    if (x.hit !== 'ok') fail.push(name + ': ' + x.k + ' ' + x.hit);
    if (/^REOPEN/.test(x.ch)) fail.push(name + ': ' + x.k + ' ' + x.ch);
    if (x.ch === 'NOTHING' && !(o.allow && new RegExp(o.allow).test(x.k))) fail.push(name + ': ' + x.k + ' did nothing');
    if (x.err) fail.push(name + ': ' + x.k + ' error: ' + x.err);
  }
  return { name, n: all.length, tapped: all.filter(x => !x.r).length, fail, res: all };
}

const reload = async pg => { await pg.goto('https://wdw.test/'); await pg.waitForFunction(() => window.WDW && window.WDW.scene, null, { timeout: 120000 }); await pg.waitForTimeout(4000); };

const MUST = { MK: ['tron', 'sdmt', 'pp', 'space', 'btm', 'hm'], EP: ['gotg', 'tt', 'remy', 'fea', 'soar', 'msp'], HS: ['rotr', 'sdd', 'tot', 'tsm', 'mmrr', 'rnrc'], AK: ['fop', 'navi', 'ee', 'kili', 'krr'] };

// start a day in park pk: view 'map'|'plan', time 'now' (real time) or minutes; reloads the page first
// o.show: hold the first show or meet starting 2+ h after (reachable from the hotel) the start in the plan, so the plan's next step is that block (#dpBlk)
async function startDay(pg, pk, view, time, o = {}) {
  if (o.show) await pg.waitForFunction(p => { const x = WDW.showsFor(p, WDW.orlandoNow().date); return x && x.items && x.items.length }, pk, { timeout: 30000 });
  await pg.evaluate(([pk, view, must, show, t0, o]) => { localStorage.setItem('wdwsim.view', view); localStorage.setItem('wdwsim.auto', '0');
    Object.keys(localStorage).filter(k => /^wdwsim\.run\./.test(k)).forEach(k => localStorage.removeItem(k));
    const d = WDW.orlandoNow().date, blocks = [];
    if (show) { const its = (WDW.showsFor(pk, d) || {}).items || []; let best = null;
      for (const it of its) { if (it.p) continue; const T = (it.t || []).find(x => x >= t0 + 120) ?? ((it.w || []).map(w => Math.max(w[0], Math.ceil((t0 + 120) / 30) * 30)).find((x, i) => x < it.w[i][1])); if (T != null && (!best || T < best.T)) best = { it, T } }
      if (!best) throw new Error('no show to hold in ' + pk); blocks.push(WDW.showBlock(best.it, pk, best.T)) }
    WDW.dpSave(d, { pk, must, ll: 'none', lunch: !o.bare, extras: !o.bare, pace: 'bal', blocks }) }, [pk, view, o.must || MUST[pk], !!o.show, time === 'now' ? 0 : time, o]);
  await reload(pg);
  await pg.evaluate(t => { if (t === 'now') document.querySelector('#segTime [data-now="1"]').click(); else document.querySelector('#segTime [data-v="' + t + '"]:not([data-now])').click() }, time);
  await pg.waitForTimeout(200);
  await pg.evaluate(() => document.querySelector('#bPlay').click());
  await pg.waitForFunction(() => WDW.G.started && WDW.G.plan, null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
}


// every panel of one park, in the 3D map view (11 AM) and the list view (real-time Now day)
async function parkAudit(pg, pk, o = {}) {
  const ride = MUST[pk][0], fails = [], sum = {};
  for (const [view, time] of [['map', 660], ['plan', 'now']]) {
    await startDay(pg, pk, view, time, { show: time !== 'now' });
    const restart = () => startDay(pg, pk, view, time, { show: time !== 'now' });
    const V = `WDW.setView('${view}');`;
    const panels = [
      ['dock', V, '#bottom', { allow: '#bFollow|data-s=|speed' }],
      ['hud', V, '#top', {}],
      ['eat shop', V + "WDW.openDoing();if(document.getElementById('sheet').hidden)WDW.openDoing()", '#sheet', {}],
      ...(view === 'map' ? [['plan', V + 'WDW.openPlan()', '#sheet', {}]] : []),
      ['plan editor', V + 'WDW.dpvEdit();WDW.openPlan()', '#sheet', {}],
      ['rides', V + `WDW.openRides('${pk}')`, '#sheet', {}],
      ['ride page', V + `WDW.openRide(WDW.RIDE_BY['${ride}'])`, '#sheet', {}],
      ['top picks', V + 'WDW.openPicks()', '#sheet', {}],
      ['lightning lane', V + 'WDW.openLL()', '#sheet', {}],
      ["i'm at", V + `WDW.openWhere('${pk}')`, '#sheet', {}],
      ['steps', V + 'WDW.openSteps()', '#sheet', {}],
      ['shows', V + `WDW.openShows('${pk}')`, '#sheet', {}],
    ];
    if (view === 'plan') panels.unshift(['list view', V + "document.getElementById('pv').scrollTop=0", '#pv', {}]);
    for (const [name, src, root, po] of panels) {
      let r;try{r = await audit(pg, pk + ' ' + view + ' ' + name, src, root, Object.assign({ sample: o.sample || 3 }, po), restart)}catch(e){fails.push(pk + ' ' + view + ' ' + name + ': ' + String(e.message).split('\n')[0]);continue}
      sum[view + ' ' + name] = r.tapped; fails.push(...r.fail);
      if (!r.tapped) fails.push(pk + ' ' + view + ' ' + name + ': no buttons found');
    }
  }
  return { sum, fail: fails };
}

module.exports = { PAGE, audit, reload, startDay, parkAudit, MUST };
