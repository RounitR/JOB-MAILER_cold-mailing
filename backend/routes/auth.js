const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signJwt } = require("../utils/jwt");
const { google } = require("googleapis");
const { verifyJwt } = require("../utils/jwt");

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const OAUTH_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI // must be set in .env and Google console
  );
}

// Add requireAuth middleware (copied from email.js)
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

// POST /api/auth/google
router.post("/google", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "ID token required" });
  try {
    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // Find or create user
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
      });
    }
    // Sign JWT
    const token = signJwt({ userId: user._id });
    res.json({
      token,
      user: { email: user.email, name: user.name, avatar: user.avatar },
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid Google ID token" });
  }
});

// GET /api/auth/gmail/initiate
router.get("/gmail/initiate", (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: OAUTH_SCOPES,
    prompt: "consent",
  });
  res.json({ url });
});

// GET /api/auth/gmail/callback?code=... (expects JWT in Authorization header)
router.get("/gmail/callback", async (req, res) => {
  console.log("Gmail callback route hit:", new Date().toISOString(), req.url);
  const { code } = req.query;
  const authHeader = req.headers.authorization;
  if (!code || !authHeader)
    return res.status(400).json({ error: "Missing code or auth" });
  const token = authHeader.replace("Bearer ", "");
  let userId;
  try {
    const payload = verifyJwt(token);
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "Invalid JWT" });
  }
  try {
    const oauth2Client = getOAuth2Client();
    // Debug logging
    console.log("--- Gmail OAuth Debug ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Using redirect_uri:", process.env.GMAIL_REDIRECT_URI);
    console.log("Using client_id:", process.env.GOOGLE_CLIENT_ID);
    console.log("Received code:", code);
    const { tokens } = await oauth2Client.getToken(code);
    // Save tokens to user
    const user = await User.findByIdAndUpdate(
      userId,
      { gmailTokens: tokens },
      { new: true }
    );
    // Respond with JSON instead of redirect
    return res.json({
      success: true,
      user: { email: user.email, name: user.name, avatar: user.avatar },
    });
  } catch (err) {
    console.error("Gmail callback error:", err);
    res.status(500).json({ error: "Failed to connect Gmail" });
  }
});

// POST /api/auth/gmail/disconnect - disconnect Gmail from user
router.post("/gmail/disconnect", async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    user.gmailTokens = undefined;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect Gmail" });
  }
});

// DELETE /api/auth/delete-account - delete user and all data
router.delete("/delete-account", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    // Optionally: delete resume from Cloudinary if needed
    // Remove user from DB (all data: contacts, logs, tokens, etc.)
    await user.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// GET /api/auth/me - Return current user info from JWT
router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing auth" });
  const token = authHeader.replace("Bearer ", "");
  try {
    const user = verifyJwt(token);
    res.json({ user });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
 