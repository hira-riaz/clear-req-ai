import {
  getCurrentSession,
  initializeSupabaseAuth,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuthState,
} from "./supabase-auth.js";

// Configurable so a deployed build can point at a different backend than
// localhost. Falls back to same-origin, which is correct when FastAPI
// serves this frontend itself.
const API_BASE = window.CLEARREQ_API_BASE || "";

let currentUser = null;
let currentSession = null;

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
const sessionDetailCard = document.getElementById("sessionDetailCard");
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

// ---------- modal engine: replaces confirm()/prompt() with in-app UI ----------
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalInput = document.getElementById("modalInput");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalConfirmBtn = document.getElementById("modalConfirmBtn");

function showModal({ title, message = "", withInput = false, inputValue = "", inputPlaceholder = "", danger = false, confirmLabel = "Confirm" }) {
  return new Promise((resolve) => {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalMessage.classList.toggle("hidden", !message);
    modalInput.classList.toggle("hidden", !withInput);
    modalInput.value = inputValue;
    modalInput.placeholder = inputPlaceholder;
    modalConfirmBtn.textContent = confirmLabel;
    modalConfirmBtn.classList.toggle("modal-danger", danger);
    modalOverlay.classList.remove("hidden");
    if (withInput) setTimeout(() => modalInput.focus(), 0);

    function cleanup(result) {
      modalOverlay.classList.add("hidden");
      modalConfirmBtn.removeEventListener("click", onConfirm);
      modalCancelBtn.removeEventListener("click", onCancel);
      modalInput.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onConfirm() { cleanup(withInput ? (modalInput.value.trim() || null) : true); }
    function onCancel() { cleanup(withInput ? null : false); }
    function onKey(e) {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") onCancel();
    }
    modalConfirmBtn.addEventListener("click", onConfirm);
    modalCancelBtn.addEventListener("click", onCancel);
    modalInput.addEventListener("keydown", onKey);
  });
}

function confirmModal(title, message, danger = false) {
  return showModal({ title, message, danger, confirmLabel: danger ? "Delete" : "Confirm" });
}
function promptModal(title, { message = "", inputValue = "", inputPlaceholder = "" } = {}) {
  return showModal({ title, message, withInput: true, inputValue, inputPlaceholder, confirmLabel: "Save" });
}

// ---------- fetch wrapper: attaches the current Supabase access token ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const session = await getCurrentSession();
  currentSession = session;
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    const body = await res.json().catch(() => null);
    await logout().catch((err) => console.error("Supabase sign-out failed:", err));
    throw new Error(body?.detail || "Session expired — please sign in again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail?.[0]?.msg || body?.detail || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Supabase Auth ----------
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
  if (authMode === "register" && !authName.value.trim()) {
    authError.textContent = "Enter your name to create an account.";
    authError.classList.remove("hidden");
    return;
  }
  authSubmitBtn.disabled = true;
  try {
    if (authMode === "login") {
      const data = await signInWithPassword(email, password);
      currentSession = data.session;
      currentUser = data.user;
      await enterApp();
    } else {
      const data = await signUpWithPassword(email, password, authName.value.trim());
      if (!data.session) {
        authError.textContent = "Check your email to confirm your account, then sign in.";
        authError.classList.remove("hidden");
      } else {
        currentSession = data.session;
        currentUser = data.user;
        await enterApp();
      }
    }
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  } finally {
    authSubmitBtn.disabled = false;
  }
});

function showSignedOutScreen() {
  currentSession = null;
  currentUser = null;
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
  resetSessionState();
}

async function logout() {
  showSignedOutScreen();
  await signOut();
}
logoutBtn.addEventListener("click", async () => {
  try {
    await logout();
  } catch (err) {
    alert(err.message);
  }
});

async function enterApp() {
  if (!currentUser) return;
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  userNameLabel.textContent = currentUser.user_metadata?.name || currentUser.email || "Account";
  await loadSidebar();
  showStartScreen();
}

