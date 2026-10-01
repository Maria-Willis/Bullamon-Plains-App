// Vercel serverless function -- emails an Excel (.xlsx) export of the whole
// harvest docket log to one fixed address (HARVEST_EXPORT_EMAIL). Reuses
// the same RESEND_API_KEY / RECEIPT_FROM_EMAIL as Receipts and
// api/send-docket.js -- the only brand-new secret this one needs is
// HARVEST_EXPORT_EMAIL. See HARVEST_DOCKET_SETUP.md.
//
// The .xlsx file itself is built client-side (in index.html, via SheetJS)
// and sent here as base64 -- this function never touches Supabase Storage,
// it just forwards that base64 straight to Resend as an attachment.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var body = req.body || {};
  var base64 = body.base64;
  var filename = body.filename || "harvest-dockets.xlsx";
  if (!base64) {
    res.status(400).json({ error: "No file content received -- nothing to send." });
    return;
  }
  var apiKey = process.env.RESEND_API_KEY;
  var fromEmail = process.env.RECEIPT_FROM_EMAIL;
  var toEmail = process.env.HARVEST_EXPORT_EMAIL;
  if (!apiKey || !fromEmail || !toEmail) {
    res.status(500).json({
      error: "The Excel export isn't configured yet on the server -- ask whoever manages the Vercel deployment to set HARVEST_EXPORT_EMAIL (RESEND_API_KEY and RECEIPT_FROM_EMAIL should already be set from the Receipts feature) (see HARVEST_DOCKET_SETUP.md), then redeploy."
    });
    return;
  }
  try {
    var emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: "Harvest docket export",
        html: "<p>Attached is the current harvest docket log, exported from the Bullamon Plains app.</p>",
        attachments: [{
          filename: filename,
          content: base64,
          content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }]
      })
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
    res.status(500).json({ error: (err && err.message) ? err.message : "Unknown server error while emailing the export." });
  }
};
