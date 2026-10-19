// Reads each machine's latest engine hours from John Deere Operations Center
// and returns them to the app as a list (name, PIN, hours, when reported).
// The app then shows its normal "check before updating" screen -- this
// function never changes any app data. POST {action:"status"} just reports
// whether the connection is set up. See DEERE_SETUP.md.
var D = require("./_deere");
module.exports = async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  if(req.method !== "POST"){ res.status(405).json({ error: "Method not allowed" }); return; }
  var c = D.cfg();
  var body = req.body || {};
  var miss = D.missing(c, false);
  if(body.action === "status"){
    if(miss.length){ res.status(200).json({ configured: false, missing: miss, connected: false }); return; }
    try {
      var rec = await D.dbGet(c, "main");
      var last = null; try { last = await D.dbGet(c, "lastsync"); } catch(e){}
      res.status(200).json({ configured: true, connected: !!(rec && rec.accessToken), connectedAt: rec ? rec.connectedAt : null, refreshedAt: rec ? rec.refreshedAt : null, autoSync: !!process.env.CRON_SECRET, lastSync: last || null });
    } catch(e){ res.status(200).json({ configured: true, connected: false, error: e.message }); }
    return;
  }
  if(miss.length){ res.status(500).json({ error: "The John Deere link isn't set up on the server yet. Missing in Vercel: " + miss.join(", ") + "." }); return; }
  try {
    var acc = await D.getAccessToken(c);
    if(!acc.token){ res.status(409).json({ error: "John Deere isn't connected yet. Tap Connect John Deere first.", notConnected: true }); return; }
    var r = await D.fetchHours(c, acc.token);
    if(!r.ok){ res.status(r.status || 500).json({ error: r.error, notConnected: r.notConnected, termsUrl: r.termsUrl }); return; }
    res.status(200).json({ machines: r.machines, notes: r.notes, orgs: r.orgs, debug: r.debug });
  } catch(err){
    res.status(500).json({ error: err.message || "Couldn't read hours from John Deere." });
  }
};
