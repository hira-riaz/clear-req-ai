# UI context — ClearReq AI

## Screens that exist (MVP scope — do not add more without discussion)
1. **Requirement input + analysis** — textarea, "Analyze" button.
2. **Ambiguity list + clarification** — one card per detected ambiguity,
   showing the term, category badge, detector source, the question, and an
   answer input. "Translate" button submits all answers at once.
3. **Translated result** — final text plus a confidence badge.

There is currently no login screen, no history/list view, and no settings
page — these are explicitly out of MVP scope (see project-overview.md).

## Visual style (already implemented in frontend/style.css)
- Background: warm off-white (`#f4f3ef`), card surface slightly lighter
  (`#fdfcf9`).
- Primary action color: navy (`#1f3864`) for buttons.
- Ambiguity category badges: light blue (`#e6f1fb` bg, `#0c447c` text).
- Confidence badge: light teal (`#e1f5ee` bg, `#04342c` text).
- Ambiguity/result cards: light gray fill (`#f1efe8`), no border, rounded
  8px corners.
- Font: system font stack, no custom web fonts (keeps it dependency-free).

## Interaction rules
- Prefer structured input (buttons/select) over free text wherever
  possible — see the enhanced blueprint's section on answer structure.
  The current MVP uses free-text inputs for simplicity; upgrading specific
  categories (e.g. security → multi-select) is good future work but should
  not block the MVP.
- Buttons show a loading label ("Analyzing...", "Translating...") and
  disable themselves while a request is in flight — follow this pattern for
  any new async action.
- Errors surface via `alert()` for now — acceptable for FYP scope, but if
  upgraded, use a non-blocking toast/banner instead.

## Data contract with the backend
Frontend code should only ever talk to the shapes returned by
`/requirements/analyze` and `/requirements/translate` as implemented in
`backend/app/main.py`. If the backend response shape changes, update
`architecture-context.md` in the same commit so both context files stay in
sync.
