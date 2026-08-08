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
- **Email send/receive (outreach):** user's own Gmail or Outlook account via
  OAuth (`gmail.send` + `gmail.readonly` scopes, or Outlook Graph
  equivalent) — emails are sent from the user's real mailbox, not a shared
  app address, so that recruiter replies land in a thread we can poll
- **Transactional email (system):** Brevo (formerly Sendinblue)
  for account-related emails the app itself sends — currently just the
  6-digit email verification code. Do not conflate this with the user's
  connected Gmail/Outlook — verification has to work before that's connected.
- **File storage:** resumes (and any future uploads) go to object storage
  (e.g. S3) in production, local `/media` in dev. One active resume per user.
- **AI calls:** one shared backend service (`services/ai_writer.py`) used by
  JD generation, outreach email drafting, and reply drafting — do not call
  the LLM API directly from views

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
- **Accounts are unverified until the 6-digit code is confirmed.** A signed
  up but unverified user can log in but should be blocked from every
  meaningful action (posting, applying, sending) until verified — see
  section 3/4. Don't silently allow full access pre-verification.
- **One resume per user, always current.** Uploading a new resume replaces
  the active one (purging the old file from storage); it isn't a per-application choice.
  Every outreach email and reply attaches whatever the currently active resume is at send time.
  If sending an email when no resume is uploaded, sending proceeds without an attachment
  and `EmailLog.resume_attached` is set to null.
- **Replies stay in the same Gmail thread.** A reply to a recruiter is sent
  using the original `gmail_thread_id`, not a new email — this is what keeps
  the whole exchange visible as one conversation in both inboxes.

## 3. Data model

```
User (Django built-in)
  - standard auth fields
  - is_verified (bool, default False)

EmailVerificationCode
  - user (FK -> User)
  - code (6-digit string)
  - created_at
  - expires_at   (short TTL, e.g. 10 minutes)
  - is_used (bool)

Resume
  - user (FK -> User, one active resume per user — new upload replaces old)
  - file
  - original_filename
  - uploaded_at

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
  - direction (outbound | inbound)   -- outbound = sent by user (initial or reply), inbound = mirrors a ReplyLog for full-thread ordering if needed
  - type (initial | reply)           -- only meaningful when direction = outbound
  - in_reply_to (FK -> ReplyLog, nullable) -- which HR message this replies to, when type = reply
  - subject
  - body
  - resume_attached (FK -> Resume, nullable) -- which resume was attached at send time
  - sent_at
  - gmail_thread_id  (used to poll for replies and to send replies into the same thread)

ReplyLog
  - job_application (FK -> JobApplication)
  - snippet
  - body
  - received_at
  - responded (bool, default False)  -- set True once the user sends a reply to this message
```

Full CRUD applies to `JobPosting` and `JobApplication` (create, edit, delete,
list, retrieve). `EmailLog`/`ReplyLog` are mostly system-written but readable
by the owning user. `Resume` supports create (upload) and replace (delete +
re-upload, or upsert) — always exactly zero or one per user.

## 4. API surface (high level)

```
POST   /api/auth/signup/                  creates unverified user, sends 6-digit code via transactional email
POST   /api/auth/verify-email/            {code} -> marks user verified
POST   /api/auth/resend-code/             invalidates old code, sends a new one
POST   /api/auth/login/                   allowed pre-verification, but see note below
POST   /api/auth/refresh/

GET    /api/resume/                       current resume metadata (or 404 if none)
POST   /api/resume/                       upload/replace the active resume
DELETE /api/resume/

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
POST   /api/job-applications/{id}/draft-email/     AI-draft initial outreach email, returns draft only
POST   /api/job-applications/{id}/send-email/      sends via connected mailbox + attaches active resume, creates EmailLog, updates status
POST   /api/job-applications/{id}/draft-reply/     {reply_log_id} -> AI-draft a reply to that HR message, returns draft only
POST   /api/job-applications/{id}/send-reply/      {reply_log_id, subject, body} -> sends into the same Gmail thread, creates EmailLog(type=reply), marks ReplyLog.responded = True

GET    /api/email-accounts/oauth/connect/        starts Gmail/Outlook OAuth
GET    /api/email-accounts/oauth/callback/
```

Note on login-before-verification: a user can technically log in
unverified (so they aren't locked out of e.g. resending a code), but every
other endpoint above should reject unverified users except `/verify-email/`,
`/resend-code/`, and read-only profile info. Enforce this as a shared DRF
permission class, not a per-view check.

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
   connected mailbox with the user's currently active `Resume` attached,
   creates `EmailLog` (direction=outbound, type=initial) with the resulting
   thread id, sets `JobApplication.status = sent`.
7. Celery Beat polls that thread periodically; a detected reply creates a
   `ReplyLog` and updates status to `replied`.

## 6. Replying to a recruiter

1. A `ReplyLog` exists on the application (from step 7 above).
2. User chooses **manual** or **AI-assisted**:
   - Manual: types the reply directly.
   - AI: `POST /api/job-applications/{id}/draft-reply/` with the
     `reply_log_id` — AI drafts a response using that message's content plus
     the original JD/thread context. Same as everywhere else: draft only,
     editable, nothing sent yet.
3. `POST /api/job-applications/{id}/send-reply/` sends into the *same*
   `gmail_thread_id` (not a new email), attaches the active resume if
   relevant, creates `EmailLog` (direction=outbound, type=reply,
   in_reply_to=that ReplyLog), and marks `ReplyLog.responded = True`.

## 7. End-to-end flow (job posting side)

1. User opens "Post a job."
2. Choice of **write manually** (plain textarea) or **write with AI**
   (structured fields: role title, seniority, key skills, free-text notes →
   `POST /api/job-postings/generate-jd/` → returned draft populates the same
   textarea, fully editable).
3. User reviews/edits, then publishes → `POST /api/job-postings/`.
4. Posting appears on the job board; any user (including the poster) can
   apply to it via the applicant flow above, with `jd_text` and
   `recruiter_email` pre-filled from the `JobPosting`.

## 8. Environment variables

```
DATABASE_URL=
REDIS_URL=
SECRET_KEY=
JWT_SIGNING_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
BREVO_API_KEY=      (transactional email provider — verification codes only, not outreach)
BREVO_SENDER_EMAIL=   (verified sender email in Brevo, e.g. noreply@referro.app)
AWS_S3_BUCKET=      (or equivalent, for resume storage in production)
GROQ_API_KEY=   (or whichever LLM provider is used by services/ai_writer.py)
```

## 9. Frontend reference

A design prototype (mocked data, no backend calls) exists at `App.jsx` —
editorial "ink & paper" aesthetic, Fraunces + Karla, single-file React with
client-side view state (`dashboard`, `board`, `apply`, `post`, `detail`).
When wiring to the real API, keep the same component boundaries
(`Dashboard`, `JobBoard`, `ApplyFlow`, `PostJob`, `ApplicationDetail`,
`EmailReview`) — replace mock arrays/`setTimeout` calls with real API calls,
don't restructure the component tree.

## 10. Out of scope / explicitly deferred

- Separate company accounts/roles
- LinkedIn post import
- Multiple connected mailboxes per user
- Any auto-send without a human review step