(async function init() {
  try {
    await initializeSupabaseAuth();
    subscribeToAuthState((event, session) => {
      currentSession = session;
      currentUser = session?.user || null;
      if (event === "SIGNED_OUT") showSignedOutScreen();
    });
    currentSession = await getCurrentSession();
    currentUser = currentSession?.user || null;
    if (currentSession) await enterApp();
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
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
      ${s.requirement_count > 0 ? `<button class="sidebar-continue-btn" data-continue="${s.session_id}" title="Continue Session" aria-label="Continue ${escapeHtml(s.project_name)}">Continue</button>` : ""}
      <button class="sidebar-item-del" data-del="${s.session_id}" title="Delete">✕</button>
    </div>
  `).join("") || "<p class='report-empty'>No sessions yet.</p>";

  sidebarList.querySelectorAll(".sidebar-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-del], [data-continue]")) return;
      openSession(parseInt(el.dataset.id, 10));
    });
  });
  sidebarList.querySelectorAll("[data-continue]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      continueExistingSession(parseInt(btn.dataset.continue, 10));
    });
  });
  sidebarList.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.del, 10);
      const sessionName = sessions.find((s) => s.session_id === id)?.project_name || "this session";
      const ok = await confirmModal("Delete session?", `"${sessionName}" and all its requirements will be permanently deleted.`, true);
      if (!ok) return;
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
    if (currentSessionId !== sessionId) return; // a newer click superseded this one
    lastReportData = data;
    showSessionDetail(sessionId, data);
  } catch (err) {
    alert(err.message);
  }
}

function showSessionDetail(sessionId, data) {
  const reqs = data.requirements;
  const total = reqs.length;
  const functional = reqs.filter((r) => r.req_type === "Functional").length;
  const nonFunctional = reqs.filter((r) => r.req_type === "Non-Functional").length;
  const approved = reqs.filter((r) => r.status === "approved").length;
  const translated = reqs.filter((r) => r.status === "translated" || r.status === "approved").length;

  const sessionMeta = sessions.find((s) => s.session_id === sessionId);

  document.getElementById("detailProjectLabel").textContent = data.project_name;
  document.getElementById("statsGrid").innerHTML = `
    <div class="stat-box"><div class="stat-value">${total}</div><div class="stat-label">Requirements</div></div>
    <div class="stat-box"><div class="stat-value">${approved}</div><div class="stat-label">Approved</div></div>
    <div class="stat-box"><div class="stat-value">${functional}</div><div class="stat-label">Functional</div></div>
    <div class="stat-box"><div class="stat-value">${nonFunctional}</div><div class="stat-label">Non-Functional</div></div>
  `;
  document.getElementById("detailDateLabel").textContent = sessionMeta
    ? `Started ${new Date(sessionMeta.started_at).toLocaleString()} · ${translated}/${total} translated`
    : "";
  renderInteractiveAnalysis(data);

  requirementCount = total;
  reqCounterLabel.textContent = `Requirements added: ${total}`;
  finishBtn.disabled = total === 0;

  showCard(sessionDetailCard);
}

function renderInteractiveAnalysis(data, filter = { type: "all", value: "" }) {
  const requirements = data.requirements || [];
  const ambiguities = requirements.flatMap((requirement) => requirement.ambiguities || []);
  const answeredCount = ambiguities.filter((ambiguity) => ambiguity.answer).length;
  const confidenceScores = requirements
    .map((requirement) => requirement.confidence_score)
    .filter((score) => typeof score === "number" && Number.isFinite(score));
  const averageConfidence = confidenceScores.length
    ? `${Math.round(confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length * 100)}%`
    : "—";
  const resolutionRate = ambiguities.length
    ? `${Math.round(answeredCount / ambiguities.length * 100)}%`
    : "—";

  document.getElementById("analysisMetrics").innerHTML = `
    <div class="stat-box"><div class="stat-value">${ambiguities.length}</div><div class="stat-label">Ambiguities detected</div></div>
    <div class="stat-box"><div class="stat-value">${resolutionRate}</div><div class="stat-label">Ambiguities resolved</div></div>
    <div class="stat-box"><div class="stat-value">${averageConfidence}</div><div class="stat-label">Average translation confidence</div></div>
  `;

  const statusCounts = new Map();
  const categoryCounts = new Map();
  requirements.forEach((requirement) => {
    const status = requirement.status || "unknown";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    (requirement.ambiguities || []).forEach((ambiguity) => {
      const category = ambiguity.category || "uncategorized";
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
  });

  function renderBarChart(containerId, counts, filterType) {
    const container = document.getElementById(containerId);
    const entries = [...counts.entries()].sort((left, right) => right[1] - left[1]);
    if (!entries.length) {
      container.innerHTML = "<p class='analysis-muted'>No data available yet.</p>";
      return;
    }
    const maxCount = Math.max(...entries.map(([, count]) => count));
    container.innerHTML = entries.map(([label, count]) => {
      const selected = filter.type === filterType && filter.value === label;
      const width = Math.round(count / maxCount * 100);
      return `
        <button class="analysis-chart-row ${selected ? "selected" : ""}" data-analysis-filter="${filterType}" data-filter-value="${escapeHtml(label)}" aria-pressed="${selected}">
          <span class="analysis-chart-label">${escapeHtml(label)}</span>
          <span class="analysis-chart-track"><span class="analysis-chart-bar" style="width:${width}%"></span></span>
          <span class="analysis-chart-count">${count}</span>
        </button>
      `;
    }).join("");
  }

  renderBarChart("statusChart", statusCounts, "status");
  renderBarChart("ambiguityChart", categoryCounts, "category");

  document.getElementById("confidenceChart").innerHTML = requirements.length
    ? requirements.map((requirement, index) => {
        const confidence = requirement.confidence_score;
        const available = typeof confidence === "number" && Number.isFinite(confidence);
        const score = available ? Math.round(Math.max(0, Math.min(1, confidence)) * 100) : null;
        return `
          <button class="confidence-chart-row" data-open-requirement="${index}" ${available ? `aria-label="Open requirement ${index + 1}, confidence ${score} percent"` : `aria-label="Open requirement ${index + 1}, confidence unavailable"`}>
            <span class="analysis-chart-label">Req. ${index + 1}</span>
            <span class="analysis-chart-track"><span class="analysis-chart-bar confidence-bar" style="width:${score ?? 0}%"></span></span>
            <span class="analysis-chart-count">${score === null ? "—" : `${score}%`}</span>
          </button>
        `;
      }).join("")
    : "<p class='analysis-muted'>Add requirements to see confidence scores.</p>";

  const filteredRequirements = requirements
    .map((requirement, index) => ({ requirement, index }))
    .filter(({ requirement }) => {
      if (filter.type === "status") return (requirement.status || "unknown") === filter.value;
      if (filter.type === "category") return (requirement.ambiguities || []).some((ambiguity) => (ambiguity.category || "uncategorized") === filter.value);
      return true;
    });
  const filterLabel = document.getElementById("analysisFilterLabel");
  const clearFilterBtn = document.getElementById("clearAnalysisFilterBtn");
  const isFiltered = filter.type !== "all";
  filterLabel.textContent = isFiltered
    ? `${filteredRequirements.length} requirement${filteredRequirements.length === 1 ? "" : "s"} matching ${filter.type}: ${filter.value}`
    : `Showing all ${requirements.length} requirements`;
  clearFilterBtn.classList.toggle("hidden", !isFiltered);
  clearFilterBtn.onclick = () => renderInteractiveAnalysis(data);

  document.querySelectorAll("#statusChart [data-analysis-filter], #ambiguityChart [data-analysis-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextFilter = filter.type === button.dataset.analysisFilter && filter.value === button.dataset.filterValue
        ? { type: "all", value: "" }
        : { type: button.dataset.analysisFilter, value: button.dataset.filterValue };
      renderInteractiveAnalysis(data, nextFilter);
    });
  });

  document.querySelectorAll("#confidenceChart [data-open-requirement]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.openRequirement);
      const details = document.querySelector(`#analysisBreakdown details[data-requirement-index="${index}"]`);
      if (!details) return;
      details.open = true;
      details.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  document.getElementById("analysisBreakdown").innerHTML = filteredRequirements.map(({ requirement, index }) => {
    const requirementAmbiguities = requirement.ambiguities || [];
    const confidence = typeof requirement.confidence_score === "number"
      ? `${Math.round(requirement.confidence_score * 100)}%`
      : "Not available";
    const ambiguityDetails = requirementAmbiguities.length
      ? `<ul class="analysis-ambiguities">${requirementAmbiguities.map((ambiguity) => `
          <li>
            <div class="analysis-ambiguity-heading">
              <strong>${escapeHtml(ambiguity.term)}</strong>
              <span>${escapeHtml(ambiguity.category || "Uncategorized")} · ${escapeHtml(ambiguity.detector || "unknown detector")}</span>
            </div>
            <p><strong>Detection confidence:</strong> ${typeof ambiguity.confidence === "number" ? `${Math.round(ambiguity.confidence * 100)}%` : "Not available"}</p>
            <p><strong>Clarification:</strong> ${escapeHtml(ambiguity.question || "No clarification question recorded.")}</p>
            <p><strong>Answer:</strong> ${escapeHtml(ambiguity.answer || "Unanswered")}</p>
          </li>
        `).join("")}</ul>`
      : "<p class='analysis-muted'>No ambiguities were detected.</p>";

    return `
      <details class="analysis-item" data-requirement-index="${index}">
        <summary>
          <span class="analysis-item-title">Requirement ${index + 1}</span>
          <span class="status-badge status-${escapeHtml(requirement.status)}">${escapeHtml(requirement.status)}</span>
          <span class="analysis-preview">${escapeHtml(requirement.original_text)}</span>
        </summary>
        <div class="analysis-item-body">
          <div class="analysis-result-grid">
            <div><span class="analysis-field-label">Type</span><span>${escapeHtml(requirement.req_type || "Unclassified")}</span></div>
            <div><span class="analysis-field-label">Category</span><span>${escapeHtml(requirement.category || "General")}</span></div>
            <div><span class="analysis-field-label">Translation confidence</span><span>${confidence}</span></div>
            <div><span class="analysis-field-label">Approved by</span><span>${escapeHtml(requirement.approved_by || "Not approved")}</span></div>
          </div>
          <h3>Past requirement</h3>
          <p class="analysis-text">${escapeHtml(requirement.original_text)}</p>
          <h3>Structured result</h3>
          <p class="analysis-text">${escapeHtml(requirement.translated_text || "No translated requirement is available yet.")}</p>
          <h3>Detected ambiguities (${requirementAmbiguities.length})</h3>
          ${ambiguityDetails}
        </div>
      </details>
    `;
  }).join("") || "<p class='report-empty'>No requirements have been added to this session yet.</p>";

}

async function continueExistingSession(sessionId) {
  await openSession(sessionId);
  if (currentSessionId !== sessionId || !lastReportData) return;
  continueSession(sessionId, lastReportData);
}

function continueSession(sessionId = currentSessionId, data = lastReportData) {
  if (!sessionId) return;
  const projectName = data?.project_name || sessions.find((s) => s.session_id === sessionId)?.project_name || "";
  resetWizardOnly();
  currentSessionId = sessionId;
  projectLabel.textContent = projectName;
  reqCounterLabel.textContent = `Requirements added: ${requirementCount}`;
  finishBtn.disabled = requirementCount === 0;
  showCard(mainCard);
  requirementInput.focus();
}

document.getElementById("detailAddMoreBtn").addEventListener("click", () => continueSession());
document.getElementById("detailReportBtn").addEventListener("click", async () => {
  try {
    let data = lastReportData;
    if (!data) data = await api(`/sessions/${currentSessionId}/report`);
    renderReportDoc(data);
    showCard(reportCard);
  } catch (err) {
    alert(err.message);
  }
});
document.getElementById("detailRenameBtn").addEventListener("click", () => renameBtn.click());

renameBtn.addEventListener("click", async () => {
  if (!currentSessionId) return;
  const name = await promptModal("Rename project", { inputValue: projectLabel.textContent });
  if (!name) return;
  try {
    const data = await api(`/sessions/${currentSessionId}`, { method: "PATCH", body: JSON.stringify({ project_name: name.trim() }) });
    projectLabel.textContent = data.project_name;
    await loadSidebar();
  } catch (err) {
    alert(err.message);
  }
});

function showCard(card) {
  [startCard, discoveryCard, sessionDetailCard, mainCard, reviewCard, reportCard].forEach((c) => c.classList.add("hidden"));
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
  const notes = await promptModal("Approve requirement", { inputPlaceholder: "Optional note (leave blank to skip)" });
  try {
    await api(`/requirements/${id}/approve`, { method: "POST", body: JSON.stringify({ notes }) });
    lastReportData = null;
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
      lastReportData = null;
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
    const session = await getCurrentSession();
    if (!session?.access_token) throw new Error("Please sign in again to export this report.");
    const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report/docx`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.status === 401) {
      await logout();
      throw new Error("Session expired — please sign in again.");
    }
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

backToSidebarBtn.addEventListener("click", async () => {
  if (currentSessionId) {
    await loadSidebar();
    await openSession(currentSessionId);
  } else {
    showStartScreen();
    loadSidebar();
  }
});
