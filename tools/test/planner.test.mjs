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

test('a dining reservation between two pass windows is kept on time, and both passes still fit (Nov 22 DAK day)', () => {
  // done with the morning at 12:52; lunch booked 1:30; passes for a (2:00–3:00) and b (2:30–3:30); plan ends 3:30
  const L = env.llFresh(); L.mp = 'TP';
  L.passes.push({ id: 'p1', rid: 'a', type: 'mp', start: 840, end: 900, st: 'active', pre: true }, { id: 'p2', rid: 'b', type: 'sp', start: 870, end: 930, st: 'active', pre: true });
  const meal = { id: 'm1', name: 'Lunch spot', walk: 2, dur: 45, at: 810, meal: true };
  const res = P.dpRunDay(base({ must: ['a'], ll: 'mine', t: 772, L, end: 930, pace: 'bal', blocks: [meal] }));
  const m = res.steps.flatMap(s => s.blocks || []).find(b => b.meal);
  assert.ok(m, 'lunch not planned'); assert.ok(m.late <= 15, `lunch ${m.late} min late`);
  assert.equal(res.nDone, 1, 'a dropped: ' + JSON.stringify(res.missed));
  assert.ok(rides(res).some(s => s.rid === 'b'), 'b (pass only) dropped');
  for (const s of rides(res)) assert.ok(s.end <= m.start + 1e-6 || s.q0 >= m.end - 1e-6, `${s.rid} (${s.q0}–${s.end}) overlaps lunch ${m.start}–${m.end}`);
});

test('untimed stops float in free order, and stops between the same two rides stay linked in order (train → station → train back)', () => {
  // imported after 'a' in the source plan; a's pass is late in the day, so glued after a they would push b past the plan end
  const L = env.llFresh(); L.mp = 'TP'; L.passes.push({ id: 'p1', rid: 'a', type: 'mp', start: 840, end: 900, st: 'active', pre: true });
  const grp = [
    { id: 'g1', name: 'Train up', after: 'a', walk: 5, dur: 11, at: null, meal: false },
    { id: 'g2', name: 'Station', after: 'a', walk: 2, dur: 20, at: null, meal: false },
    { id: 'g3', name: 'Train back', after: 'a', walk: 2, dur: 11, at: null, meal: false },
  ];
  const res = P.dpRunDay(base({ must: ['a', 'b', 'c'], ll: 'mine', t: 720, L, end: 870 + 30, blocks: grp }));
  const bl = res.steps.flatMap(s => s.blocks || []).filter(b => /^g/.test(b.id));
  assert.deepEqual(bl.map(b => b.id), ['g1', 'g2', 'g3'], 'stops missing or out of order: ' + JSON.stringify(res.actMissed));
  for (let i = 1; i < bl.length; i++) assert.ok(Math.abs(bl[i].start - bl[i - 1].end - bl[i].walk) < 1e-6, `${bl[i].id} not right after ${bl[i - 1].id}`);
  for (const s of rides(res)) assert.ok(s.end <= bl[0].start - bl[0].walk + 1e-6 || s.q0 >= bl[2].end - 1e-6, `${s.rid} (${s.q0}–${s.end}) inside the linked stops`);
  assert.equal(res.nDone, 3, JSON.stringify(res.missed));
  const a = rides(res).find(s => s.rid === 'a');
  assert.ok(bl[0].start < a.q0, 'stops still glued after a');
  // keep my order: they stay where the source plan had them
  const kept = P.dpRunDay(base({ must: ['a', 'b', 'c'], ll: 'mine', t: 720, L, keep: true, blocks: grp }));
  const ka = kept.steps.find(s => s.rid === 'a');
  assert.deepEqual((ka.blocks || []).map(b => b.id), ['g1', 'g2', 'g3']);
});

// ---- row 72: 🔒 commitments ------------------------------------------------------------------------------------
// Held Lightning Lane passes and dining reservations are locked: whatever a replan does (mid-day, late start, tight plan end,
// extras/gap filling, pacing), every held pass is used inside its window (+grace) and every reservation is kept, ≤15 min late,
// and nothing in the plan overlaps anything else.
function lockCheck(res, L, meals, label) {
  const iv = [];
  for (const s of res.steps) {
    if (s.k === 'ride') iv.push({ a: s.leave != null ? s.leave + (s.rest || 0) : s.arr, b: s.end, what: s.rid, q0: s.q0 });
    if (s.k === 'hop') iv.push({ a: s.leave, b: s.arr, what: 'hop' });
    for (const b of s.blocks || []) if (!b.missed && b.end > b.start) iv.push({ a: b.start - (b.walk || 0), b: b.end, what: b.name });
    if (s.meal) iv.push({ a: s.meal.start, b: s.meal.end, what: 'lunch' });
  }
  iv.sort((x, y) => x.a - y.a || x.b - y.b);
  for (let i = 1; i < iv.length; i++) assert.ok(iv[i].a >= iv[i - 1].b - 1e-6, `${label}: ${iv[i].what} (${iv[i].a}–${iv[i].b}) overlaps ${iv[i - 1].what} (${iv[i - 1].a}–${iv[i - 1].b})`);
  for (const p of L.passes.filter(p => p.st === 'active')) {
    const s = rides(res).find(s => s.rid === p.rid && s.how !== 'standby' && s.how !== 'rope');
    assert.ok(s, `${label}: held pass for ${p.rid} (${p.start}–${p.end}) dropped; passMissed=${JSON.stringify(res.passMissed)}`);
    assert.ok(s.q0 >= p.start - env.LL_EARLY - 1e-6 && s.arr <= p.end + 30 + 1e-6, `${label}: pass ${p.rid} used at ${s.arr}/${s.q0}, window ${p.start}–${p.end}`);
  }
  const bl = res.steps.flatMap(s => s.blocks || []);
  for (const m of meals) {
    const b = bl.find(b => b.id === m.id);
    assert.ok(b, `${label}: reservation ${m.name} @${m.at} dropped`);
    assert.ok(!b.missed && b.late <= 15, `${label}: reservation ${m.name} @${m.at} ${b.late} min late`);
    assert.ok(b.start >= m.at - 15 - 1e-6, `${label}: reservation ${m.name} @${m.at} seated at ${b.start}`);
  }
}

