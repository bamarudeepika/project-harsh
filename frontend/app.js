const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const state = { user: null, complaints: [], filters: { search: "", status: "all" } };
const app = $("#app"), dashboard = $("#dashboard"), notice = $("#notice"), nav = $("#nav-actions");
const categories = ["Facilities & Maintenance", "Hostel & Accommodation", "Food & Cafeteria", "Academic", "Harassment & Safety", "Transport", "IT & Internet", "Other"];
const statuses = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"];
const statusClass = status => ({ "Submitted":"submitted", "Under Review":"progress", "In Progress":"progress", "Resolved":"resolved", "Rejected":"rejected" }[status] || "submitted");
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
const dateLabel = value => value ? new Date(value).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }) : "—";
const timeLabel = value => value ? new Date(value).toLocaleString() : "—";
function showNotice(message, type = "info") { notice.textContent = message; notice.className = `notice ${type}`; notice.classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); }
function clearNotice() { notice.classList.add("hidden"); notice.textContent = ""; }
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials:"same-origin", ...options, headers: { ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload.error || "The request could not be completed."); error.status = response.status; throw error; }
  return payload;
}
function setAuthTab(tab) {
  $$(".tab").forEach(button => button.classList.toggle("active", button.dataset.authTab === tab));
  $("#login-form").classList.toggle("hidden", tab !== "login");
  $("#register-form").classList.toggle("hidden", tab !== "register");
}
function renderLanding() {
  dashboard.classList.add("hidden"); app.classList.remove("hidden"); nav.innerHTML = '<a class="text-link" href="#how-it-works">How it works</a><a class="button primary small-button" href="#login">Sign in</a>';
}
function renderNav() {
  nav.innerHTML = `<span class="identity-chip">${escapeHTML(state.user.fullName)} · ${state.user.role === "admin" ? "Administrator" : "Student"}</span><button id="logout-button" class="button secondary small-button" type="button">Sign out</button>`;
  $("#logout-button").addEventListener("click", logout);
}
async function loadSession() {
  try { const result = await api("/auth/me"); state.user = result.user; await loadDashboard(); }
  catch { state.user = null; renderLanding(); }
}
async function login(event) {
  event.preventDefault(); clearNotice();
  const form = new FormData(event.currentTarget);
  const button = $("button[type=submit]", event.currentTarget); button.disabled = true; button.textContent = "Signing in…";
  try { const result = await api("/auth/login", { method:"POST", body:JSON.stringify({ email:form.get("email"), password:form.get("password") }) }); state.user = result.user; await loadDashboard(); showNotice("Welcome back. You are signed in.", "success"); }
  catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; button.innerHTML = 'Sign in <span aria-hidden="true">→</span>'; }
}
async function register(event) {
  event.preventDefault(); clearNotice();
  const form = new FormData(event.currentTarget);
  const button = $("button[type=submit]", event.currentTarget); button.disabled = true; button.textContent = "Creating account…";
  try { const result = await api("/auth/register", { method:"POST", body:JSON.stringify({ fullName:form.get("fullName"), email:form.get("email"), studentId:form.get("studentId"), password:form.get("password") }) }); state.user = result.user; await loadDashboard(); showNotice("Your student account has been created.", "success"); }
  catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; button.innerHTML = 'Create student account <span aria-hidden="true">→</span>'; }
}
async function logout() {
  try { await api("/auth/logout", { method:"POST", body:"{}" }); } catch {}
  state.user = null; state.complaints = []; renderLanding(); showNotice("You have signed out.", "success");
}
async function loadDashboard() {
  app.classList.add("hidden"); dashboard.classList.remove("hidden"); renderNav(); dashboard.innerHTML = '<div class="empty-state"><p>Loading your dashboard…</p></div>';
  try {
    const result = await api("/complaints");
    state.complaints = result.complaints;
    if (state.user.role === "admin") renderAdminDashboard(); else renderStudentDashboard();
  } catch (error) { showNotice(error.message, "error"); dashboard.innerHTML = ""; state.user = null; renderLanding(); }
}
function statCard(label, count) { return `<article class="stat-card"><span>${escapeHTML(label)}</span><strong>${count}</strong></article>`; }
function statusPill(status) { return `<span class="pill pill-${statusClass(status)}">${escapeHTML(status)}</span>`; }
function complaintRows(items, admin = false) {
  if (!items.length) return `<tr><td colspan="${admin ? 6 : 4}"><div class="empty-state"><div class="empty-icon">✦</div><h3>No complaints found</h3><p>${admin ? "New student submissions will appear here." : "When you submit a concern, it will appear here."}</p></div></td></tr>`;
  return items.map(c => `<tr><td><strong>${escapeHTML(c.title)}</strong><small>${escapeHTML(c.reference_no)} · ${escapeHTML(c.category)}</small></td>${admin ? `<td>${escapeHTML(c.student_name || "Student")}<small>${escapeHTML(c.student_email || "")}</small></td>` : ""}<td>${statusPill(c.status)}</td><td>${dateLabel(c.created_at)}</td><td><button class="button secondary small-button" type="button" data-view="${escapeHTML(c.id)}">View details</button></td>${admin ? `<td><button class="button primary small-button" type="button" data-manage="${escapeHTML(c.id)}">Manage</button></td>` : ""}</tr>`).join("");
}
function renderStudentDashboard() {
  const list = state.complaints;
  dashboard.innerHTML = `<div class="dashboard-head"><div><span class="eyebrow">Student workspace</span><h1>Your dashboard</h1><p>Welcome, ${escapeHTML(state.user.fullName)}. Your concerns and updates are in one place.</p></div><div class="dashboard-actions"><button id="new-complaint" class="button primary" type="button">＋ New complaint</button></div></div>
  <div class="stats-grid">${statCard("Total complaints",list.length)}${statCard("Submitted",list.filter(c=>c.status==="Submitted").length)}${statCard("In progress",list.filter(c=>["Under Review","In Progress"].includes(c.status)).length)}${statCard("Resolved",list.filter(c=>c.status==="Resolved").length)}</div>
  <section id="new-complaint-card" class="content-card hidden"><div class="card-heading"><div><h2>Submit a complaint</h2><p>Provide enough detail to help the team understand the issue.</p></div></div>
  <form id="complaint-form" class="complaint-form">
    <label>Complaint title<input name="title" required minlength="5" maxlength="150" placeholder="Briefly describe the issue"></label>
    <label>Category<select name="category" required>${categories.map(c=>`<option>${escapeHTML(c)}</option>`).join("")}</select></label>
    <label>Location on campus<input name="location" maxlength="160" placeholder="e.g. Block B, Room 204"></label>
    <label>Priority<select name="priority"><option value="Normal">Normal</option><option value="High">High</option><option value="Urgent">Urgent</option></select></label>
    <label class="wide">Description<textarea name="description" required minlength="20" maxlength="5000" placeholder="Explain what happened, when it happened, and what would help resolve it."></textarea></label>
    <p class="wide muted" style="font-size:11px;margin:0">For immediate danger, contact campus security or local emergency services rather than relying on this portal.</p>
    <div class="form-actions"><button id="cancel-complaint" class="button secondary" type="button">Cancel</button><button class="button primary" type="submit">Submit complaint</button></div>
  </form></section>
  <section class="content-card"><div class="card-heading"><div><h2>Your complaints</h2><p>Review the current status and the latest response.</p></div><span class="muted" style="font-size:12px">${list.length} total</span></div>
  <div class="filters"><input id="search-filter" type="search" placeholder="Search title or reference…" aria-label="Search complaints"><select id="status-filter" aria-label="Filter by status"><option value="all">All statuses</option>${statuses.map(s=>`<option>${s}</option>`).join("")}</select></div>
  <div class="table-wrap"><table><thead><tr><th>Complaint</th><th>Status</th><th>Submitted</th><th>Details</th></tr></thead><tbody id="complaint-rows"></tbody></table></div></section>`;
  $("#new-complaint").addEventListener("click",()=>{ $("#new-complaint-card").classList.toggle("hidden"); $("#new-complaint-card").scrollIntoView({behavior:"smooth",block:"start"}); });
  $("#cancel-complaint").addEventListener("click",()=>$("#new-complaint-card").classList.add("hidden"));
  $("#complaint-form").addEventListener("submit",submitComplaint);
  $("#search-filter").addEventListener("input",filterComplaints); $("#status-filter").addEventListener("change",filterComplaints);
  $("#complaint-rows").addEventListener("click",event=>{const button=event.target.closest("[data-view]");if(button)openComplaint(button.dataset.view);});
  filterComplaints();
}
function filterComplaints() {
  const search = ($("#search-filter")?.value || "").toLowerCase(); const status = $("#status-filter")?.value || "all";
  const items = state.complaints.filter(c=>(status==="all"||c.status===status)&&`${c.title} ${c.reference_no} ${c.category}`.toLowerCase().includes(search));
  $("#complaint-rows").innerHTML = complaintRows(items);
}
async function submitComplaint(event) {
  event.preventDefault(); clearNotice(); const form = new FormData(event.currentTarget);
  const button = $("button[type=submit]",event.currentTarget); button.disabled=true; button.textContent="Submitting…";
  try {
    await api("/complaints",{method:"POST",body:JSON.stringify({title:form.get("title"),category:form.get("category"),location:form.get("location"),priority:form.get("priority"),description:form.get("description")})});
    await loadDashboard(); showNotice("Complaint submitted successfully. Save its reference number for follow-up.","success");
  } catch(error){showNotice(error.message,"error");button.disabled=false;button.textContent="Submit complaint";}
}
function renderAdminDashboard() {
  const list = state.complaints;
  dashboard.innerHTML = `<div class="dashboard-head"><div><span class="eyebrow">Administration workspace</span><h1>Grievance overview</h1><p>Review submissions, update statuses, and record responses.</p></div><span class="identity-chip">Administrator access</span></div>
  <div class="stats-grid">${statCard("Total complaints",list.length)}${statCard("Awaiting review",list.filter(c=>c.status==="Submitted").length)}${statCard("In progress",list.filter(c=>["Under Review","In Progress"].includes(c.status)).length)}${statCard("Resolved",list.filter(c=>c.status==="Resolved").length)}</div>
  <section class="content-card"><div class="card-heading"><div><h2>All student complaints</h2><p>Only authorized administrators can change complaint status.</p></div></div>
  <div class="filters"><input id="search-filter" type="search" placeholder="Search title, reference, or student…" aria-label="Search complaints"><select id="status-filter" aria-label="Filter by status"><option value="all">All statuses</option>${statuses.map(s=>`<option>${s}</option>`).join("")}</select></div>
  <div class="table-wrap"><table><thead><tr><th>Complaint</th><th>Student</th><th>Status</th><th>Submitted</th><th>Details</th><th>Manage</th></tr></thead><tbody id="complaint-rows"></tbody></table></div></section>`;
  $("#search-filter").addEventListener("input",filterAdminComplaints); $("#status-filter").addEventListener("change",filterAdminComplaints);
  $("#complaint-rows").addEventListener("click",event=>{const view=event.target.closest("[data-view]");const manage=event.target.closest("[data-manage]");if(view)openComplaint(view.dataset.view);if(manage)openComplaint(manage.dataset.manage,true);});
  filterAdminComplaints();
}
function filterAdminComplaints() {
  const search=($("#search-filter")?.value||"").toLowerCase(),status=$("#status-filter")?.value||"all";
  const items=state.complaints.filter(c=>(status==="all"||c.status===status)&&`${c.title} ${c.reference_no} ${c.category} ${c.student_name||""} ${c.student_email||""}`.toLowerCase().includes(search));
  $("#complaint-rows").innerHTML=complaintRows(items,true);
}
async function openComplaint(id, manage = false) {
  clearNotice();
  try {
    const { complaint, updates } = await api(`/complaints/${encodeURIComponent(id)}`);
    const dialog=$("#detail-dialog"),content=$("#dialog-content");
    const updateMarkup=updates.length?updates.map(u=>`<div class="timeline-item"><strong>${escapeHTML(u.status || "Update")} · ${escapeHTML(u.author_name || "CampusCare team")}</strong><p>${escapeHTML(u.message)}</p><small>${timeLabel(u.created_at)}</small></div>`).join(""):'<p class="muted" style="font-size:12px">No updates have been posted yet.</p>';
    content.innerHTML=`<span class="eyebrow">${escapeHTML(complaint.reference_no)}</span><h2>${escapeHTML(complaint.title)}</h2><p>${statusPill(complaint.status)} <span class="muted" style="font-size:12px"> · ${escapeHTML(complaint.category)}</span></p>
      <div class="detail-grid"><div class="detail-item"><small>Submitted by</small><strong>${escapeHTML(complaint.student_name||"You")}</strong></div><div class="detail-item"><small>Priority</small><strong>${escapeHTML(complaint.priority)}</strong></div><div class="detail-item"><small>Location</small><strong>${escapeHTML(complaint.location||"Not specified")}</strong></div><div class="detail-item"><small>Submitted</small><strong>${dateLabel(complaint.created_at)}</strong></div></div>
      <h3>Description</h3><p style="font-size:13px;white-space:pre-wrap">${escapeHTML(complaint.description)}</p><h3>Activity and responses</h3><div class="timeline">${updateMarkup}</div>
      ${manage && state.user.role==="admin" ? `<div class="admin-update"><h3>Update complaint</h3><form id="update-form" class="inline-form"><select name="status" aria-label="New status">${statuses.map(s=>`<option ${s===complaint.status?"selected":""}>${s}</option>`).join("")}</select><textarea name="message" maxlength="2000" placeholder="Add a response or status note (required)"></textarea><button class="button primary" type="submit">Save update</button></form></div>`:""}`;
    dialog.showModal();
    if(manage && state.user.role==="admin") $("#update-form").addEventListener("submit",async event=>{
      event.preventDefault(); const form=new FormData(event.currentTarget); const button=$("button[type=submit]",event.currentTarget); button.disabled=true;
      try { await api(`/complaints/${encodeURIComponent(id)}/status`,{method:"PATCH",body:JSON.stringify({status:form.get("status"),message:form.get("message")})}); dialog.close(); await loadDashboard(); showNotice("Complaint status and activity updated.","success"); }
      catch(error){showNotice(error.message,"error");button.disabled=false;}
    });
  } catch(error) { showNotice(error.message,"error"); }
}
$$("[data-auth-tab]").forEach(button=>button.addEventListener("click",()=>setAuthTab(button.dataset.authTab)));
$("#login-form").addEventListener("submit",login);
$("#register-form").addEventListener("submit",register);
loadSession();
