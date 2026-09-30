"use strict";

const $ = (s) => document.querySelector(s);
const CATS = [
    ["⚡", "Electricity", "Lights, fans, sockets and power problems."],
    ["💧", "Water Supply", "Drinking water, leakage and tap problems."],
    ["💻", "Computer/Lab", "Computers, lab equipment and software issues."],
    ["🧹", "Cleaning & Sanitation", "Washrooms, garbage and cleanliness."],
    ["🪑", "Furniture", "Broken benches, desks, chairs and cupboards."],
    ["🌐", "Internet/Network", "Wi-Fi, LAN and connectivity problems."],
    ["🏫", "Classroom/Infrastructure", "Classrooms, projectors, boards and buildings."],
    ["🔧", "General Maintenance", "Repairs and other maintenance work."]
];
const STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"];
const PROGRESS = { Submitted: 15, "Under Review": 40, "In Progress": 75, Resolved: 100, Rejected: 100 };

let token = localStorage.getItem("token");
let user = JSON.parse(localStorage.getItem("user") || "null");
let list = [];

// Escape user text before putting it in HTML (prevents XSS)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;

async function api(path, { method = "GET", body } = {}) {
    const res = await fetch("/api" + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
        body: body && JSON.stringify(body)
    }).catch(() => {
        throw new Error(location.protocol === "file:"
            ? "Do not open the HTML file directly. Run npm start, then open http://localhost:5000"
            : "Cannot reach the server. Check that npm start is running.");
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) logout(true);
    if (!res.ok) throw new Error(data.message || "Something went wrong.");
    return data;
}

function toast(msg, bad) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "show" + (bad ? " bad" : "");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.className = ""), 3200);
}

/* ---------- Auth ---------- */
let mode = "login", role = "user";
function setMode(m) {
    mode = m;
    const reg = m === "register";
    $("#authTitle").textContent = reg ? "Create account" : role === "admin" ? "Admin login" : "Student login";
    $("#authBtn").textContent = reg ? "Create account" : "Log in";
    $("#nameRow").hidden = !reg;
    $("#nameRow input").required = reg;
    $("#regRow").hidden = !reg;
    $("#regRow input").required = reg;
    $("#regRow select").required = reg;
    $("#authSwitchText").textContent = reg ? "Already registered?" : "New here?";
    $("#authSwitch").textContent = reg ? "Log in" : "Create an account";
    $("#authErr").textContent = "";
    $("#authForm [name=password]").type = "password";
    $("#pwToggle").textContent = "Show";
    $(".switch").hidden = role === "admin";
    document.querySelectorAll("#roleTabs button").forEach((b) => b.classList.toggle("on", b.dataset.role === role));
}
// Admin can only log in (no self-registration)
function setRole(r) { role = r; setMode(r === "admin" ? "login" : mode); }
function openAuth(m, r = "user") { role = r; setMode(m); $("#authDlg").showModal(); }

function renderNav() {
    $("#navAuth").innerHTML = user
        ? `<span class="hi">Hi, ${esc(user.name.split(" ")[0])}</span><button class="btn btn-light" data-act="logout">Log out</button>`
        : `<button class="btn btn-light" data-act="login">Log in</button><button class="btn btn-blue" data-act="register">Register</button>`;
    $("#navDash").hidden = !user;
}

function logout(silent) {
    token = null; user = null;
    localStorage.removeItem("token"); localStorage.removeItem("user");
    renderNav(); loadDash();
    if (!silent) toast("Logged out.");
}

$("#authSwitch").onclick = (e) => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); };

$("#authForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (mode === "login") f.role = role;
    try {
        const d = await api("/auth/" + mode, { method: "POST", body: f });
        token = d.token; user = d.user;
        localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(user));
        $("#authDlg").close(); e.target.reset();
        renderNav(); loadDash().then(() => { if (user && user.role === "admin") $("#dashboard").scrollIntoView({ behavior: "smooth" }); });
        toast(mode === "register" ? "Account created." : "Welcome back, " + user.name.split(" ")[0] + ".");
        if (pendingSubmit) { pendingSubmit = false; openSubmit(); }
    } catch (err) { $("#authErr").textContent = err.message; }
};

/* ---------- Submit complaint ---------- */
let pendingSubmit = false;
function openSubmit(cat) {
    if (!user) { pendingSubmit = true; toast("Log in or register to submit a complaint."); return openAuth("login"); }
    if (cat) $("#catSel").value = cat;
    $("#subErr").textContent = "";
    $("#subDlg").showModal();
}

$("#subForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
        const d = await api("/complaints", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
        $("#subDlg").close(); e.target.reset();
        toast("Submitted. Your ID is " + d.complaint.complaintId);
        $("#trackId").value = d.complaint.complaintId;
        track(d.complaint.complaintId);
        loadDash();
        $("#tracker").scrollIntoView({ behavior: "smooth" });
    } catch (err) { $("#subErr").textContent = err.message; }
};

