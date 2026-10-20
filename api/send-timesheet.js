// Vercel serverless function -- emails a submitted employee time sheet to the
// address in the TIMESHEET_EMAIL environment variable. Reuses the same
// RESEND_API_KEY / RECEIPT_FROM_EMAIL variables the Receipts and Harvest
// Docket emails already use. See TIMESHEETS_SETUP.md.
//
// Two uses:
//   1. (no "copyTo")  the office copy, sent when a sheet is submitted -- unchanged.
//   2. ("copyTo" + "token")  an employee asks for a copy of their own submitted sheet to
//      their own email address (added 2026-10-20). This one is checked on the server: the
//      staff sign-in proof must be valid, the sheet must exist in the shared data, be
//      submitted, and belong to that person (admins may copy anyone's), and each person is
//      limited to a handful of copies per half hour so it can't be used to spam anyone.
var S = null;
try { S = require("./_secure"); } catch (e) { S = null; }
var COPY_MAX = 6, COPY_LOCK_MS = 30 * 60 * 1000;
function validEmail(v) {
  return typeof v === "string" && v.length <= 160 && /^[^\s@<>",;:()\[\]\\]+@[^\s@<>",;:()\[\]\\]+\.[^\s@<>",;:()\[\]\\]{2,}$/.test(v);
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var body = req.body || {};
  var apiKey = process.env.RESEND_API_KEY;
  var fromEmail = process.env.RECEIPT_FROM_EMAIL;
  var toEmail = process.env.TIMESHEET_EMAIL;
  var copyMode = body.copyTo !== undefined && body.copyTo !== null;
  if (copyMode) {
    try {
      toEmail = await checkCopyRequest(body);
    } catch (err) {
      var st = (err && err.status) || 500;
      res.status(st).json(Object.assign({ ok: false, error: (err && err.message) || "Couldn't check that request." }, (err && err.extra) || {}));
      return;
    }
  }
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
    var subject = (copyMode ? "Your copy: " : "") + "Time Sheet #" + (body.no || "") + " - " + body.person + " - " + (body.range || "") + (body.resubmitted ? " (re-submitted)" : "");
    var th = "style=\"border:1px solid #999;padding:4px 6px;background:#f0f0f0;font-size:12px;text-align:center;\"";
    var td = "style=\"border:1px solid #999;padding:4px 6px;font-size:13px;text-align:center;\"";
    var tdl = "style=\"border:1px solid #999;padding:4px 6px;font-size:13px;text-align:left;\"";
    var rowsHtml = body.rows.map(function (r) {
      if (r.annual) {
        return "<tr><td " + tdl + "><b>" + escapeHtml(r.day || "") + "</b></td><td " + td + ">" + escapeHtml(r.date || "") + "</td><td " + td.replace("padding:4px 6px;", "padding:4px 6px;background:#eaf3ea;") + " colspan=\"4\"><b>ANNUAL LEAVE</b></td><td " + td.replace("padding:4px 6px;", "padding:4px 6px;background:#f0f0f0;font-weight:700;") + ">" + escapeHtml(r.annualHours || "") + "</td><td " + tdl + ">" + escapeHtml(r.location || "") + "</td></tr>";
      }
      return "<tr><td " + tdl + "><b>" + escapeHtml(r.day || "") + "</b></td><td " + td + ">" + escapeHtml(r.date || "") + "</td><td " + td + ">" + escapeHtml(r.start || "") + "</td><td " + td + ">" + escapeHtml(r.finish || "") + "</td><td " + td + ">" + escapeHtml(r.smoko || "") + "</td><td " + td + ">" + escapeHtml(r.lunch || "") + "</td><td " + td.replace("padding:4px 6px;", "padding:4px 6px;background:#f0f0f0;font-weight:700;") + ">" + escapeHtml(r.nett || "") + "</td><td " + tdl + ">" + escapeHtml(r.location || "") + "</td></tr>";
    }).join("");
    var html = "<h2 style=\"margin:0 0 2px;\">Bullamon Plains Pastoral Company</h2>" +
      (copyMode ? "<p style=\"margin:0 0 12px;font-size:13px;color:#555;\">This is your own copy of the time sheet you submitted. It was sent because you asked for it in the Bullamon Plains app.</p>" : "") +
      "<p style=\"margin:0 0 12px;color:#777;\">Employee Time Sheet #" + escapeHtml(body.no || "") + (body.resubmitted ? " (re-submitted)" : "") + "</p>" +
      "<p style=\"margin:0 0 2px;font-size:14px;\"><b>Employee:</b> " + escapeHtml(body.person) + "</p>" +
      "<p style=\"margin:0 0 12px;font-size:14px;\"><b>Fortnight:</b> " + escapeHtml(body.range || "") + "</p>" +
      "<table style=\"border-collapse:collapse;\"><thead><tr><th " + th + ">DAY</th><th " + th + ">DATE</th><th " + th + ">START</th><th " + th + ">FINISH</th><th " + th + ">SMOKO (mins)</th><th " + th + ">LUNCH (mins)</th><th " + th + ">NETT HRS</th><th " + th + ">WORK LOCATION &amp; DESCRIPTION</th></tr></thead><tbody>" + rowsHtml + "</tbody></table>" +
      "<p style=\"margin:14px 0 2px;font-size:14px;\"><b>Nett hours worked:</b> " + escapeHtml(body.totalNett || "0") + "</p>" +
      (body.annualHours !== undefined ? "<p style=\"margin:0 0 2px;font-size:14px;\"><b>Annual leave hours:</b> " + escapeHtml(String(body.annualHours)) + "</p>" +
        "<p style=\"margin:0 0 2px;font-size:14px;\"><b>Total (worked + annual leave):</b> " + escapeHtml(String(body.totalAll || "")) + "</p>" : "") +
      "<p style=\"margin:0 0 10px;font-size:14px;\"><b>Hours to be paid for:</b> " + escapeHtml(String(body.paidHours == null ? "" : body.paidHours)) + "</p>" +
      (body.tilText ? "<p style=\"margin:0 0 10px;font-size:14px;\"><b>Time in lieu:</b> " + escapeHtml(String(body.tilText)) + "</p>" : "") +
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

// Copy mode: who is asking, is the sheet really theirs, and is the address sane. Returns the address to send to.
async function checkCopyRequest(body) {
  var fail = function (status, msg, extra) { var e = new Error(msg); e.status = status; e.extra = extra || {}; return e; };
  if (!S) throw fail(503, "The server check isn't set up yet (api/_secure.js is missing).");
  var c = S.cfg();
  if (S.missing(c).length) throw fail(503, "The server check isn't set up yet.", { notConfigured: true });
  var to = String(body.copyTo || "").trim();
  if (!validEmail(to)) throw fail(400, "That email address doesn't look right.");
  var a = await S.authStaff(c, body);                       // throws "please confirm your access code again" if the proof is missing/old
  var row = await S.getAppRow(c);
  var items = (row && row.data && row.data.timesheets && row.data.timesheets.items) || [];
  var no = parseInt(String(body.no || ""), 10);
  var sheet = items.filter(function (it) { return it && it.no === no; })[0];
  if (!sheet || sheet.status !== "submitted") throw fail(404, "That time sheet hasn't been submitted (or can't be found), so there's nothing to copy yet.");
  if (!a.member.isAdmin && sheet.person !== a.name) throw fail(403, "You can only email yourself a copy of your own time sheet.");
  if (String(body.person || "") !== sheet.person) throw fail(400, "That doesn't match the time sheet.");
  await S.throttleBegin(c, "tscopy:" + S.nameKey(a.name), COPY_MAX, COPY_LOCK_MS, "Too many copies requested. Please wait");
  return to;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
  });
}
