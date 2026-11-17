// WDW Sim live-waits relay (Cloudflare Worker).
// Fetches Walt Disney World wait times from Queue-Times.com at most once every
// 5 minutes and hands the same copy to every player, so Queue-Times sees a few
// requests per 5 minutes however many people play.
//
// Data: Powered by Queue-Times.com (https://queue-times.com/). Their free Real
// Time API requires that credit, shown prominently in the app.
//
// Safeguards:
//  - Only GET /waits is served; it only ever fetches the four WDW parks, so this
//    is not an open proxy.
//  - Results are cached for 5 minutes (the feed only updates every 5 minutes).
//  - If Queue-Times fails, the last good copy is served (marked stale) for up to
//    2 hours, then the game falls back to its built-in wait curves.
//  - Browsers on other websites can't read the response (CORS is limited to
//    the game's own address).
//  - A light per-visitor limit turns away anything hammering the relay.
//
// Wait history (optional, needs a D1 database bound as DB and a cron trigger):
//  - Every 5 minutes the cron run saves each park's waits as one row in D1
//    (table snapshots). While a park has no open rides it saves only one row an
//    hour, so nights cost almost nothing. No extra load on Queue-Times: it is
//    the same once-per-5-minutes fetch the relay already makes.
//  - GET /history?park=AK&date=2026-12-18 returns that park's day.
//  - GET /history/status shows how much has been recorded.
//
// D1 schema (run once in the database's Console):
//   CREATE TABLE IF NOT EXISTS snapshots (park TEXT NOT NULL, ts INTEGER NOT NULL,
//     day TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (park, ts));
//   CREATE INDEX IF NOT EXISTS snapshots_day ON snapshots (park, day);

const PARKS = { MK: 6, EP: 5, HS: 7, AK: 8 };          // Queue-Times park ids
const ALLOWED_ORIGINS = ['https://nrg360software.github.io'];
const FRESH_MS = 5 * 60 * 1000;                       // feed refresh interval
const STALE_MAX_MS = 2 * 60 * 60 * 1000;              // serve old copy this long if upstream fails
const RETRY_AFTER_FAIL_MS = 60 * 1000;                // don't retry upstream more than once a minute after a failure
const PER_IP_PER_MIN = 30;                            // the game asks about once per 5 minutes
const UA = 'WDW-Sim/1.0 (+https://nrg360software.github.io/wdw-sim/)';

let memo = null;         // { body, at }  last good combined result in this instance
let lastTry = 0;
let inflight = null;
const hits = new Map();  // ip -> { n, start }

function corsHeaders(origin) {
  const h = { 'Vary': 'Origin' };
  if (ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET';
  }
  return h;
}

function tooMany(ip) {
  const now = Date.now();
  let e = hits.get(ip);
  if (!e || now - e.start > 60000) { e = { n: 0, start: now }; hits.set(ip, e); }
  e.n++;
  if (hits.size > 5000) hits.clear();   // keep memory bounded
  return e.n > PER_IP_PER_MIN;
}

async function fetchPark(id) {
  const r = await fetch(`https://queue-times.com/parks/${id}/queue_times.json`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!r.ok) throw new Error('queue-times ' + id + ' HTTP ' + r.status);
  const j = await r.json();
  const rides = [];
  for (const land of j.lands || []) for (const x of land.rides || []) rides.push(x);
  for (const x of j.rides || []) rides.push(x);
  // Slim rows: [name, isOpen, waitMinutes, lastUpdated]
  return rides.map(x => [String(x.name || ''), !!x.is_open, Number(x.wait_time) || 0, x.last_updated || null]);
}

async function refresh() {
  const entries = await Promise.all(Object.entries(PARKS).map(async ([k, id]) => [k, await fetchPark(id)]));
  const body = JSON.stringify({
    fetched: new Date().toISOString(),
    parks: Object.fromEntries(entries),
    attribution: 'Powered by Queue-Times.com',
    attributionUrl: 'https://queue-times.com/',
  });
  memo = { body, at: Date.now() };
  return memo;
}