/* ---------- Track ---------- */
async function track(id) {
    const box = $("#trackResult");
    try {
        const { complaint: c } = await api("/complaints/track/" + encodeURIComponent(id));
        box.innerHTML = `
          <div class="res-top"><div><small>${esc(c.category)}</small><h3>${esc(c.complaintId)}</h3></div>${badge(c.status)}</div>
          <div class="row"><span>Subject</span><strong>${esc(c.subject)}</strong></div>
          <div class="row"><span>Submitted</span><strong>${fmt(c.createdAt)}</strong></div>
          <div class="bar"><i style="width:${PROGRESS[c.status]}%"></i></div>
          <small class="muted">${PROGRESS[c.status]}% complete</small>
          <ul class="timeline">${[...c.history].reverse().map((h) => `<li><b>${esc(h.status)}</b> ${esc(h.note)}<small>${fmt(h.at)}</small></li>`).join("")}</ul>`;
    } catch (err) { box.innerHTML = `<p class="error">${esc(err.message)}</p>`; }
}
$("#trackForm").onsubmit = (e) => { e.preventDefault(); track($("#trackId").value); };

/* ---------- Dashboard (user = own complaints, admin = all) ---------- */
async function loadDash() {
    const sec = $("#dashboard");
    if (!user) { sec.hidden = true; return; }
    const admin = user.role === "admin";
    try {
        list = (await api(admin ? "/complaints" : "/complaints/mine")).complaints;
    } catch (e) { return toast(e.message, true); }
    sec.hidden = false;
    $("#dashTitle").textContent = admin ? "All complaints" : "My complaints";
    $("#dashSub").textContent = admin ? "Update the status of any complaint. The student sees it instantly." : "Click a row to see its live status.";
    $("#filter").innerHTML = `<option value="">All statuses</option>` + STATUSES.map((s) => `<option>${s}</option>`).join("");
    renderDash();
}

function renderDash() {
    const admin = user.role === "admin";
    $("#stuTh").hidden = !admin;
    const q = $("#search").value.toLowerCase(), f = $("#filter").value;
    const count = (s) => list.filter((c) => c.status === s).length;
    $("#chips").innerHTML = [["Total", list.length], ...["Submitted", "In Progress", "Resolved"].map((s) => [s, count(s)])]
        .map(([l, n]) => `<div class="chip"><strong>${n}</strong><span>${l}</span></div>`).join("");
    const shown = list.filter((c) => (!f || c.status === f) && (c.subject + c.complaintId).toLowerCase().includes(q));
    $("#rows").innerHTML = shown.length
        ? shown.map((c) => `<tr class="click" data-id="${esc(c.complaintId)}">
            <td><b>${esc(c.complaintId)}</b></td><td class="wrap">${esc(c.subject)}</td>${admin ? `<td>${esc(c.rollNo || "-")}<br><small class="muted">${esc(c.department || "")}</small></td>` : ""}<td>${esc(c.category)}</td><td>${fmt(c.createdAt)}</td>
            <td>${admin ? `<select data-status="${esc(c.complaintId)}">${STATUSES.map((s) => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : badge(c.status)}</td></tr>`).join("")
        : `<tr><td colspan="5"><span class="empty">${list.length ? "No complaints match your filter." : admin ? "No complaints yet." : "You have not submitted a complaint yet. Pick a category below to start."}</span></td></tr>`;
}
$("#search").oninput = () => renderDash();
$("#filter").onchange = () => renderDash();

$("#rows").onclick = (e) => {
    if (e.target.closest("select")) return;
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    $("#trackId").value = tr.dataset.id; track(tr.dataset.id);
    $("#tracker").scrollIntoView({ behavior: "smooth" });
};

$("#rows").onchange = async (e) => {
    const id = e.target.dataset.status;
    if (!id) return;
    const note = prompt("Add a note for the citizen (optional):") || "";
    try {
        await api(`/complaints/${id}/status`, { method: "PATCH", body: { status: e.target.value, note } });
        toast(`${id} set to ${e.target.value}.`);
    } catch (err) { toast(err.message, true); }
    loadDash();
};

/* ---------- Wiring ---------- */
document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a) {
        const act = a.dataset.act;
        if (act === "login" || act === "register") openAuth(act);
        if (act === "logout") logout();
        if (act === "submit") openSubmit();
    }
    if (e.target.closest("[data-close]")) e.target.closest("dialog").close();
    if (e.target.id === "pwToggle") {
        const box = $("#authForm [name=password]"), show = box.type === "password";
        box.type = show ? "text" : "password";
        e.target.textContent = show ? "Hide" : "Show";
        e.target.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }
    const tab = e.target.closest("[data-role]");
    if (tab) setRole(tab.dataset.role);
    const card = e.target.closest("[data-cat]");
    if (card) openSubmit(card.dataset.cat);
});

document.addEventListener("DOMContentLoaded", async () => {
    $("#cards").innerHTML = CATS.map(([i, n, d]) => `<button class="card" data-cat="${esc(n)}"><div class="icon">${i}</div><h3>${esc(n)}</h3><p>${esc(d)}</p></button>`).join("");
    $("#catSel").innerHTML = CATS.map((c) => `<option>${esc(c[1])}</option>`).join("");
    $("#heroStats").innerHTML = [["24/7", "Access"], ["Instant", "Complaint ID"], ["Live", "Status updates"]].map(([a, b]) => `<div><strong>${a}</strong><span>${b}</span></div>`).join("");
    renderNav();
    if (token) { try { user = (await api("/auth/me")).user; } catch { /* logout handled in api() */ } }
    renderNav(); loadDash();
});
