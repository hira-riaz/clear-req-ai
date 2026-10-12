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
    nextSession: 3,
    nextReq: 1,
    sessions: [
      { session_id: 1, project_name: "Hospital Management System", discovery: [] },
      { session_id: 2, project_name: "Online Store", discovery: [] },
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

  function summary(s) {
    var mine = db.requirements.filter(function (r) {
      return r.session_id === s.session_id;
    });
    return {
      session_id: s.session_id,
      project_name: s.project_name,
      requirement_count: mine.length,
      translated_count: mine.filter(function (r) {
        return r.translated_text;
      }).length,
    };
  }

  async function request(path, options) {
    options = options || {};
    await delay();
    var method = (options.method || "GET").toUpperCase();
    var body = options.body ? JSON.parse(options.body) : {};
    var m;

    if (path === "/sessions" && method === "GET") return db.sessions.map(summary);

    if (path === "/sessions" && method === "POST") {
      var s = { session_id: db.nextSession++, project_name: body.project_name, discovery: [] };
      db.sessions.unshift(s);
      return { session_id: s.session_id, project_name: s.project_name };
    }

    m = path.match(/^\/sessions\/(\d+)\/discovery$/);
    if (m && method === "POST") {
      db.sessions.find(function (x) {
        return x.session_id === Number(m[1]);
      }).discovery = body.answers;
      return { ok: true };
    }

    m = path.match(/^\/sessions\/(\d+)\/report$/);
    if (m) {
      var sess = db.sessions.find(function (x) {
        return x.session_id === Number(m[1]);
      });
      return {
        project_name: sess.project_name,
        discovery: sess.discovery,
        requirements: db.requirements.filter(function (r) {
          return r.session_id === sess.session_id && r.translated_text;
        }),
      };
    }

    if (path === "/requirements/analyze") {
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
      findReq(m[1]).status = "approved";
      return { ok: true };
    }

    m = path.match(/^\/requirements\/(\d+)\/edit$/);
    if (m) {
      findReq(m[1]).translated_text = body.translated_text;
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
