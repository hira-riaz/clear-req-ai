// Backend base URL — change if you deploy the backend elsewhere.
const API_BASE = "http://127.0.0.1:8000";

// For the MVP we hardcode a session id. Replace with real session creation
// once the "Start session" screen from the workflow diagram is built.
const SESSION_ID = 1;

let currentRequirementId = null;
let currentAmbiguities = [];

const analyzeBtn = document.getElementById("analyzeBtn");
const translateBtn = document.getElementById("translateBtn");
const requirementInput = document.getElementById("requirementInput");
const ambiguitiesSection = document.getElementById("ambiguitiesSection");
const ambiguitiesList = document.getElementById("ambiguitiesList");
const resultSection = document.getElementById("resultSection");
const translatedText = document.getElementById("translatedText");
const confidenceBadge = document.getElementById("confidenceBadge");

analyzeBtn.addEventListener("click", async () => {
  const text = requirementInput.value.trim();
  if (!text) return;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    const res = await fetch(`${API_BASE}/requirements/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID, text }),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();

    currentRequirementId = data.requirement_id;
    currentAmbiguities = data.ambiguities;
    renderAmbiguities(data.ambiguities);
    resultSection.classList.add("hidden");
    ambiguitiesSection.classList.remove("hidden");
  } catch (err) {
    alert(`Could not reach the backend. Is it running at ${API_BASE}?\n\n${err}`);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
  }
});

function renderAmbiguities(ambiguities) {
  ambiguitiesList.innerHTML = "";
  if (ambiguities.length === 0) {
    ambiguitiesList.innerHTML = "<p style='font-size:13px;color:#7a776c;'>No ambiguities detected.</p>";
    return;
  }
  ambiguities.forEach((a) => {
    const div = document.createElement("div");
    div.className = "ambiguity-card";
    div.innerHTML = `
      <div class="ambiguity-top">
        <span class="term">"${a.term}"</span>
        <span class="category">${a.category} · ${a.detector}</span>
      </div>
      <p class="question">${a.question}</p>
      <input class="answer-input" data-ambiguity-id="${a.ambiguity_id}" placeholder="Your answer..." />
    `;
    ambiguitiesList.appendChild(div);
  });
}

translateBtn.addEventListener("click", async () => {
  const inputs = ambiguitiesList.querySelectorAll(".answer-input");
  const answers = Array.from(inputs)
    .map((el) => ({
      ambiguity_id: parseInt(el.dataset.ambiguityId, 10),
      answer: el.value.trim(),
    }))
    .filter((a) => a.answer.length > 0);

  if (answers.length === 0) {
    alert("Answer at least one clarification before translating.");
    return;
  }

  translateBtn.disabled = true;
  translateBtn.textContent = "Translating...";

  try {
    const res = await fetch(`${API_BASE}/requirements/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement_id: currentRequirementId, answers }),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const data = await res.json();

    translatedText.textContent = data.translated_text;
    confidenceBadge.textContent = `${Math.round(data.confidence_score * 100)}% confidence`;
    resultSection.classList.remove("hidden");
  } catch (err) {
    alert(`Translation failed.\n\n${err}`);
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = "Translate";
  }
});
