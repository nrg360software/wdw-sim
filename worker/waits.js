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
// Phone alerts (Web Push to the Home Screen app, needs the same D1 database):
//  - Add a second cron trigger "* * * * *" (every minute) next to "*/5 * * * *".
//    The every-minute run only sends alerts that are due; Queue-Times is still
//    fetched only on the 5-minute run.
//  - GET  /push/key    the public key the game subscribes with. The key pair is
//                      made by the Worker on first use and kept in D1, so there
//                      is no secret to set up.
//  - POST /push/sync   {sub, items:[{k,at,title,body,tag}], watch:[{park,name,label,until}]}
//                      replaces this phone's pending alerts and watched rides.
//  - POST /push/test   sends one alert now.   POST /push/off  forgets this phone.
//  - Safeguards: only Apple/Google/Mozilla/Microsoft push addresses are accepted
//    (no open relay), at most 40 alerts and 12 watched rides per phone, alerts
//    only for the next 20 hours, at most 200 phones, an alert more than 15 min
//    late is dropped instead of sent, and a phone the push service says is gone
//    is deleted. The push tables are created automatically.
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
    h['Access-Control-Allow-Methods'] = 'GET, POST';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
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
  try { await pushWatch(env, parks); } catch (e) { console.log('watch', e && e.message); }
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


// ---- phone alerts (Web Push: RFC 8291 encryption + RFC 8292 VAPID, WebCrypto only)
const PUSH_HOSTS = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)$/;
const PUSH_MAX_ITEMS = 40, PUSH_MAX_WATCH = 12, PUSH_MAX_SUBS = 200, PUSH_AHEAD_MS = 20 * 3600e3, PUSH_LATE_MS = 15 * 60e3;
const VAPID_SUB = 'https://nrg360software.github.io/wdw-sim/';
const te = new TextEncoder();
const b64u = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (str) => { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4)); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(key, data) { const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, data)); }

