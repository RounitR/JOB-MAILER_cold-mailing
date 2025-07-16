const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: String,
    avatar: String,
    gmailTokens: {
      access_token: String,
      refresh_token: String,
      scope: String,
      token_type: String,
      expiry_date: Number,
    },
    resume: {
      url: String,
      public_id: String,
      filename: String,
      uploadedAt: Date,
    },
    contacts: [
      {
        name: String,
        email: String,
        company: String,
        notes: String,
      },
    ],
    emailTemplate: {
      subject: {
        type: String,
        default: "Application for {{company}} - {{name}}",
      },
      body: {
        type: String,
        default: `Hi {{name}},\n\nI came across {{company}} and was impressed by your work. I’d love to connect and explore opportunities.\n\nBest regards,\n[Your Name]`,
      },
    },
    sentEmails: [
      {
        to: String,
        subject: String,
        status: String, // 'success' or 'error'
        timestamp: { type: Date, default: Date.now },
        error: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
 