const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("../utils/validation");
const supabase = require("../supabase");
const { issueToken, setAuthCookie, clearAuthCookie, requireAuth } = require("../middleware/auth");

const router = express.Router();
function validationError(req, res, next) {
  const errors = validationResult(req);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  next();
}
router.post("/register", body("fullName", v => typeof v === "string" && v.trim().length >= 2 && v.trim().length <= 100, "Enter a name between 2 and 100 characters."),
  body("email", v => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254, "Enter a valid email address."),
  body("password", v => typeof v === "string" && v.length >= 8 && v.length <= 72, "Password must contain 8–72 characters."),
  body("studentId", v => v === undefined || v === null || (typeof v === "string" && v.trim().length <= 40), "Student ID must be 40 characters or fewer."),
  validationError, async (req, res, next) => {
    try {
      const fullName = req.body.fullName.trim();
      const email = req.body.email.trim().toLowerCase();
      const studentId = (req.body.studentId || "").trim() || null;
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const { data, error } = await supabase.from("profiles").insert({
        full_name: fullName, email, student_id: studentId, password_hash: passwordHash, role: "student"
      }).select("id, full_name, email, student_id, role").single();
      if (error?.code === "23505") return res.status(409).json({ error: "An account with this email or student ID already exists." });
      if (error) return next(error);
      const user = { id: data.id, fullName: data.full_name, email: data.email, studentId: data.student_id, role: data.role };
      setAuthCookie(res, issueToken(user));
      return res.status(201).json({ user });
    } catch (error) { next(error); }
  });
router.post("/login", body("email", v => typeof v === "string" && v.length <= 254, "Enter your email address."),
  body("password", v => typeof v === "string" && v.length > 0 && v.length <= 72, "Enter your password."),
  validationError, async (req, res, next) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name, email, student_id, role, password_hash").eq("email", email).maybeSingle();
      if (error) return next(error);
      if (!data || !(await bcrypt.compare(req.body.password, data.password_hash)))
        return res.status(401).json({ error: "Email or password is incorrect." });
      const user = { id: data.id, fullName: data.full_name, email: data.email, studentId: data.student_id, role: data.role };
      setAuthCookie(res, issueToken(user));
      return res.json({ user });
    } catch (error) { next(error); }
  });
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
router.post("/logout", (req, res) => { clearAuthCookie(res); res.json({ message: "Signed out." }); });
module.exports = router;
