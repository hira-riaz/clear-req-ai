# ClearReq System UI Design System & Component Guidelines

Use this specification to build, refactor, and maintain all frontend user interfaces for the **ClearReq** application. Every view, card, input fields, layout, and button must strictly adhere to these visual anchors and token patterns to maintain structural and aesthetic consistency across the application.

---

## 1. Visual Design Tokens & Core Theme

### Color Palette
* **Primary / Accent Color:** `#5D5CFF` (Vibrant Indigo/Purple). Used for primary buttons, active step tags, active wizard statuses, and focus highlights.
* **Primary Hover Color:** `#4B4AE0`
* **Success / Secondary Green:** `#10B981` (Vivid Mint Green). Used for active target filters (e.g., 'Internal staff').
* **Background Color:** `#F8F9FC` (Ultra-light grayish-blue slate). Applied to the main dashboard background framework.
* **Card & Workspace Background:** `#FFFFFF` (Pure white). Used to break up sections, forms, and sidebars over the slate backdrop.
* **Border Color:** `#E2E8F0` or `#F1F5F9` (Soft gray). Applied to inactive selectors, inputs, and layout dividers.
* **Text - Primary Titles:** `#1E293B` (Slate 800)
* **Text - Secondary / Body:** `#64748B` (Slate 500)
* **Text - Light / Placeholder:** `#94A3B8` (Slate 400)

### Typography
* **Font Family:** Inter, System-UI, sans-serif (Clean, modern geometric sans).
* **Headings (Titles):** Semi-bold to Bold (`font-weight: 600` or `700`).
* **Body / Labels:** Regular to Medium (`font-weight: 400` or `500`).

---

## 2. Layout Structure & Core Layouts

### A. Main Workspace Layout (Two-Column Sidebar View)
* **Sidebar Panel (Left Column):**
  * **Width:** Fixed width between `260px` and `300px`.
  * **Background:** `#FFFFFF` with a subtle right-border separator (`1px solid #E2E8F0`).
  * **Padding:** `24px` internal padding (`p-6`).
  * **Contents:** App branding (`CR ClearReq`), full-width action button (`+ New session`), full-width search input, and a vertical list of scrollable session selector cards.
  * **Footer Profile Section:** Fixed at the bottom of the sidebar displaying the active user's avatar, email address (`hira67392@gmail.com`), and an explicit logout icon button.
* **Main Context Window (Right Column):**
  * **Background:** `#F8F9FC`
  * **Padding:** Large canvas layout padding (`32px` to `48px` / `p-8` to `p-12`).
  * **Structure:** Top header showcasing active session name, progress wizard indicator, and a centrally floating structural content card container.

### B. Centered Gateway Layout (Authentication Gate)
* **Canvas Layout:** Full viewport grid or flex framework centering the content box precisely horizontally and vertically (`min-h-screen flex items-center justify-center`).
* **Background:** `#F8F9FC`
* **Card Container:** Floating panel with a width constraint maxing out at `440px` to `480px`. Includes rounded corners (`rounded-2xl` / `16px`), explicit white fill (`#FFFFFF`), a soft background shadow structure, and an uniform inward padding of `40px` (`p-10`).

---

## 3. UI Component Specifications

### A. Buttons & Actions
1. **Primary Button (`+ New session` / `Sign In`):**
   * **Background:** `#5D5CFF`
   * **Text:** `#FFFFFF`, medium weight, centered.
   * **Padding:** Vertical `12px` to `14px`, Horizontal `24px`. Full-width inside container contexts.
   * **Border Radius:** Fully pill-shaped or standardized rounding (`rounded-xl` to `rounded-full`).
2. **Text / Navigation Links (`No account? Create one`):**
   * **Color:** `#64748B` with transition states shifting to primary accents upon interactions. Clean typography without harsh lines unless hovered.

### B. Forms & Input Fields
* **Text Fields (Email / Password / Session name):**
  * **Label:** Displayed directly above the field container in dark slate color text, medium weight, small sizing (`text-sm font-medium mb-2`).
  * **Background:** `#EFF4FA` (Soft blue-gray hue fill) or `#FFFFFF` paired with clean micro-borders.
  * **Padding:** `12px` to `16px` internally.
  * **Border Radius:** Modern softened styling (`rounded-xl` or `8px` to `12px`).
  * **Borders:** Zero border or explicit minimal soft grey border lines. Fully seamless with minimal visual clutter.

### C. Multi-Select Pills & Choice Tags
* **Base Layout:** Horizontal inline gap lists or wrapped flex containers (`flex flex-wrap gap-2`).
* **Inactive Pill State:**
  * **Background:** `#F1F5F9` or clear `#FFFFFF` layout with an explicit light border boundary.
  * **Text Color:** `#64748B`
  * **Border Radius:** Pill shape design (`rounded-full` or `rounded-lg`).
  * **Padding:** Vertical `8px`, Horizontal `16px`.
* **Active Pill State (Single or Multiple selection highlights):**
  * **Primary Selection Highlight:** Changes background color entirely to `#5D5CFF` with pure white text (`#FFFFFF`).
  * **Success Context Highlight (e.g. Users/Targets):** Changes background color entirely to `#10B981` with pure white text (`#FFFFFF`).

### D. Step-by-Step Wizard Process Header
* **Layout:** Centered full-width framework connecting numbers step-by-step (`1 Discovery`, `2 Detect`, `3 Clarify`, `4 Report`).
* **Active Steps:** Pill container wrap utilizing `#5D5CFF` background color fill paired with clean high-contrast textual fields.
* **Inactive Step Tags:** Dimmed, plain text representation using light grey layouts to guide users along pipelines without distraction.

---

## 4. Layout Padding, Spacing & Constraints Summary
* **Grid Spacing System:** Strict multiples of 4px / 8px framework.
* **Form Field Row Gaps:** `24px` (`space-y-6` or `mb-6`).
* **Section Group Gaps:** `32px` (`mb-8`).
* **Component Corner Rounding:** Use `12px` (`rounded-xl`) for input fields, and `16px` (`rounded-2xl`) for modal cards and floating application containers.