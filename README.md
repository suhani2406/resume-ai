# Resume ATS Analyzer + AI Mock Interviewer

Upload a resume PDF, add a target job title + JD, get an ATS score two ways
(fast keyword match + deeper AI review), AI-generated HR/Technical interview
questions, and a live voice mock interview with a reactive AI interviewer
and a final scored report.

## Structure

```
resume-ai/
├── package.json
├── .env.example
├── vercel.json
├── server/
│   ├── app.js        # Express app + all routes (single source of truth)
│   ├── local.js       # local dev entry point (node server/local.js)
│   └── lib/
│       └── aiInterview.js   # all OpenAI prompts live here
├── api/
│   └── index.js        # Vercel serverless entry, reuses server/app.js
└── client/
    ├── index.html
    ├── style.css
    └── script.js
```

Previously this project had two near-duplicate server files (`app.js` for
local, `index.js` for Vercel). They're now merged into one `createApp()`
factory in `server/app.js`, used by both `server/local.js` (local dev) and
`api/index.js` (Vercel) — so every route only has to be written once.

## Setup

```bash
npm install
cp .env.example .env   # then paste your OPENAI_API_KEY in .env
npm start               # runs on http://localhost:5000
```

Without `OPENAI_API_KEY` set, the fast keyword-based ATS score still works.
Everything AI-powered (AI ATS review, interview question generation, live
reactions, final report, round transitions) will return a readable error
instead of crashing the server.

## Features

- **Job title field** — type a target title, or leave it blank and the AI
  infers one from the resume.
- **Two ATS scores** — a deterministic keyword-match score (always works,
  no API key needed) plus an AI review covering structure, quantified
  impact, and ATS-parseable formatting.
- **HR / Technical / Mixed question generation** — tailored to the resume,
  JD, and job title.
- **Live interview bot** — speech-to-text answers, a reactive AI
  interviewer that responds after each answer (and pushes harder if your
  last couple of answers were vague), spoken questions/reactions via
  text-to-speech with a mute toggle, spoken transition lines when the round
  switches from HR to Technical (or vice versa), and a final scored report
  per question plus an overall score.

## Deploying to Vercel

Push this folder to a GitHub repo and import it in Vercel, or run
`vercel` from this directory. Set `OPENAI_API_KEY` as an environment
variable in the Vercel project settings — `vercel.json` already routes
`/ai-score`, `/interview-react`, `/interview-report`, and
`/round-transition` to the serverless function, with everything else
served statically from `client/`.
