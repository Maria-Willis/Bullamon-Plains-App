// Vercel serverless function -- emails a submitted employee time sheet to the
// address in the TIMESHEET_EMAIL environment variable. Reuses the same
// RESEND_API_KEY / RECEIPT_FROM_EMAIL variables the Receipts and Harvest
// Docket emails already use. See TIMESHEETS_SETUP.md.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var body = req.body || {};
  var apiKey = process.env.RESEND_API_KEY;
  var fromEmail = process.env.RECEIPT_FROM_EMAIL;
  var toEmail = process.env.TIMESHEET_EMAIL;
  if (!apiKey || !fromEmail || !toEmail) {
    res.status(500).json({
      error: "Time sheet email isn't configured yet on the server -- ask whoever manages the Vercel deployment to set TIMESHEET_EMAIL (and RESEND_API_KEY / RECEIPT_FROM_EMAIL if they aren't already). See TIMESHEETS_SETUP.md."
    });
    return;
  }
  if (!body.person || !Array.isArray(body.rows)) {
    res.status(400).json({ error: "Nothing to send." });
    return;
  }
  try {
    var subject = "Time Sheet #" + (body.no || "") + " - " + body.person + " - " + (body.range || "") + (body.resubmitted ? " (re-submitted)" : "");
    var th = "style=\"border:1px solid #999;padding:4px 6px;background:#f0f0f0;font-size:12px;text-align:center;\"";
    var td = "style=\"border:1px solid #999;padding:4px 6px;font-size:13px;text-align:center;\"";
    var tdl = "style=\"border:1px solid #999;padding:4px 6px;font-size:13px;text-align:left;\"";
    var rowsHtml = body.rows.map(function (r) {
      return "<tr><td " + tdl + "><b>" + escapeHtml(r.day || "") + "</b></td><td " + td + ">" + escapeHtml(r.date || "") + "</td><td " + td + ">" + escapeHtml(r.start || "") + "</td><td " + td + ">" + escapeHtml(r.finish || "") + "</td><td " + td + ">" + escapeHtml(r.smoko || "") + "</td><td " + td + ">" + escapeHtml(r.lunch || "") + "</td><td " + td.replace("padding:4px 6px;", "padding:4px 6px;background:#f0f0f0;font-weight:700;") + ">" + escapeHtml(r.nett || "") + "</td><td " + tdl + ">" + escapeHtml(r.location || "") + "</td></tr>";
    }).join("");
    var html = "<h2 style=\"margin:0 0 2px;\">Bullamon Plains Pastoral</h2>" +
      "<p style=\"margin:0 0 12px;color:#777;\">Employee Time Sheet #" + escapeHtml(body.no || "") + (body.resubmitted ? " (re-submitted)" : "") + "</p>" +
      "<p style=\"margin:0 0 2px;font-size:14px;\"><b>Employee:</b> " + escapeHtml(body.person) + "</p>" +
      "<p style=\"margin:0 0 12px;font-size:14px;\"><b>Fortnight:</b> " + escapeHtml(body.range || "") + "</p>" +
      "<table style=\"border-collapse:collapse;\"><thead><tr><th " + th + ">DAY</th><th " + th + ">DATE</th><th " + th + ">START</th><th " + th + ">FINISH</th><th " + th + ">SMOKO (mins)</th><th " + th + ">LUNCH (mins)</th><th " + th + ">NETT HRS</th><th " + th + ">WORK LOCATION &amp; DESCRIPTION</th></tr></thead><tbody>" + rowsHtml + "</tbody></table>" +
      "<p style=\"margin:14px 0 2px;font-size:14px;\"><b>Total nett hours for the fortnight:</b> " + escapeHtml(body.totalNett || "0") + "</p>" +
      "<p style=\"margin:0 0 10px;font-size:14px;\"><b>Hours to be paid for:</b> " + escapeHtml(String(body.paidHours == null ? "" : body.paidHours)) + "</p>" +
      (body.comments ? "<p style=\"margin:0 0 10px;font-size:14px;\"><b>Comments:</b> " + escapeHtml(body.comments) + "</p>" : "") +
      "<p style=\"margin:10px 0 0;color:#777;font-size:12px;\">Signed electronically by " + escapeHtml(body.submittedBy || body.person) + (body.submittedAt ? " on " + escapeHtml(body.submittedAt) : "") + ".</p>";
    var emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [toEmail], subject: subject, html: html })
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
    res.status(500).json({ error: (err && err.message) ? err.message : "Unknown server error while sending the time sheet." });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  });
}
