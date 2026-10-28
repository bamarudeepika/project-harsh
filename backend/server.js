require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaints");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to a random value with at least 32 characters in backend/.env");
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env");
}
const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:"], connectSrc: ["'self'"], objectSrc: ["'none'"],
  frameAncestors: ["'none'"], upgradeInsecureRequests: null
}}}));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many authentication attempts. Please try again later." } }));
app.get("/api/health", (req, res) => res.json({ status:"ok", service:"CampusCare API" }));
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((err, req, res, next) => {
  // Keep detailed errors in server logs only; never send credentials or stack traces to the browser.
  console.error("Request failed:", err?.message || "Unknown error");
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "A server error occurred. Check the server terminal and database configuration." });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`CampusCare is running at http://localhost:${port}`));
