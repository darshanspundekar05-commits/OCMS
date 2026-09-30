const router = require("express").Router();
const { db, tx, CATEGORIES, STATUSES } = require("../db");
const { auth, admin } = require("../middleware/auth");

const bad = (res, code, message) => res.status(code).json({ success: false, message });
const newId = () => "OCMS-" + (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).toUpperCase().slice(-8);
const shape = (r) => ({
    complaintId: r.complaint_id, category: r.category, subject: r.subject, description: r.description,
    location: r.location, priority: r.priority, status: r.status, createdAt: r.created_at,
    rollNo: r.roll_no, department: r.department
});
const SELECT = `SELECT c.*, u.roll_no, u.department FROM complaints c JOIN users u ON u.id = c.user_id`;

// Public: track by complaint ID (no personal details returned)
router.get("/track/:id", (req, res) => {
    const c = db.prepare(`${SELECT} WHERE c.complaint_id = ?`).get(req.params.id.trim().toUpperCase());
    if (!c) return bad(res, 404, "No complaint found with that ID.");
    const history = db.prepare("SELECT status, note, at FROM status_history WHERE complaint_id = ? ORDER BY id").all(c.id)
        .map((h) => ({ status: h.status, note: h.note, at: h.at }));
    res.json({ success: true, complaint: { complaintId: c.complaint_id, category: c.category, subject: c.subject, status: c.status, createdAt: c.created_at, history } });
});

// Logged-in student: submit
router.post("/", auth, (req, res) => {
    const { category, location, phone } = req.body;
    const subject = String(req.body.subject || "").trim();
    const description = String(req.body.description || "").trim();
    const priority = ["Low", "Medium", "High"].includes(req.body.priority) ? req.body.priority : "Medium";
    if (!CATEGORIES.includes(category)) return bad(res, 400, "Choose a valid category.");
    if (!subject || subject.length > 120) return bad(res, 400, "Subject is required (max 120 characters).");
    if (description.length < 10 || description.length > 2000) return bad(res, 400, "Describe the problem in 10 to 2000 characters.");

    const now = new Date().toISOString();
    const cid = tx(() => {
        const id = newId();
        const info = db.prepare(`INSERT INTO complaints (complaint_id, user_id, category, subject, description, location, phone, priority, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`).run(id, req.user.id, category, subject, description, location || null, phone || null, priority, now);
        db.prepare("INSERT INTO status_history (complaint_id, status, note, at) VALUES (?,?,?,?)").run(info.lastInsertRowid, "Submitted", "Complaint received.", now);
        return id;
    });
    res.status(201).json({ success: true, message: "Complaint submitted.", complaint: shape(db.prepare(`${SELECT} WHERE c.complaint_id = ?`).get(cid)) });
});

// Logged-in student: own complaints
router.get("/mine", auth, (req, res) => {
    const rows = db.prepare(`${SELECT} WHERE c.user_id = ? ORDER BY c.id DESC`).all(req.user.id);
    res.json({ success: true, complaints: rows.map(shape) });
});

// Admin: all complaints
router.get("/", auth, admin, (req, res) => {
    res.json({ success: true, complaints: db.prepare(`${SELECT} ORDER BY c.id DESC`).all().map(shape) });
});

// Admin: update status
router.patch("/:id/status", auth, admin, (req, res) => {
    const { status, note } = req.body;
    if (!STATUSES.includes(status)) return bad(res, 400, "Invalid status.");
    const c = db.prepare("SELECT id FROM complaints WHERE complaint_id = ?").get(req.params.id);
    if (!c) return bad(res, 404, "Complaint not found.");
    tx(() => {
        db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run(status, c.id);
        db.prepare("INSERT INTO status_history (complaint_id, status, note, at) VALUES (?,?,?,?)")
            .run(c.id, status, (note || "").trim() || `Status changed to ${status}.`, new Date().toISOString());
    });
    res.json({ success: true, complaint: shape(db.prepare(`${SELECT} WHERE c.id = ?`).get(c.id)) });
});

module.exports = router;
