# Referro

Referro turns a job description into a sent application. Paste it, upload it, or apply straight from the built-in job board — Referro drafts a tailored outreach email, finds the recruiter's address, and sends it from your own inbox. Every reply gets tracked automatically, so your job search lives in one place instead of a dozen browser tabs and a half-updated spreadsheet.

## What it does

**Turns a JD into an email.** Paste text or upload a PDF/DOCX/screenshot — Referro extracts the description, drafts a tailored outreach email, and pulls the recruiter's email address straight from the text when it's there. You review and edit before anything sends; nothing goes out on its own.

**Sends from your inbox, not ours.** Connect Gmail or Outlook and emails go out under your name, from your address. Replies land in your real inbox and get pulled back into Referro automatically, so the whole exchange stays in one thread.

**Keeps every application in view.** A dashboard tracks status — sent, replied, interview, closed — across everything you've sent, with recruiter replies visible right where you need them, and the option to reply back manually or with an AI-drafted response.

**Doubles as a referral board.** Post an opening for others to apply to, with an optional AI assist for writing the job description itself.

**Attaches your resume automatically.** Upload it once, swap it whenever you update it, and every outgoing email carries the current version — no re-attaching per application.

## Tech stack

Django REST Framework and PostgreSQL on the backend, React on the frontend, Celery for background work like reply polling, and OAuth into Gmail/Outlook for sending. Email verification and drafting are handled through dedicated services so the core app logic stays clean.

## Running it locally

**Requirements:** Python 3.11+, Node 18+, PostgreSQL, Redis

```bash
# backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # fill in your own values
python manage.py migrate
python manage.py runserver
```

Start the background workers in a separate terminal:

```bash
celery -A referro worker -l info
celery -A referro beat -l info
```

```bash
# frontend
cd frontend
npm install
npm run dev
```

You'll need your own credentials for Google OAuth (Gmail sending), Brevo (verification emails), and an Anthropic API key for the AI drafting — none of these are bundled.

live site: https://referro-eosin.vercel.app/login

## License

Suraj Prajapati
