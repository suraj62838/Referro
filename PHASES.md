# Build plan — phases and agent prompts

Read `README.md` first (always — every prompt below assumes it's in context).
Do the phases in order; each one assumes the previous phases are done and
working. Copy a phase's prompt as-is to your coding agent, one phase per
session/PR.

---

## Phase 0 — Project scaffolding

**Goal:** empty but runnable Django + DRF backend and React frontend, wired
together, with README.md as the source of truth for structure.

> Read README.md in this repo. Scaffold a new project matching section 1
> (stack) and section 3 (data model) of that file:
> - Django project with a DRF API app, PostgreSQL configured via
>   `DATABASE_URL`, JWT auth via djangorestframework-simplejwt with
>   `IsAuthenticated` as the default permission class.
> - Celery + Celery Beat configured against `REDIS_URL`, with an empty task
>   module ready for later phases.
> - A React app (Vite) with a basic router and an auth-checking route guard
>   (redirect to `/login` if no valid JWT) — no real screens yet, just the
>   guard and empty placeholder routes for `/dashboard`, `/board`,
>   `/apply`, `/post`.
> - `.env.example` listing every variable in README.md section 7.
> - Do not implement any models or endpoints yet beyond a health-check route.
> Confirm the backend and frontend both run locally before finishing.

---

## Phase 1 — Auth

**Goal:** working signup/login/JWT refresh, enforced on both ends.

> Read README.md, especially sections 2 and 4. Implement:
> - `POST /api/auth/signup/`, `/login/`, `/refresh/` per the API surface in
>   section 4.
> - Password validation, email uniqueness, standard Django auth User model
>   (no custom user model needed unless you have a strong reason — note it
>   in README.md section 3 if you add one).
> - Frontend: signup/login forms, JWT stored appropriately (not localStorage
>   in a way that breaks on refresh — use httpOnly cookie or a documented
>   in-memory + refresh-token strategy), route guard now actually blocking
>   unauthenticated access to every other route.
> Write a short test hitting signup → login → an authenticated-only endpoint
> without a token (expect 401) → with a token (expect 200).

---

## Phase 2 — Core CRUD models

**Goal:** `JobPosting` and `JobApplication` fully working as plain CRUD, no
AI or email yet.

> Read README.md section 3 (data model) and section 4 (API surface). Build
> the `JobPosting` and `JobApplication` Django models exactly as specified,
> plus `EmailLog` and `ReplyLog` (empty of logic for now, just the schema).
> Implement full CRUD DRF viewsets for `JobPosting` and `JobApplication`
> scoped to `request.user` where the model says `user`/`posted_by`. Add
> migrations. On the frontend, build the Dashboard (list of the user's
> applications) and the Job board (list of postings) as real API-backed
> screens, replacing the placeholder routes from Phase 0. Match the visual
> design in `App.jsx` (Fraunces + Karla, ink/paper/rust palette) — reuse its
> component structure rather than redesigning.

---

## Phase 3 — JD extraction (paste + upload) and email detection

**Goal:** `POST /api/job-applications/extract/` works for both text and file
input, with regex email detection.

> Read README.md section 5, step 2–3. Implement
> `POST /api/job-applications/extract/`:
> - Accepts either a raw text field or a multipart file upload (PDF, DOCX,
>   or image).
> - For files: extract text (PDF/DOCX parser for documents, OCR for images).
> - Run the same regex-based email extractor on the resulting text either
>   way (shared function, not duplicated per source).
> - Response: `{ jd_text, recruiter_email }` (empty string for
>   recruiter_email if none found — never fabricate one).
> On the frontend, build the "New application" screen with the two source
> tabs (Paste text / Upload file) as shown in `App.jsx`'s `ApplyFlow` and
> `SourceTabs` components — wire them to this real endpoint instead of the
> mocked `setTimeout`/`MOCK_JD_FROM_FILE` behavior.

---

## Phase 4 — AI drafting service (shared) + JD generation + email drafting

**Goal:** one shared AI service used for both JD generation and email
drafting, both returning editable drafts, nothing auto-saved or auto-sent.

> Read README.md sections 2 and 6. Build `services/ai_writer.py` as a single
> shared module with a generic `generate(prompt, context)` function backing
> the LLM API call (see README.md section 7 for which provider/key to use).
> Implement on top of it:
> - `POST /api/job-postings/generate-jd/` — structured fields in (role
>   title, seniority, key skills, notes) → JD text out, not persisted.
> - `POST /api/job-applications/{id}/draft-email/` — JD text + user profile
>   in → `{ subject, body }` out, not persisted.
> Frontend: wire the "Write with AI" toggle on Post a job (see `PostJob` in
> `App.jsx`) and the "Draft email with AI" button on the apply flow to these
> real endpoints, replacing their mocked equivalents. Both must land in an
> editable textarea/review screen — do not auto-publish or auto-send from
> either endpoint.

---

## Phase 5 — Gmail/Outlook OAuth + sending

**Goal:** user connects their mailbox, and outreach emails send from it for
real.

> Read README.md sections 1 and 4 (EmailAccount, oauth endpoints,
> send-email endpoint). Implement:
> - OAuth connect/callback flow for Gmail (`gmail.send` + `gmail.readonly`
>   scopes) storing encrypted tokens on `EmailAccount`.
> - `POST /api/job-applications/{id}/send-email/` — sends the
>   subject/body from the review step via the Gmail API using the user's
>   connected account, creates an `EmailLog` row with the returned thread
>   id, sets `JobApplication.status = sent`.
> - Handle token refresh on expiry.
> - Frontend: a "connect your inbox" step (blocking send until connected),
>   and the review screen's send button now calls this real endpoint.
> Flag in your output if you're doing Gmail-only for this phase and
> deferring Outlook — that's fine, note it explicitly rather than silently
> only doing one.

---

## Phase 6 — Reply polling and status tracking

**Goal:** Celery Beat periodically checks sent threads for HR replies and
surfaces them.

> Read README.md section 5, step 7. Implement a Celery Beat task
> (`poll_replies`) that runs on a schedule, iterates `EmailLog` rows whose
> `JobApplication.status` is still `sent`, checks the corresponding Gmail
> thread for new messages, and for each new reply: creates a `ReplyLog`
> row and updates `JobApplication.status` to `replied`. Add a manual status
> field/UI action so the user can also set `interview` or `rejected`
> themselves (per the status enum in README.md section 3) — replies alone
> shouldn't be the only way status changes. Frontend: build the Application
> detail screen's timeline and reply display, matching
> `ApplicationDetail`/`TimelineRow` in `App.jsx`.

---

## Phase 7 — Polish and hardening

**Goal:** production-readiness pass.

> Read README.md in full. Go through every endpoint and confirm: proper
> permission scoping (a user can never read/edit another user's
> `JobApplication` or `EmailAccount`), rate limiting on `generate-jd`,
> `draft-email`, and `extract` (these hit the LLM/parse pipeline and are
> abuse-prone), and basic input validation everywhere (especially
> `recruiter_email` format, file upload size/type limits on `extract`).
> Add the self-application guard and posting rate-limit mentioned in the
> original design discussion (a user shouldn't be blocked from applying to
> their own posting technically, but consider whether to warn). Write
> integration tests for the two end-to-end flows in README.md sections 5
> and 6. Update README.md if anything in this phase changed the API surface
> or data model — keep it authoritative.

---

## How to use this file with an agent

- Paste the phase's blockquote prompt verbatim as your instruction.
- Always let the agent read `README.md` first — don't paste model/endpoint
  specs inline, the file is the single source of truth so it doesn't drift.
- After each phase, update README.md yourself (or ask the agent to) if
  reality diverged from the plan, before starting the next phase's prompt.
