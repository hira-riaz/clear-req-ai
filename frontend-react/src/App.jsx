import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

let supabaseClientPromise;

function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = fetch("/public-config").then(async (response) => {
      if (!response.ok) {
        throw new Error("Authentication is not configured. Please try again later.");
      }
      const { supabase_url, supabase_anon_key } = await response.json();
      return createClient(supabase_url, supabase_anon_key);
    });
  }
  return supabaseClientPromise;
}

const features = [
  {
    number: "01",
    title: "Spot the unclear",
    description:
      "Find vague language and hidden assumptions before they become costly rework.",
  },
  {
    number: "02",
    title: "Ask better questions",
    description:
      "Guide stakeholders through focused clarifications, one decision at a time.",
  },
  {
    number: "03",
    title: "Write with confidence",
    description:
      "Review and export precise requirements your team can build from.",
  },
];

const discoveryQuestions = [
  {
    question: "What platform(s) should this system run on?",
    options: ["Web", "Mobile app", "Desktop", "Multiple platforms"],
  },
  {
    question: "Who are the primary users of this system?",
    options: [
      "General public",
      "Internal staff/employees",
      "Business customers",
      "Mixed / multiple user types",
    ],
  },
  {
    question: "Is this replacing an existing system?",
    options: [
      "Yes, replacing an existing system",
      "No, built from scratch",
      "Not sure yet",
    ],
  },
  {
    question: "Will the system handle sensitive data?",
    options: [
      "Yes, payment data",
      "Yes, personal/health data",
      "No sensitive data expected",
      "Not sure yet",
    ],
  },
  {
    question: "What scale of usage is expected?",
    options: [
      "Small (under 100 users)",
      "Medium (100–10,000 users)",
      "Large (10,000+ users)",
      "Not sure yet",
    ],
  },
  {
    question: "Are there fixed constraints on this project?",
    options: ["Fixed deadline", "Fixed budget", "Both", "No fixed constraints"],
  },
];

const controlClass =
  "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-brand/40 hover:bg-brand/5";

function Brand() {
  return (
    <a className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-800" href="#home">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">
        CR
      </span>
      <span>
        ClearReq <span className="text-brand">AI</span>
      </span>
    </a>
  );
}

function RequirementPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-5 rounded-[2rem] bg-brand/5 blur-2xl" />
      <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold tracking-widest text-slate-500">
              PROJECT DISCOVERY
            </span>
          </div>
          <span className="text-xs font-medium text-slate-400">01 / 04</span>
        </div>

        <p className="mb-2 mt-7 text-xs font-semibold tracking-wide text-slate-400">
          LET&apos;S GET SPECIFIC
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
          “The app should be fast.”
        </h2>
        <p className="mb-4 mt-7 text-sm font-medium text-slate-600">
          What does fast mean for your users?
        </p>

        <div className="space-y-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3.5 text-sm font-medium text-slate-700">
            <span className="grid size-4 place-items-center rounded-full border-[5px] border-brand" />
            Pages load in under 2 seconds
            <span className="ml-auto text-brand" aria-label="Selected">
              ✓
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-sm text-slate-500">
            <span className="size-4 rounded-full border border-slate-300" />
            Search results appear instantly
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-sm text-slate-500">
            <span className="size-4 rounded-full border border-slate-300" />
            Something else
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>Small questions. Clear answers.</span>
          <span aria-hidden="true" className="text-base text-brand">
            ✦
          </span>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ supabase, configError, onHome, onAuthenticated }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          onAuthenticated(data.session);
        } else {
          setNotice({
            type: "success",
            message: "Account created. Check your email to confirm your account, then sign in.",
          });
          setMode("login");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onAuthenticated(data.session);
      }
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-10">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "signup"
                ? "Start turning ideas into clear requirements."
                : "Sign in to continue to ClearReq AI."}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {["login", "signup"].map((tab) => (
              <button
                aria-pressed={mode === tab}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  mode === tab
                    ? "bg-white text-brand shadow-sm"
                    : "bg-transparent text-slate-500 hover:text-slate-700"
                }`}
                key={tab}
                onClick={() => {
                  setMode(tab);
                  setNotice(null);
                }}
                type="button"
              >
                {tab === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="block text-sm font-medium text-slate-700">
                Your name
                <input
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Smith"
                  required
                  value={name}
                />
              </label>
            )}
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </label>
            {(configError || notice) && (
              <p
                aria-live="polite"
                className={`rounded-xl px-4 py-3 text-sm ${
                  configError || notice?.type === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
                role={configError || notice?.type === "error" ? "alert" : "status"}
              >
                {configError || notice?.message}
              </p>
            )}
            <button
              className="w-full rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(configError) || submitting || !supabase}
              type="submit"
            >
              {submitting ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            By continuing, you agree to use ClearReq AI responsibly for your projects.
          </p>
        </section>
        <button
          className="mx-auto mt-6 block border-0 bg-transparent p-2 text-sm text-slate-500 transition hover:text-brand"
          onClick={onHome}
          type="button"
        >
          ← Back to home
        </button>
      </div>
    </main>
  );
}

