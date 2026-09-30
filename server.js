require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { db } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/auth", require("./routes/auth"));
app.use("/api/complaints", require("./routes/complaints"));
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "API route not found." }));
app.use(express.static(path.join(__dirname, "public")));

// Central error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ success: false, message: err.status ? err.message : "Server error. Please try again." });
});

// Create a default admin account on first run
const email = (process.env.ADMIN_EMAIL || "admin@ocms.com").toLowerCase();
if (!db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    db.prepare("INSERT INTO users (name, email, password, role, created_at) VALUES (?,?,?,?,?)")
        .run("Administrator", email, bcrypt.hashSync(process.env.ADMIN_PASSWORD || "Admin@123", 10), "admin", new Date().toISOString());
    console.log(`Admin created: ${email}  (change the password in .env)`);
}

app.listen(PORT, () => console.log(`OCMS running at http://localhost:${PORT}  (SQLite database ready)`));
