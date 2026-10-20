// The Private section's data, served only to the right people (added 2026-10-19).
// Notes, the Cropping Summary and the access list live in the locked table
// private_data -- never in the shared app data. Every request must carry:
//   token   proof of the staff sign-in (from auth.js)
//   ptoken  proof of the separate Private code (from "unlock" below) -- except unlock/access
// and the person must be an admin or on the access list, checked fresh each time.
//
// POST body {action: ...}
//   access     {token, ptoken?}            -> {allowed, hasCode, unlocked}
//   unlock     {token, pcode, create?}     -> {ptoken, exp}    (create:true sets the first Private code; the account must already have its own access code)
//   changeCode {token, current, newCode}   -> {ptoken, exp}
//   resetCode  {token, ptoken, name}       admin: clears someone's Private code so they can set a new one
//   get        {token, ptoken}             -> {notes, info, version, isAdmin, access?}
//   save       {token, ptoken, notes, info, baseVersion}  -> {version} | {conflict:true, notes, info, version}
//   setAccess  {token, ptoken, names}      admin: who (besides admins) can open Private (max 2)
var S = require("./_secure");

var UNLOCK_MAX_ATTEMPTS = 5, UNLOCK_LOCK_MS = 15 * 60 * 1000;
var MAX_BYTES = 900 * 1024;

function emptyData(){ return { notes: [], info: { groups: [] }, access: [] }; }

async function loadRow(c){
  var row = await S.pvGet(c);
  if(!row){
    await S.migrate(c);              // if the old data hasn't been moved yet, move it before anything creates an empty row
    row = await S.pvGet(c);
  }
  if(!row){
    await S.pvInsert(c, emptyData());
    row = await S.pvGet(c);
  }
  if(!row) throw S.failure(500, "Couldn't open the Private data.");
  row.data = Object.assign(emptyData(), row.data || {});
  return row;
}

// who + allowed, from the staff token
async function whoAllowed(c, body){
  var a = await S.authStaff(c, body);
  var row = await loadRow(c);
  if(!S.privateAllowed(a.member, row.data.access)){
    throw S.failure(403, "You don't have access to Private.", { denied: true });
  }
  return { a: a, row: row };
}
// who + allowed + unlocked with the Private code
async function unlocked(c, body){
  var w = await whoAllowed(c, body);
  var pt = S.readToken(c, body.ptoken, "p");
  var again = function(){ return S.failure(401, "Please enter your Private code.", { needUnlock: true }); };
  if(!pt || pt.n !== w.a.name) throw again();
  var prec = await S.secGet(c, S.pcodeId(w.a.name));
  if(!prec || !prec.hash || (prec.nbf && pt.i < prec.nbf)) throw again();
  return w;
}
function checkShape(body){
  var notes = body.notes, info = body.info;
  if(!Array.isArray(notes) || !info || typeof info !== "object" || Array.isArray(info)) throw S.failure(400, "That doesn't look like Private data.");
  if(!Array.isArray(info.groups)) info.groups = [];
  if(JSON.stringify({ n: notes, i: info }).length > MAX_BYTES) throw S.failure(413, "That's too much to save in Private. Remove something first.");
  return { notes: notes, info: info };
}

