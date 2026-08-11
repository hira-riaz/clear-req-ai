const API_BASE = "http://127.0.0.1:8000";

let currentSessionId = null;
let currentRequirementId = null;
let requirementCount = 0;

let currentAmbiguities = [];
let currentAmbiguityIndex = 0;
let currentAnswers = [];

const startCard = document.getElementById("startCard");
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
    mainCard.classList.remove("hidden");
  } catch (err) {
    alert(`Could not start a session. Is the backend running at ${API_BASE}?\n\n${err}`);
  } finally {
    startSessionBtn.disabled = false;
    startSessionBtn.textContent = "Start session";
  }
});

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
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();

    currentRequirementId = data.requirement_id;
    currentAmbiguities = data.ambiguities;
    currentAmbiguityIndex = 0;
    currentAnswers = [];

    if (currentAmbiguities.length === 0) {
      // Nothing to clarify — translate immediately with no answers
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
    optionsHtml += `<button class="option-btn suggested-btn" data-answer="${escapeAttr(a.suggested_answer)}">${a.suggested_answer} <span class="reused-tag">(used earlier)</span></button>`;
  }
  options.forEach((opt) => {
    optionsHtml += `<button class="option-btn" data-answer="${escapeAttr(opt)}">${opt}</button>`;
  });
  optionsHtml += `<button class="option-btn other-btn" id="otherOptionBtn">Other...</button>`;

  const div = document.createElement("div");
  div.className = isConflict ? "ambiguity-card conflict-card" : "ambiguity-card";
  div.innerHTML = `
    <div class="ambiguity-top">
      <span class="term">${isConflict ? "⚠ Conflict detected" : `"${a.term}"`}</span>
      <span class="category ${isConflict ? "conflict" : ""}">${a.category}</span>
    </div>
    <p class="question">${a.question}</p>
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

function escapeAttr(str) {
  return str.replace(/"/g, "&quot;");
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
    requirementInput.focus();
  } catch (err) {
    alert(`Could not save this requirement.\n\n${err}`);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
  }
}

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
    reviewProjectLabel.textContent = data.project_name;
    reviewList.innerHTML = "";

    data.requirements.forEach((r) => {
      const div = document.createElement("div");
      div.className = "review-item";
      div.dataset.requirementId = r.requirement_id;
      div.innerHTML = `
        <p class="translated">${r.translated_text || "(no translation)"}</p>
        <p class="original-ref">Original: "${r.original_text}"</p>
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
          <p class="version-meta">v${v.version_number} · ${pct} confidence · ${date}</p>
          <p class="version-text">${v.translated_text}</p>
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
    <textarea class="edit-textarea">${currentText}</textarea>
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
      await loadReview();
    } catch (err) {
      alert(`Could not save the edit.\n\n${err}`);
    }
  });
}

generateReportBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();
    renderReportDoc(data);
    reviewCard.classList.add("hidden");
    reportCard.classList.remove("hidden");
  } catch (err) {
    alert(`Could not generate the report.\n\n${err}`);
  }
});

function renderReportDoc(data) {
  const translatedItems = data.requirements.map((r) => `<li>${r.translated_text || "(no translation)"}</li>`).join("");
  const originalItems = data.requirements.map((r) => `<li>${r.original_text}</li>`).join("");
  reportDoc.innerHTML = `
    <h3>${data.project_name} — System Requirements Specification</h3>
    <ol>${translatedItems}</ol>
    <div class="appendix">
      <h3>Appendix: Original Client Requirements</h3>
      <ol>${originalItems}</ol>
    </div>
  `;
}

exportDocBtn.addEventListener("click", () => {
  if (!currentSessionId) return;
  window.open(`${API_BASE}/sessions/${currentSessionId}/report/docx`, "_blank");
});

newSessionBtn.addEventListener("click", () => {
  currentSessionId = null;
  currentRequirementId = null;
  requirementCount = 0;
  currentAmbiguities = [];
  currentAmbiguityIndex = 0;
  currentAnswers = [];
  projectNameInput.value = "";
  requirementInput.value = "";
  reqCounterLabel.textContent = "Requirements added: 0";
  ambiguitiesSection.classList.add("hidden");
  ambiguityStepper.innerHTML = "";
  finishBtn.disabled = true;
  analyzeBtn.disabled = false;
  reportCard.classList.add("hidden");
  startCard.classList.remove("hidden");
});