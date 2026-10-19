// Daily automatic update of machine engine hours from John Deere.
// Vercel Cron calls this once a day (see vercel.json); it can also be run by
// hand with the same secret. It reads each machine's latest hours and saves
// them into the app's shared data -- ONLY each matched machine's hour reading
// (plus the Deere PIN and a "hours from John Deere" note), and ONLY when
// John Deere's number is higher than the app's. Service schedules, hand-set
// due hours, reminders, part schedules and history are never touched, and a
// machine that can't be matched exactly (by saved Deere PIN, else by name
// ignoring case/spaces/punctuation) is left alone. Needs CRON_SECRET set in
// Vercel (Vercel then sends it with each scheduled call). See DEERE_SETUP.md.
var crypto = require("crypto");
var D = require("./_deere");

function norm(s){ return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, ""); }

// Pure: applies Deere machines to a copy of state. Returns { changed, names, skipped }.
function applyHours(state, deereMachines, todayISO){
  var active = (state.machinery || []).filter(function(m){ return m.status !== "archived"; });
  var used = {}, names = [], skipped = [];
  deereMachines.forEach(function(d){
    if(d.hours == null || !(d.hours > 0)) return;
    var matches = active.filter(function(m){ return d.pin && m.deerePin && m.deerePin === d.pin; });
    var byPin = matches.length === 1;
    if(!byPin) matches = active.filter(function(m){ return norm(m.name) === norm(d.name); });
    if(matches.length !== 1){ skipped.push(d.name); return; }
    var m = matches[0];
    if(used[m.id]) return;
    used[m.id] = true;
    var cur = Number(m.currentReading) || 0;
    if(!(d.hours > cur)) return;               // never lower a reading automatically
    m.currentReading = d.hours;
    if(d.pin) m.deerePin = d.pin;
    m.hoursSource = { source: "John Deere Operations Center", date: todayISO, updated: d.updated || "", hours: d.hours };
    names.push(m.name);
  });
  return { changed: names.length, names: names, skipped: skipped };
}

async function readState(c){
  var r = await fetch(c.supaUrl + "/rest/v1/app_state?id=eq.main&select=data,version", { headers: { apikey: c.supaKey, Authorization: "Bearer " + c.supaKey } });
  if(!r.ok) throw new Error("Couldn't read the app data (" + r.status + ").");
  var rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}
// Compare-and-set: only writes if nobody saved in between (same rule the app uses).
async function writeState(c, data, version){
  var r = await fetch(c.supaUrl + "/rest/v1/app_state?id=eq.main&version=eq." + version, {
    method: "PATCH",
    headers: { apikey: c.supaKey, Authorization: "Bearer " + c.supaKey, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ data: data, version: version + 1, updated_at: new Date().toISOString() })
  });
  if(!r.ok) throw new Error("Couldn't save the new hours (" + r.status + ").");
  var rows = await r.json();
  return Array.isArray(rows) && rows.length === 1;
}

module.exports = async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  var secret = process.env.CRON_SECRET || "";
  var given = String((req.headers && req.headers.authorization) || "").replace(/^Bearer\s+/i, "");
  var a = Buffer.from(given), b = Buffer.from(secret);
  if(!secret || a.length !== b.length || !crypto.timingSafeEqual(a, b)){ res.status(401).json({ error: "Not allowed." }); return; }
  var c = D.cfg();
  var miss = D.missing(c, false);
  if(miss.length){ res.status(500).json({ error: "Missing in Vercel: " + miss.join(", ") }); return; }
  try {
    var acc = await D.getAccessToken(c);
    if(!acc.token){ res.status(200).json({ ok: false, reason: "John Deere isn't connected." }); return; }
    var r = await D.fetchHours(c, acc.token);
    if(!r.ok){ await note(c, { ok: false, error: r.error }); res.status(200).json({ ok: false, reason: r.error }); return; }
    var today = new Date().toISOString().slice(0, 10);
    for(var attempt = 0; attempt < 4; attempt++){
      var row = await readState(c);
      if(!row || !row.data){ res.status(200).json({ ok: false, reason: "No app data found." }); return; }
      var st = JSON.parse(JSON.stringify(row.data));
      var out = applyHours(st, r.machines, today);
      if(!out.changed){
        await note(c, { ok: true, updated: 0, skipped: out.skipped });
        res.status(200).json({ ok: true, updated: 0, skipped: out.skipped, machinesFromDeere: r.machines.length });
        return;
      }
      st.deereAutoSync = { at: new Date().toISOString(), n: out.changed, names: out.names };
      if(await writeState(c, st, row.version)){
        await note(c, { ok: true, updated: out.changed });
        res.status(200).json({ ok: true, updated: out.changed, names: out.names, skipped: out.skipped });
        return;
      }
      // someone saved in between -- loop: re-read the newest copy and apply again
    }
    res.status(200).json({ ok: false, reason: "The app was being saved too often to update; will try again tomorrow." });
  } catch(err){
    res.status(500).json({ error: err.message || "Automatic update failed." });
  }
};
// Remembers the last run so the app can show it (kept in the locked-down deere_connection table).
async function note(c, info){
  try { info.at = new Date().toISOString(); await D.dbSet(c, "lastsync", info); } catch(e){}
}
module.exports.applyHours = applyHours;
