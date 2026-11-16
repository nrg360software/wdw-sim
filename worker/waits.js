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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    if (url.pathname === '/') return new Response('WDW Sim live waits relay. Data powered by Queue-Times.com', { headers: { 'Content-Type': 'text/plain' } });
    if (url.pathname !== '/waits') return new Response('Not found', { status: 404, headers: cors });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (tooMany(ip)) return new Response('Too many requests', { status: 429, headers: { ...cors, 'Retry-After': '60' } });

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
