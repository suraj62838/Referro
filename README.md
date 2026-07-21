# Referro — AI job outreach & tracking app

A web app where a user pastes or uploads a job description, gets an AI-drafted
outreach email with the recruiter's address auto-detected, sends it from their
own connected mailbox, and tracks replies — all under one account type that
can also post referral job listings (optionally AI-written).

This file is written so an AI coding agent can understand the whole system
without reading the codebase first. Keep it up to date as features land —
update the relevant section in the same PR/commit that changes behavior.

---

## 1. Stack

- **Backend:** Python, Django + Django REST Framework
- **Frontend:** React (single account type, JWT-authenticated SPA)
- **DB:** PostgreSQL
- **Async jobs:** Celery + Celery Beat, broker = Redis
- **Auth:** JWT (djangorestframework-simplejwt), `IsAuthenticated` is the
  default DRF permission class — nothing is reachable unauthenticated except
  `/api/auth/signup/` and `/api/auth/login/`
- **Email send/receive:** user's own Gmail or Outlook account via OAuth
  (`gmail.send` + `gmail.readonly` scopes, or Outlook Graph equivalent) —
  emails are sent from the user's real mailbox, not a shared app address, so
  that recruiter replies land in a thread we can poll
- **AI calls:** one shared backend service (`services/ai_writer.py`) utilizing
  the Groq Chat Completions API (`llama-3.1-8b-instant` model) used by both JD
  generation and email drafting — do not call the LLM API directly from views

## 2. Core design decisions (read before changing behavior)

- **One account type.** Any authenticated user can both apply to jobs and
  post a job. No separate "company" role.
- **Auth gate is absolute.** Every route except signup/login requires a valid
  JWT, both on the API (DRF permission) and the frontend (route guard).
- **Nothing sends automatically.** AI-drafted content (JD or outreach email)
  always lands in an editable review screen. The user explicitly clicks
  send/publish. Never auto-send from a generation endpoint.
- **JD text is the single source of truth.** Whether a JD comes from manual
  paste, file upload, or a job-board posting, it converges into one
  `jd_text` field before anything downstream (email detection, AI drafting)
  happens. Downstream logic never needs to know the source.
- **LinkedIn URL import was considered and dropped.** LinkedIn blocks most
  automated access to post content. Do not re-add a "paste LinkedIn link"
  feature without solving that constraint first.
- **Email detection is regex-based, not AI-based.** Cheap, synchronous, runs
  client-side on paste and server-side after file extraction. If no email is
  found, the field stays empty and required — never guess/hallucinate one.

## 3. Data model

```
User (Django built-in)
  - standard auth fields

EmailAccount
  - user (FK -> User, one active account per user for MVP)
  - provider (gmail | outlook)
  - access_token, refresh_token (encrypted at rest)
  - connected_at

JobPosting
  - posted_by (FK -> User)
  - company_name
  - role_title
  - jd_text
  - recruiter_email
  - location
  - is_active
  - created_at

JobApplication
  - user (FK -> User)
  - job_posting (FK -> JobPosting, nullable — null if JD was pasted/uploaded manually)
  - company_name
  - role_title
  - jd_text
  - recruiter_email
  - status (sent | replied | interview | rejected)
  - created_at

EmailLog
  - job_application (FK -> JobApplication)
  - subject
  - body
  - sent_at
  - gmail_thread_id  (used to poll for replies)

ReplyLog
  - job_application (FK -> JobApplication)
  - snippet
  - body
  - received_at
```

Full CRUD applies to `JobPosting` and `JobApplication` (create, edit, delete,
list, retrieve). `EmailLog`/`ReplyLog` are mostly system-written but readable
by the owning user.

## 4. API surface (high level)

```
POST   /api/auth/signup/
POST   /api/auth/login/
POST   /api/auth/refresh/

GET    /api/job-postings/                 list (job board)
POST   /api/job-postings/
GET    /api/job-postings/{id}/
PATCH  /api/job-postings/{id}/
DELETE /api/job-postings/{id}/
POST   /api/job-postings/generate-jd/     AI-generate JD from structured fields, returns draft text only, does not save

POST   /api/job-applications/extract/     accepts {text} or a file upload, returns {jd_text, recruiter_email}
GET    /api/job-applications/             list (dashboard)
POST   /api/job-applications/
GET    /api/job-applications/{id}/
PATCH  /api/job-applications/{id}/
DELETE /api/job-applications/{id}/
POST   /api/job-applications/{id}/draft-email/   AI-draft outreach email, returns draft only, does not send
POST   /api/job-applications/{id}/send-email/    sends via connected mailbox, creates EmailLog, updates status

GET    /api/email-accounts/oauth/connect/        starts Gmail/Outlook OAuth
GET    /api/email-accounts/oauth/callback/
```

Reply detection is not a user-facing endpoint — it's a Celery Beat task
(`poll_replies`) that runs periodically, checks `gmail_thread_id` on open
`EmailLog`s, and writes new `ReplyLog` rows + updates `JobApplication.status`.

## 5. End-to-end flow (applicant side)

1. User authenticates (blocked from everything otherwise).
2. New application via one of two sources: **paste text** or **upload file**
   (PDF/DOCX/image) — both converge into the same `jd_text` field.
   `POST /api/job-applications/extract/` handles file parsing (PDF/DOCX
   parser or OCR) and returns extracted text.
3. Email is auto-detected from `jd_text` via regex. If absent, user enters it
   manually. Field is required before proceeding.
4. `POST /api/job-applications/{id}/draft-email/` calls the shared AI writer
   service to generate subject + body from `jd_text` + user profile.
5. User reviews/edits the draft. Nothing has been sent yet.
6. `POST /api/job-applications/{id}/send-email/` sends via the user's
   connected mailbox, creates `EmailLog` with the resulting thread id, sets
   `JobApplication.status = sent`.
7. Celery Beat polls that thread periodically; a detected reply creates a
   `ReplyLog` and updates status to `replied`.

## 6. End-to-end flow (job posting side)

1. User opens "Post a job."
2. Choice of **write manually** (plain textarea) or **write with AI**
   (structured fields: role title, seniority, key skills, free-text notes →
   `POST /api/job-postings/generate-jd/` → returned draft populates the same
   textarea, fully editable).
3. User reviews/edits, then publishes → `POST /api/job-postings/`.
4. Posting appears on the job board; any user (including the poster) can
   apply to it via the applicant flow above, with `jd_text` and
   `recruiter_email` pre-filled from the `JobPosting`.

## 7. Environment variables

```
DATABASE_URL=
REDIS_URL=
SECRET_KEY=
JWT_SIGNING_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
GROQ_API_KEY=   (Groq API key for llama-3.1-8b-instant used by services/ai_writer.py)
```

## 8. Frontend reference

A design prototype (mocked data, no backend calls) exists at `App.jsx` —
editorial "ink & paper" aesthetic, Fraunces + Karla, single-file React with
client-side view state (`dashboard`, `board`, `apply`, `post`, `detail`).
When wiring to the real API, keep the same component boundaries
(`Dashboard`, `JobBoard`, `ApplyFlow`, `PostJob`, `ApplicationDetail`,
`EmailReview`) — replace mock arrays/`setTimeout` calls with real API calls,
don't restructure the component tree.

## 9. Out of scope / explicitly deferred

- Separate company accounts/roles
- LinkedIn post import
- Multiple connected mailboxes per user
- Any auto-send without a human review step
