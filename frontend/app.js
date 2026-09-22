const API_BASE = "http://127.0.0.1:8000";

let currentSessionId = null;
let currentRequirementId = null;
let requirementCount = 0;

let currentAmbiguities = [];
let currentAmbiguityIndex = 0;
let currentAnswers = [];

let discoveryIndex = 0;
let discoveryAnswers = [];

let lastReportData = null; // caches the last /report fetch so "Generate report" doesn't re-fetch and re-trigger AI calls unnecessarily

const DISCOVERY_QUESTIONS = [
  { question: "What platform(s) should this system run on?", options: ["Web", "Mobile app", "Desktop", "Multiple platforms"] },
  { question: "Who are the primary users of this system?", options: ["General public", "Internal staff/employees", "Business customers", "Mixed / multiple user types"] },
  { question: "Is this replacing an existing system?", options: ["Yes, replacing an existing system", "No, built from scratch", "Not sure yet"] },
  { question: "Will the system handle sensitive data?", options: ["Yes, payment data", "Yes, personal/health data", "No sensitive data expected", "Not sure yet"] },
  { question: "What scale of usage is expected?", options: ["Small (under 100 users)", "Medium (100–10,000 users)", "Large (10,000+ users)", "Not sure yet"] },
  { question: "Are there fixed constraints on this project?", options: ["Fixed deadline", "Fixed budget", "Both", "No fixed constraints"] },
];

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
const reviewProjectLabel = document.getElementById("reviewProjectLabel");
const generateReportBtn = document.getElementById("generateReportBtn");

const reportDoc = document.getElementById("reportDoc");
const newSessionBtn = document.getElementById("newSessionBtn");
const exportDocBtn = document.getElementById("exportDocBtn");

// Security: escape all dynamic/user-supplied text before inserting into
// innerHTML, to prevent stored XSS via requirement text, translated text,
// or AI-generated terms/options.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Step 1: Start session ----
startSessionBtn.addEventListener("click", async () => {
  const name = projectNameInput.value.trim();
  if (!name) return;
  startSessionBtn.disabled = true;
  startSessionBtn.textContent = "Starting...";
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_name: name }),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();
    currentSessionId = data.session_id;
    projectLabel.textContent = data.project_name;

    startCard.classList.add("hidden");
    discoveryCard.classList.remove("hidden");
    showDiscoveryQuestion();
  } catch (err) {
    alert(`Could not start a session. Is the backend running at ${API_BASE}?\n\n${err}`);
  } finally {
    startSessionBtn.disabled = false;
    startSessionBtn.textContent = "Start session";
  }
});

// ---- Step 2: Project discovery ----
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
      ${q.options.map((opt) => `<button class="option-btn" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join("")}
    </div>
    <button class="secondary-btn small-btn skip-btn">Skip</button>
  `;
  discoveryStepper.innerHTML = "";
  discoveryStepper.appendChild(div);

  div.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => recordDiscoveryAnswer(q.question, btn.dataset.answer));
  });
  div.querySelector(".skip-btn").addEventListener("click", () => recordDiscoveryAnswer(q.question, null));
}

function recordDiscoveryAnswer(question, answer) {
  discoveryAnswers.push({ question, answer });
  discoveryIndex += 1;
  showDiscoveryQuestion();
}

async function submitDiscovery() {
  try {
    await fetch(`${API_BASE}/sessions/${currentSessionId}/discovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: discoveryAnswers }),
    });
  } catch (err) {
    console.error("Could not save discovery answers", err);
  }
  discoveryCard.classList.add("hidden");
  mainCard.classList.remove("hidden");
}

// ---- Step 3: Analyze a requirement ----
analyzeBtn.addEventListener("click", async () => {
  const text = requirementInput.value.trim();
  if (!text || !currentSessionId) return;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  try {
    const res = await fetch(`${API_BASE}/requirements/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, text }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const detail = errBody?.detail?.[0]?.msg || errBody?.detail || `Backend returned ${res.status}`;
      throw new Error(detail);
    }
    const data = await res.json();

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
    alert(`Could not reach the backend.\n\n${err}`);
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
  const options = a.options || [];
  if (a.suggested_answer) {
    optionsHtml += `<button class="option-btn suggested-btn" data-answer="${escapeHtml(a.suggested_answer)}">${escapeHtml(a.suggested_answer)} <span class="reused-tag">(used earlier)</span></button>`;
  }
  options.forEach((opt) => {
    optionsHtml += `<button class="option-btn" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`;
  });
  optionsHtml += `<button class="option-btn other-btn" id="otherOptionBtn">Other...</button>`;

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

  div.querySelectorAll(".option-btn:not(.other-btn)").forEach((btn) => {
    btn.addEventListener("click", () => recordAnswer(a.ambiguity_id, btn.dataset.answer));
  });

  div.querySelector("#otherOptionBtn").addEventListener("click", () => {
    div.querySelector(".other-input-row").classList.remove("hidden");
    div.querySelector(".other-input").focus();
  });

  div.querySelector(".confirm-other-btn").addEventListener("click", () => {
    const val = div.querySelector(".other-input").value.trim();
    if (!val) return;
    recordAnswer(a.ambiguity_id, val);
  });
}