test('🔒 replans never drop or overlap held passes and dining reservations (mid-day, late start, tight end)', () => {
  let n = 0;
  const passSets = [
    [['a', 'mp', 660]], [['a', 'mp', 840], ['b', 'sp', 870]], [['c', 'mp', 780], ['e', 'mp', 900]],
    [['a', 'mp', 720], ['b', 'mp', 760], ['c', 'mp', 800]], [['b', 'mp', 900]],
  ];
  for (const ps of passSets) for (const mealAt of [null, 750, 810, 1080]) for (const t of [600, 700, 772, 850])
    for (const tight of [false, true]) for (const extras of [false, true]) for (const pace of ['fast', 'bal']) for (const must of [['a', 'b', 'c', 'd'], ['d']]) {
      const passes = ps.filter(([rid]) => RIDE_BY[rid].pk === 'TP').map(([rid, type, start], i) => ({ id: 'p' + i, rid, type, start, end: start + 60, st: 'active', pre: true }));
      if (passes.some(p => p.end < t + 10)) continue; // a window that already ended isn't held any more
      const meals = mealAt != null && mealAt > t + 5 ? [{ id: 'm1', name: 'Dining', walk: 3, dur: 45, at: mealAt, meal: true }] : [];
      const lastEnd = Math.max(t, ...passes.map(p => p.end), ...meals.map(m => m.at + m.dur + 5));
      const L = env.llFresh(); L.mp = 'TP'; L.passes.push(...passes);
      const o = base({ must, ll: 'mine', t, L, pace, extras, lunch: !meals.length, blocks: meals, end: tight ? lastEnd + 15 : undefined });
      const label = JSON.stringify({ ps, mealAt, t, tight, extras, pace, must });
      lockCheck(P.dpRunDay(o), L, meals, label); n++;
      // and after a replan that has already used the first pass (done) — the rest stay locked
      if (passes.length > 1) { const L2 = env.llFresh(); L2.mp = 'TP'; L2.tapped = true; L2.passes.push(Object.assign({}, passes[0], { st: 'used' }), ...passes.slice(1));
        lockCheck(P.dpRunDay(Object.assign({}, o, { L: L2, done: [passes[0].rid], t: Math.max(t, passes[0].start + 20) })), L2, meals.filter(m => m.at > Math.max(t, passes[0].start + 20) + 5), label + ' after first pass'); n++ }
    }
  assert.ok(n > 200, 'too few cases: ' + n);
});

// ---- Nov 24 (Nick's DAK day): a held pass for the favourite must-do is not "saved for the evening" ---------------------
// Flight of Passage was both his top must-do (the pacing favourite) and a held pass 2:30–3:30 in a park closing at 6, so the evening
// started right after the window. The evening bonus pushed the pass to the end of the game's 60-min tap-in grace. A held pass's
// time is set by its window: plan it inside the window when that's possible.
test('held pass on the favourite must-do stays inside its window (no evening bonus past the window)', () => {
  for (const extras of [false, true]) for (const must of [['a'], ['a', 'b', 'c']]) {
    const L = env.llFresh(); L.mp = 'TP'; L.passes.push({ id: 'p1', rid: 'a', type: 'sp', start: 1020, end: 1080, st: 'active', pre: true });
    const res = P.dpRunDay(base({ must, ll: 'mine', t: 1000, L, pace: 'bal', extras, grace: 60 }));
    const s = rides(res).find(s => s.rid === 'a');
    assert.ok(s && s.how === 'sp', `pass dropped ${JSON.stringify({ extras, must })}`);
    assert.ok(s.arr <= 1080 + 1e-6, `pass for the favourite used ${Math.round(s.arr - 1080)} min after its window (arr ${s.arr}) ${JSON.stringify({ extras, must })}`);
  }
});
