require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const authRouter = require("./routes/auth");
const resumeRouter = require("./routes/resume");
const contactsRouter = require("./routes/contacts");
const templateRouter = require("./routes/template");
const emailRouter = require("./routes/email");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS middleware should be before routers
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: true, // Allow OPTIONS to reach custom handlers
  })
);

app.use(express.json({ limit: "10mb" }));
app.use("/api/auth", authRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/template", templateRouter);
app.use("/api/email", emailRouter);

// Catch-all OPTIONS logger for debugging
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    console.log("Catch-all OPTIONS handler:", req.originalUrl);
  }
  next();
});

connectDB();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
