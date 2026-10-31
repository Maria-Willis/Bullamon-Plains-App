// Shared helpers for the server-side checks added 2026-10-19 (auth.js, private.js).
// Files starting with "_" are not exposed as web addresses by Vercel.
//
// WHAT THIS DOES
//   * Staff access codes are checked HERE, against a scrambled (scrypt) copy kept
//     in the locked table app_secrets -- no longer in the shared app data that every
//     phone downloads.
//   * The Private section's notes, figures and access list live in the locked table
//     private_data and are only handed out by private.js to a person who (a) proved
//     their staff access code, (b) is an admin or on the Private access list, and
//     (c) entered the separate Private code.
//   * "Proof" is a signed token the browser keeps (localStorage), so people stay
//     signed in for months and are NOT asked for their code each time they open the app.
//
// SETTINGS (Vercel > Settings > Environment Variables) -- the same two already used
// for the John Deere link, nothing new needed:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   APP_SESSION_SECRET (optional)  extra secret used to sign tokens; if left out, one is
//                                  derived from the service key (never leaves the server)
//
// TABLES (supabase-private-setup.sql): app_secrets, private_data -- both locked
// (row level security on, no policies, public access revoked).
var crypto = require("crypto");

var SESSION_DAYS = 180;      // how long a staff sign-in proof lasts on a phone
var PRIVATE_DAYS = 14;       // how long the Private unlock is remembered on a device
var MIN_CODE = 4;            // staff access code minimum (same as the app has always had)
var MIN_PRIVATE_CODE = 6;    // Private code minimum
var MAX_CODE = 200;

function cfg(){
  var supaUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  var supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { supaUrl: supaUrl, supaKey: supaKey, secret: process.env.APP_SESSION_SECRET || ("derived|" + supaKey) };
}
function missing(c){
  var m = [];
  if(!c.supaUrl) m.push("SUPABASE_URL");
  if(!c.supaKey) m.push("SUPABASE_SERVICE_ROLE_KEY");
  return m;
}

// An error that means "the one-off database setup hasn't been done" (so the app can carry on the old way)
function setupError(msg){ var e = new Error(msg); e.notConfigured = true; return e; }
// An error with an HTTP status and a message that is safe to show the person
function failure(status, msg, extra){ var e = new Error(msg); e.status = status; e.extra = extra || {}; return e; }

