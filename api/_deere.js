// Shared helpers for the John Deere Operations Center link (deere-connect.js,
// deere-callback.js, deere-hours.js). Files starting with "_" are not
// exposed as web addresses by Vercel -- this is just a helper module.
//
// Settings (Vercel > Settings > Environment Variables) -- see DEERE_SETUP.md:
//   DEERE_CLIENT_ID, DEERE_CLIENT_SECRET   the Application ID / Secret from
//                                          developer.deere.com (entered by Maria)
//   DEERE_CONNECT_CODE                     a code Maria makes up; needed to start
//                                          (or re-do) the connection so a stranger
//                                          can't point the app at their own Deere
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  where the Deere connection is stored
//                                          (table deere_connection, locked down)
//   DEERE_API_BASE (optional)  default https://sandboxapi.deere.com/platform
//   DEERE_REDIRECT_URI (optional) default https://bullamon-plains-app.vercel.app/api/deere-callback
var AUTH_BASE = "https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7";
var SCOPES = "org1 eq1 offline_access";
var ACCEPT = "application/vnd.deere.axiom.v3+json";

function cfg(){
  return {
    clientId: process.env.DEERE_CLIENT_ID || "",
    clientSecret: process.env.DEERE_CLIENT_SECRET || "",
    connectCode: process.env.DEERE_CONNECT_CODE || "",
    supaUrl: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    supaKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    apiBase: (process.env.DEERE_API_BASE || "https://sandboxapi.deere.com/platform").replace(/\/+$/, ""),
    redirectUri: process.env.DEERE_REDIRECT_URI || "https://bullamon-plains-app.vercel.app/api/deere-callback",
    // The Equipment API (list of machines) is on its own address, not under /platform.
    equipmentBase: (process.env.DEERE_EQUIPMENT_BASE || "https://equipmentapi.deere.com/isg").replace(/\/+$/, "")
  };
}
function missing(c, needConnectCode){
  var m = [];
  if(!c.clientId) m.push("DEERE_CLIENT_ID");
  if(!c.clientSecret) m.push("DEERE_CLIENT_SECRET");
  if(!c.supaUrl) m.push("SUPABASE_URL");
  if(!c.supaKey) m.push("SUPABASE_SERVICE_ROLE_KEY");
  if(needConnectCode && !c.connectCode) m.push("DEERE_CONNECT_CODE");
  return m;
}

// ---- storage (Supabase REST with the service-role key; table is not readable by the app's public key) ----
async function dbGet(c, id){
  var r = await fetch(c.supaUrl + "/rest/v1/deere_connection?id=eq." + encodeURIComponent(id) + "&select=data", {
    headers: { apikey: c.supaKey, Authorization: "Bearer " + c.supaKey }
  });
  if(!r.ok) throw new Error("Couldn't read the stored John Deere connection (database said " + r.status + "). Has the deere_connection table been created? See DEERE_SETUP.md.");
  var rows = await r.json();
  return rows && rows[0] ? rows[0].data : null;
}
async function dbSet(c, id, data){
  var r = await fetch(c.supaUrl + "/rest/v1/deere_connection?on_conflict=id", {
    method: "POST",
    headers: { apikey: c.supaKey, Authorization: "Bearer " + c.supaKey, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: id, data: data, updated_at: new Date().toISOString() })
  });
  if(!r.ok) throw new Error("Couldn't save the John Deere connection (database said " + r.status + "). Has the deere_connection table been created? See DEERE_SETUP.md.");
}

