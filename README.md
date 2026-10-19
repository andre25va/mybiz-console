# MyBiz Verification Console

Mission-control screen for the MyBiz AI assistant product: an AI with its own
phone number that sits in group texts between real estate agents and their
clients. This console is the AI's **source of truth** — the assistant may only
answer from facts marked verified here.

Dark, minimal, single-page dashboard. Zero build step: `index.html` +
`styles.css` + `app.js` (vanilla JS), data from `data.json` fetched on load.

## The four sections

- **Fact Sheets** — property cards. Each fact shows a green check (verified, with
  who verified it and when) or an amber marker (awaiting verification).
- **Verification Queue** — questions the AI was asked but couldn't verify. Each
  card has **Verify** (inline form: type the answer, mark it verified — the fact
  updates on the fact sheet and the item leaves the queue, all in-memory) and
  **Dismiss**.
- **Tasks** — three columns: Doing / Waiting on human / Done.
- **Answer Log** — every answer the AI gave in a group thread, each with a
  "verified source" badge and a cited-fact link that jumps to the fact sheet.

## Run it locally

Any static server works (plain `file://` fails because `fetch` needs HTTP):

```bash
cd ~/workspace/mybiz-console
python3 -m http.server 8080
# open http://localhost:8080
```

## data.json shape

```json
{
  "generated_at": "2026-10-18T22:25:00-05:00",
  "source": "mock",
  "properties": [
    {
      "id": "prop-lydia",
      "address": "124 Lydia Ave",
      "thread": "Lydia Ave - Buyers",
      "facts": [
        {
          "label": "Property tax",
          "value": "$6,240/yr (2024, San Mateo County)",
          "verified": true,
          "verified_by": "Alex (agent)",
          "verified_at": "2026-10-15T10:20:00-05:00"
        }
      ]
    }
  ],
  "queue": [
    {
      "id": "q1",
      "question": "Is the basement at 124 Lydia Ave finished?",
      "asked_by": "Jordan (client)",
      "thread": "Lydia Ave - Buyers",
      "property_id": "prop-lydia",
      "fact_label": "Basement",
      "waiting_since": "2026-10-18T21:02:00-05:00"
    }
  ],
  "tasks": [
    {
      "id": "t1",
      "title": "Schedule showing Thu 5pm — Lydia Ave",
      "thread": "Lydia Ave - Buyers",
      "status": "doing | waiting | done",
      "updated_at": "2026-10-18T21:30:00-05:00"
    }
  ],
  "answers": [
    {
      "id": "a1",
      "snippet": "Property tax: $6,240/yr for 2024…",
      "cited_fact": "Property tax / HOA",
      "property": "124 Lydia Ave",
      "property_id": "prop-lydia",
      "thread": "Lydia Ave - Buyers",
      "at": "2026-10-18T20:41:00-05:00"
    }
  ]
}
```

Notes:

- A queue item's `property_id` + `fact_label` point at the fact it will verify.
  Verifying fills that fact in and flips it to verified.
- `source: "mock"` shows the small "mock data" note in the header; set it to
  anything else (e.g. `"live"`) to hide it.

## Connecting to the live stack later

The page only reads `data.json` — it never touches API keys. Two supported
patterns, same as the 3D town:

- **n8n (recommended):** a scheduled workflow pulls Twilio (calls, messages,
  recordings) and Supabase (leads, property facts, verification queue, tasks),
  assembles the JSON above, and rewrites `data.json` (commit to the repo via the
  GitHub node, or write to Vercel Blob / S3 that the page fetches). The page
  keeps polling the file.
- **Tiny backend:** an endpoint holding `TWILIO_*` / `SUPABASE_*` keys in
  environment variables serves the JSON; point the page at it by changing
  `DATA_URL` in `app.js`.

Suggested Supabase shape: `properties`, `facts` (with `verified`,
`verified_by`, `verified_at`), `verification_queue`, `tasks`, `answer_log`
tables — or views over the existing MyBiz tables.

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell: top bar, sidebar nav, four section panels |
| `styles.css` | Dark minimal theme, no gradients, no emojis |
| `app.js` | Section rendering, nav, verify/dismiss (in-memory) |
| `data.json` | Data contract + mock dataset |
| `README.md` | This file |
