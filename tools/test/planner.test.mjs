// Unit tests for planner.js on a small fake world (row 67). Run: node --test tools/test/planner.test.mjs
// No browser and no game data: two parks with a handful of rides on a straight walkway, waits from simple formulas.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../planner.js';

// ---- fake world ------------------------------------------------------------------------------------------------
// Park TP: front — a — b — c — d (100 m apart, 1 min each at WALK_PARK 100). Park TQ: front — e, joined front-to-front (15 min).
const NODES = [], NI = {};
const node = (id, park) => { NI[id] = NODES.length; NODES.push({ id, park, adj: [] }); };
const link = (a, b, d, inPark = true) => { NODES[NI[a]].adj.push({ to: NI[b], type: 'walk', inPark, d }); NODES[NI[b]].adj.push({ to: NI[a], type: 'walk', inPark, d }); };
['TP:front', 'TP:a', 'TP:b', 'TP:c', 'TP:d'].forEach(id => node(id, 'TP'));
['TQ:front', 'TQ:e'].forEach(id => node(id, 'TQ'));
link('TP:front', 'TP:a', 100); link('TP:a', 'TP:b', 100); link('TP:b', 'TP:c', 100); link('TP:c', 'TP:d', 100);
link('TQ:front', 'TQ:e', 100); link('TP:front', 'TQ:front', 1500, false);
const WALK_PARK = 100;
const ride = (id, pk, o) => Object.assign({ id, pk, nodeId: pk + ':' + id, short: id.toUpperCase(), name: id, dur: 5, kind: 'ride', avg: 30, thrill: 2, llType: 'mp', ll: true, tier: 2 }, o);
const RIDES = [
  ride('a', 'TP', { avg: 60, thrill: 4, tier: 1 }), // headliner: short line at opening, long all day
  ride('b', 'TP'), ride('c', 'TP'), ride('d', 'TP', { llType: null, ll: false }),
  ride('e', 'TQ'),
];
const RIDE_BY = Object.fromEntries(RIDES.map(r => [r.id, r]));
const PARKS = { TP: { open: 9, close: 21, name: 'Test Park', short: 'TP' }, TQ: { open: 9, close: 21, name: 'Other Park', short: 'TQ' } };
const W = { // standby by ride and time (minutes after midnight)
  a: t => (t < 570 ? 10 : 90), b: () => 20, c: t => (t >= 720 && t < 840 ? 60 : 15), d: () => 10, e: () => 25,
};
function dijkstra(start) { // walking minutes from start to every node (all walk links)
  const dist = NODES.map(() => Infinity), done = NODES.map(() => false); dist[start] = 0;
  for (;;) { let u = -1, b = Infinity; dist.forEach((d, i) => { if (!done[i] && d < b) { b = d; u = i } }); if (u < 0) break; done[u] = true;
    for (const e of NODES[u].adj) { const c = b + e.d / WALK_PARK; if (c < dist[e.to]) dist[e.to] = c } }
  return { dist };
}
const env = {
  DPW: {}, DPX: null, G: { deluxe: false }, LL_EARLY: 5, LL_WIN: 60, NI, NODES, PARKS, RIDES, RIDE_BY, WALK_PARK,
  accessOpen: pk => PARKS[pk].open * 60, busy: () => 0, dijkstra, showDij: dijkstra, dpPaceOf: o => o.pace || 'bal',
  fmtClock: t => Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0'), fmtDur: m => Math.round(m) + ' min',
  llFresh: () => ({ mp: null, premier: null, passes: [], tapped: false, premUsed: {}, used: {} }),
  llNext: (r, t) => Math.ceil((t + 30) / 5) * 5, // returns are always 30 min out
  parkOpen: (pk, t) => t >= PARKS[pk].open * 60 && t < PARKS[pk].close * 60, parkOpenPublic: (pk, t) => t >= PARKS[pk].open * 60 && t < PARKS[pk].close * 60,
  rawWait: (r, t) => W[r.id](t),
};
P.plannerInit(env);

const base = o => Object.assign({ pk: 'TP', ll: 'none', lunch: false, extras: false, pace: 'fast', node: NI['TP:front'], t: 540, done: [] }, o);
const rides = res => res.steps.filter(s => s.k === 'ride');

// ---- tests -----------------------------------------------------------------------------------------------------
test('plans every must-do, in time order, without overlaps', () => {
  const res = P.dpRun(base({ must: ['a', 'b', 'c', 'd'] }));
  assert.equal(res.nDone, 4); assert.equal(res.nMust, 4); assert.deepEqual(res.missed, []);
  let t = 540;
  for (const s of rides(res)) {
    assert.ok(s.arr >= t - 1e-6, `${s.rid} arrives ${s.arr} before the previous step ends ${t}`);
    assert.ok(s.end >= s.arr + s.wait + RIDE_BY[s.rid].dur - 1e-6, `${s.rid} ends too early`);
    t = s.end;
  }
  assert.equal(Math.round(res.endMust), Math.round(t));
});

