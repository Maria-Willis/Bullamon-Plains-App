// Staff sign-in check, run on the server (added 2026-10-19). The browser sends the
// chosen name + access code here; the code is compared against a scrambled copy kept
// in the locked table app_secrets, and a signed "proof" token comes back that the phone
// keeps so the person stays signed in. See _secure.js and PRIVATE_SETUP.md.
//
// POST body {action: ...}
//   status       is the one-off database setup done? -> {ready:true} or 503 notConfigured
//   migrate      one-off tidy-up: moves old plain-text codes and Private data out of the
//                shared app data (does nothing harmful, safe to call any time)
//   signin       {name, code}              -> {token, exp, hasCode, canPrivate}
//   whoami       {token}                   -> {name, isAdmin, canPrivate, hasCode}
//   setCode      {token, name, code|remove, oldName?}   admin sets/removes/moves someone's code
//   changeOwnCode {name, current, newCode} a person changes their own code -> {token, exp}
var S = require("./_secure");

var SIGNIN_MAX_ATTEMPTS = 8, SIGNIN_LOCK_MS = 10 * 60 * 1000;

async function accessList(c){
  var row = await S.pvGet(c);
  return row && row.data && Array.isArray(row.data.access) ? row.data.access : [];
}

// Checks name + code. Returns {member, rec}. Throws a friendly failure otherwise.
async function verifyStaffCode(c, team, name, code){
  var member = S.findMember(team, name);
  if(!member || !member.active) throw S.failure(401, "Choose your name from the list.");
  var key = "s:" + S.nameKey(name);
  var rec = await S.secGet(c, S.codeId(name));
  if(rec && rec.hash){
    await S.throttleBegin(c, key, SIGNIN_MAX_ATTEMPTS, SIGNIN_LOCK_MS);     // counts this attempt before checking
    var ok = await S.checkCode(S.cleanCode(code), rec.hash);
    if(!ok) throw S.failure(401, "That access code doesn't match. Try again or ask an admin to reset it.", { badCode: true });
    await S.throttleClear(c, key);
  }
  return { member: member, rec: rec };
}

function validNewCode(code){
  var v = S.cleanCode(code);
  if(v.length < S.MIN_CODE) throw S.failure(400, "The code needs at least " + S.MIN_CODE + " characters (not counting spaces at the ends).");
  return v;
}

