const API_BASE = "http://127.0.0.1:8000";

let currentSessionId = null;
let currentRequirementId = null;
let requirementCount = 0;

// Preserve original Card references
const startCard = document.getElementById("startCard");
const mainCard = document.getElementById("mainCard");
const reviewCard = document.getElementById("reviewCard");
const reportCard = document.getElementById("reportCard");

// Preservation of all key IDs from original file
const projectNameInput = document.getElementById("projectNameInput");
const startSessionBtn = document.getElementById("startSessionBtn");
const projectLabel = document.getElementById("projectLabel");
const reqCounterLabel = document.getElementById("reqCounterLabel");

const analyzeBtn = document.getElementById("analyzeBtn");
const requirementInput = document.getElementById("requirementInput");
const ambiguitiesSection = document.getElementById("ambiguitiesSection");
const ambiguitiesLabel = document.getElementById("ambiguitiesLabel");
const ambiguitiesList = document.getElementById("ambiguitiesList");
const nextReqBtn = document.getElementById("nextReqBtn");
const finishBtn = document.getElementById("finishBtn");
const exportDocBtn = document.getElementById("exportDocBtn");

const reviewList = document.getElementById("reviewList");
// IMPORTANT: Re-link reviewProjectLabel as it's used differently in new HTML
const reviewProjectLabel = document.getElementById("reviewProjectLabel"); 
const generateReportBtn = document.getElementById("generateReportBtn");

const reportDoc = document.getElementById("reportDoc");
const newSessionBtn = document.getElementById("newSessionBtn");

// Helper function to update main header title (Image 0 layout needs this)
const updateHeaderTitle = (title) => {
    document.getElementById("globalHeaderTitle").textContent = title;
};

// =========================================
// Start Session Event
// =========================================
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
        
        // Update Labels (Top Header + Counter)
        projectLabel.textContent = data.project_name;
        reqCounterLabel.textContent = `Requirements added: 0`;

        // Switch Views
        startCard.classList.add("hidden");
        mainCard.classList.remove("hidden");
        
        // Dynamic visual update for new layout
        updateHeaderTitle("Requirement Analysis");
        requirementInput.focus();

    } catch (err) {
        alert(`Could not start a session. Is the backend running at ${API_BASE}?\n\n${err}`);
    } finally {
        startSessionBtn.disabled = false;
        startSessionBtn.textContent = "Start session";
    }
});

// =========================================
// Analyze Requirement Event
// =========================================
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
        renderAmbiguities(data.ambiguities);
        ambiguitiesSection.classList.remove("hidden");
    } catch (err) {
        alert(`Could not reach the backend.\n\n${err}`);
        analyzeBtn.disabled = false;
    } finally {
        analyzeBtn.textContent = "Analyze";
    }
});

function renderAmbiguities(ambiguities) {
    ambiguitiesList.innerHTML = "";
    if (ambiguities.length === 0) {
        ambiguitiesLabel.textContent = "No ambiguities or conflicts detected";
        ambiguitiesLabel.classList.remove('heading'); // Styling tweak
        return;
    }
    ambiguitiesLabel.textContent = "Potential Ambiguities Detected";
    ambiguitiesLabel.classList.add('heading'); // Styling tweak

    ambiguities.forEach((a) => {
        const isConflict = a.category === "conflict";
        const div = document.createElement("div");
        // Maintain original dynamic classes for CSS integration
        div.className = isConflict ? "ambiguity-card conflict-card" : "ambiguity-card";
        div.innerHTML = `
      <div class="ambiguity-top">
        <span class="term">${isConflict ? "⚠ Conflict detected" : `"${a.term}"`}</span>
        <span class="category ${isConflict ? "conflict" : ""}">${a.category}</span>
      </div>
      <p class="question">${a.question}</p>
      ${a.suggested_answer ? '<p class="reused-note">Suggested from previous answers — edit if needed.</p>' : ""}
      <input class="answer-input" data-ambiguity-id="${a.ambiguity_id}" placeholder="Your clarification..." value="${a.suggested_answer ? a.suggested_answer.replace(/"/g, '&quot;') : ""}" />
    `;
        ambiguitiesList.appendChild(div);
    });
}

