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
      projects: [],
      sessions: [],
      selectedId: null,
      expandedProjects: {},
      search: "",
      loadingSessions: true,
      workflow: "dashboard",
      projectName: "",
      clientName: "",
      sessionName: "",
      creating: false,
      createProjectOpen: false,
      busy: false,
      error: "",
      notice: "",
      helpOpen: false,
      completeConfirmOpen: false,
      deleteConfirmSession: null,
      deleteConfirmProject: null,
      renameConfirmSession: null,
      renameConfirmProject: null,
      renameProjectName: "",
      createSessionProjectId: null,
      openProjectMenuId: null,
      openSessionMenuId: null,
      sidebarOpen: true,
      sidebarWidth: 256,
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
    more: "M5 12h.01M12 12h.01M19 12h.01",
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

  const SIDEBAR_MIN_WIDTH = 200;
  const SIDEBAR_MAX_WIDTH = 400;

  function setSidebarWidth(width) {
    state.sidebarWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));
    const shell = $(".shell");
    const handle = $(".sidebar-resize-handle");
    if (shell) shell.style.setProperty("--sidebar-width", state.sidebarWidth + "px");
    if (handle) {
      handle.setAttribute("aria-valuenow", String(state.sidebarWidth));
      handle.setAttribute("aria-valuetext", state.sidebarWidth + " pixels");
    }
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

  function formatSessionDateTime(startedAt) {
    if (!startedAt) return "Date and time unavailable";
    const isoTimestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(startedAt)
      ? startedAt
      : startedAt + "Z";
    const date = new Date(isoTimestamp);
    return Number.isNaN(date.getTime())
      ? "Date and time unavailable"
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
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
      '<section class="product-demo glass" aria-label="Illustrative ClearReq requirement analysis">' +
      '<div class="demo-header"><div><p class="demo-kicker">CLEARREQ AI</p><p class="demo-editor-title">Requirement intelligence</p></div>' +
      '<span class="demo-status"><span class="demo-status-dot"></span><span>Example analysis</span></span></div>' +
      '<div class="demo-editor"><div class="demo-editor-bar"><span></span><span></span><span></span><p>Requirement editor</p></div>' +
      '<div class="demo-editor-body"><p class="demo-label">USER REQUIREMENT</p><p class="demo-requirement">The web app should allow users to capture the current scene <mark class="demo-highlight">quickly</mark> and <mark class="demo-highlight">securely</mark>.</p></div></div>' +
      '<section class="demo-results" aria-label="Illustrative analysis results">' +
      '<div class="demo-results-head"><span class="demo-results-mark"></span><h3>2 ambiguities detected</h3></div>' +
      '<div class="demo-results-list">' +
      '<article class="demo-result-item"><p class="demo-result-type">AMBIGUITY DETECTED</p><span class="demo-term">quickly</span><p class="demo-result-question">What does “quickly” mean?</p><p class="demo-result-detail">Expected response time?</p></article>' +
      '<article class="demo-result-item"><p class="demo-result-type">AMBIGUITY DETECTED</p><span class="demo-term">securely</span><p class="demo-result-question">What security requirements are expected?</p></article>' +
      '</div></section>' +
      '<p class="demo-footnote">Illustrative example · no live analysis is running</p>' +
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

    if (state.loadingSessions) {
      return '<p class="session-note">Loading sessions...</p>';
    }

    const visibleProjects = state.projects.filter(function (project) {
      return !query || project.project_name.toLowerCase().indexOf(query) >= 0 ||
        state.sessions.some(function (session) {
          return session.project_id === project.project_id &&
            (session.session_name || "").toLowerCase().indexOf(query) >= 0;
        });
    });

    if (!visibleProjects.length) {
      return '<p class="session-note">' +
        (state.search
          ? "No projects match your search."
          : "Create a project to get started.") +
        "</p>";
    }

    return visibleProjects.map(function (project) {
      const projectId = project.project_id;
      const sessions = state.sessions.filter(function (session) {
        return session.project_id === projectId &&
          (!query || project.project_name.toLowerCase().indexOf(query) >= 0 ||
            (session.session_name || "").toLowerCase().indexOf(query) >= 0);
      });
      const expanded = state.expandedProjects[projectId] !== false || Boolean(query);
      return (
        '<section class="project-group">' +
        '<div class="project-row' + (state.openProjectMenuId === projectId ? " menu-open" : "") + '">' +
        '<button type="button" class="project-toggle" data-action="toggleProject" data-id="' + projectId + '" aria-expanded="' + expanded + '">' +
        '<span class="project-caret">' + (expanded ? "⌄" : "›") + "</span>" +
        '<span class="project-heading"><span class="name">' + esc(project.project_name) + '</span>' +
        '<span class="meta">' + (project.client_name ? esc(project.client_name) + " · " : "") +
        plural(sessions.length, "session") + "</span></span></button>" +
        '<button class="project-add-session" type="button" data-action="createProjectSession" data-id="' + projectId + '" aria-label="Create session in ' + esc(project.project_name) + '" title="New session">+</button>' +
        '<button class="project-menu-toggle" type="button" data-action="toggleProjectMenu" data-id="' + projectId + '" aria-label="Project options for ' + esc(project.project_name) + '" aria-haspopup="menu" aria-expanded="' + (state.openProjectMenuId === projectId) + '">' + icon("more") + "</button>" +
        (state.openProjectMenuId === projectId
          ? '<div class="project-menu" role="menu">' +
            '<button type="button" role="menuitem" data-action="renameProject" data-id="' + projectId + '">Rename project</button>' +
            '<button type="button" role="menuitem" data-action="deleteProject" data-id="' + projectId + '">Delete project</button></div>'
          : "") +
        "</div>" +
        (expanded
          ? '<div class="project-sessions">' +
            (sessions.length
              ? sessions.map(sessionItemHtml).join("")
              : '<p class="session-note project-empty">No sessions yet. Select + to start one.</p>') +
            "</div>"
          : "") +
        "</section>"
      );
    }).join("");
  }

  function sessionItemHtml(s) {
    const selected = s.session_id === state.selectedId;
    const label = s.session_name || "Session · " + formatSessionDateTime(s.started_at);
    return (
      '<div class="session-row' +
      (state.openSessionMenuId === s.session_id ? " menu-open" : "") +
      '" data-session-id="' + s.session_id + '">' +
      '<button type="button" class="session-item' + (selected ? " selected" : "") + '"' +
      (selected ? ' aria-current="true"' : "") +
      ' data-action="openSession" data-id="' + s.session_id + '">' +
      '<span class="name">' + esc(label) + "</span>" +
      '<span class="meta">' + (s.session_name ? formatSessionDateTime(s.started_at) + " · " : "") +
      plural(s.requirement_count, "requirement") +
      (s.translated_count ? ", " + s.translated_count + " translated" : "") +
      (isCompleted(s) ? " · Completed" : "") + "</span></button>" +
      '<button class="session-menu-toggle" type="button" data-action="toggleSessionMenu" data-id="' + s.session_id + '"' +
      ' aria-label="Session options for ' + esc(label) + '" aria-haspopup="menu" aria-expanded="' + (state.openSessionMenuId === s.session_id) + '">' +
      icon("more") + "</button>" +
      (state.openSessionMenuId === s.session_id
        ? '<div class="session-menu" role="menu">' +
          '<button type="button" role="menuitem" data-action="renameSession" data-id="' + s.session_id + '"' +
          (state.busy ? " disabled" : "") + ">Rename session</button>" +
          '<button type="button" role="menuitem" data-action="deleteSession" data-id="' + s.session_id + '"' +
          (state.busy ? " disabled" : "") + ">Delete session</button></div>"
        : "") +
      "</div>"
    );
  }

  function sidebarHtml() {
    const onHome = state.workflow === "dashboard";
    const onReport = state.workflow === "report" || state.workflow === "reports";
    return (
      '<aside class="sidebar">' + brand(false) +
      '<nav class="nav" aria-label="Workspace">' +
      '<button class="nav-item" type="button" data-action="newProject">' + icon("plus") + "New project</button>" +
      '<div class="nav-item nav-search">' + icon("search") +
      '<label class="sr-only" for="session-search">Search sessions</label>' +
      '<input id="session-search" data-model="search" placeholder="Search" autocomplete="off" value="' + esc(state.search) + '"></div>' +
      "</nav><hr>" +
      '<nav class="nav" aria-label="Pages">' +
      '<button class="nav-item' + (onHome ? " active" : "") + '" type="button" data-action="home"' + (onHome ? ' aria-current="page"' : "") + ">" + icon("home") + "Home</button>" +
      '<button class="nav-item' + (onReport ? " active" : "") + '" type="button" data-action="reports"' + (state.busy ? " disabled" : "") + (onReport ? ' aria-current="page"' : "") + ">" + icon("file") + "Reports</button>" +
      "</nav><hr>" +
      '<p class="side-label">Projects</p>' +
      '<div class="session-list" id="session-list">' + sessionListHtml() + "</div>" +
      '<div class="profile"><span class="avatar">' + esc(firstName().charAt(0).toUpperCase()) + "</span>" +
      '<div class="who"><p class="name">' + esc(displayName()) + '</p><p class="email">' + esc(state.user.email) + "</p></div>" +
      '<button class="icon-btn" type="button" data-action="logout" aria-label="Log out" title="Log out">' + icon("logout") + "</button>" +
      "</div>" +
      '<div class="sidebar-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin="' + SIDEBAR_MIN_WIDTH + '" aria-valuemax="' + SIDEBAR_MAX_WIDTH + '" aria-valuenow="' + state.sidebarWidth + '" aria-valuetext="' + state.sidebarWidth + ' pixels" tabindex="0"></div>' +
      "</aside>"
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
    const count = state.projects.length;
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
      '<button type="button" data-action="newProject">New project</button></p></div>' +
      '<h1 class="display greeting">' + greeting() + ", " + esc(firstName()) + "</h1>" +
      '<div class="gap">' + (state.createProjectOpen ? "" : messagesHtml()) + "</div>" +
      (sel
        ? '<section class="glass selected-project"><div class="top"><div><p class="small faint">Selected project · ' + esc(sel.session_name || formatSessionDateTime(sel.started_at)) + '</p><h2 class="display">' + esc(sel.project_name) + "</h2>" +
          (sel.session_name ? '<p class="small muted">' + formatSessionDateTime(sel.started_at) + "</p>" : "") +
          (sel.client_name ? '<p class="small muted">Client: ' + esc(sel.client_name) + "</p>" : "") + "</div>" +
          '<div class="stats"><p><strong>' + requirementCount + '</strong><span class="small muted">Requirements</span></p>' +
          '<p><strong>' + approvedCount + '</strong><span class="small muted">Approved</span></p>' +
          '<p><strong>' + progress + '%</strong><span class="small muted">' + status + "</span></p></div></div>" +
          '<div class="buttons">' +
          (isCompleted(sel) ? "" : '<button class="btn btn-primary" type="button" data-action="continueSession"' +
            (state.busy ? " disabled" : "") + ">" + (state.busy ? "Loading..." : "Continue session") + "</button>") +
          '<button class="btn btn-ghost" type="button" data-action="showReport"' + (state.busy ? " disabled" : "") + ">View report</button></div></section>"
        : '<section class="glass card project-intro"><p class="small faint">GET STARTED</p><h2 class="display">Organize work by project</h2>' +
          '<p class="muted">Create a project once, then add separate sessions for meetings, requirement rounds, or later iterations. Project discovery is answered in the first session; each session keeps its own requirements and report.</p>' +
          '<button class="btn btn-primary" type="button" data-action="newProject">Create a project</button></section>' +
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
      (report.session_name ? '<p class="report-client">Session: ' + esc(report.session_name) + "</p>" : "") +
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
    const reportGroups = state.projects.map(function (project) {
      return {
        project: project,
        sessions: state.sessions.filter(function (session) {
          return session.project_id === project.project_id;
        }),
      };
    }).filter(function (group) {
      return group.sessions.length > 0;
    });

    if (!reportGroups.length) {
      return '<section class="glass card"><p class="muted">No session reports are available yet. Create a session in a project to see its report here.</p></section>';
    }

    return (
      '<section class="glass card"><h2 class="display">Session reports by project</h2>' +
      reportGroups.map(function (group) {
        return (
          '<div class="report-project-group"><div class="row-between report-project-head">' +
          '<h3 class="display">' + esc(group.project.project_name) + "</h3>" +
          '<span class="small muted">' + plural(group.sessions.length, "session report") + "</span></div>" +
          group.sessions.map(function (session) {
            return (
              '<article class="glass selected-project report-session-card"><div class="top"><div>' +
              '<h4 class="display">' + esc(session.session_name || "Session") + "</h4>" +
              '<p class="small muted">' + formatSessionDateTime(session.started_at) + "</p>" +
              '<p class="small muted">' + plural(session.translated_count, "reviewed requirement") +
              ", " + plural(session.approved_count, "approved requirement") + "</p></div>" +
              '<button class="btn btn-primary" type="button" data-action="openReport" data-id="' +
              session.session_id + '">View report</button></div></article>'
            );
          }).join("") +
          "</div>"
        );
      }).join("") +
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
      '<li><span>1</span><div><h3>Create a project</h3><p>Add the project name and optional client name. A first session starts with it; you can add more sessions under the same project.</p></div></li>' +
      '<li><span>2</span><div><h3>Organize sessions</h3><p>Use the + beside a project to start a separate session. Session names are optional and can be added or changed later; start date and time are saved automatically.</p></div></li>' +
      '<li><span>3</span><div><h3>Complete discovery</h3><p>Answer the project discovery questions in its first session. Later sessions automatically reuse these answers.</p></div></li>' +
      '<li><span>4</span><div><h3>Add requirements</h3><p>Write one requirement at a time and select Analyze requirement. Answer any clarification questions.</p></div></li>' +
      '<li><span>5</span><div><h3>Review, approve, and report</h3><p>Check translations, edit and approve the requirements you accept, then view or export that session’s report.</p></div></li>' +
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

  function deleteConfirmHtml() {
    const session = state.deleteConfirmSession;
    if (!session) return "";
    return (
      '<div class="help-overlay" data-action="cancelDelete" data-overlay="delete">' +
      '<section class="glass help-dialog completion-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-warning">' +
      '<div class="help-dialog-head"><div><p class="small faint">DELETE SESSION</p>' +
      '<h2 class="display" id="delete-title">Delete this session?</h2></div></div>' +
      '<p id="delete-warning" class="completion-warning">The session "' + esc(session.session_name || formatSessionDateTime(session.started_at)) + '" in "' + esc(session.project_name) + '" will be permanently deleted, including its saved requirements and history. This action cannot be undone.</p>' +
      (state.error ? '<p class="banner banner-error" role="alert">' + esc(state.error) + "</p>" : "") +
      '<div class="completion-actions"><button class="btn btn-ghost" type="button" data-action="cancelDelete" ' + (state.busy ? "disabled" : "") + ">Cancel</button>" +
      '<button class="btn btn-primary delete-confirm-button" type="button" data-action="confirmDelete" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Deleting..." : "Delete Session") + "</button></div>" +
      "</section></div>"
    );
  }

  function deleteProjectConfirmHtml() {
    const project = state.deleteConfirmProject;
    if (!project) return "";
    const count = state.sessions.filter(function (session) {
      return session.project_id === project.project_id;
    }).length;
    return (
      '<div class="help-overlay" data-action="cancelDeleteProject" data-overlay="delete-project">' +
      '<section class="glass help-dialog completion-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-warning">' +
      '<div class="help-dialog-head"><div><p class="small faint">DELETE PROJECT</p>' +
      '<h2 class="display" id="delete-project-title">Delete this project?</h2></div></div>' +
      '<p id="delete-project-warning" class="completion-warning">The project "' + esc(project.project_name) +
      '" and all ' + plural(count, "session") + " with their requirements and reports will be permanently deleted. This cannot be undone.</p>" +
      (state.error ? '<p class="banner banner-error" role="alert">' + esc(state.error) + "</p>" : "") +
      '<div class="completion-actions"><button class="btn btn-ghost" type="button" data-action="cancelDeleteProject" ' + (state.busy ? "disabled" : "") + ">Cancel</button>" +
      '<button class="btn btn-primary delete-confirm-button" type="button" data-action="confirmDeleteProject" ' + (state.busy ? "disabled" : "") + ">" +
      (state.busy ? "Deleting..." : "Delete Project") + "</button></div>" +
      "</section></div>"
    );
  }

  function renameConfirmHtml() {
    const session = state.renameConfirmSession;
    const project = state.renameConfirmProject;
    const target = session || project;
    if (!target) return "";
    const title = session ? "Rename session" : "Rename project";
    return (
      '<div class="help-overlay" data-action="cancelRename" data-overlay="rename">' +
      '<section class="glass help-dialog completion-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title">' +
      '<div class="help-dialog-head"><div><p class="small faint">' + (session ? "RENAME SESSION" : "RENAME PROJECT") + "</p>" +
      '<h2 class="display" id="rename-title">' + title + '</h2></div></div>' +
      '<label class="completion-warning label" for="rename-project-name">' + (session ? "Session name (optional)" : "Project name") +
      '<input class="field" id="rename-project-name" data-model="renameProjectName" type="text" maxlength="120" ' +
      'value="' + esc(state.renameProjectName) + '"></label>' +
      (state.error ? '<p class="banner banner-error" role="alert">' + esc(state.error) + "</p>" : "") +
      '<div class="completion-actions"><button class="btn btn-ghost" type="button" data-action="cancelRename" ' + (state.busy ? "disabled" : "") + ">Cancel</button>" +
      '<button class="btn btn-primary" type="button" data-action="confirmRename" ' +
      (state.busy || (!session && !state.renameProjectName.trim()) ? "disabled" : "") + ">" +
      (state.busy ? "Saving..." : "Save") + "</button></div>" +
      "</section></div>"
    );
  }

  function createSessionHtml() {
    const project = state.projects.find(function (item) {
      return item.project_id === state.createSessionProjectId;
    });
    if (!project) return "";
    return (
      '<div class="help-overlay" data-action="cancelCreateSession" data-overlay="create-session">' +
      '<section class="glass help-dialog completion-dialog" role="dialog" aria-modal="true" aria-labelledby="create-session-title">' +
      '<div class="help-dialog-head"><div><p class="small faint">NEW SESSION · ' + esc(project.project_name.toUpperCase()) + '</p>' +
      '<h2 class="display" id="create-session-title">Start a session</h2></div></div>' +
      '<p class="completion-warning">This session inherits discovery answers from the project’s first session and keeps its own requirements and report. The start date and time are saved automatically.</p>' +
      '<label class="label" for="new-session-name">Session name (optional)' +
      '<input class="field" id="new-session-name" data-model="sessionName" maxlength="120" autocomplete="off" ' +
      'placeholder="e.g. Initial requirements workshop" value="' + esc(state.sessionName) + '"></label>' +
      (state.error ? '<p class="banner banner-error" role="alert">' + esc(state.error) + "</p>" : "") +
      '<div class="completion-actions"><button class="btn btn-ghost" type="button" data-action="cancelCreateSession" ' + (state.busy ? "disabled" : "") + ">Cancel</button>" +
      '<button class="btn btn-primary" type="button" data-action="confirmCreateSession" ' + (state.busy ? "disabled" : "") + ">" +
      (state.busy ? "Starting..." : "Start session") + "</button></div>" +
      "</section></div>"
    );
  }

  function createProjectHtml() {
    if (!state.createProjectOpen) return "";
    return (
      '<div class="help-overlay" data-action="cancelCreateProject" data-overlay="create-project">' +
      '<section class="glass help-dialog completion-dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title">' +
      '<div class="help-dialog-head"><div><p class="small faint">NEW PROJECT</p>' +
      '<h2 class="display" id="create-project-title">Create a project</h2></div></div>' +
      '<form class="project-create-form" data-form="createProject">' +
      '<label class="label" for="project-name">Project name' +
      '<input class="field" id="project-name" data-model="projectName" maxlength="120" required autocomplete="off" value="' + esc(state.projectName) + '"></label>' +
      '<label class="label" for="client-name">Client name (optional)' +
      '<input class="field" id="client-name" data-model="clientName" autocomplete="organization" value="' + esc(state.clientName) + '"></label>' +
      '<label class="label" for="first-session-name">First session name (optional)' +
      '<input class="field" id="first-session-name" data-model="sessionName" maxlength="120" autocomplete="off" value="' + esc(state.sessionName) + '"></label>' +
      '<p class="small muted">Creates the project and its first guided session. You can name the session now or later.</p>' +
      (state.error ? '<p class="banner banner-error" role="alert">' + esc(state.error) + "</p>" : "") +
      '<div class="completion-actions"><button class="btn btn-ghost" type="button" data-action="cancelCreateProject" ' + (state.creating ? "disabled" : "") + ">Cancel</button>" +
      '<button class="btn btn-primary" id="start-btn" type="submit" ' +
      (state.creating || !state.projectName.trim() ? "disabled" : "") + ">" +
      (state.creating ? "Creating..." : "Create project") + "</button></div></form>" +
      "</section></div>"
    );
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
      esc(state.workflow === "reports"
        ? "All session reports, grouped by project"
        : sel
          ? sel.project_name + " · " + (sel.session_name || formatSessionDateTime(sel.started_at))
          : "Project workspace") + "</p></header>" +
      messagesHtml() + body + "</div>"
    );
  }

  function workspaceHtml() {
    const focused = state.workflow !== "dashboard" && state.workflow !== "reports";
    return (
      '<div class="app-bg shell' + (focused ? " session-focused" : "") + (focused && !state.sidebarOpen ? " sidebar-collapsed" : "") + '" style="--sidebar-width:' + state.sidebarWidth + 'px">' + sidebarHtml() +
      '<main class="main">' +
      (focused
        ? '<button class="sidebar-toggle" type="button" data-action="toggleSidebar" aria-expanded="' + state.sidebarOpen + '" aria-label="' + (state.sidebarOpen ? "Hide session sidebar" : "Show session sidebar") + '">' + (state.sidebarOpen ? "Hide sidebar" : "Show sidebar") + "</button>"
        : "") +
      '<button class="help-trigger" type="button" data-action="openHelp" aria-label="Open usage guide" aria-expanded="' + state.helpOpen + '" title="Usage guide">i</button>' +
      (state.workflow === "dashboard" ? dashboardHtml() : (state.workflow === "reports" ? pageHtml() : stepsHtml() + pageHtml())) +
      (state.helpOpen ? helpGuideHtml() : "") +
      (state.completeConfirmOpen ? completeConfirmHtml() : "") +
      (state.deleteConfirmSession ? deleteConfirmHtml() : "") +
      (state.deleteConfirmProject ? deleteProjectConfirmHtml() : "") +
      (state.renameConfirmSession ? renameConfirmHtml() : "") +
      (state.renameConfirmProject ? renameConfirmHtml() : "") +
      (state.createProjectOpen ? createProjectHtml() : "") +
      (state.createSessionProjectId ? createSessionHtml() : "") +
      "</main></div>"
    );
  }

  /* ---------- rendering ---------- */

  function render() {
    if (state.view === "landing") {
      app.innerHTML = landingHtml();
    } else {
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
      const results = await Promise.all([api("/projects"), api("/sessions")]);
      state.projects = results[0];
      state.sessions = results[1];
      state.projects.forEach(function (project) {
        if (!Object.prototype.hasOwnProperty.call(state.expandedProjects, project.project_id)) {
          state.expandedProjects[project.project_id] = true;
        }
      });
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loadingSessions = false;
      render();
    }
  }

  async function createProject() {
    const name = state.projectName.trim();
    if (!name || state.creating) return;
    const clientName = state.clientName.trim();
    const firstSessionName = state.sessionName.trim();
    state.creating = true;
    clearMessages();
    render();
    try {
      const project = await api("/projects", {
        method: "POST",
        body: JSON.stringify({ project_name: name, client_name: clientName || null }),
      });
      state.projects.unshift(project);
      state.expandedProjects[project.project_id] = true;
      const result = await api("/projects/" + project.project_id + "/sessions", {
        method: "POST",
        body: JSON.stringify({ session_name: firstSessionName || null }),
      });
      state.projectName = "";
      state.clientName = "";
      state.sessionName = "";
      state.selectedId = result.session_id;
      state.createProjectOpen = false;
      state.sessions.unshift(Object.assign({}, result, {
        status: "active",
        requirement_count: 0,
        translated_count: 0,
        approved_count: 0,
      }));
      project.session_count = 1;
      state.sidebarOpen = false;
      state.discoveryAnswers = result.discovery_answers || [];
      state.discoveryIndex = state.discoveryAnswers.length;
      state.workflow = result.discovery_required === false ? "input" : "discovery";
    } catch (error) {
      state.error = error.message;
      state.workflow = "dashboard";
      if (state.projects.length) loadSessions();
    } finally {
      state.creating = false;
      go(state.workflow);
    }
  }

  function requestCreateSession(projectId) {
    if (!projectId || state.busy || state.creating) return;
    state.createSessionProjectId = projectId;
    state.sessionName = "";
    state.openProjectMenuId = null;
    clearMessages();
    state.focusId = "new-session-name";
    render();
  }

  async function createProjectSession() {
    const projectId = state.createSessionProjectId;
    if (!projectId || state.busy) return;
    state.busy = true;
    clearMessages();
    render();
    try {
      const result = await api("/projects/" + projectId + "/sessions", {
        method: "POST",
        body: JSON.stringify({ session_name: state.sessionName.trim() || null }),
      });
      state.sessions.unshift(Object.assign({}, result, {
        status: "active",
        requirement_count: 0,
        translated_count: 0,
        approved_count: 0,
      }));
      const project = state.projects.find(function (item) {
        return item.project_id === projectId;
      });
      if (project) project.session_count += 1;
      state.expandedProjects[projectId] = true;
      state.selectedId = result.session_id;
      state.createSessionProjectId = null;
      state.sessionName = "";
      state.sidebarOpen = false;
      state.discoveryAnswers = result.discovery_answers || [];
      state.discoveryIndex = state.discoveryAnswers.length;
      state.workflow = result.discovery_required === false ? "input" : "discovery";
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }

  function startSession(sessionId, screen) {
    state.selectedId = sessionId;
    state.requirementText = "";
    state.requirementId = null;
    state.discoveryAnswers = [];
    state.discoveryIndex = 0;
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

  async function continueSession() {
    const session = selectedSession();
    if (!session || state.busy) return;
    if (isCompleted(session)) {
      showReport();
      return;
    }

    state.busy = true;
    clearMessages();
    render();
    try {
      const result = await api("/sessions/" + session.session_id + "/discovery");
      state.discoveryAnswers = result.answers || [];
      state.discoveryIndex = state.discoveryAnswers.length;
      state.workflow = result.discovery_required !== false &&
        state.discoveryAnswers.length < discoveryQuestions.length &&
        !session.requirement_count
        ? "discovery"
        : "input";
    } catch (error) {
      state.error = error.message;
      state.workflow = "dashboard";
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }

  async function saveDiscoveryAnswer(answer) {
    if (state.busy || !state.selectedId || isCompleted(selectedSession())) return;
    state.busy = true;
    clearMessages();
    render();
    const question = discoveryQuestions[state.discoveryIndex];
    const next = state.discoveryAnswers.concat([{ question: question.question, answer: answer }]);
    try {
      await api("/sessions/" + state.selectedId + "/discovery", {
        method: "POST",
        body: JSON.stringify({ answers: next }),
      });
      state.discoveryAnswers = next;
      if (state.discoveryIndex === discoveryQuestions.length - 1) {
        state.workflow = "input";
      } else {
        state.discoveryIndex += 1;
      }
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      go(state.workflow);
    }
  }
  function requestDeleteSession(id) {
    if (!id || state.busy) return;
    const session = state.sessions.find(function (item) {
      return item.session_id === id;
    });
    if (!session) return;
    clearMessages();
    state.openSessionMenuId = null;
    state.deleteConfirmSession = session;
    render();
  }

  async function deleteSession() {
    const session = state.deleteConfirmSession;
    if (!session || state.busy) return;
    const id = session.session_id;
    state.busy = true;
    clearMessages();
    render();

    try {
      await api("/sessions/" + id, {
        method: "DELETE"
      });

      state.sessions = state.sessions.filter(function (s) {
        return s.session_id !== id;
      });
      const project = state.projects.find(function (item) {
        return item.project_id === session.project_id;
      });
      if (project) project.session_count = Math.max(0, project.session_count - 1);
      state.deleteConfirmSession = null;

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

  function requestDeleteProject(id) {
    const project = state.projects.find(function (item) {
      return item.project_id === id;
    });
    if (!project || state.busy) return;
    clearMessages();
    state.openProjectMenuId = null;
    state.deleteConfirmProject = project;
    render();
  }

  async function deleteProject() {
    const project = state.deleteConfirmProject;
    if (!project || state.busy) return;
    const projectId = project.project_id;
    state.busy = true;
    clearMessages();
    render();
    try {
      await api("/projects/" + projectId, { method: "DELETE" });
      const removedIds = state.sessions.filter(function (session) {
        return session.project_id === projectId;
      }).map(function (session) { return session.session_id; });
      state.sessions = state.sessions.filter(function (session) {
        return session.project_id !== projectId;
      });
      state.projects = state.projects.filter(function (item) {
        return item.project_id !== projectId;
      });
      state.deleteConfirmProject = null;
      if (removedIds.indexOf(state.selectedId) >= 0) {
        state.selectedId = state.sessions.length ? state.sessions[0].session_id : null;
        state.workflow = "dashboard";
        state.report = null;
        state.requirementText = "";
        state.requirementId = null;
        state.ambiguities = [];
        state.answers = {};
      }
      state.notice = "Project and its sessions deleted successfully.";
    } catch (error) {
      state.error = error.message;
    } finally {
      state.busy = false;
      render();
    }
  }

  function requestRenameSession(id) {
    const session = state.sessions.find(function (item) {
      return item.session_id === id;
    });
    if (!session || state.busy) return;
    clearMessages();
    state.openSessionMenuId = null;
    state.renameConfirmProject = null;
    state.renameConfirmSession = session;
    state.renameProjectName = session.session_name || "";
    state.focusId = "rename-project-name";
    render();
  }

  function requestRenameProject(id) {
    const project = state.projects.find(function (item) {
      return item.project_id === id;
    });
    if (!project || state.busy) return;
    clearMessages();
    state.openProjectMenuId = null;
    state.renameConfirmSession = null;
    state.renameConfirmProject = project;
    state.renameProjectName = project.project_name;
    state.focusId = "rename-project-name";
    render();
  }

  async function renameItem() {
    const session = state.renameConfirmSession;
    const project = state.renameConfirmProject;
    const target = session || project;
    if (!target || state.busy) return;
    const name = state.renameProjectName.trim();
    if (!session && !name) {
      state.error = "Project name cannot be empty.";
      render();
      return;
    }
    if (name.length > 120) {
      state.error = "Name must be at most 120 characters.";
      render();
      return;
    }
    if (name === (session ? (session.session_name || "") : project.project_name)) {
      state.renameConfirmSession = null;
      state.renameConfirmProject = null;
      state.renameProjectName = "";
      render();
      return;
    }

    state.busy = true;
    clearMessages();
    render();
    try {
      const id = session ? session.session_id : project.project_id;
      const result = await api((session ? "/sessions/" : "/projects/") + id, {
        method: "PATCH",
        body: JSON.stringify(session
          ? { session_name: name || null }
          : { project_name: name }),
      });
      state.renameConfirmSession = null;
      state.renameConfirmProject = null;
      state.renameProjectName = "";
      if (session) {
        session.session_name = result.session_name;
        if (state.report && state.report.session_id === id) {
          state.report.session_name = result.session_name;
        }
      } else {
        project.project_name = result.project_name;
        state.sessions.forEach(function (item) {
          if (item.project_id === id) item.project_name = result.project_name;
        });
        if (state.report && state.report.project_id === id) {
          state.report.project_name = result.project_name;
        }
      }
      state.notice = session ? "Session name updated." : "Project renamed successfully.";
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
      state.workflow = "dashboard";
      state.sidebarOpen = true;
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
      requestDeleteSession(Number(data.id));
    },
    deleteProject: function (data) {
      requestDeleteProject(Number(data.id));
    },
    confirmDeleteProject: function () {
      deleteProject();
    },
    cancelDeleteProject: function () {
      if (state.busy) return;
      state.deleteConfirmProject = null;
      clearMessages();
      render();
    },
    renameSession: function (data) {
      requestRenameSession(Number(data.id));
    },
    renameProject: function (data) {
      requestRenameProject(Number(data.id));
    },
    toggleProject: function (data) {
      const id = Number(data.id);
      state.expandedProjects[id] = state.expandedProjects[id] === false;
      render();
    },
    toggleProjectMenu: function (data) {
      const id = Number(data.id);
      state.openProjectMenuId = state.openProjectMenuId === id ? null : id;
      render();
    },
    toggleSessionMenu: function (data) {
      const id = Number(data.id);
      state.openSessionMenuId = state.openSessionMenuId === id ? null : id;
      render();
    },
    createProjectSession: function (data) {
      requestCreateSession(Number(data.id));
    },
    confirmCreateSession: function () {
      createProjectSession();
    },
    cancelCreateSession: function () {
      if (state.busy) return;
      state.createSessionProjectId = null;
      state.sessionName = "";
      clearMessages();
      render();
    },
    confirmDelete: function () {
      deleteSession();
    },
    cancelDelete: function () {
      if (state.busy) return;
      state.deleteConfirmSession = null;
      render();
    },
    cancelRename: function () {
      if (state.busy) return;
      state.renameConfirmSession = null;
      state.renameConfirmProject = null;
      state.renameProjectName = "";
      clearMessages();
      render();
    },
    confirmRename: function () {
      renameItem();
    },

    newProject: function () {
      clearMessages();
      state.selectedId = null;
      state.projectName = "";
      state.clientName = "";
      state.sessionName = "";
      state.sidebarOpen = true;
      state.createProjectOpen = true;
      state.focusId = "project-name";
      go("dashboard");
    },
    cancelCreateProject: function () {
      if (state.creating) return;
      state.createProjectOpen = false;
      state.projectName = "";
      state.clientName = "";
      state.sessionName = "";
      clearMessages();
      render();
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
      continueSession();
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
      state.projectName = starters[Number(data.index)].title;
      state.clientName = "";
      state.sessionName = "";
      state.createProjectOpen = true;
      state.focusId = "project-name";
      clearMessages();
      render();
    },
    discoveryAnswer: function (data) {
      saveDiscoveryAnswer(discoveryQuestions[state.discoveryIndex].options[Number(data.index)]);
    },
    
    discoveryPrevious: async function () {
      if (state.busy || state.discoveryIndex <= 0) return;
      state.busy = true;
      clearMessages();
      render();
      const nextIndex = state.discoveryIndex - 1;
      const next = state.discoveryAnswers.slice(0, nextIndex);
      try {
        await api("/sessions/" + state.selectedId + "/discovery", {
          method: "POST",
          body: JSON.stringify({ answers: next }),
        });
        state.discoveryIndex = nextIndex;
        state.discoveryAnswers = next;
      } catch (error) {
        state.error = error.message;
      } finally {
        state.busy = false;
      }
      render();
    },
    discoverySkip: function () { saveDiscoveryAnswer(""); },
    
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
    sessionName: function (v) { state.sessionName = v; },
    search: function (v) {
      state.search = v;
      const list = $("#session-list");
      if (list) list.innerHTML = sessionListHtml();
    },
    renameProjectName: function (v) {
      state.renameProjectName = v;
      const button = $('[data-action="confirmRename"]');
      if (button) button.disabled = state.busy || (Boolean(state.renameConfirmProject) && !v.trim());
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
    createProject: createProject,
    analyze: analyzeRequirement,
  };

  app.addEventListener("click", function (event) {
    const el = event.target.closest("[data-action]");
    const clickedSessionMenu = event.target.closest(".session-menu, .session-menu-toggle");
    const clickedProjectMenu = event.target.closest(".project-menu, .project-menu-toggle");
    if (state.openSessionMenuId !== null && !clickedSessionMenu) {
      state.openSessionMenuId = null;
      if (!el) render();
    }
    if (state.openProjectMenuId !== null && !clickedProjectMenu) {
      state.openProjectMenuId = null;
      if (!el) render();
    }
    if (!el || el.disabled) return;
    if ((el.dataset.overlay === "delete" || el.dataset.overlay === "rename" ||
      el.dataset.overlay === "delete-project" || el.dataset.overlay === "create-session" ||
      el.dataset.overlay === "create-project") &&
      event.target !== el) return;
    const handler = actions[el.dataset.action];
    if (handler) handler(el.dataset);
  });

  let sidebarResize = null;

  app.addEventListener("pointerdown", function (event) {
    if (!event.target.closest(".sidebar-resize-handle") || window.innerWidth <= 767) return;
    event.preventDefault();
    sidebarResize = { pointerId: event.pointerId, startX: event.clientX, startWidth: state.sidebarWidth };
    document.body.classList.add("sidebar-resizing");
    if (event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId);
  });

  window.addEventListener("pointermove", function (event) {
    if (!sidebarResize || event.pointerId !== sidebarResize.pointerId) return;
    setSidebarWidth(sidebarResize.startWidth + event.clientX - sidebarResize.startX);
  });

  function finishSidebarResize(event) {
    if (!sidebarResize || (event && event.pointerId !== sidebarResize.pointerId)) return;
    sidebarResize = null;
    document.body.classList.remove("sidebar-resizing");
  }

  window.addEventListener("pointerup", finishSidebarResize);
  window.addEventListener("pointercancel", finishSidebarResize);

  app.addEventListener("input", function (event) {
    const key = event.target.dataset && event.target.dataset.model;
    if (key && models[key]) models[key](event.target.value);
  });

  app.addEventListener("keydown", function (event) {
    if (event.target.matches(".sidebar-resize-handle") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      setSidebarWidth(state.sidebarWidth + (event.key === "ArrowRight" ? 16 : -16));
      return;
    }

    if (event.key === "Escape" && (state.helpOpen || state.completeConfirmOpen ||
      state.deleteConfirmSession || state.deleteConfirmProject || state.renameConfirmSession ||
      state.renameConfirmProject || state.createSessionProjectId)) {
      if (state.busy) return;
      state.helpOpen = false;
      state.completeConfirmOpen = false;
      state.deleteConfirmSession = null;
      state.deleteConfirmProject = null;
      state.renameConfirmSession = null;
      state.renameConfirmProject = null;
      state.renameProjectName = "";
      state.createSessionProjectId = null;
      state.sessionName = "";
      clearMessages();
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
