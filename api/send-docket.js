// Vercel serverless function -- emails a single harvest docket to the truck
// driver. Reuses the same RESEND_API_KEY / RECEIPT_FROM_EMAIL environment
// variables the Receipts feature already needs (see RECEIPT_EMAIL_SETUP.md)
// -- if Receipts' email is already working, this needs no new secrets at
// all, just this file uploaded. See HARVEST_DOCKET_SETUP.md.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var body = req.body || {};
  var to = body.to;
  if (!to) {
    res.status(400).json({ error: "No driver email on file -- nothing to send to." });
    return;
  }
  var apiKey = process.env.RESEND_API_KEY;
  var fromEmail = process.env.RECEIPT_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    res.status(500).json({
      error: "Email isn't configured yet on the server -- ask whoever manages the Vercel deployment to set RESEND_API_KEY and RECEIPT_FROM_EMAIL (see RECEIPT_EMAIL_SETUP.md / HARVEST_DOCKET_SETUP.md), then redeploy."
    });
    return;
  }
  try {
    var subject = "Delivery Docket #" + (body.docketNo || "");
    var rows = [
      ["Date", body.date], ["Time", body.time], ["Driver", body.driverName], ["Carrier", body.carrier],
      ["Rego", body.rego], ["Completed by", body.completedBy], ["Commodity", body.commodity],
      ["Property", body.property], ["Paddock", body.paddock], ["Delivered to", body.deliveredTo],
      ["Approx weight", body.approxWeight]
    ];
    var rowsHtml = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return "<tr><td style=\"padding:4px 10px 4px 0;color:#888;\">" + escapeHtml(r[0]) + "</td><td style=\"padding:4px 0;font-weight:600;\">" + escapeHtml(String(r[1])) + "</td></tr>";
    }).join("");
    var html = "<h2 style=\"margin:0 0 4px;\">Bullamon Plains Pastoral Company</h2>" +
      "<p style=\"margin:0 0 16px;color:#888;\">Delivery Docket #" + escapeHtml(String(body.docketNo || "")) + "</p>" +
      "<table style=\"border-collapse:collapse;font-size:14px;\">" + rowsHtml + "</table>";
    var emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [to], subject: subject, html: html })
    });
    var emailData = {};
    try { emailData = await emailResp.json(); } catch (parseErr) { }
    if (!emailResp.ok) {
      var resendMsg = (emailData && emailData.message) ? emailData.message : ("Resend returned an error (HTTP " + emailResp.status + ").");
      res.status(502).json({ error: resendMsg });
      return;
    }
    res.status(200).json({ ok: true, id: emailData.id || null });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) ? err.message : "Unknown server error while sending the docket email." });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  });
}
