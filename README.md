# Academy Concierge

Multilingual chatbot for Picsart Academy applicants and students — **Student Fellowship Program, Project 14 (Academy Chatbot)**.

It answers in **Armenian, Russian and English** (Armenian typed in Latin letters works too), and only from approved Academy content. When it doesn't know, it says so and hands the question to a coordinator instead of guessing.

## What it does

| Feature | How it works |
| --- | --- |
| Grounded answers | Every answer is built only from `knowledge/*.md` (programs, schedule, FAQ, contacts) and shows its source. |
| Three languages | Replies in the language of the question; the interface switches between ՀԱՅ / РУС / ENG. |
| Human handoff | Questions outside the knowledge base, or values not confirmed yet, are logged for a coordinator. |
| Entry-test booking | When an applicant wants to apply, the bot offers a form; the request is saved as a lead. |
| Student mode | Sign in with a student code to ask about your own schedule, next exam, payment and attendance. |
| Absence notes | A signed-in student can report an absence from the chat. |
| Coordinator panel | `/admin` lists leads, handoffs, absence notes and recent questions. |

## Demo access

- Student code: **`DEMO-STUDENT`** (made-up profile, for the demo)
- Coordinator panel: `/admin` — the admin key is the `ADMIN_KEY` value in the hosting settings (without it, the server makes a random key at start and prints it to the log).

## How it is built

- **Web app:** React + Vite (`web/`), built into `web/dist` and served by the same server.
- **Server:** Node 24 + Express (`server/`), SQLite via the built-in `node:sqlite`.
- **Model:** Gemini through an OpenAI-compatible endpoint. The knowledge base is small, so all of it goes into the system prompt with strict rules: answer only from it, return JSON with the answer, language, sources, confidence, handoff flag and suggested action.
- **Hosting:** one free Render web service (`render.yaml`).

```
browser ──► Express ──► /api/chat ──► Gemini (OpenAI-compatible API)
              │                          ▲
              │             system prompt = rules + knowledge/*.md (+ student profile)
              └──► SQLite: leads · handoffs · absence notes · messages
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status, model, loaded documents |
| POST | `/api/chat` | `{messages, sessionId, uiLang, studentCode?}` → `{answer, lang, sources, confidence, handoff, action}` |
| POST | `/api/student/login` | `{code}` → student profile |
| POST | `/api/lead` | Entry-test request |
| POST | `/api/excuse` | Absence note (signed-in student) |
| GET | `/api/admin/summary` | Coordinator data (header `x-admin-key`) |

## Run locally

```bash
npm run build
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai LLM_API_KEY=<key> CHAT_MODEL=gemini-flash-latest npm start
# open http://localhost:8080
```

Without `LLM_*` variables the server uses a local OmniRoute gateway at `http://127.0.0.1:20128/v1`.

## Limits of this demo

- The student profile is demo data; real data would come from the Academy Core Engine (Project 1).
- On Render's free plan the service sleeps after 15 minutes without traffic: the first request then takes up to a minute, and the SQLite data is reset when the service restarts.
- Telegram and Slack channels and email reply drafts are the next phase; the chat API does not depend on the channel, so they are thin adapters on top of `/api/chat`.