function recordAnswer(ambiguityId, answer) {
  currentAnswers.push({ ambiguity_id: ambiguityId, answer });
  currentAmbiguityIndex += 1;
  showCurrentAmbiguity();
}

async function finalizeRequirement() {
  try {
    const res = await fetch(`${API_BASE}/requirements/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement_id: currentRequirementId, answers: currentAnswers }),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    await res.json();

    requirementCount += 1;
    reqCounterLabel.textContent = `Requirements added: ${requirementCount}`;
    finishBtn.disabled = false;

    requirementInput.value = "";
    ambiguitiesSection.classList.add("hidden");
    ambiguityStepper.innerHTML = "";
    currentRequirementId = null;
    currentAmbiguities = [];
    currentAmbiguityIndex = 0;
    currentAnswers = [];
    lastReportData = null; // requirements changed, force a fresh report fetch next time
    requirementInput.focus();
  } catch (err) {
    alert(`Could not save this requirement.\n\n${err}`);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
  }
}

// ---- Step 4: Finish and review ----
finishBtn.addEventListener("click", async () => {
  if (!ambiguitiesSection.classList.contains("hidden") && currentRequirementId) {
    alert("You have an unfinished requirement — resolve the current question before finishing.");
    return;
  }
  await loadReview();
  mainCard.classList.add("hidden");
  reviewCard.classList.remove("hidden");
});

async function loadReview() {
  try {
    const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();
    lastReportData = data; // cache so "Generate report" can reuse this instead of re-fetching
    reviewProjectLabel.textContent = data.project_name;
    reviewList.innerHTML = "";

    data.requirements.forEach((r) => {
      const div = document.createElement("div");
      div.className = "review-item";
      div.dataset.requirementId = r.requirement_id;
      div.innerHTML = `
        <p class="translated">${escapeHtml(r.translated_text) || "(no translation)"}</p>
        <p class="original-ref">Original: "${escapeHtml(r.original_text)}"</p>
        <div class="row-actions">
          <button class="secondary-btn small-btn history-btn">History</button>
          <button class="secondary-btn small-btn edit-btn">Edit</button>
        </div>
        <div class="version-history hidden"></div>
      `;
      reviewList.appendChild(div);
    });

    reviewList.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => startEdit(e.target.closest(".review-item")));
    });
    reviewList.querySelectorAll(".history-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => toggleHistory(e.target.closest(".review-item")));
    });
  } catch (err) {
    alert(`Could not load requirements for review.\n\n${err}`);
  }
}

async function toggleHistory(itemDiv) {
  const panel = itemDiv.querySelector(".version-history");
  const requirementId = itemDiv.dataset.requirementId;

  if (!panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/requirements/${requirementId}`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();

    panel.innerHTML = data.versions.map((v) => {
      const date = new Date(v.created_at).toLocaleString();
      const pct = v.confidence_score != null ? `${Math.round(v.confidence_score * 100)}%` : "—";
      return `
        <div class="version-entry">
          <p class="version-meta">v${v.version_number} · ${pct} confidence · ${escapeHtml(date)}</p>
          <p class="version-text">${escapeHtml(v.translated_text)}</p>
        </div>
      `;
    }).join("") || "<p class='version-meta'>No versions yet.</p>";

    panel.classList.remove("hidden");
  } catch (err) {
    alert(`Could not load version history.\n\n${err}`);
  }
}

function startEdit(itemDiv) {
  const currentText = itemDiv.querySelector(".translated").textContent;
  const requirementId = itemDiv.dataset.requirementId;
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
      const res = await fetch(`${API_BASE}/requirements/${requirementId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translated_text: newText }),
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      lastReportData = null; // translation changed, force a fresh report fetch next time
      await loadReview();
    } catch (err) {
      alert(`Could not save the edit.\n\n${err}`);
    }
  });
}

// ---- Step 5: Generate report ----
generateReportBtn.addEventListener("click", async () => {
  try {
    let data = lastReportData;
    if (!data) {
      const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report`);
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      data = await res.json();
      lastReportData = data;
    }
    renderReportDoc(data);
    reviewCard.classList.add("hidden");
    reportCard.classList.remove("hidden");
  } catch (err) {
    alert(`Could not generate the report.\n\n${err}`);
  }
});

