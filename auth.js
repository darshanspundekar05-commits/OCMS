const jwt = require("jsonwebtoken");
const { db } = require("../db");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: "7d" });

function auth(req, res, next) {
    try {
        const { id } = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), SECRET);
        req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        if (!req.user) throw new Error("no user");
        next();
    } catch {
        res.status(401).json({ success: false, message: "Please log in to continue." });
    }
}
const admin = (req, res, next) =>
    req.user.role === "admin" ? next() : res.status(403).json({ success: false, message: "Admin access only." });

module.exports = { auth, admin, sign };
