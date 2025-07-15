const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const User = require("../models/User");
const { verifyJwt } = require("../utils/jwt");

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config: accept only PDF/DOCX, max 5MB
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"));
    }
  },
});

// Auth middleware
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

// POST /api/resume/upload
router.post(
  "/upload",
  requireAuth,
  upload.single("resume"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "resumes",
          public_id: `${req.user.userId}_${Date.now()}`,
          format: req.file.mimetype === "application/pdf" ? "pdf" : "docx",
        },
        async (error, result) => {
          if (error)
            return res.status(500).json({ error: "Cloudinary upload failed" });
          // Save to user
          const user = await User.findByIdAndUpdate(
            req.user.userId,
            {
              resume: {
                url: result.secure_url,
                public_id: result.public_id,
                filename: req.file.originalname,
                uploadedAt: new Date(),
              },
            },
            { new: true }
          );
          res.json({ success: true, resume: user.resume });
        }
      );
      // Pipe file buffer to Cloudinary
      require("streamifier").createReadStream(req.file.buffer).pipe(result);
    } catch (err) {
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// GET /api/resume
router.get("/", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user || !user.resume) return res.json({ resume: null });
  res.json({ resume: user.resume });
});

// GET /api/resume/signed-url
router.get("/signed-url", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.resume || !user.resume.public_id) {
      console.error("No resume found for user:", req.user.userId, user);
      return res.status(404).json({ error: "No resume found" });
    }
    console.log("Generating signed URL for public_id:", user.resume.public_id);
    // Return direct raw file URL (works if not set to 'private' in Cloudinary)
    const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${user.resume.public_id}`;
    res.json({ url });
  } catch (err) {
    console.error("Error generating signed URL:", err);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
});

// DELETE /api/resume
router.delete("/", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user || !user.resume)
    return res.status(404).json({ error: "No resume to delete" });
  try {
    await cloudinary.uploader.destroy(user.resume.public_id, {
      resource_type: "raw",
    });
    user.resume = undefined;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
