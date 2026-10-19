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
      res.status(200).json({ configured: true, connected: !!(rec && rec.accessToken), connectedAt: rec ? rec.connectedAt : null, refreshedAt: rec ? rec.refreshedAt : null });
    } catch(e){ res.status(200).json({ configured: true, connected: false, error: e.message }); }
    return;
  }
  if(miss.length){ res.status(500).json({ error: "The John Deere link isn't set up on the server yet. Missing in Vercel: " + miss.join(", ") + "." }); return; }
  try {
    var acc = await D.getAccessToken(c);
    if(!acc.token){ res.status(409).json({ error: "John Deere isn't connected yet. Tap Connect John Deere first.", notConnected: true }); return; }
    var token = acc.token;
    var orgRes = await D.deereList(c, token, "/organizations?itemLimit=100", 3);
    if(!orgRes.ok){
      res.status(502).json({ error: "John Deere wouldn't list the organizations (" + orgRes.status + "). " + (orgRes.warning || orgRes.text || ""), termsUrl: orgRes.termsUrl || undefined });
      return;
    }
    var orgs = orgRes.values;
    var enabled = orgs.filter(function(o){ return !D.linkOf(o, "connections") || D.linkOf(o, "manage_connections"); });
    if(!enabled.length){
      res.status(409).json({ error: "No John Deere organization is shared with the app yet. Tap Connect John Deere and choose the Bullamon organization.", notConnected: true });
      return;
    }
    var machines = [], notes = [], debug = [];
    for(var oi = 0; oi < enabled.length; oi++){
      var org = enabled[oi];
      // The Equipment API lives on its own address (equipmentapi.deere.com/isg), not under /platform.
      var ml = await D.deereList(c, token, c.equipmentBase + "/equipment?organizationIds=" + encodeURIComponent(org.id) + "&categories=Machine&archived=false&itemLimit=200", 10, "application/json");
      if(!ml.ok){
        notes.push("Couldn't list machines for " + (org.name || org.id) + " (" + ml.status + ")" + (ml.warning ? ": " + ml.warning : "") + (ml.text ? " " + String(ml.text).slice(0, 160) : ""));
        debug.push({ org: org.id, call: "equipment", status: ml.status, text: ml.text });
        continue;
      }
      var list = ml.values;
      if(list[0]) debug.push({ org: org.id, machineSampleKeys: Object.keys(list[0]) });
      for(var i = 0; i < list.length; i += 6){
        var batch = list.slice(i, i + 6);
        var got = await Promise.all(batch.map(async function(m){
          var tries = [];
          var lk = D.linkOf(m, "engineHours"); if(lk) tries.push(lk);
          [m.principalId, m.id].forEach(function(x){ if(x != null && x !== ""){ var u = c.apiBase + "/machines/" + encodeURIComponent(x) + "/engineHours"; if(tries.indexOf(u) < 0) tries.push(u); } });
          var lastErr = "no id";
          for(var t = 0; t < tries.length; t++){
            try {
              var r = await D.deereGet(c, token, tries[t]);
              if(r.status !== 200 || !r.json){ lastErr = r.status; continue; }
              var item = Array.isArray(r.json) ? r.json[0] : (r.json.values ? r.json.values[0] : r.json);
              var hrs = D.readingOf(item);
              if(hrs == null){ lastErr = "no reading"; continue; }
              return { m: m, hours: hrs, updated: item && (item.reportTime || item.reportedTime || item.time) || "" };
            } catch(e){ lastErr = "network"; }
          }
          return { m: m, err: lastErr };
        }));
        got.forEach(function(g){
          var nm = g.m.name || g.m.nickname || g.m.serialNumber || g.m.vin || ("Machine " + g.m.id);
          if(g.hours == null || g.hours <= 0){ machines.push({ name: nm, pin: g.m.serialNumber || g.m.vin || g.m.pin || "", hours: null, updated: "", problem: g.err ? ("HTTP " + g.err) : "no hours reported" }); return; }
          machines.push({ name: nm, pin: g.m.serialNumber || g.m.vin || g.m.pin || "", hours: Math.round(g.hours * 10) / 10, updated: g.updated ? String(g.updated).slice(0, 16).replace("T", " ") : "" });
        });
      }
    }
    res.status(200).json({ machines: machines, notes: notes, orgs: enabled.map(function(o){ return o.name || o.id; }), debug: machines.filter(function(x){ return x.hours != null; }).length ? undefined : debug });
  } catch(err){
    res.status(500).json({ error: err.message || "Couldn't read hours from John Deere." });
  }
};