// ---- OAuth ----
function authorizeUrl(c, state){
  return AUTH_BASE + "/v1/authorize?response_type=code&scope=" + encodeURIComponent(SCOPES) +
    "&client_id=" + encodeURIComponent(c.clientId) + "&state=" + encodeURIComponent(state) +
    "&redirect_uri=" + encodeURIComponent(c.redirectUri);
}
async function tokenRequest(c, params){
  var body = new URLSearchParams(params);
  body.set("client_id", c.clientId);
  body.set("client_secret", c.clientSecret);
  var r = await fetch(AUTH_BASE + "/v1/token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  var j = {};
  try { j = await r.json(); } catch(e){}
  if(!r.ok || !j.access_token) throw new Error("John Deere refused the sign-in (" + r.status + (j.error_description ? ": " + j.error_description : j.error ? ": " + j.error : "") + ").");
  return j;
}
function tokensToRecord(j, prev){
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || (prev && prev.refreshToken) || "",
    expiresAt: Date.now() + ((Number(j.expires_in) || 43200) - 120) * 1000,
    scope: j.scope || (prev && prev.scope) || "",
    connectedAt: (prev && prev.connectedAt) || new Date().toISOString(),
    refreshedAt: new Date().toISOString()
  };
}
// Returns a valid access token, refreshing (and saving the new one) if needed.
async function getAccessToken(c){
  var rec = await dbGet(c, "main");
  if(!rec || !rec.accessToken) return { rec: null, token: "" };
  if(Date.now() < rec.expiresAt) return { rec: rec, token: rec.accessToken };
  if(!rec.refreshToken) throw new Error("The John Deere connection has expired. Tap Connect John Deere to sign in again.");
  var j;
  try {
    j = await tokenRequest(c, { grant_type: "refresh_token", refresh_token: rec.refreshToken, redirect_uri: c.redirectUri, scope: SCOPES });
  } catch(e){
    throw new Error("The John Deere connection needs to be set up again (" + e.message + ") Tap Connect John Deere.");
  }
  var next = tokensToRecord(j, rec);
  await dbSet(c, "main", next);
  return { rec: next, token: next.accessToken };
}

// ---- API ----
async function deereGet(c, token, urlOrPath, accept){
  var url = /^https?:/i.test(urlOrPath) ? urlOrPath : c.apiBase + urlOrPath;
  var r = await fetch(url, { headers: { Authorization: "Bearer " + token, Accept: accept || ACCEPT, "Accept-Encoding": "gzip" } });
  var text = await r.text();
  var j = null;
  try { j = text ? JSON.parse(text) : null; } catch(e){}
  return { status: r.status, json: j, text: text.slice(0, 400), warning: r.headers.get("x-deere-warning") || "", termsUrl: r.headers.get("x-deere-terms-location") || "" };
}
function linkOf(obj, rel){
  var ls = (obj && obj.links) || [];
  for(var i = 0; i < ls.length; i++) if(ls[i].rel === rel) return ls[i].uri;
  return "";
}
// Follows nextPage links, returns all "values".
async function deereList(c, token, urlOrPath, maxPages, accept){
  var out = [], url = urlOrPath, pages = 0, last = null;
  while(url && pages < (maxPages || 10)){
    var r = await deereGet(c, token, url, accept);
    last = r;
    if(r.status !== 200 || !r.json) return { ok: false, status: r.status, text: r.text, warning: r.warning, termsUrl: r.termsUrl, values: out };
    var vals = Array.isArray(r.json) ? r.json : (r.json.values || []);
    out = out.concat(vals);
    url = linkOf(r.json, "nextPage");
    pages++;
  }
  return { ok: true, status: 200, values: out };
}
function readingOf(item){
  // engine hours item: { reading: { valueAsDouble, unit }, reportTime, ... }
  if(!item) return null;
  var r = item.reading || item.value || item;
  var v = r.valueAsDouble != null ? r.valueAsDouble : r.valueAsInteger != null ? r.valueAsInteger : r.value != null ? r.value : null;
  v = Number(v);
  return isFinite(v) ? v : null;
}

