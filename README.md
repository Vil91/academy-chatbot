# Academy Concierge

Multilingual AI assistant for **Picsart Academy** applicants and students — **Student Fellowship Program, Project 14 (Academy Chatbot)**.

- **Live Deployment:** https://academy-concierge-cpav.onrender.com
- **Coordinator Panel:** `/admin`

---

## Features

| Capability | Implementation |
| :--- | :--- |
| **Multilingual Chat & Voice** | Eastern Armenian (including Latin translit), Russian, and English UI + answers, SSE token streaming, and Web Speech API voice input. |
| **Strictly Grounded Knowledge Base (7 sources)** | Full `picsartacademy.am` catalog (all 14 courses with tuition, schedules, FAQs, corporate training), official policies/projects from both Academy Slack workspaces (all 16 Fellowship projects, campus zones, exam rubric), and **Academy Library** book search (`knowledge/*.md`). |
| **OAuth Authentication** | Google Identity Services (`POST /api/auth/google`) and GitHub OAuth 2.0 (`GET /api/auth/github`), `HttpOnly` session cookies, auth-gated chats & attachments. |
| **Personal Student Cabinet** | `/cabinet` localized in HY / RU / EN: weekly schedule, rooms, attendance meter, next exam, monthly payments, absence notes, and chat history. |
| **Payment Receipt Vision OCR** | Upload receipt photo in chat or cabinet → multimodal LLM extracts amount, currency, date, payer, and reference → coordinator approves/rejects in `/admin`. |
| **Campus Navigator Map** | Asking for directions renders an interactive E Plaza map card (Azatutyan Ave 24/17, Yerevan) with 1-tap Google Maps & Yandex Maps routing (and native `sendVenue` pin in Telegram). |
| **Leads & Excuse Requests** | Applicant interview/test booking (`/api/lead`, linked to full conversation + CSV export) and signed-in student absence notes (`/api/excuse`). |
| **Human Handoff & Inbox Assistant** | Uncertain/out-of-scope questions escalate to `/admin → Handoffs` with full transcript. `/admin → Inbox assistant` drafts grounded replies to student emails with `[placeholders]`. |
| **AI Quality Analytics** | `/admin → Analytics` tracks AI Deflection Rate %, average confidence %, language split, top cited knowledge sources, and channel metrics. |
| **Multi-Channel Adapters** | Web SPA + live **Telegram Bot webhook** (`/api/telegram/webhook`, auto-registered on Render) + **Slack Events API adapter** (`/api/slack/events` with HMAC-SHA256 signature verification). |

---

## Architecture

- **Frontend:** React + Vite (`web/`), built into `web/dist` and served by Express.
- **Backend:** Node 24 + Express 5 (`server/`), built-in `node:sqlite` (WAL mode, automated cleanup).
- **LLM Gateway:** OpenAI-compatible client (`server/llm.js`) with automatic retry & fallback (`gemini-3.6-flash` → `gemini-3.5-flash-lite`), SSE stream buffer flushing, and truncation auto-recovery.
- **Hosting:** Single Render Web Service (`render.yaml`, Frankfurt region).

```text
Web UI / Telegram / Slack ──► Express (Node 24) ──► Gemini API (retry + fallback)
                                     │                    ▲
                                     │      7 verified knowledge/*.md + student profile
                                     └──► SQLite: users · sessions · chats · receipts · leads · handoffs · excuses
```

## Run Locally

```bash
npm run build
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai \
LLM_API_KEY=<gemini-api-key> \
CHAT_MODEL=gemini-3.6-flash \
GOOGLE_CLIENT_ID=<google-client-id> \
GITHUB_CLIENT_ID=<github-client-id> \
GITHUB_CLIENT_SECRET=<github-client-secret> \
npm start
# open http://localhost:8080
```
