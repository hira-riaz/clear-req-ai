# Context & Requirements For System User Flow

This flow handles sequential requirement inputs, dynamic clarification loops, and automated loading transitions before generating the final report.

---

## 🚀 The Core User Flow Sequence

### Step 1: Post-Authentication Workplace Landing
* After a user completes the login process via Supabase, redirect them to the **Workplace View Canvas**.
* Display the workspace of that user, user will starta new session and entering the very first system requirement.

### Step 2: First Requirement Entry & Submission
* The user types out their initial requirement text string into the primary text area.
* The user clicks the main action **"Analyze Requirement"** button.
* Disable the button and show a brief interactive processing state while the backend executes the `rule_detector` and `ai_provider` analysis scripts.

### Step 3: Sequential Clarification Loop (MCQ-Style Interface)
* Display the detected ambiguities to the user one by one in an interactive loop. 
* Do not dump all questions on a single page. Isolate **one clarification question at a time**.
* **UI Component Structure per Question:**
  * **Question Text:** Clear title summarizing what information is missing or ambiguous.
  * **Options List:** Interactive multiple-choice options (MCQ-style) representing the potential fixes or details the system can choose from.
  * **Skip Action:** Include a clearly visible **"Skip Question"** button next to or below the options.
* Selecting an option or clicking "Skip" triggers a state update, clearing the current card and dynamically sliding or transitioning into the next clarification question in the queue.

### Step 4: Intermittent Loading & Next Requirement Transition
* Once **all** clarification questions for the first requirement are completely answered or skipped, trigger a visual **Loading Transition state**.
* Display a clean animation or loading spinner stating that the first requirement is processed and saved.
* Automatically clear the workspace input view and display the **Second Requirement Input Screen**.
* The user repeats this input, analysis, and clarification loop sequentially for all additional requirements they wish to process in the active session.

### Step 5: Final Comprehensive Report Generation
* Provide a distinct option or button on the workspace canvas to indicate the user has finished adding requirements for this session (e.g., "Finish & Generate Report").
* Once selected, stop the inputs, aggregate all analyzed requirements alongside their clarified options, and forward the user to the completed **Session Analysis Report View**.

---

## 🛠️ Implementation Directives

1. **Frontend State Management (React):** Create an explicit numerical state pointer (e.g., `currentQuestionIndex`) to handle moving step-by-step through the clarification loop cleanly. Ensure the view resets smoothly when shifting from the end of a loop back to a fresh input screen.
2. **Backend API Contracts (FastAPI):** Ensure your API route handles the payload, tracks the requirement ID, and passes back an ordered list or array of ambiguity objects containing the question strings and choices arrays for the frontend client to map through.
