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

// GET /api/template - Fetch user's template (or default)
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ template: user.emailTemplate });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// POST /api/template - Save/update user's template
router.post("/", requireAuth, async (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) {
    return res.status(400).json({ error: "Subject and body are required" });
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { emailTemplate: { subject, body } },
      { new: true }
    );
    res.json({ success: true, template: user.emailTemplate });
  } catch (err) {
    res.status(500).json({ error: "Failed to save template" });
  }
});

module.exports = router;