// =========================================
// Next Requirement (Save & Reset) Event
// =========================================
nextReqBtn.addEventListener("click", async () => {
    const inputs = ambiguitiesList.querySelectorAll(".answer-input");
    const answers = Array.from(inputs)
        .map((el) => ({ ambiguity_id: parseInt(el.dataset.ambiguityId, 10), answer: el.value.trim() }))
        .filter((a) => a.answer.length > 0);

    nextReqBtn.disabled = true;
    nextReqBtn.textContent = "Saving...";
    try {
        const res = await fetch(`${API_BASE}/requirements/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requirement_id: currentRequirementId, answers }),
        });
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        await res.json();

        requirementCount += 1;
        reqCounterLabel.textContent = `Requirements added: ${requirementCount}`;
        finishBtn.disabled = false;

        // Reset for next
        requirementInput.value = "";
        ambiguitiesSection.classList.add("hidden");
        ambiguitiesList.innerHTML = "";
        currentRequirementId = null;
        analyzeBtn.disabled = false;
        requirementInput.focus();
    } catch (err) {
        alert(`Could not save this requirement.\n\n${err}`);
    } finally {
        nextReqBtn.disabled = false;
        nextReqBtn.textContent = "Next requirement";
    }
});

// =========================================
// Finish & Review Event
// =========================================
finishBtn.addEventListener("click", async () => {
    await loadReview();
    mainCard.classList.add("hidden");
    reviewCard.classList.remove("hidden");
    // New layout dynamic header
    updateHeaderTitle("Review Requirements");
});

async function loadReview() {
    try {
        const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        const data = await res.json();
        
        // This project label was missing its hook in main layout
        if(reviewProjectLabel) reviewProjectLabel.textContent = data.project_name;
        
        reviewList.innerHTML = "";

        data.requirements.forEach((r) => {
            const div = document.createElement("div");
            div.className = "review-item";
            div.dataset.requirementId = r.requirement_id;
            
            // Preservation of original innerHTML structure
            div.innerHTML = `
        <p class="translated">${r.translated_text || "(no translation generated)"}</p>
        <p class="original-ref">Original: "${r.original_text}"</p>
        <div class="row-actions">
          <button class="secondary-btn small-btn history-btn">History</button>
          <button class="small-btn edit-btn primary-btn">Edit</button>
        </div>
        <div class="version-history hidden"></div>
      `;
            reviewList.appendChild(div);
        });

        // Relink events (Preserved original flow)
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

        // Preserved history render loop
        panel.innerHTML = data.versions.map((v) => {
            const date = new Date(v.created_at).toLocaleString();
            const pct = v.confidence_score != null ? `${Math.round(v.confidence_score * 100)}%` : "—";
            return `
        <div class="version-entry">
          <p class="version-meta">v${v.version_number} · ${pct} confidence · ${date}</p>
          <p class="version-text">${v.translated_text}</p>
        </div>
      `;
        }).join("") || "<p class='version-meta'>No version history yet.</p>";

        panel.classList.remove("hidden");
    } catch (err) {
        alert(`Could not load version history.\n\n${err}`);
    }
}

// Function startEdit rewritten to work dynamic-DOM nodes for new layout compatibility
function startEdit(itemDiv) {
    const currentText = itemDiv.querySelector(".translated").textContent;
    const requirementId = itemDiv.dataset.requirementId;
    
    // Clear the standard view
    itemDiv.innerHTML = "";

    // Dynamically create Edit nodes
    const editArea = document.createElement('textarea');
    editArea.className = "edit-textarea";
    editArea.value = currentText;

    const rowActions = document.createElement('div');
    rowActions.className = "row-actions";

    const cancelBtn = document.createElement('button');
    cancelBtn.className = "secondary-btn small-btn cancel-edit-btn";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement('button');
    saveBtn.className = "small-btn save-edit-btn primary-btn";
    saveBtn.textContent = "Save Changes";

    rowActions.appendChild(cancelBtn);
    rowActions.appendChild(saveBtn);

    itemDiv.appendChild(editArea);
    itemDiv.appendChild(rowActions);
    editArea.focus();

    // Preserve original button logic
    cancelBtn.addEventListener("click", loadReview);
    saveBtn.addEventListener("click", async () => {
        const newText = editArea.value.trim();
        if (!newText) return;
        try {
            const res = await fetch(`${API_BASE}/requirements/${requirementId}/edit`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ translated_text: newText }),
            });
            if (!res.ok) throw new Error(`Backend returned ${res.status}`);
            await loadReview(); // Re-render review item
        } catch (err) {
            alert(`Could not save the edit.\n\n${err}`);
        }
    });
}

// =========================================
// Generate Report Event
// =========================================
generateReportBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(`${API_BASE}/sessions/${currentSessionId}/report`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        const data = await res.json();
        renderReportDoc(data);
        reviewCard.classList.add("hidden");
        reportCard.classList.remove("hidden");
        // New dynamic header
        updateHeaderTitle("Final Report");
    } catch (err) {
        alert(`Could not generate the report.\n\n${err}`);
    }
});

function renderReportDoc(data) {
    // Preserved report logic
    const translatedItems = data.requirements.map((r) => `<li>${r.translated_text || "(no translation Generated)"}</li>`).join("");
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

// =========================================
// New Session Event
// =========================================
newSessionBtn.addEventListener("click", () => {
    currentSessionId = null;
    currentRequirementId = null;
    requirementCount = 0;
    projectNameInput.value = "";
    requirementInput.value = "";
    reqCounterLabel.textContent = "Requirements added: 0";
    projectLabel.textContent = "No Active Session";
    ambiguitiesSection.classList.add("hidden");
    ambiguitiesList.innerHTML = "";
    finishBtn.disabled = true;
    analyzeBtn.disabled = false;
    
    // Switch views
    reportCard.classList.add("hidden");
    reviewCard.classList.add("hidden"); // Ensure review is closed
    mainCard.classList.add("hidden");   // Ensure main is closed
    startCard.classList.remove("hidden");
    
    // New Dynamic visual update
    updateHeaderTitle("Start Session");
    projectNameInput.focus();
});

// Preserve original Export Event
exportDocBtn.addEventListener("click", () => {
    if (!currentSessionId) return;
    window.open(`${API_BASE}/sessions/${currentSessionId}/report/docx`, "_blank");
});

// Set initial state
updateHeaderTitle("ClearReq Dashboard");
projectNameInput.focus();