async function getData() {
  const now = Date.now();
  if (memo && now - memo.at < FRESH_MS) return { ...memo, stale: false };
  if (now - lastTry < RETRY_AFTER_FAIL_MS && memo) return { ...memo, stale: true };
  if (!inflight) {
    lastTry = now;
    inflight = refresh().finally(() => { inflight = null; });
  }
  try {
    const m = await inflight;
    return { ...m, stale: false };
  } catch (e) {
    if (memo && now - memo.at < STALE_MAX_MS) return { ...memo, stale: true };
    throw e;
  }
}

// ---- wait history
function orlando(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
}

async function record(env, when = new Date()) {
  if (!env || !env.DB) return { saved: 0, why: 'no DB binding' };
  const m = await refresh();
  const { parks } = JSON.parse(m.body);
  const o = orlando(when), ts = Math.floor(when.getTime() / 1000);
  const stmts = [];
  for (const [park, rows] of Object.entries(parks)) {
    const anyOpen = rows.some(r => r[1]);
    if (!anyOpen && o.minute >= 5) continue;             // closed: keep one row an hour
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO snapshots (park, ts, day, data) VALUES (?1, ?2, ?3, ?4)')
      .bind(park, ts, o.day, JSON.stringify(rows.map(r => [r[0], r[1] ? 1 : 0, r[2], r[3]]))));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { saved: stmts.length, day: o.day };
}

async function history(env, url, cors) {
  const json = (obj, status = 200, maxAge = 300) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + maxAge } });
  if (!env || !env.DB) return json({ error: 'history not set up' }, 501, 60);
  if (url.pathname === '/history/status') {
    const r = await env.DB.prepare('SELECT park, COUNT(*) AS rows, COUNT(DISTINCT day) AS days, MIN(ts) AS first, MAX(ts) AS last FROM snapshots GROUP BY park').all();
    return json({ now: new Date().toISOString(), parks: (r.results || []).map(x => ({ ...x, first: new Date(x.first * 1000).toISOString(), last: new Date(x.last * 1000).toISOString() })) }, 200, 60);
  }
  const park = url.searchParams.get('park'), date = url.searchParams.get('date');
  if (!(park in PARKS) || !/^\d{4}-\d\d-\d\d$/.test(date || '')) return json({ error: 'use /history?park=MK|EP|HS|AK&date=YYYY-MM-DD' }, 400, 3600);
  const r = await env.DB.prepare('SELECT ts, data FROM snapshots WHERE park = ?1 AND day = ?2 ORDER BY ts').bind(park, date).all();
  const today = orlando(new Date()).day;
  return json({ park, date, columns: ['name', 'open', 'wait', 'lastUpdated'], snaps: (r.results || []).map(x => [x.ts, JSON.parse(x.data)]), attribution: 'Powered by Queue-Times.com' }, 200, date < today ? 86400 : 300);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(record(env, new Date(event.scheduledTime || Date.now())));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    if (url.pathname === '/') return new Response('WDW Sim live waits relay. Data powered by Queue-Times.com', { headers: { 'Content-Type': 'text/plain' } });
    const isHist = url.pathname === '/history' || url.pathname === '/history/status';
    if (url.pathname !== '/waits' && !isHist) return new Response('Not found', { status: 404, headers: cors });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (tooMany(ip)) return new Response('Too many requests', { status: 429, headers: { ...cors, 'Retry-After': '60' } });
    if (isHist) {
      try { return await history(env, url, cors); }
      catch (e) { return new Response(JSON.stringify({ error: 'history unavailable' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }); }
    }

    try {
      const d = await getData();
      const age = Math.floor((Date.now() - d.at) / 1000);
      return new Response(d.body, {
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=' + Math.max(30, 300 - age),
          'X-Data-Age': String(age),
          'X-Stale': d.stale ? '1' : '0',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'upstream unavailable' }), {
        status: 503,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': '120' },
      });
    }
  },
};
