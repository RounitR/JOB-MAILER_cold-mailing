const express = require("express");
const User = require("../models/User");
const { verifyJwt } = require("../utils/jwt");
const { sendMail } = require("../utils/gmail");
const Mustache = require("mustache");

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.method === "OPTIONS") {
    // Try to authenticate if Authorization header is present
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        req.user = verifyJwt(authHeader.replace("Bearer ", ""));
      } catch {
        // Ignore error, treat as unauthenticated
      }
    }
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing auth" });
  try {
    req.user = verifyJwt(authHeader.replace("Bearer ", ""));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// POST /api/email/test
router.post("/test", requireAuth, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Recipient email required" });
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.gmailTokens)
      return res.status(400).json({ error: "Gmail not connected" });
    // Render template with user info as sample data
    const template = user.emailTemplate || {};
    const sampleData = {
      name: user.name || "Test User",
      email: user.email,
      company: "Test Company",
      notes: "Test email preview",
    };
    const subject = Mustache.render(
      template.subject || "Test Email",
      sampleData
    );
    const body = Mustache.render(
      template.body || "This is a test email.",
      sampleData
    );
    await sendMail({
      tokens: user.gmailTokens,
      to,
      subject,
      body,
      from: user.email,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// POST /api/email/bulk
router.post("/bulk", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.gmailTokens)
      return res.status(400).json({ error: "Gmail not connected" });
    if (!user.contacts || user.contacts.length === 0)
      return res.status(400).json({ error: "No contacts to send to" });
    // Gmail daily quota (default 500, can be increased for Workspace)
    const DAILY_QUOTA = 500;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = (user.sentEmails || []).filter(
      (e) => e.timestamp && new Date(e.timestamp) >= today
    ).length;
    const quotaLeft = Math.max(DAILY_QUOTA - sentToday, 0);
    if (quotaLeft === 0) {
      return res.status(429).json({
        error: `Daily Gmail quota reached (${DAILY_QUOTA}). Try again tomorrow.`,
      });
    }
    // Accept start/end range from body (1-based, inclusive)
    let { start, end } = req.body;
    start = Math.max(1, parseInt(start) || 1);
    end = Math.min(user.contacts.length, parseInt(end) || user.contacts.length);
    if (start > end) [start, end] = [end, start];
    // Only send up to quotaLeft
    const toSend = user.contacts.slice(start - 1, end).slice(0, quotaLeft);
    const template = user.emailTemplate || {};
    const resume = user.resume;
    const results = [];
    for (let i = 0; i < toSend.length; i++) {
      const contact = toSend[i];
      const subject = Mustache.render(template.subject || "", contact);
      const body = Mustache.render(template.body || "", contact);
      let status = "success";
      let error = "";
      try {
        let finalBody = body;
        if (resume && resume.url) {
          finalBody += `\n\nResume: ${resume.url}`;
        }
        await sendMail({
          tokens: user.gmailTokens,
          to: contact.email,
          subject,
          body: finalBody,
          from: user.email,
        });
      } catch (err) {
        status = "error";
        error = err.message || "Unknown error";
      }
      user.sentEmails.push({
        to: contact.email,
        subject,
        status,
        error,
        timestamp: new Date(),
      });
      results.push({
        to: contact.email,
        subject,
        status,
        error,
      });
      if (i < toSend.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    await user.save();
    const remaining = user.contacts.length - (start - 1) - toSend.length;
    let nextSendTime = null;
    if (remaining > 0) {
      nextSendTime = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }
    res.json({
      success: true,
      results,
      sent: toSend.length,
      rangeSent: [start, start + toSend.length - 1],
      remaining,
      quotaLeft: quotaLeft - toSend.length,
      nextSendTime,
    });
  } catch (err) {
    console.error("Bulk email error:", err);
    res.status(500).json({ error: "Failed to send bulk emails" });
  }
});

// OPTIONS /api/email/bulk - return quota info for UI
router.options("/bulk", requireAuth, async (req, res) => {
  console.log(
    "OPTIONS /api/email/bulk handler called for user:",
    req.user ? req.user.userId : "no user"
  );
  try {
    if (!req.user) {
      console.log("OPTIONS handler: No user, sending default quota");
      return res.status(200).json({
        quotaLeft: 0,
        remaining: 0,
        nextSendTime: null,
        error: "Not authenticated",
      });
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      console.log("OPTIONS handler: User not found");
      return res.status(401).json({ error: "User not found" });
    }
    const DAILY_QUOTA = 500;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = (user.sentEmails || []).filter(
      (e) => e.timestamp && new Date(e.timestamp) >= today
    ).length;
    const quotaLeft = Math.max(DAILY_QUOTA - sentToday, 0);
    const remaining = user.contacts
      ? Math.max(user.contacts.length - quotaLeft, 0)
      : 0;
    let nextSendTime = null;
    if (remaining > 0) {
      nextSendTime = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }
    console.log("OPTIONS handler: Sending quota info", {
      quotaLeft,
      remaining,
      nextSendTime,
    });
    return res.json({
      quotaLeft,
      remaining,
      nextSendTime,
    });
  } catch (err) {
    console.log("OPTIONS handler: Error occurred", err);
    try {
      return res.status(500).json({ error: "Failed to get quota info" });
    } catch (e) {
      console.log("OPTIONS handler: Fallback error response failed", e);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Critical failure in quota handler" }));
    }
  }
});

// POST /api/email/resend - resend a failed email
router.post("/resend", requireAuth, async (req, res) => {
  const { to, subject, body, logIndex } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.gmailTokens) {
      return res.status(400).json({ error: "Gmail not connected" });
    }
    let status = "success";
    let error = "";
    try {
      await sendMail({
        tokens: user.gmailTokens,
        to,
        subject,
        body,
        from: user.email,
      });
    } catch (err) {
      status = "error";
      error = err.message || "Unknown error";
    }
    // Add a new log entry for this resend attempt
    user.sentEmails.push({
      to,
      subject,
      status,
      error,
      timestamp: new Date(),
      resent: true,
      originalLogIndex: logIndex,
    });
    await user.save();
    if (status === "success") {
      res.json({ success: true });
    } else {
      res.json({ success: false, error });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to resend email" });
  }
});

// GET /api/email/log - return sent email log for the user
router.get("/log", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    // Sort by most recent first
    const log = (user.sentEmails || [])
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ log });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sent email log" });
  }
});

module.exports = router;
 