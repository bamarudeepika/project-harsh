const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

const COOKIE_NAME = "campuscare_token";

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h", issuer: "campuscare" });
}
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000, path: "/"
  });
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Please sign in to continue." });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: "campuscare" });
    const { data: user, error } = await supabase.from("profiles")
      .select("id, full_name, email, student_id, role, created_at")
      .eq("id", payload.sub).maybeSingle();
    if (error || !user) { clearAuthCookie(res); return res.status(401).json({ error: "Your session is no longer valid. Please sign in again." }); }
    req.user = { id: user.id, fullName: user.full_name, email: user.email, studentId: user.student_id, role: user.role };
    next();
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Administrator access is required for this action." });
  next();
}
module.exports = { issueToken, setAuthCookie, clearAuthCookie, requireAuth, requireAdmin };
