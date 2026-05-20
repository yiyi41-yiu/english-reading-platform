# English Reading Platform

An interactive English reading learning platform with AI-powered assistance, vocabulary tracking, exercises, and social features.

## Features

- **Graded Reading** — Articles across 9 levels (Primary → TOEFL)
- **AI Word Lookup** — Tap any word for Chinese translation and context
- **Exercises** — Detail, main idea, cloze, and grammar questions with Chinese explanations
- **Wrong Answer Notebook** — Review mistakes with grammar analysis
- **Virtual Pet** — Gamification companion that grows as you learn
- **Community** — Comments, study groups, activity feed
- **Guest Access** — Try without registering

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Copy environment config
cp .env.example .env   # edit .env with your settings

# Start server
npm run dev
```

Open **http://localhost:3000** in your browser.

## Demo Accounts

| Role    | Email              | Password     |
|---------|--------------------|--------------|
| Student | student@demo.com   | student123   |
| Teacher | teacher@demo.com   | teacher123   |

Or click "Quick Start" on the login page to try without registering.

## Environment Variables

| Variable          | Description               | Default               |
|-------------------|---------------------------|-----------------------|
| `DATABASE_URL`    | SQLite database path      | `./data/app.db`       |
| `JWT_SECRET`      | JWT signing secret        | (required)            |
| `DEEPSEEK_API_KEY`| DeepSeek API key for AI   | (optional)            |
| `PORT`            | Server port               | `3000`                |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + Zustand
- **Backend:** Express 5 + TypeScript + Drizzle ORM + SQLite (better-sqlite3)
- **AI:** DeepSeek API (OpenAI-compatible)