module.exports = S.wrap(async function(c, body){
  var action = body.action;

  if(action === "status"){
    // Is the one-off database setup done? (Throws "not configured" if a table is missing.)
    await S.secGet(c, "probe");
    await S.pvGet(c);
    return { ready: true };
  }

  if(action === "migrate"){
    var sum = await S.migrate(c);
    return { migrated: sum };
  }

  if(action === "signin"){
    var name = String(body.name || "");
    var team = await S.getTeam(c);
    var m0 = S.findMember(team, name);
    // Old data still holding plain-text codes: move them across first so this check is the real one.
    if(m0 && Object.prototype.hasOwnProperty.call(m0, "passcode") && String(m0.passcode || "").trim() !== ""){
      await S.migrate(c);
      team = await S.getTeam(c);
    }
    var v = await verifyStaffCode(c, team, name, body.code);
    var t = S.makeToken(c, "s", v.member.name, S.SESSION_DAYS);
    var access = await accessList(c);
    return { token: t.token, exp: t.exp, name: v.member.name, hasCode: !!(v.rec && v.rec.hash), canPrivate: S.privateAllowed(v.member, access) };
  }

  if(action === "whoami"){
    var a = await S.authStaff(c, body);
    var rec = await S.secGet(c, S.codeId(a.name));
    return { name: a.name, isAdmin: !!a.member.isAdmin, hasCode: !!(rec && rec.hash), canPrivate: S.privateAllowed(a.member, await accessList(c)) };
  }

  if(action === "setCode"){
    var adm = await S.authStaff(c, body);
    if(!adm.member.isAdmin) throw S.failure(403, "Only an admin can set someone else's access code.");
    var target = String(body.name || "").trim();
    if(!target || target.length > 80) throw S.failure(400, "That name doesn't look right.");
    var oldName = body.oldName ? String(body.oldName) : "";
    var pending = null;
    if(!body.remove && body.code !== undefined && body.code !== null && String(body.code).trim() !== "") pending = validNewCode(body.code);
    // renamed person: carry their codes and Private-access entry over to the new name
    if(oldName && oldName !== target){
      if(S.findMember(adm.team, target)) throw S.failure(409, "Someone with that name is already on the team.");
      var oldRec = await S.secGet(c, S.codeId(oldName));
      if(oldRec){ await S.secSet(c, S.codeId(target), oldRec); await S.secDel(c, S.codeId(oldName)); }
      else await S.secDel(c, S.codeId(target));                 // never let a leftover from an earlier person of that name attach
      var oldP = await S.secGet(c, S.pcodeId(oldName));
      if(oldP){ await S.secSet(c, S.pcodeId(target), oldP); await S.secDel(c, S.pcodeId(oldName)); }
      else await S.secDel(c, S.pcodeId(target));
      for(var i = 0; i < 4; i++){
        var row = await S.pvGet(c);
        if(!row || !Array.isArray(row.data.access) || row.data.access.indexOf(oldName) === -1) break;
        var acc = row.data.access.map(function(n){ return n === oldName ? target : n; });
        if(await S.pvCas(c, row.version, Object.assign({}, row.data, { access: acc }))) break;
      }
    }
    // If the admin is changing their own entry, hand back a fresh proof so they aren't asked again.
    var mine = (target === adm.name || oldName === adm.name);
    var fresh = function(extra){
      if(!mine) return extra;
      var tk = S.makeToken(c, "s", target, S.SESSION_DAYS);
      return Object.assign(extra, { token: tk.token, exp: tk.exp, name: target });
    };
    if(body.forget){
      // person removed from the team: forget their Private code and take them off the Private access list
      await S.secSet(c, S.pcodeId(target), { nbf: Date.now() });
      for(var j = 0; j < 4; j++){
        var row2 = await S.pvGet(c);
        if(!row2 || !Array.isArray(row2.data.access) || row2.data.access.indexOf(target) === -1) break;
        var acc2 = row2.data.access.filter(function(n){ return n !== target; });
        if(await S.pvCas(c, row2.version, Object.assign({}, row2.data, { access: acc2 }))) break;
      }
    }
    if(body.remove){
      // keep a marker (not a bare delete) so proofs issued before this are still cut off
      await S.secSet(c, S.codeId(target), { nbf: Date.now(), removedAt: new Date().toISOString() });
      return fresh({ hasCode: false });
    }
    if(pending){
      await S.secSet(c, S.codeId(target), { hash: await S.hashCode(pending), updatedAt: new Date().toISOString(), nbf: Date.now() });
      return fresh({ hasCode: true });
    }
    var cur = await S.secGet(c, S.codeId(target));
    return fresh({ hasCode: !!(cur && cur.hash) });
  }

  if(action === "changeOwnCode"){
    var who = String(body.name || "");
    var team2 = await S.getTeam(c);
    var m2 = S.findMember(team2, who);
    // Old data still holding this person's plain-text code: move it across first, so "no scrambled code yet"
    // can't be mistaken for "no code".
    if(m2 && Object.prototype.hasOwnProperty.call(m2, "passcode") && String(m2.passcode || "").trim() !== ""){
      await S.migrate(c);
      team2 = await S.getTeam(c);
      m2 = S.findMember(team2, who);
    }
    if(!m2 || !m2.active) throw S.failure(401, "Choose your name from the list.");
    var recNow = await S.secGet(c, S.codeId(who));
    if(recNow && recNow.hash){
      var key = "s:" + S.nameKey(who);
      await S.throttleBegin(c, key, SIGNIN_MAX_ATTEMPTS, SIGNIN_LOCK_MS);
      if(!(await S.checkCode(S.cleanCode(body.current), recNow.hash))) throw S.failure(401, "Your current code doesn't match.", { badCode: true });
      await S.throttleClear(c, key);
    } else {
      // An account with no code yet: only someone who signed in as that person (holds their proof) may put the first code on it.
      var proof = S.readToken(c, body.token, "s");
      if(!proof || proof.n !== who) throw S.failure(401, "Please confirm your access code again.", { needReauth: true });
    }
    var nv = validNewCode(body.newCode);
    await S.secSet(c, S.codeId(who), { hash: await S.hashCode(nv), updatedAt: new Date().toISOString(), nbf: Date.now() });
    var tk = S.makeToken(c, "s", who, S.SESSION_DAYS);
    return { token: tk.token, exp: tk.exp, hasCode: true };
  }

  throw S.failure(400, "Unknown request.");
});
