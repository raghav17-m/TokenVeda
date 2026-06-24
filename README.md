# TokenSeva — Smart Clinic Queue System

**76% of India's 1.5 million clinics still run on paper token slips and shouting.**
TokenVeda replaces that with a two-screen, real-time digital queue: a receptionist
console to manage patients and a waiting-room display patients can check from
their own phone or the clinic TV — both updating the instant "Call Next" is clicked.

## Why "TokenVeda"

*Veda* means "knowledge" — the app turns an invisible, anxiety-inducing wait into
something patients and staff can actually *see and know*: their position, their
estimated wait, and who's being served right now.

## What's inside

| Screen | File | Purpose |
|---|---|---|
| Receptionist desk | `/receptionist.html` | Add patient (issues token), Call Next, set avg. consult time, recall/skip, remove no-shows |
| Patient waiting room | `/waiting-room.html` | Now-serving token, full queue with live ETA, personal token lookup |
| Live sync | Socket.io | Both screens subscribe to one shared in-memory queue state; every action broadcasts instantly to all connected screens — no polling needed (a 15s fallback poll exists only as a safety net if a socket drops) |

## How this maps to the evaluation criteria

**Clear problem framing with user evidence**
The brief itself states the user evidence (76% paper-based, 2–3 hr waits, zero
visibility, no doctor dashboard, receptionist working from memory). The app
directly targets each: visibility → waiting-room ETA; receptionist memory →
structured queue list; doctor dashboard → "now serving" + stats are visible to
any screen, including one mounted in the consultation room.

**Measurable outcome metrics from testing**
Every screen surfaces live, testable numbers: queue length, average consult
time, total served today, and per-patient estimated wait (`position × avg
consult time`). You can demo cause → effect instantly: change avg time, watch
every ETA in the queue update live on the patient screen.

**Edge case documentation** — handled in the engine (`server.js`):
- Priority/emergency patients jump to the front of the queue (`priority` flag).
- Recall — re-ring the current token if the patient didn't respond.
- Skip — send a no-show patient to the back of the queue instead of losing their token.
- Remove — delete a patient who cancelled before being called.
- Reset day — clear tokens/queue/history for a new clinic day without restarting the server.
- Empty queue state is handled explicitly (button disables, friendly empty-state message) instead of crashing or showing token "#0".
- Token numbers are monotonically increasing per day and never reused, so a patient can't be confused with an earlier one.

**Figma prototype or working demo**
This *is* a working full-stack demo — not a mockup. Run it locally (steps
below) and open the two screens side by side (or on two devices on the same
WiFi) to see real-time sync live.

## Tech stack

- **Backend:** Node.js, Express, Socket.io (WebSocket-based live sync), in-memory store (swap for SQLite/Postgres for production — the API/socket contract won't need to change)
- **Frontend:** Plain HTML/CSS/JS (zero build step, loads instantly on low-end clinic PCs and patients' phones)
- **Real-time:** Socket.io broadcasts a fresh state snapshot to every connected screen on every action

## Run it locally

```bash
cd tokenveda
npm install
npm start
```

Then open:
- Receptionist desk → `http://localhost:3000/receptionist.html`
- Waiting room → `http://localhost:3000/waiting-room.html`
- Landing page (links to both) → `http://localhost:3000/`

To demo live sync across devices on the same WiFi, replace `localhost` with
your machine's local IP (e.g. `http://192.168.1.7:3000/waiting-room.html`) on
a phone.

## API reference

| Method | Endpoint | Body | Effect |
|---|---|---|---|
| GET | `/api/state` | — | Full current queue state |
| POST | `/api/patients` | `{ name, priority? }` | Adds patient, issues next token |
| DELETE | `/api/patients/:id` | — | Removes a patient (no-show/cancel) |
| POST | `/api/call-next` | — | Moves current token to history, calls next from queue |
| POST | `/api/recall` | — | Re-stamps "called at" time for current token |
| POST | `/api/skip` | — | Sends current token to back of queue |
| POST | `/api/avg-time` | `{ minutes }` | Updates avg consult time → recalculates all ETAs |
| POST | `/api/reset` | — | Clears the day's queue/history/tokens |

## Suggested next steps for a real deployment

- Persist state in SQLite/Postgres so the queue survives a server restart.
- SMS/WhatsApp the patient when they're 2 tokens away (Twilio/Gupshup API).
- Multi-doctor support: one queue per doctor, shown as tabs.
- Auth for the receptionist desk; public read-only link for the waiting room.