// Reads every connected organization's machines and their latest engine hours.
// Returns { ok:true, machines, notes, orgs, debug } or { ok:false, status, error, notConnected?, termsUrl? }.
async function fetchHours(c, token){
  var orgRes = await deereList(c, token, "/organizations?itemLimit=100", 3);
  if(!orgRes.ok) return { ok: false, status: 502, error: "John Deere wouldn't list the organizations (" + orgRes.status + "). " + (orgRes.warning || orgRes.text || ""), termsUrl: orgRes.termsUrl || undefined };
  var enabled = orgRes.values.filter(function(o){ return !linkOf(o, "connections") || linkOf(o, "manage_connections"); });
  if(!enabled.length) return { ok: false, status: 409, notConnected: true, error: "No John Deere organization is shared with the app yet. Tap Connect John Deere and choose the Bullamon organization." };
  var machines = [], notes = [], debug = [];
  for(var oi = 0; oi < enabled.length; oi++){
    var org = enabled[oi];
    // The Equipment API lives on its own address (equipmentapi.deere.com/isg), not under /platform.
    var ml = await deereList(c, token, c.equipmentBase + "/equipment?organizationIds=" + encodeURIComponent(org.id) + "&categories=Machine&archived=false&itemLimit=200", 10, "application/json");
    if(!ml.ok){
      notes.push("Couldn't list machines for " + (org.name || org.id) + " (" + ml.status + ")" + (ml.warning ? ": " + ml.warning : "") + (ml.text ? " " + String(ml.text).slice(0, 160) : ""));
      debug.push({ org: org.id, call: "equipment", status: ml.status, text: ml.text });
      continue;
    }
    var list = ml.values;
    if(list[0]) debug.push({ org: org.id, machineSampleKeys: Object.keys(list[0]) });
    for(var i = 0; i < list.length; i += 6){
      var got = await Promise.all(list.slice(i, i + 6).map(async function(m){
        var tries = [];
        var lk = linkOf(m, "engineHours"); if(lk) tries.push(lk);
        [m.principalId, m.id].forEach(function(x){ if(x != null && x !== ""){ var u = c.apiBase + "/machines/" + encodeURIComponent(x) + "/engineHours"; if(tries.indexOf(u) < 0) tries.push(u); } });
        var lastErr = "no id";
        for(var t = 0; t < tries.length; t++){
          try {
            var r = await deereGet(c, token, tries[t]);
            if(r.status !== 200 || !r.json){ lastErr = r.status; continue; }
            var item = Array.isArray(r.json) ? r.json[0] : (r.json.values ? r.json.values[0] : r.json);
            var hrs = readingOf(item);
            if(hrs == null){ lastErr = "no reading"; continue; }
            return { m: m, hours: hrs, updated: item && (item.reportTime || item.reportedTime || item.time) || "" };
          } catch(e){ lastErr = "network"; }
        }
        return { m: m, err: lastErr };
      }));
      got.forEach(function(g){
        var nm = g.m.name || g.m.nickname || g.m.serialNumber || g.m.vin || ("Machine " + g.m.id);
        var pin = g.m.serialNumber || g.m.vin || g.m.pin || "";
        if(g.hours == null || g.hours <= 0){ machines.push({ name: nm, pin: pin, hours: null, updated: "", problem: g.err ? ("HTTP " + g.err) : "no hours reported" }); return; }
        machines.push({ name: nm, pin: pin, hours: Math.round(g.hours * 10) / 10, updated: g.updated ? String(g.updated).slice(0, 16).replace("T", " ") : "" });
      });
    }
  }
  var any = machines.filter(function(x){ return x.hours != null; }).length;
  return { ok: true, machines: machines, notes: notes, orgs: enabled.map(function(o){ return o.name || o.id; }), debug: any ? undefined : debug };
}
module.exports = { fetchHours: fetchHours, cfg: cfg, missing: missing, dbGet: dbGet, dbSet: dbSet, authorizeUrl: authorizeUrl, tokenRequest: tokenRequest,
  tokensToRecord: tokensToRecord, getAccessToken: getAccessToken, deereGet: deereGet, deereList: deereList, linkOf: linkOf, readingOf: readingOf, SCOPES: SCOPES };
