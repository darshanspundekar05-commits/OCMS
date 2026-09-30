# CampusCare - College Complaint Management System
Node.js + Express + **SQLite** + vanilla JS. The database is a single file, `ocms.db`, created on first run.

## Run
1. `npm install`
2. Copy `.env.example` to `.env` and set `JWT_SECRET`
3. `npm start`, then open http://localhost:5000 (not the HTML file)

Admin login is created on first run: `admin@ocms.com` / `Admin@123` (change in `.env`).
To view the data, open `ocms.db` in the free "DB Browser for SQLite" app.

## Database tables
- **users**(id, name, email, password_hash, role, roll_no, department, created_at)
- **complaints**(id, complaint_id, user_id -> users, category, subject, description, location, phone, priority, status, created_at)
- **status_history**(id, complaint_id -> complaints, status, note, at)

## API
| Method | Route | Access |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/auth/me | logged in |
| POST | /api/complaints | logged in |
| GET | /api/complaints/mine | logged in |
| GET | /api/complaints/track/:id | public |
| GET | /api/complaints | admin |
| PATCH | /api/complaints/:id/status | admin |