module.exports = S.wrap(async function(c, body){
  var action = body.action;

  if(action === "access"){
    var a = await S.authStaff(c, body);
    var row = await loadRow(c);
    var allowed = S.privateAllowed(a.member, row.data.access);
    if(!allowed) return { allowed: false };
    var prec = await S.secGet(c, S.pcodeId(a.name));
    var srec = await S.secGet(c, S.codeId(a.name));
    var pt = S.readToken(c, body.ptoken, "p");
    var isUnlocked = !!(pt && pt.n === a.name && prec && prec.hash && !(prec.nbf && pt.i < prec.nbf));
    return { allowed: true, hasCode: !!(prec && prec.hash), unlocked: isUnlocked, hasStaffCode: !!(srec && srec.hash) };
  }

  if(action === "unlock"){
    var w = await whoAllowed(c, body);
    var name = w.a.name;
    var rec = await S.secGet(c, S.pcodeId(name));
    var code = S.cleanCode(body.pcode);
    if(!rec || !rec.hash){
      // The first Private code can only be set on an account that has its own access code -- otherwise anyone
      // could sign in as that person (no code needed) and claim their Private code before they do.
      var srec = await S.secGet(c, S.codeId(name));
      if(!srec || !srec.hash) throw S.failure(403, "Set an access code for your account first (\"Change my access code\"), then open Private again.", { needStaffCode: true });
      if(!body.create) return { needsCreate: true };
      if(code.length < S.MIN_PRIVATE_CODE) throw S.failure(400, "The Private code needs at least " + S.MIN_PRIVATE_CODE + " characters.");
      await S.secSet(c, S.pcodeId(name), { hash: await S.hashCode(code), updatedAt: new Date().toISOString(), nbf: Date.now() });
    } else {
      if(body.create) throw S.failure(409, "A Private code is already set. Enter it to open Private.");
      var key = "p:" + S.nameKey(name);
      await S.throttleBegin(c, key, UNLOCK_MAX_ATTEMPTS, UNLOCK_LOCK_MS);
      if(!(await S.checkCode(code, rec.hash))) throw S.failure(401, "That Private code doesn't match.", { badCode: true });
      await S.throttleClear(c, key);
    }
    var t = S.makeToken(c, "p", name, S.PRIVATE_DAYS);
    return { ptoken: t.token, exp: t.exp };
  }

  if(action === "changeCode"){
    var w2 = await whoAllowed(c, body);
    var rec2 = await S.secGet(c, S.pcodeId(w2.a.name));
    if(!rec2 || !rec2.hash) throw S.failure(400, "No Private code is set yet.");
    var key2 = "p:" + S.nameKey(w2.a.name);
    await S.throttleBegin(c, key2, UNLOCK_MAX_ATTEMPTS, UNLOCK_LOCK_MS);
    if(!(await S.checkCode(S.cleanCode(body.current), rec2.hash))) throw S.failure(401, "Your current Private code doesn't match.", { badCode: true });
    await S.throttleClear(c, key2);
    var nv = S.cleanCode(body.newCode);
    if(nv.length < S.MIN_PRIVATE_CODE) throw S.failure(400, "The new Private code needs at least " + S.MIN_PRIVATE_CODE + " characters.");
    await S.secSet(c, S.pcodeId(w2.a.name), { hash: await S.hashCode(nv), updatedAt: new Date().toISOString(), nbf: Date.now() });
    var t2 = S.makeToken(c, "p", w2.a.name, S.PRIVATE_DAYS);
    return { ptoken: t2.token, exp: t2.exp };
  }

  if(action === "resetCode"){
    var w3 = await unlocked(c, body);
    if(!w3.a.member.isAdmin) throw S.failure(403, "Only an admin can reset a Private code.");
    var who = String(body.name || "");
    if(!who) throw S.failure(400, "Choose whose Private code to reset.");
    await S.secSet(c, S.pcodeId(who), { nbf: Date.now(), resetAt: new Date().toISOString() });
    return { reset: true };
  }

  if(action === "get"){
    var w4 = await unlocked(c, body);
    var d = w4.row.data;
    var out = { notes: d.notes || [], info: d.info || { groups: [] }, version: w4.row.version, isAdmin: !!w4.a.member.isAdmin };
    if(w4.a.member.isAdmin){
      out.access = d.access || [];
      // which of those people have set a Private code yet (names only, never the codes)
      var withCode = [];
      var team = w4.a.team || [];
      for(var i = 0; i < team.length; i++){
        if(!team[i] || !S.privateAllowed(team[i], d.access)) continue;
        var pr = await S.secGet(c, S.pcodeId(team[i].name));
        if(pr && pr.hash) withCode.push(team[i].name);
      }
      out.withCode = withCode;
    }
    return out;
  }

  if(action === "save"){
    var w5 = await unlocked(c, body);
    var shape = checkShape(body);
    var base = parseInt(body.baseVersion, 10);
    if(!(base >= 1)) throw S.failure(400, "Missing version.");
    if(w5.row.version !== base){
      return { conflict: true, notes: w5.row.data.notes || [], info: w5.row.data.info || { groups: [] }, version: w5.row.version };
    }
    var next = Object.assign({}, w5.row.data, { notes: shape.notes, info: shape.info });
    var saved = await S.pvCas(c, base, next);
    if(!saved){
      var latest = await loadRow(c);
      return { conflict: true, notes: latest.data.notes || [], info: latest.data.info || { groups: [] }, version: latest.version };
    }
    return { version: saved.version };
  }

  if(action === "setAccess"){
    var w6 = await unlocked(c, body);
    if(!w6.a.member.isAdmin) throw S.failure(403, "Only an admin can change who has access.");
    var names = Array.isArray(body.names) ? body.names.map(String) : null;
    if(!names || names.length > 2) throw S.failure(400, "Up to two people can be added.");
    var seen = {};
    names = names.filter(function(n){ if(seen[n]) return false; seen[n] = true; return true; });
    names.forEach(function(n){
      var m = S.findMember(w6.a.team, n);
      if(!m || !m.active) throw S.failure(400, "\"" + n + "\" isn't an active team member.");
    });
    for(var k = 0; k < 4; k++){
      var cur = k === 0 ? w6.row : await loadRow(c);
      if(await S.pvCas(c, cur.version, Object.assign({}, cur.data, { access: names }))) return { access: names };
    }
    throw S.failure(409, "Someone else was saving at the same moment. Please try again.");
  }

  throw S.failure(400, "Unknown request.");
});
