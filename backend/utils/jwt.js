const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.SESSION_SECRET;

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signJwt, verifyJwt };
