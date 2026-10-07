# UI context — ClearReq AI

## Current frontend

The current React + Vite + Tailwind frontend lives in `frontend-react/` and
follows `Ui-Design-system.md`. It includes Supabase authentication, session
discovery, requirement analysis and clarification, review, and report export.
FastAPI serves its production build from `frontend-react/dist/`. The earlier
plain HTML/JS frontend has been removed.

## Current user flow
1. **Landing and authentication** — sign up or sign in with Supabase Auth.
2. **Workspace** — list/create sessions and select or continue a project.
3. **Project discovery** — answer or skip the six project-context questions.
4. **Requirement analysis** — submit informal requirement text to the backend.
5. **Clarification** — answer detected ambiguity questions, then translate.
6. **Review** — inspect, edit, and approve translated requirements.
7. **Report** — view functional and non-functional requirements and export
   the backend-generated Word document.

## Visual style

Follow `Ui-Design-system.md` for colors, typography, spacing, and components.

## Interaction rules
- Prefer structured input (buttons/select) wherever it fits; clarification
  answers can also be entered as free text.
- Show loading labels and disable the active action while a request is in
  flight.
- Surface API and authentication failures inline; never treat failed requests
  as successful workflow steps.

## Data contract with the backend
The React app calls `/public-config`, `/sessions`, session discovery/report
routes, and the `/requirements/*` analysis, translation, edit, and approval
routes implemented in `backend/app/main.py`. Keep request/response handling in
sync with those route schemas when changing the backend.