// ---- Supabase REST (service-role key; these tables are not reachable with the app's public key) ----
async function rest(c, method, path, body, prefer){
  var h = { apikey: c.supaKey, Authorization: "Bearer " + c.supaKey };
  if(body !== undefined) h["Content-Type"] = "application/json";
  if(prefer) h.Prefer = prefer;
  var r = await fetch(c.supaUrl + "/rest/v1/" + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  var text = await r.text();
  var json = null;
  try { json = text ? JSON.parse(text) : null; } catch(e){}
  if(!r.ok){
    var code = json && json.code;
    if(r.status === 404 || code === "42P01" || code === "PGRST205" || code === "PGRST106"){
      throw setupError("The one-off database setup hasn't been run yet (table missing). See PRIVATE_SETUP.md.");
    }
    throw new Error("Database said " + r.status + (json && json.message ? ": " + json.message : ""));
  }
  return json;
}
function enc(s){ return encodeURIComponent(s); }

async function secGet(c, id){
  var rows = await rest(c, "GET", "app_secrets?id=eq." + enc(id) + "&select=data");
  return rows && rows[0] ? rows[0].data : null;
}
async function secSet(c, id, data){
  await rest(c, "POST", "app_secrets?on_conflict=id", { id: id, data: data, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
}
async function secDel(c, id){
  await rest(c, "DELETE", "app_secrets?id=eq." + enc(id), undefined, "return=minimal");
}
// Creates the row only if it doesn't exist yet. Returns true if this call created it.
async function secInsertIfAbsent(c, id, data){
  var rows = await rest(c, "POST", "app_secrets?on_conflict=id", { id: id, data: data, updated_at: new Date().toISOString() }, "resolution=ignore-duplicates,return=representation");
  return !!(rows && rows.length);
}
// Compare-and-set on the row's own "seq" number: true if it was updated, false if somebody changed it first.
async function secCas(c, id, seq, data){
  var rows = await rest(c, "PATCH", "app_secrets?id=eq." + enc(id) + "&data-%3E%3Eseq=eq." + enc(String(seq)),
    { data: data, updated_at: new Date().toISOString() }, "return=representation");
  return !!(rows && rows.length);
}
async function pvGet(c){
  var rows = await rest(c, "GET", "private_data?id=eq.main&select=data,version");
  return rows && rows[0] ? rows[0] : null;
}
async function pvInsert(c, data){
  await rest(c, "POST", "private_data?on_conflict=id", { id: "main", data: data, version: 1, updated_at: new Date().toISOString() }, "resolution=ignore-duplicates,return=minimal");
}
// Compare-and-set: returns the new row, or null if somebody saved first.
async function pvCas(c, version, data){
  var rows = await rest(c, "PATCH", "private_data?id=eq.main&version=eq." + version,
    { data: data, version: version + 1, updated_at: new Date().toISOString() }, "return=representation");
  return rows && rows[0] ? rows[0] : null;
}

// Uploaded files for Private (the All Entities 1 Page Info Sheets): each one is its own row in the same locked table,
// id "file_<id>", so a file never counts toward (or slows down) the notes / spreadsheets row above.
async function pvFileGet(c, fid){
  var rows = await rest(c, "GET", "private_data?id=eq." + enc("file_" + fid) + "&select=data");
  return rows && rows[0] ? rows[0].data : null;
}
async function pvFilePut(c, fid, data){
  await rest(c, "POST", "private_data?on_conflict=id", { id: "file_" + fid, data: data, version: 1, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
}
async function pvFileDel(c, fid){
  await rest(c, "DELETE", "private_data?id=eq." + enc("file_" + fid), undefined, "return=minimal");
}

// ---- the shared app data (only the parts we need) ----
async function getTeam(c){
  var rows = await rest(c, "GET", "app_state?id=eq.main&select=team:data->team,version");
  var row = rows && rows[0];
  return (row && Array.isArray(row.team)) ? row.team : [];
}
async function getAppRow(c){
  var rows = await rest(c, "GET", "app_state?id=eq.main&select=data,version");
  return rows && rows[0] ? rows[0] : null;
}
async function appCas(c, version, data){
  var rows = await rest(c, "PATCH", "app_state?id=eq.main&version=eq." + version,
    { data: data, version: version + 1, updated_at: new Date().toISOString() }, "return=representation");
  return rows && rows[0] ? rows[0] : null;
}

// ---- codes (scrypt) ----
function scrypt(pw, salt){
  return new Promise(function(resolve, reject){
    crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, function(err, key){ if(err) reject(err); else resolve(key); });
  });
}
async function hashCode(code){
  var salt = crypto.randomBytes(16);
  var key = await scrypt(code, salt);
  return "s1$" + salt.toString("base64url") + "$" + key.toString("base64url");
}
async function checkCode(code, stored){
  try{
    var p = String(stored || "").split("$");
    if(p.length !== 3 || p[0] !== "s1") return false;
    var salt = Buffer.from(p[1], "base64url"), want = Buffer.from(p[2], "base64url");
    var got = await scrypt(code, salt);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  }catch(e){ return false; }
}
function cleanCode(v){ return String(v == null ? "" : v).trim().slice(0, MAX_CODE); }
function nameKey(name){ return crypto.createHash("sha256").update(String(name)).digest("hex").slice(0, 32); }
function codeId(name){ return "code:" + nameKey(name); }
function pcodeId(name){ return "pcode:" + nameKey(name); }

// ---- signed tokens ----
function sigKey(c){ return crypto.createHash("sha256").update("bp-token-v1|" + c.secret).digest(); }
function makeToken(c, kind, name, days){
  var now = Math.floor(Date.now() / 1000);
  var payload = { k: kind, n: name, i: Date.now(), e: now + Math.round(days * 86400) };
  var p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  var s = crypto.createHmac("sha256", sigKey(c)).update(p).digest("base64url");
  return { token: "v1." + p + "." + s, exp: payload.e * 1000 };
}
function readToken(c, tok, kind){
  try{
    var parts = String(tok || "").split(".");
    if(parts.length !== 3 || parts[0] !== "v1") return null;
    var want = crypto.createHmac("sha256", sigKey(c)).update(parts[1]).digest();
    var got = Buffer.from(parts[2], "base64url");
    if(got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    var payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if(payload.k !== kind || typeof payload.n !== "string") return null;
    if(!(payload.e * 1000 > Date.now())) return null;
    return payload;
  }catch(e){ return null; }
}

// ---- slowing down guessing ----
// Every attempt is counted BEFORE the code is checked, using compare-and-set on the counter row, so a burst of
// parallel guesses can't all slip through on the same count: at most `maxAttempts` get checked per 15 minutes
// per person, then that person is locked out for `lockMs`. A correct code clears the count. If the counter
// can't be written, the attempt fails (it never skips the limit).
var FAIL_WINDOW = 15 * 60 * 1000;
async function throttleBegin(c, key, maxAttempts, lockMs, tooManyText){
  var lead = tooManyText || "Too many wrong codes. Please wait";
  var id = "thr:" + key;
  for(var i = 0; i < 15; i++){
    var rec = await secGet(c, id);
    var now = Date.now();
    if(rec && rec.lockedUntil && rec.lockedUntil > now){
      var mins = Math.max(1, Math.ceil((rec.lockedUntil - now) / 60000));
      throw failure(429, lead + " " + mins + " minute" + (mins === 1 ? "" : "s") + " and try again.");
    }
    var fresh = !!(rec && rec.first && (now - rec.first) < FAIL_WINDOW);
    var n = (fresh ? rec.n : 0) + 1;
    var seq = ((rec && rec.seq) || 0) + 1;
    var locking = n > maxAttempts;
    var next = { n: locking ? 0 : n, first: locking ? 0 : (fresh ? rec.first : now), lockedUntil: locking ? now + lockMs : 0, seq: seq };
    var wrote = rec ? await secCas(c, id, rec.seq || 0, next) : await secInsertIfAbsent(c, id, next);
    if(!wrote) continue;                        // somebody else counted at the same moment: look again
    if(locking){
      var m2 = Math.max(1, Math.ceil(lockMs / 60000));
      throw failure(429, lead + " " + m2 + " minute" + (m2 === 1 ? "" : "s") + " and try again.");
    }
    return;
  }
  throw failure(429, "Too many attempts at once. Please wait a moment and try again.");
}
async function throttleClear(c, key){
  try { await secDel(c, "thr:" + key); } catch(e){}
}

// ---- people ----
function findMember(team, name){
  for(var i = 0; i < team.length; i++) if(team[i] && team[i].name === name) return team[i];
  return null;
}
function privateAllowed(member, access){
  if(!member || !member.active) return false;
  if(member.isAdmin) return true;
  return Array.isArray(access) && access.indexOf(member.name) > -1;
}

// Turns a staff token into the live team member (or throws a "sign in again" failure).
async function authStaff(c, body){
  var tok = readToken(c, body && body.token, "s");
  var again = function(){ return failure(401, "Please confirm your access code again.", { needReauth: true }); };
  if(!tok) throw again();
  // the team and this person's sign-in record are asked for together (they don't depend on each other) -- one wait, not two
  var got = await Promise.all([getTeam(c), secGet(c, codeId(tok.n))]);
  var team = got[0], rec = got[1];
  var member = findMember(team, tok.n);
  if(!member || !member.active) throw again();
  if(rec && rec.nbf && tok.i < rec.nbf) throw again();
  return { name: tok.n, member: member, team: team };
}

// ---- one-off move of old data out of the shared app data ----
// Hashes any plain-text access codes into app_secrets, copies the Private notes /
// figures / access list into private_data, then removes all of it (and the codes)
// from the shared app data. Safe to run again (it just finds nothing to do), and
// it never removes anything from the shared data until the locked copy is saved.
function hasText(v){ return typeof v === "string" && v.trim() !== ""; }
function needsMigration(d){
  if(!d || typeof d !== "object") return false;
  if(Array.isArray(d.team) && d.team.some(function(t){ return t && Object.prototype.hasOwnProperty.call(t, "passcode"); })) return true;
  if(d.privateNotes !== undefined || d.privateInfo !== undefined || d.privateSpreadsheetSummary !== undefined) return true;
  if(d.settings && d.settings.privateAccess !== undefined) return true;
  return false;
}
function stripSecrets(d){
  delete d.privateNotes; delete d.privateInfo; delete d.privateSpreadsheetSummary;
  if(d.settings) delete d.settings.privateAccess;
  (d.team || []).forEach(function(t){
    if(!t) return;
    if(hasText(t.passcode)) t.hasCode = true;
    delete t.passcode;
  });
}
// Hashes any plain-text codes found in `d` (an existing scrambled copy, or a removal marker, always wins).
async function moveCodes(c, d, summary){
  var team = Array.isArray(d.team) ? d.team : [];
  for(var i = 0; i < team.length; i++){
    var t = team[i];
    if(t && hasText(t.passcode)){
      var existing = await secGet(c, codeId(t.name));
      if(!existing){
        var made = await secInsertIfAbsent(c, codeId(t.name), { hash: await hashCode(cleanCode(t.passcode)), updatedAt: new Date().toISOString(), nbf: 0, seq: 0 });
        if(made) summary.codes++;
      }
    }
  }
}
// Copies the Private data in `d` into the locked table, keeping anything the locked copy already has and adding
// whatever it is missing. Returns true when everything in `d` is safely there; throws if it could not be sure.
async function movePrivate(c, d, summary){
  var hasPrivate = d.privateNotes !== undefined || d.privateInfo !== undefined || d.privateSpreadsheetSummary !== undefined || (d.settings && d.settings.privateAccess !== undefined);
  if(!hasPrivate) return;
  var notes = Array.isArray(d.privateNotes) ? d.privateNotes : [];
  var info = (d.privateInfo && typeof d.privateInfo === "object") ? d.privateInfo : null;
  var access = (d.settings && Array.isArray(d.settings.privateAccess)) ? d.settings.privateAccess.slice(0, 2) : [];
  var fresh = { notes: notes, info: info || { groups: [] }, access: access };
  if(d.privateSpreadsheetSummary) fresh.legacySummary = d.privateSpreadsheetSummary;
  await pvInsert(c, fresh);
  for(var attempt = 0; attempt < 8; attempt++){
    var cur = await pvGet(c);
    if(!cur) throw new Error("Private data row missing after insert");
    var cd = cur.data || {};
    var have = {}; (cd.notes || []).forEach(function(n){ if(n && n.id) have[n.id] = true; });
    var missingNotes = notes.filter(function(n){ return n && n.id && !have[n.id]; });
    var curInfoEmpty = !cd.info || !Array.isArray(cd.info.groups) || cd.info.groups.length === 0;
    var needInfo = curInfoEmpty && info && Array.isArray(info.groups) && info.groups.length > 0;
    var needAccess = (!Array.isArray(cd.access) || cd.access.length === 0) && access.length > 0;
    var needLegacy = !cd.legacySummary && !!d.privateSpreadsheetSummary;
    if(!missingNotes.length && !needInfo && !needAccess && !needLegacy) return;
    var merged = Object.assign({}, cd, { notes: (cd.notes || []).concat(missingNotes) });
    if(needInfo) merged.info = info;
    if(needAccess) merged.access = access;
    if(needLegacy) merged.legacySummary = d.privateSpreadsheetSummary;
    if(await pvCas(c, cur.version, merged)){ summary.notes += missingNotes.length; summary.moved = true; return; }
  }
  throw new Error("Could not copy the Private data safely (too many saves at once)");
}
async function migrate(c){
  var summary = { codes: 0, notes: 0, moved: false, stripped: false };
  var row = await getAppRow(c);
  if(!row || !needsMigration(row.data)) return summary;
  // Nothing is removed from the shared data until everything in it is safely in the locked tables (re-checked on
  // every pass, so anything added by an older phone in the meantime is copied too).
  for(var tries = 0; tries < 6; tries++){
    var fresh = tries === 0 ? row : await getAppRow(c);
    if(!fresh || !needsMigration(fresh.data)){ summary.stripped = true; break; }
    await moveCodes(c, fresh.data, summary);
    await movePrivate(c, fresh.data, summary);
    var copy = JSON.parse(JSON.stringify(fresh.data));
    stripSecrets(copy);
    if(await appCas(c, fresh.version, copy)){ summary.stripped = true; summary.moved = summary.moved || (fresh.data.privateNotes !== undefined || fresh.data.privateInfo !== undefined); break; }
  }
  return summary;
}

// ---- request plumbing ----
function wrap(handlerFn){
  return async function(req, res){
    res.setHeader("Cache-Control", "no-store");
    if(req.method !== "POST"){ res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
    var c = cfg();
    var miss = missing(c);
    if(miss.length){ res.status(503).json({ ok: false, notConfigured: true, error: "The server isn't set up for this yet. Missing in Vercel: " + miss.join(", ") + "." }); return; }
    var body = req.body;
    if(typeof body === "string"){ try { body = JSON.parse(body); } catch(e){ body = {}; } }
    body = body || {};
    try{
      var out = await handlerFn(c, body);
      res.status(200).json(Object.assign({ ok: true }, out || {}));
    }catch(err){
      if(err && err.notConfigured){ res.status(503).json({ ok: false, notConfigured: true, error: err.message }); return; }
      if(err && err.status){ res.status(err.status).json(Object.assign({ ok: false, error: err.message }, err.extra || {})); return; }
      console.error("[secure] unexpected error:", err && err.message);
      res.status(500).json({ ok: false, error: "Something went wrong on the server. Please try again." });
    }
  };
}

module.exports = {
  SESSION_DAYS: SESSION_DAYS, PRIVATE_DAYS: PRIVATE_DAYS, MIN_CODE: MIN_CODE, MIN_PRIVATE_CODE: MIN_PRIVATE_CODE,
  cfg: cfg, missing: missing, failure: failure, setupError: setupError, wrap: wrap,
  secGet: secGet, secSet: secSet, secDel: secDel, secInsertIfAbsent: secInsertIfAbsent, secCas: secCas, pvGet: pvGet, pvInsert: pvInsert, pvCas: pvCas, pvFileGet: pvFileGet, pvFilePut: pvFilePut, pvFileDel: pvFileDel,
  getTeam: getTeam, getAppRow: getAppRow, appCas: appCas,
  hashCode: hashCode, checkCode: checkCode, cleanCode: cleanCode, codeId: codeId, pcodeId: pcodeId, nameKey: nameKey,
  makeToken: makeToken, readToken: readToken,
  throttleBegin: throttleBegin, throttleClear: throttleClear,
  findMember: findMember, privateAllowed: privateAllowed, authStaff: authStaff,
  migrate: migrate, needsMigration: needsMigration
};