test('does the headliner first while its line is short (rope drop)', () => {
  const res = P.dpRun(base({ must: ['b', 'a', 'c'] }));
  assert.equal(rides(res)[0].rid, 'a');
});

test('avoids a ride during its long-wait hours', () => {
  const res = P.dpRun(base({ must: ['b', 'c', 'd'], t: 700 }));
  const c = rides(res).find(s => s.rid === 'c');
  assert.ok(c.q0 < 720 || c.q0 >= 840, `c joined at ${c.q0}, inside its 60-min window`);
});

test('in line by close: a must-do that cannot fit is reported, not silently planned after close', () => {
  const res = P.dpRun(base({ must: ['a', 'b', 'c', 'd'], t: 1240 }));
  assert.ok(res.nDone < 4);
  for (const s of rides(res)) assert.ok(s.q0 < 21 * 60 + 1, `${s.rid} joined at ${s.q0}, after close`);
  assert.equal(res.missed.length, 4 - res.nDone);
});

test('uses a Lightning Lane pass you hold inside its window', () => {
  const L = env.llFresh(); L.mp = 'TP'; L.passes.push({ id: 'p1', rid: 'a', type: 'mp', start: 660, end: 720, st: 'active', pre: true });
  const res = P.dpRun(base({ must: ['a', 'b'], ll: 'mine', t: 600, L }));
  const a = rides(res).find(s => s.rid === 'a');
  assert.ok(a, 'a planned'); assert.notEqual(a.how, 'standby');
  assert.ok(a.q0 >= 660 - 5 && a.q0 <= 720 + 60, `pass used at ${a.q0}`);
});

test('keeps a held show and fits rides around it', () => {
  const show = { id: 'u1', user: 1, sid: 's1', pk: 'TP', name: 'Parade', at: 690, pre: 10, show: 20, dur: 30, meal: false, node: 'TP:b', meet: 0 };
  const res = P.dpRun(base({ must: ['a', 'b', 'c', 'd'], t: 600, blocks: [show] }));
  const held = res.steps.flatMap(s => s.blocks || []).filter(b => b.user);
  assert.equal(held.length, 1); assert.ok(!held[0].missed, 'show missed');
  assert.ok(held[0].start <= 690 && held[0].end === 710, `show ${held[0].start}–${held[0].end}`);
  for (const s of rides(res)) assert.ok(s.end <= 680 || s.q0 >= 710, `${s.rid} (${s.q0}–${s.end}) overlaps the show`);
  assert.equal(res.nDone, 4);
});

test('a ride that is down (DPX hook) is planned after it comes back up', () => {
  env.DPX = { wait: (r, t, w) => w, ll: () => 0, up: (r, t) => (r.id === 'b' && t < 780 ? 780 : t) };
  try {
    const res = P.dpRun(base({ must: ['a', 'b'], t: 600 }));
    const b = rides(res).find(s => s.rid === 'b');
    assert.ok(b && b.end - RIDE_BY.b.dur >= 780, `b boards at ${b && b.end - RIDE_BY.b.dur} while down`);
  } finally { env.DPX = null; }
});

test('same input, same plan', () => {
  const o = base({ must: ['a', 'b', 'c', 'd'], pace: 'bal', lunch: true, t: 600 });
  const x = JSON.stringify(rides(P.dpRun(o))), y = JSON.stringify(rides(P.dpRun(o)));
  assert.equal(x, y);
});

test('two parks: hops after the first park and does the second park\'s must-dos', () => {
  const res = P.dpRunDay(base({ must: ['a', 'b'], legs: [{ pk: 'TQ', must: ['e'], hopAt: 720, blocks: [], tp: {} }] }));
  assert.equal(res.nDone, 3, JSON.stringify(res.missed));
  const hop = res.steps.find(s => s.k === 'hop');
  assert.ok(hop, 'no hop step'); assert.equal(hop.to, 'TQ'); assert.ok(hop.travel >= 15, `hop travel ${hop.travel}`);
  const e = rides(res).find(s => s.rid === 'e');
  assert.ok(e.arr >= hop.arr - 1e-6, 'rode e before arriving');
});

test('a held show the plan cannot reach is marked missed but keeps where it is (so Start can still walk there)', () => {
  const show = { id: 'u2', user: 1, sid: 's2', pk: 'TP', name: 'Far show', at: 545, pre: 0, show: 20, dur: 20, meal: false, node: 'TP:d', meet: 0 };
  const res = P.dpRun(base({ must: ['b'], t: 540, blocks: [show] })); // 4 min walk, starts in 5 → reachable
  const res2 = P.dpRun(base({ must: ['b'], t: 540, node: NI['TQ:front'], blocks: [show] })); // other park, 15+ min away → missed
  const held = r => r.steps.flatMap(s => s.blocks || []).find(b => b.user);
  assert.ok(!held(res).missed);
  assert.ok(held(res2).missed, 'should be missed'); assert.equal(held(res2).node, 'TP:d');
});
