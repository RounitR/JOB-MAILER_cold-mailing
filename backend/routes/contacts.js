const express = require("express");
const User = require("../models/User");
const { verifyJwt } = require("../utils/jwt");

const router = express.Router();

// Auth middleware (copied from resume.js)
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing auth" });
  const token = authHeader.replace("Bearer ", "");
  try {
    req.user = verifyJwt(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// POST /api/contacts - Save contacts (replace all for user)
router.post("/", requireAuth, async (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ error: "Contacts must be an array" });
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { contacts },
      { new: true }
    );
    res.json({ success: true, contacts: user.contacts });
  } catch (err) {
    res.status(500).json({ error: "Failed to save contacts" });
  }
});

// GET /api/contacts - Fetch contacts for user
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({ contacts: user.contacts || [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

module.exports = router;
