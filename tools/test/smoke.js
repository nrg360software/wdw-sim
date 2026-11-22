// Smoke suite: run before every push and push only if it ends with "all passed" (rule since Nov 22, row 67).
//   node tools/test/smoke.js [filter]   — planner unit tests (Node, planner.test.mjs) + every scenario in smoke/ (browser).
// Each scenario fails on any page error, error-box message or failed check. Every bug fix adds a check here that fails without it.
const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'smoke'),only=process.argv[2];let bad=0;const t0=Date.now();
if(!only||'planner.test'.includes(only)){const r=spawnSync('node',['--test',path.join(__dirname,'planner.test.mjs')],{encoding:'utf8'});const ok=r.status===0;if(!ok)bad++;
  console.log((ok?'PASS ':'FAIL ')+'planner.test.mjs ('+((r.stdout.match(/# pass (\d+)/)||[])[1]||0)+' unit tests)');if(!ok)console.log(r.stdout.slice(-3000)+r.stderr.slice(-1500))}
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js')&&(!only||f.includes(only))).sort()){
  const t=Date.now();const r=spawnSync('node',[path.join(__dirname,'run.js'),path.join(dir,f)],{encoding:'utf8',env:Object.assign({ORL:'2026-11-22T18:05:00Z'},process.env),timeout:400000});
  const ok=r.status===0;if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+f+' ('+Math.round((Date.now()-t)/1000)+' s)');if(!ok)console.log((r.stdout||'').slice(-3000)+(r.stderr||'').slice(-1500))}
console.log(bad?bad+' failed':'all passed','in',Math.round((Date.now()-t0)/1000),'s');process.exitCode=bad?1:0;
