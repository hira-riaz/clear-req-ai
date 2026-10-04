// Configurable so a deployed build can point at a different backend than
// localhost. Falls back to same-origin, which is correct when FastAPI
// serves this frontend itself.
const API_BASE = window.CLEARREQ_API_BASE || "";

let authToken = localStorage.getItem("clearreq_token") || null;
let currentUser = null;

let currentSessionId = null;
let currentRequirementId = null;
let requirementCount = 0;
let currentAmbiguities = [];
let currentAmbiguityIndex = 0;
let currentAnswers = [];
let discoveryIndex = 0;
let discoveryAnswers = [];
let lastReportData = null;
let sessions = [];

const DISCOVERY_QUESTIONS = [
  { question: "What platform(s) should this system run on?", options: ["Web", "Mobile app", "Desktop", "Multiple platforms"] },
  { question: "Who are the primary users of this system?", options: ["General public", "Internal staff/employees", "Business customers", "Mixed / multiple user types"] },
  { question: "Is this replacing an existing system?", options: ["Yes, replacing an existing system", "No, built from scratch", "Not sure yet"] },
  { question: "Will the system handle sensitive data?", options: ["Yes, payment data", "Yes, personal/health data", "No sensitive data expected", "Not sure yet"] },
  { question: "What scale of usage is expected?", options: ["Small (under 100 users)", "Medium (100–10,000 users)", "Large (10,000+ users)", "Not sure yet"] },
  { question: "Are there fixed constraints on this project?", options: ["Fixed deadline", "Fixed budget", "Both", "No fixed constraints"] },
];

// ---------- DOM ----------
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmitBtn = document.getElementById("authSubmitBtn");
let authMode = "login";

const sidebarList = document.getElementById("sidebarList");
const sessionSearch = document.getElementById("sessionSearch");
const newSessionSidebarBtn = document.getElementById("newSessionSidebarBtn");
const userNameLabel = document.getElementById("userNameLabel");
const logoutBtn = document.getElementById("logoutBtn");
const renameBtn = document.getElementById("renameBtn");

const startCard = document.getElementById("startCard");
const discoveryCard = document.getElementById("discoveryCard");
const discoveryStepper = document.getElementById("discoveryStepper");
const mainCard = document.getElementById("mainCard");
const reviewCard = document.getElementById("reviewCard");
const reportCard = document.getElementById("reportCard");

const projectNameInput = document.getElementById("projectNameInput");
const startSessionBtn = document.getElementById("startSessionBtn");
const projectLabel = document.getElementById("projectLabel");
const reqCounterLabel = document.getElementById("reqCounterLabel");
const analyzeBtn = document.getElementById("analyzeBtn");
const requirementInput = document.getElementById("requirementInput");
const ambiguitiesSection = document.getElementById("ambiguitiesSection");
const ambiguityStepper = document.getElementById("ambiguityStepper");
const finishBtn = document.getElementById("finishBtn");

const reviewList = document.getElementById("reviewList");
const generateReportBtn = document.getElementById("generateReportBtn");
const reportDoc = document.getElementById("reportDoc");
const exportDocBtn = document.getElementById("exportDocBtn");
const backToSidebarBtn = document.getElementById("backToSidebarBtn");

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------- fetch wrapper: attaches token, handles 401 globally ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail || "Request failed";
    const isAuthEndpoint = path.startsWith("/auth/login") || path.startsWith("/auth/register");
    if (!isAuthEndpoint) logout();
    throw new Error(isAuthEndpoint ? detail : "Session expired — please log in again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail?.[0]?.msg || body?.detail || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}
// ---------- auth ----------
loginTab.addEventListener("click", () => setAuthMode("login"));
registerTab.addEventListener("click", () => setAuthMode("register"));

function setAuthMode(mode) {
  authMode = mode;
  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");
  authName.classList.toggle("hidden", mode === "login");
  authSubmitBtn.textContent = mode === "login" ? "Log in" : "Sign up";
  authError.classList.add("hidden");
}

authSubmitBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) return;
  authSubmitBtn.disabled = true;
  try {
    const payload = authMode === "login"
      ? { email, password }
      : { name: authName.value.trim(), email, password };
    const data = await api(authMode === "login" ? "/auth/login" : "/auth/register", {
      method: "POST", body: JSON.stringify(payload),
    });
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem("clearreq_token", authToken);
    await enterApp();
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  } finally {
    authSubmitBtn.disabled = false;
  }
});

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("clearreq_token");
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
  resetSessionState();
}
logoutBtn.addEventListener("click", logout);

