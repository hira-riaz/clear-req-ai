/*
 * ClearReq AI frontend - plain JavaScript, no build step.
 *
 * How it works:
 *   - `state` holds everything the screen needs.
 *   - Functions ending in Html() turn state into HTML strings.
 *   - render() puts that HTML into #app.
 *   - Buttons carry data-action="name"; clicks are routed to `actions[name]`.
 *   - Inputs carry data-model="name"; typing is routed to `models[name]`.
 *   - Forms carry data-form="name"; submits are routed to `forms[name]`.
 * Change something in state, then call render().
 */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const Preview = window.ClearReqPreview || { enabled: false };
  const PREVIEW = Boolean(Preview.enabled);

  /* ---------- content ---------- */

  const landingDemoExamples = [
    {
      requirement: "The web app should allow users to capture the current scene quickly and securely.",
      highlights: ["quickly", "securely"],
      status: "2 ambiguities detected",
      kind: "ambiguity",
      findings: [
        { label: "quickly", question: "What does 'quickly' mean?", detail: "Expected response time?" },
        { label: "securely", question: "What security requirements are expected?" },
      ],
    },
    {
      requirement: "The web app should allow to capture the current scene.",
      highlights: ["capture the current scene"],
      status: "Ambiguity detected",
      kind: "ambiguity",
      findings: [
        { label: "capture the current scene", question: "Capture from the web camera?", detail: "Why should the system capture the scene?" },
      ],
    },
    {
      requirement: "The web app should allow users to capture the current scene.",
      highlights: [],
      status: "Conflict detected",
      kind: "conflict",
      findings: [
        { label: "Project context conflicts with this requirement", discovery: "Mobile Application", requirement: "Web Application" },
      ],
    },
  ];

  const discoveryQuestions = [
    { question: "What platform(s) should this system run on?", options: ["Web", "Mobile app", "Desktop", "Multiple platforms"] },
    { question: "Who are the primary users of this system?", options: ["General public", "Internal staff/employees", "Business customers", "Mixed / multiple user types"] },
    { question: "Is this replacing an existing system?", options: ["Yes, replacing an existing system", "No, built from scratch", "Not sure yet"] },
    { question: "Will the system handle sensitive data?", options: ["Yes, payment data", "Yes, personal/health data", "No sensitive data expected", "Not sure yet"] },
    { question: "What scale of usage is expected?", options: ["Small (under 100 users)", "Medium (100\u201310,000 users)", "Large (10,000+ users)", "Not sure yet"] },
    { question: "Are there fixed constraints on this project?", options: ["Fixed deadline", "Fixed budget", "Both", "No fixed constraints"] },
  ];

  const starters = [
    { icon: "folder", title: "Hospital management system", description: "Patients, appointments and billing for a mid-size clinic." },
    { icon: "list", title: "Online store", description: "Catalogue, cart, checkout and order tracking." },
    { icon: "question", title: "Appointment booking app", description: "Let customers find and reserve open time slots." },
    { icon: "file", title: "Internal HR portal", description: "Leave requests, approvals and staff records." },
  ];

  const steps = [
    { key: "discovery", label: "Discovery" },
    { key: "input", label: "Analyze" },
    { key: "clarify", label: "Clarify" },
    { key: "review", label: "Review" },
    { key: "report", label: "Report" },
  ];

  const pageTitles = {
    discovery: "Project discovery",
    input: "Add requirements",
    analyzing: "Analyzing requirement",
    clarify: "Clarify your requirement",
    processing: "Processing requirement",
    review: "Review requirements",
    report: "Requirements report",
    reports: "Reports",
  };

  /* ---------- state ---------- */

  function freshWorkspace() {
    return {
      workspaceReady: false,
      sessions: [],
      selectedId: null,
      search: "",
      loadingSessions: true,
      workflow: "dashboard",
      projectName: "",
      clientName: "",
      creating: false,
      busy: false,
      error: "",
      notice: "",
      helpOpen: false,
      completeConfirmOpen: false,
      sidebarOpen: true,
      discoveryIndex: 0,
      discoveryAnswers: [],
      requirementText: "",
      requirementId: null,
      ambiguities: [],
      qIndex: 0,
      answers: {},
      report: null,
      editingId: null,
      editText: "",
      focusId: null,
    };
  }

  const state = Object.assign(
    {
      view: "landing", // landing | auth | workspace
      supabase: null,
      session: null,
      user: null,
      configError: "",
      authMode: "signup",
      authName: "",
      authEmail: "",
      authPassword: "",
      authNotice: null,
      submitting: false,
    },
    freshWorkspace(),
  );

  /* ---------- small helpers ---------- */

  function $(selector) {
    return document.querySelector(selector);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function reportSessionDateTime(startedAt) {
    if (!startedAt) return "";
    const isoTimestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(startedAt)
      ? startedAt
      : startedAt + "Z";
    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) return "";
    const options = { timeZone: "UTC" };
    return (
      '<div class="report-session-meta">' +
      '<p><span>Date</span>' + esc(new Intl.DateTimeFormat("en-GB", Object.assign({ day: "numeric", month: "long", year: "numeric" }, options)).format(date)) + "</p>" +
      '<p><span>Day</span>' + esc(new Intl.DateTimeFormat("en-US", Object.assign({ weekday: "long" }, options)).format(date)) + "</p>" +
      '<p><span>Time</span>' + esc(new Intl.DateTimeFormat("en-US", Object.assign({ hour: "2-digit", minute: "2-digit", hour12: true }, options)).format(date)) + "</p>" +
      "</div>"
    );
  }

  const iconPaths = {
    plus: "M12 5v14M5 12h14",
    search: "M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
    home: "M3 11l9-8 9 8M5 10v10h14V10",
    folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    arrowUp: "M12 19V5M5 12l7-7 7 7",
    check: "M5 12l5 5L20 7",
    file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
    question: "M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  };

  function icon(name) {
    return (
      '<svg class="icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="' +
      iconPaths[name] +
      '"/>' +
      (name === "question" ? '<circle cx="12" cy="12" r="9"/>' : "") +
      "</svg>"
    );
  }

  function tile(name) {
    return '<span class="tile">' + icon(name) + "</span>";
  }

  function highlightAmbiguousTerms(text, ambiguities) {
    const terms = (ambiguities || [])
      .map(function (ambiguity) {
        return ambiguity.term;
      })
      .filter(function (term) {
        return typeof term === "string" && term.trim();
      })
      .sort(function (a, b) {
        return b.length - a.length;
      });

    if (!terms.length) return esc(text);

    const pattern = new RegExp(
      "(^|[^a-z0-9_])(" +
        terms
          .map(function (term) {
            return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          })
          .join("|") +
        ")(?=$|[^a-z0-9_])",
      "gi"
    );
    const original = String(text == null ? "" : text);
    let output = "";
    let cursor = 0;
    let match;

    while ((match = pattern.exec(original)) !== null) {
      const termStart = match.index + match[1].length;
      output +=
        esc(original.slice(cursor, termStart)) +
        '<mark class="ambiguity-highlight">' +
        esc(match[2]) +
        "</mark>";
      cursor = termStart + match[2].length;
    }

    return output + esc(original.slice(cursor));
  }

  function brand(link) {
    const inner = '<span class="brand-mark">CR</span>ClearReq AI';
    return link
      ? '<a class="brand" href="#home">' + inner + "</a>"
      : '<span class="brand">' + inner + "</span>";
  }

  function displayName() {
    return (state.user && ((state.user.user_metadata && state.user.user_metadata.name) || state.user.email)) || "there";
  }

  function firstName() {
    const name = displayName();
    return (name.indexOf("@") >= 0 ? name.split("@")[0] : name).split(" ")[0];
  }

  function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }

  function selectedSession() {
    return state.sessions.find(function (s) {
      return s.session_id === state.selectedId;
    });
  }

  function isCompleted(session) {
    return Boolean(session && (session.status === "completed" || session.ended_at));
  }

  function clearMessages() {
    state.error = "";
    state.notice = "";
  }

  /* ---------- talking to the backend ---------- */

  async function getSupabase() {
    if (!window.supabase) {
      throw new Error("Could not load the sign-in library. Check your internet connection and refresh.");
    }
    const response = await fetch("/public-config");
    if (!response.ok) {
      throw new Error("Authentication is not configured. Please try again later.");
    }
    const config = await response.json();
    return window.supabase.createClient(config.supabase_url, config.supabase_anon_key);
  }

  async function api(path, options) {
    options = options || {};
    if (PREVIEW) return Preview.request(path, options);
    const token = state.session && state.session.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers, {
      Authorization: "Bearer " + token,
    });
    const response = await fetch(path, Object.assign({}, options, { headers: headers }));
    if (!response.ok) {
      const body = await response.json().catch(function () {
        return null;
      });
      const detail = Array.isArray(body && body.detail)
        ? body.detail.map(function (item) { return item.msg; }).join("; ")
        : body && body.detail;
      throw new Error(detail || "Request failed (" + response.status + ")");
    }
    return response.json();
  }

  async function apiBlob(path) {
    if (PREVIEW) return Preview.blob();
    const token = state.session && state.session.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(path, { headers: { Authorization: "Bearer " + token } });
    if (!response.ok) {
      const body = await response.json().catch(function () {
        return null;
      });
      throw new Error((body && body.detail) || "Request failed (" + response.status + ")");
    }
    return response.blob();
  }

  /* ---------- HTML: landing ---------- */

  function landingHtml() {
    return (
      '<div class="app-bg landing-page" style="min-height:100vh">' +
      '<header class="container site-header">' +
      brand(true) +
      '<div class="actions"><a class="btn btn-ghost" href="#login">Log in</a><a class="btn btn-primary" href="#signup">Get started</a></div>' +
      "</header>" +
      "<main>" +
      '<section class="hero landing-hero">' +
      '<div class="landing-intro"><p class="landing-kicker">CLEARER THINKING. BETTER REQUIREMENTS.</p>' +
      '<h1 class="display">Turn vague ideas into clear requirements</h1>' +
      '<p class="lead">ClearReq examines requirements in context, surfaces unclear or conflicting details, and guides your team toward clear, reviewable requirements.</p>' +
      '<div class="cta"><a class="btn btn-primary btn-lg" href="#signup">Get started</a></div></div>' +
      '<section class="product-demo glass" data-animated-demo aria-label="Illustrative ClearReq requirement analysis">' +
      '<div class="demo-header"><div><p class="demo-kicker">CLEARREQ AI</p><p class="demo-editor-title">Requirement intelligence</p></div>' +
      '<span class="demo-status" data-demo-status aria-live="polite"><span class="demo-status-dot"></span><span data-demo-status-text>Ready</span></span></div>' +
      '<div class="demo-editor"><div class="demo-editor-bar"><span></span><span></span><span></span><p>Requirement editor</p></div>' +
      '<div class="demo-editor-body"><p class="demo-label">USER REQUIREMENT</p><p class="demo-requirement"><span data-demo-requirement></span><span class="demo-cursor" aria-hidden="true"></span></p>' +
      '<span class="demo-scan-line" aria-hidden="true"></span></div></div>' +
      '<section class="demo-results" data-demo-results aria-label="Analysis results" aria-live="polite"></section>' +
      '<p class="demo-footnote">Illustrative product demo · no live analysis is running</p>' +
      '</section></section>' +
      '<section class="landing-value"><p class="landing-kicker">WHY CLEARREQ</p>' +
      '<h2 class="display">Catch the unanswered questions before they become rework.</h2>' +
      '<p>Vague wording and mismatched project details can lead to different assumptions. ClearReq brings them into view so your team can resolve them, refine the requirement, and approve what is ready to build.</p></section>' +
      "</main>" +
      '<footer class="container site-footer">' + brand(true) + "<span>Make the important details clear.</span></footer>" +
      "</div>"
    );
  }

  /* ---------- HTML: sign in / sign up ---------- */

  function authHtml() {
    const signup = state.authMode === "signup";
    const message = state.configError
      ? { type: "error", message: state.configError }
      : state.authNotice;
    return (
      '<main class="app-bg auth"><div class="auth-box">' +
      '<div class="brand-row">' + brand(true) + "</div>" +
      '<section class="glass auth-card">' +
      '<h1 class="display">' + (signup ? "Create your account" : "Welcome back") + "</h1>" +
      '<p class="sub">' +
      (signup ? "Start turning ideas into clear requirements." : "Sign in to continue to ClearReq AI.") +
      "</p>" +
      '<div class="segmented">' +
      ["login", "signup"]
        .map(function (tab) {
          return (
            '<button type="button" data-action="authMode" data-mode="' + tab + '" aria-pressed="' +
            (state.authMode === tab) + '">' + (tab === "login" ? "Log in" : "Sign up") + "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<form data-form="auth">' +
      (signup
        ? '<label class="label">Your name<input class="field" data-model="authName" autocomplete="name" placeholder="Jane Smith" required value="' + esc(state.authName) + '"></label>'
        : "") +
      '<label class="label">Email<input class="field" data-model="authEmail" type="email" autocomplete="email" placeholder="you@example.com" required value="' + esc(state.authEmail) + '"></label>' +
      '<label class="label">Password<input class="field" data-model="authPassword" type="password" minlength="8" autocomplete="' + (signup ? "new-password" : "current-password") + '" placeholder="At least 8 characters" required value="' + esc(state.authPassword) + '"></label>' +
      (message
        ? '<p class="banner ' + (message.type === "error" ? "banner-error" : "banner-ok") + '" style="margin-bottom:0" aria-live="polite" role="' + (message.type === "error" ? "alert" : "status") + '">' + esc(message.message) + "</p>"
        : "") +
      '<button class="btn btn-primary btn-block" type="submit" ' +
      (state.configError || state.submitting || !state.supabase ? "disabled" : "") + ">" +
      (state.submitting ? "Please wait..." : signup ? "Create account" : "Log in") +
      "</button></form>" +
      '<p class="fine">By continuing, you agree to use ClearReq AI responsibly for your projects.</p>' +
      "</section>" +
      '<button class="back-link" type="button" data-action="backHome">Back to home</button>' +
      "</div></main>"
    );
  }

  /* ---------- HTML: workspace ---------- */

  function sessionListHtml() {
    const query = state.search.trim().toLowerCase();
  
    const list = state.sessions.filter(function (s) {
      return s.project_name.toLowerCase().indexOf(query) >= 0;
    });
  
    if (state.loadingSessions) {
      return '<p class="session-note">Loading sessions...</p>';
    }
  
    if (!list.length) {
      return '<p class="session-note">' +
        (state.search
          ? "No sessions match your search."
          : "Your new projects will show up here.") +
        "</p>";
    }
  
    return list
      .map(function (s) {
        const selected = s.session_id === state.selectedId;
  
        return (
          '<div class="session-row">' +
  
          '<button type="button" class="session-item' +
          (selected ? " selected" : "") + '"' +
          (selected ? ' aria-current="true"' : "") +
          ' data-action="openSession" data-id="' +
          s.session_id +
          '">' +
  
          '<span class="name">' + esc(s.project_name) + "</span>" +
  
          '<span class="meta">' +
          plural(s.requirement_count, "requirement") +
          (s.translated_count
            ? ", " + s.translated_count + " translated"
            : "") +
          (isCompleted(s) ? " · Completed" : "") +
          "</span>" +
  
          "</button>" +
  
          (isCompleted(s) ? "" : '<button class="session-delete" type="button" ' +
          'data-action="deleteSession" ' +
          'data-id="' + s.session_id + '" ' +
          'data-name="' + esc(s.project_name) + '" ' +
          'title="Delete session" aria-label="Delete ' +
          esc(s.project_name) + '">' +
          "×" +
          "</button>") +
  
          "</div>"
        );
      })
      .join("");
  }

  function sidebarHtml() {
    const onHome = state.workflow === "dashboard";
    const onReport = state.workflow === "report" || state.workflow === "reports";
    return (
      '<aside class="sidebar">' + brand(false) +
      '<nav class="nav" aria-label="Workspace">' +
      '<button class="nav-item" type="button" data-action="newSession">' + icon("plus") + "New session</button>" +
      '<div class="nav-item nav-search">' + icon("search") +
      '<label class="sr-only" for="session-search">Search sessions</label>' +
      '<input id="session-search" data-model="search" placeholder="Search" autocomplete="off" value="' + esc(state.search) + '"></div>' +
      "</nav><hr>" +
      '<nav class="nav" aria-label="Pages">' +
      '<button class="nav-item' + (onHome ? " active" : "") + '" type="button" data-action="home"' + (onHome ? ' aria-current="page"' : "") + ">" + icon("home") + "Home</button>" +
      '<button class="nav-item' + (onReport ? " active" : "") + '" type="button" data-action="reports"' + (state.busy ? " disabled" : "") + (onReport ? ' aria-current="page"' : "") + ">" + icon("file") + "Reports</button>" +
      "</nav><hr>" +
      '<p class="side-label">Recent projects</p>' +
      '<div class="session-list" id="session-list">' + sessionListHtml() + "</div>" +
      '<div class="profile"><span class="avatar">' + esc(firstName().charAt(0).toUpperCase()) + "</span>" +
      '<div class="who"><p class="name">' + esc(displayName()) + '</p><p class="email">' + esc(state.user.email) + "</p></div>" +
      '<button class="icon-btn" type="button" data-action="logout" aria-label="Log out" title="Log out">' + icon("logout") + "</button>" +
      "</div></aside>"
    );
  }

  function messagesHtml() {
    return (
      (state.error ? '<p class="banner banner-error" role="alert">' + esc(state.error) + "</p>" : "") +
      (state.notice ? '<div class="banner banner-ok"><p style="font-weight:500">Saved successfully</p><p style="margin-top:4px">' + esc(state.notice) + "</p></div>" : "")
    );
  }

  function stepsHtml() {
    return (
      '<div class="steps-wrap"><ol class="glass steps" aria-label="Progress">' +
      steps
        .map(function (step) {
          const active =
            state.workflow === step.key ||
            (state.workflow === "analyzing" && step.key === "input") ||
            (state.workflow === "processing" && step.key === "clarify");
          return '<li class="' + (active ? "active" : "") + '"' + (active ? ' aria-current="step"' : "") + ">" + step.label + "</li>";
        })
        .join("") +
      "</ol></div>"
    );
  }

  function dashboardHtml() {
    const sel = selectedSession();
    const count = state.sessions.length;
    const requirementCount = sel ? sel.requirement_count : 0;
    const approvedCount = sel ? sel.approved_count : 0;
    const progress = requirementCount
      ? Math.round((approvedCount / requirementCount) * 100)
      : 0;
    const status = isCompleted(sel)
      ? "Completed"
      : !requirementCount
      ? "Not started"
      : approvedCount >= requirementCount
        ? "Complete"
        : "In progress";
    return (
      '<div class="dash">' +
      '<div class="status-pill"><p class="glass">' +
      (count ? plural(count, "project") : "No projects yet") +
      '<button type="button" data-action="newSession">Start new</button></p></div>' +
      '<h1 class="display greeting">' + greeting() + ", " + esc(firstName()) + "</h1>" +
      '<div class="gap">' + messagesHtml() + "</div>" +
      (sel
        ? '<section class="glass selected-project"><div class="top"><div><p class="small faint">Selected project</p><h2 class="display">' + esc(sel.project_name) + "</h2></div>" +
          '<div class="stats"><p><strong>' + requirementCount + '</strong><span class="small muted">Requirements</span></p>' +
          '<p><strong>' + approvedCount + '</strong><span class="small muted">Approved</span></p>' +
          '<p><strong>' + progress + '%</strong><span class="small muted">' + status + "</span></p></div></div>" +
          '<div class="buttons">' +
          (isCompleted(sel) ? "" : '<button class="btn btn-primary" type="button" data-action="continueSession">Continue session</button>') +
          '<button class="btn btn-ghost" type="button" data-action="showReport"' + (state.busy ? " disabled" : "") + ">View report</button></div></section>"
        : '<form class="glass prompt" data-form="createSession">' +
      '<label class="sr-only" for="project-name">Project name</label>' +
      '<input id="project-name" data-model="projectName" maxlength="120" required autocomplete="off" placeholder="Name a project to start gathering requirements" value="' + esc(state.projectName) + '">' +
        '<label class="sr-only" for="client-name">Client name (optional)</label>' +
        '<input id="client-name" class="client-name" data-model="clientName" autocomplete="organization" placeholder="Client name (optional)" value="' + esc(state.clientName) + '">' +
        '<div class="row"><p class="small faint">Starts a guided session: discovery, analysis, clarification, report.</p>' +
      '<button class="send" id="start-btn" type="submit" title="Start session" aria-label="Start session"' +
      (state.creating || !state.projectName.trim() ? " disabled" : "") + ">" + icon("arrowUp") + "</button></div></form>" +
      '<p class="quick-label">Quick start</p><div class="quick-grid">' +
      starters
        .map(function (s, i) {
          return (
            '<button class="glass quick" type="button" data-action="starter" data-index="' + i + '">' + tile(s.icon) +
            '<span><span class="title">' + esc(s.title) + '</span><span class="desc">' + esc(s.description) + "</span></span></button>"
          );
        })
        .join("") +
      "</div>") +
      "</div>"
    );
  }

  function discoveryHtml() {
    const q = discoveryQuestions[state.discoveryIndex];
    const pct = ((state.discoveryIndex + 1) / discoveryQuestions.length) * 100;
  
    return (
      '<section class="glass card"><div class="progress"><div style="width:' + pct + '%"></div></div>' +
      '<p class="muted" style="margin-top:16px">Question ' + (state.discoveryIndex + 1) + " of " + discoveryQuestions.length + "</p>" +
      '<h2 class="display q-title">' + esc(q.question) + "</h2>" +
  
      '<div class="option-grid">' +
      q.options
        .map(function (o, i) {
          return '<button class="option" type="button" data-action="discoveryAnswer" data-index="' + i + '"' +
            (state.busy ? " disabled" : "") + ">" + esc(o) + "</button>";
        })
        .join("") +
      "</div>" +
  
      '<div class="row-between" style="margin-top:24px">' +
  
      (state.discoveryIndex > 0
        ? '<button class="btn btn-ghost" type="button" data-action="discoveryPrevious"' +
          (state.busy ? " disabled" : "") +
          '>← Previous</button>'
        : '<span></span>') +
  
      '<button class="link-btn" type="button" data-action="discoverySkip"' +
      (state.busy ? " disabled" : "") +
      ">Skip this question</button>" +
  
      "</div></section>"
    );
  }

  function inputHtml() {
    if (isCompleted(selectedSession())) {
      return '<section class="glass card center-card"><span class="pill pill-green">Completed</span>' +
        '<h2 class="display">This session is read-only</h2>' +
        '<p>No more requirements can be added or changed. You can still view and export the report.</p>' +
        '<div class="buttons" style="justify-content:center;margin-top:20px"><button class="btn btn-primary" type="button" data-action="showReport">View report</button></div></section>';
    }
    return (
      '<form class="glass composer" data-form="analyze">' +
      '<label class="sr-only" for="requirement-text">Requirement</label>' +
      '<textarea id="requirement-text" data-model="requirementText" maxlength="2000" required placeholder="Describe a requirement, for example: The system should let customers quickly find available appointments.">' + esc(state.requirementText) + "</textarea>" +
      '<div class="row-between"><button class="btn btn-ghost" type="button" data-action="goReview"' + (state.busy ? " disabled" : "") + ">Review &amp; approve</button>" +
      '<div style="display:flex;align-items:center;gap:12px"><span class="small faint" id="req-count">' + state.requirementText.length + ' / 2000</span>' +
      '<button class="btn btn-primary" id="analyze-btn" type="submit"' + (state.busy || !state.requirementText.trim() ? " disabled" : "") + ">" + (state.busy ? "Analyzing..." : "Analyze requirement") + "</button></div></div></form>"
    );
  }

  function waitingHtml(title, text) {
    return (
      '<section class="glass card center-card" aria-live="polite" role="status"><span class="spinner"></span><h2 class="display">' +
      title + "</h2><p>" + text + "</p></section>"
    );
  }

  function clarifyHtml() {
    const item = state.ambiguities[state.qIndex];
    if (!item) return "";
    const last = state.qIndex === state.ambiguities.length - 1;
    const answer = state.answers[item.ambiguity_id] || "";
    return (
      '<section class="stack"><div class="glass orig"><p class="small faint">Original requirement</p><p>' + esc(state.requirementText) + "</p></div>" +
      '<article class="glass card" aria-live="polite"><div class="row-between"><p class="muted">Question ' + (state.qIndex + 1) + " of " + state.ambiguities.length +
      '</p><span class="pill pill-clay">' + esc(item.category) + "</span></div>" +
      '<h2 class="display term">' + esc(item.term) + '</h2><p class="question">' + esc(item.question) + "</p>" +
      (item.options && item.options.length
        ? '<div class="option-stack">' +
          item.options
            .map(function (o, i) {
              return '<button class="option" type="button" data-action="answerOption" data-index="' + i + '"' + (state.busy ? " disabled" : "") + ">" + esc(o) + "</button>";
            })
            .join("") + "</div>"
        : "") +
      '<label class="label" style="margin-top:20px">Or enter a different answer<input class="field" data-model="answer" placeholder="Type your clarification" value="' + esc(answer) + '"></label>' +
      '<div class="row-between top"><button class="btn btn-ghost" type="button" data-action="skipQuestion"' + (state.busy ? " disabled" : "") + ">Skip question</button>" +
      '<button class="btn btn-primary" id="use-answer" type="button" data-action="useAnswer"' + (state.busy || !answer.trim() ? " disabled" : "") + ">" +
      (last ? "Use answer &amp; translate" : "Use answer &amp; continue") + "</button></div></article></section>"
    );
  }

  function reviewHtml() {
    const items = (state.report && state.report.requirements) || [];
    const completed = isCompleted(state.report) || isCompleted(selectedSession());
    return (
      '<section class="stack">' +
      (completed ? '<p class="banner banner-ok" role="status">This session is completed and read-only.</p>' : "") +
      (!items.length
        ? '<div class="glass card muted">No requirements yet. Add and analyze a requirement before generating the report.</div>'
        : "") +
      items
        .map(function (item) {
          const editing = state.editingId === item.requirement_id;
          return (
            '<article class="glass review-card"><p class="small faint">Original</p><p class="orig-text">' + esc(item.original_text) + "</p>" +
            '<div class="tags"><span class="small faint">Translated</span><span class="pill pill-plain">' + esc(item.status) + '</span><span class="pill pill-clay">' + esc(item.category) + "</span>" +
            (typeof item.confidence_score === "number" ? '<span class="pill pill-green">' + Math.round(item.confidence_score * 100) + "% confidence</span>" : "") + "</div>" +
            (editing && !completed
              ? '<textarea class="field" data-model="editText">' + esc(state.editText) + '</textarea><div class="review-actions">' +
                '<button class="btn btn-ghost" type="button" data-action="editCancel">Cancel</button>' +
                '<button class="btn btn-primary" type="button" data-action="editSave" data-id="' + item.requirement_id + '">Save edit</button></div>'
              : '<p class="translated">' + esc(item.translated_text || "No translation available.") + "</p>") +
            '<div class="review-actions left">' +
            (!completed && item.translated_text && !editing ? '<button class="btn btn-ghost" type="button" data-action="editStart" data-id="' + item.requirement_id + '">Edit translation</button>' : "") +
            (!completed && item.translated_text && item.status !== "approved" ? '<button class="btn btn-approve" type="button" data-action="approve" data-id="' + item.requirement_id + '"' + (state.busy ? " disabled" : "") + ">Approve</button>" : "") +
            "</div></article>"
          );
        })
        .join("") +
      '<div class="row-between" style="padding-top:8px">' +
      (completed ? "" : '<button class="btn btn-ghost" type="button" data-action="addAnother">Add another requirement</button>') +
      '<button class="btn btn-primary" type="button" data-action="showReport"' + (state.busy || !items.length ? " disabled" : "") + ">" + (completed ? "View report" : "Generate report") + "</button></div></section>"
    );
  }

  function reportHtml() {
    const report = state.report;
    if (!report) return "";
    const completed = isCompleted(report) || isCompleted(selectedSession());
    return (
      '<section class="glass card report"><div class="report-head"><h2 class="display">' + esc(report.project_name) + " requirements</h2>" +
      (completed ? '<p class="pill pill-green" style="display:inline-flex;margin-top:10px">Completed · read-only</p>' : "") +
      '<p class="muted" style="margin-top:8px">' + plural(report.requirements.length, "requirement") + "</p>" +
      (report.client_name ? '<p class="report-client">Client: ' + esc(report.client_name) + "</p>" : "") +
      reportSessionDateTime(report.started_at) + "</div>" +
      "<section><h3>Project discovery</h3>" +
      (report.discovery && report.discovery.length
        ? "<dl>" +
          report.discovery
            .map(function (d) {
              return '<div class="discovery-item"><dt>' + esc(d.question) + "</dt><dd>" + esc(d.answer || "Skipped") + "</dd></div>";
            })
            .join("") + "</dl>"
        : '<p class="faint" style="margin-top:8px">None provided.</p>') +
      "</section>" +
      ["Functional", "Non-Functional"]
        .map(function (type) {
          const items = report.requirements.filter(function (r) {
            return r.req_type === type;
          });
          return (
            "<section><h3>" + type + " requirements</h3>" +
            (items.length
              ? '<ol class="req-list">' +
                items
                  .map(function (item) {
                    return (
                      "<li><p>" + esc(item.translated_text || "No translation available.") + "</p>" +
                      '<p class="req-meta">' + esc(item.status) + ", " + esc(item.category) +
                      (typeof item.confidence_score === "number" ? ", " + Math.round(item.confidence_score * 100) + "% confidence" : "") + "</p>" +
                      '<p class="req-orig">Original: ' + highlightAmbiguousTerms(item.original_text, item.ambiguities) + "</p>" +
                      (item.ambiguities && item.ambiguities.length
                        ? '<ul class="clarified">' +
                          item.ambiguities
                            .map(function (a) {
                              return "<li><b>" + esc(a.question || a.term) + "</b>" + (a.answer ? "Clarified: " + esc(a.answer) : "Skipped") + "</li>";
                            })
                            .join("") + "</ul>"
                        : "") + "</li>"
                    );
                  })
                  .join("") + "</ol>"
              : '<p class="faint" style="margin-top:8px">None.</p>') + "</section>"
          );
        })
        .join("") +
      '<div class="report-foot"><div class="report-action-row">' +
      '<button class="btn btn-ghost" type="button" data-action="goReview">Review &amp; approve</button>' +
      (completed ? "" : '<button class="btn btn-ghost" type="button" data-action="addAnother">Add another requirement</button>') +
      '</div><div class="report-action-row"><button class="btn btn-ghost" type="button" data-action="export"' + (state.busy ? " disabled" : "") + ">" + (state.busy ? "Preparing..." : "Export Word document") + "</button></div>" +
      (completed ? "" : '<div class="report-completion"><button class="btn btn-primary" type="button" data-action="openCompleteConfirm"' + (state.busy ? " disabled" : "") + ">Complete Session</button></div>") +
      "</div></section>"
    );
  }

  function reportsHtml() {
    const reports = state.sessions.filter(function (session) {
      return session.translated_count > 0 && session.approved_count > 0;
    });

    if (!reports.length) {
      return '<section class="glass card"><p class="muted">No reports are available yet. Reports appear here after a session has reviewed requirements and at least one approved requirement.</p></section>';
    }

    return (
      '<section class="glass card"><h2 class="display">Reviewed reports</h2>' +
      reports
        .map(function (session) {
          return (
            '<article class="glass selected-project"><div class="top"><div>' +
            '<h2 class="display">' + esc(session.project_name) + "</h2>" +
            '<p class="small muted">' + plural(session.translated_count, "reviewed requirement") +
            ", " + plural(session.approved_count, "approved requirement") + "</p></div>" +
            '<button class="btn btn-primary" type="button" data-action="openReport" data-id="' +
            session.session_id + '">View report</button></div></article>'
          );
        })
        .join("") +
      "</section>"
    );
  }

  function helpGuideHtml() {
    return (
      '<div class="help-overlay">' +
      '<section class="glass help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">' +
      '<div class="help-dialog-head"><div><p class="small faint">CLEARREQ AI GUIDE</p>' +
      '<h2 class="display" id="help-title">How to use ClearReq</h2></div>' +
      '<button class="icon-btn help-close" type="button" data-action="closeHelp" aria-label="Close guide">×</button></div>' +
      '<ol class="help-steps">' +
      '<li><span>1</span><div><h3>Create a session</h3><p>Start a new session and give your project a name.</p></div></li>' +
      '<li><span>2</span><div><h3>Complete discovery</h3><p>Answer the project questions to capture context. Use Previous if you want to change an earlier answer.</p></div></li>' +
      '<li><span>3</span><div><h3>Add requirements</h3><p>Write one requirement at a time and select Analyze requirement. Answer any clarification questions.</p></div></li>' +
      '<li><span>4</span><div><h3>Review and approve</h3><p>Open Review &amp; approve to check translations. Edit them if needed, then approve the requirements you accept.</p></div></li>' +
      '<li><span>5</span><div><h3>View reports</h3><p>Use Reports to find reviewed sessions that have at least one approved requirement, then open or export a report.</p></div></li>' +
      '</ol>' +
      '<div class="help-dialog-foot"><button class="btn btn-primary" type="button" data-action="closeHelp">Got it</button></div>' +
      '</section></div>'
    );
  }

  function completeConfirmHtml() {
    return (
      '<div class="help-overlay">' +
      '<section class="glass help-dialog completion-dialog" role="alertdialog" aria-modal="true" aria-labelledby="complete-title" aria-describedby="complete-warning">' +
      '<div class="help-dialog-head"><div><p class="small faint">SESSION COMPLETION</p>' +
      '<h2 class="display" id="complete-title">Complete Session?</h2></div></div>' +
      '<p id="complete-warning" class="completion-warning">Once you complete this session, you will not be able to add or modify requirements in this session again. Make sure you have finished all requirements and exported the final report.</p>' +
      '<div class="completion-actions"><button class="btn btn-ghost" type="button" data-action="cancelComplete" ' + (state.busy ? "disabled" : "") + ">Cancel</button>" +
      '<button class="btn btn-primary" type="button" data-action="confirmComplete" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Completing..." : "Complete Session") + "</button></div>" +
      "</section></div>"
    );
  }

  let landingDemoRoot = null;
  let landingDemoTimer = null;

  function scheduleLandingDemo(root, callback, delay) {
    landingDemoTimer = window.setTimeout(function () {
      landingDemoTimer = null;
      if (root === document.querySelector("[data-animated-demo]")) callback();
    }, delay);
  }

  function stopLandingDemo() {
    if (landingDemoTimer !== null) {
      window.clearTimeout(landingDemoTimer);
      landingDemoTimer = null;
    }
    landingDemoRoot = null;
  }

  function setLandingDemoStatus(root, text) {
    const status = root.querySelector("[data-demo-status-text]");
    if (status) status.textContent = text;
  }

  function highlightedRequirementHtml(requirement, phrases) {
    const matches = phrases
      .map(function (phrase) {
        return { phrase: phrase, start: requirement.indexOf(phrase) };
      })
      .filter(function (match) { return match.start >= 0; })
      .sort(function (a, b) { return a.start - b.start; });
    let html = "";
    let offset = 0;
    matches.forEach(function (match) {
      if (match.start < offset) return;
      html += esc(requirement.slice(offset, match.start)) +
        '<mark class="demo-highlight">' + esc(match.phrase) + "</mark>";
      offset = match.start + match.phrase.length;
    });
    return html + esc(requirement.slice(offset));
  }

  function landingFindingHtml(finding, kind, index) {
    if (kind === "conflict") {
      return (
        '<article class="demo-result-item demo-conflict-item" data-demo-item="' + index + '">' +
        '<p class="demo-result-type">CONFLICT DETECTED</p><p class="demo-result-question">' + esc(finding.label) + "</p>" +
        '<div class="demo-comparison"><span>Discovery</span><strong>' + esc(finding.discovery) + "</strong></div>" +
        '<div class="demo-comparison"><span>Requirement</span><strong>' + esc(finding.requirement) + "</strong></div></article>"
      );
    }
    return (
      '<article class="demo-result-item" data-demo-item="' + index + '">' +
      '<p class="demo-result-type">AMBIGUITY DETECTED</p><span class="demo-term">' + esc(finding.label) + "</span>" +
      '<p class="demo-result-question">' + esc(finding.question) + "</p>" +
      (finding.detail ? '<p class="demo-result-detail">' + esc(finding.detail) + "</p>" : "") +
      "</article>"
    );
  }

  function runLandingDemoExample(root, exampleIndex) {
    if (root !== document.querySelector("[data-animated-demo]")) return;
    const example = landingDemoExamples[exampleIndex];
    const requirement = root.querySelector("[data-demo-requirement]");
    const results = root.querySelector("[data-demo-results]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let characterIndex = 0;

    root.classList.remove("is-scanning", "is-highlighted", "is-resetting");
    requirement.textContent = "";
    results.innerHTML = "";
    setLandingDemoStatus(root, "Typing requirement");

    function finishTyping() {
      setLandingDemoStatus(root, "Analyzing requirement...");
      root.classList.add("is-scanning");
      scheduleLandingDemo(root, finishScan, reducedMotion ? 0 : 1350);
    }

    function finishScan() {
      root.classList.remove("is-scanning");
      requirement.innerHTML = highlightedRequirementHtml(example.requirement, example.highlights);
      root.classList.add("is-highlighted");
      setLandingDemoStatus(root, example.status);
      results.innerHTML =
        '<div class="demo-results-head"><span class="demo-results-mark"></span><h3>' + esc(example.status) + "</h3></div>" +
        '<div class="demo-results-list">' +
        example.findings.map(function (finding, index) {
          return landingFindingHtml(finding, example.kind, index);
        }).join("") +
        "</div>";

      const items = Array.from(results.querySelectorAll("[data-demo-item]"));
      results.classList.add("is-visible");
      let itemIndex = 0;

      function revealNext() {
        if (itemIndex < items.length) {
          items[itemIndex].classList.add("is-visible");
          itemIndex += 1;
          scheduleLandingDemo(root, revealNext, reducedMotion ? 0 : 650);
          return;
        }
        scheduleLandingDemo(root, nextExample, exampleIndex === 0 ? 6200 : 5000);
      }

      revealNext();
    }

    function nextExample() {
      root.classList.add("is-resetting");
      scheduleLandingDemo(root, function () {
        runLandingDemoExample(root, (exampleIndex + 1) % landingDemoExamples.length);
      }, reducedMotion ? 0 : 450);
    }

    function typeNextCharacter() {
      if (characterIndex >= example.requirement.length) {
        finishTyping();
        return;
      }
      characterIndex += 1;
      requirement.textContent = example.requirement.slice(0, characterIndex);
      scheduleLandingDemo(root, typeNextCharacter, reducedMotion ? 0 : 38);
    }

    typeNextCharacter();
  }

  function startLandingDemo() {
    const root = document.querySelector("[data-animated-demo]");
    if (!root || root === landingDemoRoot) return;
    stopLandingDemo();
    landingDemoRoot = root;
    runLandingDemoExample(root, 0);
  }

  function pageHtml() {
    const sel = selectedSession();
    let body = "";
    switch (state.workflow) {
      case "discovery": body = discoveryHtml(); break;
      case "input": body = inputHtml(); break;
      case "analyzing": body = waitingHtml("Analyzing your requirement", "Checking for ambiguity and preparing clarification questions..."); break;
      case "clarify": body = clarifyHtml(); break;
      case "processing": body = waitingHtml("Processing requirement", "Saving your clarifications and translating this requirement..."); break;
      case "review": body = reviewHtml(); break;
      case "report": body = reportHtml(); break;
      case "reports": body = reportsHtml(); break;
    }
    return (
      '<div class="page"><header class="page-head"><h1 class="display">' + pageTitles[state.workflow] + "</h1><p>" +
      esc(state.workflow === "reports" ? "Reviewed sessions with approved requirements" : sel ? sel.project_name : "Project workspace") + "</p></header>" +
      messagesHtml() + body + "</div>"
    );
  }

  function workspaceHtml() {
    const focused = state.workflow !== "dashboard" && state.workflow !== "reports";
    return (
      '<div class="app-bg shell' + (focused ? " session-focused" : "") + (focused && !state.sidebarOpen ? " sidebar-collapsed" : "") + '">' + sidebarHtml() +
      '<main class="main">' +
      (focused
        ? '<button class="sidebar-toggle" type="button" data-action="toggleSidebar" aria-expanded="' + state.sidebarOpen + '" aria-label="' + (state.sidebarOpen ? "Hide session sidebar" : "Show session sidebar") + '">' + (state.sidebarOpen ? "Hide sidebar" : "Show sidebar") + "</button>"
        : "") +
      '<button class="help-trigger" type="button" data-action="openHelp" aria-label="Open usage guide" aria-expanded="' + state.helpOpen + '" title="Usage guide">i</button>' +
      (state.workflow === "dashboard" ? dashboardHtml() : (state.workflow === "reports" ? pageHtml() : stepsHtml() + pageHtml())) +
      (state.helpOpen ? helpGuideHtml() : "") +
      (state.completeConfirmOpen ? completeConfirmHtml() : "") +
      "</main></div>"
    );
  }

  /* ---------- rendering ---------- */

  function render() {
    if (state.view === "landing") {
      app.innerHTML = landingHtml();
      startLandingDemo();
    } else {
      stopLandingDemo();
      if (state.view === "auth") app.innerHTML = authHtml();
      else app.innerHTML = workspaceHtml();
    }
    if (state.focusId) {
      const el = document.getElementById(state.focusId);
      if (el) el.focus();
      state.focusId = null;
    }
  }

  function go(workflow) {
    state.workflow = workflow;
    render();
    const main = $(".main");
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function computeView() {
    if (state.user && state.session) return "workspace";
    const hash = window.location.hash;
    if (hash === "#login" || hash === "#signup" || hash === "#auth" || hash === "#workspace") {
      state.authMode = hash === "#login" ? "login" : "signup";
      return "auth";
    }
    return "landing";
  }

  function route() {
    state.view = computeView();
    if (state.view === "workspace" && !state.workspaceReady) {
      state.workspaceReady = true;
      loadSessions();
    }
    render();
  }

  /* ---------- workflow logic (same API calls as before) ---------- */

  async function loadSessions() {
    try {
      const items = await api("/sessions");
      state.sessions = items;
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loadingSessions = false;
      render();
    }
  }

  async function createSession() {
    const name = state.projectName.trim();
    if (!name || state.creating) return;
    const clientName = state.clientName.trim();
    state.creating = true;
    clearMessages();
    render();
    try {
      const result = await api("/sessions", { method: "POST", body: JSON.stringify({ project_name: name, client_name: clientName || null }) });
      state.projectName = "";
      state.clientName = "";
      state.selectedId = result.session_id;
      state.sessions.unshift({ session_id: result.session_id, project_name: result.project_name, client_name: result.client_name, started_at: result.started_at, status: "active", requirement_count: 0, translated_count: 0, approved_count: 0 });
      state.discoveryAnswers = [];
      state.discoveryIndex = 0;
      state.sidebarOpen = false;
      state.workflow = "discovery";
    } catch (error) {
      state.error = error.message;
    } finally {
      state.creating = false;
      go(state.workflow);
    }
  }

  function startSession(sessionId, screen) {
    state.selectedId = sessionId;
    state.requirementText = "";
    state.requirementId = null;
    state.ambiguities = [];
    state.qIndex = 0;
    state.answers = {};
    state.report = null;
    clearMessages();
    state.sidebarOpen = screen === "dashboard";
    if (isCompleted(state.sessions.find(function (s) { return s.session_id === sessionId; })) && screen === "input") {
      showReport();
      return;
    }
    go(screen || "input");
  }

  async function saveDiscoveryAnswer(answer) {
    if (state.busy || !state.selectedId || isCompleted(selectedSession())) return;
    state.busy = true;
    clearMessages();
    render();
    const question = discoveryQuestions[state.discoveryIndex];
    const next = state.discoveryAnswers.concat([{ question: question.question, answer: answer }]);
    try {
      if (state.discoveryIndex === discoveryQuestions.length - 1) {
        await api("/sessions/" + state.selectedId + "/discovery", { method: "POST", body: JSON.stringify({ answers: next }) });
        state.discoveryAnswers = next;
        state.workflow = "input";
      } else {
        state.discoveryAnswers = next;
        state.discoveryIndex += 1;
      }
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }
async function deleteSession(id, name) {
  if (!id || state.busy) return;

  const confirmed = window.confirm(
    'Delete "' + name + '"?\n\nThis session will be permanently deleted.'
  );

  if (!confirmed) return;

  state.busy = true;
  clearMessages();

  try {
    await api("/sessions/" + id, {
      method: "DELETE"
    });

    state.sessions = state.sessions.filter(function (s) {
      return s.session_id !== id;
    });

    if (state.selectedId === id) {
      state.selectedId = state.sessions.length
        ? state.sessions[0].session_id
        : null;

      state.workflow = "dashboard";
      state.report = null;
      state.requirementText = "";
      state.requirementId = null;
      state.ambiguities = [];
      state.answers = {};
    }

    state.notice = "Session deleted successfully.";
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

  async function analyzeRequirement() {
    const text = state.requirementText.trim();
    if (!text || !state.selectedId || state.busy || isCompleted(selectedSession())) return;
    state.busy = true;
    clearMessages();
    go("analyzing");
    try {
      const result = await api("/requirements/analyze", {
        method: "POST",
        body: JSON.stringify({ session_id: state.selectedId, text: text }),
      });
      state.requirementId = result.requirement_id;
      state.ambiguities = result.ambiguities || [];
      state.qIndex = 0;
      state.answers = {};
      state.ambiguities.forEach(function (item) {
        state.answers[item.ambiguity_id] = item.suggested_answer || "";
      });
      if (state.ambiguities.length) {
        go("clarify");
      } else {
        go("processing");
        await translateRequirement(result.requirement_id, []);
      }
    } catch (error) {
      state.error = error.message;
      go("input");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function advanceClarification(answer) {
    if (isCompleted(selectedSession())) return;
    const current = state.ambiguities[state.qIndex];
    if (!current || state.busy) return;
    state.answers[current.ambiguity_id] = String(answer || "").trim();
    clearMessages();

    if (state.qIndex + 1 < state.ambiguities.length) {
      state.qIndex += 1;
      render();
      return;
    }

    const submitted = state.ambiguities
      .map(function (item) {
        return { ambiguity_id: item.ambiguity_id, answer: (state.answers[item.ambiguity_id] || "").trim() };
      })
      .filter(function (item) {
        return item.answer;
      });
    if (!state.requirementId) {
      state.error = "The analyzed requirement could not be identified. Please analyze it again.";
      go("input");
      return;
    }
    go("processing");
    await translateRequirement(state.requirementId, submitted);
  }

  async function translateRequirement(id, clarificationAnswers) {
    if (isCompleted(selectedSession())) return;
    if (!id) {
      state.error = "The analyzed requirement could not be identified. Please analyze it again.";
      go("input");
      return;
    }
    state.busy = true;
    clearMessages();
    try {
      const result = await api("/requirements/translate", {
        method: "POST",
        body: JSON.stringify({ requirement_id: id, answers: clarificationAnswers || [] }),
      });
      state.requirementText = "";
      state.requirementId = null;
      state.ambiguities = [];
      state.qIndex = 0;
      state.answers = {};
      state.notice = "Requirement translated successfully.";
      state.workflow = "input";
      await loadSessions();
    } catch (error) {
      state.error = error.message;
      state.workflow = state.ambiguities.length ? "clarify" : "input";
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }

  async function loadReport() {
    if (!state.selectedId) return null;
    state.report = await api("/sessions/" + state.selectedId + "/report");
    return state.report;
  }

  async function showReport() {
    state.busy = true;
    clearMessages();
    render();
    try {
      await loadReport();
      state.workflow = "report";
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }

  async function showReview() {
    if (!state.selectedId || state.busy) return;
    state.busy = true;
    clearMessages();
    render();
    try {
      await loadReport();
      state.workflow = "review";
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }

  async function approveRequirement(id) {
    if (isCompleted(state.report) || isCompleted(selectedSession())) return;
    state.busy = true;
    clearMessages();
    render();
    try {
      await api("/requirements/" + id + "/approve", { method: "POST", body: JSON.stringify({ notes: null }) });
      await loadReport();
      await loadSessions();
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function saveEdit(id) {
    if (!state.editText.trim() || isCompleted(state.report) || isCompleted(selectedSession())) return;
    state.busy = true;
    clearMessages();
    render();
    try {
      await api("/requirements/" + id + "/edit", { method: "PATCH", body: JSON.stringify({ translated_text: state.editText.trim() }) });
      state.editingId = null;
      await loadReport();
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function exportReport() {
    if (!state.selectedId) return;
    state.busy = true;
    clearMessages();
    render();
    try {
      const blob = await apiBlob("/sessions/" + state.selectedId + "/report/docx");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safe = ((state.report && state.report.project_name) || "requirements").replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
      link.download = (safe || "requirements") + "_requirements.docx";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  async function completeSelectedSession() {
    if (!state.selectedId || state.busy || isCompleted(state.report) || isCompleted(selectedSession())) return;
    state.busy = true;
    clearMessages();
    render();
    try {
      const result = await api("/sessions/" + state.selectedId + "/complete", { method: "POST" });
      state.sessions = state.sessions.map(function (session) {
        return session.session_id === state.selectedId
          ? Object.assign({}, session, { status: result.status, ended_at: result.ended_at })
          : session;
      });
      if (state.report) {
        state.report.status = result.status;
        state.report.ended_at = result.ended_at;
      }
      state.completeConfirmOpen = false;
      state.notice = "Session completed. It is now read-only.";
    } catch (error) {
      state.completeConfirmOpen = false;
      state.error = error.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  /* ---------- sign in / out ---------- */

  function enterWorkspace(session) {
    state.session = session;
    state.user = session.user;
    state.authPassword = "";
    if (window.location.hash !== "#workspace") window.location.hash = "workspace";
    route();
  }

  async function submitAuth() {
    if (!state.supabase || state.submitting) return;
    state.submitting = true;
    state.authNotice = null;
    render();
    try {
      if (state.authMode === "signup") {
        const result = await state.supabase.auth.signUp({
          email: state.authEmail.trim(),
          password: state.authPassword,
          options: { data: { name: state.authName.trim() } },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          enterWorkspace(result.data.session);
        } else {
          state.authNotice = { type: "success", message: "Account created. Check your email to confirm your account, then sign in." };
          state.authMode = "login";
        }
      } else {
        const result = await state.supabase.auth.signInWithPassword({
          email: state.authEmail.trim(),
          password: state.authPassword,
        });
        if (result.error) throw result.error;
        enterWorkspace(result.data.session);
      }
    } catch (error) {
      state.authNotice = { type: "error", message: error.message };
    } finally {
      state.submitting = false;
      render();
    }
  }

  function leaveWorkspace() {
    state.session = null;
    state.user = null;
    Object.assign(state, freshWorkspace());
  }

  async function signOut() {
    if (PREVIEW) {
      window.location.href = window.location.pathname;
      return;
    }
    try {
      const result = await state.supabase.auth.signOut();
      if (result.error) throw result.error;
    } catch (error) {
      state.error = error.message;
      render();
      return;
    }
    leaveWorkspace();
    window.location.hash = "home";
    route();
  }

  /* ---------- events ---------- */

  function updateStartButton() {
    const button = $("#start-btn");
    if (button) button.disabled = state.creating || !state.projectName.trim();
  }

  const actions = {
    backHome: function () { window.location.hash = "home"; },
    authMode: function (data) {
      state.authMode = data.mode;
      state.authNotice = null;
      render();
    },
    
    deleteSession: function (data) {
      deleteSession(Number(data.id), data.name);
    },

    newSession: function () {
      clearMessages();
      state.selectedId = null;
      state.sidebarOpen = true;
      state.focusId = "project-name";
      go("dashboard");
    },
    focusProject: function () {
      const input = document.getElementById("project-name");
      if (input) input.focus();
    },
    home: function () {
      clearMessages();
      state.sidebarOpen = true;
      go("dashboard");
    },
    report: function () { showReport(); },
    reports: function () {
      clearMessages();
      state.sidebarOpen = true;
      go("reports");
    },
    openReport: function (data) {
      state.selectedId = Number(data.id);
      state.sidebarOpen = false;
      showReport();
    },
    toggleSidebar: function () {
      state.sidebarOpen = !state.sidebarOpen;
      render();
    },
    openHelp: function () {
      state.helpOpen = true;
      render();
    },
    closeHelp: function () {
      state.helpOpen = false;
      render();
    },
    showReport: function () { showReport(); },
    openSession: function (data) { startSession(Number(data.id), "dashboard"); },
    continueSession: function () {
      if (isCompleted(selectedSession())) showReport();
      else startSession(state.selectedId, "input");
    },
    openCompleteConfirm: function () {
      if (isCompleted(state.report) || isCompleted(selectedSession())) return;
      state.completeConfirmOpen = true;
      render();
    },
    cancelComplete: function () {
      state.completeConfirmOpen = false;
      render();
    },
    confirmComplete: function () { completeSelectedSession(); },
    starter: function (data) {
      const input = document.getElementById("project-name");
      state.projectName = starters[Number(data.index)].title;
      if (input) {
        input.value = state.projectName;
        input.focus();
      }
      updateStartButton();
    },
    discoveryAnswer: function (data) {
      saveDiscoveryAnswer(discoveryQuestions[state.discoveryIndex].options[Number(data.index)]);
    },
    
    discoveryPrevious: function () {
      if (state.busy || state.discoveryIndex <= 0) return;
    
      state.discoveryIndex -= 1;
      state.discoveryAnswers = state.discoveryAnswers.slice(
        0,
        state.discoveryIndex
      );
    
      clearMessages();
      render();
    },
    
    finish: function () { showReport(); },
    answerOption: function (data) {
      advanceClarification(state.ambiguities[state.qIndex].options[Number(data.index)]);
    },
    skipQuestion: function () { advanceClarification(""); },
    useAnswer: function () {
      const current = state.ambiguities[state.qIndex];
      advanceClarification(state.answers[current.ambiguity_id]);
    },
    editStart: function (data) {
      if (isCompleted(state.report) || isCompleted(selectedSession())) return;
      const id = Number(data.id);
      const item = state.report.requirements.find(function (r) { return r.requirement_id === id; });
      state.editingId = id;
      state.editText = item.translated_text;
      render();
    },
    editCancel: function () {
      state.editingId = null;
      render();
    },
    editSave: function (data) { saveEdit(Number(data.id)); },
    approve: function (data) { approveRequirement(Number(data.id)); },
    addAnother: function () {
      if (isCompleted(state.report) || isCompleted(selectedSession())) return;
      go("input");
    },
    goReview: function () { showReview(); },
    export: function () { exportReport(); },
    logout: function () { signOut(); },
  };

  const models = {
    authName: function (v) { state.authName = v; },
    authEmail: function (v) { state.authEmail = v; },
    authPassword: function (v) { state.authPassword = v; },
    projectName: function (v) {
      state.projectName = v;
      updateStartButton();
    },
    clientName: function (v) { state.clientName = v; },
    search: function (v) {
      state.search = v;
      const list = $("#session-list");
      if (list) list.innerHTML = sessionListHtml();
    },
    requirementText: function (v) {
      state.requirementText = v;
      const count = $("#req-count");
      const button = $("#analyze-btn");
      if (count) count.textContent = v.length + " / 2000";
      if (button) button.disabled = state.busy || !v.trim();
    },
    answer: function (v) {
      const current = state.ambiguities[state.qIndex];
      if (!current) return;
      state.answers[current.ambiguity_id] = v;
      const button = $("#use-answer");
      if (button) button.disabled = state.busy || !v.trim();
    },
    editText: function (v) { state.editText = v; },
  };

  const forms = {
    auth: submitAuth,
    createSession: createSession,
    analyze: analyzeRequirement,
  };

  app.addEventListener("click", function (event) {
    const el = event.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const handler = actions[el.dataset.action];
    if (handler) handler(el.dataset);
  });

  app.addEventListener("input", function (event) {
    const key = event.target.dataset && event.target.dataset.model;
    if (key && models[key]) models[key](event.target.value);
  });

  app.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && (state.helpOpen || state.completeConfirmOpen)) {
      state.helpOpen = false;
      state.completeConfirmOpen = false;
      render();
      return;
    }

    if (
      event.target.id !== "requirement-text" ||
      event.key !== "Enter" ||
      event.shiftKey ||
      event.isComposing
    ) {
      return;
    }

    event.preventDefault();
    if (event.target.form) event.target.form.requestSubmit();
  });

  app.addEventListener("submit", function (event) {
    event.preventDefault();
    const handler = forms[event.target.dataset.form];
    if (handler) handler();
  });

  /* ---------- start ---------- */

  async function init() {
    window.addEventListener("hashchange", route);

    if (PREVIEW) {
      state.session = { access_token: "preview" };
      state.user = Preview.user;
      route();
      return;
    }

    route();
    try {
      state.supabase = await getSupabase();
      state.supabase.auth.onAuthStateChange(function (_event, session) {
        if (session && session.user) {
          // A silent token refresh: keep the screen as it is.
          if (state.user && state.user.id === session.user.id && state.view === "workspace") {
            state.session = session;
            return;
          }
          enterWorkspace(session);
        } else if (state.user) {
          leaveWorkspace();
          route();
        }
      });
      const result = await state.supabase.auth.getSession();
      if (result.error) throw result.error;
      if (result.data.session && result.data.session.user) {
        enterWorkspace(result.data.session);
      } else {
        render();
      }
    } catch (error) {
      state.configError = error.message;
      render();
    }
  }

  init();
})();