function renderReportDoc(data) {
  const functional = data.requirements.filter((r) => r.req_type === "Functional");
  const nonFunctional = data.requirements.filter((r) => r.req_type === "Non-Functional");

  const functionalHtml = functional.length
    ? `<ol>${functional.map((r) => `<li>${escapeHtml(r.translated_text) || "(no translation)"}</li>`).join("")}</ol>`
    : "<p class='report-empty'>(none)</p>";

  const nfrGroups = {};
  nonFunctional.forEach((r) => {
    if (!nfrGroups[r.category]) nfrGroups[r.category] = [];
    nfrGroups[r.category].push(r);
  });
  const nonFunctionalHtml = nonFunctional.length
    ? Object.entries(nfrGroups).map(([cat, items]) => `
        <h4>${escapeHtml(cat.charAt(0).toUpperCase() + cat.slice(1))}</h4>
        <ol>${items.map((r) => `<li>${escapeHtml(r.translated_text) || "(no translation)"}</li>`).join("")}</ol>
      `).join("")
    : "<p class='report-empty'>(none)</p>";

  let redundancyHtml = "";
  if (data.redundancy_flags && data.redundancy_flags.length > 0) {
    const flagItems = data.redundancy_flags.map((g) => {
      const ids = (g.requirement_ids || []).map((i) => `#${i}`).join(", ");
      return `<li>${escapeHtml(ids)}: ${escapeHtml(g.reason || "")}</li>`;
    }).join("");
    redundancyHtml = `
      <div class="redundancy-notice">
        <p class="redundancy-title">⚠ Possible redundant requirements</p>
        <ul>${flagItems}</ul>
      </div>
    `;
  }

  const traceRows = data.requirements.map((r) => `
    <tr>
      <td>${r.requirement_id}</td>
      <td>${escapeHtml(r.req_type)}</td>
      <td>${escapeHtml(r.translated_text) || "(no translation)"}</td>
      <td>${escapeHtml(r.original_text)}</td>
    </tr>
  `).join("");

  reportDoc.innerHTML = `
    <h3>${escapeHtml(data.project_name)} — Software Requirements Specification</h3>

    <h4>System Overview</h4>
    <p>${escapeHtml(data.system_overview) || "(no requirements finalized yet)"}</p>

    <h4>Functional Requirements</h4>
    ${functionalHtml}

    <h4>Non-Functional Requirements</h4>
    ${nonFunctionalHtml}

    ${redundancyHtml}

    <div class="appendix">
      <h3>Requirements Traceability Matrix</h3>
      <table class="trace-table">
        <thead><tr><th>ID</th><th>Type</th><th>Final Requirement</th><th>Original Statement</th></tr></thead>
        <tbody>${traceRows}</tbody>
      </table>
    </div>
  `;
}

exportDocBtn.addEventListener("click", () => {
  if (!currentSessionId) return;
  window.open(`${API_BASE}/sessions/${currentSessionId}/report/docx`, "_blank");
});

// ---- Start new session ----
newSessionBtn.addEventListener("click", () => {
  currentSessionId = null;
  currentRequirementId = null;
  requirementCount = 0;
  currentAmbiguities = [];
  currentAmbiguityIndex = 0;
  currentAnswers = [];
  discoveryIndex = 0;
  discoveryAnswers = [];
  lastReportData = null;

  projectNameInput.value = "";
  requirementInput.value = "";
  reqCounterLabel.textContent = "Requirements added: 0";
  ambiguitiesSection.classList.add("hidden");
  ambiguityStepper.innerHTML = "";
  finishBtn.disabled = true;
  analyzeBtn.disabled = false;

  discoveryCard.classList.add("hidden");
  reportCard.classList.add("hidden");
  startCard.classList.remove("hidden");
});