async function enterApp() {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  userNameLabel.textContent = currentUser.name;
  await loadSidebar();
  showStartScreen();
}

(async function init() {
  if (!authToken) return;
  try {
    currentUser = await api("/auth/me");
    await enterApp();
  } catch {
    logout();
  }
})();

// ---------- sidebar ----------
newSessionSidebarBtn.addEventListener("click", showStartScreen);
sessionSearch.addEventListener("input", renderSidebar);

async function loadSidebar() {
  try {
    sessions = await api("/sessions");
    renderSidebar();
  } catch (err) {
    console.error(err);
  }
}

function renderSidebar() {
  const q = sessionSearch.value.trim().toLowerCase();
  const filtered = sessions.filter((s) => s.project_name.toLowerCase().includes(q));
  sidebarList.innerHTML = filtered.map((s) => `
    <div class="sidebar-item ${s.session_id === currentSessionId ? "active" : ""}" data-id="${s.session_id}">
      <span class="sidebar-item-name">${escapeHtml(s.project_name)}</span>
      <span class="sidebar-item-meta">${s.translated_count}/${s.requirement_count}</span>
      <button class="sidebar-item-del" data-del="${s.session_id}" title="Delete">✕</button>
    </div>
  `).join("") || "<p class='report-empty'>No sessions yet.</p>";

  sidebarList.querySelectorAll(".sidebar-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-del]")) return;
      openSession(parseInt(el.dataset.id, 10));
    });
  });
  sidebarList.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.del, 10);
      if (!confirm("Delete this session and all its requirements? This cannot be undone.")) return;
      try {
        await api(`/sessions/${id}`, { method: "DELETE" });
        sessions = sessions.filter((s) => s.session_id !== id);
        if (currentSessionId === id) showStartScreen();
        renderSidebar();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function openSession(sessionId) {
  currentSessionId = sessionId;
  resetWizardOnly();
  renderSidebar();
  try {
    const data = await api(`/sessions/${sessionId}/report`);
    lastReportData = data;
    projectLabel.textContent = data.project_name;
    const total = data.requirements.length;
    requirementCount = total;
    reqCounterLabel.textContent = `Requirements added: ${total}`;
    showCard(mainCard);
    finishBtn.disabled = total === 0;
  } catch (err) {
    alert(err.message);
  }
}

renameBtn.addEventListener("click", async () => {
  if (!currentSessionId) return;
  const name = prompt("Rename project:", projectLabel.textContent);
  if (!name || !name.trim()) return;
  try {
    const data = await api(`/sessions/${currentSessionId}`, { method: "PATCH", body: JSON.stringify({ project_name: name.trim() }) });
    projectLabel.textContent = data.project_name;
    await loadSidebar();
  } catch (err) {
    alert(err.message);
  }
});

function showCard(card) {
  [startCard, discoveryCard, mainCard, reviewCard, reportCard].forEach((c) => c.classList.add("hidden"));
  card.classList.remove("hidden");
}

function showStartScreen() {
  currentSessionId = null;
  resetWizardOnly();
  projectNameInput.value = "";
  showCard(startCard);
  renderSidebar();
}

function resetWizardOnly() {
  currentRequirementId = null;
  currentAmbiguities = [];
  currentAmbiguityIndex = 0;
  currentAnswers = [];
  discoveryIndex = 0;
  discoveryAnswers = [];
  lastReportData = null;
  requirementInput.value = "";
  ambiguitiesSection.classList.add("hidden");
  ambiguityStepper.innerHTML = "";
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Analyze";
}

function resetSessionState() {
  sessions = [];
  currentSessionId = null;
  resetWizardOnly();
}

// ---------- start session ----------
startSessionBtn.addEventListener("click", async () => {
  const name = projectNameInput.value.trim();
  if (!name) return;
  startSessionBtn.disabled = true;
  startSessionBtn.textContent = "Starting...";
  try {
    const data = await api("/sessions", { method: "POST", body: JSON.stringify({ project_name: name }) });
    currentSessionId = data.session_id;
    projectLabel.textContent = data.project_name;
    await loadSidebar();
    showCard(discoveryCard);
    showDiscoveryQuestion();
  } catch (err) {
    alert(err.message);
  } finally {
    startSessionBtn.disabled = false;
    startSessionBtn.textContent = "Start session";
  }
});

// ---------- discovery ----------
function showDiscoveryQuestion() {
  if (discoveryIndex >= DISCOVERY_QUESTIONS.length) {
    submitDiscovery();
    return;
  }
  const q = DISCOVERY_QUESTIONS[discoveryIndex];
  const div = document.createElement("div");
  div.className = "ambiguity-card";
  div.innerHTML = `
    <p class="question">${escapeHtml(q.question)}</p>
    <div class="options-list">
      ${q.options.map((o) => `<button class="option-btn" data-answer="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join("")}
    </div>
    <button class="secondary-btn small-btn skip-btn">Skip</button>
  `;
  discoveryStepper.innerHTML = "";
  discoveryStepper.appendChild(div);
  div.querySelectorAll(".option-btn").forEach((btn) => btn.addEventListener("click", () => recordDiscoveryAnswer(q.question, btn.dataset.answer)));
  div.querySelector(".skip-btn").addEventListener("click", () => recordDiscoveryAnswer(q.question, null));
}

function recordDiscoveryAnswer(question, answer) {
  discoveryAnswers.push({ question, answer });
  discoveryIndex += 1;
  showDiscoveryQuestion();
}

async function submitDiscovery() {
  try {
    await api(`/sessions/${currentSessionId}/discovery`, { method: "POST", body: JSON.stringify({ answers: discoveryAnswers }) });
  } catch (err) {
    console.error(err);
  }
  showCard(mainCard);
}

// ---------- analyze / clarify ----------
analyzeBtn.addEventListener("click", async () => {
  const text = requirementInput.value.trim();
  if (!text || !currentSessionId) return;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  try {
    const data = await api("/requirements/analyze", { method: "POST", body: JSON.stringify({ session_id: currentSessionId, text }) });
    currentRequirementId = data.requirement_id;
    currentAmbiguities = data.ambiguities;
    currentAmbiguityIndex = 0;
    currentAnswers = [];
    if (currentAmbiguities.length === 0) {
      await finalizeRequirement();
    } else {
      ambiguitiesSection.classList.remove("hidden");
      showCurrentAmbiguity();
    }
  } catch (err) {
    alert(err.message);
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
  }
});

function showCurrentAmbiguity() {
  if (currentAmbiguityIndex >= currentAmbiguities.length) {
    finalizeRequirement();
    return;
  }
  const a = currentAmbiguities[currentAmbiguityIndex];
  const isConflict = a.category === "conflict";
  let optionsHtml = "";
  if (a.suggested_answer) {
    optionsHtml += `<button class="option-btn suggested-btn" data-answer="${escapeHtml(a.suggested_answer)}">${escapeHtml(a.suggested_answer)} <span class="reused-tag">(used earlier)</span></button>`;
  }
  (a.options || []).forEach((opt) => {
    optionsHtml += `<button class="option-btn" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`;
  });
  optionsHtml += `<button class="option-btn other-btn" id="otherOptionBtn">Other...</button>`;
  optionsHtml += `<button class="option-btn skip-answer-btn" id="skipAnswerBtn">Skip this one</button>`;

  const div = document.createElement("div");
  div.className = isConflict ? "ambiguity-card conflict-card" : "ambiguity-card";
  div.innerHTML = `
    <div class="ambiguity-top">
      <span class="term">${isConflict ? "⚠ Conflict detected" : `"${escapeHtml(a.term)}"`}</span>
      <span class="category ${isConflict ? "conflict" : ""}">${escapeHtml(a.category)}</span>
    </div>
    <p class="question">${escapeHtml(a.question)}</p>
    <div class="options-list">${optionsHtml}</div>
    <div class="other-input-row hidden">
      <input class="answer-input other-input" placeholder="Type your own answer..." />
      <button class="small-btn confirm-other-btn">Confirm</button>
    </div>
  `;
  ambiguityStepper.innerHTML = "";
  ambiguityStepper.appendChild(div);

  div.querySelectorAll(".option-btn:not(.other-btn):not(.skip-answer-btn)").forEach((btn) => {
    btn.addEventListener("click", () => recordAnswer(a.ambiguity_id, btn.dataset.answer));
  });
  div.querySelector("#otherOptionBtn").addEventListener("click", () => {
    div.querySelector(".other-input-row").classList.remove("hidden");
    div.querySelector(".other-input").focus();
  });
  div.querySelector("#skipAnswerBtn").addEventListener("click", () => {
    currentAmbiguityIndex += 1;
    showCurrentAmbiguity();
  });
  div.querySelector(".confirm-other-btn").addEventListener("click", () => {
    const val = div.querySelector(".other-input").value.trim();
    if (val) recordAnswer(a.ambiguity_id, val);
  });
}

function recordAnswer(ambiguityId, answer) {
  currentAnswers.push({ ambiguity_id: ambiguityId, answer });
  currentAmbiguityIndex += 1;
  showCurrentAmbiguity();
}

async function finalizeRequirement() {
  try {
    await api("/requirements/translate", { method: "POST", body: JSON.stringify({ requirement_id: currentRequirementId, answers: currentAnswers }) });
    requirementCount += 1;
    reqCounterLabel.textContent = `Requirements added: ${requirementCount}`;
    finishBtn.disabled = false;
    resetWizardOnly();
    requirementInput.focus();
    loadSidebar();
  } catch (err) {
    alert(err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
  }
}

// ---------- review ----------
finishBtn.addEventListener("click", async () => {
  if (!ambiguitiesSection.classList.contains("hidden") && currentRequirementId) {
    alert("You have an unfinished requirement — resolve the current question before finishing.");
    return;
  }
  await loadReview();
  showCard(reviewCard);
});

async function loadReview() {
  try {
    const data = await api(`/sessions/${currentSessionId}/report`);
    lastReportData = data;
    reviewList.innerHTML = data.requirements.map((r) => `
      <div class="review-item" data-id="${r.requirement_id}">
        <p class="translated">${escapeHtml(r.translated_text) || "(no translation)"}</p>
        <p class="original-ref">Original: "${escapeHtml(r.original_text)}"</p>
        <div class="req-meta">
          <span class="status-badge status-${r.status}">${escapeHtml(r.status)}</span>
          <span class="category-tag">${escapeHtml(r.category)}</span>
          ${r.approved_by ? `<span class="approved-tag">✓ approved by ${escapeHtml(r.approved_by)}</span>` : ""}
        </div>
        <div class="row-actions">
          <button class="secondary-btn small-btn history-btn">History</button>
          <button class="secondary-btn small-btn edit-btn">Edit</button>
          ${r.status !== "approved" ? `<button class="small-btn approve-btn">Approve</button>` : ""}
        </div>
        <div class="version-history hidden"></div>
      </div>
    `).join("");

    reviewList.querySelectorAll(".edit-btn").forEach((b) => b.addEventListener("click", (e) => startEdit(e.target.closest(".review-item"))));
    reviewList.querySelectorAll(".history-btn").forEach((b) => b.addEventListener("click", (e) => toggleHistory(e.target.closest(".review-item"))));
    reviewList.querySelectorAll(".approve-btn").forEach((b) => b.addEventListener("click", (e) => approveRequirement(e.target.closest(".review-item").dataset.id)));
  } catch (err) {
    alert(err.message);
  }
}

async function approveRequirement(id) {
  const notes = prompt("Optional approval note:") || null;
  try {
    await api(`/requirements/${id}/approve`, { method: "POST", body: JSON.stringify({ notes }) });
    await loadReview();
  } catch (err) {
    alert(err.message);
  }
}

async function toggleHistory(itemDiv) {
  const panel = itemDiv.querySelector(".version-history");
  if (!panel.classList.contains("hidden")) { panel.classList.add("hidden"); return; }
  try {
    const data = await api(`/requirements/${itemDiv.dataset.id}`);
    panel.innerHTML = data.versions.map((v) => `
      <div class="version-entry">
        <p class="version-meta">v${v.version_number} · ${v.confidence_score != null ? Math.round(v.confidence_score * 100) + "%" : "—"} · ${escapeHtml(new Date(v.created_at).toLocaleString())}</p>
        <p class="version-text">${escapeHtml(v.translated_text)}</p>
      </div>
    `).join("") || "<p class='version-meta'>No versions yet.</p>";
    panel.classList.remove("hidden");
  } catch (err) {
    alert(err.message);
  }
}

function startEdit(itemDiv) {
  const currentText = itemDiv.querySelector(".translated").textContent;
  itemDiv.innerHTML = `
    <textarea class="edit-textarea">${escapeHtml(currentText)}</textarea>
    <div class="row-actions">
      <button class="secondary-btn small-btn cancel-edit-btn">Cancel</button>
      <button class="small-btn save-edit-btn">Save</button>
    </div>
  `;
  itemDiv.querySelector(".cancel-edit-btn").addEventListener("click", loadReview);
  itemDiv.querySelector(".save-edit-btn").addEventListener("click", async () => {
    const newText = itemDiv.querySelector(".edit-textarea").value.trim();
    if (!newText) return;
    try {
      await api(`/requirements/${itemDiv.dataset.id}/edit`, { method: "PATCH", body: JSON.stringify({ translated_text: newText }) });
      await loadReview();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------- report ----------
generateReportBtn.addEventListener("click", async () => {
  try {
    let data = lastReportData;
    if (!data) data = await api(`/sessions/${currentSessionId}/report`);
    renderReportDoc(data);
    showCard(reportCard);
  } catch (err) {
    alert(err.message);
  }
});

function renderReportDoc(data) {
  const functional = data.requirements.filter((r) => r.req_type === "Functional");
  const nonFunctional = data.requirements.filter((r) => r.req_type === "Non-Functional");

  const reqLine = (r) => `<li>${escapeHtml(r.translated_text) || "(no translation)"}
    <div class="req-meta">
      <span class="status-badge status-${r.status}">${escapeHtml(r.status)}</span>
      <span class="category-tag">${escapeHtml(r.category)}</span>
      ${r.approved_by ? `<span class="approved-tag">✓ ${escapeHtml(r.approved_by)}</span>` : ""}
    </div></li>`;

  const functionalHtml = functional.length ? `<ol>${functional.map(reqLine).join("")}</ol>` : "<p class='report-empty'>(none)</p>";

  const nfrGroups = {};
  nonFunctional.forEach((r) => (nfrGroups[r.category] = nfrGroups[r.category] || []).push(r));
  const nonFunctionalHtml = nonFunctional.length
    ? Object.entries(nfrGroups).map(([cat, items]) => `<h4>${escapeHtml(cat.charAt(0).toUpperCase() + cat.slice(1))}</h4><ol>${items.map(reqLine).join("")}</ol>`).join("")
    : "<p class='report-empty'>(none)</p>";

  reportDoc.innerHTML = `
    <h3>${escapeHtml(data.project_name)} — Requirements</h3>
    <h4>Functional Requirements</h4>${functionalHtml}
    <h4>Non-Functional Requirements</h4>${nonFunctionalHtml}
  `;
}

exportDocBtn.addEventListener("click", async () => {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report/docx`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.status === 401) { logout(); throw new Error("Session expired — please log in again."); }
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirements.docx";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

backToSidebarBtn.addEventListener("click", () => { showStartScreen(); loadSidebar(); });
