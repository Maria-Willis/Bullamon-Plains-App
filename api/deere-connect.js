// Starts the John Deere connection: checks the connect code, makes a one-time
// "state" value (so only a sign-in WE started can finish), and returns the
// John Deere sign-in address for the browser to go to. See DEERE_SETUP.md.
var crypto = require("crypto");
var D = require("./_deere");
module.exports = async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).json({ error: "Method not allowed" }); return; }
  var c = D.cfg();
  var miss = D.missing(c, true);
  if(miss.length){ res.status(500).json({ error: "The John Deere link isn't set up on the server yet. Missing in Vercel: " + miss.join(", ") + ". See DEERE_SETUP.md." }); return; }
  var body = req.body || {};
  var given = String(body.code || "");
  var a = Buffer.from(given), b = Buffer.from(c.connectCode);
  if(a.length !== b.length || !crypto.timingSafeEqual(a, b)){ res.status(403).json({ error: "That connect code isn't right." }); return; }
  try {
    var state = crypto.randomBytes(24).toString("hex");
    await D.dbSet(c, "pending", { state: state, expires: Date.now() + 15 * 60 * 1000, step: "signin" });
    res.status(200).json({ url: D.authorizeUrl(c, state) });
  } catch(err){
    res.status(500).json({ error: err.message || "Couldn't start the John Deere connection." });
  }
};