let pushReady = null, vapid = null;
function pushTables(env) {
  if (!pushReady) pushReady = env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS push_keys (id INTEGER PRIMARY KEY, pub TEXT NOT NULL, priv TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS push_subs (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created INTEGER, seen INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS push_items (sub TEXT NOT NULL, k TEXT NOT NULL, at INTEGER NOT NULL, title TEXT, body TEXT, tag TEXT, sent INTEGER DEFAULT 0, PRIMARY KEY (sub, k))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS push_items_due ON push_items (sent, at)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS push_watch (sub TEXT NOT NULL, park TEXT NOT NULL, name TEXT NOT NULL, label TEXT, until INTEGER, state INTEGER, PRIMARY KEY (sub, park, name))'),
  ]).catch(e => { pushReady = null; throw e; });
  return pushReady;
}
async function getVapid(env) {
  if (vapid) return vapid;
  await pushTables(env);
  let row = await env.DB.prepare('SELECT pub, priv FROM push_keys WHERE id = 1').first();
  if (!row) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), priv = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey));
    await env.DB.prepare('INSERT OR IGNORE INTO push_keys (id, pub, priv) VALUES (1, ?1, ?2)').bind(pub, priv).run();
    row = await env.DB.prepare('SELECT pub, priv FROM push_keys WHERE id = 1').first();
  }
  const key = await crypto.subtle.importKey('jwk', JSON.parse(row.priv), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapid = { pub: row.pub, key };
  return vapid;
}
async function vapidAuth(v, endpoint) {
  const aud = new URL(endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.key, te.encode(head + '.' + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pub}`;
}
// aes128gcm body for one subscription (RFC 8291)
async function encryptPush(sub, payload) {
  const uaPub = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, cat(te.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(payload), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}
async function sendPush(env, sub, msg, ttl = 900) {
  const v = await getVapid(env);
  const body = await encryptPush(sub, JSON.stringify(msg));
  const r = await fetch(sub.endpoint, {
    method: 'POST', body,
    headers: { 'Authorization': await vapidAuth(v, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': String(ttl), 'Urgency': 'high' },
  });
  if (r.status === 404 || r.status === 410) { await pushForget(env, sub.id); return 'gone'; }
  return r.ok ? 'ok' : 'HTTP ' + r.status;
}
async function pushForget(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM push_subs WHERE id = ?1').bind(id),
    env.DB.prepare('DELETE FROM push_items WHERE sub = ?1').bind(id),
    env.DB.prepare('DELETE FROM push_watch WHERE sub = ?1').bind(id),
  ]);
}
async function subId(endpoint) { return b64u((await crypto.subtle.digest('SHA-256', te.encode(endpoint))).slice(0, 18)); }
function cleanSub(s) {
  if (!s || typeof s.endpoint !== 'string' || !s.keys) return null;
  let u; try { u = new URL(s.endpoint); } catch (e) { return null; }
  if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname) || s.endpoint.length > 1000) return null;
  const p = String(s.keys.p256dh || ''), a = String(s.keys.auth || '');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p) || !/^[A-Za-z0-9_-]{16,32}$/.test(a)) return null;
  return { endpoint: s.endpoint, p256dh: p, auth: a };
}
const txt = (x, n) => String(x == null ? '' : x).slice(0, n);
async function pushApi(request, env, url, cors) {
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!env || !env.DB) return json({ error: 'alerts need the D1 database' }, 501);
  if (url.pathname === '/push/key') return json({ key: (await getVapid(env)).pub });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json') && !ct.includes('text/plain')) return json({ error: 'JSON only' }, 415);
  const raw = await request.text();
  if (raw.length > 40000) return json({ error: 'too big' }, 413);
  let d; try { d = JSON.parse(raw); } catch (e) { return json({ error: 'bad JSON' }, 400); }
  const sub = cleanSub(d.sub);
  if (!sub) return json({ error: 'bad subscription' }, 400);
  await pushTables(env);
  const id = await subId(sub.endpoint), now = Date.now();
  if (url.pathname === '/push/off') { await pushForget(env, id); return json({ ok: true }); }
  const known = await env.DB.prepare('SELECT id FROM push_subs WHERE id = ?1').bind(id).first();
  if (!known) {
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
    if (n && n.n >= PUSH_MAX_SUBS) return json({ error: 'alerts are full' }, 503);
  }
  await env.DB.prepare('INSERT INTO push_subs (id, endpoint, p256dh, auth, created, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?5) ON CONFLICT(id) DO UPDATE SET endpoint = ?2, p256dh = ?3, auth = ?4, seen = ?5')
    .bind(id, sub.endpoint, sub.p256dh, sub.auth, now).run();
  if (url.pathname === '/push/test') {
    const r = await sendPush(env, { id, ...sub }, { title: 'WDW Sim alerts are on', body: 'You’ll get Lightning Lane, leave-now and ride-down alerts here on a real-time day.', tag: 'test' }, 300);
    return json({ ok: r === 'ok', result: r }, r === 'ok' ? 200 : 502);
  }
  if (url.pathname !== '/push/sync') return json({ error: 'not found' }, 404);
  const items = (Array.isArray(d.items) ? d.items : []).slice(0, PUSH_MAX_ITEMS)
    .map(x => ({ k: txt(x.k, 60), at: Math.round(+x.at), title: txt(x.title, 80), body: txt(x.body, 220), tag: txt(x.tag, 40) }))
    .filter(x => x.k && x.title && x.at > now - PUSH_LATE_MS && x.at < now + PUSH_AHEAD_MS);
  const watch = (Array.isArray(d.watch) ? d.watch : []).slice(0, PUSH_MAX_WATCH)
    .map(x => ({ park: txt(x.park, 4), name: txt(x.name, 120), label: txt(x.label, 60), until: Math.round(+x.until) }))
    .filter(x => (x.park in PARKS) && x.name && x.until > now && x.until < now + PUSH_AHEAD_MS);
  const st = [];
  // pending alerts: keep already-sent ones (so a re-sync doesn't repeat them), replace the rest
  st.push(env.DB.prepare('DELETE FROM push_items WHERE sub = ?1 AND (sent = 0 OR at < ?2)').bind(id, now - 86400e3));
  for (const x of items) st.push(env.DB.prepare('INSERT INTO push_items (sub, k, at, title, body, tag, sent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0) ON CONFLICT(sub, k) DO NOTHING')
    .bind(id, x.k, x.at, x.title, x.body, x.tag));
  // watched rides: keep the last seen state of rides still watched
  const keep = watch.map(w => w.park + '|' + w.name);
  const old = await env.DB.prepare('SELECT park, name FROM push_watch WHERE sub = ?1').bind(id).all();
  for (const o of old.results || []) if (!keep.includes(o.park + '|' + o.name)) st.push(env.DB.prepare('DELETE FROM push_watch WHERE sub = ?1 AND park = ?2 AND name = ?3').bind(id, o.park, o.name));
  for (const w of watch) st.push(env.DB.prepare('INSERT INTO push_watch (sub, park, name, label, until, state) VALUES (?1, ?2, ?3, ?4, ?5, NULL) ON CONFLICT(sub, park, name) DO UPDATE SET label = ?4, until = ?5')
    .bind(id, w.park, w.name, w.label, w.until));
  await env.DB.batch(st);
  return json({ ok: true, items: items.length, watch: watch.length });
}
// every minute: send what's due
async function pushDue(env, now = Date.now()) {
  if (!env || !env.DB) return;
  await pushTables(env);
  const r = await env.DB.prepare('SELECT i.sub, i.k, i.at, i.title, i.body, i.tag, s.endpoint, s.p256dh, s.auth FROM push_items i JOIN push_subs s ON s.id = i.sub WHERE i.sent = 0 AND i.at <= ?1 ORDER BY i.at LIMIT 40').bind(now).all();
  const rows = r.results || [];
  for (const x of rows) {
    await env.DB.prepare('UPDATE push_items SET sent = 1 WHERE sub = ?1 AND k = ?2').bind(x.sub, x.k).run();
    if (x.at < now - PUSH_LATE_MS) continue;                 // too late to be useful
    try { await sendPush(env, { id: x.sub, endpoint: x.endpoint, p256dh: x.p256dh, auth: x.auth }, { title: x.title, body: x.body, tag: x.tag || x.k }, 900); }
    catch (e) { console.log('push', e && e.message); }
  }
  if (new Date(now).getUTCMinutes() === 7) await env.DB.batch([
    env.DB.prepare('DELETE FROM push_items WHERE at < ?1').bind(now - 2 * 86400e3),
    env.DB.prepare('DELETE FROM push_watch WHERE until < ?1').bind(now),
    env.DB.prepare('DELETE FROM push_subs WHERE seen < ?1').bind(now - 30 * 86400e3),
  ]);
}
// every 5 minutes, with the fresh feed: watched rides going down / coming back
async function pushWatch(env, parks) {
  await pushTables(env);
  const now = Date.now();
  const r = await env.DB.prepare('SELECT w.sub, w.park, w.name, w.label, w.state, s.endpoint, s.p256dh, s.auth FROM push_watch w JOIN push_subs s ON s.id = w.sub WHERE w.until > ?1').bind(now).all();
  for (const w of r.results || []) {
    const rows = parks[w.park] || [];
    if (!rows.some(x => x[1])) continue;                     // park closed: say nothing, keep the state
    const row = rows.find(x => x[0] === w.name);
    if (!row) continue;
    const open = row[1] ? 1 : 0;
    if (w.state === open) continue;
    await env.DB.prepare('UPDATE push_watch SET state = ?4 WHERE sub = ?1 AND park = ?2 AND name = ?3').bind(w.sub, w.park, w.name, open).run();
    if (w.state === null) continue;                          // first look: just remember it
    const label = w.label || w.name;
    const msg = open ? { title: `${label} is back up`, body: 'Open WDW Sim to fit it back into your plan.', tag: 'up-' + w.name }
                     : { title: `${label} is down`, body: 'Open WDW Sim: it will replan around it. Lightning Lane holders may get a Multiple Experience Pass.', tag: 'down-' + w.name };
    try { await sendPush(env, { id: w.sub, endpoint: w.endpoint, p256dh: w.p256dh, auth: w.auth }, msg, 1200); } catch (e) { console.log('watch push', e && e.message); }
  }
}

export { encryptPush, vapidAuth, cleanSub, b64u, unb64u };

export default {
  async scheduled(event, env, ctx) {
    const when = new Date(event.scheduledTime || Date.now());
    // "* * * * *" = alerts only; the 5-minute trigger records waits (and checks watched rides) too
    if (event.cron !== '* * * * *') ctx.waitUntil(record(env, when));
    ctx.waitUntil(pushDue(env, when.getTime()).catch(e => console.log('pushDue', e && e.message)));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname.startsWith('/push/')) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (tooMany(ip)) return new Response('Too many requests', { status: 429, headers: { ...cors, 'Retry-After': '60' } });
      if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });
      try { return await pushApi(request, env, url, cors); }
      catch (e) { return new Response(JSON.stringify({ error: 'alerts unavailable' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }); }
    }
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
