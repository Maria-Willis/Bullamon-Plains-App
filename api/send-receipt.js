// Bullamon Plains app -- server-side piece of the Receipts feature.
//
// This is a Vercel "serverless function": any plain .js file placed under
// an /api/ folder in a Vercel project is automatically turned into a small
// backend endpoint, deployed the exact same way as everything else in this
// repo (commit it, push/upload to GitHub, Vercel redeploys) -- no separate
// tool or CLI needed, unlike the Supabase Edge Function used for push
// notifications.
//
// Why this exists at all: nothing running only in the browser can send a
// real email on its own without exposing a secret API key to anyone who
// opens the browser's dev tools -- so the actual "call the email service"
// step has to happen somewhere private. This file is that somewhere.
//
// What it does, each time the app calls POST /api/send-receipt:
//   1. Fetches the already-uploaded receipt photo from its public Supabase
//      Storage URL (the browser uploaded it there first -- this function
//      never receives the raw photo bytes directly, just the URL, which
//      keeps the request small and fast even on a patchy rural connection).
//   2. Builds a short email (who uploaded it, the note/amount if given).
//   3. Sends it via Resend's API, with the receipt photo attached.
//
// One-time setup needed before this works -- see RECEIPT_EMAIL_SETUP.md.
// Until that's done, this function will return a clear "not configured
// yet" error rather than a confusing crash, and the app shows that error
// on the receipt's log entry with a "Retry" button.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  var body = req.body || {};
  var photoUrl = body.photoUrl;
  var note = body.note || "";
  var amount = body.amount || "";
  var uploadedBy = body.uploadedBy || "";
  var uploadedAt = body.uploadedAt || "";

  if (!photoUrl) {
    res.status(400).json({ error: "Missing photoUrl -- nothing to attach." });
    return;
  }

  var apiKey = process.env.RESEND_API_KEY;
  var toEmail = process.env.RECEIPT_TO_EMAIL;
  var fromEmail = process.env.RECEIPT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    res.status(500).json({
      error: "Email isn't configured yet on the server -- ask whoever manages the Vercel deployment to set the RESEND_API_KEY, RECEIPT_TO_EMAIL and RECEIPT_FROM_EMAIL environment variables (see RECEIPT_EMAIL_SETUP.md), then redeploy."
    });
    return;
  }

  try {
    var imgResp = await fetch(photoUrl);
    if (!imgResp.ok) {
      res.status(502).json({ error: "Couldn't fetch the uploaded photo to attach it (storage returned " + imgResp.status + ")." });
      return;
    }
    var arrayBuffer = await imgResp.arrayBuffer();
    var base64 = Buffer.from(arrayBuffer).toString("base64");

    var subjectBits = ["Receipt"];
    if (amount) subjectBits.push("$" + amount);
    if (note) subjectBits.push("- " + note);
    var subject = subjectBits.join(" ");

    var htmlLines = [];
    htmlLines.push("<p>A new receipt was uploaded" + (uploadedBy ? " by <strong>" + escapeHtml(uploadedBy) + "</strong>" : "") + " in the Bullamon Plains app.</p>");
    if (amount) htmlLines.push("<p><strong>Amount:</strong> $" + escapeHtml(String(amount)) + "</p>");
    if (note) htmlLines.push("<p><strong>Note:</strong> " + escapeHtml(note) + "</p>");
    if (uploadedAt) htmlLines.push("<p style=\"color:#888;font-size:12px;\">Uploaded " + escapeHtml(uploadedAt) + "</p>");
    htmlLines.push("<p style=\"color:#888;font-size:12px;\">The receipt photo is attached to this email.</p>");

    var emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: subject,
        html: htmlLines.join(""),
        attachments: [
          { filename: "receipt.jpg", content: base64, content_type: "image/jpeg" }
        ]
      })
    });

    var emailData = {};
    try { emailData = await emailResp.json(); } catch (parseErr) { /* leave emailData as {} */ }

    if (!emailResp.ok) {
      var resendMsg = (emailData && emailData.message) ? emailData.message : ("Resend returned an error (HTTP " + emailResp.status + ").");
      res.status(502).json({ error: resendMsg });
      return;
    }

    res.status(200).json({ ok: true, id: emailData.id || null });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) ? err.message : "Unknown server error while sending the receipt email." });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  });
}
