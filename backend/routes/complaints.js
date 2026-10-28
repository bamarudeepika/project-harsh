const express = require("express");
const { body, validationResult } = require("../utils/validation");
const supabase = require("../supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const CATEGORIES = ["Facilities & Maintenance", "Hostel & Accommodation", "Food & Cafeteria", "Academic", "Harassment & Safety", "Transport", "IT & Internet", "Other"];
const STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"];
const PRIORITIES = ["Normal", "High", "Urgent"];
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  next();
}
function publicComplaint(row) {
  return {
    id: row.id, reference_no: row.reference_no, title: row.title, category: row.category,
    location: row.location, description: row.description, priority: row.priority,
    status: row.status, created_at: row.created_at, updated_at: row.updated_at,
    ...(row.profiles ? { student_name: row.profiles.full_name, student_email: row.profiles.email } : {})
  };
}
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    let query = supabase.from("complaints").select("id, reference_no, title, category, location, description, priority, status, created_at, updated_at, student_id, profiles:profiles!complaints_student_id_fkey(full_name,email)").order("created_at", { ascending: false });
    if (req.user.role !== "admin") query = query.eq("student_id", req.user.id);
    const { data, error } = await query;
    if (error) return next(error);
    res.json({ complaints: (data || []).map(publicComplaint) });
  } catch (error) { next(error); }
});
router.post("/", body("title", v => typeof v === "string" && v.trim().length >= 5 && v.trim().length <= 150, "Title must contain 5–150 characters."),
  body("category", v => CATEGORIES.includes(v), "Choose a valid category."),
  body("description", v => typeof v === "string" && v.trim().length >= 20 && v.trim().length <= 5000, "Description must contain 20–5000 characters."),
  body("priority", v => v === undefined || PRIORITIES.includes(v), "Choose a valid priority."),
  body("location", v => v === undefined || v === null || (typeof v === "string" && v.trim().length <= 160), "Location must be 160 characters or fewer."),
  validate, async (req, res, next) => {
    try {
      const { data, error } = await supabase.from("complaints").insert({
        student_id: req.user.id, title: req.body.title.trim(), category: req.body.category,
        description: req.body.description.trim(), location: (req.body.location || "").trim() || null,
        priority: req.body.priority || "Normal", status: "Submitted"
      }).select("id, reference_no, title, category, location, description, priority, status, created_at, updated_at").single();
      if (error) return next(error);
      const { error: updateError } = await supabase.from("complaint_updates").insert({
        complaint_id: data.id, author_id: req.user.id, status: "Submitted", message: "Complaint submitted successfully."
      });
      if (updateError) return next(updateError);
      res.status(201).json({ complaint: publicComplaint(data) });
    } catch (error) { next(error); }
  });
router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("complaints")
      .select("id, reference_no, title, category, location, description, priority, status, created_at, updated_at, student_id, profiles:profiles!complaints_student_id_fkey(full_name,email)")
      .eq("id", req.params.id).maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ error: "Complaint not found." });
    if (req.user.role !== "admin" && data.student_id !== req.user.id) return res.status(403).json({ error: "You are not allowed to view this complaint." });
    const { data: updates, error: updateError } = await supabase.from("complaint_updates")
      .select("id, status, message, created_at, profiles:profiles!complaint_updates_author_id_fkey(full_name)")
      .eq("complaint_id", data.id).order("created_at", { ascending: true });
    if (updateError) return next(updateError);
    const complaint = publicComplaint(data);
    if (req.user.role !== "admin") { delete complaint.student_name; delete complaint.student_email; }
    res.json({ complaint, updates: (updates || []).map(u => ({ id:u.id, status:u.status, message:u.message, created_at:u.created_at, author_name:u.profiles?.full_name || "CampusCare team" })) });
  } catch (error) { next(error); }
});
router.patch("/:id/status", requireAdmin,
  body("status", v => STATUSES.includes(v), "Choose a valid complaint status."),
  body("message", v => typeof v === "string" && v.trim().length >= 3 && v.trim().length <= 2000, "Add an update message between 3 and 2000 characters."),
  validate, async (req, res, next) => {
    try {
      const { data: existing, error: lookupError } = await supabase.from("complaints").select("id").eq("id", req.params.id).maybeSingle();
      if (lookupError) return next(lookupError);
      if (!existing) return res.status(404).json({ error: "Complaint not found." });
      const { data, error } = await supabase.from("complaints").update({ status:req.body.status, updated_at:new Date().toISOString() })
        .eq("id", req.params.id).select("id, status, updated_at").single();
      if (error) return next(error);
      const { error: updateError } = await supabase.from("complaint_updates").insert({
        complaint_id: req.params.id, author_id: req.user.id, status: req.body.status, message: req.body.message.trim()
      });
      if (updateError) return next(updateError);
      res.json({ complaint: data });
    } catch (error) { next(error); }
  });
module.exports = router;
