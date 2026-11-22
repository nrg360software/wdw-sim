// start screen + its overlays (Plan my day, Lightning Lane planner, Shows, Phone alerts, Crowd read) and the end screen:
// tap every visible button, check each is on top and does something
await pg.waitForTimeout(5000);const fail=[],sum={};
const S="return WDW.G.started";
const panels=[
 ['start screen','document.getElementById("start").scrollTop=0','#start',{skip:'#bPlay',allow:'segGfx|data-v=med'}],
 ['plan my day',"document.querySelector('#bDayPlan').click()",'#daysetup',{slow:'#dpMake|#dpStress'}],
 ['lightning lane planner',"document.querySelector('#bLLPlan').click()",'#llsetup',{}],
 ['shows',"document.querySelector('#bShows').click()",'#sheet',{}],
 ['phone alerts',"document.querySelector('#bPush').click()",'#pushview',{}],
 ['crowd read','WDW.openRF()','#rfview',{}],
];
for(const [name,src,root,o] of panels){try{const r=await lib.audit(pg,name,src,root,Object.assign({sample:3,stop:S},o));sum[name]=r.tapped;fail.push(...r.fail);if(!r.tapped)fail.push(name+': no buttons found')}catch(e){fail.push(name+': '+String(e.message).split('\n')[0])}}
// end screen
await lib.startDay(pg,'MK','map',660);await pg.evaluate(()=>WDW.endDay());await pg.waitForTimeout(500);
try{const r=await lib.audit(pg,'end screen',"document.getElementById('end').hidden=false;document.getElementById('start').hidden=true",'#end',{stop:'return false',reset:false});sum['end screen']=r.tapped;fail.push(...r.fail)}catch(e){fail.push('end screen: '+e.message)}
return {sum,fail}