async function authorizedRequest(accessToken, path, options = {}) {
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = Array.isArray(body?.detail)
      ? body.detail.map((item) => item.msg).join("; ")
      : body?.detail;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json();
}

async function authorizedBlob(accessToken, path) {
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }
  return response.blob();
}

function Workspace({ session, user, onSignOut }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workflow, setWorkflow] = useState("dashboard");
  const [discoveryIndex, setDiscoveryIndex] = useState(0);
  const [discoveryAnswers, setDiscoveryAnswers] = useState([]);
  const [requirementText, setRequirementText] = useState("");
  const requirementIdRef = useRef(null);
  const [ambiguities, setAmbiguities] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [report, setReport] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [notice, setNotice] = useState("");

  function clearError() {
    setError("");
    setNotice("");
  }

  function apiRequest(path, options) {
    return authorizedRequest(session?.access_token, path, options);
  }

  async function loadSessions() {
    setLoading(true);
    try {
      const items = await apiRequest("/sessions");
      setSessions(items);
      setSelectedId((currentId) => currentId ?? items[0]?.session_id ?? null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, [session?.access_token]);

  async function createSession(event) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    setCreating(true);
    clearError();
    try {
      const result = await apiRequest("/sessions", {
        method: "POST",
        body: JSON.stringify({ project_name: name }),
      });
      setProjectName("");
      setSelectedId(result.session_id);
      setSessions((current) => [
        {
          session_id: result.session_id,
          project_name: result.project_name,
          requirement_count: 0,
          translated_count: 0,
        },
        ...current,
      ]);
      setDiscoveryAnswers([]);
      setDiscoveryIndex(0);
      setWorkflow("discovery");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  function startSession(sessionId, screen = "input") {
    setSelectedId(sessionId);
    setWorkflow(screen);
    setRequirementText("");
    requirementIdRef.current = null;
    setAmbiguities([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setReport(null);
    clearError();
  }

  async function saveDiscoveryAnswer(answer) {
    if (busy || !selectedId) return;
    setBusy(true);
    clearError();
    const question = discoveryQuestions[discoveryIndex];
    const nextAnswers = [
      ...discoveryAnswers,
      { question: question.question, answer },
    ];

    try {
      if (discoveryIndex === discoveryQuestions.length - 1) {
        await apiRequest(`/sessions/${selectedId}/discovery`, {
          method: "POST",
          body: JSON.stringify({ answers: nextAnswers }),
        });
        setDiscoveryAnswers(nextAnswers);
        setWorkflow("input");
      } else {
        setDiscoveryAnswers(nextAnswers);
        setDiscoveryIndex((index) => index + 1);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function analyzeRequirement(event) {
    event.preventDefault();
    if (!requirementText.trim() || !selectedId || busy) return;
    setBusy(true);
    clearError();
    setWorkflow("analyzing");
    try {
      const result = await apiRequest("/requirements/analyze", {
        method: "POST",
        body: JSON.stringify({
          session_id: selectedId,
          text: requirementText.trim(),
        }),
      });
      requirementIdRef.current = result.requirement_id;
      setAmbiguities(result.ambiguities || []);
      setCurrentQuestionIndex(0);
      setAnswers(
        Object.fromEntries(
          (result.ambiguities || []).map((item) => [
            item.ambiguity_id,
            item.suggested_answer || "",
          ]),
        ),
      );
      if (result.ambiguities?.length) {
        setWorkflow("clarify");
      } else {
        setWorkflow("processing");
        await translateRequirement(result.requirement_id, []);
      }
    } catch (requestError) {
      setError(requestError.message);
      setWorkflow("input");
    } finally {
      setBusy(false);
    }
  }

  async function advanceClarification(answer) {
    const currentAmbiguity = ambiguities[currentQuestionIndex];
    if (!currentAmbiguity || busy) return;

    const nextAnswers = {
      ...answers,
      [currentAmbiguity.ambiguity_id]: answer.trim(),
    };
    setAnswers(nextAnswers);
    clearError();

    if (currentQuestionIndex + 1 < ambiguities.length) {
      setCurrentQuestionIndex((index) => index + 1);
      return;
    }

    const clarificationAnswers = ambiguities
      .map((item) => ({
        ambiguity_id: item.ambiguity_id,
        answer: (nextAnswers[item.ambiguity_id] || "").trim(),
      }))
      .filter((item) => item.answer);
    if (!requirementIdRef.current) {
      setError("The analyzed requirement could not be identified. Please analyze it again.");
      setWorkflow("input");
      return;
    }
    setWorkflow("processing");
    await translateRequirement(requirementIdRef.current, clarificationAnswers);
  }

  async function translateRequirement(id = requirementIdRef.current, clarificationAnswers = null) {
    if (!id) {
      setError("The analyzed requirement could not be identified. Please analyze it again.");
      setWorkflow("input");
      return;
    }
    const submittedAnswers =
      clarificationAnswers ||
      ambiguities
        .map((item) => ({
          ambiguity_id: item.ambiguity_id,
          answer: (answers[item.ambiguity_id] || "").trim(),
        }))
        .filter((item) => item.answer);

    setBusy(true);
    clearError();
    try {
      const result = await apiRequest("/requirements/translate", {
        method: "POST",
        body: JSON.stringify({
          requirement_id: id,
          answers: submittedAnswers,
        }),
      });
      setRequirementText("");
      requirementIdRef.current = null;
      setAmbiguities([]);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setWorkflow("input");
      setNotice(`Requirement translated: ${result.translated_text}`);
      await loadSessions();
    } catch (requestError) {
      setError(requestError.message);
      setWorkflow(ambiguities.length ? "clarify" : "input");
    } finally {
      setBusy(false);
    }
  }

  async function loadReport() {
    if (!selectedId) return null;
    const data = await apiRequest(`/sessions/${selectedId}/report`);
    setReport(data);
    return data;
  }

  async function approveRequirement(id) {
    setBusy(true);
    clearError();
    try {
      await apiRequest(`/requirements/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: null }),
      });
      await loadReport();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id) {
    if (!editText.trim()) return;
    setBusy(true);
    clearError();
    try {
      await apiRequest(`/requirements/${id}/edit`, {
        method: "PATCH",
        body: JSON.stringify({ translated_text: editText.trim() }),
      });
      setEditingId(null);
      await loadReport();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function showReport() {
    setBusy(true);
    clearError();
    try {
      await loadReport();
      setWorkflow("report");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishSession() {
    setBusy(true);
    clearError();
    try {
      await loadReport();
      setWorkflow("report");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportReport() {
    if (!selectedId) return;
    setBusy(true);
    clearError();
    try {
      const blob = await authorizedBlob(
        session?.access_token,
        `/sessions/${selectedId}/report/docx`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const safeName = (report?.project_name || "requirements")
        .replace(/[^a-z0-9_-]/gi, "_")
        .slice(0, 60);
      anchor.download = `${safeName || "requirements"}_requirements.docx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function performSignOut() {
    try {
      await onSignOut();
    } catch (signOutError) {
      setError(signOutError.message);
    }
  }

  const filteredSessions = sessions.filter((item) =>
    item.project_name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selectedSession = sessions.find((item) => item.session_id === selectedId);
  const displayName = user.user_metadata?.name || user.email || "there";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-slate-800 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white p-5 md:h-screen md:w-72 md:overflow-hidden md:border-b-0 md:border-r md:p-6">
        <Brand />
        <button
          className="mt-8 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
          onClick={() => {
            setWorkflow("dashboard");
            clearError();
            setTimeout(() => document.getElementById("project-name")?.focus(), 0);
          }}
          type="button"
        >
          + New session
        </button>
        <label className="sr-only" htmlFor="session-search">Search sessions</label>
        <input
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          id="session-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sessions..."
          value={search}
        />
        <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Your projects
          </p>
          {loading && <p className="px-2 py-3 text-sm text-slate-400">Loading sessions...</p>}
          {!loading && filteredSessions.length === 0 && (
            <p className="px-2 py-3 text-sm leading-6 text-slate-400">
              {search ? "No sessions match your search." : "Your new projects will show up here."}
            </p>
          )}
          {filteredSessions.map((item) => (
            <button
              className={`w-full rounded-xl px-3 py-3 text-left transition ${
                selectedId === item.session_id
                  ? "bg-brand/10 text-brand"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              key={item.session_id}
              onClick={() => startSession(item.session_id, "dashboard")}
              type="button"
            >
              <span className="block truncate text-sm font-medium">{item.project_name}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {item.requirement_count} requirements
              </span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">{displayName}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <button
            className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={performSignOut}
            type="button"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <header className="mb-8">
            <div className="mb-5 flex flex-wrap gap-2">
              {["Discovery", "Analyze", "Clarify", "Review", "Report"].map((step, index) => {
                const stepName = ["discovery", "input", "clarify", "review", "report"][index];
                const active =
                  workflow === stepName ||
                  (workflow === "analyzing" && stepName === "input") ||
                  (workflow === "processing" && stepName === "clarify");
                return (
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      active
                        ? "bg-brand text-white"
                        : "bg-white text-slate-400"
                    }`}
                    key={step}
                  >
                    {index + 1}. {step}
                  </span>
                );
              })}
            </div>
            <p className="text-sm font-medium text-brand">
              {selectedSession?.project_name || "YOUR WORKSPACE"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-800">
              {workflow === "dashboard"
                ? `Welcome, ${displayName}`
                : {
                    discovery: "Project discovery",
                    input: "Add requirements",
                    analyzing: "Analyzing requirement",
                    clarify: "Clarify your requirement",
                    processing: "Processing requirement",
                    review: "Review requirements",
                    report: "Requirements report",
                  }[workflow]}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {workflow === "dashboard"
                ? "Start a project or continue gathering requirements."
                : selectedSession?.project_name || "Project workspace"}
            </p>
          </header>

          {error && (
            <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-medium">Saved successfully</p>
              <p className="mt-1">{notice}</p>
            </div>
          )}

          {workflow === "dashboard" && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Start a new session</h2>
              <p className="mt-1 text-sm text-slate-500">
                Give your project a name to begin organizing its requirements.
              </p>
            </div>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createSession}>
              <label className="sr-only" htmlFor="project-name">Project name</label>
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                id="project-name"
                maxLength={120}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Hospital Management System"
                required
                value={projectName}
              />
              <button
                className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
                disabled={creating}
                type="submit"
              >
                {creating ? "Starting..." : "Start session"}
              </button>
            </form>
          </section>}

          {workflow === "dashboard" && selectedSession && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Selected project
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-800">
                    {selectedSession.project_name}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  Session ready
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-canvas p-4">
                  <p className="text-2xl font-semibold text-slate-800">
                    {selectedSession.requirement_count}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Requirements</p>
                </div>
                <div className="rounded-xl bg-canvas p-4">
                  <p className="text-2xl font-semibold text-slate-800">
                    {selectedSession.translated_count}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Reviewed</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-500">
                Continue adding requirements or view the current report.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover"
                  onClick={() => startSession(selectedId, "input")}
                  type="button"
                >
                  Continue session
                </button>
                <button
                  className={controlClass}
                  onClick={showReport}
                  type="button"
                >
                  View report
                </button>
              </div>
            </section>
          )}

          {workflow === "discovery" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm text-slate-500">
                Question {discoveryIndex + 1} of {discoveryQuestions.length}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-800">
                {discoveryQuestions[discoveryIndex].question}
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {discoveryQuestions[discoveryIndex].options.map((option) => (
                  <button
                    className={`${controlClass} text-left disabled:cursor-wait disabled:opacity-50`}
                    disabled={busy}
                    key={option}
                    onClick={() => saveDiscoveryAnswer(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-between">
                <button
                  className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 disabled:cursor-wait disabled:opacity-50"
                  disabled={busy}
                  onClick={() => saveDiscoveryAnswer(null)}
                  type="button"
                >
                  Skip this question
                </button>
              </div>
            </section>
          )}

          {workflow === "input" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <form onSubmit={analyzeRequirement}>
                <label className="block text-sm font-medium text-slate-700" htmlFor="requirement-text">
                  Requirement
                </label>
                <textarea
                  className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                  id="requirement-text"
                  maxLength={2000}
                  onChange={(event) => setRequirementText(event.target.value)}
                  placeholder="For example: The system should let customers quickly find available appointments."
                  required
                  value={requirementText}
                />
                <div className="mt-4 flex flex-wrap justify-between gap-3">
                  <button
                    className={controlClass}
                    disabled={busy}
                    onClick={finishSession}
                    type="button"
                  >
                    Finish &amp; generate report
                  </button>
                  <button
                    className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                    disabled={busy || !requirementText.trim()}
                    type="submit"
                  >
                    {busy ? "Analyzing..." : "Analyze requirement"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {workflow === "analyzing" && (
            <section
              aria-live="polite"
              className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm"
              role="status"
            >
              <span className="mx-auto block size-9 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
              <h2 className="mt-5 text-lg font-semibold text-slate-800">Analyzing your requirement</h2>
              <p className="mt-2 text-sm text-slate-500">
                Checking for ambiguity and preparing clarification questions...
              </p>
            </section>
          )}

          {workflow === "clarify" && ambiguities[currentQuestionIndex] && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original requirement</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{requirementText}</p>
              </div>
              {(() => {
                const item = ambiguities[currentQuestionIndex];
                return (
                  <article
                    aria-live="polite"
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
                    key={item.ambiguity_id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Question {currentQuestionIndex + 1} of {ambiguities.length}
                      </p>
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium capitalize text-brand">
                        {item.category}
                      </span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-800">{item.term}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.question}</p>
                    {item.options?.length > 0 && (
                      <div className="mt-5 grid gap-2.5">
                        {item.options.map((option) => (
                          <button
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600 transition hover:border-brand hover:bg-brand/5 hover:text-brand disabled:opacity-50"
                            disabled={busy}
                            key={option}
                            onClick={() => advanceClarification(option)}
                            type="button"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                    <label className="mt-5 block text-sm font-medium text-slate-700">
                      Or enter a different answer
                      <input
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [item.ambiguity_id]: event.target.value,
                          }))
                        }
                        placeholder="Type your clarification"
                        value={answers[item.ambiguity_id] || ""}
                      />
                    </label>
                    <div className="mt-6 flex flex-wrap justify-between gap-3">
                      <button
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => advanceClarification("")}
                        type="button"
                      >
                        Skip question
                      </button>
                      <button
                        className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                        disabled={busy || !answers[item.ambiguity_id]?.trim()}
                        onClick={() => advanceClarification(answers[item.ambiguity_id])}
                        type="button"
                      >
                        {currentQuestionIndex === ambiguities.length - 1
                          ? "Use answer & translate"
                          : "Use answer & continue"}
                      </button>
                    </div>
                  </article>
                );
              })()}
            </section>
          )}

          {workflow === "processing" && (
            <section
              aria-live="polite"
              className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm"
              role="status"
            >
              <span className="mx-auto block size-9 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
              <h2 className="mt-5 text-lg font-semibold text-slate-800">Processing requirement</h2>
              <p className="mt-2 text-sm text-slate-500">
                Saving your clarifications and translating this requirement...
              </p>
            </section>
          )}

          {workflow === "review" && (
            <section className="space-y-4">
              {!report?.requirements?.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                  No requirements yet. Add and analyze a requirement before generating the report.
                </div>
              )}
              {report?.requirements?.map((item) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  key={item.requirement_id}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.original_text}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Translated</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-600">{item.status}</span>
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs capitalize text-brand">{item.category}</span>
                    {typeof item.confidence_score === "number" && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                        {Math.round(item.confidence_score * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {editingId === item.requirement_id ? (
                    <>
                      <textarea
                        className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                        onChange={(event) => setEditText(event.target.value)}
                        value={editText}
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button className={controlClass} onClick={() => setEditingId(null)} type="button">Cancel</button>
                        <button
                          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
                          onClick={() => saveEdit(item.requirement_id)}
                          type="button"
                        >
                          Save edit
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {item.translated_text || "No translation available."}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.translated_text && editingId !== item.requirement_id && (
                      <button
                        className={controlClass}
                        onClick={() => {
                          setEditingId(item.requirement_id);
                          setEditText(item.translated_text);
                        }}
                        type="button"
                      >
                        Edit translation
                      </button>
                    )}
                    {item.translated_text && item.status !== "approved" && (
                      <button
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        disabled={busy}
                        onClick={() => approveRequirement(item.requirement_id)}
                        type="button"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </article>
              ))}
              <div className="flex justify-between gap-3">
                <button className={controlClass} onClick={() => setWorkflow("input")} type="button">
                  Add another requirement
                </button>
                <button
                  className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                  disabled={busy || !report?.requirements?.length}
                  onClick={showReport}
                  type="button"
                >
                  Generate report
                </button>
              </div>
            </section>
          )}

          {workflow === "report" && report && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="border-b border-slate-100 pb-5">
                <p className="text-sm font-medium text-brand">FINAL REPORT</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-800">
                  {report.project_name} — Requirements
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {report.requirements.length} requirement{report.requirements.length === 1 ? "" : "s"}
                </p>
              </div>
              <section className="mt-6">
                <h3 className="text-base font-semibold text-slate-800">Project Discovery</h3>
                {report.discovery?.length ? (
                  <dl className="mt-3 space-y-3">
                    {report.discovery.map((item, index) => (
                      <div
                        className="rounded-xl bg-canvas px-4 py-3"
                        key={`${item.question}-${index}`}
                      >
                        <dt className="text-sm font-medium text-slate-700">{item.question}</dt>
                        <dd className="mt-1 text-sm text-slate-500">
                          {item.answer || "Skipped"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">(none provided)</p>
                )}
              </section>
              {["Functional", "Non-Functional"].map((type) => {
                const items = report.requirements.filter((item) => item.req_type === type);
                return (
                  <section className="mt-6" key={type}>
                    <h3 className="text-base font-semibold text-slate-800">{type} Requirements</h3>
                    {items.length ? (
                      <ol className="mt-3 list-decimal space-y-3 pl-5">
                        {items.map((item) => (
                          <li className="pl-1 text-sm leading-6 text-slate-700" key={item.requirement_id}>
                            <p>{item.translated_text || "No translation available."}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                              <span className="capitalize">{item.status}</span>
                              <span>·</span>
                              <span className="capitalize">{item.category}</span>
                              {typeof item.confidence_score === "number" && (
                                <>
                                  <span>·</span>
                                  <span>{Math.round(item.confidence_score * 100)}% confidence</span>
                                </>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                              Original: {item.original_text}
                            </p>
                            {item.ambiguities?.length > 0 && (
                              <ul className="mt-3 space-y-2 rounded-xl bg-canvas p-3 text-xs leading-5 text-slate-500">
                                {item.ambiguities.map((ambiguity, index) => (
                                  <li key={`${item.requirement_id}-${index}`}>
                                    <span className="font-medium text-slate-700">
                                      {ambiguity.question || ambiguity.term}
                                    </span>
                                    <span className="block">
                                      {ambiguity.answer
                                        ? `Clarified: ${ambiguity.answer}`
                                        : "Skipped"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">(none)</p>
                    )}
                  </section>
                );
              })}
              <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
                <div className="flex flex-wrap gap-3">
                  <button className={controlClass} onClick={() => setWorkflow("review")} type="button">
                    Review &amp; approve
                  </button>
                  <button className={controlClass} onClick={() => setWorkflow("input")} type="button">
                    Add another requirement
                  </button>
                </div>
                <button
                  className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                  disabled={busy}
                  onClick={exportReport}
                  type="button"
                >
                  {busy ? "Preparing..." : "Export Word document"}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [authPage, setAuthPage] = useState(
    () => window.location.hash === "#auth" || window.location.hash === "#workspace",
  );
  const [supabase, setSupabase] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [user, setUser] = useState(null);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    let active = true;
    let subscription;
    getSupabaseClient()
      .then(async (client) => {
        if (!active) return;
        setSupabase(client);
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          setAuthSession(session);
          setUser(session?.user ?? null);
          if (session?.user) window.location.hash = "workspace";
        });
        subscription = data.subscription;
        const {
          data: { session },
          error,
        } = await client.auth.getSession();
        if (error) throw error;
        if (active && session?.user) {
          setAuthSession(session);
          setUser(session.user);
          window.location.hash = "workspace";
        }
      })
      .catch((error) => {
        if (active) setConfigError(error.message);
      });

    function syncPage() {
      setAuthPage(
        window.location.hash === "#auth" || window.location.hash === "#workspace",
      );
    }
    window.addEventListener("hashchange", syncPage);
    return () => {
      active = false;
      subscription?.unsubscribe();
      window.removeEventListener("hashchange", syncPage);
    };
  }, []);

  function goHome() {
    window.location.hash = "home";
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAuthSession(null);
    setUser(null);
    goHome();
  }

  function finishSignIn(signedInSession) {
    setAuthSession(signedInSession);
    setUser(signedInSession.user);
    window.location.hash = "workspace";
  }

  if (user && supabase && authSession) {
    return <Workspace onSignOut={signOut} session={authSession} user={user} />;
  }
  if (authPage) {
    return (
      <AuthPage
        configError={configError}
        onAuthenticated={finishSignIn}
        onHome={goHome}
        supabase={supabase}
      />
    );
  }

  return (
    <div id="home" className="min-h-screen bg-canvas text-slate-800">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Brand />
        <a
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
          href="#auth"
        >
          Get started
        </a>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-2 lg:gap-20 lg:px-12 lg:pb-28 lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white px-3.5 py-2 text-[11px] font-semibold tracking-wider text-brand">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              BETTER REQUIREMENTS, BUILT TOGETHER
            </p>
            <h1 className="max-w-2xl font-display text-5xl font-bold leading-[1.08] tracking-tight text-slate-800 sm:text-6xl lg:text-7xl">
              Turn vague ideas into{" "}
              <span className="text-brand">clear requirements.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
              Uncover ambiguity, ask the right questions, and create
              development-ready requirements your whole team understands.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                className="inline-flex items-center gap-3 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand-hover"
                href="#auth"
              >
                Get started <span aria-hidden="true">→</span>
              </a>
              <span className="text-sm text-slate-400">
                A clearer start for every project.
              </span>
            </div>
          </div>
          <RequirementPreview />
        </section>

        <section
          id="how-it-works"
          className="border-t border-slate-200/80 bg-white"
        >
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-xs font-semibold tracking-[0.16em] text-brand">
                FROM FIRST THOUGHT TO SHARED UNDERSTANDING
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
                Less guesswork. More alignment.
              </h2>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {features.map((feature) => (
                <article
                  className="rounded-2xl border border-slate-100 bg-canvas p-6 sm:p-7"
                  key={feature.number}
                >
                  <span className="text-sm font-semibold text-brand">
                    {feature.number}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-800">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand />
        <span>Make the important details clear.</span>
      </footer>
    </div>
  );
}

export default App;
