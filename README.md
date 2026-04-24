# AlysonHR

Modern People, Pay, Equity & Ops OS — built with TanStack Start.

[![License](https://img.shields.io/github/license/thiru2905/AlysonHR)](../../LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![React](https://img.shields.io/badge/React-19-149eca)
![Vite](https://img.shields.io/badge/Vite-7-646cff)
[![Stars](https://img.shields.io/github/stars/thiru2905/AlysonHR?style=flat)](https://github.com/thiru2905/AlysonHR/stargazers)
[![Forks](https://img.shields.io/github/forks/thiru2905/AlysonHR?style=flat)](https://github.com/thiru2905/AlysonHR/network/members)
[![Issues](https://img.shields.io/github/issues/thiru2905/AlysonHR?style=flat)](https://github.com/thiru2905/AlysonHR/issues)

---

## Tech stack

- **App framework**: TanStack Start (`@tanstack/react-start`)
- **Routing**: TanStack Router (`@tanstack/react-router`)
- **Data fetching**: TanStack Query (`@tanstack/react-query`)
- **UI**: React 19 + Tailwind CSS + Radix UI primitives
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Auth & DB**: Supabase (`@supabase/supabase-js`)
- **Ops Notetaker backend**: Node (Express) inside this repo (`tools/alyson-notetaker/`)
- **Tooling**: TypeScript, ESLint, Prettier, Vite

---

## Features (high level)

### People

- **Team** (`/team`): manage employees/users and roles (admin tooling included)
- **Time Dashboard** (`/time-dashboard`): Time Doctor employee hours + drilldowns
- **Attendance** (`/attendance`)
- **Leave** (`/leave`)
- **Performance** (`/performance`)

### Money

- **Payroll** (`/payroll`)
- **Bonus** (`/bonus/*`): plans, approvals, audit, simulation
- **Equity** (`/equity`)

### Ops

- **Workflows** (`/workflows`)
- **Documents** (`/documents`)
- **Reports & KPIs** (`/reports`)
- **Alyson Notetaker** (`/alyson-notetaker`): Recall.ai meeting bot + live transcript + meeting notes (Groq)

### Admin

- **Admin** (`/admin`): super-admin tools
- **Help** (`/help`)

---

## Getting started

### Prerequisites

- **Node.js**: 18+ (recommended: latest LTS)
- **npm**: comes with Node

### Install

```bash
npm install
```

### Run (web app + notetaker server)

This project starts **two processes** in development:

- AlysonHR web app (Vite dev server)
- Alyson Notetaker server (webhooks + SSE + notes generation)

```bash
npm run dev
```

Vite may choose the next free port if `8080` is in use. Check the terminal output for the URL (e.g. `http://localhost:8086`).

---

## Environment variables

Create a local `.env` (gitignored). **Never commit secrets**.

### Supabase (required for app auth/data)

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID` (optional but used in parts of the UI)

### Time Doctor (for Time Dashboard)

- `API_BASE_URL` (e.g. `https://webapi.timedoctor.com/v1.1`)
- `API_ACCESS_TOKEN`
- `API_REFRESH_TOKEN` (optional but recommended)
- `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` / `OAUTH_REDIRECT_URL` (for refresh automation)

### Alyson Notetaker (Recall.ai + Groq)

Notetaker server runs from `tools/alyson-notetaker/server.cjs` and reads env vars from the same `.env`.

- `ALYSON_NOTETAKER_PORT` (default `3003`)

Recall.ai (required to create bots + receive transcript webhooks):
- `RECALL_API_KEY`
- `RECALL_REGION` (e.g. `us-west-2`, `ap-northeast-1`)
- `PUBLIC_WEBHOOK_BASE_URL` (your public ngrok URL base, no path)
- `RECALL_VERIFICATION_SECRET` (optional; enables webhook signature verification)

Groq (optional; enables meeting notes generation):
- `GROQ_API_KEY`
- `GROQ_MODEL` (e.g. `llama-3.3-70b-versatile`)

---

## Using Alyson Notetaker (ngrok)

Recall.ai needs a public URL for webhooks. With the notetaker server running locally on port `3003`:

1) Start ngrok:

```bash
ngrok http 3003
```

2) Set `.env`:

- `PUBLIC_WEBHOOK_BASE_URL=https://<your-ngrok-subdomain>.ngrok-free.app`

3) Create a bot from the UI:

- Open **Ops → Alyson Notetaker**
- Paste your meeting URL
- Click **Create**

Webhook endpoint used:

- `PUBLIC_WEBHOOK_BASE_URL + /webhooks/recall/transcript`

---

## Repo layout

- `src/`: TanStack Start app
  - `src/routes/`: route-based pages
  - `src/components/`: UI components and drawers
  - `src/lib/`: server functions, integrations, helpers
- `supabase/`: migrations and Supabase-related config
- `tools/alyson-notetaker/`: embedded notetaker backend server (Express)
- `.cache/alyson-notetaker/`: local runtime data (gitignored)

---

## Scripts

- `npm run dev`: web app + notetaker server
- `npm run dev:web`: only the web app
- `npm run build`: production build
- `npm run preview`: preview build
- `npm run lint`: eslint
- `npm run format`: prettier

---

## Security notes

- **Do not commit `.env`**. This repo is configured to ignore it.
- Rotate any keys you accidentally paste into git history.
- Treat webhook endpoints as sensitive; enable `RECALL_VERIFICATION_SECRET` in production.

