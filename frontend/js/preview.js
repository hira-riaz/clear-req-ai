/*
 * Preview mode: click through the whole app with fake data, no login and no
 * backend. Open the page with ?preview on the end, for example
 *   http://localhost:8000/?preview
 * It only switches on for localhost / 127.0.0.1 / file:// pages, so it cannot
 * be turned on in a deployed site. To remove it, delete this file and its
 * <script> tag in index.html (app.js works without it).
 */
(function () {
  var host = window.location.hostname;
  var local =
    host === "localhost" || host === "127.0.0.1" || window.location.protocol === "file:";
  var enabled = local && new URLSearchParams(window.location.search).has("preview");

  var db = {
    nextProject: 3,
    nextSession: 3,
    nextReq: 1,
    projects: [
      { project_id: 1, project_name: "Hospital Management System", client_name: null },
      { project_id: 2, project_name: "Online Store", client_name: null },
    ],
    sessions: [
      { session_id: 1, project_id: 1, session_name: null, discovery_required: true, started_at: new Date().toISOString(), discovery: [], status: "active" },
      { session_id: 2, project_id: 2, session_name: null, discovery_required: true, started_at: new Date().toISOString(), discovery: [], status: "active" },
    ],
    requirements: [],
  };

  var rules = [
    {
      match: /\b(fast|quick|quickly|instant|responsive)\b/i,
      term: "fast",
      category: "performance",
      question: "What does fast mean for your users?",
      options: [
        "Pages load in under 2 seconds",
        "Search results appear instantly",
        "Reports generate in under 10 seconds",
      ],
      req_type: "Non-Functional",
    },
    {
      match: /\b(secure|security|safe)\b/i,
      term: "secure",
      category: "security",
      question: "Which security measures are required?",
      options: [
        "Two-factor sign-in",
        "Data encrypted at rest and in transit",
        "Role-based access control",
      ],
      req_type: "Non-Functional",
    },
    {
      match: /\b(easy|user-friendly|simple|intuitive)\b/i,
      term: "easy to use",
      category: "usability",
      question: "How should ease of use be measured?",
      options: [
        "New users finish the main task unaided",
        "Fewer than 3 clicks to any feature",
        "No training needed",
      ],
      req_type: "Non-Functional",
    },
  ];

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms || 450);
    });
  }

  function findReq(id) {
    return db.requirements.find(function (r) {
      return r.requirement_id === Number(id);
    });
  }

  function ensureActiveSession(sessionId) {
    var session = db.sessions.find(function (s) {
      return s.session_id === Number(sessionId);
    });
    if (!session) throw new Error("Session not found");
    if (session.status === "completed" || session.ended_at) {
      throw new Error("This session is completed and read-only.");
    }
    return session;
  }

  function ensureRequirementSessionActive(requirement) {
    if (!requirement) throw new Error("Requirement not found");
    ensureActiveSession(requirement.session_id);
  }

  function summary(s) {
    var project = db.projects.find(function (item) {
      return item.project_id === s.project_id;
    });
    var mine = db.requirements.filter(function (r) {
      return r.session_id === s.session_id;
    });
    return {
      session_id: s.session_id,
      project_id: s.project_id,
      project_name: project.project_name,
      client_name: project.client_name || null,
      session_name: s.session_name || null,
      discovery_required: s.discovery_required !== false,
      started_at: s.started_at,
      ended_at: s.ended_at || null,
      status: s.status || (s.ended_at ? "completed" : "active"),
      requirement_count: mine.length,
      translated_count: mine.filter(function (r) {
        return r.translated_text;
      }).length,
      approved_count: mine.filter(function (r) {
        return r.status === "approved";
      }).length,
    };
  }

  async function request(path, options) {
    options = options || {};
    await delay();
    var method = (options.method || "GET").toUpperCase();
    var body = options.body ? JSON.parse(options.body) : {};
    var m;

    if (path === "/projects" && method === "GET") {
      return db.projects.map(function (project) {
        return {
          project_id: project.project_id,
          project_name: project.project_name,
          client_name: project.client_name,
          created_at: project.created_at || new Date().toISOString(),
          session_count: db.sessions.filter(function (s) {
            return s.project_id === project.project_id;
          }).length,
        };
      });
    }

    if (path === "/projects" && method === "POST") {
      var newProject = {
        project_id: db.nextProject++,
        project_name: body.project_name,
        client_name: body.client_name || null,
        created_at: new Date().toISOString(),
      };
      db.projects.unshift(newProject);
      return {
        project_id: newProject.project_id,
        project_name: newProject.project_name,
        client_name: newProject.client_name,
        created_at: newProject.created_at,
        session_count: 0,
      };
    }

    m = path.match(/^\/projects\/(\d+)\/sessions$/);
    if (m && method === "POST") {
      var projectForSession = db.projects.find(function (project) {
        return project.project_id === Number(m[1]);
      });
      if (!projectForSession) throw new Error("Project not found");
      var firstProjectSession = db.sessions.filter(function (session) {
        return session.project_id === projectForSession.project_id;
      }).sort(function (a, b) {
        return a.session_id - b.session_id;
      })[0];
      var projectSession = {
        session_id: db.nextSession++,
        project_id: projectForSession.project_id,
        session_name: body.session_name || null,
        discovery_required: !firstProjectSession,
        started_at: new Date().toISOString(),
        status: "active",
        discovery: firstProjectSession ? (firstProjectSession.discovery || []).map(function (answer) {
          return Object.assign({}, answer);
        }) : [],
      };
      db.sessions.unshift(projectSession);
      return Object.assign({}, summary(projectSession), {
        discovery_answers: projectSession.discovery,
        requirement_count: 0,
        translated_count: 0,
        approved_count: 0,
      });
    }

    m = path.match(/^\/projects\/(\d+)$/);
    if (m && method === "PATCH") {
      var editingProject = db.projects.find(function (project) {
        return project.project_id === Number(m[1]);
      });
      if (!editingProject) throw new Error("Project not found");
      editingProject.project_name = body.project_name;
      return { project_id: editingProject.project_id, project_name: editingProject.project_name };
    }

    if (m && method === "DELETE") {
      var deletingProjectId = Number(m[1]);
      var projectIndex = db.projects.findIndex(function (project) {
        return project.project_id === deletingProjectId;
      });
      if (projectIndex < 0) throw new Error("Project not found");
      var deletedSessionIds = db.sessions.filter(function (session) {
        return session.project_id === deletingProjectId;
      }).map(function (session) { return session.session_id; });
      db.projects.splice(projectIndex, 1);
      db.sessions = db.sessions.filter(function (session) {
        return session.project_id !== deletingProjectId;
      });
      db.requirements = db.requirements.filter(function (requirement) {
        return deletedSessionIds.indexOf(requirement.session_id) < 0;
      });
      return { status: "deleted" };
    }

    if (path === "/sessions" && method === "GET") return db.sessions.map(summary);

    if (path === "/sessions" && method === "POST") {
      var s = {
        session_id: db.nextSession++,
        project_id: db.nextProject,
        session_name: null,
        discovery_required: true,
        started_at: new Date().toISOString(),
        status: "active",
        discovery: [],
      };
      db.projects.unshift({
        project_id: db.nextProject++,
        project_name: body.project_name,
        client_name: body.client_name || null,
      });
      db.sessions.unshift(s);
      return summary(s);
    }

    m = path.match(/^\/sessions\/(\d+)$/);
    if (m && method === "PATCH") {
      var renamingSession = db.sessions.find(function (session) {
        return session.session_id === Number(m[1]);
      });
      if (!renamingSession) throw new Error("Session not found");
      renamingSession.session_name = body.session_name || null;
      return {
        session_id: renamingSession.session_id,
        session_name: renamingSession.session_name,
      };
    }

    if (m && method === "DELETE") {
      var deletingId = Number(m[1]);
      var sessionIndex = db.sessions.findIndex(function (session) {
        return session.session_id === deletingId;
      });
      if (sessionIndex < 0) throw new Error("Session not found");
      var removedSession = db.sessions.splice(sessionIndex, 1)[0];
      db.requirements = db.requirements.filter(function (requirement) {
        return requirement.session_id !== removedSession.session_id;
      });
      return { status: "deleted" };
    }

    m = path.match(/^\/sessions\/(\d+)\/discovery$/);
    if (m && method === "GET") {
      var discoverySession = db.sessions.find(function (session) {
        return session.session_id === Number(m[1]);
      });
      if (!discoverySession) throw new Error("Session not found");
      return {
        answers: discoverySession.discovery || [],
        discovery_required: discoverySession.discovery_required !== false,
      };
    }

    if (m && method === "POST") {
      var editableDiscoverySession = ensureActiveSession(m[1]);
      if (editableDiscoverySession.discovery_required === false) {
        throw new Error("Discovery answers are inherited from the project's first session.");
      }
      db.sessions.filter(function (session) {
        return session.project_id === editableDiscoverySession.project_id;
      }).forEach(function (session) {
        session.discovery = body.answers.map(function (answer) {
          return Object.assign({}, answer);
        });
      });
      return { status: "saved", count: body.answers.length };
    }

    m = path.match(/^\/sessions\/(\d+)\/complete$/);
    if (m && method === "POST") {
      var completedSession = db.sessions.find(function (x) {
        return x.session_id === Number(m[1]);
      });
      if (!completedSession) throw new Error("Session not found");
      if (!completedSession.ended_at) completedSession.ended_at = new Date().toISOString();
      completedSession.status = "completed";
      return {
        session_id: completedSession.session_id,
        status: completedSession.status,
        ended_at: completedSession.ended_at,
      };
    }

    m = path.match(/^\/sessions\/(\d+)\/report$/);
    if (m) {
      var sess = db.sessions.find(function (x) {
        return x.session_id === Number(m[1]);
      });
      return {
        session_id: sess.session_id,
        project_id: sess.project_id,
        project_name: db.projects.find(function (project) { return project.project_id === sess.project_id; }).project_name,
        client_name: db.projects.find(function (project) { return project.project_id === sess.project_id; }).client_name || null,
        session_name: sess.session_name,
        started_at: sess.started_at || null,
        ended_at: sess.ended_at || null,
        status: sess.status || (sess.ended_at ? "completed" : "active"),
        discovery: sess.discovery,
        requirements: db.requirements.filter(function (r) {
          return r.session_id === sess.session_id && r.translated_text;
        }),
      };
    }

    if (path === "/requirements/analyze") {
      ensureActiveSession(body.session_id);
      var hits = rules.filter(function (r) {
        return r.match.test(body.text);
      });
      var req = {
        requirement_id: db.nextReq++,
        session_id: body.session_id,
        original_text: body.text,
        translated_text: null,
        status: "pending",
        category: hits[0] ? hits[0].category : "functional",
        req_type: hits[0] ? hits[0].req_type : "Functional",
        confidence_score: null,
        ambiguities: [],
        _rules: hits,
      };
      db.requirements.push(req);
      return {
        requirement_id: req.requirement_id,
        ambiguities: hits.map(function (h, i) {
          return {
            ambiguity_id: req.requirement_id * 100 + i,
            term: h.term,
            category: h.category,
            question: h.question,
            options: h.options,
            suggested_answer: "",
          };
        }),
      };
    }

    if (path === "/requirements/translate") {
      var r2 = findReq(body.requirement_id);
      ensureRequirementSessionActive(r2);
      var clarified = body.answers
        .map(function (a) {
          return a.answer;
        })
        .filter(Boolean);
      var base = r2.original_text.trim().replace(/[.\s]+$/, "");
      r2.translated_text =
        base.charAt(0).toUpperCase() +
        base.slice(1) +
        "." +
        (clarified.length ? " Specifically: " + clarified.join("; ") + "." : "");
      r2.status = "translated";
      r2.confidence_score = clarified.length ? 0.92 : 0.78;
      r2.ambiguities = r2._rules.map(function (h, i) {
        return {
          term: h.term,
          question: h.question,
          answer: body.answers[i] ? body.answers[i].answer : "",
        };
      });
      return { translated_text: r2.translated_text };
    }

    m = path.match(/^\/requirements\/(\d+)\/approve$/);
    if (m) {
      var approveReq = findReq(m[1]);
      ensureRequirementSessionActive(approveReq);
      approveReq.status = "approved";
      return { ok: true };
    }

    m = path.match(/^\/requirements\/(\d+)\/edit$/);
    if (m) {
      var editReq = findReq(m[1]);
      ensureRequirementSessionActive(editReq);
      editReq.translated_text = body.translated_text;
      return { ok: true };
    }

    throw new Error("Preview mode has no fake data for " + method + " " + path);
  }

  async function blob() {
    await delay();
    return new Blob(["Preview mode: no real report is generated."], { type: "text/plain" });
  }

  window.ClearReqPreview = {
    enabled: enabled,
    user: { email: "preview@clearreq.dev", user_metadata: { name: "Preview User" } },
    request: request,
    blob: blob,
  };
})();
