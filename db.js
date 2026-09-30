// SQLite database (one file: ocms.db). Uses better-sqlite3, or Node's built-in sqlite (Node 22.5+) as a fallback.
const path = require("path");
let Database;
try { Database = require("better-sqlite3"); } catch { Database = require("node:sqlite").DatabaseSync; }

const db = new Database(process.env.DB_FILE || path.join(__dirname, "ocms.db"));

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    roll_no     TEXT,
    department  TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS complaints (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id  TEXT NOT NULL UNIQUE,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    category      TEXT NOT NULL,
    subject       TEXT NOT NULL,
    description   TEXT NOT NULL,
    location      TEXT,
    phone         TEXT,
    priority      TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High')),
    status        TEXT NOT NULL DEFAULT 'Submitted',
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    status        TEXT NOT NULL,
    note          TEXT,
    at            TEXT NOT NULL
);
`);

const CATEGORIES = ["Electricity", "Water Supply", "Computer/Lab", "Cleaning & Sanitation", "Furniture", "Internet/Network", "Classroom/Infrastructure", "General Maintenance"];
const STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"];

// Run several statements as one all-or-nothing transaction
function tx(fn) {
    db.exec("BEGIN");
    try { const r = fn(); db.exec("COMMIT"); return r; }
    catch (e) { db.exec("ROLLBACK"); throw e; }
}

module.exports = { db, tx, CATEGORIES, STATUSES };
