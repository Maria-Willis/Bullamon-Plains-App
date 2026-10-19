// Where John Deere sends the browser back to. Two visits happen here:
//  1) after you sign in and allow access  -> ?code=...&state=...   (we swap the
//     code for a long-lived connection, then send you to Deere's "choose
//     organization" page once)
//  2) after you've chosen the organization -> no code               (we check it
//     worked and send you back into the app)
// Always ends by redirecting to the app with ?deere=... so the app can say what happened.
var D = require("./_deere");
function back(res, result, msg){
  var loc = "/?deere=" + encodeURIComponent(result) + (msg ? "&deeremsg=" + encodeURIComponent(String(msg).slice(0, 200)) : "");
  res.statusCode = 302; res.setHeader("Location", loc); res.setHeader("Cache-Control", "no-store"); res.end();
}
module.exports = async function handler(req, res){
  var c = D.cfg();
  var miss = D.missing(c, false);
  if(miss.length) return back(res, "error", "Missing in Vercel: " + miss.join(", "));
  var q = req.query || {};
  try {
    if(q.error) return back(res, "error", "John Deere said: " + (q.error_description || q.error));
    var pending = await D.dbGet(c, "pending");
    if(q.code){
      if(!pending || pending.step !== "signin" || !q.state || q.state !== pending.state || Date.now() > pending.expires){
        return back(res, "error", "That sign-in wasn't started from the app (or it timed out). Start again with Connect John Deere.");
      }
      var j = await D.tokenRequest(c, { grant_type: "authorization_code", code: q.code, redirect_uri: c.redirectUri });
      var rec = D.tokensToRecord(j, null);
      await D.dbSet(c, "main", rec);
      var orgs = await D.deereGet(c, rec.accessToken, "/organizations");
      var list = orgs.json ? (Array.isArray(orgs.json) ? orgs.json : (orgs.json.values || [])) : [];
      var needs = "";
      for(var i = 0; i < list.length && !needs; i++) needs = D.linkOf(list[i], "connections");
      if(orgs.status !== 200) return back(res, "error", "Signed in, but Deere's organization list failed (" + orgs.status + "). " + (orgs.warning || orgs.text));
      if(needs){
        await D.dbSet(c, "pending", { step: "orgs", expires: Date.now() + 30 * 60 * 1000 });
        res.statusCode = 302;
        res.setHeader("Location", needs + (needs.indexOf("?") > -1 ? "&" : "?") + "redirect_uri=" + encodeURIComponent(c.redirectUri));
        res.setHeader("Cache-Control", "no-store"); res.end(); return;
      }
      await D.dbSet(c, "pending", { step: "done", expires: 0 });
      return back(res, "connected");
    }
    // Returning from Deere's "choose organization" page.
    var acc = await D.getAccessToken(c);
    if(!acc.token) return back(res, "error", "Nothing to finish -- start with Connect John Deere in the app.");
    var o2 = await D.deereGet(c, acc.token, "/organizations");
    var l2 = o2.json ? (Array.isArray(o2.json) ? o2.json : (o2.json.values || [])) : [];
    var enabled = l2.filter(function(o){ return D.linkOf(o, "manage_connections") || (!D.linkOf(o, "connections") && D.linkOf(o, "self")); }).length;
    await D.dbSet(c, "pending", { step: "done", expires: 0 });
    return back(res, enabled ? "connected" : "noorg");
  } catch(err){
    return back(res, "error", err.message || "Something went wrong finishing the John Deere connection.");
  }
};
