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
    redirectUri: process.env.DEERE_REDIRECT_URI || "https://bullamon-plains-app.vercel.app/api/deere-callback"
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
async function deereGet(c, token, urlOrPath){
  var url = /^https?:/i.test(urlOrPath) ? urlOrPath : c.apiBase + urlOrPath;
  var r = await fetch(url, { headers: { Authorization: "Bearer " + token, Accept: ACCEPT, "Accept-Encoding": "gzip" } });
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
async function deereList(c, token, urlOrPath, maxPages){
  var out = [], url = urlOrPath, pages = 0, last = null;
  while(url && pages < (maxPages || 10)){
    var r = await deereGet(c, token, url);
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
module.exports = { cfg: cfg, missing: missing, dbGet: dbGet, dbSet: dbSet, authorizeUrl: authorizeUrl, tokenRequest: tokenRequest,
  tokensToRecord: tokensToRecord, getAccessToken: getAccessToken, deereGet: deereGet, deereList: deereList, linkOf: linkOf, readingOf: readingOf, SCOPES: SCOPES };
